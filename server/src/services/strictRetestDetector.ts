/**
 * Strict Retest Detector - Professional Pattern Detection
 *
 * גרסה מקצועית לזיהוי תבניות Retest אמיתיות עם:
 * - Pivot-based detection (Swing Highs/Lows)
 * - ATR-based dynamic buffers
 * - Strict confirmation rules
 * - Rejection modes (invalidation + timeout)
 * - WICK vs CLOSE retest types
 * - Optional MA trend filter
 *
 * Based on professional trading rules and backtesting principles.
 */

import type { Candle, Pattern } from '../types/index.js'

/**
 * Pivot point (Swing High or Swing Low)
 */
interface Pivot {
  index: number
  price: number
  time: number
}

/**
 * Retest detection options
 */
export interface RetestDetectorOptions {
  // Pivot detection
  pivotLeft?: number        // Left bars for pivot (default: 2)
  pivotRight?: number       // Right bars for pivot (default: 2)

  // Trend filter (optional)
  useTrendFilter?: boolean  // Enable MA-based trend filter (default: true)
  maPeriod?: number         // MA period for trend (default: 200)

  // ATR-based buffers
  atrPeriod?: number        // ATR period (default: 14)
  breakoutAtrMult?: number  // Breakout buffer multiplier (default: 0.10 = 10% of ATR)
  retestAtrMult?: number    // Retest tolerance multiplier (default: 0.20 = 20% of ATR)
  confirmAtrMult?: number   // Confirmation buffer multiplier (default: 0.05 = 5% of ATR)
  invalidAtrMult?: number   // Invalidation threshold multiplier (default: 0.25 = 25% of ATR)

  // Timing rules
  minBarsAfterBreakout?: number  // Minimum bars to wait after breakout (default: 5)
  maxBarsToWaitRetest?: number   // Maximum bars to wait for retest (default: 60)

  // Retest type
  retestTypeMode?: 'WICK' | 'CLOSE' | 'BOTH'  // Which retest type to accept (default: 'BOTH')
}

/**
 * Retest signal result
 */
export interface RetestSignal {
  kind: string              // RETEST_LONG_WICK | RETEST_LONG_CLOSE | REJECT_LONG_... etc.
  side: 'LONG' | 'SHORT'
  level: number             // The pivot level
  pivotIndex: number        // Where the pivot was
  breakoutIndex: number     // Where breakout occurred
  retestIndex?: number      // Where retest touched (if successful)
  confirmIndex?: number     // Where confirmation happened (if successful)
  rejectIndex?: number      // Where rejection happened (if failed)
  time: number              // Timestamp of final event
  isReversal: boolean       // true = reversal pattern, false = continuation pattern
  pivotType: 'high' | 'low' // Which type of pivot was broken
}

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(candles: Candle[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null)
  let sum = 0

  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close
    if (i >= period) sum -= candles[i - period].close
    if (i >= period - 1) out[i] = sum / period
  }

  return out
}

/**
 * Detect local trend using swing structure (without MA)
 * Returns: 'UP' | 'DOWN' | 'NEUTRAL'
 *
 * Logic (strict pivot-based):
 * - Pivot = swing point with 2 bars on each side (5 bars total)
 * - **CRITICAL**: Must have EXACTLY 2 pivot highs AND 2 pivot lows to define trend
 *
 * - **UP trend**: Need 2 consecutive higher pivot highs AND 2 consecutive higher pivot lows
 *   - Example: PH1 (5000) < PH2 (5100) = higher highs ✓
 *   -          PL1 (4800) < PL2 (4900) = higher lows ✓
 *   - Result: UPTREND confirmed (both structure elements rising)
 *
 * - **DOWN trend**: Need 2 consecutive lower pivot highs AND 2 consecutive lower pivot lows
 *   - Example: PH1 (5100) > PH2 (5000) = lower highs ✓
 *   -          PL1 (4900) > PL2 (4800) = lower lows ✓
 *   - Result: DOWNTREND confirmed (both structure elements falling)
 *
 * - **NEUTRAL**: Less than 2 pivots of each type OR mixed signals
 *   - Example 1: Only 1 pivot high, 1 pivot low → NEUTRAL (not enough data)
 *   - Example 2: Higher highs but lower lows → NEUTRAL (choppy/ranging)
 *   - Example 3: Lower highs but higher lows → NEUTRAL (consolidation)
 *   - Result: No patterns created (prevents false signals in ranging markets)
 *
 * This strict requirement ensures:
 * - Clear trend structure before pattern detection
 * - Accurate CONTINUATION vs REVERSAL classification
 * - Fewer false signals in ranging/choppy markets
 */
function detectLocalTrend(candles: Candle[], index: number, lookback: number = 30): 'UP' | 'DOWN' | 'NEUTRAL' {
  if (index < lookback) return 'NEUTRAL'

  const window = candles.slice(index - lookback, index + 1)

  // Find pivot highs and lows (strict: 2 bars on each side)
  const pivotHighs: number[] = []
  const pivotLows: number[] = []

  for (let i = 2; i < window.length - 2; i++) {
    const c = window[i]

    // Pivot High: higher than 2 bars on BOTH sides
    const isPivotHigh = c.high > window[i-1].high && c.high > window[i-2].high &&
                        c.high > window[i+1].high && c.high > window[i+2].high

    // Pivot Low: lower than 2 bars on BOTH sides
    const isPivotLow = c.low < window[i-1].low && c.low < window[i-2].low &&
                       c.low < window[i+1].low && c.low < window[i+2].low

    if (isPivotHigh) pivotHighs.push(c.high)
    if (isPivotLow) pivotLows.push(c.low)
  }

  // ✅ NEW: Require EXACTLY 2 pivot highs AND 2 pivot lows to define trend
  // This ensures we have a clear structure: 2 consecutive higher/lower highs + 2 consecutive higher/lower lows
  if (pivotHighs.length < 2 || pivotLows.length < 2) {
    // console.log(`   🔍 Trend detection at index ${index}: NEUTRAL (found ${pivotHighs.length} pivot highs, ${pivotLows.length} pivot lows - need 2 of each)`)
    return 'NEUTRAL'
  }

  // Compare LAST 2 pivots to determine direction
  const recentHighs = pivotHighs.slice(-2)
  const recentLows = pivotLows.slice(-2)

  const higherHighs = recentHighs[1] > recentHighs[0]
  const higherLows = recentLows[1] > recentLows[0]

  // ✅ UP trend: BOTH 2 higher highs AND 2 higher lows
  // This confirms uptrend structure with both swing highs and swing lows making higher levels
  if (higherHighs && higherLows) {
    // console.log(`   📈 Trend: UP (2 HH: ${recentHighs[0].toFixed(2)} → ${recentHighs[1].toFixed(2)}, 2 HL: ${recentLows[0].toFixed(2)} → ${recentLows[1].toFixed(2)})`)
    return 'UP'
  }

  // ✅ DOWN trend: BOTH 2 lower highs AND 2 lower lows
  // This confirms downtrend structure with both swing highs and swing lows making lower levels
  if (!higherHighs && !higherLows) {
    // console.log(`   📉 Trend: DOWN (2 LH: ${recentHighs[0].toFixed(2)} → ${recentHighs[1].toFixed(2)}, 2 LL: ${recentLows[0].toFixed(2)} → ${recentLows[1].toFixed(2)})`)
    return 'DOWN'
  }

  // Mixed signals (choppy/ranging) - when highs and lows move in opposite directions
  // Example: higher highs but lower lows, or lower highs but higher lows
  // console.log(`   ⚡ Trend: NEUTRAL (mixed signals - HH:${higherHighs}, HL:${higherLows})`)
  return 'NEUTRAL'
}

/**
 * Calculate Average True Range (ATR)
 */
function calculateATR(candles: Candle[], period: number = 14): (number | null)[] {
  const tr: (number | null)[] = new Array(candles.length).fill(null)
  const atr: (number | null)[] = new Array(candles.length).fill(null)

  // Calculate True Range
  for (let i = 0; i < candles.length; i++) {
    const h = candles[i].high
    const l = candles[i].low

    if (i === 0) {
      tr[i] = h - l
    } else {
      const pc = candles[i - 1].close
      tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc))
    }
  }

  // Calculate ATR (simple average of TR)
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) continue

    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += tr[j]!
    }
    atr[i] = sum / period
  }

  return atr
}

/**
 * Find strict pivot highs and lows
 * A pivot high is strictly greater than all surrounding highs
 * A pivot low is strictly less than all surrounding lows
 */
function findPivots(
  candles: Candle[],
  left: number = 2,
  right: number = 2
): { pivotHighs: Pivot[]; pivotLows: Pivot[] } {
  const pivotHighs: Pivot[] = []
  const pivotLows: Pivot[] = []

  for (let i = left; i < candles.length - right; i++) {
    const cur = candles[i]

    // Check for pivot high
    let isHigh = true
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue
      if (candles[j].high >= cur.high) {
        isHigh = false
        break
      }
    }
    if (isHigh) {
      pivotHighs.push({ index: i, price: cur.high, time: cur.time })
    }

    // Check for pivot low
    let isLow = true
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue
      if (candles[j].low <= cur.low) {
        isLow = false
        break
      }
    }
    if (isLow) {
      pivotLows.push({ index: i, price: cur.low, time: cur.time })
    }
  }

  return { pivotHighs, pivotLows }
}

/**
 * Find last pivot before or at given index (binary search)
 */
function lastPivotBeforeIndex(pivots: Pivot[], index: number): Pivot | null {
  let lo = 0
  let hi = pivots.length - 1
  let ans: Pivot | null = null

  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (pivots[mid].index <= index) {
      ans = pivots[mid]
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return ans
}

/**
 * Check if candle is a LONG wick touch:
 * - Low touches level (within tolerance)
 * - But close stays above level (doesn't invalidate)
 * - Low doesn't go too far below level (max 2x tolerance)
 */
function isLongWickTouch(c: Candle, level: number, tol: number): boolean {
  return (c.low <= level + tol) && (c.low >= level - 2 * tol) && (c.close >= level - tol)
}

/**
 * Check if candle is a LONG close touch:
 * - Close is within tolerance around level
 */
function isLongCloseTouch(c: Candle, level: number, tol: number): boolean {
  return (c.close >= level - tol) && (c.close <= level + tol)
}

/**
 * Check if candle is a SHORT wick touch:
 * - High touches level (within tolerance)
 * - But close stays below level (doesn't invalidate)
 * - High doesn't go too far above level (max 2x tolerance)
 */
function isShortWickTouch(c: Candle, level: number, tol: number): boolean {
  return (c.high >= level - tol) && (c.high <= level + 2 * tol) && (c.close <= level + tol)
}

/**
 * Check if candle is a SHORT close touch:
 * - Close is within tolerance around level
 */
function isShortCloseTouch(c: Candle, level: number, tol: number): boolean {
  return (c.close >= level - tol) && (c.close <= level + tol)
}

/**
 * Find strict retest for LONG setup
 */
interface RetestSearchParams {
  level: number
  tol: number
  confirmBuf: number
  invalidBuf: number
  start: number
  end: number
  retestTypeMode: 'WICK' | 'CLOSE' | 'BOTH'
}

interface RetestSearchResult {
  kind: string
  retestIndex?: number
  confirmIndex?: number
  rejectIndex?: number
}

function findStrictRetestLong(
  candles: Candle[],
  params: RetestSearchParams
): RetestSearchResult | null {
  const { level, tol, confirmBuf, invalidBuf, start, end, retestTypeMode } = params

  let touchedIndexWick: number | undefined = undefined
  let touchedIndexClose: number | undefined = undefined

  console.log(`      🔍 Searching for LONG retest (level: ${level.toFixed(2)}, tol: ${tol.toFixed(2)})`)

  for (let i = start; i <= end; i++) {
    const c = candles[i]

    // REJECT by invalidation: close decisively below level
    if (c.close < level - invalidBuf) {
      console.log(`      ❌ INVALIDATION at index ${i}: close ${c.close.toFixed(2)} < ${(level - invalidBuf).toFixed(2)}`)
      return { kind: 'REJECT_LONG_INVALIDATION', rejectIndex: i }
    }

    // Touch detection
    const wickTouch = isLongWickTouch(c, level, tol)
    const closeTouch = isLongCloseTouch(c, level, tol)

    if (wickTouch && touchedIndexWick === undefined) {
      touchedIndexWick = i
      console.log(`      👇 WICK TOUCH at index ${i}: low=${c.low.toFixed(2)}, close=${c.close.toFixed(2)}`)
    }
    if (closeTouch && touchedIndexClose === undefined) {
      touchedIndexClose = i
      console.log(`      📍 CLOSE TOUCH at index ${i}: close=${c.close.toFixed(2)}`)
    }

    // Confirmation strict: close above level + confirmBuf AND higher than previous close
    const prev = i > 0 ? candles[i - 1] : c
    const confirmed = (c.close > level + confirmBuf) && (c.close > prev.close)

    if (confirmed) {
      // Determine which retest type we accept (strict ordering: must have had a touch before confirm)
      const hadWick = touchedIndexWick !== undefined && touchedIndexWick < i
      const hadClose = touchedIndexClose !== undefined && touchedIndexClose < i

      // ✅ NEW: Validate 2 candles after retest don't return back below level
      // For LONG: after touching level from above, next 2 candles shouldn't close below level
      const retestIdx = hadClose ? touchedIndexClose : touchedIndexWick
      if (retestIdx !== undefined) {
        let validPostRetest = true
        for (let j = 1; j <= 2; j++) {
          if (retestIdx + j >= candles.length) break
          const postCandle = candles[retestIdx + j]
          // If candle closes below level, pattern invalidated
          if (postCandle.close < level) {
            validPostRetest = false
            break
          }
        }

        if (!validPostRetest) {
          console.log(`      ❌ Post-retest validation failed: candles after retest returned below level`)
          continue // Skip to next candle
        }
      }

      // Return successful pattern
      if (retestTypeMode === 'WICK') {
        if (hadWick) {
          return { kind: 'RETEST_LONG_WICK', retestIndex: touchedIndexWick, confirmIndex: i }
        }
      } else if (retestTypeMode === 'CLOSE') {
        if (hadClose) {
          return { kind: 'RETEST_LONG_CLOSE', retestIndex: touchedIndexClose, confirmIndex: i }
        }
      } else {
        // BOTH: prefer CLOSE if it happened; else WICK
        if (hadClose) {
          return { kind: 'RETEST_LONG_CLOSE', retestIndex: touchedIndexClose, confirmIndex: i }
        }
        if (hadWick) {
          return { kind: 'RETEST_LONG_WICK', retestIndex: touchedIndexWick, confirmIndex: i }
        }
      }
    }
  }

  console.log(`      ⏱️ TIMEOUT: No confirmation found within window`)
  return { kind: 'REJECT_LONG_TIMEOUT', rejectIndex: end }
}

/**
 * Find strict retest for SHORT setup
 */
function findStrictRetestShort(
  candles: Candle[],
  params: RetestSearchParams
): RetestSearchResult | null {
  const { level, tol, confirmBuf, invalidBuf, start, end, retestTypeMode } = params

  let touchedIndexWick: number | undefined = undefined
  let touchedIndexClose: number | undefined = undefined

  console.log(`      🔍 Searching for SHORT retest (level: ${level.toFixed(2)}, tol: ${tol.toFixed(2)})`)

  for (let i = start; i <= end; i++) {
    const c = candles[i]

    // REJECT by invalidation: close decisively above level
    if (c.close > level + invalidBuf) {
      console.log(`      ❌ INVALIDATION at index ${i}: close ${c.close.toFixed(2)} > ${(level + invalidBuf).toFixed(2)}`)
      return { kind: 'REJECT_SHORT_INVALIDATION', rejectIndex: i }
    }

    const wickTouch = isShortWickTouch(c, level, tol)
    const closeTouch = isShortCloseTouch(c, level, tol)

    if (wickTouch && touchedIndexWick === undefined) {
      touchedIndexWick = i
      console.log(`      👆 WICK TOUCH at index ${i}: high=${c.high.toFixed(2)}, close=${c.close.toFixed(2)}`)
    }
    if (closeTouch && touchedIndexClose === undefined) {
      touchedIndexClose = i
      console.log(`      📍 CLOSE TOUCH at index ${i}: close=${c.close.toFixed(2)}`)
    }

    // Confirmation strict: close below level - confirmBuf AND lower than previous close
    const prev = i > 0 ? candles[i - 1] : c
    const confirmed = (c.close < level - confirmBuf) && (c.close < prev.close)

    if (confirmed) {
      const hadWick = touchedIndexWick !== undefined && touchedIndexWick < i
      const hadClose = touchedIndexClose !== undefined && touchedIndexClose < i

      // ✅ NEW: Validate 2 candles after retest don't return back above level
      // For SHORT: after touching level from below, next 2 candles shouldn't close above level
      const retestIdx = hadClose ? touchedIndexClose : touchedIndexWick
      if (retestIdx !== undefined) {
        let validPostRetest = true
        for (let j = 1; j <= 2; j++) {
          if (retestIdx + j >= candles.length) break
          const postCandle = candles[retestIdx + j]
          // If candle closes above level, pattern invalidated
          if (postCandle.close > level) {
            validPostRetest = false
            break
          }
        }

        if (!validPostRetest) {
          console.log(`      ❌ Post-retest validation failed: candles after retest returned above level`)
          continue // Skip to next candle
        }
      }

      // Return successful pattern
      if (retestTypeMode === 'WICK') {
        if (hadWick) {
          return { kind: 'RETEST_SHORT_WICK', retestIndex: touchedIndexWick, confirmIndex: i }
        }
      } else if (retestTypeMode === 'CLOSE') {
        if (hadClose) {
          return { kind: 'RETEST_SHORT_CLOSE', retestIndex: touchedIndexClose, confirmIndex: i }
        }
      } else {
        // BOTH: prefer CLOSE if it happened; else WICK
        if (hadClose) {
          return { kind: 'RETEST_SHORT_CLOSE', retestIndex: touchedIndexClose, confirmIndex: i }
        }
        if (hadWick) {
          return { kind: 'RETEST_SHORT_WICK', retestIndex: touchedIndexWick, confirmIndex: i }
        }
      }
    }
  }

  console.log(`      ⏱️ TIMEOUT: No confirmation found within window`)
  return { kind: 'REJECT_SHORT_TIMEOUT', rejectIndex: end }
}

/**
 * Main function: Detect all retest patterns in candle data
 *
 * Returns array of signals (both successful retests and rejections)
 */
export function detectRetests(
  candles: Candle[],
  options: RetestDetectorOptions = {}
): RetestSignal[] {
  const {
    pivotLeft = 2,
    pivotRight = 2,
    useTrendFilter = true,
    maPeriod = 200,
    atrPeriod = 14,
    breakoutAtrMult = 0.10,
    retestAtrMult = 0.20,
    confirmAtrMult = 0.05,
    invalidAtrMult = 0.25,
    minBarsAfterBreakout = 5,
    maxBarsToWaitRetest = 60,
    retestTypeMode = 'BOTH',
  } = options

  if (!Array.isArray(candles) || candles.length < 50) {
    console.warn('⚠️ Not enough candles for retest detection (need 50+)')
    return []
  }

  const { pivotHighs, pivotLows } = findPivots(candles, pivotLeft, pivotRight)
  const atr = calculateATR(candles, atrPeriod)
  const ma = useTrendFilter ? calculateSMA(candles, maPeriod) : null

  console.log(`📊 Found ${pivotHighs.length} pivot highs, ${pivotLows.length} pivot lows`)

  const signals: RetestSignal[] = []

  // Scan all candles for patterns (no limit)
  for (let i = 0; i < candles.length; i++) {
    const a = atr[i]
    if (a == null) continue

    // Detect local trend using swing structure (instead of MA)
    const localTrend = detectLocalTrend(candles, i, 20)

    // Trend filters
    let trendUp: boolean
    let trendDown: boolean

    if (useTrendFilter && ma) {
      // MA-based trend filter (original logic)
      trendUp = ma[i] != null && candles[i].close > ma[i]!
      trendDown = ma[i] != null && candles[i].close < ma[i]!
    } else {
      // Local swing-based trend detection (NEW)
      trendUp = localTrend === 'UP'
      trendDown = localTrend === 'DOWN'
      // NEUTRAL trend: skip pattern detection (no clear trend)
      // This prevents duplicate patterns at same pivot
    }

    const breakoutBuf = a * breakoutAtrMult
    const tol = a * retestAtrMult
    const confirmBuf = a * confirmAtrMult
    const invalidBuf = a * invalidAtrMult

    // ---------- LONG breakout candidate from last pivot high ----------
    const ph = lastPivotBeforeIndex(pivotHighs, i)
    if (ph && trendUp) {
      const level = ph.price

      // Breakout condition (strict): close above level + buffer
      if (candles[i].close > level + breakoutBuf) {
        const breakoutIndex = i

        // ✅ NEW: Validate that continuation candles actually move away from level
        // Goal: Ensure the minBarsAfterBreakout candles don't all touch the pivot level
        // For LONG: candles should stay above level (not return to it immediately)
        let validContinuation = true
        for (let j = 1; j <= minBarsAfterBreakout; j++) {
          if (breakoutIndex + j >= candles.length) {
            validContinuation = false
            break
          }
          const continuationCandle = candles[breakoutIndex + j]
          // Require close to stay away from level (above level + tolerance)
          // This prevents patterns where all 5 candles touch the breakout line
          if (continuationCandle.close < level + tol) {
            validContinuation = false
            break
          }
        }

        if (!validContinuation) {
          // Skip this breakout - continuation candles didn't move away from level
          continue
        }

        // Search retest window
        const start = breakoutIndex + minBarsAfterBreakout
        const end = Math.min(candles.length - 1, breakoutIndex + maxBarsToWaitRetest)

        const res = findStrictRetestLong(candles, {
          level,
          tol,
          confirmBuf,
          invalidBuf,
          start,
          end,
          retestTypeMode,
        })

        if (res && res.confirmIndex !== undefined) {
          // Only log successful patterns
          console.log(`✅ Pattern complete at index ${res.confirmIndex}:`)
          console.log(`   Pivot: ${level.toFixed(2)}, Breakout: ${breakoutIndex}, Retest: ${res.retestIndex}, Confirm: ${res.confirmIndex}`)

          signals.push({
            kind: res.kind,
            side: 'LONG',
            level,
            pivotIndex: ph.index,
            breakoutIndex,
            retestIndex: res.retestIndex,
            confirmIndex: res.confirmIndex,
            rejectIndex: res.rejectIndex,
            time: candles[res.confirmIndex ?? res.rejectIndex ?? breakoutIndex].time,
            isReversal: false, // Continuation: uptrend breaking pivot high
            pivotType: 'high',
          })
        }
      }
    }

    // ---------- SHORT breakout candidate from last pivot low ----------
    const pl = lastPivotBeforeIndex(pivotLows, i)
    if (pl && trendDown) {
      const level = pl.price

      // ✅ תנאי חדש: הפיבוט חייב להיות רחוק מספיק מהפריצה (לפחות 5 נרות)
      const minPivotDistance = 5  // הקטנה מ-10 ל-5 לאפשר יותר SHORT patterns
      const pivotDistance = i - pl.index

      if (pivotDistance < minPivotDistance) {
        continue // דלג על הפיבוט הזה - הוא יותר מדי קרוב
      }

      // Breakout condition (strict): close below level - buffer
      if (candles[i].close < level - breakoutBuf) {
        const breakoutIndex = i

        console.log(`🔴 SHORT CONTINUATION - Breakout detected at index ${breakoutIndex}:`)
        console.log(`   Local Trend: ${localTrend} (DOWN trend required for continuation)`)
        console.log(`   Pivot Low: ${level.toFixed(2)} at index ${pl.index}`)
        console.log(`   Breakout: ${candles[i].close.toFixed(2)} < ${(level - breakoutBuf).toFixed(2)}`)
        console.log(`   minBarsAfterBreakout: ${minBarsAfterBreakout}`)

        // ✅ NEW: Validate that continuation candles actually move away from level
        // Goal: Ensure the minBarsAfterBreakout candles don't all touch the pivot level
        // For SHORT CONTINUATION: broke DOWN through pivot LOW, so candles should stay BELOW
        // The level is pivot LOW, so continuation candles should NOT return ABOVE it
        let validContinuation = true
        for (let j = 1; j <= minBarsAfterBreakout; j++) {
          if (breakoutIndex + j >= candles.length) {
            validContinuation = false
            break
          }
          const continuationCandle = candles[breakoutIndex + j]
          // Require close to stay BELOW level (not return above it)
          // If candle closes ABOVE level + tolerance, it returned to the breakout level
          if (continuationCandle.close > level + tol) {
            validContinuation = false
            break
          }
        }

        if (!validContinuation) {
          // Skip this breakout - continuation candles didn't move away from level
          console.log(`   ❌ Rejected: continuation candles returned above breakout level`)
          continue
        }

        const start = breakoutIndex + minBarsAfterBreakout
        const end = Math.min(candles.length - 1, breakoutIndex + maxBarsToWaitRetest)

        console.log(`   Retest search window: ${start} to ${end} (${end - start + 1} candles)`)

        const res = findStrictRetestShort(candles, {
          level,
          tol,
          confirmBuf,
          invalidBuf,
          start,
          end,
          retestTypeMode,
        })

        if (res) {
          console.log(`   ✅ Result: ${res.kind}`)
          if (res.retestIndex !== undefined) {
            console.log(`      Retest at index ${res.retestIndex} (${res.retestIndex - breakoutIndex} bars after breakout)`)
            console.log(`      Retest price: high=${candles[res.retestIndex].high.toFixed(2)}, close=${candles[res.retestIndex].close.toFixed(2)}`)
          }
          if (res.confirmIndex !== undefined) {
            console.log(`      Confirm at index ${res.confirmIndex}`)
            console.log(`      Confirm price: close=${candles[res.confirmIndex].close.toFixed(2)}`)
          }

          signals.push({
            kind: res.kind,
            side: 'SHORT',
            level,
            pivotIndex: pl.index,
            breakoutIndex,
            retestIndex: res.retestIndex,
            confirmIndex: res.confirmIndex,
            rejectIndex: res.rejectIndex,
            time: candles[res.confirmIndex ?? res.rejectIndex ?? breakoutIndex].time,
            isReversal: false, // Continuation: downtrend breaking pivot low
            pivotType: 'low',
          })
        }
      }
    }

    // ---------- LONG REVERSAL: breakout UP from last pivot high (downtrend reversal) ----------
    // מגמת ירידה → שבירת Pivot High (התנגדות) מעלה → Retest מלמעלה → המשך למעלה
    if (ph && trendDown) {
      const level = ph.price

      // Breakout UP through resistance (reversal!)
      if (candles[i].close > level + breakoutBuf) {
        const breakoutIndex = i

        console.log(`🟢 LONG REVERSAL - Breakout detected at index ${breakoutIndex}:`)
        console.log(`   Local Trend: ${localTrend} (DOWN trend required for reversal)`)
        console.log(`   Pivot High: ${level.toFixed(2)} at index ${ph.index}`)
        console.log(`   Breakout UP: ${candles[i].close.toFixed(2)} > ${(level + breakoutBuf).toFixed(2)}`)
        console.log(`   (Downtrend breaking resistance)`)
        console.log(`   minBarsAfterBreakout: ${minBarsAfterBreakout}`)

        // ✅ NEW: Validate that continuation candles actually move away from level
        // Goal: Ensure the minBarsAfterBreakout candles don't all touch the pivot level
        // For LONG REVERSAL: candles should stay above level (not return to it immediately)
        let validContinuation = true
        for (let j = 1; j <= minBarsAfterBreakout; j++) {
          if (breakoutIndex + j >= candles.length) {
            validContinuation = false
            break
          }
          const continuationCandle = candles[breakoutIndex + j]
          // Require close to stay away from level (above level + tolerance)
          // This prevents patterns where all 5 candles touch the breakout line
          if (continuationCandle.close < level + tol) {
            validContinuation = false
            break
          }
        }

        if (!validContinuation) {
          // Skip this breakout - continuation candles didn't move away from level
          console.log(`   ❌ Rejected: continuation candles touch the breakout level`)
          continue
        }

        const start = breakoutIndex + minBarsAfterBreakout
        const end = Math.min(candles.length - 1, breakoutIndex + maxBarsToWaitRetest)

        console.log(`   Retest search window: ${start} to ${end} (${end - start + 1} candles)`)

        const res = findStrictRetestLong(candles, {
          level,
          tol,
          confirmBuf,
          invalidBuf,
          start,
          end,
          retestTypeMode,
        })

        if (res && res.confirmIndex !== undefined) {
          // Only log successful patterns
          console.log(`✅ Pattern complete at index ${res.confirmIndex}:`)
          console.log(`   Pivot: ${level.toFixed(2)}, Breakout: ${breakoutIndex}, Retest: ${res.retestIndex}, Confirm: ${res.confirmIndex}`)

          signals.push({
            kind: res.kind,
            side: 'LONG',
            level,
            pivotIndex: ph.index,
            breakoutIndex,
            retestIndex: res.retestIndex,
            confirmIndex: res.confirmIndex,
            rejectIndex: res.rejectIndex,
            time: candles[res.confirmIndex ?? res.rejectIndex ?? breakoutIndex].time,
            isReversal: true, // REVERSAL: downtrend breaking resistance
            pivotType: 'high',
          })
        }
      }
    }

    // ---------- SHORT REVERSAL: breakout DOWN from last pivot low (uptrend reversal) ----------
    // מגמת עליה → שבירת Pivot Low (תמיכה) מטה → Retest מלמטה → המשך למטה
    if (pl && trendUp) {
      const level = pl.price

      // Breakout DOWN through support (reversal!)
      if (candles[i].close < level - breakoutBuf) {
        const breakoutIndex = i

        console.log(`🟠 SHORT REVERSAL - Breakout detected at index ${breakoutIndex}:`)
        console.log(`   Local Trend: ${localTrend} (UP trend required for reversal)`)
        console.log(`   Pivot Low: ${level.toFixed(2)} at index ${pl.index}`)
        console.log(`   Breakout DOWN: ${candles[i].close.toFixed(2)} < ${(level - breakoutBuf).toFixed(2)}`)
        console.log(`   (Uptrend breaking support)`)
        console.log(`   minBarsAfterBreakout: ${minBarsAfterBreakout}`)

        // ✅ NEW: Validate that continuation candles actually move away from level
        // Goal: Ensure the minBarsAfterBreakout candles don't all touch the pivot level
        // For SHORT REVERSAL: broke DOWN through pivot LOW (support), so candles should stay BELOW
        // The level is pivot LOW, so continuation candles should NOT return ABOVE it
        let validContinuation = true
        for (let j = 1; j <= minBarsAfterBreakout; j++) {
          if (breakoutIndex + j >= candles.length) {
            validContinuation = false
            break
          }
          const continuationCandle = candles[breakoutIndex + j]
          // Require close to stay BELOW level (not return above it)
          // If candle closes ABOVE level + tolerance, it returned to the breakout level
          if (continuationCandle.close > level + tol) {
            validContinuation = false
            break
          }
        }

        if (!validContinuation) {
          // Skip this breakout - continuation candles didn't move away from level
          console.log(`   ❌ Rejected: continuation candles returned above breakout level`)
          continue
        }

        const start = breakoutIndex + minBarsAfterBreakout
        const end = Math.min(candles.length - 1, breakoutIndex + maxBarsToWaitRetest)

        console.log(`   Retest search window: ${start} to ${end} (${end - start + 1} candles)`)

        const res = findStrictRetestShort(candles, {
          level,
          tol,
          confirmBuf,
          invalidBuf,
          start,
          end,
          retestTypeMode,
        })

        if (res) {
          console.log(`   ✅ Result: ${res.kind}`)
          if (res.retestIndex !== undefined) {
            console.log(`      Retest at index ${res.retestIndex} (${res.retestIndex - breakoutIndex} bars after breakout)`)
            console.log(`      Retest price: high=${candles[res.retestIndex].high.toFixed(2)}, close=${candles[res.retestIndex].close.toFixed(2)}`)
          }
          if (res.confirmIndex !== undefined) {
            console.log(`      Confirm at index ${res.confirmIndex}`)
            console.log(`      Confirm price: close=${candles[res.confirmIndex].close.toFixed(2)}`)
          }

          signals.push({
            kind: res.kind,
            side: 'SHORT',
            level,
            pivotIndex: pl.index,
            breakoutIndex,
            retestIndex: res.retestIndex,
            confirmIndex: res.confirmIndex,
            rejectIndex: res.rejectIndex,
            time: candles[res.confirmIndex ?? res.rejectIndex ?? breakoutIndex].time,
            isReversal: true, // REVERSAL: uptrend breaking support
            pivotType: 'low',
          })
        }
      }
    }
  }

  console.log(`✅ Detected ${signals.length} retest signals (including rejections)`)
  return signals
}

/**
 * Convert RetestSignal to Pattern format (for existing game system)
 * Only converts successful retests, not rejections
 */
export function convertRetestSignalToPattern(signal: RetestSignal): Pattern | null {
  // Only convert successful retests
  if (!signal.kind.startsWith('RETEST_')) return null
  if (signal.confirmIndex === undefined || signal.retestIndex === undefined) return null

  const isLong = signal.side === 'LONG'
  const level = signal.level

  // Entry: slightly above retest level for LONG, below for SHORT
  const expectedEntry = isLong ? level * 1.003 : level * 0.997

  // Exit: 4% target
  const expectedExit = isLong ? level * 1.04 : level * 0.96

  // Stop loss: 1.5% beyond level
  const stopLoss = isLong ? level * 0.985 : level * 1.015

  // Build detailed description with pattern type
  const patternTypeText = signal.isReversal ? 'היפוך' : 'המשך'
  const directionText = isLong ? 'LONG' : 'SHORT'
  const retestType = signal.kind.includes('WICK') ? 'Wick Touch' : 'Close Touch'

  const description = `Retest ${directionText} ${patternTypeText} | ${retestType}`

  // Build detailed hint with correct logic for LONG/SHORT
  let hint = ''
  if (signal.isReversal) {
    if (isLong) {
      // REVERSAL LONG: Downtrend → breaks resistance (pivot high) UP → retest from above → continue up
      hint = `🔄 היפוך מגמה LONG:\n` +
             `1️⃣ מגמת ירידה → שבירת Pivot High (התנגדות) כלפי מעלה\n` +
             `2️⃣ Retest - חזרה לבדיקת רמת השבירה מלמעלה (wick/close touch)\n` +
             `3️⃣ אישור - המשך למעלה אחרי bounce מהרמה\n` +
             `💡 כניסה: ${expectedEntry.toFixed(2)} | SL: ${stopLoss.toFixed(2)}`
    } else {
      // REVERSAL SHORT: Uptrend → breaks support (pivot low) DOWN → retest from below → continue down
      hint = `🔄 היפוך מגמה SHORT:\n` +
             `1️⃣ מגמת עליה → שבירת Pivot Low (תמיכה) כלפי מטה\n` +
             `2️⃣ Retest - חזרה לבדיקת רמת השבירה מלמטה (wick/close touch)\n` +
             `3️⃣ אישור - המשך למטה אחרי bounce מהרמה\n` +
             `💡 כניסה: ${expectedEntry.toFixed(2)} | SL: ${stopLoss.toFixed(2)}`
    }
  } else {
    if (isLong) {
      // CONTINUATION LONG: Uptrend → breaks resistance (pivot high) UP → retest from above → continue up
      hint = `📈 המשך מגמה LONG:\n` +
             `1️⃣ מגמת עליה → שבירת Pivot High (התנגדות) כלפי מעלה\n` +
             `2️⃣ Retest - חזרה לבדיקת רמת השבירה מלמעלה (wick/close touch)\n` +
             `3️⃣ אישור - המשך מעלה אחרי bounce מהרמה\n` +
             `💡 כניסה: ${expectedEntry.toFixed(2)} | SL: ${stopLoss.toFixed(2)}`
    } else {
      // CONTINUATION SHORT: Downtrend → breaks support (pivot low) DOWN → retest from below → continue down
      hint = `📉 המשך מגמה SHORT:\n` +
             `1️⃣ מגמת ירידה → שבירת Pivot Low (תמיכה) כלפי מטה\n` +
             `2️⃣ Retest - חזרה לבדיקת רמת השבירה מלמטה (wick/close touch)\n` +
             `3️⃣ אישור - המשך מטה אחרי bounce מהרמה\n` +
             `💡 כניסה: ${expectedEntry.toFixed(2)} | SL: ${stopLoss.toFixed(2)}`
    }
  }

  return {
    type: 'retest',
    startIndex: signal.breakoutIndex,    // Pattern range: from breakout...
    endIndex: signal.retestIndex,         // ...to retest (shows full pattern development)
    expectedEntry,
    expectedExit,
    stopLoss,
    metadata: {
      quality: 85 + Math.floor(Math.random() * 10), // High quality for strict detection
      description,
      hint,
      // Store indices for visualization (used by frontend)
      retestIndex: signal.retestIndex,      // Where retest touch occurred
      breakoutIndex: signal.breakoutIndex,  // Where breakout occurred
      pivotIndex: signal.pivotIndex,        // Where the original pivot high/low was (for line drawing)
      pivotLevel: signal.level,             // The exact price level of the pivot
    },
  }
}

/**
 * Detect retest patterns and return them in Pattern format
 * (Wrapper for easy integration with existing system)
 */
export function detectRetestPatterns(
  candles: Candle[],
  _targetCount: number = 8,  // Not used - we return all patterns now
  options: RetestDetectorOptions = {}
): Pattern[] {
  const signals = detectRetests(candles, options)

  // Filter only successful retests (not rejections)
  const successfulRetests = signals.filter(s => s.kind.startsWith('RETEST_'))

  console.log(`🎯 ${successfulRetests.length} successful retests out of ${signals.length} total signals`)

  // Strategy: Use ALL successful retests (with minGap filtering to prevent tight overlaps)
  // No artificial limit - let the trader practice on all detected patterns!
  const patterns: Pattern[] = []
  const minGap = 15 // Minimum candles between patterns to prevent overlap

  for (const signal of successfulRetests) {
    const pattern = convertRetestSignalToPattern(signal)
    if (!pattern) continue

    // Check if this pattern overlaps with existing patterns
    const hasOverlap = patterns.some(p => Math.abs(p.startIndex - pattern.startIndex) < minGap)
    if (hasOverlap) continue

    patterns.push(pattern)
    console.log(`   ✓ Added ${signal.isReversal ? 'Reversal' : 'Continuation'} ${signal.side} Retest at index ${pattern.startIndex}`)
  }

  console.log(`📊 Selected ${patterns.length} non-overlapping retest patterns from ${successfulRetests.length} candidates`)
  console.log(`   Distribution: patterns spread across indices ${patterns.length > 0 ? `${patterns[0].startIndex} to ${patterns[patterns.length - 1].endIndex}` : 'N/A'}`)
  return patterns
}

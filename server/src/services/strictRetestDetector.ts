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
 * - UP trend: Need 2 higher pivot highs AND 2 higher pivot lows
 * - DOWN trend: Need 2 lower pivot highs AND 2 lower pivot lows
 * - NEUTRAL: Less than 2 pivots or mixed signals
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

  // Need EXACTLY 2 or more pivots of each type to determine trend
  if (pivotHighs.length < 2 || pivotLows.length < 2) {
    // console.log(`   🔍 Trend detection at index ${index}: NEUTRAL (found ${pivotHighs.length} pivot highs, ${pivotLows.length} pivot lows)`)
    return 'NEUTRAL'
  }

  // Compare LAST 2 pivots to determine direction
  const recentHighs = pivotHighs.slice(-2)
  const recentLows = pivotLows.slice(-2)

  const higherHighs = recentHighs[1] > recentHighs[0]
  const higherLows = recentLows[1] > recentLows[0]

  // UP trend: both higher highs AND higher lows
  if (higherHighs && higherLows) {
    // console.log(`   📈 Trend: UP (HH: ${recentHighs[0].toFixed(2)} → ${recentHighs[1].toFixed(2)}, HL: ${recentLows[0].toFixed(2)} → ${recentLows[1].toFixed(2)})`)
    return 'UP'
  }

  // DOWN trend: both lower highs AND lower lows
  if (!higherHighs && !higherLows) {
    // console.log(`   📉 Trend: DOWN (LH: ${recentHighs[0].toFixed(2)} → ${recentHighs[1].toFixed(2)}, LL: ${recentLows[0].toFixed(2)} → ${recentLows[1].toFixed(2)})`)
    return 'DOWN'
  }

  // Mixed signals (choppy/ranging)
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
 */
function isLongWickTouch(c: Candle, level: number, tol: number): boolean {
  return (c.low <= level + tol) && (c.close >= level - tol)
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
 */
function isShortWickTouch(c: Candle, level: number, tol: number): boolean {
  return (c.high >= level - tol) && (c.close <= level + tol)
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
      console.log(`      ✅ CONFIRMATION at index ${i}: close ${c.close.toFixed(2)} > ${(level + confirmBuf).toFixed(2)} && > prev ${prev.close.toFixed(2)}`)

      // Determine which retest type we accept (strict ordering: must have had a touch before confirm)
      const hadWick = touchedIndexWick !== undefined && touchedIndexWick < i
      const hadClose = touchedIndexClose !== undefined && touchedIndexClose < i

      if (retestTypeMode === 'WICK') {
        if (hadWick) return { kind: 'RETEST_LONG_WICK', retestIndex: touchedIndexWick, confirmIndex: i }
      } else if (retestTypeMode === 'CLOSE') {
        if (hadClose) return { kind: 'RETEST_LONG_CLOSE', retestIndex: touchedIndexClose, confirmIndex: i }
      } else {
        // BOTH: prefer CLOSE if it happened; else WICK
        if (hadClose) return { kind: 'RETEST_LONG_CLOSE', retestIndex: touchedIndexClose, confirmIndex: i }
        if (hadWick) return { kind: 'RETEST_LONG_WICK', retestIndex: touchedIndexWick, confirmIndex: i }
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
      console.log(`      ✅ CONFIRMATION at index ${i}: close ${c.close.toFixed(2)} < ${(level - confirmBuf).toFixed(2)} && < prev ${prev.close.toFixed(2)}`)

      const hadWick = touchedIndexWick !== undefined && touchedIndexWick < i
      const hadClose = touchedIndexClose !== undefined && touchedIndexClose < i

      if (retestTypeMode === 'WICK') {
        if (hadWick) return { kind: 'RETEST_SHORT_WICK', retestIndex: touchedIndexWick, confirmIndex: i }
      } else if (retestTypeMode === 'CLOSE') {
        if (hadClose) return { kind: 'RETEST_SHORT_CLOSE', retestIndex: touchedIndexClose, confirmIndex: i }
      } else {
        // BOTH: prefer CLOSE if it happened; else WICK
        if (hadClose) return { kind: 'RETEST_SHORT_CLOSE', retestIndex: touchedIndexClose, confirmIndex: i }
        if (hadWick) return { kind: 'RETEST_SHORT_WICK', retestIndex: touchedIndexWick, confirmIndex: i }
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

        console.log(`🔵 LONG CONTINUATION - Breakout detected at index ${breakoutIndex}:`)
        console.log(`   Local Trend: ${localTrend} (UP trend required for continuation)`)
        console.log(`   Pivot High: ${level.toFixed(2)} at index ${ph.index}`)
        console.log(`   Breakout: ${candles[i].close.toFixed(2)} > ${(level + breakoutBuf).toFixed(2)}`)
        console.log(`   minBarsAfterBreakout: ${minBarsAfterBreakout}`)

        // Search retest window
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

        if (res) {
          console.log(`   ✅ Result: ${res.kind}`)
          if (res.retestIndex !== undefined) {
            console.log(`      Retest at index ${res.retestIndex} (${res.retestIndex - breakoutIndex} bars after breakout)`)
            console.log(`      Retest price: low=${candles[res.retestIndex].low.toFixed(2)}, close=${candles[res.retestIndex].close.toFixed(2)}`)
          }
          if (res.confirmIndex !== undefined) {
            console.log(`      Confirm at index ${res.confirmIndex}`)
            console.log(`      Confirm price: close=${candles[res.confirmIndex].close.toFixed(2)}`)
          }

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
        } else {
          console.log(`   ❌ No retest found`)
        }
      }
    }

    // ---------- SHORT breakout candidate from last pivot low ----------
    const pl = lastPivotBeforeIndex(pivotLows, i)
    if (pl && trendDown) {
      const level = pl.price

      // Breakout condition (strict): close below level - buffer
      if (candles[i].close < level - breakoutBuf) {
        const breakoutIndex = i

        console.log(`🔴 SHORT CONTINUATION - Breakout detected at index ${breakoutIndex}:`)
        console.log(`   Local Trend: ${localTrend} (DOWN trend required for continuation)`)
        console.log(`   Pivot Low: ${level.toFixed(2)} at index ${pl.index}`)
        console.log(`   Breakout: ${candles[i].close.toFixed(2)} < ${(level - breakoutBuf).toFixed(2)}`)
        console.log(`   minBarsAfterBreakout: ${minBarsAfterBreakout}`)

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
        } else {
          console.log(`   ❌ No retest found`)
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

        if (res) {
          console.log(`   ✅ Result: ${res.kind}`)
          if (res.retestIndex !== undefined) {
            console.log(`      Retest at index ${res.retestIndex} (${res.retestIndex - breakoutIndex} bars after breakout)`)
            console.log(`      Retest price: low=${candles[res.retestIndex].low.toFixed(2)}, close=${candles[res.retestIndex].close.toFixed(2)}`)
          }
          if (res.confirmIndex !== undefined) {
            console.log(`      Confirm at index ${res.confirmIndex}`)
            console.log(`      Confirm price: close=${candles[res.confirmIndex].close.toFixed(2)}`)
          }

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
        } else {
          console.log(`   ❌ No retest found`)
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
        } else {
          console.log(`   ❌ No retest found`)
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

  // Build detailed description
  const patternTypeText = signal.isReversal ? 'היפוך מגמה' : 'המשך מגמה'
  const retestType = signal.kind.includes('WICK') ? 'Wick Touch' : 'Close Touch'

  const description = `${patternTypeText} | ${isLong ? 'LONG' : 'SHORT'} Retest | ${retestType}`

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
    startIndex: signal.breakoutIndex + 1,  // Start AFTER breakout candle (not on breakout itself)
    endIndex: signal.confirmIndex,
    expectedEntry,
    expectedExit,
    stopLoss,
    metadata: {
      quality: 85 + Math.floor(Math.random() * 10), // High quality for strict detection
      description,
      hint,
      // Store retest index for marker placement (used by frontend)
      retestIndex: signal.retestIndex,
      breakoutIndex: signal.breakoutIndex,
    },
  }
}

/**
 * Detect retest patterns and return them in Pattern format
 * (Wrapper for easy integration with existing system)
 */
export function detectRetestPatterns(
  candles: Candle[],
  targetCount: number = 8,
  options: RetestDetectorOptions = {}
): Pattern[] {
  const signals = detectRetests(candles, options)

  // Filter only successful retests (not rejections)
  const successfulRetests = signals.filter(s => s.kind.startsWith('RETEST_'))

  console.log(`🎯 ${successfulRetests.length} successful retests out of ${signals.length} total signals`)

  // Convert to Pattern format with minimum gap to prevent overlaps
  const patterns: Pattern[] = []
  const minGap = 30 // Minimum candles between patterns to prevent overlap

  for (const signal of successfulRetests) {
    const pattern = convertRetestSignalToPattern(signal)
    if (!pattern) continue

    // Check if this pattern overlaps with existing patterns
    const hasOverlap = patterns.some(p => Math.abs(p.startIndex - pattern.startIndex) < minGap)
    if (hasOverlap) continue

    patterns.push(pattern)
    console.log(`   ✓ Added ${signal.isReversal ? 'Reversal' : 'Continuation'} ${signal.side} Retest at index ${pattern.startIndex}`)

    // Stop when we have enough patterns
    if (patterns.length >= targetCount) break
  }

  console.log(`📊 Selected ${patterns.length} non-overlapping retest patterns from ${successfulRetests.length} candidates`)
  return patterns
}

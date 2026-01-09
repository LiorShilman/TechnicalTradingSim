/**
 * Professional Consolidation + Breakout Detector - ENHANCED VERSION
 *
 * Combines best practices from multiple algorithms:
 * - Wilder's ATR calculation (correct implementation)
 * - Optional touches validation (flexible for different assets)
 * - Consolidation ending at i-1, breakout at i (cleaner logic)
 * - Dynamic config selection (crypto vs stocks/indices)
 * - Detailed logging for debugging
 *
 * Algorithm:
 * 1. For each candle i, check if i-1 ends a consolidation
 * 2. If yes, check if i breaks out (with buffer)
 * 3. Optional: volume confirmation
 * 4. Optional: follow-through confirmation
 */

import type { Candle, Pattern } from '../types/index.js'

interface ConsolidationBreakoutConfig {
  // Consolidation parameters
  consolidationWindow: number      // Candles to check (e.g., 10-15)
  maxRangePct: number              // Max price range % (e.g., 0.02 = 2%)
  maxAtrPct: number                // Max ATR % (e.g., 0.025 = 2.5%)
  atrPeriod: number                // ATR calculation period
  minTouches: number               // Min touches of high/low boundaries (e.g., 2)
  requireTouches: boolean          // Whether to enforce touches check
  maxDriftPct: number              // Max drift % (e.g., 0.008 = 0.8%)

  // Breakout parameters
  minBufferPct: number             // Min buffer % beyond H/L (e.g., 0.0005 = 0.05%)
  bufferAtrMult: number            // ATR multiplier for buffer (e.g., 0.2)
  requireCloseOutside: boolean     // Require close (not just wick) outside range
  minVolSpike: number              // Min volume spike multiplier (e.g., 1.3)
  requireVolumeConfirm: boolean    // Whether to enforce volume check

  // Confirmation
  requireFollowThrough: boolean    // Require next candle continues
  minFollowThroughPct: number      // Min % continuation (e.g., 0.001 = 0.1%)
  requireStayOutside: boolean      // Require follow-through stays outside range
}

// Strict config for crypto (tight consolidations)
const STRICT_CONFIG: ConsolidationBreakoutConfig = {
  consolidationWindow: 15,
  maxRangePct: 0.02,               // 2%
  maxAtrPct: 0.025,                // 2.5%
  atrPeriod: 14,
  minTouches: 2,
  requireTouches: true,            // Enforce touches
  maxDriftPct: 0.008,              // 0.8%
  minBufferPct: 0.0005,            // 0.05%
  bufferAtrMult: 0.2,
  requireCloseOutside: true,
  minVolSpike: 1.3,
  requireVolumeConfirm: true,      // Enforce volume
  requireFollowThrough: true,
  minFollowThroughPct: 0.001,      // 0.1%
  requireStayOutside: true,
}

// Relaxed config for stocks/indices (wider consolidations)
const RELAXED_CONFIG: ConsolidationBreakoutConfig = {
  consolidationWindow: 12,         // 12 candles (shorter)
  maxRangePct: 0.04,               // 4% (wider range)
  maxAtrPct: 0.045,                // 4.5% (higher volatility)
  atrPeriod: 14,
  minTouches: 1,                   // Only 1 touch needed
  requireTouches: false,           // Don't enforce touches
  maxDriftPct: 0.015,              // 1.5% (allow more drift)
  minBufferPct: 0.0005,            // 0.05%
  bufferAtrMult: 0.15,             // Smaller buffer (0.15x ATR)
  requireCloseOutside: true,
  minVolSpike: 1.2,                // Lower volume requirement
  requireVolumeConfirm: false,     // Don't enforce volume
  requireFollowThrough: true,
  minFollowThroughPct: 0.001,      // 0.1%
  requireStayOutside: true,
}

/**
 * Calculate ATR (Wilder's method) - CORRECT IMPLEMENTATION
 */
function calculateATR(candles: Candle[], period: number): (number | null)[] {
  const atr: (number | null)[] = []
  const tr: number[] = []

  // Calculate True Range for all candles
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      tr.push(candles[i].high - candles[i].low)
    } else {
      const trValue = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close)
      )
      tr.push(trValue)
    }
  }

  // Calculate ATR using Wilder's smoothing
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      atr.push(null) // Not enough data yet
    } else if (i === period - 1) {
      // Seed: simple average of first 'period' TRs
      const sum = tr.slice(0, period).reduce((a, b) => a + b, 0)
      atr.push(sum / period)
    } else {
      // Wilder's smoothing: ATR = (prevATR * (period-1) + TR) / period
      const prevATR = atr[i - 1]!
      atr.push((prevATR * (period - 1) + tr[i]) / period)
    }
  }

  return atr
}

/**
 * Count touches of range boundaries
 */
function countTouches(
  candles: Candle[],
  rangeHigh: number,
  rangeLow: number,
  touchEps: number
): { highTouches: number; lowTouches: number } {
  let highTouches = 0
  let lowTouches = 0

  for (const c of candles) {
    if (Math.abs(c.high - rangeHigh) <= touchEps) {
      highTouches++
    }
    if (Math.abs(c.low - rangeLow) <= touchEps) {
      lowTouches++
    }
  }

  return { highTouches, lowTouches }
}

/**
 * Detect consolidation ending at endIndex
 * Returns consolidation details if valid, null otherwise
 */
function detectConsolidation(
  candles: Candle[],
  endIndex: number,
  atr: (number | null)[],
  config: ConsolidationBreakoutConfig,
  verbose: boolean = false
): { isConsolidation: boolean; high: number; low: number; avgVolume: number; rangePct: number; atrPct: number } | null {
  const { consolidationWindow, maxRangePct, maxAtrPct, minTouches, requireTouches, maxDriftPct } = config

  const startIdx = Math.max(0, endIndex - consolidationWindow + 1)
  if (startIdx < 0 || endIndex >= candles.length) {
    return null
  }

  // Extract window
  const window = candles.slice(startIdx, endIndex + 1)

  // A) Price range check
  const highs = window.map(c => c.high)
  const lows = window.map(c => c.low)
  const high = Math.max(...highs)
  const low = Math.min(...lows)
  const range = high - low
  const avgClose = window.reduce((sum, c) => sum + c.close, 0) / window.length
  const rangePct = range / avgClose

  if (verbose) {
    console.log(`📦 Checking consolidation at index ${endIndex}:`)
    console.log(`   Range: ${(rangePct * 100).toFixed(3)}% (max: ${(maxRangePct * 100).toFixed(1)}%)`)
  }

  if (rangePct > maxRangePct) {
    if (verbose) console.log(`   ❌ Range too wide`)
    return null // Range too wide
  }

  // B) ATR check
  const currentATR = atr[endIndex]
  if (currentATR == null) {
    if (verbose) console.log(`   ❌ ATR not available`)
    return null // ATR not available yet
  }

  const atrPct = currentATR / avgClose

  if (verbose) {
    console.log(`   ATR: ${(atrPct * 100).toFixed(3)}% (max: ${(maxAtrPct * 100).toFixed(1)}%)`)
  }

  if (atrPct > maxAtrPct) {
    if (verbose) console.log(`   ❌ ATR too high`)
    return null // ATR too high
  }

  // C) Touches check (optional)
  const touchEps = currentATR * 0.1 // 10% of ATR
  const touches = countTouches(window, high, low, touchEps)

  if (verbose) {
    console.log(`   Touches: ${touches.highTouches} high, ${touches.lowTouches} low (min: ${minTouches}, required: ${requireTouches})`)
  }

  if (requireTouches && (touches.highTouches < minTouches || touches.lowTouches < minTouches)) {
    if (verbose) console.log(`   ❌ Not enough touches`)
    return null // Not enough touches
  }

  // D) Drift check - ensure no strong trend
  const firstClose = window[0].close
  const lastClose = window[window.length - 1].close
  const drift = Math.abs(lastClose - firstClose) / avgClose

  if (verbose) {
    console.log(`   Drift: ${(drift * 100).toFixed(3)}% (max: ${(maxDriftPct * 100).toFixed(1)}%)`)
  }

  if (drift > maxDriftPct) {
    if (verbose) console.log(`   ❌ Too much drift`)
    return null // Too much drift - not consolidation
  }

  // Calculate average volume (handle missing volume)
  const volumes = window.map(c => c.volume).filter(v => v != null && !isNaN(v))
  const avgVolume = volumes.length > 0
    ? volumes.reduce((sum, v) => sum + v, 0) / volumes.length
    : 0

  if (verbose) {
    console.log(`   ✅ Valid consolidation! Range: ${(rangePct * 100).toFixed(2)}%, ATR: ${(atrPct * 100).toFixed(2)}%`)
  }

  return {
    isConsolidation: true,
    high,
    low,
    avgVolume,
    rangePct,
    atrPct,
  }
}

/**
 * Detect breakout from consolidation - ENHANCED VERSION
 *
 * Key differences from previous version:
 * - Consolidation ends at i-1, breakout checked at i (cleaner logic)
 * - Optional touches validation (flexible)
 * - Optional volume validation (flexible)
 * - Detailed logging for debugging
 */
export function detectConsolidationBreakout(
  candles: Candle[],
  startIndex: number,
  config: Partial<ConsolidationBreakoutConfig> = {},
  asset: string = 'UNKNOWN',
  verbose: boolean = false
): Pattern | null {
  // Select config based on asset
  const isCryptoOrForex = asset.includes('/')
  const defaultConfig = isCryptoOrForex ? STRICT_CONFIG : RELAXED_CONFIG
  const cfg: ConsolidationBreakoutConfig = { ...defaultConfig, ...config }

  // Need enough candles
  if (startIndex < cfg.consolidationWindow + cfg.atrPeriod + 5) {
    return null
  }
  if (startIndex + 2 >= candles.length) {
    return null // Need room for breakout + follow-through
  }

  // Calculate ATR
  const atr = calculateATR(candles, cfg.atrPeriod)

  // Check for consolidation ending at startIndex
  const consol = detectConsolidation(candles, startIndex, atr, cfg, verbose)
  if (!consol || !consol.isConsolidation) {
    return null
  }

  // Check breakout at startIndex + 1
  const breakoutIdx = startIndex + 1
  if (breakoutIdx >= candles.length) return null

  const breakoutCandle = candles[breakoutIdx]
  const currentATR = atr[breakoutIdx]
  if (currentATR == null) return null

  // Calculate buffer
  const buffer = Math.max(
    breakoutCandle.close * cfg.minBufferPct,
    currentATR * cfg.bufferAtrMult
  )

  // Detect breakout direction
  let direction: 'UP' | 'DOWN' | null = null

  if (cfg.requireCloseOutside) {
    // Close must be outside
    if (breakoutCandle.close > consol.high + buffer) {
      direction = 'UP'
    } else if (breakoutCandle.close < consol.low - buffer) {
      direction = 'DOWN'
    }
  } else {
    // Wick can be outside
    if (breakoutCandle.high > consol.high + buffer) {
      direction = 'UP'
    } else if (breakoutCandle.low < consol.low - buffer) {
      direction = 'DOWN'
    }
  }

  if (!direction) return null // No breakout

  if (verbose) {
    console.log(`   🎯 Breakout ${direction} detected at index ${breakoutIdx}`)
    console.log(`      Breakout price: ${breakoutCandle.close}, Range: ${consol.low.toFixed(2)}-${consol.high.toFixed(2)}, Buffer: ${buffer.toFixed(2)}`)
  }

  // Volume spike check (optional)
  if (cfg.requireVolumeConfirm && consol.avgVolume > 0) {
    if (breakoutCandle.volume < consol.avgVolume * cfg.minVolSpike) {
      if (verbose) console.log(`   ❌ Insufficient volume: ${breakoutCandle.volume} < ${(consol.avgVolume * cfg.minVolSpike).toFixed(0)}`)
      return null // Insufficient volume
    }
    if (verbose) console.log(`   ✅ Volume confirmed: ${breakoutCandle.volume} >= ${(consol.avgVolume * cfg.minVolSpike).toFixed(0)}`)
  }

  // Follow-through check
  if (cfg.requireFollowThrough) {
    const followIdx = breakoutIdx + 1
    if (followIdx >= candles.length) return null

    const followCandle = candles[followIdx]
    const followPct = (followCandle.close - breakoutCandle.close) / breakoutCandle.close

    // Check percentage continuation
    if (direction === 'UP' && followPct < cfg.minFollowThroughPct) {
      if (verbose) console.log(`   ❌ No follow-through UP: ${(followPct * 100).toFixed(2)}% < ${(cfg.minFollowThroughPct * 100).toFixed(2)}%`)
      return null
    }
    if (direction === 'DOWN' && followPct > -cfg.minFollowThroughPct) {
      if (verbose) console.log(`   ❌ No follow-through DOWN: ${(followPct * 100).toFixed(2)}% > ${(-cfg.minFollowThroughPct * 100).toFixed(2)}%`)
      return null
    }

    // Check that follow-through stays outside range
    if (cfg.requireStayOutside) {
      if (direction === 'UP' && followCandle.close < consol.high + buffer) {
        if (verbose) console.log(`   ❌ Follow-through fell back inside: ${followCandle.close} < ${(consol.high + buffer).toFixed(2)}`)
        return null
      }
      if (direction === 'DOWN' && followCandle.close > consol.low - buffer) {
        if (verbose) console.log(`   ❌ Follow-through rose back inside: ${followCandle.close} > ${(consol.low - buffer).toFixed(2)}`)
        return null
      }
    }

    if (verbose) console.log(`   ✅ Follow-through confirmed`)
  }

  // Pattern detected!
  const consolidationStartIdx = Math.max(0, startIndex - cfg.consolidationWindow + 1)
  const consolidationEndIdx = startIndex

  // Calculate expected levels
  const breakoutPrice = breakoutCandle.close
  const consolRange = consol.high - consol.low

  const expectedEntry = direction === 'UP'
    ? breakoutPrice * 1.001
    : breakoutPrice * 0.999

  const expectedExit = direction === 'UP'
    ? breakoutPrice + (consolRange * 2) // Target: 2x consolidation range (measured move)
    : breakoutPrice - (consolRange * 2)

  const stopLoss = direction === 'UP'
    ? consol.low - buffer
    : consol.high + buffer

  // Quality scoring - normalized (0-95)
  const volumeRatio = consol.avgVolume > 0 ? breakoutCandle.volume / consol.avgVolume : 2

  // Range component: tighter range = better (0-40 points)
  const rangeComponent = Math.max(0, 40 * (1 - consol.rangePct / cfg.maxRangePct))

  // ATR component: lower ATR = better (0-30 points)
  const atrComponent = Math.max(0, 30 * (1 - consol.atrPct / cfg.maxAtrPct))

  // Volume component: higher spike = better (0-30 points)
  const volComponent = consol.avgVolume > 0
    ? Math.min(30, (volumeRatio - 1) * 15)
    : 20 // Default if no volume

  const quality = Math.round(Math.min(95, rangeComponent + atrComponent + volComponent))

  if (verbose) {
    console.log(`   🎉 PATTERN COMPLETE!`)
    console.log(`      Quality: ${quality}% (range: ${rangeComponent.toFixed(0)}, ATR: ${atrComponent.toFixed(0)}, vol: ${volComponent.toFixed(0)})`)
    console.log(`      Entry: ${expectedEntry.toFixed(2)}, Exit: ${expectedExit.toFixed(2)}, SL: ${stopLoss.toFixed(2)}`)
  }

  return {
    type: 'breakout',
    startIndex: consolidationStartIdx,
    endIndex: consolidationEndIdx,  // Show only consolidation box
    expectedEntry,
    expectedExit,
    stopLoss,
    metadata: {
      quality,
      description: direction === 'UP'
        ? `פריצה למעלה מקונסולידציה (${cfg.consolidationWindow} נרות)`
        : `פריצה למטה מקונסולידציה (${cfg.consolidationWindow} נרות)`,
      hint: direction === 'UP'
        ? `📈 שים לב:\n1️⃣ קונסולידציה - ${cfg.consolidationWindow} נרות בטווח צר (${(consol.rangePct * 100).toFixed(2)}%)\n2️⃣ פריצה למעלה - נר עם נפח גבוה פי ${volumeRatio.toFixed(1)}\n3️⃣ אישור - המשך למעלה\n💡 כניסה: ${expectedEntry.toFixed(2)} | SL: ${stopLoss.toFixed(2)}`
        : `📉 שים לב:\n1️⃣ קונסולידציה - ${cfg.consolidationWindow} נרות בטווח צר (${(consol.rangePct * 100).toFixed(2)}%)\n2️⃣ פריצה למטה - נר עם נפח גבוה פי ${volumeRatio.toFixed(1)}\n3️⃣ אישור - המשך למטה\n💡 כניסה: ${expectedEntry.toFixed(2)} | SL: ${stopLoss.toFixed(2)}`,
      breakoutIndex: breakoutIdx,
    },
  }
}

/**
 * Scan candles for multiple consolidation breakout patterns
 */
export function detectConsolidationBreakouts(
  candles: Candle[],
  maxPatterns: number,
  config: Partial<ConsolidationBreakoutConfig> = {},
  asset: string = 'UNKNOWN'
): Pattern[] {
  const patterns: Pattern[] = []

  // Select config based on asset
  const isCryptoOrForex = asset.includes('/')
  const defaultConfig = isCryptoOrForex ? STRICT_CONFIG : RELAXED_CONFIG
  const cfg: ConsolidationBreakoutConfig = { ...defaultConfig, ...config }

  const minGap = cfg.consolidationWindow + 10

  console.log(`🔍 Scanning for consolidation breakout patterns (${isCryptoOrForex ? 'STRICT' : 'RELAXED'} mode)...`)
  console.log(`   Asset: ${asset}, Window: ${cfg.consolidationWindow}, MaxRange: ${(cfg.maxRangePct * 100).toFixed(2)}%, MaxATR: ${(cfg.maxAtrPct * 100).toFixed(2)}%`)
  console.log(`   MinTouches: ${cfg.minTouches} (required: ${cfg.requireTouches}), MaxDrift: ${(cfg.maxDriftPct * 100).toFixed(2)}%`)
  console.log(`   Volume required: ${cfg.requireVolumeConfirm}, Follow-through required: ${cfg.requireFollowThrough}`)

  const startIdx = cfg.consolidationWindow + cfg.atrPeriod + 10
  const endIdx = candles.length - 2

  for (let i = startIdx; i < endIdx && patterns.length < maxPatterns; i++) {
    // Check overlap with existing patterns
    const hasOverlap = patterns.some(p => {
      const rangeStart = Math.min(p.startIndex, p.endIndex) - minGap
      const rangeEnd = Math.max(p.startIndex, p.endIndex) + minGap
      return i >= rangeStart && i <= rangeEnd
    })

    if (hasOverlap) continue

    const verbose = patterns.length < 3 // Verbose logging for first 3 patterns
    const pattern = detectConsolidationBreakout(candles, i, config, asset, verbose)
    if (pattern) {
      patterns.push(pattern)
      console.log(`   ✅ Breakout pattern #${patterns.length} at consol_end=${i}, breakout=${pattern.metadata.breakoutIndex} (quality: ${pattern.metadata.quality}%)`)
      i += minGap // Skip ahead
    }
  }

  console.log(`   📊 Total consolidation breakout patterns found: ${patterns.length}`)
  return patterns
}

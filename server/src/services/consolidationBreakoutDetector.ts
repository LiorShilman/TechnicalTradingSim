/**
 * Professional Consolidation + Breakout Detector - FIXED VERSION
 *
 * Algorithm:
 * 1. CONSOLIDATION Detection:
 *    - Narrow price range (rangePct <= threshold)
 *    - Volatility contraction (ATR contraction)
 *    - Touches validation (price tests boundaries)
 *    - Optional: Volume contraction
 *
 * 2. BREAKOUT Detection:
 *    - Close breaks consolidation range (H or L) + buffer
 *    - Volume spike (optional)
 *    - Confirmation: follow-through candle stays outside range
 */

import type { Candle, Pattern } from '../types/index.js'

interface ConsolidationBreakoutConfig {
  // Consolidation parameters
  consolidationWindow: number      // Candles to check (e.g., 10-20)
  maxRangePct: number              // Max price range % (e.g., 0.015 = 1.5%)
  maxAtrPct: number                // Max ATR % (e.g., 0.02 = 2%)
  atrPeriod: number                // ATR calculation period
  minTouches: number               // Min touches of high/low boundaries (e.g., 2)
  maxDriftPct: number              // Max drift % (e.g., 0.005 = 0.5%)

  // Breakout parameters
  minBufferPct: number             // Min buffer % beyond H/L (e.g., 0.0005 = 0.05%)
  bufferAtrMult: number            // ATR multiplier for buffer (e.g., 0.2)
  minVolSpike: number              // Min volume spike multiplier (e.g., 1.3)
  breakoutLookahead: number        // Bars to look ahead for breakout (e.g., 1-3)

  // Confirmation
  requireFollowThrough: boolean    // Require next candle continues
  minFollowThroughPct: number      // Min % continuation (e.g., 0.001 = 0.1%)
  requireStayOutside: boolean      // Require follow-through stays outside range
}

const DEFAULT_CONFIG: ConsolidationBreakoutConfig = {
  consolidationWindow: 15,
  maxRangePct: 0.02,               // 2%
  maxAtrPct: 0.025,                // 2.5%
  atrPeriod: 14,
  minTouches: 2,                   // At least 2 touches
  maxDriftPct: 0.008,              // 0.8% max drift
  minBufferPct: 0.0005,            // 0.05%
  bufferAtrMult: 0.2,
  minVolSpike: 1.3,
  breakoutLookahead: 3,            // Check up to 3 bars ahead
  requireFollowThrough: true,
  minFollowThroughPct: 0.001,      // 0.1%
  requireStayOutside: true,
}

/**
 * Calculate ATR (Wilder's method) - FIXED
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
 * Detect consolidation at given index - IMPROVED
 */
function detectConsolidation(
  candles: Candle[],
  endIndex: number,
  atr: (number | null)[],
  config: ConsolidationBreakoutConfig
): { isConsolidation: boolean; high: number; low: number; avgVolume: number; rangePct: number; atrPct: number } | null {
  const { consolidationWindow, maxRangePct, maxAtrPct, minTouches, maxDriftPct } = config

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

  if (rangePct > maxRangePct) {
    return null // Range too wide
  }

  // B) ATR check
  const currentATR = atr[endIndex]
  if (currentATR == null) {
    return null // ATR not available yet
  }

  const atrPct = currentATR / avgClose
  if (atrPct > maxAtrPct) {
    return null // ATR too high
  }

  // C) Touches check - price should test boundaries multiple times
  const touchEps = currentATR * 0.1 // 10% of ATR
  const touches = countTouches(window, high, low, touchEps)
  if (touches.highTouches < minTouches || touches.lowTouches < minTouches) {
    return null // Not enough touches - not a real consolidation
  }

  // D) Drift check - ensure no strong trend
  const firstClose = window[0].close
  const lastClose = window[window.length - 1].close
  const drift = Math.abs(lastClose - firstClose) / avgClose
  if (drift > maxDriftPct) {
    return null // Too much drift - not consolidation
  }

  // Calculate average volume (handle missing volume)
  const volumes = window.map(c => c.volume).filter(v => v != null && !isNaN(v))
  const avgVolume = volumes.length > 0
    ? volumes.reduce((sum, v) => sum + v, 0) / volumes.length
    : 0

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
 * Detect breakout from consolidation - IMPROVED
 */
export function detectConsolidationBreakout(
  candles: Candle[],
  startIndex: number,
  config: Partial<ConsolidationBreakoutConfig> = {}
): Pattern | null {
  const cfg: ConsolidationBreakoutConfig = { ...DEFAULT_CONFIG, ...config }

  // Need enough candles
  if (startIndex < cfg.consolidationWindow + cfg.atrPeriod + 5) {
    return null
  }
  if (startIndex + cfg.breakoutLookahead + 1 >= candles.length) {
    return null // Need room for breakout + confirmation
  }

  // Calculate ATR
  const atr = calculateATR(candles, cfg.atrPeriod)

  // Check for consolidation ending at startIndex
  const consol = detectConsolidation(candles, startIndex, atr, cfg)
  if (!consol || !consol.isConsolidation) {
    return null
  }

  // Look for breakout in lookahead window (1-3 bars ahead)
  for (let offset = 1; offset <= cfg.breakoutLookahead; offset++) {
    const breakoutIdx = startIndex + offset
    if (breakoutIdx >= candles.length) break

    const breakoutCandle = candles[breakoutIdx]
    const currentATR = atr[breakoutIdx]
    if (currentATR == null) continue

    // Calculate buffer
    const buffer = Math.max(
      breakoutCandle.close * cfg.minBufferPct,
      currentATR * cfg.bufferAtrMult
    )

    // Detect breakout direction
    let direction: 'UP' | 'DOWN' | null = null

    if (breakoutCandle.close > consol.high + buffer) {
      direction = 'UP'
    } else if (breakoutCandle.close < consol.low - buffer) {
      direction = 'DOWN'
    }

    if (!direction) continue // No breakout yet

    // Volume spike check (if volume available)
    if (consol.avgVolume > 0) {
      if (breakoutCandle.volume < consol.avgVolume * cfg.minVolSpike) {
        continue // Insufficient volume
      }
    }

    // Follow-through check
    if (cfg.requireFollowThrough) {
      const followIdx = breakoutIdx + 1
      if (followIdx >= candles.length) continue

      const followCandle = candles[followIdx]
      const followPct = (followCandle.close - breakoutCandle.close) / breakoutCandle.close

      // Check percentage continuation
      if (direction === 'UP' && followPct < cfg.minFollowThroughPct) {
        continue // No follow-through
      }
      if (direction === 'DOWN' && followPct > -cfg.minFollowThroughPct) {
        continue // No follow-through
      }

      // Check that follow-through stays outside range
      if (cfg.requireStayOutside) {
        if (direction === 'UP' && followCandle.close < consol.high + buffer) {
          continue // Fell back inside
        }
        if (direction === 'DOWN' && followCandle.close > consol.low - buffer) {
          continue // Rose back inside
        }
      }
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

    // Quality scoring - FIXED (normalized)
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

  return null // No valid breakout found in lookahead window
}

/**
 * Scan candles for multiple consolidation breakout patterns
 */
export function detectConsolidationBreakouts(
  candles: Candle[],
  maxPatterns: number,
  config: Partial<ConsolidationBreakoutConfig> = {}
): Pattern[] {
  const patterns: Pattern[] = []
  const cfg: ConsolidationBreakoutConfig = { ...DEFAULT_CONFIG, ...config }
  const minGap = cfg.consolidationWindow + 10

  console.log(`🔍 Scanning for consolidation breakout patterns...`)
  console.log(`   Window: ${cfg.consolidationWindow}, MaxRange: ${(cfg.maxRangePct * 100).toFixed(2)}%, MaxATR: ${(cfg.maxAtrPct * 100).toFixed(2)}%`)
  console.log(`   MinTouches: ${cfg.minTouches}, MaxDrift: ${(cfg.maxDriftPct * 100).toFixed(2)}%`)

  for (let i = cfg.consolidationWindow + cfg.atrPeriod + 10; i < candles.length - cfg.breakoutLookahead - 1 && patterns.length < maxPatterns; i++) {
    // Check overlap with existing patterns
    const hasOverlap = patterns.some(p => {
      const rangeStart = Math.min(p.startIndex, p.endIndex) - minGap
      const rangeEnd = Math.max(p.startIndex, p.endIndex) + minGap
      return i >= rangeStart && i <= rangeEnd
    })

    if (hasOverlap) continue

    const pattern = detectConsolidationBreakout(candles, i, config)
    if (pattern) {
      patterns.push(pattern)
      console.log(`   ✅ Breakout pattern at consol_end=${i}, breakout=${pattern.metadata.breakoutIndex} (quality: ${pattern.metadata.quality}%)`)
      i += minGap // Skip ahead
    }
  }

  console.log(`   📊 Total consolidation breakout patterns found: ${patterns.length}`)
  return patterns
}

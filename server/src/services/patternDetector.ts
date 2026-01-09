/**
 * מנוע זיהוי דפוסים טכניים בדאטה ריאלית - גרסה משופרת
 *
 * זיהוי אוטומטי מדויק של:
 * 1. Breakout - שבירת התנגדות עם נפח גבוה
 * 2. Retest - בדיקה חוזרת של רמת support/resistance שנשברה
 * 3. Bull Flag - דגל עולה לאחר תנועה חזקה עם קונסולידציה
 *
 * עקרונות זיהוי משופרים:
 * - זיהוי רמות מפתח (support/resistance) באמצעות pivot points
 * - בדיקת נפח יחסי לאימות שבירות
 * - אימות מבני של התבנית (לא רק תנועות מחיר)
 *
 * NEW: תמיכה ב-Strict Retest Detector המקצועי
 */

import type { Candle, Pattern } from '../types/index.js'
import { detectRetestPatterns } from './strictRetestDetector.js'
import { detectConsolidationBreakouts } from './consolidationBreakoutDetector.js'

/**
 * מציאת pivot high - נקודה שהיא הגבוהה ביותר בטווח
 */
// @ts-ignore - Reserved for future pattern detection enhancements
function isPivotHigh(candles: Candle[], index: number, leftBars: number = 2, rightBars: number = 2): boolean {
  if (index < leftBars || index + rightBars >= candles.length) return false

  const currentHigh = candles[index].high

  // בדיקה שכל הנרות משמאל נמוכים יותר
  for (let i = index - leftBars; i < index; i++) {
    if (candles[i].high >= currentHigh) return false
  }

  // בדיקה שכל הנרות מימין נמוכים יותר
  for (let i = index + 1; i <= index + rightBars; i++) {
    if (candles[i].high >= currentHigh) return false
  }

  return true
}

/**
 * מציאת pivot low - נקודה שהיא הנמוכה ביותר בטווח
 */
// @ts-ignore - Reserved for future pattern detection enhancements
function isPivotLow(candles: Candle[], index: number, leftBars: number = 2, rightBars: number = 2): boolean {
  if (index < leftBars || index + rightBars >= candles.length) return false

  const currentLow = candles[index].low

  // בדיקה שכל הנרות משמאל גבוהים יותר
  for (let i = index - leftBars; i < index; i++) {
    if (candles[i].low <= currentLow) return false
  }

  // בדיקה שכל הנרות מימין גבוהים יותר
  for (let i = index + 1; i <= index + rightBars; i++) {
    if (candles[i].low <= currentLow) return false
  }

  return true
}

/**
 * חישוב Average True Range (ATR) למדידת volatility
 */
// @ts-ignore - Reserved for future pattern detection enhancements
function calculateATR(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) return 0

  const trueRanges: number[] = []

  for (let i = 1; i < candles.length && i <= period; i++) {
    const high = candles[i].high
    const low = candles[i].low
    const prevClose = candles[i - 1].close

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    )
    trueRanges.push(tr)
  }

  return trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length
}

/**
 * חישוב נפח ממוצע
 */
// @ts-ignore - Reserved for future pattern detection enhancements
function calculateAverageVolume(candles: Candle[], period: number = 20): number {
  if (candles.length < period) return 0

  const volumes = candles.slice(0, period).map(c => c.volume || 0)
  return volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length
}

/**
 * בדיקה האם המחיר נמצא ליד רמה מסוימת (tolerance ב-%)
 */
// @ts-ignore - Reserved for future pattern detection enhancements
function isPriceNearLevel(price: number, level: number, tolerancePercent: number = 0.5): boolean {
  const diff = Math.abs(price - level)
  const tolerance = level * (tolerancePercent / 100)
  return diff <= tolerance
}

/**
 * זיהוי תבנית Breakout (פריצה מדשדוש)
 *
 * חיפוש:
 * 1. consolidation - טווח צר של 10-20 נרות (ATR קטן)
 * 2. breakout candle - נר שובר את הטווח בנפח גבוה
 * 3. continuation - המשך כיוון לאחר השבירה
 */
function detectBreakoutPattern(candles: Candle[], startIdx: number): Pattern | null {
  const windowSize = 20
  if (startIdx + windowSize >= candles.length) return null

  // שלב 1: זיהוי consolidation (10-20 נרות)
  const consolidationSize = 15
  if (startIdx + consolidationSize >= candles.length) return null

  const consolidationCandles = candles.slice(startIdx, startIdx + consolidationSize)
  const highs = consolidationCandles.map(c => c.high)
  const lows = consolidationCandles.map(c => c.low)
  const rangeHigh = Math.max(...highs)
  const rangeLow = Math.min(...lows)
  const rangePercent = ((rangeHigh - rangeLow) / rangeLow) * 100

  // בדיקה שהטווח צר (פחות מ-3%)
  if (rangePercent > 3) return null

  // שלב 2: זיהוי breakout candle
  const breakoutIdx = startIdx + consolidationSize
  if (breakoutIdx >= candles.length) return null

  const breakoutCandle = candles[breakoutIdx]
  const breakoutMove = ((breakoutCandle.close - rangeHigh) / rangeHigh) * 100

  // בדיקה שיש שבירה למעלה (לפחות 0.3%)
  if (breakoutMove < 0.3) return null

  // שלב 3: בדיקת continuation (5 נרות לפחות)
  const continuationSize = 5
  if (breakoutIdx + continuationSize >= candles.length) return null

  const continuationCandles = candles.slice(breakoutIdx + 1, breakoutIdx + 1 + continuationSize)
  const continuationUp = continuationCandles.filter(c => c.close > breakoutCandle.close).length

  // לפחות 3 מתוך 5 נרות צריכים להמשיך למעלה
  if (continuationUp < 3) return null

  // חישוב נקודות כניסה/יציאה
  const expectedEntry = breakoutCandle.close * 1.002 // 0.2% מעל הסגירה
  const expectedExit = breakoutCandle.close * 1.02 // יעד 2%
  const stopLoss = rangeLow * 0.995 // מתחת לטווח

  return {
    type: 'breakout',
    startIndex: startIdx,
    endIndex: breakoutIdx + continuationSize,
    expectedEntry,
    expectedExit,
    stopLoss,
    metadata: {
      quality: Math.min(95, 70 + rangePercent * 5), // איכות לפי גודל הטווח
      description: `שבירת טווח של ${rangePercent.toFixed(1)}% עם המשך`,
      hint: 'שים לב לשבירת הטווח עם נפח גבוה',
    },
  }
}

/**
 * זיהוי תבנית Retest - גרסה משופרת
 *
 * חיפוש:
 * 1. מגמה - Lower Highs & Lower Lows (LONG) או Higher Highs & Higher Lows (SHORT)
 * 2. נר שבירה גדול - שובר את השיא/שפל האחרון עם volume גבוה
 * 3. המשך - מינימום 5 נרות
 * 4. Retest - חזרה לבדיקת הרמה שנשברה
 * 5. Bounce - המשך כיוון לאחר אישור
 */
function detectRetestPattern(candles: Candle[], startIdx: number): Pattern | null {
  const windowSize = 35
  if (startIdx + windowSize >= candles.length) return null

  // שלב 1: זיהוי מגמה עם swing structure (6-10 נרות)
  const trendSize = 8
  if (startIdx + trendSize >= candles.length) return null

  const trendCandles = candles.slice(startIdx, startIdx + trendSize)

  // בדיקה למגמת ירידה (LONG setup): Lower Highs & Lower Lows
  let isDowntrend = true
  for (let i = 3; i < trendSize - 1; i++) {
    const prevHigh = Math.max(trendCandles[i - 3].high, trendCandles[i - 2].high, trendCandles[i - 1].high)
    const currentHigh = trendCandles[i].high
    if (currentHigh > prevHigh * 1.005) { // אם השיא עלה ביותר מ-0.5%
      isDowntrend = false
      break
    }
  }

  if (!isDowntrend) return null // רק LONG setups לעכשיו

  const trendHigh = Math.max(...trendCandles.map(c => c.high))
  const trendEndPrice = trendCandles[trendCandles.length - 1].close

  // שלב 2: זיהוי נר שבירה גדול
  const breakoutIdx = startIdx + trendSize
  if (breakoutIdx >= candles.length) return null

  const breakoutCandle = candles[breakoutIdx]
  const breakoutMove = ((breakoutCandle.close - trendEndPrice) / trendEndPrice) * 100

  // בדיקה שיש שבירה חזקה (1.5-3%)
  if (breakoutMove < 1.5 || breakoutMove > 3.5) return null

  // בדיקה שהשבירה מעל השיא של המגמה
  if (breakoutCandle.high < trendHigh * 1.01) return null

  // שלב 3: זיהוי המשך (5-8 נרות)
  const continuationSize = 6
  if (breakoutIdx + continuationSize >= candles.length) return null

  const continuationCandles = candles.slice(breakoutIdx + 1, breakoutIdx + 1 + continuationSize)
  const continuationUp = continuationCandles.filter(c => c.close > breakoutCandle.close * 0.995).length

  // לפחות 4 מתוך 6 נרות צריכים להמשיך למעלה
  if (continuationUp < 4) return null

  // שלב 4: זיהוי Retest (3-6 נרות)
  const retestSize = 5
  const retestStartIdx = breakoutIdx + 1 + continuationSize
  if (retestStartIdx + retestSize >= candles.length) return null

  const retestCandles = candles.slice(retestStartIdx, retestStartIdx + retestSize)
  const retestLow = Math.min(...retestCandles.map(c => c.low))

  // בדיקה שהריטסט מגיע לקרבת הרמה שנשברה (±2%)
  const brokenLevel = trendHigh
  if (Math.abs(retestLow - brokenLevel) / brokenLevel > 0.03) return null

  // שלב 5: זיהוי Bounce (4-6 נרות)
  const bounceSize = 5
  const bounceStartIdx = retestStartIdx + retestSize
  if (bounceStartIdx + bounceSize >= candles.length) return null

  const bounceCandles = candles.slice(bounceStartIdx, bounceStartIdx + bounceSize)
  const bounceUp = bounceCandles.filter(c => c.close > retestLow * 1.005).length

  // לפחות 4 מתוך 5 נרות צריכים לעלות
  if (bounceUp < 4) return null

  // חישוב נקודות כניסה/יציאה
  const expectedEntry = retestLow * 1.003
  const expectedExit = retestLow * 1.04
  const stopLoss = retestLow * 0.985

  return {
    type: 'retest',
    startIndex: startIdx,
    endIndex: bounceStartIdx + bounceSize,
    expectedEntry,
    expectedExit,
    stopLoss,
    metadata: {
      quality: Math.min(95, 80 + Math.floor(Math.random() * 10)),
      description: 'Retest מוצלח - שבירת התנגדות וחזרה לבדיקה (LONG)',
      hint: 'שים לב: שבירת ההתנגדות עם נר גדול, המשך, ואז חזרה לבדיקת הרמה מלמעלה',
    },
  }
}

/**
 * זיהוי תבנית Bull Flag
 *
 * חיפוש:
 * 1. pole - עלייה חזקה של 4-12%
 * 2. flag - ירידה קלה או קונסולידציה (10-15 נרות)
 * 3. breakout - המשך למעלה
 */
function detectBullFlagPattern(candles: Candle[], startIdx: number): Pattern | null {
  const windowSize = 30
  if (startIdx + windowSize >= candles.length) return null

  // שלב 1: זיהוי pole (עלייה חזקה)
  const poleSize = 8
  if (startIdx + poleSize >= candles.length) return null

  const poleCandles = candles.slice(startIdx, startIdx + poleSize)
  const poleStart = poleCandles[0].close
  const poleTop = Math.max(...poleCandles.map(c => c.high))
  const poleMovePercent = ((poleTop - poleStart) / poleStart) * 100

  // בדיקה שיש עלייה של 3-15%
  if (poleMovePercent < 3 || poleMovePercent > 15) return null

  const poleTopIdx = startIdx + poleCandles.findIndex(c => c.high === poleTop)

  // שלב 2: זיהוי flag (קונסולידציה/ירידה קלה)
  const flagSize = 12
  if (poleTopIdx + flagSize >= candles.length) return null

  const flagCandles = candles.slice(poleTopIdx, poleTopIdx + flagSize)
  const flagHigh = Math.max(...flagCandles.map(c => c.high))
  const flagLow = Math.min(...flagCandles.map(c => c.low))
  const flagRangePercent = ((flagHigh - flagLow) / flagLow) * 100

  // בדיקה שה-flag הוא טווח צר (פחות מ-4%)
  if (flagRangePercent > 4) return null

  // בדיקה שה-flag נמוך מה-pole (ירידה או קונסולידציה)
  const flagEnd = flagCandles[flagCandles.length - 1].close
  if (flagEnd > poleTop) return null

  // שלב 3: זיהוי breakout
  const breakoutSize = 4
  if (poleTopIdx + flagSize + breakoutSize >= candles.length) return null

  const breakoutCandles = candles.slice(poleTopIdx + flagSize, poleTopIdx + flagSize + breakoutSize)
  const breakoutUp = breakoutCandles.filter(c => c.close > flagHigh).length

  // לפחות 3 מתוך 4 נרות צריכים לשבור את הדגל
  if (breakoutUp < 3) return null

  // חישוב נקודות כניסה/יציאה
  const expectedEntry = flagHigh * 1.002
  const expectedExit = poleTop * 1.03 // יעד מעל ה-pole
  const stopLoss = flagLow * 0.995

  return {
    type: 'flag',
    startIndex: startIdx,
    endIndex: poleTopIdx + flagSize + breakoutSize,
    expectedEntry,
    expectedExit,
    stopLoss,
    metadata: {
      quality: Math.min(95, 65 + poleMovePercent * 2), // איכות לפי גודל ה-pole
      description: `דגל עולה עם pole של ${poleMovePercent.toFixed(1)}%`,
      hint: 'דגל עולה לאחר תנועה חזקה',
    },
  }
}

/**
 * סריקת כל הנרות וזיהוי דפוסים
 *
 * @param candles - מערך נרות
 * @param targetCount - מספר תבניות מבוקש
 * @param useStrictRetest - השתמש ב-Strict Retest Detector המקצועי (default: true)
 * @param asset - שם הנכס (לזיהוי אוטומטי של STRICT vs RELAXED config)
 */
export function detectPatterns(
  candles: Candle[],
  targetCount: number = 8,
  useStrictRetest: boolean = true,
  _asset: string = 'UNKNOWN'  // Not used - simple detector works for all assets
): Pattern[] {
  console.log(`🔍 Starting pattern detection on ${candles.length} candles...`)
  console.log(`   Mode: ${useStrictRetest ? 'STRICT' : 'LEGACY'} Retest Detection`)

  const patterns: Pattern[] = []

  // אם Strict mode מופעל, השתמש ב-detector המקצועי לזיהוי Retest
  if (useStrictRetest) {
    console.log('📊 Using Strict Retest Detector (pivot-based, ATR buffers)...')

    // זיהוי Retest עם הדטקטור המקצועי
    const retestQuota = targetCount // 100% retest patterns (Breakout/Flag disabled)
    const retestPatterns = detectRetestPatterns(candles, retestQuota, {
      pivotLeft: 2,
      pivotRight: 2,
      useTrendFilter: false, // כיבוי trend filter לעכשיו
      atrPeriod: 14,
      breakoutAtrMult: 0.10,
      retestAtrMult: 0.35,    // הגדלה מ-0.20 ל-0.35 - סובלנות גבוהה יותר לנגיעה בפיבוט
      confirmAtrMult: 0.02,   // הקטנה מ-0.05 ל-0.02 - דרישת אישור רכה יותר
      invalidAtrMult: 0.30,   // הגדלה מ-0.25 ל-0.30 - סובלנות גבוהה יותר לפני ביטול
      minBarsAfterBreakout: 5,   // מינימום 5 נרות אחרי פריצה לפני retest
      maxBarsToWaitRetest: 80,   // הגדלה מ-60 ל-80 - אפשר retest איטי יותר
      retestTypeMode: 'BOTH', // WICK or CLOSE
    })

    patterns.push(...retestPatterns)
    console.log(`   ✅ Found ${retestPatterns.length} strict retest patterns`)

    // 🚫 DISABLED: Breakout and Bull Flag detectors (keeping code for future use)
    // To re-enable: change ENABLE_BREAKOUT_DETECTION to true
    const ENABLE_BREAKOUT_DETECTION = false
    if (ENABLE_BREAKOUT_DETECTION) {  // DISABLED - focusing only on Retest patterns
      const remainingQuota = targetCount - patterns.length
      if (remainingQuota > 0) {
        console.log(`   🔍 Scanning for ${remainingQuota} additional patterns (Breakout/Flag)...`)

        const minGap = 30
        const breakoutQuota = Math.ceil(remainingQuota * 0.6)
        const flagQuota = remainingQuota - breakoutQuota

        // Breakout patterns - using professional consolidation breakout detector (FIXED VERSION)
        const breakoutPatterns = detectConsolidationBreakouts(candles, breakoutQuota, {
          consolidationWindow: 15,
          maxRangePct: 0.02,          // 2% max range
          maxAtrPct: 0.025,           // 2.5% max ATR
          atrPeriod: 14,
          minTouches: 2,              // At least 2 touches of high/low
          maxDriftPct: 0.008,         // 0.8% max drift
          minBufferPct: 0.0005,       // 0.05% buffer
          bufferAtrMult: 0.2,
          minVolSpike: 1.3,           // Volume must be 1.3x average
          requireFollowThrough: true,
          minFollowThroughPct: 0.001, // 0.1% follow-through
          requireStayOutside: true,   // Must stay outside consolidation range
        })

        // Filter out overlapping patterns
        const breakoutFound = breakoutPatterns.filter(bp => {
          const hasOverlap = patterns.some(p => {
            const rangeStart = Math.min(p.startIndex, p.endIndex) - minGap
            const rangeEnd = Math.max(p.startIndex, p.endIndex) + minGap
            const bpRange = Math.min(bp.startIndex, bp.endIndex)
            return bpRange >= rangeStart && bpRange <= rangeEnd
          })
          return !hasOverlap
        })

        patterns.push(...breakoutFound)

        // Bull Flag patterns
        let flagFound = 0
        for (let i = 50; i < candles.length - 50 && flagFound < flagQuota; i++) {
          // בדיקת חפיפה משופרת - בדוק אם i נמצא בטווח של תבנית קיימת
          const hasOverlap = patterns.some(p => {
            const rangeStart = Math.min(p.startIndex, p.endIndex) - minGap
            const rangeEnd = Math.max(p.startIndex, p.endIndex) + minGap
            return i >= rangeStart && i <= rangeEnd
          })
          if (hasOverlap) continue

          const pattern = detectBullFlagPattern(candles, i)
          if (!pattern) continue

          // Pattern is guaranteed non-null here after continue check
          if (pattern!.metadata.quality >= 65) {
            patterns.push(pattern!)
            flagFound++
            i += minGap
          }
        }

        console.log(`   ✅ Found ${breakoutFound.length} breakout, ${flagFound} flag patterns`)
      }
    }
  } else {
    // LEGACY mode - השתמש בדטקטורים הישנים המקוריים
    console.log('📊 Using Legacy Pattern Detection...')

    const minGap = 30
    const detectors = [
      { name: 'Breakout', fn: detectBreakoutPattern, quota: Math.ceil(targetCount * 0.4) },
      { name: 'Retest', fn: detectRetestPattern, quota: Math.ceil(targetCount * 0.35) },
      { name: 'Bull Flag', fn: detectBullFlagPattern, quota: Math.ceil(targetCount * 0.25) },
    ]

    for (const detector of detectors) {
      console.log(`  Scanning for ${detector.name} patterns (quota: ${detector.quota})...`)
      let found = 0

      for (let i = 50; i < candles.length - 50 && found < detector.quota; i++) {
        const hasOverlap = patterns.some(p => Math.abs(p.startIndex - i) < minGap)
        if (hasOverlap) continue

        const pattern = detector.fn(candles, i)
        if (pattern && pattern.metadata.quality >= 70) {
          patterns.push(pattern)
          found++
          console.log(`    ✓ Found ${detector.name} at index ${i} (quality: ${pattern.metadata.quality})`)
          i += minGap
        }
      }

      console.log(`    Found ${found} ${detector.name} patterns`)
    }
  }

  // מיון לפי startIndex
  patterns.sort((a, b) => a.startIndex - b.startIndex)

  console.log(`✅ Pattern detection complete: ${patterns.length} patterns found`)
  return patterns
}

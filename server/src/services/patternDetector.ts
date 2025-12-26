/**
 * מנוע זיהוי דפוסים טכניים בדאטה ריאלית
 *
 * זיהוי אוטומטי של:
 * 1. Breakout - שבירת טווח קונסולידציה
 * 2. Retest - בדיקה חוזרת של רמת תמיכה
 * 3. Bull Flag - דגל עולה לאחר תנועה חזקה
 */

import type { Candle, Pattern } from '../types/index.js'

/**
 * זיהוי תבנית Breakout
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
 * זיהוי תבנית Retest
 *
 * חיפוש:
 * 1. עלייה חזקה - תנועה למעלה של 3-8%
 * 2. pullback - ירידה חזרה לרמת תמיכה (38-62% פיבונאצ'י)
 * 3. bounce - המשך למעלה לאחר הבדיקה
 */
function detectRetestPattern(candles: Candle[], startIdx: number): Pattern | null {
  const windowSize = 25
  if (startIdx + windowSize >= candles.length) return null

  // שלב 1: זיהוי עלייה חזקה (5-10 נרות)
  const upMoveSize = 8
  if (startIdx + upMoveSize >= candles.length) return null

  const upMoveCandles = candles.slice(startIdx, startIdx + upMoveSize)
  const startPrice = upMoveCandles[0].close
  const topPrice = Math.max(...upMoveCandles.map(c => c.high))
  const upMovePercent = ((topPrice - startPrice) / startPrice) * 100

  // בדיקה שיש עלייה של 2-10%
  if (upMovePercent < 2 || upMovePercent > 10) return null

  const topIdx = startIdx + upMoveCandles.findIndex(c => c.high === topPrice)

  // שלב 2: זיהוי pullback (5-10 נרות)
  const pullbackSize = 8
  if (topIdx + pullbackSize >= candles.length) return null

  const pullbackCandles = candles.slice(topIdx, topIdx + pullbackSize)
  const pullbackLow = Math.min(...pullbackCandles.map(c => c.low))
  const retracePercent = ((topPrice - pullbackLow) / (topPrice - startPrice)) * 100

  // בדיקה שיש retracement של 30-70% (פיבונאצ'י)
  if (retracePercent < 30 || retracePercent > 70) return null

  const pullbackIdx = topIdx + pullbackCandles.findIndex(c => c.low === pullbackLow)

  // שלב 3: זיהוי bounce (5 נרות לפחות)
  const bounceSize = 5
  if (pullbackIdx + bounceSize >= candles.length) return null

  const bounceCandles = candles.slice(pullbackIdx + 1, pullbackIdx + 1 + bounceSize)
  const bounceUp = bounceCandles.filter(c => c.close > pullbackLow * 1.01).length

  // לפחות 4 מתוך 5 נרות צריכים לעלות
  if (bounceUp < 4) return null

  // חישוב נקודות כניסה/יציאה
  const expectedEntry = pullbackLow * 1.005 // 0.5% מעל הנמוך
  const expectedExit = pullbackLow * 1.03 // יעד 3%
  const stopLoss = pullbackLow * 0.995

  return {
    type: 'retest',
    startIndex: startIdx,
    endIndex: pullbackIdx + bounceSize,
    expectedEntry,
    expectedExit,
    stopLoss,
    metadata: {
      quality: Math.min(95, 75 + (retracePercent - 30) / 2), // איכות לפי פיבונאצ'י
      description: `Retest של ${retracePercent.toFixed(0)}% מהתנועה`,
      hint: 'חפש אישור על רמת התמיכה',
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
 */
export function detectPatterns(candles: Candle[], targetCount: number = 8): Pattern[] {
  console.log(`🔍 Starting pattern detection on ${candles.length} candles...`)

  const patterns: Pattern[] = []
  const minGap = 30 // מרווח מינימלי בין דפוסים

  // סריקה לפי סדר: breakout, retest, flag
  const detectors = [
    { name: 'Breakout', fn: detectBreakoutPattern, quota: Math.ceil(targetCount * 0.4) },
    { name: 'Retest', fn: detectRetestPattern, quota: Math.ceil(targetCount * 0.35) },
    { name: 'Bull Flag', fn: detectBullFlagPattern, quota: Math.ceil(targetCount * 0.25) },
  ]

  for (const detector of detectors) {
    console.log(`  Scanning for ${detector.name} patterns (quota: ${detector.quota})...`)
    let found = 0

    for (let i = 50; i < candles.length - 50 && found < detector.quota; i++) {
      // בדיקה שאין חפיפה עם דפוסים קיימים
      const hasOverlap = patterns.some(p =>
        Math.abs(p.startIndex - i) < minGap
      )

      if (hasOverlap) continue

      const pattern = detector.fn(candles, i)
      if (pattern && pattern.metadata.quality >= 70) {
        patterns.push(pattern)
        found++
        console.log(`    ✓ Found ${detector.name} at index ${i} (quality: ${pattern.metadata.quality})`)
        i += minGap // דילוג קדימה כדי למנוע חפיפה
      }
    }

    console.log(`    Found ${found} ${detector.name} patterns`)
  }

  // מיון לפי startIndex
  patterns.sort((a, b) => a.startIndex - b.startIndex)

  console.log(`✅ Pattern detection complete: ${patterns.length} patterns found`)
  return patterns
}

/**
 * מנוע ייצור נרות
 *
 * קובץ זה אחראי על יצירת נתוני מחירים (נרות) באופן ריאליסטי.
 */

import type { Candle } from '../types/index.js'
import {
  generateBreakoutPattern,
  generateRetestPattern,
  generateBullFlagPattern,
} from './patternGenerator.js'

/**
 * יצירת נרות בסיסיים עם תנועת מחיר אקראית
 */
export function generateCandles(
  count: number,
  startPrice: number = 50000,
  startTime: number = Math.floor(Date.now() / 1000) - (count * 3600)
): Candle[] {
  const candles: Candle[] = []
  let currentPrice = startPrice

  for (let i = 0; i < count; i++) {
    const candle = generateSingleCandle(
      currentPrice,
      startTime + (i * 3600) // +1 hour per candle
    )
    candles.push(candle)
    currentPrice = candle.close
  }

  return candles
}

/**
 * יצירת נר בודד עם התנהגות המון מציאותית
 *
 * עקרונות התנהגות המון:
 * 1. Mean Reversion - נטייה לחזור למחיר הממוצע
 * 2. Momentum - המשך מגמה קיימת
 * 3. Volatility Clustering - תנודתיות גבוהה נוטה להימשך
 * 4. Volume-Price Relationship - תנועות גדולות עם volume גבוה
 */

// משתנים גלובליים לשמירת מצב בין נרות
let previousMomentum = 0
let recentVolatility = 0.003 // אתחול תנודתיות
let volumeTrend = 1500

function generateSingleCandle(basePrice: number, time: number): Candle {
  // 1. חישוב Momentum (המשך כיוון)
  // אם היו כמה נרות עולים, יש סיכוי גבוה יותר לעלייה נוספת
  const momentumInfluence = previousMomentum * 0.4 // 40% השפעה מהכיוון הקודם

  // 2. Mean Reversion - נטייה חזרה למחיר הממוצע
  // אם המחיר רחק מדי, יש "משיכה" חזרה
  const deviation = (basePrice - 50000) / 50000 // סטייה מהמחיר הבסיסי
  const meanReversionForce = -deviation * 0.1 // כוח משיכה של 10%

  // 3. רעש אקראי (התנהגות לא צפויה של השוק)
  const randomNoise = (Math.random() - 0.5) * 0.008 // ±0.4%

  // 4. שינוי מחיר משולב
  let priceChange = momentumInfluence + meanReversionForce + randomNoise

  // 5. Volatility Clustering - תקופות של תנודתיות גבוהה
  // תנודתיות גבוהה נוטה להימשך
  const volatilityChange = (Math.random() - 0.5) * 0.0005
  recentVolatility = Math.max(0.001, Math.min(0.01, recentVolatility + volatilityChange))

  // 6. אירועים נדירים - "spike" - קורים ב-~3% מהנרות
  if (Math.random() < 0.03) {
    const spikeDirection = Math.random() > 0.5 ? 1 : -1
    priceChange += spikeDirection * (0.01 + Math.random() * 0.01) // spike של 1-2%
    recentVolatility *= 1.5 // תנודתיות עולה אחרי spike
  }

  // 7. הגבלת שינוי מקסימלי (למנוע קפיצות לא הגיוניות)
  priceChange = Math.max(-0.025, Math.min(0.025, priceChange)) // מקסימום ±2.5% בנר

  const open = basePrice
  const close = basePrice * (1 + priceChange)

  // 8. High/Low מציאותי - "wicks" (פתיחות)
  // נרות עם תנועה חזקה נוטים לקבל wicks גדולים יותר
  const wickSize = recentVolatility * (1 + Math.random())
  const upperWick = Math.max(open, close) * (1 + wickSize * Math.random())
  const lowerWick = Math.min(open, close) * (1 - wickSize * Math.random())

  // 9. לפעמים יש "rejection" - wick ארוך בכיוון אחד
  if (Math.random() < 0.15) { // 15% מהנרות
    if (Math.random() > 0.5) {
      // Upper rejection - המחיר ניסה לעלות ונדחה
      const rejectionSize = recentVolatility * (2 + Math.random() * 2)
      const high = Math.max(open, close) * (1 + rejectionSize)
      const low = lowerWick

      // Volume גבוה יותר בrejection
      const volume = volumeTrend * (1.3 + Math.random() * 0.7)

      // עדכון momentum
      previousMomentum = priceChange * 0.7 // חלש יותר אחרי rejection

      return { time, open, high, low, close, volume }
    } else {
      // Lower rejection - המחיר ניסה לרדת ונדחה
      const rejectionSize = recentVolatility * (2 + Math.random() * 2)
      const high = upperWick
      const low = Math.min(open, close) * (1 - rejectionSize)

      const volume = volumeTrend * (1.3 + Math.random() * 0.7)
      previousMomentum = priceChange * 0.7

      return { time, open, high, low: Math.max(low, close * 0.9), close, volume }
    }
  }

  // 10. Volume מציאותי
  // Volume גבוה יותר בתנועות חזקות
  const priceChangeAbs = Math.abs(priceChange)
  const volumeMultiplier = 1 + (priceChangeAbs * 20) // תנועה של 1% = +20% volume

  // Volume trend - volume נוטה להיות דומה לנרות הקודמים
  volumeTrend = volumeTrend * 0.95 + (1000 + Math.random() * 2000) * 0.05
  const volume = volumeTrend * volumeMultiplier * (0.8 + Math.random() * 0.4)

  // 11. עדכון momentum לנר הבא
  previousMomentum = priceChange

  return {
    time,
    open,
    high: upperWick,
    low: lowerWick,
    close,
    volume: Math.max(100, volume), // מינימום volume
  }
}

/**
 * יצירת נרות עם תבניות מוגדרות
 *
 * פונקציה זו משתמשת ב-patternGenerator כדי ליצור נרות
 * עם תבניות טכניות מוגדרות מראש.
 */
export function generateCandlesWithPatterns(
  totalCount: number = 500,
  patternCount: number = 8
): { candles: Candle[]; patterns: any[] } {
  // 1. יצירת נרות בסיסיים
  const candles = generateCandles(totalCount)
  const patterns: any[] = []

  // 2. חישוב מיקומים לתבניות - מפוזרים לאורך המשחק
  const patternTypes: Array<'breakout' | 'retest' | 'flag'> = ['breakout', 'retest', 'flag']
  const minGap = 20 // מרווח מינימלי בין תבניות (הגדלנו)
  const usedRanges: Array<{ start: number; end: number }> = []

  // 3. יצירת תבניות
  for (let i = 0; i < patternCount; i++) {
    const patternType = patternTypes[i % patternTypes.length]

    // מציאת מיקום פנוי
    let startIndex = -1
    let attempts = 0
    const maxAttempts = 100 // הגדלנו את מספר הניסיונות

    while (startIndex === -1 && attempts < maxAttempts) {
      // מיקום אקראי (אבל לא בהתחלה ולא בסוף)
      const startBuffer = Math.max(50, Math.floor(totalCount * 0.1)) // 10% מההתחלה
      const endBuffer = Math.max(50, Math.floor(totalCount * 0.1)) // 10% מהסוף
      const proposedStart = startBuffer + Math.floor(Math.random() * (totalCount - startBuffer - endBuffer))

      // בדיקה שאין חפיפה עם תבניות קיימות
      const proposedEnd = proposedStart + 25 // אורך מקסימלי משוער
      const hasOverlap = usedRanges.some(range =>
        (proposedStart >= range.start - minGap && proposedStart <= range.end + minGap) ||
        (proposedEnd >= range.start - minGap && proposedEnd <= range.end + minGap)
      )

      if (!hasOverlap && proposedEnd < totalCount - 10) {
        startIndex = proposedStart
      }

      attempts++
    }

    if (startIndex === -1) {
      console.warn(`Could not find space for pattern ${i + 1}`)
      continue
    }

    // יצירת התבנית
    try {
      let pattern

      switch (patternType) {
        case 'breakout':
          pattern = generateBreakoutPattern(candles, startIndex)
          break
        case 'retest':
          pattern = generateRetestPattern(candles, startIndex)
          break
        case 'flag':
          pattern = generateBullFlagPattern(candles, startIndex)
          break
      }

      patterns.push(pattern)
      usedRanges.push({ start: pattern.startIndex, end: pattern.endIndex })
    } catch (error) {
      console.error(`Failed to generate ${patternType} pattern:`, error)
    }
  }

  // מיון התבניות לפי startIndex
  patterns.sort((a, b) => a.startIndex - b.startIndex)

  return { candles, patterns }
}

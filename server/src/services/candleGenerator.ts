/**
 * מנוע ייצור נרות
 *
 * קובץ זה אחראי על יצירת נתוני מחירים (נרות) באופן ריאליסטי.
 * תומך גם בטעינת נתונים אמיתיים מקובץ CSV.
 */

import type { Candle } from '../types/index.js'
import {
  generateBreakoutPattern,
  generateRetestPattern,
  generateBullFlagPattern,
} from './patternGenerator.js'
import { loadDefaultHistory } from './historyLoader.js'

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
  const randomNoise = (Math.random() - 0.5) * 0.0003 // ±0.015% בלבד (הפחתה ענקית)

  // 4. שינוי מחיר משולב
  let priceChange = momentumInfluence + meanReversionForce + randomNoise

  // 5. Volatility Clustering - תקופות של תנודתיות גבוהה
  // תנודתיות גבוהה נוטה להימשך
  const volatilityChange = (Math.random() - 0.5) * 0.00005
  recentVolatility = Math.max(0.0001, Math.min(0.0005, recentVolatility + volatilityChange))

  // 6. אירועים נדירים - "spike/gap" - קורים ב-~0.5% מהנרות בלבד (הפחתה דרסטית)
  if (Math.random() < 0.003) { // 0.3% בלבד
    const spikeDirection = Math.random() > 0.5 ? 1 : -1
    priceChange += spikeDirection * (0.0003 + Math.random() * 0.0007) // spike של 0.03-0.1% בלבד
    recentVolatility *= 1.05 // תנודתיות עולה קצת
  }

  // 7. הגבלת שינוי מקסימלי (למנוע קפיצות לא הגיוניות)
  priceChange = Math.max(-0.002, Math.min(0.002, priceChange)) // מקסימום ±0.2% בנר בלבד

  const open = basePrice
  const close = basePrice * (1 + priceChange)

  // 8. High/Low מציאותי - "wicks" (פתילות)
  // פתילות זעירות - ממש מינימליות
  const wickSize = recentVolatility * (0.1 + Math.random() * 0.15) // פתילות קטנות מאוד
  const upperWick = Math.max(open, close) * (1 + wickSize * Math.random() * 0.2)
  const lowerWick = Math.min(open, close) * (1 - wickSize * Math.random() * 0.2)

  // 9. לפעמים יש "rejection" - wick ארוך בכיוון אחד (נדיר מאוד)
  if (Math.random() < 0.02) { // 2% מהנרות בלבד
    if (Math.random() > 0.5) {
      // Upper rejection - המחיר ניסה לעלות ונדחה
      const rejectionSize = recentVolatility * (0.3 + Math.random() * 0.3) // פתילה קטנה
      const high = Math.max(open, close) * (1 + rejectionSize)
      const low = lowerWick

      // Volume גבוה יותר בrejection
      const volume = volumeTrend * (1.1 + Math.random() * 0.3)

      // עדכון momentum
      previousMomentum = priceChange * 0.7 // חלש יותר אחרי rejection

      return { time, open, high, low, close, volume }
    } else {
      // Lower rejection - המחיר ניסה לרדת ונדחה
      const rejectionSize = recentVolatility * (0.3 + Math.random() * 0.3) // פתילה קטנה
      const high = upperWick
      const low = Math.min(open, close) * (1 - rejectionSize)

      const volume = volumeTrend * (1.1 + Math.random() * 0.3)
      previousMomentum = priceChange * 0.7

      return { time, open, high, low: Math.max(low, close * 0.99), close, volume }
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
 * פונקציה זו מנסה לטעון נתוני היסטוריה אמיתיים מקובץ.
 * אם לא נמצא קובץ, היא יוצרת נרות סינטטיים.
 */
export function generateCandlesWithPatterns(
  totalCount: number = 500,
  patternCount: number = 4 // הפחתה מ-8 ל-4 תבניות
): { candles: Candle[]; patterns: any[] } {
  // 1. ניסיון לטעון נתונים אמיתיים מקובץ
  let candles: Candle[] = []
  const realData = loadDefaultHistory()

  if (realData && realData.length >= totalCount) {
    console.log(`✅ Using real historical data (${realData.length} candles available)`)
    // קח רק את הכמות הנדרשת מהסוף (הנתונים האחרונים)
    candles = realData.slice(-totalCount)
  } else {
    if (realData) {
      console.log(`⚠️  Real data found but only ${realData.length} candles (need ${totalCount}), generating synthetic data`)
    } else {
      console.log(`ℹ️  No real data found, generating synthetic candles`)
    }
    // 1. יצירת נרות סינטטיים
    candles = generateCandles(totalCount)
  }

  const patterns: any[] = []

  // 2. חישוב מיקומים לתבניות - מפוזרים לאורך המשחק
  const patternTypes: Array<'breakout' | 'retest' | 'flag'> = ['breakout', 'retest', 'flag']
  const minGap = 60 // מרווח מינימלי בין תבניות (הגדלה משמעותית מ-20)
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

  // תיקון: אחרי כל תבנית, עדכן את הנרות הבאים כדי להמשיך מהמחיר הנכון
  for (const pattern of patterns) {
    const patternEndIndex = pattern.endIndex
    if (patternEndIndex < candles.length - 1) {
      // עדכן את כל הנרות שאחרי התבנית להתחיל מהמחיר הנכון
      for (let i = patternEndIndex + 1; i < candles.length; i++) {
        // בדיקה אם הנר הזה לא חלק מתבנית אחרת
        const isPartOfAnotherPattern = patterns.some(p =>
          i >= p.startIndex && i <= p.endIndex
        )

        if (isPartOfAnotherPattern) {
          break // עצור אם הגענו לתבנית הבאה
        }

        const prevClose = candles[i - 1].close
        const oldOpen = candles[i].open
        const oldClose = candles[i].close
        const priceChange = (oldClose - oldOpen) / oldOpen

        // עדכן את הנר להתחיל מהמחיר הקודם האמיתי
        candles[i].open = prevClose
        candles[i].close = prevClose * (1 + priceChange)
        candles[i].high = Math.max(candles[i].open, candles[i].close) * (1 + Math.random() * 0.0002)
        candles[i].low = Math.min(candles[i].open, candles[i].close) * (1 - Math.random() * 0.0002)
      }
    }
  }

  return { candles, patterns }
}

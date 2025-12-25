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
 * יצירת נר בודד
 */
function generateSingleCandle(basePrice: number, time: number): Candle {
  // תנועה אקראית של -0.5% עד +0.5% (ריאליסטי יותר)
  const change = (Math.random() - 0.5) * 0.01
  const open = basePrice
  const close = basePrice * (1 + change)

  // High/Low עם נדידה קטנה
  const high = Math.max(open, close) * (1 + Math.random() * 0.003)
  const low = Math.min(open, close) * (1 - Math.random() * 0.003)

  // Volume אקראי
  const volume = 1000 + Math.random() * 2000

  return {
    time,
    open,
    high,
    low,
    close,
    volume,
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

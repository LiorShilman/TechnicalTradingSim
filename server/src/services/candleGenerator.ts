/**
 * מנוע ייצור נרות
 * 
 * קובץ זה אחראי על יצירת נתוני מחירים (נרות) באופן ריאליסטי.
 */

import type { Candle } from '../types/index.js'

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
  // תנועה אקראית של -2% עד +2%
  const change = (Math.random() - 0.5) * 0.04
  const open = basePrice
  const close = basePrice * (1 + change)
  
  // High/Low עם נדידה
  const high = Math.max(open, close) * (1 + Math.random() * 0.01)
  const low = Math.min(open, close) * (1 - Math.random() * 0.01)
  
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
 * יצירת נרות עם תבנית מוגדרת
 * 
 * פונקציה זו משתמשת ב-patternGenerator כדי ליצור נרות
 * עם תבניות טכניות מוגדרות מראש.
 */
export function generateCandlesWithPatterns(
  totalCount: number,
  patternTypes: Array<'breakout' | 'retest' | 'flag'> = ['breakout', 'retest', 'flag']
): { candles: Candle[]; patterns: any[] } {
  // TODO: Implement pattern-aware candle generation
  // 1. יצירת נרות בסיסיים
  // 2. הוספת תבניות במיקומים מסוימים
  // 3. התאמת הנרות להתאים לתבניות
  
  const candles = generateCandles(totalCount)
  const patterns: any[] = []

  return { candles, patterns }
}

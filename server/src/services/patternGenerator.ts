/**
 * מנוע ייצור תבניות טכניות
 * 
 * קובץ זה אחראי על יצירת תבניות טכניות בתוך מערך נרות.
 * כל תבנית כוללת מטה-דאטה על נקודות כניסה/יציאה אידיאליות.
 */

import type { Pattern, Candle } from '../types/index.js'

/**
 * יצירת תבנית Breakout
 *
 * תהליך:
 * 1. יצירת consolidation (10-15 נרות בטווח צר)
 * 2. נר breakout (גדול עם volume)
 * 3. המשך כיוון (3-5 נרות)
 */
export function generateBreakoutPattern(
  candles: Candle[],
  startIndex: number
): Pattern {
  const consolidationLength = 12 + Math.floor(Math.random() * 4) // 12-15 נרות
  const continuationLength = 3 + Math.floor(Math.random() * 3) // 3-5 נרות
  const endIndex = startIndex + consolidationLength + 1 + continuationLength

  // בדיקה שיש מספיק נרות
  if (endIndex >= candles.length) {
    throw new Error('Not enough candles for pattern generation')
  }

  const basePrice = candles[startIndex].close
  const consolidationRange = basePrice * 0.02 // 2% טווח
  const resistanceLevel = basePrice + consolidationRange / 2

  // שלב 1: Consolidation - נרות בטווח צר
  for (let i = 0; i < consolidationLength; i++) {
    const idx = startIndex + i
    const prevClose = i === 0 ? basePrice : candles[idx - 1].close

    // תנועה קטנה בתוך הטווח
    const change = (Math.random() - 0.5) * 0.01 // -0.5% עד +0.5%
    const open = prevClose
    const close = prevClose * (1 + change)

    // שמירה בטווח ההתנגדות
    const adjustedClose = Math.min(close, resistanceLevel * 0.98)

    candles[idx] = {
      time: candles[idx].time,
      open,
      high: Math.max(open, adjustedClose) * (1 + Math.random() * 0.005),
      low: Math.min(open, adjustedClose) * (1 - Math.random() * 0.005),
      close: adjustedClose,
      volume: 1000 + Math.random() * 1000,
    }
  }

  // שלב 2: Breakout candle - נר שובר את ההתנגדות
  const breakoutIdx = startIndex + consolidationLength
  const breakoutOpen = candles[breakoutIdx - 1].close
  const breakoutMove = 0.015 + Math.random() * 0.01 // 1.5-2.5% תנועה למעלה (הפחתה)
  const breakoutClose = breakoutOpen * (1 + breakoutMove)

  candles[breakoutIdx] = {
    time: candles[breakoutIdx].time,
    open: breakoutOpen,
    high: breakoutClose * 1.005,
    low: breakoutOpen * 0.998,
    close: breakoutClose,
    volume: 2500 + Math.random() * 1500, // Volume גבוה
  }

  // שלב 3: Continuation - המשך למעלה
  for (let i = 1; i <= continuationLength; i++) {
    const idx = breakoutIdx + i
    const prevClose = candles[idx - 1].close
    const change = 0.005 + Math.random() * 0.008 // 0.5-1.3% למעלה (הפחתה)

    candles[idx] = {
      time: candles[idx].time,
      open: prevClose,
      high: prevClose * (1 + change) * 1.003,
      low: prevClose * 0.997,
      close: prevClose * (1 + change),
      volume: 1500 + Math.random() * 1000,
    }
  }

  // חישוב נקודות כניסה/יציאה
  const expectedEntry = breakoutClose * 1.002 // כניסה מעט אחרי הBreakout
  const expectedExit = breakoutClose * 1.05 // יציאה ב-5% רווח
  const stopLoss = resistanceLevel * 0.99 // Stop מתחת להתנגדות הישנה

  return {
    type: 'breakout',
    startIndex,
    endIndex,
    expectedEntry,
    expectedExit,
    stopLoss,
    metadata: {
      quality: 75 + Math.floor(Math.random() * 20), // 75-95
      description: 'שבירת התנגדות עם המשך עליה',
      hint: 'שים לב לשבירת רמת ההתנגדות עם נפח גבוה',
    },
  }
}

/**
 * יצירת תבנית Retest
 *
 * תהליך:
 * 1. שבירת רמה (breakout)
 * 2. חזרה לרמה (retest)
 * 3. ריבאונד והמשך
 */
export function generateRetestPattern(
  candles: Candle[],
  startIndex: number
): Pattern {
  const breakoutLength = 3 + Math.floor(Math.random() * 3) // 3-5 נרות breakout
  const pullbackLength = 4 + Math.floor(Math.random() * 3) // 4-6 נרות pullback
  const bounceLength = 4 + Math.floor(Math.random() * 3) // 4-6 נרות bounce
  const endIndex = startIndex + breakoutLength + pullbackLength + bounceLength

  if (endIndex >= candles.length) {
    throw new Error('Not enough candles for pattern generation')
  }

  const basePrice = candles[startIndex].close
  const resistanceLevel = basePrice * 1.03 // התנגדות 3% מעל

  // שלב 1: Breakout - שבירת ההתנגדות
  for (let i = 0; i < breakoutLength; i++) {
    const idx = startIndex + i
    const prevClose = i === 0 ? basePrice : candles[idx - 1].close
    const change = 0.008 + Math.random() * 0.008 // 0.8-1.6% למעלה (הפחתה)

    candles[idx] = {
      time: candles[idx].time,
      open: prevClose,
      high: prevClose * (1 + change) * 1.005,
      low: prevClose * 0.995,
      close: prevClose * (1 + change),
      volume: 2000 + Math.random() * 1500,
    }
  }

  const breakoutHigh = candles[startIndex + breakoutLength - 1].close

  // שלב 2: Pullback - חזרה לרמת ההתנגדות (שהפכה לתמיכה)
  for (let i = 0; i < pullbackLength; i++) {
    const idx = startIndex + breakoutLength + i
    const prevClose = candles[idx - 1].close
    const change = -0.005 - Math.random() * 0.01 // -0.5% עד -1.5% למטה

    const close = prevClose * (1 + change)
    // שמירה מעל רמת התמיכה (ההתנגדות הישנה)
    const adjustedClose = Math.max(close, resistanceLevel * 1.001)

    candles[idx] = {
      time: candles[idx].time,
      open: prevClose,
      high: prevClose * 1.003,
      low: Math.min(prevClose, adjustedClose) * 0.997,
      close: adjustedClose,
      volume: 1200 + Math.random() * 800,
    }
  }

  // נקודת ה-Retest
  const retestPrice = candles[startIndex + breakoutLength + pullbackLength - 1].close

  // שלב 3: Bounce - ריבאונד מהרמה והמשך למעלה
  for (let i = 0; i < bounceLength; i++) {
    const idx = startIndex + breakoutLength + pullbackLength + i
    const prevClose = candles[idx - 1].close
    const change = 0.01 + Math.random() * 0.008 // 1-1.8% למעלה (הפחתה)

    candles[idx] = {
      time: candles[idx].time,
      open: prevClose,
      high: prevClose * (1 + change) * 1.003,
      low: prevClose * 0.998,
      close: prevClose * (1 + change),
      volume: 1800 + Math.random() * 1200,
    }
  }

  const expectedEntry = retestPrice * 1.005 // כניסה אחרי אישור ה-bounce
  const expectedExit = retestPrice * 1.06 // יציאה ב-6% רווח
  const stopLoss = resistanceLevel * 0.98 // Stop מתחת לתמיכה

  return {
    type: 'retest',
    startIndex,
    endIndex,
    expectedEntry,
    expectedExit,
    stopLoss,
    metadata: {
      quality: 80 + Math.floor(Math.random() * 15), // 80-95
      description: 'Retest מוצלח של התנגדות שנשברה',
      hint: 'חפש אישור על רמת התמיכה החדשה (ההתנגדות הישנה)',
    },
  }
}

/**
 * יצירת תבנית Bull Flag
 *
 * תהליך:
 * 1. תנועה חזקה למעלה (pole)
 * 2. קונסולידציה קלה למטה (flag)
 * 3. המשך למעלה (breakout)
 */
export function generateBullFlagPattern(
  candles: Candle[],
  startIndex: number
): Pattern {
  const poleLength = 4 + Math.floor(Math.random() * 3) // 4-6 נרות pole
  const flagLength = 5 + Math.floor(Math.random() * 4) // 5-8 נרות flag
  const breakoutLength = 3 + Math.floor(Math.random() * 3) // 3-5 נרות breakout
  const endIndex = startIndex + poleLength + flagLength + breakoutLength

  if (endIndex >= candles.length) {
    throw new Error('Not enough candles for pattern generation')
  }

  const basePrice = candles[startIndex].close

  // שלב 1: Pole - תנועה חזקה למעלה
  for (let i = 0; i < poleLength; i++) {
    const idx = startIndex + i
    const prevClose = i === 0 ? basePrice : candles[idx - 1].close
    const change = 0.012 + Math.random() * 0.01 // 1.2-2.2% למעלה (הפחתה)

    candles[idx] = {
      time: candles[idx].time,
      open: prevClose,
      high: prevClose * (1 + change) * 1.005,
      low: prevClose * 0.998,
      close: prevClose * (1 + change),
      volume: 2200 + Math.random() * 1500,
    }
  }

  const poleTop = candles[startIndex + poleLength - 1].close
  const flagBottom = poleTop * 0.95 // Flag יורד עד 5% מהפסגה

  // שלב 2: Flag - קונסולידציה יורדת קלה
  for (let i = 0; i < flagLength; i++) {
    const idx = startIndex + poleLength + i
    const prevClose = candles[idx - 1].close

    // ירידה הדרגתית
    const progress = i / flagLength
    const targetPrice = poleTop - (poleTop - flagBottom) * progress
    const change = (targetPrice - prevClose) / prevClose
    const adjustedChange = Math.max(change, -0.015) // לא יותר מ-1.5% ירידה בנר

    candles[idx] = {
      time: candles[idx].time,
      open: prevClose,
      high: prevClose * 1.005,
      low: prevClose * (1 + adjustedChange) * 0.997,
      close: prevClose * (1 + adjustedChange),
      volume: 900 + Math.random() * 600, // Volume נמוך
    }
  }

  const flagEnd = candles[startIndex + poleLength + flagLength - 1].close

  // שלב 3: Breakout - שבירה מהדגל והמשך למעלה
  for (let i = 0; i < breakoutLength; i++) {
    const idx = startIndex + poleLength + flagLength + i
    const prevClose = candles[idx - 1].close
    const change = 0.012 + Math.random() * 0.01 // 1.2-2.2% למעלה (הפחתה)

    candles[idx] = {
      time: candles[idx].time,
      open: prevClose,
      high: prevClose * (1 + change) * 1.005,
      low: prevClose * 0.997,
      close: prevClose * (1 + change),
      volume: 2000 + Math.random() * 1300,
    }
  }

  const expectedEntry = poleTop * 1.002 // כניסה בשבירת פסגת ה-Pole
  const expectedExit = expectedEntry * 1.08 // יציאה ב-8% רווח (תנועה בגודל ה-Pole)
  const stopLoss = flagBottom * 0.98 // Stop מתחת לתחתית הדגל

  return {
    type: 'flag',
    startIndex,
    endIndex,
    expectedEntry,
    expectedExit,
    stopLoss,
    metadata: {
      quality: 70 + Math.floor(Math.random() * 20), // 70-90
      description: 'דגל עולה - המשך מגמה',
      hint: 'דגל עולה לאחר תנועה חזקה - חפש שבירה של פסגת הדגל',
    },
  }
}

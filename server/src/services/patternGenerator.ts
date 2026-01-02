/**
 * מנוע ייצור תבניות טכניות
 *
 * קובץ זה אחראי על יצירת תבניות טכניות בתוך מערך נרות.
 * כל תבנית כוללת מטה-דאטה על נקודות כניסה/יציאה אידיאליות.
 */

import type { Pattern, Candle } from '../types/index.js'

/**
 * יצירת תבנית Breakout עדינה ומציאותית
 *
 * תהליך:
 * 1. יצירת consolidation (15-20 נרות בטווח צר)
 * 2. נר breakout קטן (0.2-0.5% למעלה)
 * 3. המשך כיוון (5-8 נרות קטנים)
 */
export function generateBreakoutPattern(
  candles: Candle[],
  startIndex: number
): Pattern {
  const consolidationLength = 15 + Math.floor(Math.random() * 6) // 15-20 נרות
  const continuationLength = 5 + Math.floor(Math.random() * 4) // 5-8 נרות
  const endIndex = startIndex + consolidationLength + 1 + continuationLength

  if (endIndex >= candles.length) {
    throw new Error('Not enough candles for pattern generation')
  }

  const startPrice = candles[startIndex].close

  // שלב 1: Consolidation - תנועה קטנה בטווח צר של ±0.3%
  for (let i = 0; i < consolidationLength; i++) {
    const idx = startIndex + i
    const prevClose = i === 0 ? startPrice : candles[idx - 1].close

    // תנועה זעירה ±0.1%
    const change = (Math.random() - 0.5) * 0.002 // ±0.1%
    const close = prevClose * (1 + change)

    candles[idx] = {
      time: candles[idx].time,
      open: prevClose,
      high: Math.max(prevClose, close) * 1.001,
      low: Math.min(prevClose, close) * 0.999,
      close,
      volume: 1000 + Math.random() * 1000,
    }
  }

  // שלב 2: Breakout candle - עלייה קטנה של 0.2-0.5%
  const breakoutIdx = startIndex + consolidationLength
  const breakoutOpen = candles[breakoutIdx - 1].close
  const breakoutMove = 0.002 + Math.random() * 0.003 // 0.2-0.5%
  const breakoutClose = breakoutOpen * (1 + breakoutMove)

  candles[breakoutIdx] = {
    time: candles[breakoutIdx].time,
    open: breakoutOpen,
    high: breakoutClose * 1.001,
    low: breakoutOpen * 0.999,
    close: breakoutClose,
    volume: 2500 + Math.random() * 1500,
  }

  // שלב 3: Continuation - המשך עדין למעלה
  for (let i = 1; i <= continuationLength; i++) {
    const idx = breakoutIdx + i
    const prevClose = candles[idx - 1].close
    const change = 0.0005 + Math.random() * 0.001 // 0.05-0.15% בלבד

    candles[idx] = {
      time: candles[idx].time,
      open: prevClose,
      high: prevClose * (1 + change) * 1.0005,
      low: prevClose * 0.9995,
      close: prevClose * (1 + change),
      volume: 1500 + Math.random() * 1000,
    }
  }

  const breakoutClose_final = candles[breakoutIdx].close
  const expectedEntry = breakoutClose_final * 1.001
  const expectedExit = breakoutClose_final * 1.02 // יעד צנוע של 2%
  const stopLoss = startPrice * 0.995

  return {
    type: 'breakout',
    startIndex,
    endIndex,
    expectedEntry,
    expectedExit,
    stopLoss,
    metadata: {
      quality: 75 + Math.floor(Math.random() * 20),
      description: 'שבירת טווח קונסולידציה',
      hint: 'שים לב לשבירת הטווח עם נפח גבוה',
    },
  }
}

/**
 * יצירת תבנית Retest עדינה
 *
 * תהליך:
 * 1. עלייה הדרגתית (5-8 נרות)
 * 2. ירידה קלה (6-9 נרות)
 * 3. המשך למעלה (6-9 נרות)
 */
export function generateRetestPattern(
  candles: Candle[],
  startIndex: number
): Pattern {
  const upLength = 5 + Math.floor(Math.random() * 4) // 5-8 נרות
  const pullbackLength = 6 + Math.floor(Math.random() * 4) // 6-9 נרות
  const bounceLength = 6 + Math.floor(Math.random() * 4) // 6-9 נרות
  const endIndex = startIndex + upLength + pullbackLength + bounceLength

  if (endIndex >= candles.length) {
    throw new Error('Not enough candles for pattern generation')
  }

  const startPrice = candles[startIndex].close

  // שלב 1: עלייה הדרגתית - 0.1-0.2% בכל נר
  for (let i = 0; i < upLength; i++) {
    const idx = startIndex + i
    const prevClose = i === 0 ? startPrice : candles[idx - 1].close
    const change = 0.001 + Math.random() * 0.001 // 0.1-0.2%

    candles[idx] = {
      time: candles[idx].time,
      open: prevClose,
      high: prevClose * (1 + change) * 1.0005,
      low: prevClose * 0.9995,
      close: prevClose * (1 + change),
      volume: 2000 + Math.random() * 1500,
    }
  }

  // @ts-ignore - Reserved for flag validation logic
  const topPrice = candles[startIndex + upLength - 1].close

  // שלב 2: Pullback קל - ירידה של 0.05-0.1% בכל נר
  for (let i = 0; i < pullbackLength; i++) {
    const idx = startIndex + upLength + i
    const prevClose = candles[idx - 1].close
    const change = -0.0005 - Math.random() * 0.0005 // -0.05% עד -0.1%

    candles[idx] = {
      time: candles[idx].time,
      open: prevClose,
      high: prevClose * 1.001,
      low: prevClose * (1 + change) * 0.9995,
      close: prevClose * (1 + change),
      volume: 1200 + Math.random() * 800,
    }
  }

  const retestPrice = candles[startIndex + upLength + pullbackLength - 1].close

  // שלב 3: Bounce - המשך למעלה
  for (let i = 0; i < bounceLength; i++) {
    const idx = startIndex + upLength + pullbackLength + i
    const prevClose = candles[idx - 1].close
    const change = 0.0005 + Math.random() * 0.001 // 0.05-0.15%

    candles[idx] = {
      time: candles[idx].time,
      open: prevClose,
      high: prevClose * (1 + change) * 1.0005,
      low: prevClose * 0.9995,
      close: prevClose * (1 + change),
      volume: 1800 + Math.random() * 1200,
    }
  }

  const expectedEntry = retestPrice * 1.002
  const expectedExit = retestPrice * 1.03 // יעד צנוע של 3%
  const stopLoss = startPrice * 0.995

  return {
    type: 'retest',
    startIndex,
    endIndex,
    expectedEntry,
    expectedExit,
    stopLoss,
    metadata: {
      quality: 80 + Math.floor(Math.random() * 15),
      description: 'Retest מוצלח של רמת תמיכה',
      hint: 'חפש אישור על רמת התמיכה',
    },
  }
}

/**
 * יצירת תבנית Bull Flag עדינה
 *
 * תהליך:
 * 1. עלייה הדרגתית (pole: 6-9 נרות)
 * 2. ירידה קלה (flag: 8-12 נרות)
 * 3. המשך למעלה (breakout: 4-6 נרות)
 */
export function generateBullFlagPattern(
  candles: Candle[],
  startIndex: number
): Pattern {
  const poleLength = 6 + Math.floor(Math.random() * 4) // 6-9 נרות
  const flagLength = 8 + Math.floor(Math.random() * 5) // 8-12 נרות
  const breakoutLength = 4 + Math.floor(Math.random() * 3) // 4-6 נרות
  const endIndex = startIndex + poleLength + flagLength + breakoutLength

  if (endIndex >= candles.length) {
    throw new Error('Not enough candles for pattern generation')
  }

  const startPrice = candles[startIndex].close

  // שלב 1: Pole - עלייה הדרגתית
  for (let i = 0; i < poleLength; i++) {
    const idx = startIndex + i
    const prevClose = i === 0 ? startPrice : candles[idx - 1].close
    const change = 0.001 + Math.random() * 0.001 // 0.1-0.2%

    candles[idx] = {
      time: candles[idx].time,
      open: prevClose,
      high: prevClose * (1 + change) * 1.0005,
      low: prevClose * 0.9995,
      close: prevClose * (1 + change),
      volume: 2200 + Math.random() * 1500,
    }
  }

  const poleTop = candles[startIndex + poleLength - 1].close

  // שלב 2: Flag - ירידה עדינה מאוד
  for (let i = 0; i < flagLength; i++) {
    const idx = startIndex + poleLength + i
    const prevClose = candles[idx - 1].close
    const change = -0.0003 - Math.random() * 0.0003 // -0.03% עד -0.06%

    candles[idx] = {
      time: candles[idx].time,
      open: prevClose,
      high: prevClose * 1.001,
      low: prevClose * (1 + change) * 0.999,
      close: prevClose * (1 + change),
      volume: 900 + Math.random() * 600,
    }
  }

  const flagEnd = candles[startIndex + poleLength + flagLength - 1].close

  // שלב 3: Breakout - המשך למעלה
  for (let i = 0; i < breakoutLength; i++) {
    const idx = startIndex + poleLength + flagLength + i
    const prevClose = candles[idx - 1].close
    const change = 0.0008 + Math.random() * 0.001 // 0.08-0.18%

    candles[idx] = {
      time: candles[idx].time,
      open: prevClose,
      high: prevClose * (1 + change) * 1.0005,
      low: prevClose * 0.9995,
      close: prevClose * (1 + change),
      volume: 2000 + Math.random() * 1300,
    }
  }

  const expectedEntry = poleTop * 1.001
  const expectedExit = poleTop * 1.025 // יעד צנוע של 2.5%
  const stopLoss = flagEnd * 0.995

  return {
    type: 'flag',
    startIndex,
    endIndex,
    expectedEntry,
    expectedExit,
    stopLoss,
    metadata: {
      quality: 70 + Math.floor(Math.random() * 20),
      description: 'דגל עולה - המשך מגמה',
      hint: 'דגל עולה לאחר תנועה חזקה',
    },
  }
}

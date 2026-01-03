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
 * יצירת תבנית Retest מציאותית - LONG
 *
 * תהליך (LONG Retest):
 * 1. מגמת ירידה מובהקת (6-10 נרות, -0.3% עד -0.6% כל נר)
 * 2. נר שבירה גדול עם volume גבוה (1.5-2.5% למעלה, volume x2-3)
 * 3. המשך כיוון (5-8 נרות, 0.2-0.5% כל נר)
 * 4. Retest - חזרה לבדיקת השיא שנשבר (3-6 נרות ירידה קלה)
 * 5. Bounce - המשך למעלה לאחר אישור
 *
 * SHORT Retest: הפוך - uptrend, שבירת שפל למטה, חזרה מלמטה
 */
export function generateRetestPattern(
  candles: Candle[],
  startIndex: number
): Pattern {
  // קביעה אקראית: LONG (true) או SHORT (false)
  const isLong = Math.random() > 0.5

  const downtrendLength = 6 + Math.floor(Math.random() * 5) // 6-10 נרות
  const continuationLength = 5 + Math.floor(Math.random() * 4) // 5-8 נרות
  const retestLength = 3 + Math.floor(Math.random() * 4) // 3-6 נרות
  const bounceLength = 4 + Math.floor(Math.random() * 3) // 4-6 נרות

  const endIndex = startIndex + downtrendLength + 1 + continuationLength + retestLength + bounceLength

  if (endIndex >= candles.length) {
    throw new Error('Not enough candles for pattern generation')
  }

  const startPrice = candles[startIndex].close
  let avgVolume = 1500 // volume ממוצע

  // שלב 1: מגמה עם Lower Highs & Lower Lows (LONG) או Higher Highs & Higher Lows (SHORT)
  let swingHigh = startPrice
  let swingLow = startPrice
  const swingSize = 3 // גודל כל swing (3 נרות)

  for (let i = 0; i < downtrendLength; i++) {
    const idx = startIndex + i
    const prevClose = i === 0 ? startPrice : candles[idx - 1].close

    // קביעה אם אנחנו ב-swing עולה או יורד
    const currentSwingNum = Math.floor(i / swingSize)
    const isUpSwing = currentSwingNum % 2 === 0

    let change: number
    if (isLong) {
      // LONG: Lower Highs & Lower Lows (מגמת ירידה)
      if (isUpSwing) {
        // Swing למעלה - ליצור high שנמוך מה-swing הקודם
        change = 0.001 + Math.random() * 0.002 // 0.1-0.3% למעלה
      } else {
        // Swing למטה - ליצור low שנמוך מה-swing הקודם
        change = -0.004 - Math.random() * 0.003 // -0.4% עד -0.7% למטה
      }
    } else {
      // SHORT: Higher Highs & Higher Lows (מגמת עלייה)
      if (isUpSwing) {
        // Swing למעלה - ליצור high שגבוה מה-swing הקודם
        change = 0.004 + Math.random() * 0.003 // 0.4-0.7% למעלה
      } else {
        // Swing למטה - ליצור low שגבוה מה-swing הקודם
        change = -0.001 - Math.random() * 0.002 // -0.1% עד -0.3% למטה
      }
    }

    const close = prevClose * (1 + change)
    const high = Math.max(prevClose, close) * (1.001 + Math.random() * 0.001)
    const low = Math.min(prevClose, close) * (0.999 - Math.random() * 0.001)

    candles[idx] = {
      time: candles[idx].time,
      open: prevClose,
      high,
      low,
      close,
      volume: 1000 + Math.random() * 1000,
    }

    // עדכון swing highs/lows
    if (isUpSwing) {
      if (high > swingHigh) swingHigh = high
    } else {
      if (low < swingLow) swingLow = low
    }
  }

  const trendEndPrice = candles[startIndex + downtrendLength - 1].close

  // שלב 2: נר שבירה גדול עם volume גבוה
  const breakoutIdx = startIndex + downtrendLength
  const breakoutOpen = trendEndPrice
  // LONG: שבירה למעלה 1.5-2.5%, SHORT: שבירה למטה -1.5% עד -2.5%
  const breakoutMove = isLong
    ? 0.015 + Math.random() * 0.01  // 1.5-2.5% למעלה
    : -0.015 - Math.random() * 0.01 // -1.5% עד -2.5% למטה

  const breakoutClose = breakoutOpen * (1 + breakoutMove)
  const breakoutVolume = avgVolume * (2 + Math.random()) // פי 2-3 מהממוצע

  candles[breakoutIdx] = {
    time: candles[breakoutIdx].time,
    open: breakoutOpen,
    high: Math.max(breakoutOpen, breakoutClose) * 1.003,
    low: Math.min(breakoutOpen, breakoutClose) * 0.997,
    close: breakoutClose,
    volume: breakoutVolume,
  }

  // שמירת מחיר השבירה (זה יהיה רמת ה-Retest)
  const breakoutLevel = isLong
    ? Math.max(breakoutOpen, breakoutClose) // השיא שנשבר (LONG)
    : Math.min(breakoutOpen, breakoutClose) // השפל שנשבר (SHORT)

  // שלב 3: המשך כיוון (5-8 נרות)
  for (let i = 1; i <= continuationLength; i++) {
    const idx = breakoutIdx + i
    const prevClose = candles[idx - 1].close
    // LONG: המשך למעלה 0.2-0.5%, SHORT: המשך למטה -0.2% עד -0.5%
    const change = isLong
      ? 0.002 + Math.random() * 0.003  // 0.2-0.5%
      : -0.002 - Math.random() * 0.003 // -0.2% עד -0.5%

    candles[idx] = {
      time: candles[idx].time,
      open: prevClose,
      high: prevClose * (1 + Math.abs(change)) * 1.001,
      low: prevClose * (1 - Math.abs(change)) * 0.999,
      close: prevClose * (1 + change),
      volume: 1200 + Math.random() * 800,
    }
  }

  const continuationEndIdx = breakoutIdx + continuationLength

  // שלב 4: Retest - חזרה לבדיקת רמת השבירה
  for (let i = 1; i <= retestLength; i++) {
    const idx = continuationEndIdx + i
    const prevClose = candles[idx - 1].close

    // חישוב המרחק לרמת ה-Retest
    const distanceToLevel = breakoutLevel - prevClose
    const progressRatio = i / retestLength

    // LONG: ירידה הדרגתית חזרה לרמה, SHORT: עלייה הדרגתית חזרה לרמה
    const targetClose = prevClose + (distanceToLevel * progressRatio * 0.7) // 70% מהדרך

    candles[idx] = {
      time: candles[idx].time,
      open: prevClose,
      high: Math.max(prevClose, targetClose) * 1.001,
      low: Math.min(prevClose, targetClose) * 0.999,
      close: targetClose,
      volume: 900 + Math.random() * 600,
    }
  }

  const retestEndIdx = continuationEndIdx + retestLength
  const retestPrice = candles[retestEndIdx].close

  // שלב 5: Bounce - המשך המגמה החדשה לאחר אישור
  for (let i = 1; i <= bounceLength; i++) {
    const idx = retestEndIdx + i
    const prevClose = candles[idx - 1].close
    // LONG: bounce למעלה, SHORT: bounce למטה
    const change = isLong
      ? 0.003 + Math.random() * 0.004  // 0.3-0.7%
      : -0.003 - Math.random() * 0.004 // -0.3% עד -0.7%

    candles[idx] = {
      time: candles[idx].time,
      open: prevClose,
      high: prevClose * (1 + Math.abs(change)) * 1.001,
      low: prevClose * (1 - Math.abs(change)) * 0.999,
      close: prevClose * (1 + change),
      volume: 1500 + Math.random() * 1000,
    }
  }

  // קביעת נקודות כניסה/יציאה
  const expectedEntry = isLong
    ? retestPrice * 1.003  // כניסה מעל ה-Retest (LONG)
    : retestPrice * 0.997  // כניסה מתחת ל-Retest (SHORT)

  const expectedExit = isLong
    ? retestPrice * 1.04   // יעד 4% למעלה (LONG)
    : retestPrice * 0.96   // יעד 4% למטה (SHORT)

  const stopLoss = isLong
    ? retestPrice * 0.985  // SL 1.5% מתחת (LONG)
    : retestPrice * 1.015  // SL 1.5% מעל (SHORT)

  return {
    type: 'retest',
    startIndex,
    endIndex,
    expectedEntry,
    expectedExit,
    stopLoss,
    metadata: {
      quality: 80 + Math.floor(Math.random() * 15),
      description: isLong
        ? 'Retest מוצלח - שבירת התנגדות וחזרה לבדיקה (LONG)'
        : 'Retest מוצלח - שבירת תמיכה וחזרה לבדיקה (SHORT)',
      hint: isLong
        ? 'שים לב: שבירת ההתנגדות עם נר גדול ו-volume גבוה, ואז חזרה לבדיקת הרמה מלמעלה'
        : 'שים לב: שבירת התמיכה עם נר גדול ו-volume גבוה, ואז חזרה לבדיקת הרמה מלמטה',
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

/**
 * Simple Breakout Detector - Based on Fractals and Consolidations
 *
 * פשוט, אינטואיטיבי, עובד על כל נכס (קריפטו, מניות, אינדקסים)
 *
 * אלגוריתם:
 * 1. זיהוי פרקטלים (swing highs/lows) - נקודות מפנה בגרף
 * 2. זיהוי דשדושים - תקופות בהן המחיר זזבין שני פרקטלים
 * 3. זיהוי פריצה - כאשר המחיר פורץ החוצה מהדשדוש
 */

import type { Candle, Pattern } from '../types/index.js'

interface SwingPoint {
  index: number
  price: number
  type: 'high' | 'low'
}

interface Consolidation {
  startIndex: number
  endIndex: number
  high: number
  low: number
  swingHighs: number  // כמה פעמים נגע בתקרה
  swingLows: number   // כמה פעמים נגע לרצפה
}

/**
 * זיהוי פרקטל - swing high (פסגה) או swing low (שפל)
 *
 * פרקטל הוא נקודה שבה יש לפחות leftBars נרות משמאל ו-rightBars נרות מימין
 * שכולם נמוכים/גבוהים ממנה
 */
function findSwingPoints(
  candles: Candle[],
  leftBars: number = 3,
  rightBars: number = 3
): SwingPoint[] {
  const swings: SwingPoint[] = []

  for (let i = leftBars; i < candles.length - rightBars; i++) {
    const current = candles[i]

    // בדיקה: האם זה swing high?
    let isSwingHigh = true
    for (let j = i - leftBars; j < i + rightBars + 1; j++) {
      if (j === i) continue
      if (candles[j].high >= current.high) {
        isSwingHigh = false
        break
      }
    }

    if (isSwingHigh) {
      swings.push({
        index: i,
        price: current.high,
        type: 'high',
      })
      continue // לא יכול להיות גם high וגם low באותו נר
    }

    // בדיקה: האם זה swing low?
    let isSwingLow = true
    for (let j = i - leftBars; j < i + rightBars + 1; j++) {
      if (j === i) continue
      if (candles[j].low <= current.low) {
        isSwingLow = false
        break
      }
    }

    if (isSwingLow) {
      swings.push({
        index: i,
        price: current.low,
        type: 'low',
      })
    }
  }

  return swings
}

/**
 * זיהוי דשדושים (consolidations) - תקופות בהן המחיר תקוע בין שני פרקטלים
 *
 * קריטריונים:
 * - לפחות minBars נרות
 * - לפחות minTouches נגיעות בכל צד (high/low)
 * - טווח המחירים קטן יחסית (maxRangePct)
 */
function findConsolidations(
  candles: Candle[],
  swings: SwingPoint[],
  minBars: number = 8,
  minTouches: number = 2,
  maxRangePct: number = 0.08  // 8% טווח מקסימלי
): Consolidation[] {
  const consolidations: Consolidation[] = []

  // מעבר על כל זוג פרקטלים (high ו-low)
  for (let i = 0; i < swings.length - 1; i++) {
    const firstSwing = swings[i]
    const nextSwing = swings[i + 1]

    // רוצים זוג של high ו-low (לא משנה הסדר)
    if (firstSwing.type === nextSwing.type) continue

    const high = Math.max(firstSwing.price, nextSwing.price)
    const low = Math.min(firstSwing.price, nextSwing.price)
    const startIndex = Math.min(firstSwing.index, nextSwing.index)
    const endIndex = Math.max(firstSwing.index, nextSwing.index)

    // בדיקה: מספיק נרות?
    const barCount = endIndex - startIndex + 1
    if (barCount < minBars) continue

    // בדיקה: טווח המחירים קטן מספיק?
    const range = high - low
    const avgPrice = (high + low) / 2
    const rangePct = range / avgPrice

    if (rangePct > maxRangePct) continue

    // ספירת נגיעות בתקרה וברצפה
    let swingHighs = 0
    let swingLows = 0
    const touchMargin = range * 0.05 // 5% של הטווח

    for (let j = startIndex; j <= endIndex; j++) {
      const candle = candles[j]

      // נגיעה בתקרה?
      if (Math.abs(candle.high - high) <= touchMargin) {
        swingHighs++
      }

      // נגיעה ברצפה?
      if (Math.abs(candle.low - low) <= touchMargin) {
        swingLows++
      }
    }

    // בדיקה: מספיק נגיעות?
    if (swingHighs >= minTouches && swingLows >= minTouches) {
      consolidations.push({
        startIndex,
        endIndex,
        high,
        low,
        swingHighs,
        swingLows,
      })
    }
  }

  return consolidations
}

/**
 * זיהוי פריצה מדשדוש
 *
 * קריטריונים:
 * - נר פריצה חייב לסגור מעל/מתחת לדשדוש (לא רק פתיל)
 * - אופציונלי: נפח גבוה
 * - אופציונלי: המשכיות (נר הבא ממשיך בכיוון הפריצה)
 */
function detectBreakoutFromConsolidation(
  candles: Candle[],
  consol: Consolidation,
  requireVolumeSpike: boolean = false,
  requireFollowThrough: boolean = true
): Pattern | null {
  const range = consol.high - consol.low
  const buffer = range * 0.005 // 0.5% מהטווח

  // חיפוש פריצה ב-5 נרות הבאים אחרי הדשדוש
  const maxLookAhead = 5
  let breakoutIndex = -1
  let direction: 'UP' | 'DOWN' | null = null

  for (let i = 1; i <= maxLookAhead; i++) {
    const candidateIndex = consol.endIndex + i
    if (candidateIndex >= candles.length) break

    const candidateCandle = candles[candidateIndex]

    // בדיקה: פריצה למעלה?
    if (candidateCandle.close > consol.high + buffer) {
      breakoutIndex = candidateIndex
      direction = 'UP'
      console.log(`      ✅ Found UP breakout at index ${breakoutIndex} (${i} candles after consol)`)
      break
    }

    // בדיקה: פריצה למטה?
    if (candidateCandle.close < consol.low - buffer) {
      breakoutIndex = candidateIndex
      direction = 'DOWN'
      console.log(`      ✅ Found DOWN breakout at index ${breakoutIndex} (${i} candles after consol)`)
      break
    }
  }

  if (!direction || breakoutIndex === -1) {
    console.log(`      🚫 No breakout within ${maxLookAhead} candles`)
    return null
  }

  const breakoutCandle = candles[breakoutIndex]

  // צריך לפחות נר אחד אחרי הפריצה לבדיקת follow-through
  if (breakoutIndex + 1 >= candles.length) {
    console.log(`      ⏭️ Not enough candles after breakout`)
    return null
  }

  // בדיקת נפח (אופציונלי)
  if (requireVolumeSpike) {
    const consolCandles = candles.slice(consol.startIndex, consol.endIndex + 1)
    const avgVolume = consolCandles.reduce((sum, c) => sum + (c.volume || 0), 0) / consolCandles.length

    if (avgVolume > 0 && breakoutCandle.volume < avgVolume * 1.2) {
      return null // נפח חלש
    }
  }

  // בדיקת המשכיות (אופציונלי) - מתון יותר, מאפשר פולבקים קטנים
  if (requireFollowThrough) {
    const followIndex = breakoutIndex + 1
    if (followIndex >= candles.length) return null

    const followCandle = candles[followIndex]

    // מאפשרים חזרה חלקית לדשדוש (עד 50% מהטווח)
    const allowedRetracement = range * 0.5

    // בדיקה: נר המשך לא חזר עמוק לתוך הדשדוש
    if (direction === 'UP' && followCandle.close < consol.high - allowedRetracement) {
      console.log(`      ↩️ Follow-through failed for UP (followClose: ${followCandle.close.toFixed(2)} < threshold: ${(consol.high - allowedRetracement).toFixed(2)})`)
      return null // חזר עמוק לדשדוש
    }

    if (direction === 'DOWN' && followCandle.close > consol.low + allowedRetracement) {
      console.log(`      ↩️ Follow-through failed for DOWN (followClose: ${followCandle.close.toFixed(2)} > threshold: ${(consol.low + allowedRetracement).toFixed(2)})`)
      return null // חזר עמוק לדשדוש
    }
  }

  // חישוב רמות כניסה/יציאה/סטופ
  const breakoutPrice = breakoutCandle.close

  const expectedEntry = direction === 'UP'
    ? breakoutPrice * 1.001
    : breakoutPrice * 0.999

  const expectedExit = direction === 'UP'
    ? breakoutPrice + (range * 2)  // Measured move: 2x גובה הדשדוש
    : breakoutPrice - (range * 2)

  const stopLoss = direction === 'UP'
    ? consol.low - buffer
    : consol.high + buffer

  // חישוב איכות (0-95)
  // רכיבים: טווח צר (40), נגיעות רבות (30), נפח (25)
  const rangeComponent = Math.max(0, 40 * (1 - (range / breakoutPrice) / 0.08))
  const touchComponent = Math.min(30, (consol.swingHighs + consol.swingLows - 4) * 5)
  const volComponent = 25 // ברירת מחדל

  const quality = Math.round(Math.min(95, rangeComponent + touchComponent + volComponent))

  const consolidationBars = consol.endIndex - consol.startIndex + 1

  return {
    type: 'breakout',
    startIndex: consol.startIndex,
    endIndex: breakoutIndex,  // כולל את נר הפריצה
    expectedEntry,
    expectedExit,
    stopLoss,
    metadata: {
      quality,
      description: direction === 'UP'
        ? `פריצה למעלה מדשדוש (${consolidationBars} נרות)`
        : `פריצה למטה מדשדוש (${consolidationBars} נרות)`,
      hint: direction === 'UP'
        ? `📈 שים לב:\n1️⃣ דשדוש - ${consolidationBars} נרות בטווח צר (${(range / breakoutPrice * 100).toFixed(2)}%)\n2️⃣ ${consol.swingHighs} נגיעות בתקרה, ${consol.swingLows} נגיעות ברצפה\n3️⃣ פריצה למעלה - סגירה מעל ${consol.high.toFixed(2)}\n💡 כניסה: ${expectedEntry.toFixed(2)} | SL: ${stopLoss.toFixed(2)}`
        : `📉 שים לב:\n1️⃣ דשדוש - ${consolidationBars} נרות בטווח צר (${(range / breakoutPrice * 100).toFixed(2)}%)\n2️⃣ ${consol.swingHighs} נגיעות בתקרה, ${consol.swingLows} נגיעות ברצפה\n3️⃣ פריצה למטה - סגירה מתחת ${consol.low.toFixed(2)}\n💡 כניסה: ${expectedEntry.toFixed(2)} | SL: ${stopLoss.toFixed(2)}`,
      breakoutIndex: breakoutIndex,
    },
  }
}

/**
 * פונקציה ראשית: סריקה של כל הנרות וזיהוי תבניות breakout
 */
export function detectSimpleBreakouts(
  candles: Candle[],
  maxPatterns: number,
  options: {
    leftBars?: number
    rightBars?: number
    minConsolBars?: number
    minTouches?: number
    maxRangePct?: number
    requireVolume?: boolean
    requireFollowThrough?: boolean
  } = {}
): Pattern[] {
  const {
    leftBars = 3,
    rightBars = 3,
    minConsolBars = 8,
    minTouches = 2,
    maxRangePct = 0.08,  // 8% - פשוט וגמיש
    requireVolume = false,
    requireFollowThrough = true,
  } = options

  console.log(`🔍 Simple Breakout Detector (Fractals + Consolidations)`)
  console.log(`   Swing detection: ${leftBars}L-${rightBars}R bars`)
  console.log(`   Consolidation: ${minConsolBars}+ bars, ${minTouches}+ touches, max ${(maxRangePct * 100).toFixed(0)}% range`)
  console.log(`   Filters: Volume=${requireVolume}, FollowThrough=${requireFollowThrough}`)

  // שלב 1: זיהוי פרקטלים
  const swings = findSwingPoints(candles, leftBars, rightBars)
  console.log(`   📍 Found ${swings.length} swing points`)

  // שלב 2: זיהוי דשדושים
  const consolidations = findConsolidations(candles, swings, minConsolBars, minTouches, maxRangePct)
  console.log(`   📦 Found ${consolidations.length} consolidations`)

  // שלב 3: זיהוי פריצות
  const patterns: Pattern[] = []
  const minGap = 20 // מרווח מינימלי בין תבניות

  console.log(`   🔎 Checking ${consolidations.length} consolidations for breakouts (maxPatterns: ${maxPatterns})...`)

  for (const consol of consolidations) {
    console.log(`   🔍 Testing consolidation ${consol.startIndex}-${consol.endIndex}...`)
    if (patterns.length >= maxPatterns) {
      console.log(`   🛑 Reached max patterns limit (${maxPatterns})`)
      break
    }

    // בדיקת חפיפה עם תבניות קיימות
    const hasOverlap = patterns.some(p => {
      const rangeStart = Math.min(p.startIndex, p.endIndex) - minGap
      const rangeEnd = Math.max(p.startIndex, p.endIndex) + minGap
      return consol.startIndex >= rangeStart && consol.startIndex <= rangeEnd
    })

    if (hasOverlap) continue

    // ניסיון לזהות פריצה
    const pattern = detectBreakoutFromConsolidation(
      candles,
      consol,
      requireVolume,
      requireFollowThrough
    )

    if (pattern) {
      patterns.push(pattern)
      console.log(`   ✅ Breakout #${patterns.length} at ${consol.startIndex}-${consol.endIndex} (quality: ${pattern.metadata.quality}%)`)
    } else {
      // DEBUG: מדוע נדחתה התבנית?
      console.log(`   ❌ Rejected consolidation at ${consol.startIndex}-${consol.endIndex}`)
    }
  }

  console.log(`   📊 Total simple breakout patterns: ${patterns.length}`)
  return patterns
}

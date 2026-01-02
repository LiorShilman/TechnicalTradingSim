import type { Position } from '../types/game.types'

/**
 * חישוב דיוק התחזיות (Reflection Accuracy)
 *
 * משווה בין מה שהשחקן חזה (expectedOutcome) לבין התוצאה בפועל (exitPnL).
 * אחוז גבוה = השחקן מנתח נכון את הסיכויים לפני כניסה.
 * אחוז נמוך = צריך לשפר ניתוח או יש bias (תמיד אופטימי/פסימי).
 *
 * @param closedPositions - רשימת עסקאות סגורות
 * @returns אחוז דיוק (0-100)
 *
 * @example
 * // 3 עסקאות עם הערות:
 * // 1. חזה "win" → בפועל +$100 ✓
 * // 2. חזה "loss" → בפועל -$50 ✓
 * // 3. חזה "win" → בפועל -$20 ✗
 * // תוצאה: 66.67% (2/3 נכון)
 */
export function calculateReflectionAccuracy(closedPositions: Position[]): number {
  // סינון עסקאות עם הערות בלבד
  const withNotes = closedPositions.filter(p => p.note?.expectedOutcome)

  if (withNotes.length === 0) return 0

  // ספירת תחזיות נכונות
  const correct = withNotes.filter(p => {
    const actualPnL = p.exitPnL || 0

    // קביעת תוצאה בפועל
    let actualOutcome: 'win' | 'loss' | 'breakeven'
    if (actualPnL > 0) {
      actualOutcome = 'win'
    } else if (actualPnL < 0) {
      actualOutcome = 'loss'
    } else {
      actualOutcome = 'breakeven'
    }

    // השוואה לתחזית
    return p.note!.expectedOutcome === actualOutcome
  })

  return (correct.length / withNotes.length) * 100
}

/**
 * סטטיסטיקות מפורטות על יומן המסחר
 *
 * @param closedPositions - רשימת עסקאות סגורות
 * @returns אובייקט עם נתונים מפורטים
 */
export function getJournalStats(closedPositions: Position[]) {
  const withNotes = closedPositions.filter(p => p.note)
  const totalTrades = closedPositions.length

  if (withNotes.length === 0) {
    return {
      totalNotes: 0,
      percentageWithNotes: 0,
      averageConfidence: 0,
      reflectionAccuracy: 0,
      overconfidenceBias: 0, // כמה פעמים בחר confidence גבוה (4-5) אבל הפסיד
    }
  }

  // ממוצע ביטחון
  const avgConfidence = withNotes.reduce((sum, p) => sum + (p.note?.confidence || 0), 0) / withNotes.length

  // Overconfidence bias: confidence גבוה (4-5) אבל הפסד
  const highConfidenceLosses = withNotes.filter(p => {
    const confidence = p.note?.confidence || 0
    const actualPnL = p.exitPnL || 0
    return confidence >= 4 && actualPnL < 0
  })

  return {
    totalNotes: withNotes.length,
    percentageWithNotes: (withNotes.length / totalTrades) * 100,
    averageConfidence: avgConfidence,
    reflectionAccuracy: calculateReflectionAccuracy(closedPositions),
    overconfidenceBias: withNotes.length > 0 ? (highConfidenceLosses.length / withNotes.length) * 100 : 0,
  }
}

/**
 * קבלת הערות האחרונות (למסך היסטוריה)
 *
 * @param closedPositions - רשימת עסקאות סגורות
 * @param limit - מספר הערות להציג (ברירת מחדל 10)
 * @returns רשימת עסקאות עם הערות, ממוינות לפי תאריך
 */
export function getRecentNotes(closedPositions: Position[], limit: number = 10) {
  return closedPositions
    .filter(p => p.note)
    .sort((a, b) => (b.exitTime || 0) - (a.exitTime || 0))
    .slice(0, limit)
}

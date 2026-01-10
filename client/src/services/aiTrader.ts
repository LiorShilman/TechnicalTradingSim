/**
 * AI Trader Service
 * מחליט מתי לפתוח/לסגור עסקאות על בסיס תבניות טכניות
 */

import type { GameState, Pattern, Position } from '@/types/game.types'

interface AIDecision {
  action: 'open_long' | 'open_short' | 'close_position' | 'hold'
  reason: string // הסבר בעברית למה ה-AI מחליט כך
  pattern?: Pattern // התבנית שעליה מבוססת ההחלטה
  entry?: number
  stopLoss?: number
  takeProfit?: number
  quantity?: number
  positionId?: string // אם סוגרים פוזיציה
}

/**
 * מחשב את הכמות לעסקה על בסיס ניהול סיכון של 1%
 */
function calculatePosition1PercentRisk(
  equity: number,
  entryPrice: number,
  stopLoss: number
): number {
  const riskAmount = equity * 0.01 // 1% מההון
  const priceDistance = Math.abs(entryPrice - stopLoss)
  const quantity = riskAmount / priceDistance

  // עיגול ל-3 ספרות עשרוניות
  return Math.round(quantity * 1000) / 1000
}

/**
 * בודק אם יש תבנית שמתחילה באינדקס הנוכחי
 */
function findActivePattern(
  currentIndex: number,
  patterns: Pattern[],
  openPositions: Position[]
): Pattern | null {
  // מחפש תבנית שמסתיימת באינדקס הנוכחי (זמן לפתוח פוזיציה)
  const pattern = patterns.find(p => p.endIndex === currentIndex - 1)

  console.log('🔎 Searching for pattern at index', currentIndex - 1, 'found:', pattern?.type, 'quality:', pattern?.metadata.quality)

  if (!pattern) return null

  // בודק שאין כבר פוזיציה פתוחה על אותה תבנית
  const hasOpenPosition = openPositions.some(pos =>
    pos.patternEntry?.patternType === pattern.type &&
    pos.entryIndex >= pattern.startIndex &&
    pos.entryIndex <= pattern.endIndex + 5
  )

  if (hasOpenPosition) {
    console.log('⚠️ Already have position on this pattern')
    return null
  }

  // בודק איכות התבנית (רק תבניות מעל 70%)
  if (pattern.metadata.quality < 70) {
    console.log('⚠️ Pattern quality too low:', pattern.metadata.quality)
    return null
  }

  console.log('✅ Found valid pattern:', pattern.type, 'quality:', pattern.metadata.quality)
  return pattern
}

/**
 * מחליט האם לסגור פוזיציה קיימת
 */
function shouldClosePosition(
  position: Position,
  currentPrice: number,
  _currentIndex: number
): { shouldClose: boolean; reason: string } {
  // אם יש TP והמחיר הגיע אליו
  if (position.takeProfit) {
    if (position.type === 'long' && currentPrice >= position.takeProfit) {
      return { shouldClose: true, reason: `הגענו ל-Take Profit (${position.takeProfit.toFixed(2)})` }
    }
    if (position.type === 'short' && currentPrice <= position.takeProfit) {
      return { shouldClose: true, reason: `הגענו ל-Take Profit (${position.takeProfit.toFixed(2)})` }
    }
  }

  // אם יש SL והמחיר עבר אותו
  if (position.stopLoss) {
    if (position.type === 'long' && currentPrice <= position.stopLoss) {
      return { shouldClose: true, reason: `הופעל Stop Loss (${position.stopLoss.toFixed(2)})` }
    }
    if (position.type === 'short' && currentPrice >= position.stopLoss) {
      return { shouldClose: true, reason: `הופעל Stop Loss (${position.stopLoss.toFixed(2)})` }
    }
  }

  // אם הפוזיציה ברווח טוב (2R) ואין TP - נסגור
  const riskDistance = Math.abs(position.entryPrice - (position.stopLoss || position.entryPrice))
  const currentProfit = position.type === 'long'
    ? currentPrice - position.entryPrice
    : position.entryPrice - currentPrice

  if (currentProfit >= riskDistance * 2 && !position.takeProfit) {
    return { shouldClose: true, reason: 'רווח של 2R - סגירה מניעתית' }
  }

  return { shouldClose: false, reason: '' }
}

/**
 * פונקציה ראשית: מחליטה מה ה-AI צריך לעשות
 */
export function makeAIDecision(gameState: GameState): AIDecision | null {
  const { currentIndex, patterns, positions, candles, account } = gameState

  if (!candles || candles.length === 0) return null

  const currentCandle = candles[currentIndex]
  if (!currentCandle) return null

  const currentPrice = currentCandle.close
  const openPositions = positions.filter(p => !p.exitTime)

  console.log('🔍 AI Analyzing:', {
    currentIndex,
    totalPatterns: patterns.length,
    openPositions: openPositions.length,
    currentPrice
  })

  // קודם כל, בודק אם צריך לסגור פוזיציות קיימות
  for (const position of openPositions) {
    const closeDecision = shouldClosePosition(position, currentPrice, currentIndex)
    if (closeDecision.shouldClose) {
      return {
        action: 'close_position',
        reason: closeDecision.reason,
        positionId: position.id
      }
    }
  }

  // אם יש יותר מ-2 פוזיציות פתוחות, לא פותחים עוד
  if (openPositions.length >= 2) {
    return {
      action: 'hold',
      reason: 'יש כבר 2 פוזיציות פתוחות - ממתינים'
    }
  }

  // מחפש תבנית חדשה לסחר
  const pattern = findActivePattern(currentIndex, patterns, openPositions)

  if (!pattern) {
    return {
      action: 'hold',
      reason: 'אין תבניות איכותיות כרגע'
    }
  }

  // קובע כיוון העסקה לפי סוג התבנית
  const isLong = pattern.expectedExit > pattern.expectedEntry
  const action = isLong ? 'open_long' : 'open_short'

  // חישוב כמות על בסיס 1% סיכון
  const quantity = calculatePosition1PercentRisk(
    account.equity,
    pattern.expectedEntry,
    pattern.stopLoss
  )

  // בניית ההסבר
  const patternTypeHebrew: Record<string, string> = {
    'breakout': 'פריצה',
    'retest': 'בדיקה חוזרת',
    'flag': 'דגל'
  }

  const reason = `זיהיתי תבנית ${patternTypeHebrew[pattern.type] || pattern.type} איכותית (${pattern.metadata.quality}%) | ` +
                 `כניסה: ${pattern.expectedEntry.toFixed(2)} | ` +
                 `SL: ${pattern.stopLoss.toFixed(2)} | ` +
                 `TP: ${pattern.expectedExit.toFixed(2)} | ` +
                 `סיכון: 1% (${quantity} יחידות)`

  return {
    action,
    reason,
    pattern,
    entry: pattern.expectedEntry,
    stopLoss: pattern.stopLoss,
    takeProfit: pattern.expectedExit,
    quantity
  }
}

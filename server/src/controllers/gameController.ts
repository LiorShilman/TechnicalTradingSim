import { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { generateCandlesWithPatterns } from '../services/candleGenerator.js'
import type { GameState } from '../types/index.js'

// Temporary in-memory storage (replace with DB later)
const games = new Map<string, GameState>()

/**
 * יצירת משחק חדש
 */
export const createGame = async (req: Request, res: Response) => {
  try {
    console.log('Creating new game...')

    const gameId = uuidv4()

    // 1. יצירת נרות עם תבניות
    const totalCandles = 500 // הגדלנו ל-500 נרות
    const patternCount = 8 // הגדלנו ל-8 תבניות
    const { candles, patterns } = generateCandlesWithPatterns(totalCandles, patternCount)
    console.log(`Generated ${candles.length} candles with ${patterns.length} patterns`)

    // 2. אתחול מצב משחק
    const game: GameState = {
      id: gameId,
      candles,
      patterns,
      currentIndex: 49, // מתחילים עם 50 נרות גלויים (0-49)
      visibleCandles: 100, // הגדלנו את חלון התצוגה ל-100
      account: {
        balance: 10000,
        equity: 10000,
        initialBalance: 10000,
        realizedPnL: 0,
        unrealizedPnL: 0,
      },
      positions: [],
      closedPositions: [],
      stats: {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        averageWin: 0,
        averageLoss: 0,
        profitFactor: 0,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        patternRecognitionScore: 0,
        averageEntryQuality: 0,
      },
      feedbackHistory: [],
      isComplete: false,
      asset: 'BTC/USD',
      timeframe: '1H',
      totalCandles,
    }

    // 3. שמירה במאגר
    games.set(gameId, game)

    console.log(`Game ${gameId} created successfully`)
    res.json({ game })
  } catch (error) {
    console.error('Error creating game:', error)
    res.status(500).json({
      error: 'Failed to create game',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * קבלת מצב משחק
 */
export const getGame = async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params
    const game = games.get(gameId)

    if (!game) {
      return res.status(404).json({
        error: 'Game not found',
        message: 'Invalid game ID',
      })
    }

    res.json({ game })
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get game',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * נר הבא
 */
export const nextCandle = async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params
    const game = games.get(gameId)

    if (!game) {
      return res.status(404).json({
        error: 'Game not found',
        message: 'Invalid game ID',
      })
    }

    // בדיקה אם המשחק הסתיים
    if (game.isComplete) {
      return res.status(400).json({
        error: 'Game already complete',
        message: 'Cannot advance - game is finished',
      })
    }

    // 1. התקדמות לנר הבא
    const newIndex = game.currentIndex + 1

    if (newIndex >= game.totalCandles) {
      // המשחק הסתיים
      game.isComplete = true
      game.currentIndex = game.totalCandles - 1

      return res.json({
        game,
        isComplete: true,
      })
    }

    game.currentIndex = newIndex
    const currentCandle = game.candles[newIndex]

    // 2. עדכון PnL של פוזיציות פתוחות
    let totalUnrealizedPnL = 0

    for (const position of game.positions) {
      const currentPrice = currentCandle.close
      const priceDiff = currentPrice - position.entryPrice

      // חישוב PnL (LONG: רווח כשהמחיר עולה, SHORT: רווח כשהמחיר יורד)
      if (position.type === 'long') {
        position.currentPnL = priceDiff * position.quantity
        position.currentPnLPercent = (priceDiff / position.entryPrice) * 100
      } else {
        // SHORT: רווח הפוך - רווח כשהמחיר יורד
        position.currentPnL = -priceDiff * position.quantity
        position.currentPnLPercent = (-priceDiff / position.entryPrice) * 100
      }

      totalUnrealizedPnL += position.currentPnL
    }

    // 3. עדכון חשבון
    game.account.unrealizedPnL = totalUnrealizedPnL
    game.account.equity = game.account.balance + totalUnrealizedPnL

    // 4. בדיקה אם יש תבנית באזור
    const feedback = []
    for (const pattern of game.patterns) {
      // אם אנחנו קרובים להתחלת תבנית (5 נרות לפני)
      if (newIndex >= pattern.startIndex - 5 && newIndex <= pattern.startIndex + 5) {
        feedback.push({
          type: 'pattern_hint' as const,
          message: pattern.metadata.hint || `תבנית ${pattern.type} מתפתחת`,
          timestamp: Date.now(),
          data: {
            patternType: pattern.type,
          },
        })
      }
    }

    // הוספת feedback להיסטוריה
    if (feedback.length > 0) {
      game.feedbackHistory.push(...feedback)
    }

    console.log(`Game ${gameId}: Advanced to candle ${newIndex}`)

    res.json({
      game,
    })
  } catch (error) {
    console.error('Error advancing candle:', error)
    res.status(500).json({
      error: 'Failed to advance candle',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * ביצוע מסחר
 */
export const executeTrade = async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params
    const { type, quantity, positionId, positionType } = req.body
    const game = games.get(gameId)

    if (!game) {
      return res.status(404).json({
        error: 'Game not found',
        message: 'Invalid game ID',
      })
    }

    const currentCandle = game.candles[game.currentIndex]
    const currentPrice = currentCandle.close

    // ========== BUY - פתיחת פוזיציה (LONG או SHORT) ==========
    if (type === 'buy') {
      // 1. בדיקת יתרה
      const cost = currentPrice * quantity
      if (cost > game.account.balance) {
        return res.status(400).json({
          error: 'Insufficient balance',
          message: 'Not enough funds to open position',
        })
      }

      // 2. יצירת פוזיציה חדשה (LONG או SHORT)
      const actualPositionType = positionType || 'long' // ברירת מחדל LONG
      const newPosition = {
        id: uuidv4(),
        type: actualPositionType as 'long' | 'short',
        entryPrice: currentPrice,
        entryTime: currentCandle.time,
        entryIndex: game.currentIndex,
        quantity,
        currentPnL: 0,
        currentPnLPercent: 0,
      }

      // 3. בדיקה אם נכנסו בתבנית
      let entryQuality = 50 // ברירת מחדל
      let patternType: string | undefined

      for (const pattern of game.patterns) {
        // אם אנחנו בטווח התבנית
        if (game.currentIndex >= pattern.startIndex && game.currentIndex <= pattern.endIndex) {
          patternType = pattern.type

          // חישוב איכות כניסה לפי קרבה ל-expectedEntry
          const priceDiff = Math.abs(currentPrice - pattern.expectedEntry)
          const priceRange = pattern.expectedExit - pattern.expectedEntry
          const proximity = 1 - Math.min(priceDiff / priceRange, 1)

          entryQuality = Math.floor(proximity * 100)

          // בונוס אם נכנסו בזמן
          const indexDiff = Math.abs(game.currentIndex - pattern.startIndex)
          const patternLength = pattern.endIndex - pattern.startIndex
          if (indexDiff < patternLength * 0.3) {
            entryQuality = Math.min(entryQuality + 10, 100)
          }

          break
        }
      }

      // הוספת מידע על תבנית אם רלוונטי
      if (patternType) {
        (newPosition as any).patternEntry = {
          patternType,
          entryQuality,
        }
      }

      // 4. עדכון חשבון ופוזיציות
      game.account.balance -= cost
      game.positions.push(newPosition)

      // 5. עדכון סטטיסטיקות
      game.stats.totalTrades++

      // 6. יצירת feedback
      const positionTypeText = actualPositionType === 'long' ? 'LONG' : 'SHORT'
      const feedback = {
        type: 'info' as const,
        message: patternType
          ? `פוזיציית ${positionTypeText} נפתחה בתבנית ${patternType} (איכות: ${entryQuality}/100)`
          : `פוזיציית ${positionTypeText} נפתחה במחיר $${currentPrice.toLocaleString()}`,
        timestamp: Date.now(),
        data: {
          patternType: patternType as any,
          entryQuality,
          expectedEntry: game.patterns.find(p => p.type === patternType)?.expectedEntry,
          actualEntry: currentPrice,
        },
      }

      game.feedbackHistory.push(feedback)

      console.log(`Game ${gameId}: Opened ${actualPositionType} position ${newPosition.id} at $${currentPrice}`)

      return res.json({
        position: newPosition,
        account: game.account,
        feedback,
      })
    }

    // ========== SELL - סגירת פוזיציה ==========
    if (type === 'sell') {
      // 1. מציאת הפוזיציה
      const positionIndex = game.positions.findIndex(p => p.id === positionId)
      if (positionIndex === -1) {
        return res.status(404).json({
          error: 'Position not found',
          message: 'Invalid position ID',
        })
      }

      const position = game.positions[positionIndex]

      // 2. חישוב PnL סופי (LONG או SHORT)
      const exitPrice = currentPrice
      const priceDiff = exitPrice - position.entryPrice

      let exitPnL: number
      let exitPnLPercent: number

      if (position.type === 'long') {
        // LONG: רווח כשהמחיר עולה
        exitPnL = priceDiff * position.quantity
        exitPnLPercent = (priceDiff / position.entryPrice) * 100
      } else {
        // SHORT: רווח כשהמחיר יורד
        exitPnL = -priceDiff * position.quantity
        exitPnLPercent = (-priceDiff / position.entryPrice) * 100
      }

      // 3. עדכון הפוזיציה
      const closedPosition = {
        ...position,
        exitPrice,
        exitTime: currentCandle.time,
        exitIndex: game.currentIndex,
        exitPnL,
        exitPnLPercent,
      }

      // 4. עדכון חשבון
      const returnAmount = position.entryPrice * position.quantity + exitPnL
      game.account.balance += returnAmount
      game.account.realizedPnL += exitPnL
      game.account.equity = game.account.balance // עדכון equity

      // 5. עדכון סטטיסטיקות
      if (exitPnL > 0) {
        game.stats.winningTrades++
        game.stats.averageWin =
          (game.stats.averageWin * (game.stats.winningTrades - 1) + exitPnL) / game.stats.winningTrades
      } else {
        game.stats.losingTrades++
        game.stats.averageLoss =
          (game.stats.averageLoss * (game.stats.losingTrades - 1) + Math.abs(exitPnL)) / game.stats.losingTrades
      }

      game.stats.winRate = (game.stats.winningTrades / game.stats.totalTrades) * 100

      if (game.stats.averageLoss > 0) {
        game.stats.profitFactor = game.stats.averageWin / game.stats.averageLoss
      }

      // חישוב drawdown
      const currentEquity = game.account.equity
      const initialBalance = game.account.initialBalance
      const drawdown = initialBalance - currentEquity
      if (drawdown > game.stats.maxDrawdown) {
        game.stats.maxDrawdown = drawdown
        game.stats.maxDrawdownPercent = (drawdown / initialBalance) * 100
      }

      // 6. הסרת פוזיציה מהרשימה והוספה לפוזיציות סגורות
      game.positions.splice(positionIndex, 1)
      game.closedPositions.push(closedPosition)

      // 7. יצירת feedback
      const feedbackType = exitPnL >= 0 ? 'success' : 'warning'
      const feedback = {
        type: feedbackType as 'success' | 'warning',
        message: exitPnL >= 0
          ? `רווח! +$${exitPnL.toLocaleString(undefined, { maximumFractionDigits: 2 })} (+${exitPnLPercent.toFixed(2)}%)`
          : `הפסד! -$${Math.abs(exitPnL).toLocaleString(undefined, { maximumFractionDigits: 2 })} (${exitPnLPercent.toFixed(2)}%)`,
        timestamp: Date.now(),
      }

      game.feedbackHistory.push(feedback)

      console.log(`Game ${gameId}: Closed position ${positionId} with PnL: $${exitPnL}`)

      return res.json({
        closedPosition,
        account: game.account,
        feedback,
      })
    }

    // אם הגיעו לכאן, הסוג לא תקין
    return res.status(400).json({
      error: 'Invalid trade type',
      message: 'Trade type must be "buy" or "sell"',
    })
  } catch (error) {
    console.error('Error executing trade:', error)
    res.status(500).json({
      error: 'Failed to execute trade',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

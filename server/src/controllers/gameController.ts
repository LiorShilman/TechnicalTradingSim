import { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { generateCandlesWithPatterns } from '../services/candleGenerator.js'
import { parseCSVContent } from '../services/historyLoader.js'
import { detectPatterns } from '../services/patternDetector.js'
import type { GameState } from '../types/index.js'

// Temporary in-memory storage (replace with DB later)
const games = new Map<string, GameState>()

/**
 * חישוב סטיית תקן (Standard Deviation)
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

/**
 * חישוב Downside Deviation (רק תנודתיות שלילית)
 */
function calculateDownsideDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const negativeValues = values.filter(v => v < mean)
  if (negativeValues.length === 0) return 0
  const variance = negativeValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
  return Math.sqrt(variance)
}

/**
 * עדכון Sharpe, Sortino, Calmar Ratios
 */
function updateAdvancedStats(game: GameState) {
  const closedPositions = game.closedPositions

  // צריכים לפחות 2 עסקאות לחישוב מדויק
  if (closedPositions.length < 2) {
    game.stats.sharpeRatio = 0
    game.stats.sortinoRatio = 0
    game.stats.calmarRatio = 0
    return
  }

  // חישוב תשואות לכל עסקה (באחוזים)
  const returns = closedPositions
    .filter(p => p.exitPnLPercent !== undefined)
    .map(p => p.exitPnLPercent as number)

  if (returns.length === 0) {
    game.stats.sharpeRatio = 0
    game.stats.sortinoRatio = 0
    game.stats.calmarRatio = 0
    return
  }

  const averageReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
  const riskFreeRate = 0 // בקריפטו בדרך כלל 0

  // 1. Sharpe Ratio = (תשואה ממוצעת - risk-free rate) / סטיית תקן
  const stdDev = calculateStandardDeviation(returns)
  game.stats.sharpeRatio = stdDev > 0 ? (averageReturn - riskFreeRate) / stdDev : 0

  // 2. Sortino Ratio = (תשואה ממוצעת - risk-free rate) / downside deviation
  const downsideDev = calculateDownsideDeviation(returns)
  game.stats.sortinoRatio = downsideDev > 0 ? (averageReturn - riskFreeRate) / downsideDev : 0

  // 3. Calmar Ratio = תשואה כוללת (%) / Max Drawdown (%)
  const totalReturnPercent = ((game.account.equity - game.account.initialBalance) / game.account.initialBalance) * 100
  game.stats.calmarRatio = game.stats.maxDrawdownPercent > 0
    ? totalReturnPercent / game.stats.maxDrawdownPercent
    : 0
}

/**
 * יצירת משחק חדש
 */
export const createGame = async (req: Request, res: Response) => {
  try {
    console.log('Creating new game...', req.body)

    const gameId = uuidv4()
    const initialBalance = req.body?.initialBalance || 10000

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
        balance: initialBalance,
        equity: initialBalance,
        initialBalance: initialBalance,
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
        sharpeRatio: 0,
        sortinoRatio: 0,
        calmarRatio: 0,
        patternRecognitionScore: 0,
        averageEntryQuality: 0,
        currentStreak: 0,
        maxWinStreak: 0,
        maxLossStreak: 0,
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
    return res.json({ game })
  } catch (error) {
    console.error('Error creating game:', error)
    return res.status(500).json({
      error: 'Failed to create game',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * יצירת משחק חדש מקובץ CSV
 */
export const createGameFromCSV = async (req: Request, res: Response) => {
  try {
    console.log('Creating game from uploaded CSV...')

    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please upload a CSV file',
      })
    }

    const gameId = uuidv4()

    // קבלת asset, timeframe, initialBalance, startIndex ו-dateRange מה-request body (אופציונלי)
    const assetName = req.body.assetName || 'BTC/USD (Real Data)'
    const timeframe = req.body.timeframe || '1H'
    const initialBalance = req.body.initialBalance ? parseFloat(req.body.initialBalance) : 10000
    const startIndex = req.body.startIndex ? parseInt(req.body.startIndex) : 0 // אינדקס התחלתי (לטעינת משחק שמור)
    const startDate = req.body.startDate
    const endDate = req.body.endDate

    // שחזור מצב משחק שמור (אם סופק)
    const savedPositions = req.body.savedPositions ? JSON.parse(req.body.savedPositions) : []
    const savedClosedPositions = req.body.savedClosedPositions ? JSON.parse(req.body.savedClosedPositions) : []
    const savedPendingOrders = req.body.savedPendingOrders ? JSON.parse(req.body.savedPendingOrders) : []
    const savedAccount = req.body.savedAccount ? JSON.parse(req.body.savedAccount) : null
    const savedStats = req.body.savedStats ? JSON.parse(req.body.savedStats) : null
    const savedFeedback = req.body.savedFeedback ? JSON.parse(req.body.savedFeedback) : []

    console.log(`Asset: ${assetName}, Timeframe: ${timeframe}, Initial Balance: ${initialBalance}, Start Index: ${startIndex}`)
    if (savedPositions.length > 0 || savedPendingOrders.length > 0) {
      console.log(`🔄 Restoring saved game state: ${savedPositions.length} positions, ${savedPendingOrders.length} pending orders`)
    }
    if (startDate && endDate) {
      console.log(`Date Range: ${startDate} to ${endDate}`)
    }

    // 1. פרסור קובץ CSV
    const csvContent = req.file.buffer.toString('utf-8')
    console.log(`Parsing CSV file: ${req.file.originalname} (${req.file.size} bytes)`)

    let candles
    try {
      candles = parseCSVContent(csvContent)
    } catch (parseError) {
      console.error('CSV parsing error:', parseError)
      return res.status(400).json({
        error: 'Invalid CSV format',
        message: parseError instanceof Error ? parseError.message : 'Failed to parse CSV',
      })
    }

    console.log(`✅ Loaded ${candles.length} candles from CSV`)

    // 2. סינון לפי טווח תאריכים (אם סופק)
    if (startDate && endDate) {
      const startTimestamp = new Date(startDate).getTime() / 1000 // המרה לUnix seconds
      const endTimestamp = new Date(endDate).getTime() / 1000 + 86400 // כולל יום סיום (86400 = 24 שעות)

      const originalLength = candles.length
      candles = candles.filter(candle => {
        return candle.time >= startTimestamp && candle.time < endTimestamp
      })

      console.log(`📅 Filtered by date range: ${originalLength} → ${candles.length} candles`)
    }

    if (candles.length < 100) {
      return res.status(400).json({
        error: 'Insufficient data',
        message: `CSV must contain at least 100 candles after filtering (found ${candles.length})`,
      })
    }

    // 2. זיהוי דפוסים בדאטה הריאלי
    const patternCount = 8
    console.log(`🔍 Detecting patterns in real data...`)
    const patterns = detectPatterns(candles, patternCount)
    console.log(`✅ Detected ${patterns.length} patterns`)

    // 3. חישוב רזולוציית מחיר (price step) מהדאטה
    let priceStep = 0.01 // ברירת מחדל
    if (candles.length > 0) {
      // מוצאים את המחיר הקטן ביותר
      const samplePrices = candles.slice(0, 100).flatMap(c => [c.open, c.high, c.low, c.close])
      const minPrice = Math.min(...samplePrices)

      // קובעים רזולוציה לפי גודל המחיר
      if (minPrice < 1) {
        priceStep = 0.0001 // 4 decimal places (crypto pairs like ETH/BTC)
      } else if (minPrice < 100) {
        priceStep = 0.01 // 2 decimal places (small stocks, some crypto)
      } else if (minPrice < 1000) {
        priceStep = 0.1 // 1 decimal place
      } else {
        priceStep = 1 // whole numbers (BTC, stocks like TSLA)
      }

      console.log(`💵 Auto-detected price step: ${priceStep} (min price: ${minPrice.toFixed(4)})`)
    }

    // 4. קביעת totalCandles - נשתמש בכל הדאטה שנטענה מהקובץ (ללא הגבלה)
    const totalCandles = candles.length
    const usedCandles = candles

    // 4. אתחול מצב משחק
    const game: GameState = {
      id: gameId,
      candles: usedCandles,
      patterns,
      currentIndex: startIndex || 49, // משתמשים באינדקס שהתקבל (49 למשחק חדש, או אינדקס שמור למשחק טעון)
      visibleCandles: 100,
      account: savedAccount || {
        balance: initialBalance,
        equity: initialBalance,
        initialBalance: initialBalance,
        realizedPnL: 0,
        unrealizedPnL: 0,
      },
      positions: savedPositions,
      closedPositions: savedClosedPositions,
      pendingOrders: savedPendingOrders,
      stats: savedStats || {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        averageWin: 0,
        averageLoss: 0,
        profitFactor: 0,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        calmarRatio: 0,
        patternRecognitionScore: 0,
        averageEntryQuality: 0,
        currentStreak: 0,
        maxWinStreak: 0,
        maxLossStreak: 0,
      },
      feedbackHistory: savedFeedback,
      isComplete: false,
      asset: assetName,
      timeframe: timeframe,
      totalCandles,
      priceStep,
      sourceFileName: req.file.originalname, // שמירת שם הקובץ המקורי
      sourceDateRange: startDate && endDate ? { start: startDate, end: endDate } : undefined,
    }

    // 5. שמירה במאגר
    games.set(gameId, game)

    console.log(`🎮 Game ${gameId} created from CSV with ${patterns.length} detected patterns, ${game.candles.length} candles, startIndex: ${startIndex}`)
    return res.json({ game })
  } catch (error) {
    console.error('Error creating game from CSV:', error)
    return res.status(500).json({
      error: 'Failed to create game from CSV',
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

    return res.json({ game })
  } catch (error) {
    return res.status(500).json({
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

    // 2. בדיקת Stop Loss / Take Profit והסרת פוזיציות שנפגעו
    const positionsToClose: Array<{ position: any; reason: 'stop_loss' | 'take_profit' }> = []

    for (const position of game.positions) {
      const currentPrice = currentCandle.close
      let shouldClose = false
      let closeReason: 'stop_loss' | 'take_profit' | undefined

      // בדיקת Stop Loss / Take Profit
      if (position.type === 'long') {
        // LONG: SL למטה, TP למעלה
        if (position.stopLoss && currentPrice <= position.stopLoss) {
          shouldClose = true
          closeReason = 'stop_loss'
        } else if (position.takeProfit && currentPrice >= position.takeProfit) {
          shouldClose = true
          closeReason = 'take_profit'
        }
      } else {
        // SHORT: SL למעלה, TP למטה
        if (position.stopLoss && currentPrice >= position.stopLoss) {
          shouldClose = true
          closeReason = 'stop_loss'
        } else if (position.takeProfit && currentPrice <= position.takeProfit) {
          shouldClose = true
          closeReason = 'take_profit'
        }
      }

      if (shouldClose && closeReason) {
        positionsToClose.push({ position, reason: closeReason })
      }
    }

    // סגירת הפוזיציות שנפגעו
    for (const { position, reason } of positionsToClose) {
      const exitPrice = currentCandle.close
      const priceDiff = exitPrice - position.entryPrice

      let exitPnL: number
      let exitPnLPercent: number

      if (position.type === 'long') {
        exitPnL = priceDiff * position.quantity
        exitPnLPercent = (priceDiff / position.entryPrice) * 100
      } else {
        exitPnL = -priceDiff * position.quantity
        exitPnLPercent = (-priceDiff / position.entryPrice) * 100
      }

      const closedPosition = {
        ...position,
        exitPrice,
        exitTime: currentCandle.time,
        exitIndex: game.currentIndex,
        exitPnL,
        exitPnLPercent,
        exitReason: reason,
      }

      // עדכון חשבון
      const returnAmount = position.entryPrice * position.quantity + exitPnL
      game.account.balance += returnAmount
      game.account.realizedPnL += exitPnL

      // הסרת הפוזיציה מהרשימה
      const posIndex = game.positions.findIndex(p => p.id === position.id)
      if (posIndex !== -1) {
        game.positions.splice(posIndex, 1)
      }

      // הוספה לפוזיציות סגורות
      game.closedPositions.push(closedPosition)

      // עדכון סטטיסטיקות
      const isWin = exitPnL > 0

      if (isWin) {
        game.stats.winningTrades++
        game.stats.averageWin =
          (game.stats.averageWin * (game.stats.winningTrades - 1) + exitPnL) / game.stats.winningTrades

        // עדכון Win Streak
        if (game.stats.currentStreak >= 0) {
          game.stats.currentStreak++
        } else {
          game.stats.currentStreak = 1
        }

        // עדכון Max Win Streak
        if (game.stats.currentStreak > game.stats.maxWinStreak) {
          game.stats.maxWinStreak = game.stats.currentStreak
        }
      } else {
        game.stats.losingTrades++
        game.stats.averageLoss =
          (game.stats.averageLoss * (game.stats.losingTrades - 1) + Math.abs(exitPnL)) / game.stats.losingTrades

        // עדכון Loss Streak
        if (game.stats.currentStreak <= 0) {
          game.stats.currentStreak--
        } else {
          game.stats.currentStreak = -1
        }

        // עדכון Max Loss Streak
        if (Math.abs(game.stats.currentStreak) > game.stats.maxLossStreak) {
          game.stats.maxLossStreak = Math.abs(game.stats.currentStreak)
        }
      }

      game.stats.winRate = (game.stats.winningTrades / game.stats.totalTrades) * 100

      if (game.stats.averageLoss > 0) {
        game.stats.profitFactor = game.stats.averageWin / game.stats.averageLoss
      }

      // עדכון Sharpe, Sortino, Calmar Ratios
      updateAdvancedStats(game)

      // יצירת feedback
      const reasonText = reason === 'stop_loss' ? 'Stop Loss' : 'Take Profit'
      const feedbackType = exitPnL >= 0 ? 'success' : 'warning'
      game.feedbackHistory.push({
        type: feedbackType as 'success' | 'warning',
        message: `${reasonText} הופעל! ${exitPnL >= 0 ? 'רווח' : 'הפסד'}: $${Math.abs(exitPnL).toLocaleString(undefined, { maximumFractionDigits: 2 })} (${exitPnLPercent.toFixed(2)}%)`,
        timestamp: Date.now(),
      })
    }

    // 2.5. בדיקת פקודות עתידיות והפעלתן
    if (game.pendingOrders && game.pendingOrders.length > 0) {
      const currentPrice = currentCandle.close
      const previousCandle = game.candles[game.currentIndex - 1]
      const previousPrice = previousCandle?.close || currentPrice
      const ordersToExecute: typeof game.pendingOrders = []
      const ordersToKeep: typeof game.pendingOrders = []

      for (const order of game.pendingOrders) {
        let shouldExecute = false

        // ✅ לוגיקה מתקדמת: בדיקה לפי סוג הפקודה (Stop/Limit)
        switch (order.orderType) {
          case 'buyStop':
            // Buy Stop: קנייה מעל המחיר הנוכחי - מבוצע כשהמחיר עולה ועובר את היעד
            shouldExecute = previousPrice < order.targetPrice && currentPrice >= order.targetPrice
            break

          case 'buyLimit':
            // Buy Limit: קנייה מתחת למחיר הנוכחי - מבוצע כשהמחיר יורד ועובר את היעד
            shouldExecute = previousPrice > order.targetPrice && currentPrice <= order.targetPrice
            break

          case 'sellStop':
            // Sell Stop: מכירה מתחת למחיר הנוכחי - מבוצע כשהמחיר יורד ועובר את היעד
            shouldExecute = previousPrice > order.targetPrice && currentPrice <= order.targetPrice
            break

          case 'sellLimit':
            // Sell Limit: מכירה מעל המחיר הנוכחי - מבוצע כשהמחיר עולה ועובר את היעד
            shouldExecute = previousPrice < order.targetPrice && currentPrice >= order.targetPrice
            break

          default:
            // Fallback ללוגיקה הישנה אם orderType לא מוגדר
            if (order.type === 'long') {
              shouldExecute = currentPrice >= order.targetPrice
            } else {
              shouldExecute = currentPrice <= order.targetPrice
            }
        }

        if (shouldExecute) {
          ordersToExecute.push(order)
        } else {
          ordersToKeep.push(order)
        }
      }

      // ביצוע הפקודות שהגיעו ליעד
      for (const order of ordersToExecute) {
        // בדיקת יתרה
        const cost = order.targetPrice * order.quantity
        if (cost <= game.account.balance) {
          // יצירת פוזיציה חדשה
          const newPosition = {
            id: uuidv4(),
            type: order.type,
            entryPrice: order.targetPrice,
            entryTime: currentCandle.time,
            entryIndex: game.currentIndex,
            quantity: order.quantity,
            currentPnL: 0,
            currentPnLPercent: 0,
            stopLoss: order.stopLoss,
            takeProfit: order.takeProfit,
          }

          // עדכון חשבון ופוזיציות
          game.account.balance -= cost
          game.positions.push(newPosition)
          game.stats.totalTrades++

          // יצירת feedback
          const positionTypeText = order.type === 'long' ? 'LONG' : 'SHORT'
          game.feedbackHistory.push({
            type: 'success' as const,
            message: `פקודה עתידית ${positionTypeText} בוצעה במחיר $${order.targetPrice.toLocaleString()}! 📌`,
            timestamp: Date.now(),
            data: {
              orderId: order.id,
              targetPrice: order.targetPrice,
              quantity: order.quantity,
            },
          })

          console.log(`Game ${gameId}: Executed pending ${order.type} order at $${order.targetPrice}`)
        } else {
          // אין מספיק יתרה - שומרים את הפקודה
          ordersToKeep.push(order)

          game.feedbackHistory.push({
            type: 'warning' as const,
            message: `פקודה עתידית לא בוצעה - אין יתרה מספקת`,
            timestamp: Date.now(),
          })
        }
      }

      // עדכון רשימת הפקודות (רק אלו שלא בוצעו)
      game.pendingOrders = ordersToKeep
    }

    // 3. עדכון PnL של פוזיציות פתוחות שנשארו
    let totalUnrealizedPnL = 0
    let totalPositionValue = 0 // סכום מושקע בפוזיציות

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
      // הוספת ערך הפוזיציה (הסכום המקורי שהושקע)
      totalPositionValue += position.entryPrice * position.quantity
    }

    // 4. עדכון חשבון
    game.account.unrealizedPnL = totalUnrealizedPnL
    // Equity = כסף חופשי + ערך הפוזיציות + רווח/הפסד לא ממומש
    game.account.equity = game.account.balance + totalPositionValue + totalUnrealizedPnL

    // 5. בדיקה אם יש תבנית באזור
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

    //console.log(`Game ${gameId}: Advanced to candle ${newIndex}, returning ${game.candles.length} candles`)

    return res.json({
      game,
    })
  } catch (error) {
    console.error('Error advancing candle:', error)
    return res.status(500).json({
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
    const { type, quantity, positionId, positionType, stopLoss, takeProfit } = req.body
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
        stopLoss: stopLoss,
        takeProfit: takeProfit,
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
        exitReason: 'manual' as const,
      }

      // 4. עדכון חשבון
      const returnAmount = position.entryPrice * position.quantity + exitPnL
      game.account.balance += returnAmount
      game.account.realizedPnL += exitPnL

      // חישוב Equity מחדש (כולל פוזיציות פתוחות שנשארו)
      // קודם נסיר את הפוזיציה הנוכחית מהרשימה
      game.positions.splice(positionIndex, 1)

      // עכשיו נחשב את סך הפוזיציות שנשארו
      let totalUnrealizedPnL = 0
      let totalPositionValue = 0
      for (const pos of game.positions) {
        totalPositionValue += pos.entryPrice * pos.quantity
        totalUnrealizedPnL += pos.currentPnL
      }

      game.account.unrealizedPnL = totalUnrealizedPnL
      game.account.equity = game.account.balance + totalPositionValue + totalUnrealizedPnL

      // 5. עדכון סטטיסטיקות
      const isWin = exitPnL > 0

      if (isWin) {
        game.stats.winningTrades++
        game.stats.averageWin =
          (game.stats.averageWin * (game.stats.winningTrades - 1) + exitPnL) / game.stats.winningTrades

        // עדכון Win Streak
        if (game.stats.currentStreak >= 0) {
          game.stats.currentStreak++
        } else {
          game.stats.currentStreak = 1
        }

        // עדכון Max Win Streak
        if (game.stats.currentStreak > game.stats.maxWinStreak) {
          game.stats.maxWinStreak = game.stats.currentStreak
        }
      } else {
        game.stats.losingTrades++
        game.stats.averageLoss =
          (game.stats.averageLoss * (game.stats.losingTrades - 1) + Math.abs(exitPnL)) / game.stats.losingTrades

        // עדכון Loss Streak
        if (game.stats.currentStreak <= 0) {
          game.stats.currentStreak--
        } else {
          game.stats.currentStreak = -1
        }

        // עדכון Max Loss Streak
        if (Math.abs(game.stats.currentStreak) > game.stats.maxLossStreak) {
          game.stats.maxLossStreak = Math.abs(game.stats.currentStreak)
        }
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

      // 6. הוספה לפוזיציות סגורות (הפוזיציה כבר הוסרה למעלה)
      game.closedPositions.push(closedPosition)

      // 7. עדכון Sharpe, Sortino, Calmar Ratios
      updateAdvancedStats(game)

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
    return res.status(500).json({
      error: 'Failed to execute trade',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * יצירת פקודה עתידית
 */
export const createPendingOrder = async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params
    const { type, targetPrice, quantity, stopLoss, takeProfit, orderType } = req.body
    const game = games.get(gameId)

    if (!game) {
      return res.status(404).json({
        error: 'Game not found',
        message: 'Invalid game ID',
      })
    }

    // בדיקת פרמטרים
    if (!type || !targetPrice || !quantity) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'type, targetPrice, and quantity are required',
      })
    }

    if (type !== 'long' && type !== 'short') {
      return res.status(400).json({
        error: 'Invalid type',
        message: 'type must be "long" or "short"',
      })
    }

    if (quantity <= 0) {
      return res.status(400).json({
        error: 'Invalid quantity',
        message: 'quantity must be greater than 0',
      })
    }

    // בדיקת יתרה
    const cost = targetPrice * quantity
    if (cost > game.account.balance) {
      return res.status(400).json({
        error: 'Insufficient balance',
        message: 'Not enough funds for pending order',
      })
    }

    // קביעת orderType אוטומטית אם לא סופק
    const currentPrice = game.candles[game.currentIndex].close
    let finalOrderType = orderType
    if (!finalOrderType) {
      if (type === 'long') {
        finalOrderType = targetPrice > currentPrice ? 'buyStop' : 'buyLimit'
      } else {
        finalOrderType = targetPrice < currentPrice ? 'sellStop' : 'sellLimit'
      }
    }

    // יצירת פקודה עתידית
    const pendingOrder = {
      id: uuidv4(),
      type: type as 'long' | 'short',
      orderType: finalOrderType,
      targetPrice,
      targetCandleIndex: -1, // יעודכן כשהפקודה תתבצע
      quantity,
      stopLoss,
      takeProfit,
      createdAt: Date.now(),
      createdAtIndex: game.currentIndex,
    }

    // הוספה לרשימת פקודות עתידיות
    if (!game.pendingOrders) {
      game.pendingOrders = []
    }
    game.pendingOrders.push(pendingOrder)

    console.log(`Game ${gameId}: Created pending ${type} order at $${targetPrice}`)

    const feedback = {
      type: 'info' as const,
      message: `פקודה עתידית ${type === 'long' ? 'LONG' : 'SHORT'} נוצרה במחיר $${targetPrice.toLocaleString()}`,
      timestamp: Date.now(),
      data: {
        orderId: pendingOrder.id,
        targetPrice,
        quantity,
      },
    }

    game.feedbackHistory.push(feedback)

    return res.json({
      pendingOrder,
      feedback,
    })
  } catch (error) {
    console.error('Error creating pending order:', error)
    return res.status(500).json({
      error: 'Failed to create pending order',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * ביטול פקודה עתידית
 */
export const cancelPendingOrder = async (req: Request, res: Response) => {
  try {
    const { gameId, orderId } = req.params
    const game = games.get(gameId)

    if (!game) {
      return res.status(404).json({
        error: 'Game not found',
        message: 'Invalid game ID',
      })
    }

    if (!game.pendingOrders) {
      return res.status(404).json({
        error: 'No pending orders',
        message: 'No pending orders found',
      })
    }

    // מציאת הפקודה
    const orderIndex = game.pendingOrders.findIndex(o => o.id === orderId)
    if (orderIndex === -1) {
      return res.status(404).json({
        error: 'Order not found',
        message: 'Invalid order ID',
      })
    }

    // הסרת הפקודה
    const canceledOrder = game.pendingOrders[orderIndex]
    game.pendingOrders.splice(orderIndex, 1)

    console.log(`Game ${gameId}: Canceled pending order ${orderId}`)

    const feedback = {
      type: 'info' as const,
      message: `פקודה עתידית ${canceledOrder.type === 'long' ? 'LONG' : 'SHORT'} בוטלה`,
      timestamp: Date.now(),
      data: {
        orderId: canceledOrder.id,
        targetPrice: canceledOrder.targetPrice,
      },
    }

    game.feedbackHistory.push(feedback)

    return res.json({
      success: true,
      canceledOrder,
      feedback,
    })
  } catch (error) {
    console.error('Error canceling pending order:', error)
    return res.status(500).json({
      error: 'Failed to cancel pending order',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * עדכון פוזיציה קיימת (SL/TP)
 */
export const updatePosition = async (req: Request, res: Response) => {
  try {
    const { gameId, positionId } = req.params
    const { stopLoss, takeProfit } = req.body

    const game = games.get(gameId)

    if (!game) {
      return res.status(404).json({
        error: 'Game not found',
        message: 'Invalid game ID',
      })
    }

    // מציאת הפוזיציה
    const positionIndex = game.positions.findIndex(p => p.id === positionId)
    if (positionIndex === -1) {
      return res.status(404).json({
        error: 'Position not found',
        message: 'Invalid position ID',
      })
    }

    const position = game.positions[positionIndex]

    // עדכון SL/TP
    if (stopLoss !== undefined) {
      position.stopLoss = stopLoss
    }
    if (takeProfit !== undefined) {
      position.takeProfit = takeProfit
    }

    console.log(`Game ${gameId}: Updated position ${positionId} - SL: ${stopLoss}, TP: ${takeProfit}`)

    const feedback = {
      type: 'info' as const,
      message: `פוזיציית ${position.type === 'long' ? 'LONG' : 'SHORT'} עודכנה`,
      timestamp: Date.now(),
      data: {
        positionId: position.id,
        stopLoss,
        takeProfit,
      },
    }

    game.feedbackHistory.push(feedback)

    return res.json({
      success: true,
      position,
      feedback,
    })
  } catch (error) {
    console.error('Error updating position:', error)
    return res.status(500).json({
      error: 'Failed to update position',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * עדכון פקודה עתידית
 */
export const updatePendingOrder = async (req: Request, res: Response) => {
  try {
    const { gameId, orderId } = req.params
    const { targetPrice, quantity, stopLoss, takeProfit } = req.body

    const game = games.get(gameId)

    if (!game) {
      return res.status(404).json({
        error: 'Game not found',
        message: 'Invalid game ID',
      })
    }

    if (!game.pendingOrders) {
      return res.status(404).json({
        error: 'No pending orders',
        message: 'No pending orders found',
      })
    }

    // מציאת הפקודה
    const orderIndex = game.pendingOrders.findIndex(o => o.id === orderId)
    if (orderIndex === -1) {
      return res.status(404).json({
        error: 'Order not found',
        message: 'Invalid order ID',
      })
    }

    const order = game.pendingOrders[orderIndex]

    // עדכון פרטי הפקודה
    if (targetPrice !== undefined) {
      order.targetPrice = targetPrice

      // עדכון סוג הפקודה לפי המחיר החדש
      const currentPrice = game.candles[game.currentIndex]?.close || 0
      if (order.type === 'long') {
        order.orderType = targetPrice > currentPrice ? 'buyStop' : 'buyLimit'
      } else {
        order.orderType = targetPrice < currentPrice ? 'sellStop' : 'sellLimit'
      }
    }
    if (quantity !== undefined) {
      order.quantity = quantity
    }
    if (stopLoss !== undefined) {
      order.stopLoss = stopLoss
    }
    if (takeProfit !== undefined) {
      order.takeProfit = takeProfit
    }

    console.log(`Game ${gameId}: Updated pending order ${orderId}`)

    const feedback = {
      type: 'info' as const,
      message: `פקודה עתידית ${order.type === 'long' ? 'LONG' : 'SHORT'} עודכנה`,
      timestamp: Date.now(),
      data: {
        orderId: order.id,
        targetPrice: order.targetPrice,
        quantity: order.quantity,
      },
    }

    game.feedbackHistory.push(feedback)

    return res.json({
      success: true,
      pendingOrder: order,
      feedback,
    })
  } catch (error) {
    console.error('Error updating pending order:', error)
    return res.status(500).json({
      error: 'Failed to update pending order',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

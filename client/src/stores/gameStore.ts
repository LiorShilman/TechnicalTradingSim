import { create } from 'zustand'
import type { GameState, SavedGameState, TradingRules, RuleViolation } from '@/types/game.types'
import { api } from '@/services/api'
import { customToast } from '@/utils/toast'
import { telegramService } from '@/services/telegramNotifications'
import { priceAlertsService } from '@/services/priceAlertsService'
import { makeAIDecision } from '@/services/aiTrader'

// שם המפתח ב-localStorage
const SAVED_GAME_KEY = 'savedGameState' // LEGACY - kept for backwards compatibility
const MULTI_SAVE_KEY = 'multiSaveGames' // NEW: multi-slot saves
const TRADING_RULES_KEY = 'tradingRules'

// כללי מסחר ברירת מחדל
const DEFAULT_TRADING_RULES: TradingRules = {
  maxDailyTrades: 5,
  minRRRatio: 1.5,
  maxRiskPerTrade: 2,
  requireStopLoss: true,
  requireTakeProfit: false,
  maxConsecutiveLosses: 3,
}

interface GameStore {
  gameState: GameState | null
  isLoading: boolean
  error: string | null
  isAutoPlaying: boolean
  autoPlaySpeed: number // מילישניות בין נרות
  chartFitContent: (() => void) | null
  chartResetZoom: (() => void) | null
  chartScrollToTime: ((time: number) => void) | null
  showStats: boolean // הצגת מסך סטטיסטיקות (למשל בשמירה ויציאה)
  showTradeHistory: boolean // הצגת מסך היסטוריית עסקאות
  showHelp: boolean // הצגת מסך עזרה
  pricePrecision: number // מספר ספרות עשרוניות למחירים (מחושב אוטומטית מהנתונים)
  currentSaveSlotId: string | null // מזהה משבצת השמירה הנוכחית (לשמירה חוזרת)

  // AI Demo Mode
  isDemoMode: boolean // האם במצב הדגמת AI
  demoSpeed: number // מהירות הדגמה (0.5, 1, 2, 5)
  showDemoExplanations: boolean // האם להציג הסברי AI
  demoStats: {
    tradesExecuted: number
    winsCount: number
    lossesCount: number
    totalPnL: number
  }

  // Rule Violation Tracking
  tradingRules: TradingRules
  ruleViolations: RuleViolation[]

  // Actions
  initializeGame: (config?: { initialBalance?: number }) => Promise<void>
  initializeGameWithCSV: (file: File, assetName?: string, timeframe?: string, initialBalance?: number, dateRange?: { start: string; end: string } | null) => Promise<void>
  nextCandle: () => Promise<void>
  jumpToCandle: (targetIndex: number) => void
  executeTrade: (
    type: 'buy' | 'sell',
    quantity: number,
    positionId?: string,
    positionType?: 'long' | 'short',
    stopLoss?: number,
    takeProfit?: number,
    note?: Omit<import('@/types/game.types').TradeNote, 'positionId' | 'createdAt'>
  ) => Promise<void>
  createPendingOrder: (
    type: 'long' | 'short',
    targetPrice: number,
    quantity: number,
    stopLoss?: number,
    takeProfit?: number,
    orderType?: import('@/types/game.types').PendingOrderType
  ) => Promise<void>
  cancelPendingOrder: (orderId: string) => Promise<void>
  updatePosition: (positionId: string, updates: { stopLoss?: number; takeProfit?: number }) => Promise<void>
  updatePendingOrder: (orderId: string, updates: { targetPrice?: number; quantity?: number; stopLoss?: number; takeProfit?: number }) => Promise<void>
  resetGame: () => Promise<void>
  toggleAutoPlay: () => void
  setAutoPlaySpeed: (speed: number) => void
  setChartControls: (fitContent: () => void, resetZoom: () => void, scrollToTime: (time: number) => void) => void

  // Save/Load game state
  saveGameState: () => void
  saveAndExit: () => void
  loadSavedGame: (file: File, dateRange?: { start: string; end: string } | null) => Promise<boolean>
  getSavedGameInfo: () => SavedGameState | null
  clearSavedGame: () => void

  // Multi-Save System
  _getFileKey: (fileName: string, dateRange?: { start: string; end: string } | null) => string
  getAllSaveSlots: (fileName: string, dateRange?: { start: string; end: string } | null) => import('@/types/game.types').SaveSlot[]
  saveToSlot: (slotId?: string, slotName?: string) => string | null
  loadFromSlot: (file: File, slotId: string, dateRange?: { start: string; end: string } | null) => Promise<boolean>
  deleteSlot: (fileName: string, slotId: string, dateRange?: { start: string; end: string } | null) => void
  renameSlot: (fileName: string, slotId: string, newName: string, dateRange?: { start: string; end: string } | null) => void

  // UI State
  toggleTradeHistory: () => void
  toggleHelp: () => void

  // AI Demo Mode Actions
  toggleDemoMode: () => void
  setDemoSpeed: (speed: number) => void
  toggleDemoExplanations: () => void
  resetDemoStats: () => void

  // Rule Violation Actions
  updateTradingRules: (rules: Partial<TradingRules>) => void
  clearViolations: () => void

  // Helper
  clearError: () => void
}

// טוען כללים מ-localStorage או מחזיר ברירת מחדל
const loadTradingRules = (): TradingRules => {
  try {
    const saved = localStorage.getItem(TRADING_RULES_KEY)
    if (saved) {
      return { ...DEFAULT_TRADING_RULES, ...JSON.parse(saved) }
    }
  } catch (e) {
    console.error('Failed to load trading rules:', e)
  }
  return DEFAULT_TRADING_RULES
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  isLoading: false,
  error: null,
  isAutoPlaying: false,
  autoPlaySpeed: 1000, // 1 שנייה ברירת מחדל
  chartFitContent: null,
  chartResetZoom: null,
  chartScrollToTime: null,
  showStats: false,
  showTradeHistory: false,
  showHelp: false,
  currentSaveSlotId: null,
  pricePrecision: 2, // ברירת מחדל 2 ספרות, יתעדכן אוטומטית מהנתונים

  // AI Demo Mode State
  isDemoMode: false,
  demoSpeed: 1, // ברירת מחדל מהירות רגילה
  showDemoExplanations: true, // ברירת מחדל להציג הסברים
  demoStats: {
    tradesExecuted: 0,
    winsCount: 0,
    lossesCount: 0,
    totalPnL: 0,
  },

  // Rule Violation State
  tradingRules: loadTradingRules(),
  ruleViolations: [],

  initializeGame: async (config) => {
    console.log('initializeGame: Starting...', config)
    set({ isLoading: true, error: null })
    try {
      const response = await api.createGame(config)
      console.log('initializeGame: Got response', {
        hasGame: !!response.game,
        candleCount: response.game?.candles?.length,
        currentIndex: response.game?.currentIndex
      })
      set({ gameState: response.game, isLoading: false })
    } catch (error) {
      console.error('initializeGame: Error', error)
      set({
        error: error instanceof Error ? error.message : 'Failed to create game',
        isLoading: false
      })
    }
  },

  initializeGameWithCSV: async (file: File, assetName?: string, timeframe?: string, initialBalance?: number, dateRange?: { start: string; end: string } | null) => {
    console.log('initializeGameWithCSV: Starting with file', file.name, { assetName, timeframe, initialBalance, dateRange })
    set({ isLoading: true, error: null })
    try {
      customToast.info(`מעלה קובץ ${file.name}...`)
      const response = await api.createGameWithCSV(file, assetName, timeframe, initialBalance, dateRange)
      customToast.success(`✅ קובץ נטען בהצלחה! ${response.game.candles.length} נרות`)
      console.log('initializeGameWithCSV: Got response', {
        hasGame: !!response.game,
        candleCount: response.game?.candles?.length,
        currentIndex: response.game?.currentIndex,
        patternsDetected: response.game?.patterns?.length,
        asset: response.game?.asset,
        timeframe: response.game?.timeframe
      })

      // חישוב precision אוטומטי מהנתונים
      const calculatePrecision = (candles: typeof response.game.candles): number => {
        if (!candles || candles.length === 0) return 2
        const sampleCandles = candles.slice(0, Math.min(10, candles.length))
        let maxDecimals = 0

        for (const candle of sampleCandles) {
          const prices = [candle.open, candle.high, candle.low, candle.close]
          for (const price of prices) {
            const priceStr = price.toString()
            const decimalPart = priceStr.split('.')[1]
            if (decimalPart) {
              const significantDecimals = decimalPart.replace(/0+$/, '').length
              maxDecimals = Math.max(maxDecimals, significantDecimals)
            }
          }
        }
        return Math.min(Math.max(maxDecimals, 2), 4)
      }

      const precision = calculatePrecision(response.game.candles)
      console.log(`💎 Calculated price precision: ${precision} decimals`)

      set({ gameState: response.game, isLoading: false, pricePrecision: precision })

      // Auto-fit chart after game loads
      setTimeout(() => {
        const { chartFitContent } = get()
        if (chartFitContent) {
          console.log('📏 Auto-fitting chart after new game load')
          chartFitContent()
        }
      }, 500)
    } catch (error) {
      console.error('initializeGameWithCSV: Error', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload CSV'
      customToast.error(`❌ שגיאה: ${errorMessage}`)
      set({
        error: errorMessage,
        isLoading: false
      })
    }
  },

  nextCandle: async () => {
    const { gameState } = get()
    if (!gameState) return

    // שמירת פוזיציות נוכחיות לפני הקריאה (למקרה של משחק טעון)
    const currentPositions = [...gameState.positions]
    const currentClosedPositions = [...gameState.closedPositions]
    const currentAccount = { ...gameState.account }
    const currentStats = { ...gameState.stats }

    set({ isLoading: true, error: null })
    try {
      const previousClosedCount = gameState.closedPositions.length
      const response = await api.nextCandle(gameState.id)
      const newGame = (response as any).game || response

      /* console.log('🔍 nextCandle response debug:'
        currentIndex: newGame.currentIndex,
        totalCandles: newGame.candles?.length,
        gameId: newGame.id,
        positions: newGame.positions?.length,
        closedPositions: newGame.closedPositions?.length,
        firstCandleTime: newGame.candles?.[0]?.time,
        lastCandleTime: newGame.candles?.[newGame.candles.length - 1]?.time,
      }) */

      // בדיקה אם נסגרו פוזיציות ב-SL/TP (מוצהר מוקדם כדי לשמש גם את הבדיקה למשחק טעון)
      const newClosedCount = newGame.closedPositions.length
      const positionsClosedThisCandle = newClosedCount > previousClosedCount

      // אם יש פוזיציות שנשמרו (משחק טעון), אנחנו צריכים לעדכן את ה-currentPnL שלהן
      // אבל לא לדרוס אותן עם פוזיציות ריקות מהשרת
      // ⚠️ CRITICAL FIX: רק אם לא נסגרו פוזיציות חדשות (SL/TP)
      if (currentPositions.length > 0 && newGame.positions.length === 0 && !positionsClosedThisCandle) {
        console.log('⚠️ Detected loaded game - preserving positions and updating PnL')

        // עדכון PnL של הפוזיציות על בסיס המחיר החדש
        const currentCandle = newGame.candles[newGame.currentIndex]
        const updatedPositions = currentPositions.map(pos => {
          const currentPrice = currentCandle.close
          const priceDiff = currentPrice - pos.entryPrice

          let currentPnL: number
          let currentPnLPercent: number

          if (pos.type === 'long') {
            currentPnL = priceDiff * pos.quantity
            currentPnLPercent = (priceDiff / pos.entryPrice) * 100
          } else {
            currentPnL = -priceDiff * pos.quantity
            currentPnLPercent = (-priceDiff / pos.entryPrice) * 100
          }

          return {
            ...pos,
            currentPnL,
            currentPnLPercent,
          }
        })

        // חישוב unrealized PnL ו-equity
        const totalUnrealizedPnL = updatedPositions.reduce((sum, pos) => sum + pos.currentPnL, 0)
        const totalPositionValue = updatedPositions.reduce((sum, pos) => sum + pos.entryPrice * pos.quantity, 0)

        newGame.positions = updatedPositions
        newGame.closedPositions = currentClosedPositions
        newGame.account = {
          ...currentAccount,
          unrealizedPnL: totalUnrealizedPnL,
          equity: currentAccount.balance + totalPositionValue + totalUnrealizedPnL,
        }
        newGame.stats = currentStats
      }

      // בדיקה אם נסגרו פוזיציות ב-SL/TP
      if (newClosedCount > previousClosedCount) {
        // יש פוזיציות חדשות שנסגרו
        const newlyClosedPositions = newGame.closedPositions.slice(previousClosedCount)

        for (const closedPos of newlyClosedPositions) {
          if (closedPos.exitReason === 'stop_loss') {
            const pnl = closedPos.exitPnL || 0
            customToast.error(`🛑 Stop Loss הופעל! ${pnl.toFixed(2)}$ (${closedPos.exitPnLPercent?.toFixed(2)}%)`, '🛑')
            // שליחת התראה ל-Telegram
            telegramService.notifyStopLoss({
              type: closedPos.type === 'long' ? 'LONG' : 'SHORT',
              entryPrice: closedPos.entryPrice,
              exitPrice: closedPos.exitPrice || 0,
              quantity: closedPos.quantity,
              pnl: pnl,
              pnlPercent: closedPos.exitPnLPercent || 0,
              asset: newGame.asset,
              pricePrecision: get().pricePrecision,
            })
          } else if (closedPos.exitReason === 'take_profit') {
            const pnl = closedPos.exitPnL || 0
            customToast.success(`🎯 Take Profit הופעל! +${pnl.toFixed(2)}$ (+${closedPos.exitPnLPercent?.toFixed(2)}%)`, '🎯')
            // שליחת התראה ל-Telegram
            telegramService.notifyTakeProfit({
              type: closedPos.type === 'long' ? 'LONG' : 'SHORT',
              entryPrice: closedPos.entryPrice,
              exitPrice: closedPos.exitPrice || 0,
              quantity: closedPos.quantity,
              pnl: pnl,
              pnlPercent: closedPos.exitPnLPercent || 0,
              asset: newGame.asset,
              pricePrecision: get().pricePrecision,
            })
          }
        }
      }

      // ✅ שמירת הסכום המעודכן ל-localStorage
      if (newGame.account.equity) {
        localStorage.setItem('carryOverBalance', newGame.account.equity.toString())
      }

      // בדיקת Price Alerts
      const currentCandle = newGame.candles[newGame.currentIndex]
      const previousCandle = newGame.currentIndex > 0 ? newGame.candles[newGame.currentIndex - 1] : null

      if (currentCandle && previousCandle) {
        const triggeredAlerts = priceAlertsService.checkAlerts(currentCandle.close, previousCandle.close)

        for (const alert of triggeredAlerts) {
          const directionText = alert.direction === 'above' ? 'עלה מעל' : 'ירד מתחת'
          customToast.alert(`התראת מחיר! המחיר ${directionText} $${alert.targetPrice.toFixed(2)}`)

          // שליחת התראה ל-Telegram
          telegramService.notifyPriceAlert({
            direction: alert.direction,
            targetPrice: alert.targetPrice,
            currentPrice: currentCandle.close,
            asset: newGame.asset,
            pricePrecision: get().pricePrecision,
          })
        }
      }

      // 🤖 AI Demo Mode: קבלת החלטת AI ביחס לעסקאות
      const { isDemoMode, showDemoExplanations } = get()
      if (isDemoMode && newGame) {
        const aiDecision = makeAIDecision(newGame)
        console.log('🤖 AI Decision:', aiDecision)

        if (aiDecision && aiDecision.action !== 'hold') {
          console.log('🤖 AI Taking Action:', aiDecision.action)
          // הצגת הסבר אם מופעל
          if (showDemoExplanations) {
            customToast.info(`🤖 AI: ${aiDecision.reason}`, '🎯')
          }

          // ביצוע הפעולה שה-AI החליט עליה
          // נעביר את זה לשרת בפעם הבאה שנקרא ל-nextCandle
          // כרגע נשמור את ההחלטה ב-state כדי לבצע אותה אחרי ה-set
          setTimeout(async () => {
            const store = get()
            if (!store.isDemoMode) return

            try {
              if (aiDecision.action === 'close_position' && aiDecision.positionId) {
                // סגירת פוזיציה
                await store.executeTrade('sell', 0, aiDecision.positionId)

                // המתן לעדכון ה-state ואז עדכן סטטיסטיקות
                setTimeout(() => {
                  const updatedStore = get()
                  const closedPos = updatedStore.gameState?.closedPositions[updatedStore.gameState.closedPositions.length - 1]
                  if (closedPos && closedPos.exitPnL !== undefined) {
                    const isWin = closedPos.exitPnL > 0
                    set(state => ({
                      demoStats: {
                        tradesExecuted: state.demoStats.tradesExecuted,
                        winsCount: state.demoStats.winsCount + (isWin ? 1 : 0),
                        lossesCount: state.demoStats.lossesCount + (isWin ? 0 : 1),
                        totalPnL: state.demoStats.totalPnL + closedPos.exitPnL!
                      }
                    }))
                    console.log('🤖 AI Stats Updated (Close):', {
                      isWin,
                      exitPnL: closedPos.exitPnL,
                      newStats: get().demoStats
                    })
                  }
                }, 50)
              } else if (aiDecision.action === 'open_long' || aiDecision.action === 'open_short') {
                // פתיחת פוזיציה
                const positionType = aiDecision.action === 'open_long' ? 'long' : 'short'
                await store.executeTrade(
                  'buy',
                  aiDecision.quantity || 0.01,
                  undefined,
                  positionType,
                  aiDecision.stopLoss,
                  aiDecision.takeProfit
                )

                // עדכון מספר עסקאות מיד אחרי פתיחה
                setTimeout(() => {
                  set(state => ({
                    demoStats: {
                      ...state.demoStats,
                      tradesExecuted: state.demoStats.tradesExecuted + 1
                    }
                  }))
                  console.log('🤖 AI Stats Updated (Open):', {
                    action: aiDecision.action,
                    newTradesCount: get().demoStats.tradesExecuted + 1
                  })
                }, 50)
              }
            } catch (error) {
              console.error('AI Demo Mode: Error executing trade:', error)
            }
          }, 150) // המתנה קצרה כדי שה-state יתעדכן
        }
      }

      // Server returns { game: GameState }, not individual fields
      set({
        gameState: newGame,
        isLoading: false
      })
    } catch (error) {
      customToast.error(`שגיאה: ${error instanceof Error ? error.message : 'Failed to get next candle'}`)
      // ⚠️ CRITICAL: לא מאפסים את gameState בשגיאה
      set({
        error: error instanceof Error ? error.message : 'Failed to get next candle',
        isLoading: false
      })
    }
  },

  jumpToCandle: (targetIndex: number) => {
    const { gameState, chartScrollToTime } = get()
    if (!gameState) return

    // Validate target index
    if (targetIndex < 0 || targetIndex >= gameState.candles.length) {
      customToast.error('אינדקס נר לא חוקי')
      return
    }

    // IMPORTANT: Don't change currentIndex - only move the viewport
    // This allows users to jump to pattern view without losing their progress
    // When they click "Next", they'll continue from where they were

    // Stop auto-play if running
    set({ isAutoPlaying: false })

    // Get target candle time
    const targetTime = gameState.candles[targetIndex].time

    // Scroll the chart to the target time without changing currentIndex
    if (chartScrollToTime) {
      chartScrollToTime(targetTime)
      console.log(`📍 Jumped to candle ${targetIndex} (time: ${targetTime}) - currentIndex remains ${gameState.currentIndex}`)
    }
  },

  executeTrade: async (type, quantity, positionId, positionType, stopLoss, takeProfit, note) => {
    const { gameState, tradingRules, ruleViolations } = get()
    if (!gameState) return

    // 🔍 בדיקת הפרות כללים - רק לעסקאות חדשות (type === 'buy')
    const newViolations: RuleViolation[] = []

    if (type === 'buy') {
      const currentPrice = gameState.candles[gameState.currentIndex].close

      // בדיקה 1: Stop Loss חובה
      if (tradingRules.requireStopLoss && !stopLoss) {
        newViolations.push({
          id: `violation-${Date.now()}-sl`,
          timestamp: Date.now(),
          candleIndex: gameState.currentIndex,
          rule: 'requireStopLoss',
          message: '⛔ נכנסת לעסקה ללא Stop Loss - הפרה קריטית!',
          severity: 'critical',
        })
      }

      // בדיקה 2: Take Profit חובה
      if (tradingRules.requireTakeProfit && !takeProfit) {
        newViolations.push({
          id: `violation-${Date.now()}-tp`,
          timestamp: Date.now(),
          candleIndex: gameState.currentIndex,
          rule: 'requireTakeProfit',
          message: '⚠️ נכנסת לעסקה ללא Take Profit',
          severity: 'warning',
        })
      }

      // בדיקה 3: R:R מינימלי
      if (stopLoss && takeProfit) {
        const slDistance = Math.abs(currentPrice - stopLoss)
        const tpDistance = Math.abs(takeProfit - currentPrice)
        const rrRatio = tpDistance / slDistance

        if (rrRatio < tradingRules.minRRRatio) {
          newViolations.push({
            id: `violation-${Date.now()}-rr`,
            timestamp: Date.now(),
            candleIndex: gameState.currentIndex,
            rule: 'minRRRatio',
            message: `⚠️ R:R נמוך מדי (${rrRatio.toFixed(2)}:1), מינימום נדרש: ${tradingRules.minRRRatio}:1`,
            severity: 'warning',
          })
        }
      }

      // בדיקה 4: Overtrading - מקסימום עסקאות יומיות
      const today = new Date().toDateString()
      const todayTrades = gameState.closedPositions.filter(p => {
        const tradeDate = new Date(p.exitTime! * 1000).toDateString()
        return tradeDate === today
      }).length

      if (todayTrades >= tradingRules.maxDailyTrades) {
        newViolations.push({
          id: `violation-${Date.now()}-daily`,
          timestamp: Date.now(),
          candleIndex: gameState.currentIndex,
          rule: 'maxDailyTrades',
          message: `🛑 עברת את מגבלת העסקאות היומית! (${todayTrades}/${tradingRules.maxDailyTrades})`,
          severity: 'critical',
        })
      }

      // בדיקה 5: רצף הפסדים
      let consecutiveLosses = 0
      for (let i = gameState.closedPositions.length - 1; i >= 0; i--) {
        const pos = gameState.closedPositions[i]
        if ((pos.exitPnL || 0) < 0) {
          consecutiveLosses++
        } else {
          break
        }
      }

      if (consecutiveLosses >= tradingRules.maxConsecutiveLosses) {
        newViolations.push({
          id: `violation-${Date.now()}-streak`,
          timestamp: Date.now(),
          candleIndex: gameState.currentIndex,
          rule: 'maxConsecutiveLosses',
          message: `🚨 ${consecutiveLosses} הפסדים ברצף - מומלץ להפסיק ולנתח!`,
          severity: 'critical',
        })
      }

      // הצגת התראות על הפרות
      if (newViolations.length > 0) {
        newViolations.forEach(v => {
          if (v.severity === 'critical') {
            customToast.error(v.message, '🚫')
          } else {
            customToast.warning(v.message, '⚠️')
          }
        })
      }

      // עדכון state עם ההפרות החדשות
      set({ ruleViolations: [...ruleViolations, ...newViolations] })
    }

    set({ isLoading: true, error: null })
    try {
      const response = await api.trade(gameState.id, { type, quantity, positionId, positionType, stopLoss, takeProfit, note })

      const updatedPositions = type === 'buy'
        ? [...gameState.positions, response.position!]
        : gameState.positions.filter(p => p.id !== positionId)

      const updatedClosedPositions = type === 'sell' && response.closedPosition
        ? [...gameState.closedPositions, response.closedPosition]
        : gameState.closedPositions

      // Toast notifications
      if (type === 'buy' && response.position) {
        const posTypeText = positionType === 'long' ? 'LONG 📈' : 'SHORT 📉'
        customToast.success(`פוזיציית ${posTypeText} נפתחה בהצלחה!`, '✅')
      } else if (type === 'sell' && response.closedPosition) {
        const pnl = response.closedPosition.exitPnL || 0
        const isProfitable = pnl >= 0
        if (isProfitable) {
          customToast.success(`פוזיציה נסגרה ברווח! 💰 +$${pnl.toFixed(2)}`, '🎉')
        } else {
          customToast.error(`פוזיציה נסגרה בהפסד 📉 $${pnl.toFixed(2)}`, '😞')
        }

        // שליחת התראה ל-Telegram על סגירת פוזיציה ידנית
        telegramService.notifyPositionClosed({
          type: response.closedPosition.type === 'long' ? 'LONG' : 'SHORT',
          entryPrice: response.closedPosition.entryPrice,
          exitPrice: response.closedPosition.exitPrice || 0,
          quantity: response.closedPosition.quantity,
          pnl: pnl,
          pnlPercent: response.closedPosition.exitPnLPercent || 0,
          asset: get().gameState?.asset,
          pricePrecision: get().pricePrecision,
        })

        // 📊 עדכון PnL בהפרות שקשורות לעסקה זו (אם יש)
        if (newViolations.length > 0 && response.position) {
          const updatedViolations = get().ruleViolations.map(v => {
            // אם ההפרה נוצרה באותו זמן כמו העסקה הזו
            if (newViolations.some(nv => nv.id === v.id)) {
              return {
                ...v,
                tradePnL: pnl,
                positionId: response.closedPosition!.id,
              }
            }
            return v
          })
          set({ ruleViolations: updatedViolations })

          // אם העסקה הייתה רווחית למרות הפרות - התראה מיוחדת
          if (isProfitable && newViolations.some(v => v.severity === 'critical')) {
            customToast.warning('💰 רווחת למרות הפרת כללים - זה לא מצדיק את ההפרה!', '⚠️')
          }
        }
      }

      // ✅ שמירת הסכום המעודכן ל-localStorage אחרי כל עסקה
      if (response.account.equity) {
        localStorage.setItem('carryOverBalance', response.account.equity.toString())
        console.log('executeTrade: Updated carry-over balance:', response.account.equity)
      }

      set({
        gameState: {
          ...gameState,
          positions: updatedPositions,
          closedPositions: updatedClosedPositions,
          account: response.account,
          feedbackHistory: response.feedback
            ? [...gameState.feedbackHistory, response.feedback]
            : gameState.feedbackHistory,
        },
        isLoading: false
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to execute trade'
      customToast.error(`שגיאה: ${errorMessage}`, '❌')
      // ⚠️ CRITICAL: אסור לאפס את gameState בשגיאה!
      // זה גורם ל-useEffect ב-App.tsx לחשוב שהמשחק אופס ולחזור למסך ההתחלה
      set({
        error: errorMessage,
        isLoading: false,
        // ✅ gameState נשאר כפי שהיה - לא מאפסים אותו!
      })
    }
  },

  createPendingOrder: async (type, targetPrice, quantity, stopLoss, takeProfit, orderType) => {
    const { gameState } = get()
    if (!gameState) return

    set({ isLoading: true, error: null })
    try {
      const response = await api.createPendingOrder(
        gameState.id,
        type,
        targetPrice,
        quantity,
        stopLoss,
        takeProfit,
        orderType
      )

      // עדכון state עם הפקודה החדשה
      const updatedPendingOrders = [...(gameState.pendingOrders || []), response.pendingOrder]

      set({
        gameState: {
          ...gameState,
          pendingOrders: updatedPendingOrders,
          feedbackHistory: response.feedback
            ? [...gameState.feedbackHistory, response.feedback]
            : gameState.feedbackHistory,
        },
        isLoading: false
      })

      customToast.success(`פקודה עתידית ${type === 'long' ? 'LONG' : 'SHORT'} נוצרה! 📌`, '✅')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create pending order'
      customToast.error(`שגיאה: ${errorMessage}`, '❌')
      // ⚠️ CRITICAL: לא מאפסים את gameState בשגיאה
      set({
        error: errorMessage,
        isLoading: false,
      })
    }
  },

  cancelPendingOrder: async (orderId) => {
    const { gameState } = get()
    if (!gameState) return

    set({ isLoading: true, error: null })
    try {
      const response = await api.cancelPendingOrder(gameState.id, orderId)

      // הסרת הפקודה מה-state
      const updatedPendingOrders = gameState.pendingOrders?.filter(o => o.id !== orderId) || []

      set({
        gameState: {
          ...gameState,
          pendingOrders: updatedPendingOrders,
          feedbackHistory: response.feedback
            ? [...gameState.feedbackHistory, response.feedback]
            : gameState.feedbackHistory,
        },
        isLoading: false
      })

      customToast.success('פקודה עתידית בוטלה! 🗑️', '✅')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel pending order'
      customToast.error(`שגיאה: ${errorMessage}`, '❌')
      // ⚠️ CRITICAL: לא מאפסים את gameState בשגיאה
      set({
        error: errorMessage,
        isLoading: false,
      })
    }
  },

  resetGame: async () => {
    const { gameState } = get()

    // שמירת הסכום הסופי ל-localStorage
    if (gameState?.account.equity) {
      localStorage.setItem('carryOverBalance', gameState.account.equity.toString())
      console.log('resetGame: Saved carry-over balance:', gameState.account.equity)
    }

    // איפוס מצב המשחק בלבד - לא יוצר משחק חדש
    set({
      gameState: null,
      isLoading: false,
      error: null,
      isAutoPlaying: false,
      showStats: false,
      currentSaveSlotId: null  // איפוס מזהה ה-slot
    })
  },

  toggleAutoPlay: () => {
    set({ isAutoPlaying: !get().isAutoPlaying })
  },

  setAutoPlaySpeed: (speed: number) => {
    set({ autoPlaySpeed: speed })
  },

  // AI Demo Mode Actions
  toggleDemoMode: () => {
    const { isDemoMode } = get()
    set({
      isDemoMode: !isDemoMode,
      // כשמפעילים AI Demo, מפעילים גם Auto-Play
      isAutoPlaying: !isDemoMode ? true : get().isAutoPlaying
    })
  },

  setDemoSpeed: (speed: number) => {
    set({ demoSpeed: speed })
    // עדכון מהירות Auto-Play בהתאם
    const speedMap: Record<number, number> = {
      0.5: 2000,  // איטי
      1: 1000,    // רגיל
      2: 500,     // מהיר
      5: 200,     // מהיר מאוד
    }
    set({ autoPlaySpeed: speedMap[speed] || 1000 })
  },

  toggleDemoExplanations: () => {
    set({ showDemoExplanations: !get().showDemoExplanations })
  },

  resetDemoStats: () => {
    set({
      demoStats: {
        tradesExecuted: 0,
        winsCount: 0,
        lossesCount: 0,
        totalPnL: 0,
      }
    })
  },

  setChartControls: (fitContent: () => void, resetZoom: () => void, scrollToTime: (time: number) => void) => {
    set({ chartFitContent: fitContent, chartResetZoom: resetZoom, chartScrollToTime: scrollToTime })
  },

  // שמירת מצב משחק נוכחי ל-localStorage
  saveGameState: () => {
    const { gameState, saveToSlot, currentSaveSlotId } = get()
    if (!gameState) {
      console.warn('saveGameState: No game state to save')
      return
    }

    // שמירה למשבצת הנוכחית או למשבצת חדשה
    const slotId = saveToSlot(currentSaveSlotId || undefined, undefined)

    if (slotId) {
      // עדכון currentSaveSlotId כדי שנשמור לאותה משבצת בפעם הבאה
      set({ currentSaveSlotId: slotId })

      console.log('✅ Game state saved to slot:', {
        slotId,
        file: gameState.sourceFileName,
        index: gameState.currentIndex,
        positions: gameState.positions.length,
        pendingOrders: gameState.pendingOrders?.length || 0,
        balance: gameState.account.balance,
        equity: gameState.account.equity,
      })

      // Toast will be shown by saveToSlot() - no need to show it here too
    } else {
      customToast.error('שגיאה בשמירת המשחק')
    }
  },

  // שמירה ויציאה - שומר את המשחק ומציג סטטיסטיקות
  saveAndExit: () => {
    const { saveGameState } = get()
    saveGameState()

    // עצירת Auto-Play אם פעיל
    set({ isAutoPlaying: false })

    // המתנה קצרה כדי שה-toast יופיע ואז הצגת סטטיסטיקות
    setTimeout(() => {
      set({ showStats: true })
    }, 500)
  },

  // טעינת משחק שמור (אם תואם לקובץ ולטווח)
  loadSavedGame: async (file: File, dateRange?: { start: string; end: string } | null) => {
    const savedStateStr = localStorage.getItem(SAVED_GAME_KEY)
    if (!savedStateStr) {
      console.log('loadSavedGame: No saved game found')
      return false
    }

    try {
      const savedState: SavedGameState = JSON.parse(savedStateStr)

      // בדיקה אם הקובץ והטווח תואמים
      const fileMatches = savedState.sourceFileName === file.name
      const dateRangeMatches = dateRange
        ? savedState.sourceDateRange.start === dateRange.start &&
          savedState.sourceDateRange.end === dateRange.end
        : true

      if (!fileMatches || !dateRangeMatches) {
        console.log('loadSavedGame: File or date range mismatch', {
          savedFile: savedState.sourceFileName,
          currentFile: file.name,
          savedRange: savedState.sourceDateRange,
          currentRange: dateRange,
        })
        return false
      }

      console.log('✅ Found matching saved game:', {
        file: savedState.sourceFileName,
        savedAt: new Date(savedState.savedAt).toLocaleString('he-IL'),
        index: savedState.currentIndex,
        positions: savedState.positions.length,
      })

      // יצירת משחק חדש מהקובץ עם האינדקס השמור
      set({ isLoading: true })

      const response = await api.createGameWithCSV(
        file,
        savedState.asset,
        savedState.timeframe,
        savedState.account.initialBalance,
        dateRange,
        savedState.currentIndex, // שליחת האינדקס השמור לשרת
        {
          // שליחת המצב השמור לשרת כדי שישחזר אותו
          positions: savedState.positions,
          closedPositions: savedState.closedPositions,
          pendingOrders: savedState.pendingOrders || [],
          account: savedState.account,
          stats: savedState.stats,
          feedbackHistory: savedState.feedbackHistory,
        }
      )

      console.log('🔍 loadSavedGame: Server response:', {
        totalCandles: response.game.candles?.length,
        currentIndex: response.game.currentIndex,
        gameId: response.game.id,
        positions: response.game.positions.length,
        pendingOrders: response.game.pendingOrders?.length || 0,
        firstCandleTime: response.game.candles?.[0]?.time,
        lastCandleTime: response.game.candles?.[response.game.candles.length - 1]?.time,
      })

      // השרת כבר שיחזר את כל המידע, אז פשוט נשתמש בו
      const restoredGame: GameState = {
        ...response.game,
      }

      console.log('✅ Restored game state:', {
        gameId: restoredGame.id,
        asset: restoredGame.asset,
        timeframe: restoredGame.timeframe,
        currentIndex: restoredGame.currentIndex,
        totalCandles: restoredGame.candles?.length,
        positions: restoredGame.positions.length,
        pendingOrders: restoredGame.pendingOrders?.length || 0,
        balance: restoredGame.account.balance,
        equity: restoredGame.account.equity,
      })

      set({
        gameState: restoredGame,
        isLoading: false,
        error: null
      })

      // קריאה ל-chartFitContent אחרי טעינה - צריך יותר זמן
      // קוראים פעמיים כדי לוודא שהווליום מתאים נכון
      setTimeout(() => {
        const { chartFitContent } = get()
        if (chartFitContent) {
          console.log('📏 Auto-fitting chart after loading saved game (first call)')
          chartFitContent()
        }
      }, 500)

      // קריאה שנייה לאחר 1.5 שניות כדי לוודא שהווליום התאים
      setTimeout(() => {
        const { chartFitContent } = get()
        if (chartFitContent) {
          console.log('📏 Auto-fitting chart after loading saved game (second call for volume fix)')
          chartFitContent()
        }
      }, 1500)

      customToast.success(`משחק שוחזר מ-${new Date(savedState.savedAt).toLocaleString('he-IL')} 🎮`, '📂')

      return true
    } catch (error) {
      console.error('loadSavedGame error:', error)
      set({ isLoading: false })
      return false
    }
  },

  // קבלת מידע על משחק שמור
  getSavedGameInfo: () => {
    const savedStateStr = localStorage.getItem(SAVED_GAME_KEY)
    if (!savedStateStr) return null

    try {
      return JSON.parse(savedStateStr) as SavedGameState
    } catch (error) {
      console.error('getSavedGameInfo error:', error)
      return null
    }
  },

  // מחיקת משחק שמור
  clearSavedGame: () => {
    localStorage.removeItem(SAVED_GAME_KEY)

    // מחיקת כל הקווים השרטוטיים (מכל המשחקים)
    const keys = Object.keys(localStorage)
    keys.forEach(key => {
      if (key.startsWith('trading-game-drawings-')) {
        localStorage.removeItem(key)
      }
    })

    console.log('Saved game and all drawings cleared')
    customToast.success('משחק שמור נמחק')
  },

  // עדכון פוזיציה קיימת
  updatePosition: async (positionId: string, updates: { stopLoss?: number; takeProfit?: number }) => {
    const { gameState } = get()
    if (!gameState) return

    set({ isLoading: true, error: null })
    try {
      const response = await api.updatePosition(gameState.id, positionId, updates)

      // עדכון הפוזיציה במצב
      const updatedPositions = gameState.positions.map(p =>
        p.id === positionId ? response.position : p
      )

      set({
        gameState: {
          ...gameState,
          positions: updatedPositions,
          feedbackHistory: response.feedback
            ? [...gameState.feedbackHistory, response.feedback]
            : gameState.feedbackHistory,
        },
        isLoading: false
      })

      customToast.success('פוזיציה עודכנה בהצלחה! ✏️')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update position'
      set({ error: errorMessage, isLoading: false })
      customToast.error(`שגיאה: ${errorMessage}`)
    }
  },

  // עדכון פקודה עתידית
  updatePendingOrder: async (
    orderId: string,
    updates: { targetPrice?: number; quantity?: number; stopLoss?: number; takeProfit?: number }
  ) => {
    const { gameState } = get()
    if (!gameState) return

    set({ isLoading: true, error: null })
    try {
      const response = await api.updatePendingOrder(gameState.id, orderId, updates)

      // עדכון הפקודה במצב
      const updatedOrders = gameState.pendingOrders?.map(o =>
        o.id === orderId ? response.pendingOrder : o
      ) || []

      set({
        gameState: {
          ...gameState,
          pendingOrders: updatedOrders,
          feedbackHistory: response.feedback
            ? [...gameState.feedbackHistory, response.feedback]
            : gameState.feedbackHistory,
        },
        isLoading: false
      })

      customToast.success('פקודה עתידית עודכנה בהצלחה! ✏️')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update pending order'
      set({ error: errorMessage, isLoading: false })
      customToast.error(`שגיאה: ${errorMessage}`)
    }
  },

  toggleTradeHistory: () => set((state) => ({ showTradeHistory: !state.showTradeHistory })),
  toggleHelp: () => set((state) => ({ showHelp: !state.showHelp })),

  // Rule Violation Actions
  updateTradingRules: (rules: Partial<TradingRules>) => {
    const newRules = { ...get().tradingRules, ...rules }
    set({ tradingRules: newRules })
    // שמירה ל-localStorage
    localStorage.setItem(TRADING_RULES_KEY, JSON.stringify(newRules))
    console.log('📜 Trading rules updated:', newRules)
  },

  clearViolations: () => {
    set({ ruleViolations: [] })
    console.log('🧹 All violations cleared')
  },

  // ============ Multi-Save System ============

  // יצירת file key ייחודי מקובץ ו-date range
  _getFileKey: (fileName: string, dateRange?: { start: string; end: string } | null): string => {
    const cleanName = fileName.replace(/\.[^.]+$/, '') // הסרת סיומת
    if (dateRange) {
      return `${cleanName}_${dateRange.start}_${dateRange.end}`
    }
    return cleanName
  },

  // טעינת כל ה-save slots לקובץ מסוים
  getAllSaveSlots: (fileName: string, dateRange?: { start: string; end: string } | null) => {
    const fileKey = get()._getFileKey(fileName, dateRange)
    const containerStr = localStorage.getItem(MULTI_SAVE_KEY)

    if (!containerStr) {
      console.log(`No multi-saves found for key: ${fileKey}`)
      return []
    }

    try {
      const container = JSON.parse(containerStr) as import('@/types/game.types').SavedGamesContainer
      return container[fileKey] || []
    } catch (error) {
      console.error('getAllSaveSlots error:', error)
      return []
    }
  },

  // שמירת משחק ל-slot חדש או קיים
  saveToSlot: (slotId?: string, slotName?: string) => {
    const { gameState } = get()
    if (!gameState) {
      console.warn('saveToSlot: No game state to save')
      return null
    }

    const fileKey = get()._getFileKey(
      gameState.sourceFileName || '',
      gameState.sourceDateRange
    )

    // יצירת saved state
    const savedState: import('@/types/game.types').SavedGameState = {
      gameId: gameState.id,
      savedAt: Date.now(),
      sourceFileName: gameState.sourceFileName || '',
      sourceDateRange: gameState.sourceDateRange || { start: '', end: '' },
      asset: gameState.asset,
      timeframe: gameState.timeframe,
      currentIndex: gameState.currentIndex,
      account: gameState.account,
      positions: gameState.positions,
      closedPositions: gameState.closedPositions,
      stats: gameState.stats,
      feedbackHistory: gameState.feedbackHistory,
      isComplete: gameState.isComplete,
      priceStep: gameState.priceStep,
      pendingOrders: gameState.pendingOrders,
    }

    // טעינת container קיים או יצירת חדש
    const containerStr = localStorage.getItem(MULTI_SAVE_KEY)
    const container: import('@/types/game.types').SavedGamesContainer = containerStr
      ? JSON.parse(containerStr)
      : {}

    // קבלת slots קיימים לקובץ זה
    const existingSlots = container[fileKey] || []

    // אם slotId לא סופק, צור חדש
    const finalSlotId = slotId || `slot-${Date.now()}`
    const finalSlotName = slotName || `משחק ${existingSlots.length + 1}`

    // בדוק אם זה עדכון של slot קיים או חדש
    const existingSlotIndex = existingSlots.findIndex(s => s.slotId === finalSlotId)

    const newSlot: import('@/types/game.types').SaveSlot = {
      slotId: finalSlotId,
      slotName: finalSlotName,
      savedAt: Date.now(),
      gameState: savedState,
    }

    if (existingSlotIndex >= 0) {
      // עדכון slot קיים
      existingSlots[existingSlotIndex] = newSlot
      console.log(`✏️ Updated existing slot: ${finalSlotName}`)
    } else {
      // הוספת slot חדש
      existingSlots.push(newSlot)
      console.log(`➕ Created new slot: ${finalSlotName}`)
    }

    // שמירה חזרה ל-localStorage
    container[fileKey] = existingSlots
    localStorage.setItem(MULTI_SAVE_KEY, JSON.stringify(container))

    customToast.success(`נשמר בהצלחה: ${finalSlotName} 💾`, '✅')

    return finalSlotId
  },

  // טעינת משחק מ-slot מסוים
  loadFromSlot: async (file: File, slotId: string, dateRange?: { start: string; end: string } | null) => {
    const slots = get().getAllSaveSlots(file.name, dateRange)

    const slot = slots.find((s: import('@/types/game.types').SaveSlot) => s.slotId === slotId)
    if (!slot) {
      customToast.error('משחק שמור לא נמצא')
      return false
    }

    set({ isLoading: true })

    try {
      const savedState = slot.gameState

      // קריאה לשרת ליצירת משחק עם המצב השמור
      const response = await api.createGameWithCSV(
        file,
        savedState.asset,
        savedState.timeframe,
        savedState.account.initialBalance,
        dateRange,
        savedState.currentIndex,
        {
          positions: savedState.positions,
          closedPositions: savedState.closedPositions,
          pendingOrders: savedState.pendingOrders || [],
          account: savedState.account,
          stats: savedState.stats,
          feedbackHistory: savedState.feedbackHistory,
        }
      )

      const restoredGame: import('@/types/game.types').GameState = {
        ...response.game,
      }

      set({
        gameState: restoredGame,
        isLoading: false,
        error: null,
        currentSaveSlotId: slotId // שמירת מזהה ה-slot כדי שנשמור לאותו slot בפעם הבאה
      })

      // Auto-fit chart
      setTimeout(() => {
        const { chartFitContent } = get()
        chartFitContent?.()
      }, 500)

      setTimeout(() => {
        const { chartFitContent } = get()
        chartFitContent?.()
      }, 1500)

      customToast.success(`משחק "${slot.slotName}" נטען בהצלחה! 🎮`, '📂')

      return true
    } catch (error) {
      console.error('loadFromSlot error:', error)
      set({ isLoading: false })
      customToast.error('שגיאה בטעינת משחק')
      return false
    }
  },

  // מחיקת slot
  deleteSlot: (fileName: string, slotId: string, dateRange?: { start: string; end: string } | null) => {
    const fileKey = get()._getFileKey(fileName, dateRange)
    const containerStr = localStorage.getItem(MULTI_SAVE_KEY)

    if (!containerStr) return

    try {
      const container: import('@/types/game.types').SavedGamesContainer = JSON.parse(containerStr)
      const slots = container[fileKey] || []

      const updatedSlots = slots.filter(s => s.slotId !== slotId)

      if (updatedSlots.length === 0) {
        // אם אין יותר slots, מחק את ה-fileKey
        delete container[fileKey]
      } else {
        container[fileKey] = updatedSlots
      }

      localStorage.setItem(MULTI_SAVE_KEY, JSON.stringify(container))
      customToast.success('משחק שמור נמחק')

      console.log(`🗑️ Deleted slot ${slotId} from ${fileKey}`)
    } catch (error) {
      console.error('deleteSlot error:', error)
      customToast.error('שגיאה במחיקת משחק')
    }
  },

  // שינוי שם של slot
  renameSlot: (fileName: string, slotId: string, newName: string, dateRange?: { start: string; end: string } | null) => {
    const fileKey = get()._getFileKey(fileName, dateRange)
    const containerStr = localStorage.getItem(MULTI_SAVE_KEY)

    if (!containerStr) return

    try {
      const container: import('@/types/game.types').SavedGamesContainer = JSON.parse(containerStr)
      const slots = container[fileKey] || []

      const slotIndex = slots.findIndex(s => s.slotId === slotId)
      if (slotIndex >= 0) {
        slots[slotIndex].slotName = newName
        container[fileKey] = slots
        localStorage.setItem(MULTI_SAVE_KEY, JSON.stringify(container))

        customToast.success('שם שונה בהצלחה')
        console.log(`✏️ Renamed slot ${slotId} to "${newName}"`)
      }
    } catch (error) {
      console.error('renameSlot error:', error)
      customToast.error('שגיאה בשינוי שם')
    }
  },

  clearError: () => set({ error: null }),
}))

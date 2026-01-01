import { create } from 'zustand'
import type { GameState, SavedGameState } from '@/types/game.types'
import { api } from '@/services/api'
import toast from 'react-hot-toast'
import { telegramService } from '@/services/telegramNotifications'
import { priceAlertsService } from '@/services/priceAlertsService'

// שם המפתח ב-localStorage
const SAVED_GAME_KEY = 'savedGameState'

interface GameStore {
  gameState: GameState | null
  isLoading: boolean
  error: string | null
  isAutoPlaying: boolean
  autoPlaySpeed: number // מילישניות בין נרות
  chartFitContent: (() => void) | null
  chartResetZoom: (() => void) | null
  showStats: boolean // הצגת מסך סטטיסטיקות (למשל בשמירה ויציאה)
  showTradeHistory: boolean // הצגת מסך היסטוריית עסקאות

  // Actions
  initializeGame: (config?: { initialBalance?: number }) => Promise<void>
  initializeGameWithCSV: (file: File, assetName?: string, timeframe?: string, initialBalance?: number, dateRange?: { start: string; end: string } | null) => Promise<void>
  nextCandle: () => Promise<void>
  executeTrade: (
    type: 'buy' | 'sell',
    quantity: number,
    positionId?: string,
    positionType?: 'long' | 'short',
    stopLoss?: number,
    takeProfit?: number
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
  setChartControls: (fitContent: () => void, resetZoom: () => void) => void

  // Save/Load game state
  saveGameState: () => void
  saveAndExit: () => void
  loadSavedGame: (file: File, dateRange?: { start: string; end: string } | null) => Promise<boolean>
  getSavedGameInfo: () => SavedGameState | null
  clearSavedGame: () => void

  // UI State
  toggleTradeHistory: () => void

  // Helper
  clearError: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  isLoading: false,
  error: null,
  isAutoPlaying: false,
  autoPlaySpeed: 1000, // 1 שנייה ברירת מחדל
  chartFitContent: null,
  chartResetZoom: null,
  showStats: false,
  showTradeHistory: false,

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
      toast.loading(`מעלה קובץ ${file.name}...`, { id: 'upload' })
      const response = await api.createGameWithCSV(file, assetName, timeframe, initialBalance, dateRange)
      toast.success(`✅ קובץ נטען בהצלחה! ${response.game.candles.length} נרות`, { id: 'upload' })
      console.log('initializeGameWithCSV: Got response', {
        hasGame: !!response.game,
        candleCount: response.game?.candles?.length,
        currentIndex: response.game?.currentIndex,
        patternsDetected: response.game?.patterns?.length,
        asset: response.game?.asset,
        timeframe: response.game?.timeframe
      })
      set({ gameState: response.game, isLoading: false })

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
      toast.error(`❌ שגיאה: ${errorMessage}`, { id: 'upload' })
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

      console.log('🔍 nextCandle response debug:', {
        currentIndex: newGame.currentIndex,
        totalCandles: newGame.candles?.length,
        gameId: newGame.id,
        positions: newGame.positions?.length,
        closedPositions: newGame.closedPositions?.length,
        firstCandleTime: newGame.candles?.[0]?.time,
        lastCandleTime: newGame.candles?.[newGame.candles.length - 1]?.time,
      })

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
            toast.error(`🛑 Stop Loss הופעל! ${pnl.toFixed(2)}$ (${closedPos.exitPnLPercent?.toFixed(2)}%)`, {
              icon: '🛑',
              duration: 4000,
            })
            // שליחת התראה ל-Telegram
            telegramService.notifyStopLoss({
              type: closedPos.type === 'long' ? 'LONG' : 'SHORT',
              entryPrice: closedPos.entryPrice,
              exitPrice: closedPos.exitPrice || 0,
              quantity: closedPos.quantity,
              pnl: pnl,
              pnlPercent: closedPos.exitPnLPercent || 0,
              asset: newGame.asset,
            })
          } else if (closedPos.exitReason === 'take_profit') {
            const pnl = closedPos.exitPnL || 0
            toast.success(`🎯 Take Profit הופעל! +${pnl.toFixed(2)}$ (+${closedPos.exitPnLPercent?.toFixed(2)}%)`, {
              icon: '🎯',
              duration: 4000,
            })
            // שליחת התראה ל-Telegram
            telegramService.notifyTakeProfit({
              type: closedPos.type === 'long' ? 'LONG' : 'SHORT',
              entryPrice: closedPos.entryPrice,
              exitPrice: closedPos.exitPrice || 0,
              quantity: closedPos.quantity,
              pnl: pnl,
              pnlPercent: closedPos.exitPnLPercent || 0,
              asset: newGame.asset,
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
          toast.success(`🔔 התראת מחיר! המחיר ${directionText} $${alert.targetPrice.toFixed(2)}`, {
            icon: '🔔',
            duration: 5000,
          })

          // שליחת התראה ל-Telegram
          telegramService.notifyPriceAlert({
            direction: alert.direction,
            targetPrice: alert.targetPrice,
            currentPrice: currentCandle.close,
            asset: newGame.asset,
          })
        }
      }

      // Server returns { game: GameState }, not individual fields
      set({
        gameState: newGame,
        isLoading: false
      })
    } catch (error) {
      toast.error(`שגיאה: ${error instanceof Error ? error.message : 'Failed to get next candle'}`, {
        icon: '❌',
      })
      // ⚠️ CRITICAL: לא מאפסים את gameState בשגיאה
      set({
        error: error instanceof Error ? error.message : 'Failed to get next candle',
        isLoading: false
      })
    }
  },

  executeTrade: async (type, quantity, positionId, positionType, stopLoss, takeProfit) => {
    const { gameState } = get()
    if (!gameState) return

    set({ isLoading: true, error: null })
    try {
      const response = await api.trade(gameState.id, { type, quantity, positionId, positionType, stopLoss, takeProfit })

      const updatedPositions = type === 'buy'
        ? [...gameState.positions, response.position!]
        : gameState.positions.filter(p => p.id !== positionId)

      const updatedClosedPositions = type === 'sell' && response.closedPosition
        ? [...gameState.closedPositions, response.closedPosition]
        : gameState.closedPositions

      // Toast notifications
      if (type === 'buy' && response.position) {
        const posTypeText = positionType === 'long' ? 'LONG 📈' : 'SHORT 📉'
        toast.success(`פוזיציית ${posTypeText} נפתחה בהצלחה!`, {
          icon: '✅',
        })
      } else if (type === 'sell' && response.closedPosition) {
        const pnl = response.closedPosition.exitPnL || 0
        const isProfitable = pnl >= 0
        if (isProfitable) {
          toast.success(`פוזיציה נסגרה ברווח! 💰 +$${pnl.toFixed(2)}`, {
            icon: '🎉',
          })
        } else {
          toast.error(`פוזיציה נסגרה בהפסד 📉 $${pnl.toFixed(2)}`, {
            icon: '😞',
          })
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
        })
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
      toast.error(`שגיאה: ${errorMessage}`, {
        icon: '❌',
      })
      // ⚠️ CRITICAL: אסור לאפס את gameState בשגיאה!
      // זה גורם ל-useEffect ב-App.tsx לחשוב שהמשחק אופס ולחזור למסך ההתחלה
      set({
        error: errorMessage,
        isLoading: false
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

      toast.success(`פקודה עתידית ${type === 'long' ? 'LONG' : 'SHORT'} נוצרה! 📌`, {
        icon: '✅',
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create pending order'
      toast.error(`שגיאה: ${errorMessage}`, {
        icon: '❌',
      })
      // ⚠️ CRITICAL: לא מאפסים את gameState בשגיאה
      set({
        error: errorMessage,
        isLoading: false
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

      toast.success('פקודה עתידית בוטלה! 🗑️', {
        icon: '✅',
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel pending order'
      toast.error(`שגיאה: ${errorMessage}`, {
        icon: '❌',
      })
      // ⚠️ CRITICAL: לא מאפסים את gameState בשגיאה
      set({
        error: errorMessage,
        isLoading: false
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
    set({ gameState: null, isLoading: false, error: null, isAutoPlaying: false, showStats: false })
  },

  toggleAutoPlay: () => {
    set({ isAutoPlaying: !get().isAutoPlaying })
  },

  setAutoPlaySpeed: (speed: number) => {
    set({ autoPlaySpeed: speed })
  },

  setChartControls: (fitContent: () => void, resetZoom: () => void) => {
    set({ chartFitContent: fitContent, chartResetZoom: resetZoom })
  },

  // שמירת מצב משחק נוכחי ל-localStorage
  saveGameState: () => {
    const { gameState } = get()
    if (!gameState) {
      console.warn('saveGameState: No game state to save')
      return
    }

    const savedState: SavedGameState = {
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

    localStorage.setItem(SAVED_GAME_KEY, JSON.stringify(savedState))
    console.log('✅ Game state saved:', {
      file: savedState.sourceFileName,
      index: savedState.currentIndex,
      positions: savedState.positions.length,
      pendingOrders: savedState.pendingOrders?.length || 0,
      balance: savedState.account.balance,
      equity: savedState.account.equity,
    })

    toast.success('משחק נשמר בהצלחה! 💾', {
      duration: 3000,
      icon: '✅',
    })
  },

  // שמירה ויציאה - שומר את המשחק ומציג סטטיסטיקות
  saveAndExit: () => {
    const { saveGameState } = get()
    saveGameState()

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

      toast.success(`משחק שוחזר מ-${new Date(savedState.savedAt).toLocaleString('he-IL')} 🎮`, {
        duration: 5000,
        icon: '📂',
      })

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
    toast.success('משחק שמור נמחק', { icon: '🗑️' })
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

      toast.success('פוזיציה עודכנה בהצלחה! ✏️', { icon: '✅' })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update position'
      set({ error: errorMessage, isLoading: false })
      toast.error(`שגיאה: ${errorMessage}`, { icon: '❌' })
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

      toast.success('פקודה עתידית עודכנה בהצלחה! ✏️', { icon: '✅' })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update pending order'
      set({ error: errorMessage, isLoading: false })
      toast.error(`שגיאה: ${errorMessage}`, { icon: '❌' })
    }
  },

  toggleTradeHistory: () => set((state) => ({ showTradeHistory: !state.showTradeHistory })),

  clearError: () => set({ error: null }),
}))

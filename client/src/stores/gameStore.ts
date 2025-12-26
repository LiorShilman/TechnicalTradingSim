import { create } from 'zustand'
import type { GameState } from '@/types/game.types'
import { api } from '@/services/api'
import toast from 'react-hot-toast'

interface GameStore {
  gameState: GameState | null
  isLoading: boolean
  error: string | null
  isAutoPlaying: boolean
  autoPlaySpeed: number // מילישניות בין נרות
  chartFitContent: (() => void) | null
  chartResetZoom: (() => void) | null

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
  resetGame: () => Promise<void>
  toggleAutoPlay: () => void
  setAutoPlaySpeed: (speed: number) => void
  setChartControls: (fitContent: () => void, resetZoom: () => void) => void

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

    set({ isLoading: true, error: null })
    try {
      const previousClosedCount = gameState.closedPositions.length
      const response = await api.nextCandle(gameState.id)
      const newGame = (response as any).game || response

      // בדיקה אם נסגרו פוזיציות ב-SL/TP
      const newClosedCount = newGame.closedPositions.length
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
          } else if (closedPos.exitReason === 'take_profit') {
            const pnl = closedPos.exitPnL || 0
            toast.success(`🎯 Take Profit הופעל! +${pnl.toFixed(2)}$ (+${closedPos.exitPnLPercent?.toFixed(2)}%)`, {
              icon: '🎯',
              duration: 4000,
            })
          }
        }
      }

      // ✅ שמירת הסכום המעודכן ל-localStorage
      if (newGame.account.equity) {
        localStorage.setItem('carryOverBalance', newGame.account.equity.toString())
      }

      // Server returns { game: GameState }, not individual fields
      set({
        gameState: newGame,
        isLoading: false
      })
    } catch (error) {
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
    set({ gameState: null, isLoading: false, error: null, isAutoPlaying: false })
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

  clearError: () => set({ error: null }),
}))

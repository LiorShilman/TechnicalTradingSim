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

  // Actions
  initializeGame: () => Promise<void>
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

  // Helper
  clearError: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  isLoading: false,
  error: null,
  isAutoPlaying: false,
  autoPlaySpeed: 1000, // 1 שנייה ברירת מחדל

  initializeGame: async () => {
    console.log('initializeGame: Starting...')
    set({ isLoading: true, error: null })
    try {
      const response = await api.createGame()
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
    set({ gameState: null, isLoading: false, error: null, isAutoPlaying: false })
    await get().initializeGame()
  },

  toggleAutoPlay: () => {
    set({ isAutoPlaying: !get().isAutoPlaying })
  },

  setAutoPlaySpeed: (speed: number) => {
    set({ autoPlaySpeed: speed })
  },

  clearError: () => set({ error: null }),
}))

import { create } from 'zustand'
import type { GameState } from '@/types/game.types'
import { api } from '@/services/api'

interface GameStore {
  gameState: GameState | null
  isLoading: boolean
  error: string | null
  
  // Actions
  initializeGame: () => Promise<void>
  nextCandle: () => Promise<void>
  executeTrade: (type: 'buy' | 'sell', quantity: number, positionId?: string) => Promise<void>
  resetGame: () => Promise<void>
  
  // Helper
  clearError: () => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  gameState: null,
  isLoading: false,
  error: null,

  initializeGame: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await api.createGame()
      set({ gameState: response.game, isLoading: false })
    } catch (error) {
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
      const response = await api.nextCandle(gameState.id)
      
      set({ 
        gameState: {
          ...gameState,
          candles: [...gameState.candles, response.candle],
          currentIndex: response.currentIndex,
          positions: response.positions,
          account: response.account,
          isComplete: response.isComplete,
          feedbackHistory: response.feedback 
            ? [...gameState.feedbackHistory, response.feedback]
            : gameState.feedbackHistory,
        },
        isLoading: false 
      })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to get next candle',
        isLoading: false 
      })
    }
  },

  executeTrade: async (type, quantity, positionId) => {
    const { gameState } = get()
    if (!gameState) return

    set({ isLoading: true, error: null })
    try {
      const response = await api.trade(gameState.id, { type, quantity, positionId })
      
      const updatedPositions = type === 'buy'
        ? [...gameState.positions, response.position!]
        : gameState.positions.filter(p => p.id !== positionId)

      const updatedClosedPositions = type === 'sell' && response.closedPosition
        ? [...gameState.closedPositions, response.closedPosition]
        : gameState.closedPositions

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
      set({ 
        error: error instanceof Error ? error.message : 'Failed to execute trade',
        isLoading: false 
      })
    }
  },

  resetGame: async () => {
    set({ gameState: null, isLoading: false, error: null })
    await get().initializeGame()
  },

  clearError: () => set({ error: null }),
}))

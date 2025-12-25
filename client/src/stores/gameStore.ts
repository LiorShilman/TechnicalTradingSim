import { create } from 'zustand'
import type { GameState } from '@/types/game.types'
import { api } from '@/services/api'

interface GameStore {
  gameState: GameState | null
  isLoading: boolean
  error: string | null
  isAutoPlaying: boolean
  autoPlaySpeed: number // מילישניות בין נרות

  // Actions
  initializeGame: () => Promise<void>
  nextCandle: () => Promise<void>
  executeTrade: (type: 'buy' | 'sell', quantity: number, positionId?: string, positionType?: 'long' | 'short') => Promise<void>
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
      const response = await api.nextCandle(gameState.id)

      // Server returns { game: GameState }, not individual fields
      set({
        gameState: (response as any).game || response,
        isLoading: false
      })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to get next candle',
        isLoading: false
      })
    }
  },

  executeTrade: async (type, quantity, positionId, positionType) => {
    const { gameState } = get()
    if (!gameState) return

    set({ isLoading: true, error: null })
    try {
      const response = await api.trade(gameState.id, { type, quantity, positionId, positionType })
      
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

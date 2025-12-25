import axios from 'axios'
import type {
  NewGameResponse,
  NextCandleResponse,
  TradeRequest,
  TradeResponse,
  CreateGameRequest,
} from '@/types/game.types'

const BASE_URL = '/api'

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Error interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message)
    }
    throw new Error('An unexpected error occurred')
  }
)

export const api = {
  /**
   * יצירת משחק חדש
   */
  createGame: async (config?: CreateGameRequest): Promise<NewGameResponse> => {
    const response = await apiClient.post<NewGameResponse>('/game/new', config)
    return response.data
  },

  /**
   * קבלת נר הבא
   */
  nextCandle: async (gameId: string): Promise<NextCandleResponse> => {
    const response = await apiClient.post<NextCandleResponse>(`/game/${gameId}/next`)
    return response.data
  },

  /**
   * ביצוע מסחר
   */
  trade: async (gameId: string, request: TradeRequest): Promise<TradeResponse> => {
    const response = await apiClient.post<TradeResponse>(`/game/${gameId}/trade`, request)
    return response.data
  },

  /**
   * קבלת מצב משחק נוכחי
   */
  getGameState: async (gameId: string): Promise<NewGameResponse> => {
    const response = await apiClient.get<NewGameResponse>(`/game/${gameId}`)
    return response.data
  },
}

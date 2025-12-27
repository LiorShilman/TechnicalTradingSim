import axios from 'axios'
import type {
  NewGameResponse,
  NextCandleResponse,
  TradeRequest,
  TradeResponse,
  CreateGameRequest,
  PendingOrderType,
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
   * יצירת משחק חדש מקובץ CSV
   */
  createGameWithCSV: async (file: File, assetName?: string, timeframe?: string, initialBalance?: number, dateRange?: { start: string; end: string } | null, startIndex?: number): Promise<NewGameResponse> => {
    const formData = new FormData()
    formData.append('csvFile', file)
    if (assetName) {
      formData.append('assetName', assetName)
    }
    if (timeframe) {
      formData.append('timeframe', timeframe)
    }
    if (initialBalance !== undefined) {
      formData.append('initialBalance', initialBalance.toString())
    }
    if (startIndex !== undefined) {
      formData.append('startIndex', startIndex.toString())
    }
    if (dateRange) {
      formData.append('startDate', dateRange.start)
      formData.append('endDate', dateRange.end)
    }

    const response = await apiClient.post<NewGameResponse>('/game/upload-csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
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

  /**
   * יצירת פקודה עתידית
   */
  createPendingOrder: async (
    gameId: string,
    type: 'long' | 'short',
    targetPrice: number,
    quantity: number,
    stopLoss?: number,
    takeProfit?: number,
    orderType?: PendingOrderType
  ): Promise<{ pendingOrder: any; feedback: any }> => {
    const response = await apiClient.post(`/game/${gameId}/pending-order`, {
      type,
      targetPrice,
      quantity,
      stopLoss,
      takeProfit,
      orderType,
    })
    return response.data
  },
}

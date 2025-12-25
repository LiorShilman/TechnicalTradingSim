// Same types as client for consistency
// Copy from client/src/types/game.types.ts

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type PatternType = 'breakout' | 'retest' | 'flag'

export interface Pattern {
  type: PatternType
  startIndex: number
  endIndex: number
  expectedEntry: number
  expectedExit: number
  stopLoss: number
  metadata: {
    quality: number
    description: string
    hint?: string
  }
}

export type PositionType = 'long' | 'short'

export interface Position {
  id: string
  type: PositionType
  entryPrice: number
  entryTime: number
  entryIndex: number
  quantity: number
  currentPnL: number
  currentPnLPercent: number
  exitPrice?: number
  exitTime?: number
  exitIndex?: number
  exitPnL?: number
  exitPnLPercent?: number
  patternEntry?: {
    patternType: PatternType
    entryQuality: number
  }
}

export interface Account {
  balance: number
  equity: number
  initialBalance: number
  realizedPnL: number
  unrealizedPnL: number
}

export interface GameStats {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  averageWin: number
  averageLoss: number
  profitFactor: number
  maxDrawdown: number
  maxDrawdownPercent: number
  sharpeRatio?: number
  patternRecognitionScore: number
  averageEntryQuality: number
  bestTrade?: {
    pnl: number
    pnlPercent: number
    patternType: PatternType
  }
  worstTrade?: {
    pnl: number
    pnlPercent: number
    patternType: PatternType
  }
}

export interface Feedback {
  type: 'pattern_hint' | 'trade_quality' | 'warning' | 'success' | 'info'
  message: string
  timestamp: number
  data?: {
    patternType?: PatternType
    entryQuality?: number
    expectedEntry?: number
    actualEntry?: number
  }
}

export interface GameState {
  id: string
  candles: Candle[]
  patterns: Pattern[]
  currentIndex: number
  visibleCandles: number
  account: Account
  positions: Position[]
  closedPositions: Position[]
  stats: GameStats
  feedbackHistory: Feedback[]
  isComplete: boolean
  asset: string
  timeframe: string
  totalCandles: number
}

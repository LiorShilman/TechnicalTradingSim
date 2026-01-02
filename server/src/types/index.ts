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

/**
 * הערת מסחר (Trade Journal)
 * מתעדת מחשבות לפני ואחרי העסקה למטרות למידה
 */
export interface TradeNote {
  positionId: string
  preTradeThoughts: string              // מדוע נכנסתי לעסקה?
  expectedOutcome: 'win' | 'loss' | 'breakeven'  // תוצאה צפויה
  confidence: number                    // רמת ביטחון 1-5
  postTradeReflection?: string          // מה למדתי? (לאחר סגירה)
  createdAt: number
}

export interface Position {
  id: string
  type: PositionType
  entryPrice: number
  entryTime: number
  entryIndex: number
  quantity: number
  currentPnL: number
  currentPnLPercent: number
  stopLoss?: number        // מחיר Stop Loss
  takeProfit?: number      // מחיר Take Profit
  exitPrice?: number
  exitTime?: number
  exitIndex?: number
  exitPnL?: number
  exitPnLPercent?: number
  exitReason?: 'manual' | 'stop_loss' | 'take_profit'  // סיבת סגירה
  patternEntry?: {
    patternType: PatternType
    entryQuality: number
  }
  note?: TradeNote         // הערת מסחר (Trade Journal)
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
  sharpeRatio: number        // יחס Sharpe - תשואה מתואמת סיכון
  sortinoRatio: number       // יחס Sortino - תשואה מתואמת תנודתיות שלילית
  calmarRatio: number        // יחס Calmar - תשואה חלקי Drawdown מקסימלי
  patternRecognitionScore: number
  averageEntryQuality: number
  currentStreak: number  // רצף נוכחי (חיובי = נצחונות, שלילי = הפסדים)
  maxWinStreak: number   // רצף נצחונות מקסימלי
  maxLossStreak: number  // רצף הפסדים מקסימלי
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
    orderId?: string
    targetPrice?: number
    quantity?: number
    positionId?: string
    stopLoss?: number
    takeProfit?: number
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
  priceStep?: number
  // שדות נוספים לזיהוי קובץ המקור
  sourceFileName?: string      // שם הקובץ המקורי
  sourceDateRange?: {          // טווח התאריכים המקורי
    start: string
    end: string
  }
  pendingOrders?: PendingOrder[] // פקודות עתידיות
}

/**
 * מצב משחק שמור - נשמר ב-localStorage
 * מכיל את כל המידע הדרוש לשחזור מדויק
 */
export interface SavedGameState {
  gameId: string
  savedAt: number              // תאריך השמירה (timestamp)
  sourceFileName: string       // שם הקובץ המקורי
  sourceDateRange: {           // טווח התאריכים
    start: string
    end: string
  }
  asset: string
  timeframe: string
  currentIndex: number         // האינדקס הנוכחי
  account: Account             // מצב החשבון
  positions: Position[]        // פוזיציות פתוחות
  closedPositions: Position[]  // פוזיציות סגורות
  stats: GameStats             // סטטיסטיקות
  feedbackHistory: Feedback[]  // היסטוריית משובים
  isComplete: boolean
  priceStep?: number
}

/**
 * סוג הפקודה העתידית
 * - buyStop: קנייה מעל המחיר הנוכחי (breakout long)
 * - buyLimit: קנייה מתחת למחיר הנוכחי (pullback long)
 * - sellStop: מכירה מתחת למחיר הנוכחי (breakout short)
 * - sellLimit: מכירה מעל המחיר הנוכחי (pullback short)
 */
export type PendingOrderType = 'buyStop' | 'buyLimit' | 'sellStop' | 'sellLimit'

/**
 * פקודה עתידית - פקודה שתבוצע כשנגיע למחיר מסוים
 */
export interface PendingOrder {
  id: string
  type: PositionType           // long או short
  orderType: PendingOrderType  // סוג הפקודה (Stop/Limit)
  targetPrice: number          // המחיר שבו הפקודה תבוצע
  targetCandleIndex: number    // האינדקס של הנר שבו המחיר נמצא
  quantity: number
  stopLoss?: number
  takeProfit?: number
  createdAt: number
  createdAtIndex: number       // האינדקס שבו הפקודה נוצרה
}

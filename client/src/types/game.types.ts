// ===============================================
// Shared Types for Trading Game
// ===============================================

/**
 * נר בגרף (OHLCV)
 */
export interface Candle {
  time: number;        // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * סוגי תבניות טכניות
 */
export type PatternType = 'breakout' | 'retest' | 'flag';

/**
 * תבנית טכנית
 */
export interface Pattern {
  type: PatternType;
  startIndex: number;         // Index in candles array
  endIndex: number;           // Index in candles array
  expectedEntry: number;      // מחיר כניסה אידיאלי
  expectedExit: number;       // מחיר יציאה אידיאלי
  stopLoss: number;           // מחיר stop loss
  metadata: {
    quality: number;          // 0-100 איכות התבנית
    description: string;      // תיאור התבנית
    hint?: string;            // רמז למשתמש (אופציונלי)
    retestIndex?: number;     // עבור retest: נר הבדיקה החוזרת
    breakoutIndex?: number;   // עבור retest: נר הפריצה
  };
}

/**
 * סוג פוזיציה
 */
export type PositionType = 'long' | 'short';

/**
 * הערת מסחר (Trade Journal)
 */
export interface TradeNote {
  positionId: string;
  preTradeThoughts: string;        // מדוע נכנסתי?
  expectedOutcome: 'win' | 'loss' | 'breakeven';  // מה הציפייה?
  confidence: number;              // רמת ביטחון 1-5
  postTradeReflection?: string;    // מה למדתי? (לאחר סגירה)
  createdAt: number;               // Unix timestamp
}

/**
 * פוזיציית מסחר
 */
export interface Position {
  id: string;
  type: PositionType;
  entryPrice: number;
  entryTime: number;          // Unix timestamp
  entryIndex: number;         // Index in candles array
  quantity: number;           // כמות (למשל 0.5 BTC)
  currentPnL: number;         // Profit/Loss נוכחי
  currentPnLPercent: number;  // אחוזי רווח/הפסד
  stopLoss?: number;          // מחיר Stop Loss
  takeProfit?: number;        // מחיר Take Profit
  exitPrice?: number;
  exitTime?: number;
  exitIndex?: number;
  exitPnL?: number;
  exitPnLPercent?: number;
  exitReason?: 'manual' | 'stop_loss' | 'take_profit';  // סיבת סגירה
  patternEntry?: {            // מידע על התבנית שנכנס בה
    patternType: PatternType;
    entryQuality: number;     // 0-100 איכות הכניסה
  };
  note?: TradeNote;           // הערת מסחר (Trade Journal)
}

/**
 * חשבון משתמש
 */
export interface Account {
  balance: number;            // יתרת מזומן חופשית
  equity: number;             // סך הכל ערך (balance + unrealized PnL)
  initialBalance: number;     // יתרה התחלתית
  realizedPnL: number;        // רווח/הפסד ממומש
  unrealizedPnL: number;      // רווח/הפסד לא ממומש
}

/**
 * סטטיסטיקות משחק
 */
export interface GameStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;            // אחוז trades מנצחים
  averageWin: number;
  averageLoss: number;
  profitFactor: number;       // סך רווחים / סך הפסדים
  maxDrawdown: number;        // הירידה המקסימלית
  maxDrawdownPercent: number;
  sharpeRatio: number;        // יחס Sharpe - תשואה מתואמת סיכון
  sortinoRatio: number;       // יחס Sortino - תשואה מתואמת תנודתיות שלילית
  calmarRatio: number;        // יחס Calmar - תשואה חלקי Drawdown מקסימלי
  patternRecognitionScore: number;  // 0-100 ציון זיהוי תבניות
  averageEntryQuality: number;      // 0-100 ממוצע איכות כניסות
  currentStreak: number;      // רצף נוכחי (חיובי = נצחונות, שלילי = הפסדים)
  maxWinStreak: number;       // רצף נצחונות מקסימלי
  maxLossStreak: number;      // רצף הפסדים מקסימלי
  bestTrade?: {
    pnl: number;
    pnlPercent: number;
    patternType: PatternType;
  };
  worstTrade?: {
    pnl: number;
    pnlPercent: number;
    patternType: PatternType;
  };
}

/**
 * משוב למשתמש
 */
export interface Feedback {
  type: 'pattern_hint' | 'trade_quality' | 'warning' | 'success' | 'info';
  message: string;
  timestamp: number;
  data?: {
    patternType?: PatternType;
    entryQuality?: number;
    expectedEntry?: number;
    actualEntry?: number;
    orderId?: string;
    targetPrice?: number;
    quantity?: number;
    positionId?: string;
    stopLoss?: number;
    takeProfit?: number;
  };
}

/**
 * מצב משחק מלא
 */
export interface GameState {
  id: string;
  candles: Candle[];
  patterns: Pattern[];
  currentIndex: number;       // איזה נר אנחנו נמצאים בו
  visibleCandles: number;     // כמה נרות להציג (50 ברירת מחדל)
  account: Account;
  positions: Position[];
  closedPositions: Position[];
  stats: GameStats;
  feedbackHistory: Feedback[];
  isComplete: boolean;
  asset: string;              // למשל 'BTC/USD'
  timeframe: string;          // למשל '1H'
  totalCandles: number;       // סך הכל נרות במשחק
  priceStep?: number;         // רזולוציית מחיר (למשל 0.01 = 2 decimal places)
  // שדות נוספים לזיהוי קובץ המקור
  sourceFileName?: string;    // שם הקובץ המקורי
  sourceDateRange?: {         // טווח התאריכים המקורי
    start: string;
    end: string;
  };
  pendingOrders?: PendingOrder[]; // פקודות עתידיות
}

/**
 * מצב משחק שמור - נשמר ב-localStorage
 * מכיל את כל המידע הדרוש לשחזור מדויק
 */
export interface SavedGameState {
  gameId: string;
  savedAt: number;            // תאריך השמירה (timestamp)
  sourceFileName: string;     // שם הקובץ המקורי
  sourceDateRange: {          // טווח התאריכים
    start: string;
    end: string;
  };
  asset: string;
  timeframe: string;
  currentIndex: number;       // האינדקס הנוכחי
  account: Account;           // מצב החשבון
  positions: Position[];      // פוזיציות פתוחות
  closedPositions: Position[]; // פוזיציות סגורות
  stats: GameStats;           // סטטיסטיקות
  feedbackHistory: Feedback[]; // היסטוריית משובים
  isComplete: boolean;
  priceStep?: number;
  pendingOrders?: PendingOrder[]; // פקודות עתידיות
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
  id: string;
  type: PositionType;         // long או short
  orderType: PendingOrderType; // סוג הפקודה (Stop/Limit)
  targetPrice: number;        // המחיר שבו הפקודה תבוצע
  targetCandleIndex: number;  // האינדקס של הנר שבו המחיר נמצא
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
  createdAt: number;
  createdAtIndex: number;     // האינדקס שבו הפקודה נוצרה
}

/**
 * התראת מחיר - נשלחת כשהמחיר עובר רמה מסוימת
 */
export interface PriceAlert {
  id: string;
  targetPrice: number;        // המחיר שעליו להתריע
  direction: 'above' | 'below'; // התראה כשעובר מעל או מתחת
  enabled: boolean;           // האם ההתראה פעילה
  createdAt: number;
  createdAtPrice: number;     // המחיר שבו ההתראה נוצרה
  note?: string;              // הערה אופציונלית
}

/**
 * כללי מסחר - מוגדרים על ידי השחקן
 */
export interface TradingRules {
  maxDailyTrades: number;          // מקסימום עסקאות ביום
  minRRRatio: number;              // R:R מינימלי (default: 1.5)
  maxRiskPerTrade: number;         // סיכון מקסימלי באחוזים (default: 2%)
  requireStopLoss: boolean;        // חובת SL
  requireTakeProfit: boolean;      // חובת TP
  maxConsecutiveLosses: number;    // מקס הפסדים ברצף לפני הפסקה
}

/**
 * הפרת כלל מסחר
 */
export interface RuleViolation {
  id: string;
  timestamp: number;
  candleIndex: number;             // באיזה נר ההפרה קרתה
  rule: keyof TradingRules;        // איזה כלל הופר
  message: string;
  severity: 'warning' | 'critical';
  tradePnL?: number;               // האם ההפרה הייתה בעסקה מנצחת (גרוע יותר)
  positionId?: string;             // ID של העסקה הרלוונטית
}

/**
 * בקשה ליצירת משחק חדש
 */
export interface CreateGameRequest {
  asset?: string;             // ברירת מחדל: BTC/USD
  timeframe?: string;         // ברירת מחדל: 1H
  totalCandles?: number;      // ברירת מחדל: 100
  initialBalance?: number;    // ברירת מחדל: 10000
  patterns?: PatternType[];   // אילו תבניות לכלול
}

/**
 * בקשה למסחר
 */
export interface TradeRequest {
  type: 'buy' | 'sell';
  quantity: number;           // כמות ליחידת נכס
  positionId?: string;        // לסגירת פוזיציה ספציפית (sell)
  positionType?: 'long' | 'short';  // סוג פוזיציה לפתיחה (buy)
  stopLoss?: number;          // מחיר Stop Loss (buy)
  takeProfit?: number;        // מחיר Take Profit (buy)
  note?: Omit<TradeNote, 'positionId' | 'createdAt'>;  // הערת מסחר (אופציונלי)
}

/**
 * תגובה מהשרת - משחק חדש
 */
export interface NewGameResponse {
  game: GameState;
}

/**
 * תגובה מהשרת - נר הבא
 */
export interface NextCandleResponse {
  candle: Candle;
  currentIndex: number;
  positions: Position[];
  account: Account;
  feedback?: Feedback;
  isComplete: boolean;
}

/**
 * תגובה מהשרת - ביצוע מסחר
 */
export interface TradeResponse {
  position?: Position;        // פוזיציה חדשה (buy) או null (sell)
  closedPosition?: Position;  // פוזיציה שנסגרה (sell)
  account: Account;
  feedback?: Feedback;
}

/**
 * תגובת שגיאה
 */
export interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, unknown>;
}

import { useState, useRef, useEffect } from 'react'
import { TrendingUp, TrendingDown, Settings } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import TradeNoteModal from './TradeNoteModal'
import type { TradeNote } from '@/types/game.types'

/**
 * OrderPanel Component
 *
 * Professional trading panel implementing advanced order management and risk control features.
 * This component allows users to execute LONG and SHORT positions with optional Stop Loss (SL),
 * Take Profit (TP), and integrated risk management tools.
 *
 * ## Key Features:
 *
 * ### 1. Basic Trading
 * - Quantity input with 0.001 BTC precision (supports fractional crypto trading)
 * - Real-time total value calculation and portfolio percentage display
 * - Current price display with live updates
 * - Support for both LONG (buy) and SHORT (sell) positions
 *
 * ### 2. Stop Loss & Take Profit
 * - Percentage-based SL/TP with live price calculation
 * - **Price Freeze Mechanism**: SL/TP prices freeze when settings change to prevent
 *   UI flicker during rapid price movements (see useRef pattern below)
 * - Automatic inversion for SHORT positions (SL above entry, TP below entry)
 *
 * ### 3. Risk-Reward Ratio (R:R)
 * - Automatically calculates R:R ratio when both SL and TP are enabled
 * - Color-coded feedback:
 *   - Green (≥2:1): Excellent risk-reward
 *   - Yellow (≥1:1): Acceptable risk-reward
 *   - Red (<1:1): Poor risk-reward
 * - Frozen value to prevent UI updates during price changes
 *
 * ### 4. Risk Management
 * - Configure maximum risk per trade (% of account equity)
 * - Real-time risk calculation in dollars and percentage
 * - Recommended position size calculator based on:
 *   Formula: (Account Equity × Risk%) / (Current Price × SL%)
 * - Risk warning when position size exceeds configured risk tolerance
 * - One-click auto-calculate button to use recommended quantity
 *
 * ## Technical Implementation Details:
 *
 * ### Price Freeze Pattern (useRef)
 * The component uses React refs to "freeze" SL/TP prices and R:R ratio when user
 * changes settings. This prevents these values from recalculating on every candle
 * update, which would cause confusing UI flicker.
 *
 * **How it works:**
 * - `frozenStopLossPriceRef`, `frozenTakeProfitPriceRef`, `frozenRiskRewardRef`
 *   store calculated values
 * - Values recalculate ONLY when user modifies SL/TP settings or toggles checkboxes
 * - Intentionally EXCLUDES `gameState` and `currentIndex` from useEffect deps
 *   to prevent recalculation during price changes (see line 51 comment)
 * - `totalValue` and `currentPrice` remain reactive for accurate trade execution
 *
 * ### LONG vs SHORT Position Logic
 * - **LONG positions**: SL below entry price, TP above entry price (standard)
 * - **SHORT positions**: SL above entry price, TP below entry price (inverted)
 *   - Calculated fresh on each trade execution (lines 86-92) using current price
 *   - Not frozen because SHORT trades need latest price for correct inversion
 *
 * @component
 * @example
 * ```tsx
 * // Used in main trading interface
 * <OrderPanel />
 * ```
 */
export default function OrderPanel() {
  const { gameState, executeTrade, isLoading } = useGameStore()

  // שם הנכס המלא (למשל: SP/SPX, BTC/USD)
  const assetSymbol = gameState?.asset || 'BTC/USD'

  // === Trade Journal State ===
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [pendingTradeType, setPendingTradeType] = useState<'long' | 'short' | null>(null)

  // === Trading State ===
  /** Quantity of asset to trade (supports fractional amounts like 0.001) */
  const [quantity, setQuantity] = useState('0.1')

  /** Controls visibility of advanced settings (SL/TP/Risk Management) */
  const [showAdvanced, setShowAdvanced] = useState(false)

  // === Stop Loss & Take Profit State ===
  /** Stop Loss percentage (e.g., '2' = 2% below entry for LONG) */
  const [stopLossPercent, setStopLossPercent] = useState(() => {
    const saved = localStorage.getItem('tradingPreferences')
    if (saved) {
      try {
        const prefs = JSON.parse(saved)
        return prefs.stopLossPercent || '2'
      } catch {
        return '2'
      }
    }
    return '2'
  })

  /** Take Profit percentage (e.g., '5' = 5% above entry for LONG) */
  const [takeProfitPercent, setTakeProfitPercent] = useState(() => {
    const saved = localStorage.getItem('tradingPreferences')
    if (saved) {
      try {
        const prefs = JSON.parse(saved)
        return prefs.takeProfitPercent || '5'
      } catch {
        return '5'
      }
    }
    return '5'
  })

  /** Enable/disable Stop Loss */
  const [useStopLoss, setUseStopLoss] = useState(() => {
    const saved = localStorage.getItem('tradingPreferences')
    if (saved) {
      try {
        const prefs = JSON.parse(saved)
        return prefs.useStopLoss ?? false
      } catch {
        return false
      }
    }
    return false
  })

  /** Enable/disable Take Profit */
  const [useTakeProfit, setUseTakeProfit] = useState(() => {
    const saved = localStorage.getItem('tradingPreferences')
    if (saved) {
      try {
        const prefs = JSON.parse(saved)
        return prefs.useTakeProfit ?? false
      } catch {
        return false
      }
    }
    return false
  })

  // === Risk Management State ===
  /** Enable/disable risk management calculations */
  const [useRiskManagement, setUseRiskManagement] = useState(() => {
    const saved = localStorage.getItem('tradingPreferences')
    if (saved) {
      try {
        const prefs = JSON.parse(saved)
        return prefs.useRiskManagement ?? false
      } catch {
        return false
      }
    }
    return false
  })

  /** Maximum risk per trade as % of account equity (e.g., '2' = 2%) */
  const [riskPercentPerTrade, setRiskPercentPerTrade] = useState(() => {
    const saved = localStorage.getItem('tradingPreferences')
    if (saved) {
      try {
        const prefs = JSON.parse(saved)
        return prefs.riskPercentPerTrade || '2'
      } catch {
        return '2'
      }
    }
    return '2'
  })

  // === Frozen Values (useRef Pattern) ===
  /**
   * Frozen Stop Loss price (calculated when settings change, not on every candle).
   * Prevents UI flicker by keeping SL price stable during rapid price movements.
   * Recalculates only when user modifies stopLossPercent or toggles useStopLoss.
   */
  const frozenStopLossPriceRef = useRef<number | undefined>()

  /**
   * Frozen Take Profit price (calculated when settings change, not on every candle).
   * Prevents UI flicker by keeping TP price stable during rapid price movements.
   * Recalculates only when user modifies takeProfitPercent or toggles useTakeProfit.
   */
  const frozenTakeProfitPriceRef = useRef<number | undefined>()

  /**
   * Frozen Risk-Reward ratio (calculated when settings change, not on every candle).
   * Formula: TP% / SL%
   * Example: If SL=2% and TP=5%, R:R = 5/2 = 2.5 (displayed as "1:2.5")
   */
  const frozenRiskRewardRef = useRef<number>(0)

  // === Reactive Values (recalculate on every render) ===
  /** Current candle's close price - updates every candle */
  const currentPrice = gameState?.candles[gameState.currentIndex]?.close ?? 0

  /** Parsed quantity as number */
  const quantityNum = parseFloat(quantity) || 0

  /** Total trade value in USD (updates with current price - intentionally reactive) */
  const totalValue = currentPrice * quantityNum

  /** Current account equity (balance + unrealized P&L) */
  const accountEquity = gameState?.account.equity ?? 0

  /**
   * Price Freeze Effect - Calculates and freezes SL/TP/R:R values when settings change
   *
   * This effect implements the "price freeze" pattern to prevent UI flicker.
   *
   * ## Why This Pattern?
   * Without freezing, SL/TP prices would recalculate on every candle update (every 0.5-3s
   * in auto-play mode), causing the UI to constantly update and confuse users.
   *
   * ## How It Works:
   * 1. Captures current price at the moment settings change
   * 2. Calculates SL/TP prices using that captured price
   * 3. Stores values in refs (which persist but don't trigger re-renders)
   * 4. Values remain frozen until user changes settings again
   *
   * ## Dependency Array:
   * INTENTIONALLY EXCLUDES `gameState` and `currentIndex` to prevent recalculation
   * during price changes. The eslint-disable comment on line 168 is deliberate.
   *
   * ## Calculations:
   * - **SL Price (LONG)**: Current Price × (1 - SL%) → Price is 2% lower
   * - **TP Price (LONG)**: Current Price × (1 + TP%) → Price is 5% higher
   * - **R:R Ratio**: TP% / SL% → Simple ratio, independent of price
   *
   * Note: SHORT positions calculate SL/TP differently - see handleSellShort()
   */
  useEffect(() => {
    // Capture current price at the moment settings change (not on every candle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const priceAtSettingChange = gameState?.candles[gameState.currentIndex]?.close ?? 0

    // Calculate Stop Loss price (for LONG positions)
    // Example: Price=$50,000, SL=2% → $50,000 × (1 - 0.02) = $49,000
    const newSL = useStopLoss && priceAtSettingChange
      ? priceAtSettingChange * (1 - parseFloat(stopLossPercent || '0') / 100)
      : undefined

    // Calculate Take Profit price (for LONG positions)
    // Example: Price=$50,000, TP=5% → $50,000 × (1 + 0.05) = $52,500
    const newTP = useTakeProfit && priceAtSettingChange
      ? priceAtSettingChange * (1 + parseFloat(takeProfitPercent || '0') / 100)
      : undefined

    // Store frozen values in refs
    frozenStopLossPriceRef.current = newSL
    frozenTakeProfitPriceRef.current = newTP

    // Calculate Risk-Reward Ratio (pure percentage ratio, independent of price)
    // Example: SL=2%, TP=5% → R:R = 5/2 = 2.5 (displayed as "1:2.5")
    if (useStopLoss && useTakeProfit) {
      const tpValue = parseFloat(takeProfitPercent)
      const slValue = parseFloat(stopLossPercent)

      // Validate both values are valid numbers and SL is not zero
      if (!isNaN(tpValue) && !isNaN(slValue) && slValue !== 0) {
        frozenRiskRewardRef.current = tpValue / slValue
      } else {
        frozenRiskRewardRef.current = 0
      }
    } else {
      frozenRiskRewardRef.current = 0
    }

    // ⚠️ INTENTIONAL: Excludes gameState/currentIndex to prevent recalculation on price changes
    // This is the core of the "freeze" pattern - values update only when user changes settings
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useStopLoss, useTakeProfit, stopLossPercent, takeProfitPercent])

  /**
   * Save Trading Preferences to localStorage
   * Persists SL/TP percentages, checkbox states, and risk management settings across sessions
   */
  useEffect(() => {
    const preferences = {
      stopLossPercent,
      takeProfitPercent,
      riskPercentPerTrade,
      useStopLoss,
      useTakeProfit,
      useRiskManagement,
    }
    localStorage.setItem('tradingPreferences', JSON.stringify(preferences))
  }, [stopLossPercent, takeProfitPercent, riskPercentPerTrade, useStopLoss, useTakeProfit, useRiskManagement])

  // === Derived Values from Frozen Refs ===
  /** Stop Loss price from frozen ref (stable during price movements) */
  const stopLossPrice = frozenStopLossPriceRef.current

  /** Take Profit price from frozen ref (stable during price movements) */
  const takeProfitPrice = frozenTakeProfitPriceRef.current

  /** Risk-Reward ratio from frozen ref (stable during price movements) */
  const riskRewardRatio = frozenRiskRewardRef.current

  // === Risk Management Calculations ===

  /**
   * Risk amount in dollars for this trade
   *
   * Two calculation modes:
   * 1. **Risk Management Mode** (recommended):
   *    Risk = Account Equity × Risk%
   *    Example: $10,000 × 2% = $200 risk per trade
   *
   * 2. **Simple Mode** (fallback):
   *    Risk = Position Size × SL%
   *    Example: $5,000 position × 2% SL = $100 risk
   *
   * Risk Management Mode is superior because it limits risk relative to total account,
   * not just the position size.
   */
  const riskAmountDollar = useStopLoss && useRiskManagement
    ? (accountEquity * parseFloat(riskPercentPerTrade || '0') / 100)
    : totalValue * (parseFloat(stopLossPercent || '0') / 100)

  /**
   * Recommended position size based on risk management parameters
   *
   * ## Formula:
   * Quantity = (Account Equity × Risk%) / (Current Price × SL%)
   *
   * ## Example:
   * - Account: $10,000
   * - Risk per trade: 2% ($200)
   * - Current Price: $50,000
   * - Stop Loss: 2% ($1,000 per BTC)
   *
   * Quantity = ($10,000 × 0.02) / ($50,000 × 0.02)
   *          = $200 / $1,000
   *          = 0.2 BTC
   *
   * ## Why This Works:
   * If price drops 2% and hits SL, you lose $1,000 per BTC.
   * With 0.2 BTC, total loss = 0.2 × $1,000 = $200 (exactly 2% of account).
   *
   * This ensures consistent risk regardless of price or position size.
   */
  const recommendedQuantity = useStopLoss && useRiskManagement && parseFloat(stopLossPercent) > 0
    ? (accountEquity * parseFloat(riskPercentPerTrade || '0') / 100) / (currentPrice * parseFloat(stopLossPercent) / 100)
    : 0

  /**
   * Actual risk percentage of the current position relative to account
   *
   * Formula: (Risk in $) / (Account Equity) × 100
   * Example: $250 risk / $10,000 equity = 2.5%
   */
  const actualRiskPercent = accountEquity > 0
    ? (riskAmountDollar / accountEquity) * 100
    : 0

  /**
   * Warning flag: true if actual risk exceeds configured risk tolerance
   * Example: User sets 2% max risk, but current position would risk 3%
   */
  const isRiskTooHigh = useRiskManagement && actualRiskPercent > parseFloat(riskPercentPerTrade || '2')

  /**
   * Auto-calculate quantity based on risk percentage when Risk Management is enabled
   *
   * This effect automatically sets the quantity to the recommended value based on:
   * - Account equity
   * - Risk percentage per trade
   * - Stop Loss percentage
   *
   * Triggers when:
   * - Risk Management is toggled ON
   * - Risk percentage changes
   * - Stop Loss percentage changes
   * - Stop Loss is toggled ON/OFF
   */
  useEffect(() => {
    if (useRiskManagement && useStopLoss && recommendedQuantity > 0) {
      setQuantity(recommendedQuantity.toFixed(3))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useRiskManagement, useStopLoss, riskPercentPerTrade, stopLossPercent])

  /**
   * Set initial quantity based on account equity when game first loads
   *
   * This effect runs once when the component mounts with a valid game state.
   * Sets a reasonable default quantity (1% of account equity divided by current price).
   *
   * Example: $10,000 account, $50,000 BTC price → 0.002 BTC ($100 position, 1% of account)
   */
  useEffect(() => {
    if (gameState && accountEquity > 0 && currentPrice > 0 && quantity === '0.1') {
      // Only set if quantity is still at default '0.1'
      const defaultPositionPercent = 0.01 // 1% of account equity
      const initialQuantity = (accountEquity * defaultPositionPercent) / currentPrice
      setQuantity(initialQuantity.toFixed(3))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.id]) // Run only when game ID changes (new game loaded)

  // === Trading Handlers ===

  /**
   * Handle LONG position entry (Buy)
   *
   * Opens a LONG position with optional SL/TP using frozen prices.
   * Shows Trade Journal modal first (optional but recommended).
   *
   * **LONG Position Mechanics:**
   * - Profit when price goes UP
   * - Stop Loss BELOW entry price (frozen value from refs)
   * - Take Profit ABOVE entry price (frozen value from refs)
   *
   * Example: Entry at $50,000
   * - SL at $49,000 (2% below) → Exit if price drops
   * - TP at $52,500 (5% above) → Exit if price rises
   */
  const handleBuyLong = () => {
    if (quantityNum > 0) {
      // הצג מודאל יומן מסחר
      setPendingTradeType('long')
      setShowNoteModal(true)
    }
  }

  /**
   * Handle SHORT position entry (Sell)
   *
   * Opens a SHORT position with optional SL/TP using INVERTED prices.
   * Shows Trade Journal modal first (optional but recommended).
   *
   * **SHORT Position Mechanics:**
   * - Profit when price goes DOWN
   * - Stop Loss ABOVE entry price (inverted) → Exit if price rises
   * - Take Profit BELOW entry price (inverted) → Exit if price drops
   *
   * ## Why Calculate Fresh (Not Frozen)?
   * SHORT SL/TP are calculated using CURRENT price at execution time (not frozen ref).
   * This ensures accurate inversion based on the exact entry price.
   *
   * ## Inversion Logic:
   * - **SHORT SL**: Entry Price × (1 + SL%) → HIGHER than entry
   * - **SHORT TP**: Entry Price × (1 - TP%) → LOWER than entry
   *
   * Example: Entry at $50,000 with 2% SL and 5% TP
   * - SL at $51,000 (2% ABOVE) → Stop loss if price rises
   * - TP at $47,500 (5% BELOW) → Take profit if price drops
   *
   * Compare to LONG (same percentages):
   * - SL at $49,000 (2% BELOW)
   * - TP at $52,500 (5% ABOVE)
   */
  const handleSellShort = () => {
    if (quantityNum > 0) {
      // הצג מודאל יומן מסחר
      setPendingTradeType('short')
      setShowNoteModal(true)
    }
  }

  /**
   * Execute trade after journal note (or skip)
   */
  const executeTradeWithNote = async (note?: Omit<TradeNote, 'positionId' | 'createdAt'>) => {
    if (!pendingTradeType || quantityNum <= 0) return

    if (pendingTradeType === 'long') {
      // Execute LONG trade with frozen SL/TP
      await executeTrade('buy', quantityNum, undefined, 'long', stopLossPrice, takeProfitPrice, note)
    } else {
      // Calculate inverted SL/TP for SHORT positions using current price
      const shortStopLoss = useStopLoss && currentPrice
        ? currentPrice * (1 + parseFloat(stopLossPercent || '0') / 100)
        : undefined

      const shortTakeProfit = useTakeProfit && currentPrice
        ? currentPrice * (1 - parseFloat(takeProfitPercent || '0') / 100)
        : undefined

      await executeTrade('buy', quantityNum, undefined, 'short', shortStopLoss, shortTakeProfit, note)
    }

    // סגירת המודאל
    setShowNoteModal(false)
    setPendingTradeType(null)
  }

  /** Can execute trades - game active, not loading, not completed */
  const canTrade = gameState && !gameState.isComplete && !isLoading

  return (
    <div className="p-4 border-b border-dark-border max-h-[calc(100vh-100px)] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">פאנל מסחר</h3>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`p-2 rounded-lg transition-colors ${showAdvanced ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-dark-bg'}`}
          title="הגדרות מתקדמות"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Current price */}
      <div className="bg-dark-bg rounded-lg p-3 mb-4">
        <div className="text-xs text-text-secondary mb-1">מחיר נוכחי</div>
        <div className="text-2xl font-mono font-bold" dir="ltr">
          ${currentPrice.toLocaleString()}
        </div>
      </div>

      {/* Quantity input */}
      <div className="mb-4">
        <label className="text-sm text-text-secondary block mb-2">
          כמות ({assetSymbol})
        </label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          step="0.001"
          min="0.001"
          dir="ltr"
          className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 font-mono focus:outline-none focus:border-blue-500"
          disabled={!canTrade}
          placeholder="0.001"
        />
        <div className="text-xs text-text-secondary mt-1 space-y-0.5">
          <div className="flex justify-between items-center">
            <span>סה"כ:</span>
            <span className="font-mono font-semibold" dir="ltr">
              ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>
          {accountEquity > 0 && totalValue > 0 && (
            <div className="flex justify-between items-center">
              <span>אחוז מהתיק:</span>
              <span className="font-mono font-semibold" dir="ltr">
                {((totalValue / accountEquity) * 100).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Advanced settings - SL/TP */}
      {showAdvanced && (
        <div className="mb-4 bg-dark-bg rounded-lg p-3 space-y-3">
          <div className="text-xs font-semibold text-blue-400 mb-2">⚙️ הגדרות מתקדמות</div>

          {/* Stop Loss */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={useStopLoss}
                onChange={(e) => setUseStopLoss(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Stop Loss</span>
            </label>
            {useStopLoss && (
              <div className="mr-6">
                <input
                  type="number"
                  value={stopLossPercent}
                  onChange={(e) => setStopLossPercent(e.target.value)}
                  step="0.5"
                  min="0"
                  max="50"
                  dir="ltr"
                  className="w-full bg-dark-panel border border-dark-border rounded px-3 py-1 text-sm font-mono focus:outline-none focus:border-red-500"
                  placeholder="אחוז"
                />
                <div className="text-xs mt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-text-secondary">מחיר:</span>
                    <span className="font-mono text-loss" dir="ltr">
                      ${stopLossPrice?.toLocaleString(undefined, { maximumFractionDigits: 2 })} (-{stopLossPercent}%)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Take Profit */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={useTakeProfit}
                onChange={(e) => setUseTakeProfit(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Take Profit</span>
            </label>
            {useTakeProfit && (
              <div className="mr-6">
                <input
                  type="number"
                  value={takeProfitPercent}
                  onChange={(e) => setTakeProfitPercent(e.target.value)}
                  step="0.5"
                  min="0"
                  max="100"
                  dir="ltr"
                  className="w-full bg-dark-panel border border-dark-border rounded px-3 py-1 text-sm font-mono focus:outline-none focus:border-green-500"
                  placeholder="אחוז"
                />
                <div className="text-xs mt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-text-secondary">מחיר:</span>
                    <span className="font-mono text-profit" dir="ltr">
                      ${takeProfitPrice?.toLocaleString(undefined, { maximumFractionDigits: 2 })} (+{takeProfitPercent}%)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Risk-Reward Ratio Display */}
          {useStopLoss && useTakeProfit && (
            <div className="bg-dark-panel rounded p-2 border-l-2 border-l-blue-500">
              <div className="text-xs text-text-secondary">📊 יחס רווח/הפסד (R:R)</div>
              <div className={`text-lg font-bold font-mono ${riskRewardRatio >= 2 ? 'text-profit' : riskRewardRatio >= 1 ? 'text-yellow-400' : 'text-loss'}`}>
                1:{riskRewardRatio.toFixed(2)}
              </div>
              <div className="text-xs text-text-secondary mt-1">
                {riskRewardRatio >= 2 ? '✅ יחס מצוין!' : riskRewardRatio >= 1 ? '⚠️ יחס סביר' : '❌ יחס נמוך'}
              </div>
            </div>
          )}

          {/* Risk Management */}
          <div className="pt-2 border-t border-dark-border">
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={useRiskManagement}
                onChange={(e) => setUseRiskManagement(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-semibold">🛡️ ניהול סיכון</span>
            </label>
            {useRiskManagement && (
              <div className="mr-6 space-y-2">
                <div>
                  <label className="text-xs text-text-secondary block mb-1">
                    סיכון מקסימלי לעסקה (% מהחשבון)
                  </label>
                  <input
                    type="number"
                    value={riskPercentPerTrade}
                    onChange={(e) => setRiskPercentPerTrade(e.target.value)}
                    step="0.5"
                    min="0.5"
                    max="10"
                    dir="ltr"
                    className="w-full bg-dark-panel border border-dark-border rounded px-3 py-1 text-sm font-mono focus:outline-none focus:border-blue-500"
                    placeholder="אחוז"
                  />
                  <div className="text-[10px] text-text-secondary mt-1">
                    💡 מומלץ 1-2% (ניהול סיכון מקצועי) | ההגדרה נשמרת אוטומטית
                  </div>
                </div>

                {/* Risk Analysis */}
                <div className="bg-dark-panel rounded p-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">סיכון בעסקה זו:</span>
                    <span className={`font-mono font-bold ${isRiskTooHigh ? 'text-loss' : 'text-text-primary'}`} dir="ltr">
                      ${riskAmountDollar.toFixed(2)} ({actualRiskPercent.toFixed(2)}%)
                    </span>
                  </div>
                  {useStopLoss && recommendedQuantity > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">כמות מומלצת:</span>
                      <span className="font-mono text-blue-400">
                        {recommendedQuantity.toFixed(3)} {assetSymbol}
                      </span>
                    </div>
                  )}
                  {isRiskTooHigh && (
                    <div className="text-xs text-loss flex items-center gap-1 mt-1">
                      <span>⚠️</span>
                      <span>חריגה מסיכון מותר!</span>
                    </div>
                  )}
                </div>

                {/* Auto-calculate button */}
                {useStopLoss && recommendedQuantity > 0 && (
                  <button
                    onClick={() => setQuantity(recommendedQuantity.toFixed(3))}
                    className="w-full text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 py-1.5 rounded transition-colors"
                  >
                    💡 השתמש בכמות מומלצת
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trade buttons */}
      <div className="space-y-3">
        <button
          onClick={handleBuyLong}
          disabled={!canTrade || quantityNum <= 0}
          className="w-full px-4 py-3 bg-profit hover:bg-green-600 disabled:bg-dark-border disabled:cursor-not-allowed rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <TrendingUp size={20} />
          Buy Long
        </button>

        <button
          onClick={handleSellShort}
          disabled={!canTrade || quantityNum <= 0}
          className="w-full px-4 py-3 bg-loss hover:bg-red-600 disabled:bg-dark-border disabled:cursor-not-allowed rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <TrendingDown size={20} />
          Sell Short
        </button>
      </div>

      {/* Trade Journal Modal */}
      {showNoteModal && pendingTradeType && (
        <TradeNoteModal
          positionType={pendingTradeType}
          onSubmit={(note) => executeTradeWithNote({
            preTradeThoughts: note.thoughts,
            expectedOutcome: note.expectedOutcome,
            confidence: note.confidence
          })}
          onSkip={() => executeTradeWithNote()}
        />
      )}
    </div>
  )
}

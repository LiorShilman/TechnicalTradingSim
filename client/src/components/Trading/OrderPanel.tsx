import { useState } from 'react'
import { TrendingUp, TrendingDown, Settings } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'

export default function OrderPanel() {
  const { gameState, executeTrade, isLoading } = useGameStore()
  const [quantity, setQuantity] = useState('0.1')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [stopLossPercent, setStopLossPercent] = useState('2')  // אחוז Stop Loss
  const [takeProfitPercent, setTakeProfitPercent] = useState('5')  // אחוז Take Profit
  const [useStopLoss, setUseStopLoss] = useState(false)
  const [useTakeProfit, setUseTakeProfit] = useState(false)
  const [useRiskManagement, setUseRiskManagement] = useState(false)
  const [riskPercentPerTrade, setRiskPercentPerTrade] = useState('2') // אחוז סיכון לעסקה

  const currentPrice = gameState?.candles[gameState.currentIndex]?.close ?? 0
  const quantityNum = parseFloat(quantity) || 0
  const totalValue = currentPrice * quantityNum
  const accountBalance = gameState?.account.balance ?? 0
  const accountEquity = gameState?.account.equity ?? 0

  // חישוב מחירי SL/TP
  const stopLossPrice = useStopLoss && currentPrice
    ? currentPrice * (1 - parseFloat(stopLossPercent || '0') / 100)
    : undefined

  const takeProfitPrice = useTakeProfit && currentPrice
    ? currentPrice * (1 + parseFloat(takeProfitPercent || '0') / 100)
    : undefined

  // חישוב Risk-Reward Ratio
  const riskRewardRatio = useStopLoss && useTakeProfit
    ? parseFloat(takeProfitPercent) / parseFloat(stopLossPercent)
    : 0

  // חישוב סיכון בדולרים לעסקה
  const riskAmountDollar = useStopLoss && useRiskManagement
    ? (accountEquity * parseFloat(riskPercentPerTrade || '0') / 100)
    : totalValue * (parseFloat(stopLossPercent || '0') / 100)

  // חישוב גודל פוזיציה מומלץ לפי ניהול סיכון
  const recommendedQuantity = useStopLoss && useRiskManagement && parseFloat(stopLossPercent) > 0
    ? (accountEquity * parseFloat(riskPercentPerTrade || '0') / 100) / (currentPrice * parseFloat(stopLossPercent) / 100)
    : 0

  // חישוב אחוז סיכון בפועל
  const actualRiskPercent = accountEquity > 0
    ? (riskAmountDollar / accountEquity) * 100
    : 0

  // בדיקת חריגה מסיכון מותר
  const isRiskTooHigh = useRiskManagement && actualRiskPercent > parseFloat(riskPercentPerTrade || '2')

  const handleBuyLong = async () => {
    if (quantityNum > 0) {
      await executeTrade('buy', quantityNum, undefined, 'long', stopLossPrice, takeProfitPrice)
    }
  }

  const handleSellShort = async () => {
    if (quantityNum > 0) {
      // ב-SHORT, SL/TP הפוכים
      const shortStopLoss = useStopLoss && currentPrice
        ? currentPrice * (1 + parseFloat(stopLossPercent || '0') / 100)
        : undefined

      const shortTakeProfit = useTakeProfit && currentPrice
        ? currentPrice * (1 - parseFloat(takeProfitPercent || '0') / 100)
        : undefined

      await executeTrade('buy', quantityNum, undefined, 'short', shortStopLoss, shortTakeProfit)
    }
  }

  const canTrade = gameState && !gameState.isComplete && !isLoading

  return (
    <div className="p-4 border-b border-dark-border">
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
          כמות (BTC)
        </label>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          step="0.01"
          min="0"
          className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 font-mono focus:outline-none focus:border-blue-500"
          disabled={!canTrade}
        />
        <div className="text-xs text-text-secondary mt-1" dir="ltr">
          סה"כ: ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
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
                  className="w-full bg-dark-panel border border-dark-border rounded px-3 py-1 text-sm font-mono focus:outline-none focus:border-red-500"
                  placeholder="אחוז"
                />
                <div className="text-xs text-text-secondary mt-1" dir="ltr">
                  מחיר: ${stopLossPrice?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  <span className="text-loss mr-2">(-{stopLossPercent}%)</span>
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
                  className="w-full bg-dark-panel border border-dark-border rounded px-3 py-1 text-sm font-mono focus:outline-none focus:border-green-500"
                  placeholder="אחוז"
                />
                <div className="text-xs text-text-secondary mt-1" dir="ltr">
                  מחיר: ${takeProfitPrice?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  <span className="text-profit mr-2">(+{takeProfitPercent}%)</span>
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
                    className="w-full bg-dark-panel border border-dark-border rounded px-3 py-1 text-sm font-mono focus:outline-none focus:border-blue-500"
                    placeholder="אחוז"
                  />
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
                        {recommendedQuantity.toFixed(3)} BTC
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
    </div>
  )
}

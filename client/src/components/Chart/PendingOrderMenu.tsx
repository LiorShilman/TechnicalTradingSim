import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, X } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import type { PendingOrderType } from '@/types/game.types'

interface PendingOrderMenuProps {
  price: number
  x: number
  y: number
  onClose: () => void
  onPreviewUpdate?: (targetPrice: number, orderType: 'long' | 'short', stopLoss?: number, takeProfit?: number) => void
}

export default function PendingOrderMenu({ price, x: _x, y: _y, onClose, onPreviewUpdate }: PendingOrderMenuProps) {
  const { gameState, createPendingOrder } = useGameStore()
  const [quantity, setQuantity] = useState(0.01)
  const [stopLoss, setStopLoss] = useState<number | undefined>()
  const [takeProfit, setTakeProfit] = useState<number | undefined>()
  const [previewType, setPreviewType] = useState<'long' | 'short'>('long')

  // ניהול סיכון - אחוזי SL/TP
  const [stopLossPercent, setStopLossPercent] = useState('')
  const [takeProfitPercent, setTakeProfitPercent] = useState('')
  const [maxRiskPercent, setMaxRiskPercent] = useState('2') // סיכון מקסימלי לעסקה (% מההון)

  // קבלת המחיר הנוכחי
  const currentPrice = gameState?.candles[gameState.currentIndex]?.close || 0
  const equity = gameState?.account.equity || 10000

  // חישוב SL/TP בפועל מאחוזים
  useEffect(() => {
    if (stopLossPercent && !isNaN(parseFloat(stopLossPercent))) {
      const slPercent = parseFloat(stopLossPercent) / 100
      if (previewType === 'long') {
        // LONG: SL מתחת למחיר היעד
        setStopLoss(price * (1 - slPercent))
      } else {
        // SHORT: SL מעל למחיר היעד
        setStopLoss(price * (1 + slPercent))
      }
    } else {
      setStopLoss(undefined)
    }
  }, [stopLossPercent, price, previewType])

  useEffect(() => {
    if (takeProfitPercent && !isNaN(parseFloat(takeProfitPercent))) {
      const tpPercent = parseFloat(takeProfitPercent) / 100
      if (previewType === 'long') {
        // LONG: TP מעל למחיר היעד
        setTakeProfit(price * (1 + tpPercent))
      } else {
        // SHORT: TP מתחת למחיר היעד
        setTakeProfit(price * (1 - tpPercent))
      }
    } else {
      setTakeProfit(undefined)
    }
  }, [takeProfitPercent, price, previewType])

  // חישוב כמות מומלצת על פי סיכון
  const calculateRecommendedQuantity = (): number => {
    if (!stopLossPercent || isNaN(parseFloat(stopLossPercent))) {
      return 0.01 // ברירת מחדל
    }

    const slPercent = parseFloat(stopLossPercent)
    const riskPercent = parseFloat(maxRiskPercent)

    if (slPercent === 0 || riskPercent === 0) {
      return 0.01
    }

    // נוסחה: כמות = (הון * % סיכון) / (מחיר * % SL)
    const recommendedQty = (equity * riskPercent / 100) / (price * (slPercent / 100))

    return Math.max(0.001, parseFloat(recommendedQty.toFixed(3)))
  }

  const handleAutoCalculate = () => {
    const recommended = calculateRecommendedQuantity()
    setQuantity(recommended)
  }

  // עדכון התצוגה המקדימה בגרף
  useEffect(() => {
    if (onPreviewUpdate) {
      onPreviewUpdate(price, previewType, stopLoss, takeProfit)
    }
  }, [price, previewType, stopLoss, takeProfit, onPreviewUpdate])

  // קביעת סוג הפקודה לפי המחיר היעד ביחס למחיר הנוכחי
  const determineOrderType = (positionType: 'long' | 'short'): PendingOrderType => {
    if (positionType === 'long') {
      // LONG: מעל = Buy Stop, מתחת = Buy Limit
      return price > currentPrice ? 'buyStop' : 'buyLimit'
    } else {
      // SHORT: מתחת = Sell Stop, מעל = Sell Limit
      return price < currentPrice ? 'sellStop' : 'sellLimit'
    }
  }

  const handlePlaceOrder = async (type: 'long' | 'short') => {
    if (!gameState) return

    const orderType = determineOrderType(type)
    await createPendingOrder(type, price, quantity, stopLoss, takeProfit, orderType)
    onClose()
  }

  return (
    <>
      {/* רקע שקוף לסגירה בלחיצה */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* תפריט הקונטקסט */}
      <div
        className="fixed z-50 bg-dark-panel border border-dark-border rounded-lg shadow-2xl p-4 min-w-[280px] max-w-[90vw]"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* כותרת */}
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-dark-border">
          <div className="text-sm font-bold text-text-primary">פקודה עתידית</div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* מחיר יעד */}
        <div className="mb-3 p-2 bg-blue-900/20 border border-blue-500/30 rounded">
          <div className="text-xs text-text-secondary mb-1">מחיר יעד</div>
          <div className="text-xl font-bold text-blue-400" dir="ltr">
            ${price.toFixed(2)}
          </div>
          <div className="text-xs text-text-secondary mt-1" dir="ltr">
            מחיר נוכחי: ${currentPrice.toFixed(2)}
          </div>
        </div>

        {/* Stop Loss % */}
        <div className="mb-3">
          <label className="block text-xs text-text-secondary mb-1">Stop Loss %</label>
          <input
            type="number"
            value={stopLossPercent}
            onChange={(e) => setStopLossPercent(e.target.value)}
            step="0.1"
            placeholder="לדוגמא: 2"
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-sm focus:outline-none focus:border-blue-500"
          />
          {stopLoss && (
            <div className="text-xs text-text-secondary mt-1" dir="ltr">
              מחיר SL: ${stopLoss.toFixed(4)}
            </div>
          )}
        </div>

        {/* Take Profit % */}
        <div className="mb-3">
          <label className="block text-xs text-text-secondary mb-1">Take Profit %</label>
          <input
            type="number"
            value={takeProfitPercent}
            onChange={(e) => setTakeProfitPercent(e.target.value)}
            step="0.1"
            placeholder="לדוגמא: 4"
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-sm focus:outline-none focus:border-blue-500"
          />
          {takeProfit && (
            <div className="text-xs text-text-secondary mt-1" dir="ltr">
              מחיר TP: ${takeProfit.toFixed(4)}
            </div>
          )}
        </div>

        {/* ניהול סיכון */}
        <div className="mb-3 p-2 bg-purple-900/20 border border-purple-500/30 rounded">
          <label className="block text-xs text-text-secondary mb-1">סיכון מקסימלי לעסקה (%)</label>
          <input
            type="number"
            value={maxRiskPercent}
            onChange={(e) => setMaxRiskPercent(e.target.value)}
            step="0.1"
            min="0.1"
            max="10"
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-sm focus:outline-none focus:border-purple-500"
          />
          <div className="text-xs text-text-secondary mt-1">
            סיכון בדולרים: ${((equity * parseFloat(maxRiskPercent) / 100) || 0).toFixed(2)}
          </div>
        </div>

        {/* כמות עם כפתור חישוב אוטומטי */}
        <div className="mb-3">
          <label className="block text-xs text-text-secondary mb-1">כמות</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
              step="0.001"
              min="0.001"
              className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded text-sm focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleAutoCalculate}
              disabled={!stopLossPercent}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs font-semibold whitespace-nowrap transition-colors"
              title="חשב כמות אוטומטית לפי הסיכון"
            >
              חשב
            </button>
          </div>
          {stopLossPercent && (
            <div className="text-xs text-text-secondary mt-1">
              כמות מומלצת: {calculateRecommendedQuantity().toFixed(3)} BTC
            </div>
          )}
        </div>

        {/* בחירת כיוון פקודה */}
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setPreviewType('long')}
            className={`px-3 py-2 rounded text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
              previewType === 'long'
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-dark-bg border border-green-600/30 text-green-400 hover:bg-green-600/20'
            }`}
          >
            <TrendingUp size={16} />
            <span>LONG</span>
          </button>
          <button
            onClick={() => setPreviewType('short')}
            className={`px-3 py-2 rounded text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
              previewType === 'short'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-dark-bg border border-red-600/30 text-red-400 hover:bg-red-600/20'
            }`}
          >
            <TrendingDown size={16} />
            <span>SHORT</span>
          </button>
        </div>

        {/* כפתור אישור */}
        <button
          onClick={() => handlePlaceOrder(previewType)}
          className={`w-full px-4 py-3 rounded font-bold text-sm flex flex-col items-center justify-center gap-1 transition-colors ${
            previewType === 'long'
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          <div className="flex items-center gap-2">
            {previewType === 'long' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            <span>{previewType === 'long' ? 'BUY LONG' : 'SELL SHORT'}</span>
          </div>
          <span className="text-xs font-normal opacity-80">
            {previewType === 'long'
              ? (price > currentPrice ? '(Buy Stop)' : '(Buy Limit)')
              : (price < currentPrice ? '(Sell Stop)' : '(Sell Limit)')
            }
          </span>
        </button>

        {/* הסבר */}
        <div className="mt-3 pt-3 border-t border-dark-border text-xs text-text-secondary">
          {price > currentPrice && (
            <div className="mb-1">
              <span className="font-semibold">Stop Order:</span> הפקודה תבוצע כשהמחיר יעלה ל-${price.toFixed(2)}
            </div>
          )}
          {price < currentPrice && (
            <div className="mb-1">
              <span className="font-semibold">Stop Order:</span> הפקודה תבוצע כשהמחיר ירד ל-${price.toFixed(2)}
            </div>
          )}
          {price === currentPrice && (
            <div className="mb-1 text-yellow-400">
              <span className="font-semibold">שים לב:</span> המחיר זהה למחיר הנוכחי
            </div>
          )}
        </div>
      </div>
    </>
  )
}

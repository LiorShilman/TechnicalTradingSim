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

  // קבלת המחיר הנוכחי
  const currentPrice = gameState?.candles[gameState.currentIndex]?.close || 0

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

        {/* כמות */}
        <div className="mb-3">
          <label className="block text-xs text-text-secondary mb-1">כמות</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
            step="0.01"
            min="0.01"
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Stop Loss (אופציונלי) */}
        <div className="mb-3">
          <label className="block text-xs text-text-secondary mb-1">Stop Loss (אופציונלי)</label>
          <input
            type="number"
            value={stopLoss || ''}
            onChange={(e) => setStopLoss(e.target.value ? parseFloat(e.target.value) : undefined)}
            step="0.01"
            placeholder="לא מוגדר"
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Take Profit (אופציונלי) */}
        <div className="mb-4">
          <label className="block text-xs text-text-secondary mb-1">Take Profit (אופציונלי)</label>
          <input
            type="number"
            value={takeProfit || ''}
            onChange={(e) => setTakeProfit(e.target.value ? parseFloat(e.target.value) : undefined)}
            step="0.01"
            placeholder="לא מוגדר"
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-sm focus:outline-none focus:border-blue-500"
          />
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

import { useState } from 'react'
import { TrendingUp, TrendingDown, X } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'

interface PendingOrderMenuProps {
  price: number
  x: number
  y: number
  onClose: () => void
}

export default function PendingOrderMenu({ price, x, y, onClose }: PendingOrderMenuProps) {
  const { gameState, createPendingOrder } = useGameStore()
  const [quantity, setQuantity] = useState(0.01)
  const [stopLoss, setStopLoss] = useState<number | undefined>()
  const [takeProfit, setTakeProfit] = useState<number | undefined>()

  const handlePlaceOrder = async (type: 'long' | 'short') => {
    if (!gameState) return

    await createPendingOrder(type, price, quantity, stopLoss, takeProfit)
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
        className="fixed z-50 bg-dark-panel border border-dark-border rounded-lg shadow-2xl p-4 min-w-[280px]"
        style={{
          left: `${x}px`,
          top: `${y}px`,
          transform: 'translate(-50%, -10px)',
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

        {/* כפתורי פעולה */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handlePlaceOrder('long')}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <TrendingUp size={16} />
            <span>BUY LONG</span>
          </button>
          <button
            onClick={() => handlePlaceOrder('short')}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <TrendingDown size={16} />
            <span>SELL SHORT</span>
          </button>
        </div>

        {/* הסבר */}
        <div className="mt-3 pt-3 border-t border-dark-border text-xs text-text-secondary">
          הפקודה תבוצע אוטומטית כשהמחיר יגיע ל-${price.toFixed(2)}
        </div>
      </div>
    </>
  )
}

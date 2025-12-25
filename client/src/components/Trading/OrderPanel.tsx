import { useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'

export default function OrderPanel() {
  const { gameState, executeTrade, isLoading } = useGameStore()
  const [quantity, setQuantity] = useState('0.1')

  const currentPrice = gameState?.candles[gameState.currentIndex]?.close ?? 0
  const quantityNum = parseFloat(quantity) || 0
  const totalValue = currentPrice * quantityNum

  const handleBuy = async () => {
    if (quantityNum > 0) {
      await executeTrade('buy', quantityNum)
    }
  }

  const canTrade = gameState && !gameState.isComplete && !isLoading

  return (
    <div className="p-4 border-b border-dark-border">
      <h3 className="font-semibold mb-4">פאנל מסחר</h3>

      {/* Current price */}
      <div className="bg-dark-bg rounded-lg p-3 mb-4">
        <div className="text-xs text-text-secondary mb-1">מחיר נוכחי</div>
        <div className="text-2xl font-mono font-bold">
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
        <div className="text-xs text-text-secondary mt-1">
          סה"כ: ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
      </div>

      {/* Trade buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleBuy}
          disabled={!canTrade || quantityNum <= 0}
          className="px-4 py-3 bg-profit hover:bg-green-600 disabled:bg-dark-border disabled:cursor-not-allowed rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <TrendingUp size={20} />
          קנה
        </button>
        
        <button
          disabled={true}
          className="px-4 py-3 bg-dark-border cursor-not-allowed rounded-lg font-semibold flex items-center justify-center gap-2 opacity-50"
          title="סגור פוזיציות דרך רשימת הפוזיציות"
        >
          <TrendingDown size={20} />
          מכור
        </button>
      </div>
    </div>
  )
}

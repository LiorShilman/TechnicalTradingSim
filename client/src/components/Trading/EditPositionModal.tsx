import { useState } from 'react'
import { X, TrendingUp, TrendingDown } from 'lucide-react'
import type { Position, PendingOrder } from '@/types/game.types'

interface EditPositionModalProps {
  position?: Position
  pendingOrder?: PendingOrder
  currentPrice: number
  assetSymbol?: string
  onClose: () => void
  onSave: (updates: {
    stopLoss?: number
    takeProfit?: number
    quantity?: number
    targetPrice?: number
  }) => void
}

export default function EditPositionModal({
  position,
  pendingOrder,
  currentPrice,
  assetSymbol = 'BTC/USD',
  onClose,
  onSave,
}: EditPositionModalProps) {
  const isPosition = !!position
  const isPendingOrder = !!pendingOrder

  // Initialize state based on whether it's a position or pending order
  // Use string state for inputs to preserve decimal formatting (e.g., "0.7550")
  const [stopLoss, setStopLoss] = useState<string>(
    position?.stopLoss?.toString() || pendingOrder?.stopLoss?.toString() || ''
  )
  const [takeProfit, setTakeProfit] = useState<string>(
    position?.takeProfit?.toString() || pendingOrder?.takeProfit?.toString() || ''
  )
  const [quantity, setQuantity] = useState<string>(
    (position?.quantity || pendingOrder?.quantity || 0).toString()
  )
  const [targetPrice, setTargetPrice] = useState<string>(
    (pendingOrder?.targetPrice || 0).toString()
  )

  const positionType = position?.type || pendingOrder?.type || 'long'

  // Calculate SL/TP percentages for display
  const calculateSLPercent = (): number | null => {
    const slValue = parseFloat(stopLoss)
    if (!stopLoss || isNaN(slValue)) return null
    const basePrice = isPosition ? position!.entryPrice : parseFloat(targetPrice)
    const diff = positionType === 'long' ? basePrice - slValue : slValue - basePrice
    return (diff / basePrice) * 100
  }

  const calculateTPPercent = (): number | null => {
    const tpValue = parseFloat(takeProfit)
    if (!takeProfit || isNaN(tpValue)) return null
    const basePrice = isPosition ? position!.entryPrice : parseFloat(targetPrice)
    const diff = positionType === 'long' ? tpValue - basePrice : basePrice - tpValue
    return (diff / basePrice) * 100
  }

  // Calculate R:R ratio
  const calculateRiskReward = (): string => {
    const slPercent = calculateSLPercent()
    const tpPercent = calculateTPPercent()
    if (slPercent === null || tpPercent === null || slPercent === 0) return 'N/A'
    const ratio = tpPercent / slPercent
    return `1:${ratio.toFixed(2)}`
  }

  const handleSave = () => {
    const updates: {
      stopLoss?: number
      takeProfit?: number
      quantity?: number
      targetPrice?: number
    } = {}

    const slValue = parseFloat(stopLoss)
    const tpValue = parseFloat(takeProfit)

    if (stopLoss && !isNaN(slValue)) updates.stopLoss = slValue
    if (takeProfit && !isNaN(tpValue)) updates.takeProfit = tpValue

    if (isPendingOrder) {
      const qtyValue = parseFloat(quantity)
      const priceValue = parseFloat(targetPrice)
      if (!isNaN(qtyValue)) updates.quantity = qtyValue
      if (!isNaN(priceValue)) updates.targetPrice = priceValue
    }

    onSave(updates)
    onClose()
  }

  const slPercent = calculateSLPercent()
  const tpPercent = calculateTPPercent()
  const rrRatio = calculateRiskReward()

  // Color code R:R ratio
  const getRRColor = () => {
    if (rrRatio === 'N/A') return 'text-text-secondary'
    const ratio = parseFloat(rrRatio.split(':')[1])
    if (ratio >= 2) return 'text-green-400'
    if (ratio >= 1) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <>
      {/* רקע שקוף */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* המודל */}
      <div
        className="fixed z-50 bg-dark-panel border border-dark-border rounded-lg shadow-2xl p-4 min-w-[320px] max-w-[90vw]"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* כותרת */}
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-dark-border">
          <div className="text-sm font-bold text-text-primary">
            {isPosition ? 'עריכת פוזיציה' : 'עריכת פקודה עתידית'}
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* פרטי הפוזיציה/פקודה */}
        <div className="mb-3 p-2 bg-blue-900/20 border border-blue-500/30 rounded">
          <div className="flex items-center gap-2 mb-2">
            {positionType === 'long' ? (
              <div className="flex items-center gap-1 text-green-400">
                <TrendingUp size={16} />
                <span className="font-bold text-xs">LONG</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-red-400">
                <TrendingDown size={16} />
                <span className="font-bold text-xs">SHORT</span>
              </div>
            )}
            <div className="text-xs text-text-secondary" dir="ltr">
              {isPosition
                ? `Entry: $${position!.entryPrice.toFixed(4)}`
                : `Target: $${parseFloat(targetPrice || '0').toFixed(4)}`}
            </div>
          </div>
          <div className="text-xs text-text-secondary" dir="ltr">
            כמות: {parseFloat(quantity || '0').toFixed(4)} {assetSymbol}
          </div>
          {isPosition && (
            <div className="text-xs text-text-secondary" dir="ltr">
              מחיר נוכחי: ${currentPrice.toFixed(4)}
            </div>
          )}
        </div>

        {/* עריכת Target Price (רק לפקודות עתידיות) */}
        {isPendingOrder && (
          <div className="mb-3">
            <label className="block text-xs text-text-secondary mb-1">
              מחיר יעד
            </label>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              value={targetPrice}
              onChange={(e) => {
                const value = e.target.value
                // Allow empty, numbers, and decimal point
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setTargetPrice(value)
                }
              }}
              placeholder="0.0000"
              dir="ltr"
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        {/* עריכת כמות (רק לפקודות עתידיות) */}
        {isPendingOrder && (
          <div className="mb-3">
            <label className="block text-xs text-text-secondary mb-1">
              כמות
            </label>
            <input
              type="text"
              inputMode="decimal"
              pattern="[0-9]*\.?[0-9]*"
              value={quantity}
              onChange={(e) => {
                const value = e.target.value
                // Allow empty, numbers, and decimal point
                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                  setQuantity(value)
                }
              }}
              placeholder="0.001"
              dir="ltr"
              className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        {/* Stop Loss */}
        <div className="mb-3">
          <label className="block text-xs text-text-secondary mb-1">
            Stop Loss
          </label>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*\.?[0-9]*"
            value={stopLoss}
            onChange={(e) => {
              const value = e.target.value
              // Allow empty, numbers, and decimal point
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setStopLoss(value)
              }
            }}
            placeholder="לא מוגדר"
            dir="ltr"
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-sm focus:outline-none focus:border-blue-500"
          />
          {slPercent !== null && (
            <div className="text-xs text-red-400 mt-1" dir="ltr">
              סיכון: {slPercent.toFixed(2)}%
            </div>
          )}
        </div>

        {/* Take Profit */}
        <div className="mb-3">
          <label className="block text-xs text-text-secondary mb-1">
            Take Profit
          </label>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*\.?[0-9]*"
            value={takeProfit}
            onChange={(e) => {
              const value = e.target.value
              // Allow empty, numbers, and decimal point
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setTakeProfit(value)
              }
            }}
            placeholder="לא מוגדר"
            dir="ltr"
            className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-sm focus:outline-none focus:border-blue-500"
          />
          {tpPercent !== null && (
            <div className="text-xs text-green-400 mt-1" dir="ltr">
              רווח פוטנציאלי: {tpPercent.toFixed(2)}%
            </div>
          )}
        </div>

        {/* Risk:Reward Ratio */}
        {slPercent !== null && tpPercent !== null && (
          <div className="mb-4 p-2 bg-dark-bg rounded">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">יחס סיכון:רווח</span>
              <span className={`text-sm font-bold ${getRRColor()}`} dir="ltr">
                {rrRatio}
              </span>
            </div>
          </div>
        )}

        {/* כפתורי פעולה */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-dark-border hover:bg-dark-border/80 rounded font-bold text-sm transition-colors"
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-bold text-sm transition-colors"
          >
            שמור שינויים
          </button>
        </div>
      </div>
    </>
  )
}

import { useState, memo } from 'react'
import { XCircle, TrendingUp, TrendingDown, Clock, Edit2 } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import EditPositionModal from './EditPositionModal'
import type { PendingOrder } from '@/types/game.types'

// Helper functions (pure, no dependencies)
const getOrderTypeLabel = (orderType: string): string => {
  switch (orderType) {
    case 'buyStop': return 'Buy Stop'
    case 'buyLimit': return 'Buy Limit'
    case 'sellStop': return 'Sell Stop'
    case 'sellLimit': return 'Sell Limit'
    default: return orderType
  }
}

const getOrderTypeColor = (orderType: string): string => {
  if (orderType.startsWith('buy')) return 'text-green-400'
  return 'text-red-400'
}

// קומפוננטה ממוזערת לכרטיס פקודה ממתינה - מתרנדרת רק כשהמחיר משתנה
interface PendingOrderCardProps {
  order: PendingOrder
  currentPrice: number
  assetSymbol: string
  onEdit: (order: PendingOrder) => void
  onCancel: (orderId: string) => void
}

const PendingOrderCard = memo(({ order, currentPrice, assetSymbol, onEdit, onCancel }: PendingOrderCardProps) => {
  const diff = order.targetPrice - currentPrice
  const percent = (diff / currentPrice) * 100
  const isLong = order.type === 'long'

  return (
    <div
      className={`p-3 rounded-lg border transition-all ${
        isLong
          ? 'bg-green-900/10 border-green-500/30 hover:border-green-500/50'
          : 'bg-red-900/10 border-red-500/30 hover:border-red-500/50'
      }`}
    >
      {/* Header: Type and Action Buttons */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isLong ? (
            <TrendingUp size={14} className="text-green-400" />
          ) : (
            <TrendingDown size={14} className="text-red-400" />
          )}
          <span className={`text-xs font-bold ${isLong ? 'text-green-400' : 'text-red-400'}`}>
            {isLong ? 'LONG' : 'SHORT'}
          </span>
          <span className={`text-xs ${getOrderTypeColor(order.orderType)}`}>
            {getOrderTypeLabel(order.orderType)}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(order)}
            className="text-text-secondary hover:text-blue-400 transition-colors"
            title="ערוך פקודה"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={() => onCancel(order.id)}
            className="text-text-secondary hover:text-red-400 transition-colors"
            title="ביטול פקודה"
          >
            <XCircle size={16} />
          </button>
        </div>
      </div>

      {/* Price Info */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <div className="text-[10px] text-text-secondary">מחיר יעד</div>
          <div className="text-sm font-bold" dir="ltr">
            ${order.targetPrice.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-text-secondary">כמות</div>
          <div className="text-sm font-bold" dir="ltr">
            {order.quantity.toFixed(3)} {assetSymbol}
          </div>
        </div>
      </div>

      {/* Distance from Current Price */}
      <div className="mb-2 p-2 bg-dark-bg/50 rounded border border-dark-border">
        <div className="text-[10px] text-text-secondary mb-1">מרחק מהמחיר הנוכחי</div>
        <div className="flex items-center justify-between" dir="ltr">
          <div className={`text-xs font-semibold ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {diff > 0 ? '+' : ''}{diff.toFixed(2)} $
          </div>
          <div className={`text-xs font-semibold ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {percent > 0 ? '+' : ''}{percent.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* SL/TP */}
      {(order.stopLoss || order.takeProfit) && (
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          {order.stopLoss && (
            <div className="flex items-center justify-between bg-red-900/20 border border-red-500/20 rounded px-2 py-1">
              <span className="text-text-secondary">SL:</span>
              <span className="font-semibold text-red-400" dir="ltr">
                ${order.stopLoss.toFixed(2)}
              </span>
            </div>
          )}
          {order.takeProfit && (
            <div className="flex items-center justify-between bg-green-900/20 border border-green-500/20 rounded px-2 py-1">
              <span className="text-text-secondary">TP:</span>
              <span className="font-semibold text-green-400" dir="ltr">
                ${order.takeProfit.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
})
PendingOrderCard.displayName = 'PendingOrderCard'

export default function PendingOrdersList() {
  const pendingOrders = useGameStore(state => state.gameState?.pendingOrders ?? [])
  const currentPrice = useGameStore(state => {
    const gs = state.gameState
    return gs?.candles[gs.currentIndex]?.close ?? 0
  })
  const assetSymbol = useGameStore(state => state.gameState?.asset ?? 'BTC/USD')
  const cancelPendingOrder = useGameStore(state => state.cancelPendingOrder)
  const updatePendingOrder = useGameStore(state => state.updatePendingOrder)

  const [editingOrder, setEditingOrder] = useState<PendingOrder | null>(null)

  if (pendingOrders.length === 0) {
    return (
      <div className="flex-shrink-0 p-4 border-2 border-purple-500/30 rounded-lg bg-dark-panel/20 mb-4 mx-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Clock size={16} className="text-blue-400" />
            פקודות עתידיות
          </h3>
          <div className="text-xs text-text-secondary">0 פקודות</div>
        </div>
        <div className="text-xs text-text-secondary text-center py-3 border border-dark-border rounded bg-dark-bg/30">
          אין פקודות עתידיות
        </div>
      </div>
    )
  }

  const handleEdit = (order: PendingOrder) => {
    setEditingOrder(order)
  }

  const handleSaveEdit = async (updates: {
    targetPrice?: number
    quantity?: number
    stopLoss?: number
    takeProfit?: number
  }) => {
    if (editingOrder) {
      await updatePendingOrder(editingOrder.id, updates)
    }
  }

  return (
    <div className="flex-shrink-0 p-4 border-2 border-purple-500/30 rounded-lg bg-dark-panel/20 mb-4 mx-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Clock size={16} className="text-blue-400" />
          פקודות עתידיות
        </h3>
        <div className="text-xs text-text-secondary">
          {pendingOrders.length} {pendingOrders.length === 1 ? 'פקודה' : 'פקודות'}
        </div>
      </div>

      <div className="space-y-2">
        {pendingOrders.map((order) => (
          <PendingOrderCard
            key={order.id}
            order={order}
            currentPrice={currentPrice}
            assetSymbol={assetSymbol}
            onEdit={handleEdit}
            onCancel={cancelPendingOrder}
          />
        ))}
      </div>

      {/* Edit Pending Order Modal */}
      {editingOrder && (
        <EditPositionModal
          pendingOrder={editingOrder}
          currentPrice={currentPrice}
          assetSymbol={assetSymbol}
          onClose={() => setEditingOrder(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  )
}

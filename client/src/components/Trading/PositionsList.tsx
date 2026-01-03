import { useState, memo } from 'react'
import { XCircle, Edit2 } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import EditPositionModal from './EditPositionModal'
import type { Position } from '@/types/game.types'

// קומפוננטה ממוזערת לכרטיס פוזיציה בודדת - מתרנדרת רק כש-PnL משתנה
interface PositionCardProps {
  position: Position
  assetSymbol: string
  onEdit: (position: Position) => void
  onClose: (positionId: string) => void
  isLoading: boolean
}

const PositionCard = memo(({ position, assetSymbol, onEdit, onClose, isLoading }: PositionCardProps) => {
  const isProfitable = position.currentPnL >= 0

  return (
    <div
      className="bg-dark-bg rounded-lg p-3 border-r-4"
      style={{ borderColor: isProfitable ? '#00c853' : '#ff1744' }}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-xs text-text-secondary">
            {position.type === 'long' ? '📈 Long' : '📉 Short'}
          </div>
          <div className="font-mono font-semibold" dir="ltr">
            {position.quantity.toFixed(4)} {assetSymbol}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(position)}
            disabled={isLoading}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-dark-border disabled:cursor-not-allowed rounded-md text-xs font-semibold transition-colors flex items-center gap-1"
            title="ערוך פוזיציה"
          >
            <Edit2 size={14} />
            Edit
          </button>
          <button
            onClick={() => onClose(position.id)}
            disabled={isLoading}
            className="px-2 py-1 bg-loss hover:bg-red-700 disabled:bg-dark-border disabled:cursor-not-allowed rounded-md text-xs font-semibold transition-colors flex items-center gap-1"
            title="סגור פוזיציה"
          >
            <XCircle size={14} />
            Close
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
        <div>
          <span className="text-text-secondary">כניסה: </span>
          <span className="font-mono" dir="ltr">${position.entryPrice.toFixed(4)}</span>
        </div>
        <div>
          <span className="text-text-secondary">נר: </span>
          <span className="font-mono">#{position.entryIndex}</span>
        </div>
      </div>

      <div className={`text-sm font-semibold ${isProfitable ? 'text-profit' : 'text-loss'}`} dir="ltr">
        {isProfitable ? '+' : ''}${position.currentPnL.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        <span className="text-xs ml-1">
          ({isProfitable ? '+' : ''}{position.currentPnLPercent.toFixed(2)}%)
        </span>
      </div>

      {/* Stop Loss / Take Profit */}
      {(position.stopLoss || position.takeProfit) && (
        <div className="mt-2 pt-2 border-t border-dark-border grid grid-cols-2 gap-2 text-xs">
          {position.stopLoss && (
            <div>
              <span className="text-red-400">🛑 SL: </span>
              <span className="font-mono" dir="ltr">${position.stopLoss.toFixed(4)}</span>
            </div>
          )}
          {position.takeProfit && (
            <div>
              <span className="text-green-400">🎯 TP: </span>
              <span className="font-mono" dir="ltr">${position.takeProfit.toFixed(4)}</span>
            </div>
          )}
        </div>
      )}

      {position.patternEntry && (
        <div className="mt-2 pt-2 border-t border-dark-border">
          <div className="text-xs text-text-secondary">
            תבנית: {position.patternEntry.patternType}
          </div>
          <div className="text-xs">
            איכות כניסה: {position.patternEntry.entryQuality}/100
          </div>
        </div>
      )}
    </div>
  )
})
PositionCard.displayName = 'PositionCard'

export default function PositionsList() {
  const positions = useGameStore(state => state.gameState?.positions ?? [])
  const assetSymbol = useGameStore(state => state.gameState?.asset ?? 'BTC/USD')
  const currentPrice = useGameStore(state => {
    const gs = state.gameState
    return gs?.candles[gs.currentIndex]?.close ?? 0
  })
  const executeTrade = useGameStore(state => state.executeTrade)
  const updatePosition = useGameStore(state => state.updatePosition)
  const isLoading = useGameStore(state => state.isLoading)

  const [editingPosition, setEditingPosition] = useState<Position | null>(null)

  if (!positions) return null

  const handleClose = async (positionId: string) => {
    const position = positions.find(p => p.id === positionId)
    if (position) {
      await executeTrade('sell', position.quantity, positionId)
    }
  }

  const handleEdit = (position: Position) => {
    setEditingPosition(position)
  }

  const handleSaveEdit = async (updates: { stopLoss?: number; takeProfit?: number }) => {
    if (editingPosition) {
      await updatePosition(editingPosition.id, updates)
    }
  }

  return (
    <div className="flex-shrink-0 p-4 border-2 border-purple-500/30 rounded-lg bg-dark-panel/20 mb-4 mx-4">
      <h3 className="font-semibold mb-4">פוזיציות פתוחות ({positions.length})</h3>

      {positions.length === 0 ? (
        <div className="text-center text-text-secondary py-8 text-sm">
          אין פוזיציות פתוחות
        </div>
      ) : (
        <div className="space-y-2">
          {positions.map((position) => (
            <PositionCard
              key={position.id}
              position={position}
              assetSymbol={assetSymbol}
              onEdit={handleEdit}
              onClose={handleClose}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}

      {/* Edit Position Modal */}
      {editingPosition && (
        <EditPositionModal
          position={editingPosition}
          currentPrice={currentPrice}
          assetSymbol={assetSymbol}
          onClose={() => setEditingPosition(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  )
}

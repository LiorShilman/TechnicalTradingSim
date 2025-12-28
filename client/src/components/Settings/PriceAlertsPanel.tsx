import { useState } from 'react'
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { PriceAlert } from '../../types/game.types'

interface PriceAlertsPanelProps {
  priceAlerts: PriceAlert[]
  onAddAlert: (alert: Omit<PriceAlert, 'id' | 'createdAt'>) => void
  onRemoveAlert: (id: string) => void
  onToggleAlert: (id: string) => void
  currentPrice: number
}

export default function PriceAlertsPanel({
  priceAlerts,
  onAddAlert,
  onRemoveAlert,
  onToggleAlert,
  currentPrice,
}: PriceAlertsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [newAlertPrice, setNewAlertPrice] = useState('')
  const [newAlertDirection, setNewAlertDirection] = useState<'above' | 'below'>('above')
  const [newAlertNote, setNewAlertNote] = useState('')

  const handleAddAlert = () => {
    const price = parseFloat(newAlertPrice)
    if (isNaN(price) || price <= 0) {
      return
    }

    onAddAlert({
      targetPrice: price,
      direction: newAlertDirection,
      enabled: true,
      createdAtPrice: currentPrice,
      note: newAlertNote.trim() || undefined,
    })

    // איפוס טופס
    setNewAlertPrice('')
    setNewAlertNote('')
  }

  // מיון לפי מחיר
  const sortedAlerts = [...priceAlerts].sort((a, b) => b.targetPrice - a.targetPrice)

  return (
    <div className="absolute top-[116px] left-2 z-10 bg-dark-panel/95 border border-dark-border rounded-lg shadow-lg overflow-hidden w-[280px]">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between gap-2 hover:bg-dark-bg/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-yellow-400" />
          <span className="text-sm font-bold text-text-primary">Price Alerts</span>
          {priceAlerts.filter(a => a.enabled).length > 0 && (
            <span className="text-xs bg-yellow-600 px-1.5 py-0.5 rounded">
              {priceAlerts.filter(a => a.enabled).length}
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 py-2 border-t border-dark-border space-y-3">
          {/* Add new alert form */}
          <div className="space-y-2 pb-2 border-b border-dark-border">
            <div className="text-xs font-semibold text-text-secondary">הוסף התראה חדשה</div>

            {/* Price input */}
            <div className="flex gap-2">
              <input
                type="number"
                value={newAlertPrice}
                onChange={(e) => setNewAlertPrice(e.target.value)}
                placeholder="מחיר"
                step="0.01"
                className="flex-1 px-2 py-1.5 bg-dark-bg border border-dark-border rounded text-xs focus:outline-none focus:border-blue-500"
              />
              <select
                value={newAlertDirection}
                onChange={(e) => setNewAlertDirection(e.target.value as 'above' | 'below')}
                className="px-2 py-1.5 bg-dark-bg border border-dark-border rounded text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="above">מעל ↑</option>
                <option value="below">מתחת ↓</option>
              </select>
            </div>

            {/* Note input */}
            <input
              type="text"
              value={newAlertNote}
              onChange={(e) => setNewAlertNote(e.target.value)}
              placeholder="הערה (אופציונלי)"
              maxLength={50}
              className="w-full px-2 py-1.5 bg-dark-bg border border-dark-border rounded text-xs focus:outline-none focus:border-blue-500"
            />

            {/* Add button */}
            <button
              onClick={handleAddAlert}
              disabled={!newAlertPrice || parseFloat(newAlertPrice) <= 0}
              className="w-full px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
            >
              <Plus size={12} />
              <span>הוסף התראה</span>
            </button>
          </div>

          {/* Alerts list */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sortedAlerts.length === 0 ? (
              <div className="text-xs text-text-secondary text-center py-4">
                אין התראות פעילות
              </div>
            ) : (
              sortedAlerts.map((alert) => {
                const distance = alert.targetPrice - currentPrice
                const distancePercent = (distance / currentPrice) * 100

                return (
                  <div
                    key={alert.id}
                    className={`p-2 rounded border ${
                      alert.enabled
                        ? 'bg-dark-bg/50 border-dark-border'
                        : 'bg-dark-bg/20 border-dark-border/50 opacity-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-start gap-2 flex-1">
                        <button
                          onClick={() => onToggleAlert(alert.id)}
                          className="text-text-secondary hover:text-text-primary transition-colors mt-0.5"
                          title={alert.enabled ? 'השבת' : 'הפעל'}
                        >
                          {alert.enabled ? (
                            <ToggleRight size={16} className="text-yellow-400" />
                          ) : (
                            <ToggleLeft size={16} />
                          )}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">
                              ${alert.targetPrice.toFixed(2)}
                            </span>
                            <span className={`text-xs ${
                              alert.direction === 'above' ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {alert.direction === 'above' ? '↑' : '↓'}
                            </span>
                          </div>
                          {alert.note && (
                            <div className="text-[10px] text-text-secondary mt-0.5">
                              {alert.note}
                            </div>
                          )}
                          <div className={`text-[10px] mt-1 ${
                            Math.abs(distancePercent) < 1 ? 'text-yellow-400 font-semibold' : 'text-text-secondary'
                          }`}>
                            {distance > 0 ? '+' : ''}{distance.toFixed(2)}$ ({distancePercent > 0 ? '+' : ''}{distancePercent.toFixed(2)}%)
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onRemoveAlert(alert.id)}
                        className="text-text-secondary hover:text-red-400 transition-colors"
                        title="מחק"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Info */}
          {sortedAlerts.length > 0 && (
            <div className="pt-2 border-t border-dark-border">
              <p className="text-[10px] text-text-secondary">
                מחיר נוכחי: <span className="font-semibold">${currentPrice.toFixed(2)}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

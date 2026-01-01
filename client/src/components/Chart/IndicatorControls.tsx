import { useState, useEffect } from 'react'
import { TrendingUp, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'

export interface MovingAverage {
  id: string // unique identifier
  enabled: boolean
  type: 'SMA' | 'EMA'
  period: number
  color: string // color for this MA
}

export interface MASettings {
  movingAverages: MovingAverage[]
  startFromCurrentIndex: boolean // אם true, חישוב מהנר הנוכחי בלבד
}

interface IndicatorControlsProps {
  onMASettingsChange: (settings: MASettings) => void
}

const STORAGE_KEY = 'trading-game-ma-settings-v3' // v3 for array-based structure

const DEFAULT_MA_COLORS = ['#3b82f6', '#f97316', '#ef4444', '#22c55e', '#a855f7', '#ec4899', '#14b8a6', '#f59e0b']

const DEFAULT_SETTINGS: MASettings = {
  movingAverages: [
    { id: 'ma-1', enabled: false, type: 'SMA', period: 20, color: '#3b82f6' },
    { id: 'ma-2', enabled: false, type: 'SMA', period: 50, color: '#f97316' },
    { id: 'ma-3', enabled: false, type: 'SMA', period: 200, color: '#ef4444' },
  ],
  startFromCurrentIndex: true,
}

export default function IndicatorControls({ onMASettingsChange }: IndicatorControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [maSettings, setMASettings] = useState<MASettings>(DEFAULT_SETTINGS)

  // טעינת הגדרות מ-localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setMASettings(parsed)
        onMASettingsChange(parsed)
      } catch (e) {
        console.error('Failed to parse MA settings from localStorage', e)
      }
    }
  }, [onMASettingsChange])

  const handleUpdateMA = (id: string, updates: Partial<MovingAverage>) => {
    const newSettings = {
      ...maSettings,
      movingAverages: maSettings.movingAverages.map(ma =>
        ma.id === id ? { ...ma, ...updates } : ma
      ),
    }
    setMASettings(newSettings)
    onMASettingsChange(newSettings)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
  }

  const handleAddMA = () => {
    const usedColors = maSettings.movingAverages.map(ma => ma.color)
    const availableColor = DEFAULT_MA_COLORS.find(c => !usedColors.includes(c)) || DEFAULT_MA_COLORS[0]

    const newMA: MovingAverage = {
      id: `ma-${Date.now()}`,
      enabled: true,
      type: 'SMA',
      period: 20,
      color: availableColor,
    }

    const newSettings = {
      ...maSettings,
      movingAverages: [...maSettings.movingAverages, newMA],
    }
    setMASettings(newSettings)
    onMASettingsChange(newSettings)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
  }

  const handleRemoveMA = (id: string) => {
    const newSettings = {
      ...maSettings,
      movingAverages: maSettings.movingAverages.filter(ma => ma.id !== id),
    }
    setMASettings(newSettings)
    onMASettingsChange(newSettings)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
  }

  const handleToggleCalculationMode = () => {
    const newSettings = {
      ...maSettings,
      startFromCurrentIndex: !maSettings.startFromCurrentIndex,
    }
    setMASettings(newSettings)
    onMASettingsChange(newSettings)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
  }

  return (
    <div className="absolute top-2 left-2 z-10 bg-dark-panel/95 border border-dark-border rounded-lg shadow-lg overflow-hidden w-[280px]">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between gap-2 hover:bg-dark-bg/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-400" />
          <span className="text-sm font-bold text-text-primary">Indicators</span>
        </div>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* Expanded controls */}
      {isExpanded && (
        <div className="px-3 py-2 border-t border-dark-border space-y-3">
          {/* Header with Add button */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-text-secondary">Moving Averages</div>
            <button
              onClick={handleAddMA}
              className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-semibold transition-colors"
            >
              <Plus size={12} />
              <span>הוסף</span>
            </button>
          </div>

          {/* Moving Averages List */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {maSettings.movingAverages.map((ma, index) => (
              <div key={ma.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 hover:bg-dark-bg/30 px-2 py-1 rounded transition-colors">
                  <label className="flex items-center gap-2 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ma.enabled}
                      onChange={(e) => handleUpdateMA(ma.id, { enabled: e.target.checked })}
                      className="w-4 h-4 rounded border-dark-border bg-dark-bg checked:bg-blue-600 checked:border-blue-600 cursor-pointer"
                    />
                    <div className="w-3 h-0.5 rounded" style={{ backgroundColor: ma.color }}></div>
                    <span className="text-sm font-semibold">MA {index + 1}</span>
                    <span className="text-xs text-text-secondary">({ma.type} {ma.period})</span>
                  </label>
                  <button
                    onClick={() => handleRemoveMA(ma.id)}
                    className="text-text-secondary hover:text-red-400 transition-colors"
                    title="מחק ממוצע נע"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {ma.enabled && (
                  <div className="ml-5 pl-2 border-l-2 border-dark-border space-y-1.5">
                    {/* Type selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary w-12">Type:</span>
                      <select
                        value={ma.type}
                        onChange={(e) => handleUpdateMA(ma.id, { type: e.target.value as 'SMA' | 'EMA' })}
                        className="flex-1 px-2 py-1 bg-dark-bg border border-dark-border rounded text-xs focus:outline-none focus:border-blue-500"
                      >
                        <option value="SMA">SMA</option>
                        <option value="EMA">EMA</option>
                      </select>
                    </div>

                    {/* Period input */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary w-12">Period:</span>
                      <input
                        type="number"
                        value={ma.period}
                        onChange={(e) => handleUpdateMA(ma.id, { period: parseInt(e.target.value) || 1 })}
                        min="1"
                        max="500"
                        dir="ltr"
                        className="flex-1 px-2 py-1 bg-dark-bg border border-dark-border rounded text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    {/* Color picker */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary w-12">Color:</span>
                      <input
                        type="color"
                        value={ma.color}
                        onChange={(e) => handleUpdateMA(ma.id, { color: e.target.value })}
                        className="flex-1 h-7 bg-dark-bg border border-dark-border rounded cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Calculation mode */}
          <div className="pt-2 mt-2 border-t border-dark-border">
            <label className="flex items-start gap-2 cursor-pointer hover:bg-dark-bg/30 px-2 py-1 rounded transition-colors">
              <input
                type="checkbox"
                checked={maSettings.startFromCurrentIndex}
                onChange={handleToggleCalculationMode}
                className="w-4 h-4 mt-0.5 rounded border-dark-border bg-dark-bg checked:bg-green-600 checked:border-green-600 cursor-pointer"
              />
              <div>
                <div className="text-xs font-semibold">חישוב מהנר הנוכחי</div>
                <div className="text-[10px] text-text-secondary leading-tight">
                  סימולציה מציאותית - ממוצע מחושב מהנקודה הנוכחית בלבד
                </div>
              </div>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

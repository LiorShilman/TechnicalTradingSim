import { useState, useEffect } from 'react'
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'

export interface MovingAverage {
  enabled: boolean
  type: 'SMA' | 'EMA'
  period: number
}

export interface MASettings {
  ma1: MovingAverage
  ma2: MovingAverage
  ma3: MovingAverage
  startFromCurrentIndex: boolean // אם true, חישוב מהנר הנוכחי בלבד
}

interface IndicatorControlsProps {
  onMASettingsChange: (settings: MASettings) => void
}

const STORAGE_KEY = 'trading-game-ma-settings-v2' // v2 for new structure

const DEFAULT_SETTINGS: MASettings = {
  ma1: { enabled: false, type: 'SMA', period: 20 },
  ma2: { enabled: false, type: 'SMA', period: 50 },
  ma3: { enabled: false, type: 'SMA', period: 200 },
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

  const handleUpdateMA = (maKey: 'ma1' | 'ma2' | 'ma3', updates: Partial<MovingAverage>) => {
    const newSettings = {
      ...maSettings,
      [maKey]: { ...maSettings[maKey], ...updates },
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

  const MASetting = ({ maKey, label, color }: { maKey: 'ma1' | 'ma2' | 'ma3'; label: string; color: string }) => {
    const ma = maSettings[maKey]
    return (
      <div className="space-y-1">
        <label className="flex items-center justify-between gap-2 cursor-pointer hover:bg-dark-bg/30 px-2 py-1 rounded transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 rounded" style={{ backgroundColor: color }}></div>
            <span className="text-sm font-semibold">{label}</span>
          </div>
          <input
            type="checkbox"
            checked={ma.enabled}
            onChange={(e) => handleUpdateMA(maKey, { enabled: e.target.checked })}
            className="w-4 h-4 rounded border-dark-border bg-dark-bg checked:bg-blue-600 checked:border-blue-600 cursor-pointer"
          />
        </label>

        {ma.enabled && (
          <div className="ml-5 pl-2 border-l-2 border-dark-border space-y-1.5">
            {/* Type selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary w-12">Type:</span>
              <select
                value={ma.type}
                onChange={(e) => handleUpdateMA(maKey, { type: e.target.value as 'SMA' | 'EMA' })}
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
                onChange={(e) => handleUpdateMA(maKey, { period: parseInt(e.target.value) || 1 })}
                min="1"
                max="500"
                className="flex-1 px-2 py-1 bg-dark-bg border border-dark-border rounded text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="absolute top-2 left-2 z-10 bg-dark-panel/95 border border-dark-border rounded-lg shadow-lg overflow-hidden">
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
          {/* Moving Averages */}
          <div className="text-xs font-semibold text-text-secondary mb-2">Moving Averages</div>

          <MASetting maKey="ma1" label="MA 1" color="#3b82f6" />
          <MASetting maKey="ma2" label="MA 2" color="#f97316" />
          <MASetting maKey="ma3" label="MA 3" color="#ef4444" />

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

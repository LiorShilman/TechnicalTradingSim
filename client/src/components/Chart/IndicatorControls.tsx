import { useState, useEffect } from 'react'
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'

export interface MASettings {
  ma20: boolean
  ma50: boolean
  ma200: boolean
  startFromCurrentIndex: boolean // אם true, חישוב מהנר הנוכחי בלבד
}

interface IndicatorControlsProps {
  onMASettingsChange: (settings: MASettings) => void
}

const STORAGE_KEY = 'trading-game-ma-settings'

export default function IndicatorControls({ onMASettingsChange }: IndicatorControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [maSettings, setMASettings] = useState<MASettings>({
    ma20: false,
    ma50: false,
    ma200: false,
    startFromCurrentIndex: true, // ברירת מחדל: חישוב מהנר הנוכחי
  })

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
  }, [])

  const handleToggleMA = (ma: keyof MASettings) => {
    const newSettings = {
      ...maSettings,
      [ma]: !maSettings[ma],
    }
    setMASettings(newSettings)
    onMASettingsChange(newSettings)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
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
        <div className="px-3 py-2 border-t border-dark-border space-y-2">
          {/* Moving Averages */}
          <div className="text-xs font-semibold text-text-secondary mb-2">Moving Averages</div>

          <label className="flex items-center justify-between gap-2 cursor-pointer hover:bg-dark-bg/30 px-2 py-1 rounded transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-blue-500 rounded"></div>
              <span className="text-sm">MA 20</span>
            </div>
            <input
              type="checkbox"
              checked={maSettings.ma20}
              onChange={() => handleToggleMA('ma20')}
              className="w-4 h-4 rounded border-dark-border bg-dark-bg checked:bg-blue-600 checked:border-blue-600 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between gap-2 cursor-pointer hover:bg-dark-bg/30 px-2 py-1 rounded transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-orange-500 rounded"></div>
              <span className="text-sm">MA 50</span>
            </div>
            <input
              type="checkbox"
              checked={maSettings.ma50}
              onChange={() => handleToggleMA('ma50')}
              className="w-4 h-4 rounded border-dark-border bg-dark-bg checked:bg-orange-600 checked:border-orange-600 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between gap-2 cursor-pointer hover:bg-dark-bg/30 px-2 py-1 rounded transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-red-500 rounded"></div>
              <span className="text-sm">MA 200</span>
            </div>
            <input
              type="checkbox"
              checked={maSettings.ma200}
              onChange={() => handleToggleMA('ma200')}
              className="w-4 h-4 rounded border-dark-border bg-dark-bg checked:bg-red-600 checked:border-red-600 cursor-pointer"
            />
          </label>

          {/* Calculation mode */}
          <div className="pt-2 mt-2 border-t border-dark-border">
            <label className="flex items-start gap-2 cursor-pointer hover:bg-dark-bg/30 px-2 py-1 rounded transition-colors">
              <input
                type="checkbox"
                checked={maSettings.startFromCurrentIndex}
                onChange={() => handleToggleMA('startFromCurrentIndex')}
                className="w-4 h-4 mt-0.5 rounded border-dark-border bg-dark-bg checked:bg-green-600 checked:border-green-600 cursor-pointer"
              />
              <div className="flex-1">
                <div className="text-xs font-semibold">מאוזן מנקודה נוכחית</div>
                <div className="text-[10px] text-text-secondary mt-0.5">
                  חישוב רק מהנרות הגלויים (מדמה זמן אמת)
                </div>
              </div>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

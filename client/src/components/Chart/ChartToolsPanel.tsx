import { useState, useEffect } from 'react'
import {
  TrendingUp,
  Minus,
  ArrowRight,
  MoveRight,
  Trash2,
  ChevronDown,
  ChevronUp,
  Settings,
  TrendingDown as TrendLine,
  ArrowUp,
  ArrowDown,
  Activity,
  StickyNote,
  Ruler,
  TrendingDown,
  Square,
  Plus,
  Bell,
  BellOff,
} from 'lucide-react'
import type { DrawingTool, DrawnLine } from './DrawingControls'
import type { MASettings } from './IndicatorControls'

interface ChartToolsPanelProps {
  // Indicators
  onMASettingsChange: (settings: MASettings) => void
  // Drawing Tools
  activeTool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
  drawnLines: DrawnLine[]
  onDeleteLine: (id: string) => void
  onClearAll: () => void
  onSelectLine?: (lineId: string | null) => void
  onUpdateLine?: (id: string, updates: Partial<DrawnLine>) => void
}

const STORAGE_KEY = 'trading-game-ma-settings-v3' // v3 for array-based structure

const DEFAULT_MA_COLORS = ['#3b82f6', '#f97316', '#ef4444', '#22c55e', '#a855f7', '#ec4899', '#14b8a6', '#f59e0b']

const DRAWING_TOOLS = [
  { id: 'horizontal-line' as DrawingTool, label: 'Horizontal Line', icon: Minus, color: '#FFD700', description: 'קו אופקי על פני כל הגרף' },
  { id: 'horizontal-ray' as DrawingTool, label: 'Horizontal Ray', icon: ArrowRight, color: '#00CED1', description: 'קרן אופקית - לחיצה אחת לקביעת מחיר' },
  { id: 'ray' as DrawingTool, label: 'Ray', icon: MoveRight, color: '#06B6D4', description: 'קרן בזווית - 2 לחיצות לקביעת כיוון' },
  { id: 'trend-line' as DrawingTool, label: 'Trend Line', icon: TrendLine, color: '#9C27B0', description: 'קו מגמה בין שתי נקודות' },
  { id: 'rectangle' as DrawingTool, label: 'Rectangle', icon: Square, color: '#8B5CF6', description: 'מלבן צבעוני עם שקיפות מתכווננת' },
  { id: 'arrow-up' as DrawingTool, label: 'Arrow Up ↑', icon: ArrowUp, color: '#4CAF50', description: 'חץ מעלה לסימון נר חשוב' },
  { id: 'arrow-down' as DrawingTool, label: 'Arrow Down ↓', icon: ArrowDown, color: '#F44336', description: 'חץ מטה לסימון נר חשוב' },
  { id: 'fibonacci' as DrawingTool, label: 'Fibonacci', icon: Activity, color: '#FF9800', description: 'רמות פיבונצ\'י בין שתי נקודות' },
  { id: 'note' as DrawingTool, label: 'Text Note', icon: StickyNote, color: '#03A9F4', description: 'הערת טקסט על הגרף' },
  { id: 'measure' as DrawingTool, label: 'Measure', icon: Ruler, color: '#FFD700', description: 'מדידת מרחק ושינוי מחיר בין שתי נקודות' },
  { id: 'long-position' as DrawingTool, label: 'Long Position', icon: TrendingUp, color: '#22c55e', description: 'סימולציה של עסקת LONG עם אזורי רווח/הפסד' },
  { id: 'short-position' as DrawingTool, label: 'Short Position', icon: TrendingDown, color: '#3b82f6', description: 'סימולציה של עסקת SHORT עם אזורי רווח/הפסד' },
]

export default function ChartToolsPanel({
  onMASettingsChange,
  activeTool,
  onToolChange,
  drawnLines,
  onDeleteLine,
  onClearAll,
  onSelectLine,
  onUpdateLine,
}: ChartToolsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeSection, setActiveSection] = useState<'indicators' | 'drawing'>('indicators')
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)

  const handleSelectLine = (lineId: string | null) => {
    setSelectedLineId(lineId)
    onSelectLine?.(lineId)
  }

  const [maSettings, setMASettings] = useState<MASettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return parsed
      } catch (e) {
        console.error('Failed to parse MA settings from localStorage', e)
      }
    }
    return {
      movingAverages: [
        { id: 'ma-1', enabled: false, type: 'SMA', period: 20, color: '#3b82f6' },
        { id: 'ma-2', enabled: false, type: 'SMA', period: 50, color: '#f97316' },
        { id: 'ma-3', enabled: false, type: 'SMA', period: 200, color: '#ef4444' },
      ],
      startFromCurrentIndex: true,
    }
  })

  // Load settings on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        onMASettingsChange(parsed)
      } catch (e) {
        console.error('Failed to parse MA settings from localStorage', e)
      }
    }
  }, [onMASettingsChange])

  const handleUpdateMA = (id: string, updates: Partial<{ enabled: boolean; type: 'SMA' | 'EMA'; period: number; color: string }>) => {
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

    const newMA = {
      id: `ma-${Date.now()}`,
      enabled: true,
      type: 'SMA' as const,
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

  const handleToolClick = (tool: DrawingTool) => {
    if (activeTool === tool) {
      onToolChange('none')
    } else {
      onToolChange(tool)
    }
  }

  const activeCount = maSettings.movingAverages.filter(ma => ma.enabled).length

  return (
    <div className="absolute top-2 left-2 z-10 bg-dark-panel/95 border border-dark-border rounded-lg shadow-lg overflow-hidden w-[280px] max-h-[calc(100vh-20px)]">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between gap-2 hover:bg-dark-bg/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-blue-400" />
          <span className="text-sm font-bold text-text-primary">Chart Tools</span>
          {(activeCount > 0 || drawnLines.length > 0) && (
            <span className="text-xs bg-blue-600 px-1.5 py-0.5 rounded">
              {activeCount + drawnLines.length}
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* Expanded controls */}
      {isExpanded && (
        <div className="border-t border-dark-border">
          {/* Section Tabs */}
          <div className="flex border-b border-dark-border">
            <button
              onClick={() => setActiveSection('indicators')}
              className={`flex-1 px-3 py-2 text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                activeSection === 'indicators'
                  ? 'bg-blue-600 text-white'
                  : 'bg-dark-bg/30 text-text-secondary hover:bg-dark-bg/50'
              }`}
            >
              <TrendingUp size={14} />
              Indicators
              {activeCount > 0 && <span className="text-xs">({activeCount})</span>}
            </button>
            <button
              onClick={() => setActiveSection('drawing')}
              className={`flex-1 px-3 py-2 text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                activeSection === 'drawing'
                  ? 'bg-blue-600 text-white'
                  : 'bg-dark-bg/30 text-text-secondary hover:bg-dark-bg/50'
              }`}
            >
              <Minus size={14} />
              Drawing
              {drawnLines.length > 0 && <span className="text-xs">({drawnLines.length})</span>}
            </button>
          </div>

          {/* Indicators Section */}
          {activeSection === 'indicators' && (
            <div className="px-3 py-2 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 100px)' }}>
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
                    onChange={() => {
                      const newSettings = {
                        ...maSettings,
                        startFromCurrentIndex: !maSettings.startFromCurrentIndex,
                      }
                      setMASettings(newSettings)
                      onMASettingsChange(newSettings)
                      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings))
                    }}
                    className="w-4 h-4 mt-0.5 rounded border-dark-border bg-dark-bg checked:bg-green-600 checked:border-green-600 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="text-xs font-semibold">חישוב מהנר הנוכחי</div>
                    <div className="text-[10px] text-text-secondary leading-tight">
                      סימולציה מציאותית - ממוצע מחושב מהנקודה הנוכחית בלבד
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Drawing Tools Section */}
          {activeSection === 'drawing' && (
            <div className="px-3 py-2 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 100px)' }}>
              {/* Drawing tools */}
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {DRAWING_TOOLS.map((tool) => {
                  const Icon = tool.icon
                  const isActive = activeTool === tool.id

                  return (
                    <button
                      key={tool.id}
                      onClick={() => handleToolClick(tool.id)}
                      title={tool.description}
                      className={`w-full px-3 py-2 rounded flex items-center gap-2 transition-colors ${
                        isActive
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-dark-bg hover:bg-dark-bg/70'
                      }`}
                    >
                      <Icon size={16} style={{ color: tool.color }} />
                      <div className="flex-1 text-left">
                        <div className="text-sm">{tool.label}</div>
                        <div className="text-[10px] text-text-secondary opacity-70">
                          {tool.description}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Drawn lines list */}
              {drawnLines.length > 0 && (
                <div className="pt-2 mt-2 border-t border-dark-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-text-secondary">Drawn Lines</div>
                    <button
                      onClick={onClearAll}
                      className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      Clear All
                    </button>
                  </div>

                  <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                    {drawnLines.map((line) => {
                      const isSelected = selectedLineId === line.id
                      const isHorizontalLine = line.type === 'horizontal-line' || line.type === 'horizontal-ray'
                      return (
                        <div key={line.id} className="space-y-1">
                          <div
                            onClick={() => handleSelectLine(isSelected ? null : line.id)}
                            className={`flex items-center justify-between px-3 py-2 rounded-md transition-all duration-200 cursor-pointer ${
                              isSelected
                                ? 'bg-gradient-to-r from-blue-600/20 to-blue-500/20 border-l-4 border-blue-400 shadow-md'
                                : 'bg-dark-bg/40 hover:bg-dark-bg/60 border-l-4 border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <div
                                className="w-6 h-0.5 rounded"
                                style={{ backgroundColor: line.color }}
                              />
                              <span className="text-xs">${line.price.toFixed(2)}</span>
                              <span className="text-[10px] text-text-secondary">
                                {(() => {
                                  const labels: Record<string, string> = {
                                    'horizontal-line': 'H-Line',
                                    'horizontal-ray': 'H-Ray',
                                    'trend-line': 'Trend',
                                    'rectangle': 'Rectangle',
                                    'arrow-up': 'Arrow ↑',
                                    'arrow-down': 'Arrow ↓',
                                    'fibonacci': 'Fib',
                                    'note': 'Note',
                                    'measure': 'Measure',
                                    'long-position': 'Long',
                                    'short-position': 'Short',
                                  }
                                  return labels[line.type] || line.type
                                })()}
                              </span>
                              {isHorizontalLine && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (onUpdateLine) {
                                      onUpdateLine(line.id, { alertEnabled: !line.alertEnabled })
                                    }
                                  }}
                                  className={`transition-colors ${
                                    line.alertEnabled
                                      ? 'text-yellow-400 hover:text-yellow-300'
                                      : 'text-gray-500 hover:text-gray-400'
                                  }`}
                                  title={line.alertEnabled ? 'התראה פעילה' : 'הפעל התראה'}
                                >
                                  {line.alertEnabled ? <Bell size={12} /> : <BellOff size={12} />}
                                </button>
                              )}
                            </div>
                            {isSelected && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onDeleteLine(line.id)
                                  handleSelectLine(null)
                                }}
                                className="text-red-400 hover:text-red-300 transition-colors font-semibold"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>

                          {/* Alert settings dropdown - shown when alert is enabled */}
                          {isHorizontalLine && line.alertEnabled && isSelected && (
                            <div className="mr-4 px-3 py-2 bg-dark-bg/60 border border-yellow-500/30 rounded-md">
                              <div className="text-[10px] text-yellow-400 font-semibold mb-1.5">⚠️ הגדרות התראה</div>
                              <div className="space-y-1">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    checked={line.alertDirection === 'above'}
                                    onChange={() => onUpdateLine?.(line.id, { alertDirection: 'above', alertTriggered: false })}
                                    className="w-3 h-3"
                                  />
                                  <span className="text-[10px]">חציה מלמעלה למטה</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    checked={line.alertDirection === 'below'}
                                    onChange={() => onUpdateLine?.(line.id, { alertDirection: 'below', alertTriggered: false })}
                                    className="w-3 h-3"
                                  />
                                  <span className="text-[10px]">חציה מלמטה למעלה</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    checked={line.alertDirection === 'both'}
                                    onChange={() => onUpdateLine?.(line.id, { alertDirection: 'both', alertTriggered: false })}
                                    className="w-3 h-3"
                                  />
                                  <span className="text-[10px]">חציה משני הכיוונים</span>
                                </label>
                              </div>
                              {line.alertTriggered && (
                                <div className="mt-2 text-[9px] text-orange-400">
                                  ✅ התראה הופעלה - לאיפוס שנה כיוון
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Instructions */}
              {activeTool !== 'none' && (
                <div className="pt-2 mt-2 border-t border-dark-border text-[10px] text-text-secondary">
                  {activeTool === 'horizontal-line' && (
                    <div>Click on chart to draw horizontal line across entire timeframe</div>
                  )}
                  {activeTool === 'horizontal-ray' && (
                    <div>Click on chart to start a horizontal ray extending to the right</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

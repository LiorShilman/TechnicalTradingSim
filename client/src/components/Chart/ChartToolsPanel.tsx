import { useState, useEffect } from 'react'
import {
  TrendingUp,
  Minus,
  ArrowRight,
  Trash2,
  ChevronDown,
  ChevronUp,
  Settings,
  TrendingDown as TrendLine,
  ArrowUp,
  ArrowDown,
  Activity,
  StickyNote,
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
}

const STORAGE_KEY = 'trading-game-ma-settings'

const DRAWING_TOOLS = [
  { id: 'horizontal-line' as DrawingTool, label: 'Horizontal Line', icon: Minus, color: '#FFD700', description: 'קו אופקי על פני כל הגרף' },
  { id: 'horizontal-ray' as DrawingTool, label: 'Horizontal Ray', icon: ArrowRight, color: '#00CED1', description: 'קרן אופקית מנקודה ימינה' },
  { id: 'trend-line' as DrawingTool, label: 'Trend Line', icon: TrendLine, color: '#9C27B0', description: 'קו מגמה בין שתי נקודות' },
  { id: 'arrow-up' as DrawingTool, label: 'Arrow Up ↑', icon: ArrowUp, color: '#4CAF50', description: 'חץ מעלה לסימון נר חשוב' },
  { id: 'arrow-down' as DrawingTool, label: 'Arrow Down ↓', icon: ArrowDown, color: '#F44336', description: 'חץ מטה לסימון נר חשוב' },
  { id: 'fibonacci' as DrawingTool, label: 'Fibonacci', icon: Activity, color: '#FF9800', description: 'רמות פיבונצ\'י בין שתי נקודות' },
  { id: 'note' as DrawingTool, label: 'Text Note', icon: StickyNote, color: '#03A9F4', description: 'הערת טקסט על הגרף' },
]

export default function ChartToolsPanel({
  onMASettingsChange,
  activeTool,
  onToolChange,
  drawnLines,
  onDeleteLine,
  onClearAll,
  onSelectLine,
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
      ma20: false,
      ma50: false,
      ma200: false,
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

  const handleToggleMA = (ma: keyof MASettings) => {
    const newSettings = {
      ...maSettings,
      [ma]: !maSettings[ma],
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

  const activeCount = (maSettings.ma20 ? 1 : 0) + (maSettings.ma50 ? 1 : 0) + (maSettings.ma200 ? 1 : 0)

  return (
    <div className="absolute top-2 left-2 z-10 bg-dark-panel/95 border border-dark-border rounded-lg shadow-lg overflow-hidden min-w-[200px]">
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
            <div className="px-3 py-2 space-y-2">
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

          {/* Drawing Tools Section */}
          {activeSection === 'drawing' && (
            <div className="px-3 py-2 space-y-2">
              {/* Drawing tools */}
              <div className="space-y-1">
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

                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {drawnLines.map((line) => {
                      const isSelected = selectedLineId === line.id
                      return (
                        <div
                          key={line.id}
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
                                  'arrow-up': 'Arrow ↑',
                                  'arrow-down': 'Arrow ↓',
                                  'fibonacci': 'Fib',
                                  'note': 'Note',
                                }
                                return labels[line.type] || line.type
                              })()}
                            </span>
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

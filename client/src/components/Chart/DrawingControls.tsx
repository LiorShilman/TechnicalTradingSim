import { useState } from 'react'
import { Minus, ArrowRight, Trash2, ChevronDown, ChevronUp } from 'lucide-react'

export type DrawingTool =
  | 'none'
  | 'horizontal-line'
  | 'horizontal-ray'
  | 'trend-line'
  | 'arrow-up'
  | 'arrow-down'
  | 'fibonacci'
  | 'note'
  | 'measure'
  | 'long-position'
  | 'short-position'

export interface DrawnLine {
  id: string
  type: DrawingTool
  price: number
  price2?: number // For trend line end point & fibonacci & measure OR TP for positions
  startTime?: number // For ray/trend line start & measure & positions
  endTime?: number // For trend line end & fibonacci & measure
  text?: string // For notes
  color: string
  width: number
  // Additional data for measure/position tools
  startIndex?: number // Candle index for start point
  endIndex?: number // Candle index for end point
  pnl?: number // Stop Loss price for position tools (או P&L למדידות)
  pnlPercent?: number // Calculated percentages
  stopLoss?: number // SL price for position tools
  takeProfit?: number // TP price for position tools
}

interface DrawingControlsProps {
  activeTool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
  drawnLines: DrawnLine[]
  onDeleteLine: (id: string) => void
  onClearAll: () => void
}

const TOOLS = [
  { id: 'horizontal-line' as DrawingTool, label: 'Horizontal Line', icon: Minus, color: '#FFD700' },
  { id: 'horizontal-ray' as DrawingTool, label: 'Horizontal Ray', icon: ArrowRight, color: '#00CED1' },
]

export default function DrawingControls({
  activeTool,
  onToolChange,
  drawnLines,
  onDeleteLine,
  onClearAll,
}: DrawingControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleToolClick = (tool: DrawingTool) => {
    // Toggle: if already selected, deselect
    if (activeTool === tool) {
      onToolChange('none')
    } else {
      onToolChange(tool)
    }
  }

  return (
    <div className="absolute top-2 right-2 z-10 bg-dark-panel/95 border border-dark-border rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between gap-2 hover:bg-dark-bg/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Minus size={16} className="text-yellow-400" />
          <span className="text-sm font-bold text-text-primary">Drawing Tools</span>
          {drawnLines.length > 0 && (
            <span className="text-xs bg-blue-600 px-1.5 py-0.5 rounded">{drawnLines.length}</span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* Expanded controls */}
      {isExpanded && (
        <div className="px-3 py-2 border-t border-dark-border space-y-2">
          {/* Drawing tools */}
          <div className="space-y-1">
            {TOOLS.map((tool) => {
              const Icon = tool.icon
              const isActive = activeTool === tool.id

              return (
                <button
                  key={tool.id}
                  onClick={() => handleToolClick(tool.id)}
                  className={`w-full px-3 py-2 rounded flex items-center gap-2 transition-colors ${
                    isActive
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-dark-bg hover:bg-dark-bg/70'
                  }`}
                >
                  <Icon size={16} style={{ color: tool.color }} />
                  <span className="text-sm">{tool.label}</span>
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
                {drawnLines.map((line) => (
                  <div
                    key={line.id}
                    className="flex items-center justify-between px-2 py-1.5 bg-dark-bg/50 rounded hover:bg-dark-bg/70 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <div
                        className="w-6 h-0.5 rounded"
                        style={{ backgroundColor: line.color }}
                      />
                      <span className="text-xs">${line.price.toFixed(2)}</span>
                      <span className="text-[10px] text-text-secondary">
                        {line.type === 'horizontal-line' ? 'Line' : 'Ray'}
                      </span>
                    </div>
                    <button
                      onClick={() => onDeleteLine(line.id)}
                      className="text-text-secondary hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
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
  )
}

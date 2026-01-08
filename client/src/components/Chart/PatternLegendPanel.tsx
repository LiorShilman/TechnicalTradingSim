import { useEffect, useRef } from 'react'
import { useGameStore } from '../../stores/gameStore'

interface PatternLegendPanelProps {
  onJumpToPattern?: (patternIndex: number) => void
}

export default function PatternLegendPanel({ onJumpToPattern }: PatternLegendPanelProps) {
  const gameState = useGameStore(state => state.gameState)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest pattern
  useEffect(() => {
    if (containerRef.current && gameState?.patterns) {
      const visibleCount = gameState.patterns.filter(p => p.startIndex <= gameState.currentIndex).length
      if (visibleCount > 0) {
        // Scroll to top to show latest pattern
        containerRef.current.scrollTop = 0
      }
    }
  }, [gameState?.patterns, gameState?.currentIndex])

  // Always show panel, even if no patterns yet
  // Get visible patterns and keep track of original indices
  const allPatterns = gameState?.patterns || []
  const visiblePatternsWithIndex = allPatterns
    .map((p, originalIdx) => ({ pattern: p, originalIdx }))
    .filter(({ pattern }) => pattern.startIndex <= (gameState?.currentIndex ?? 0))
    .reverse() // Newest first

  return (
    <div className="bg-dark-bg/95 backdrop-blur-md rounded-xl p-4 text-xs border-2 border-cyan-500/30 shadow-lg h-full flex flex-col">
      {/* Header */}
      <div className="font-bold mb-3 text-cyan-400 text-sm flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <span>תבניות מזוהות</span>
        </div>
        <div className="text-[10px] text-text-secondary">
          {visiblePatternsWithIndex.length} תבניות
        </div>
      </div>

      {/* Scrollable Pattern List */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-2 pr-2"
        style={{ maxHeight: 'calc(100% - 60px)' }}
      >
        {visiblePatternsWithIndex.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary">
            <span className="text-4xl mb-2">🔍</span>
            <span className="text-center">אין תבניות עדיין</span>
          </div>
        ) : (
          visiblePatternsWithIndex.map(({ pattern, originalIdx }, idx) => {
          const patternInfo = {
            breakout: { icon: '⚡', name: 'Breakout', color: '#FFD700' },
            retest: { icon: '🔄', name: 'Retest', color: '#00CED1' },
            flag: { icon: '🚩', name: 'Bull Flag', color: '#FF69B4' },
          }
          const info = patternInfo[pattern.type as keyof typeof patternInfo]

          return (
            <div
              key={originalIdx}
              onClick={() => onJumpToPattern?.(originalIdx)}
              className="group relative rounded-lg p-2 border bg-dark-card/50 hover:bg-dark-card/80 border-dark-border hover:border-cyan-500/50 transition-all cursor-pointer"
              title="לחץ כדי לקפוץ לתבנית זו בגרף"
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: info.color }}
                ></div>
                <span className="font-semibold">{info.icon} {info.name}</span>
                <span className="text-text-secondary text-[10px]">
                  #{idx + 1}
                </span>
              </div>
              <div className="text-[11px] text-cyan-300 font-medium mb-1">
                {pattern.metadata.description}
              </div>
              <div className="flex items-center justify-between text-[10px] text-text-secondary">
                <span>נרות: {pattern.startIndex}-{Math.min(pattern.endIndex, gameState?.currentIndex ?? pattern.endIndex)}</span>
                <span className="bg-purple-500/20 px-2 py-0.5 rounded">איכות: {pattern.metadata.quality}%</span>
              </div>

              {/* Tooltip on hover */}
              <div className="absolute hidden group-hover:block left-0 top-full mt-2 z-50 bg-dark-bg/98 border-2 border-cyan-500/50 rounded-lg p-3 shadow-2xl w-80 backdrop-blur-md">
                <div className="text-xs whitespace-pre-wrap leading-relaxed text-right" dir="rtl">
                  {pattern.metadata.hint}
                </div>
                <div className="mt-2 pt-2 border-t border-cyan-500/30 text-[10px] text-cyan-400 text-center">
                  👆 לחץ כדי לקפוץ לנקודה זו בגרף
                </div>
              </div>
            </div>
          )
        })
        )}
      </div>
    </div>
  )
}

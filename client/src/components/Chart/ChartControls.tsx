import { ChevronLeft, RotateCcw } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'

export default function ChartControls() {
  const { gameState, nextCandle, resetGame, isLoading } = useGameStore()

  const canProgress = gameState && !gameState.isComplete

  return (
    <div className="flex items-center gap-3">
      <div className="text-sm text-text-secondary">
        נר {gameState?.currentIndex ?? 0} מתוך {gameState?.totalCandles ?? 0}
      </div>
      
      <button
        onClick={nextCandle}
        disabled={!canProgress || isLoading}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-dark-border disabled:cursor-not-allowed rounded-lg font-medium flex items-center gap-2 transition-colors"
      >
        <ChevronLeft size={20} />
        נר הבא
      </button>

      <button
        onClick={resetGame}
        disabled={isLoading}
        className="px-4 py-2 bg-dark-border hover:bg-dark-panel rounded-lg flex items-center gap-2 transition-colors"
        title="התחל משחק חדש"
      >
        <RotateCcw size={20} />
      </button>
    </div>
  )
}

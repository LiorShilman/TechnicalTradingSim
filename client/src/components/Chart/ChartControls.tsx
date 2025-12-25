import { ChevronRight, RotateCcw, Play, Pause } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import { useEffect } from 'react'

export default function ChartControls() {
  const {
    gameState,
    nextCandle,
    resetGame,
    isLoading,
    isAutoPlaying,
    autoPlaySpeed,
    toggleAutoPlay,
    setAutoPlaySpeed
  } = useGameStore()

  const canProgress = gameState && !gameState.isComplete

  // התקדמות אוטומטית
  useEffect(() => {
    if (!isAutoPlaying || !canProgress || isLoading) return

    const interval = setInterval(() => {
      nextCandle()
    }, autoPlaySpeed)

    return () => clearInterval(interval)
  }, [isAutoPlaying, canProgress, isLoading, autoPlaySpeed, nextCandle])

  // עצור אוטומטית כשהמשחק מסתיים
  useEffect(() => {
    if (gameState?.isComplete && isAutoPlaying) {
      toggleAutoPlay()
    }
  }, [gameState?.isComplete, isAutoPlaying, toggleAutoPlay])

  return (
    <div className="flex items-center gap-3">
      <div className="text-sm text-text-secondary">
        נר {gameState?.currentIndex ?? 0} מתוך {gameState?.totalCandles ?? 0}
      </div>

      {/* כפתור Play/Pause */}
      <button
        onClick={toggleAutoPlay}
        disabled={!canProgress || isLoading}
        className={`px-4 py-2 ${
          isAutoPlaying ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'
        } disabled:bg-dark-border disabled:cursor-not-allowed rounded-lg font-medium flex items-center gap-2 transition-colors`}
        title={isAutoPlaying ? 'עצור' : 'הפעל אוטומטית'}
      >
        {isAutoPlaying ? <Pause size={20} /> : <Play size={20} />}
        {isAutoPlaying ? 'עצור' : 'הפעל'}
      </button>

      {/* בורר מהירות */}
      <select
        value={autoPlaySpeed}
        onChange={(e) => setAutoPlaySpeed(Number(e.target.value))}
        className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm focus:outline-none focus:border-blue-500"
        title="מהירות"
      >
        <option value={500}>מהיר מאוד (0.5s)</option>
        <option value={1000}>מהיר (1s)</option>
        <option value={2000}>רגיל (2s)</option>
        <option value={3000}>איטי (3s)</option>
      </select>

      {/* כפתור נר הבא ידני */}
      <button
        onClick={nextCandle}
        disabled={!canProgress || isLoading || isAutoPlaying}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-dark-border disabled:cursor-not-allowed rounded-lg font-medium flex items-center gap-2 transition-colors"
      >
        <ChevronRight size={20} />
        נר הבא
      </button>

      {/* כפתור איפוס */}
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

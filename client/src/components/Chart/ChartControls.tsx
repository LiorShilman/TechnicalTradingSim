import { ChevronLeft, RotateCcw, Play, Pause, Save, History, HelpCircle } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import { useEffect } from 'react'

export function CandleCounter() {
  const {
    gameState,
    isLoading,
    isAutoPlaying,
    autoPlaySpeed,
    nextCandle,
    toggleAutoPlay
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
    <div className="text-sm text-text-secondary">
        נר {gameState?.currentIndex ?? 0} מתוך {gameState?.totalCandles ?? 0}
      </div>
  )
}

export default function ChartControls() {
  const {
    gameState,
    isAutoPlaying,
    isLoading,
    autoPlaySpeed,
    nextCandle,
    resetGame,
    toggleAutoPlay,
    setAutoPlaySpeed,
    chartFitContent,
    chartResetZoom,
    saveGameState,
    saveAndExit,
    toggleTradeHistory,
    toggleHelp
  } = useGameStore()

  const canProgress = gameState && !gameState.isComplete

  // מחיר נוכחי
  const currentPrice = gameState?.candles[gameState.currentIndex]?.close || 0

  return (
    <div className="flex items-center justify-between w-full">
      {/* ימין: נכס, זמן ומחיר */}
      <div className="flex items-center gap-4 px-4 py-2 bg-dark-panel/50 rounded-lg border border-dark-border">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-blue-400">{gameState?.asset || 'N/A'}</span>
        </div>
        <div className="h-6 w-px bg-dark-border"></div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-purple-400">{gameState?.timeframe || 'N/A'}</span>
        </div>
        <div className="h-6 w-px bg-dark-border"></div>
        <div className="flex items-center gap-2" dir="ltr">
          <span className="text-2xl font-bold text-green-400">
            ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
          </span>
        </div>
      </div>

      {/* שמאל: כל הכפתורים */}
      <div className="flex items-center gap-3" dir="rtl">
      {/* קבוצה 1: עזרה והיסטוריה */}
      <button
        onClick={toggleHelp}
        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-lg font-bold flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
        title="מדריך למשחק"
      >
        <HelpCircle size={20} />
        עזרה
      </button>

      <button
        onClick={toggleTradeHistory}
        disabled={!gameState || isLoading}
        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:bg-dark-border disabled:cursor-not-allowed rounded-lg font-bold flex items-center gap-2 transition-all shadow-md hover:shadow-lg"
        title="היסטוריית עסקאות"
      >
        <History size={20} />
        היסטוריה
      </button>

      {/* מפריד */}
      <div className="h-8 w-px bg-dark-border mx-1"></div>

      {/* קבוצה 3: בקרת גרף */}
      <button
        onClick={chartResetZoom || undefined}
        disabled={!chartResetZoom}
        className="px-3 py-2 bg-purple-600/90 hover:bg-purple-700 disabled:bg-dark-border disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition-colors"
        title="איפוס זום"
      >
        🔍 איפוס
      </button>
      <button
        onClick={chartFitContent || undefined}
        disabled={!chartFitContent}
        className="px-3 py-2 bg-blue-600/90 hover:bg-blue-700 disabled:bg-dark-border disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition-colors"
        title="התאם גרף לתוכן"
      >
        📏 התאם
      </button>

      {/* מפריד */}
      <div className="h-8 w-px bg-dark-border mx-1"></div>

      {/* קבוצה 4: שמירה ואיפוס */}
      <button
        onClick={resetGame}
        disabled={isLoading}
        className="px-4 py-2 bg-dark-border hover:bg-dark-panel rounded-lg flex items-center gap-2 transition-colors"
        title="התחל משחק חדש"
      >
        <RotateCcw size={20} />
      </button>

      <button
        onClick={saveAndExit}
        disabled={!gameState || isLoading}
        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-dark-border disabled:cursor-not-allowed rounded-lg flex items-center gap-2 transition-colors"
        title="שמור משחק וחזור לתפריט הראשי"
      >
        <Save size={20} />
        שמור וצא
      </button>

      <button
        onClick={saveGameState}
        disabled={!gameState || isLoading}
        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-dark-border disabled:cursor-not-allowed rounded-lg flex items-center gap-2 transition-colors"
        title="שמור משחק"
      >
        <Save size={20} />
        שמור
      </button>

      {/* מפריד */}
      <div className="h-8 w-px bg-dark-border mx-1"></div>

      {/* קבוצה 5: ניווט בנרות (עם חץ שמאלה) */}
      <button
        onClick={nextCandle}
        disabled={!canProgress || isLoading || isAutoPlaying}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-dark-border disabled:cursor-not-allowed rounded-lg font-medium flex items-center gap-2 transition-colors"
      >
        נר הבא
        <ChevronLeft size={20} />
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

      <CandleCounter/>
      </div>
    </div>
  )
}

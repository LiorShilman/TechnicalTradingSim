import { ChevronLeft, RotateCcw, Play, Pause, Save, History, HelpCircle } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import { useEffect, memo } from 'react'

// קומפוננטה ממוזערת למונה נרות - מתרנדרת רק כש-currentIndex משתנה
export const CandleCounter = memo(() => {
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
    <div className="text-base font-mono font-bold text-secondary">
        נר {gameState?.currentIndex ?? 0} מתוך {gameState?.totalCandles ?? 0}
      </div>
  )
})
CandleCounter.displayName = 'CandleCounter'

// קומפוננטה ממוזערת לתצוגת מחיר - מתרנדרת רק כשהמחיר משתנה
const PriceDisplay = memo(() => {
  const gameState = useGameStore(state => state.gameState)

  if (!gameState) return <span className="text-2xl font-mono font-bold text-green-400 inline-block min-w-[140px] text-left">-</span>

  const currentPrice = gameState.candles[gameState.currentIndex]?.close || 0

  // עיצוב מחיר עם padding של אפסים (4 ספרות אחרי נקודה)
  const formatPriceWithPadding = (price: number): string => {
    // קבע כמה ספרות לפי סוג הנכס (crypto/forex = 4, stocks = 2)
    const isCryptoOrForex = gameState.asset?.includes('/') || false
    const decimals = isCryptoOrForex ? 4 : 2

    // תחילה עגל למספר הספרות הנכון
    const fixed = price.toFixed(decimals)

    // פצל לחלק שלם וחלק עשרוני
    const [integerPart, decimalPart] = fixed.split('.')

    // הוסף פסיקים לחלק השלם
    const formattedInteger = parseInt(integerPart).toLocaleString('en-US')

    // החזר עם החלק העשרוני (כולל אפסים!)
    return `${formattedInteger}.${decimalPart}`
  }

  return (
    <span className="text-2xl font-mono font-bold text-green-400 inline-block min-w-[140px] text-left">
      ${formatPriceWithPadding(currentPrice)}
    </span>
  )
})
PriceDisplay.displayName = 'PriceDisplay'

// קומפוננטה ממוזערת לתצוגת נכס וזמן - מתרנדרת רק כשהנכס משתנה
const AssetInfo = memo(() => {
  const gameState = useGameStore(state => state.gameState)

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-base font-mono font-bold text-secondary">נכס:</span>
        <span className="text-lg font-bold text-blue-400">{gameState?.asset || 'N/A'}</span>
      </div>
      <div className="h-6 w-px bg-dark-border"></div>
      <div className="flex items-center gap-2">
        <span className="text-base font-mono font-bold text-secondary">זמן:</span>
        <span className="text-lg font-bold text-purple-400">{gameState?.timeframe || 'N/A'}</span>
      </div>
    </>
  )
})
AssetInfo.displayName = 'AssetInfo'

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

  return (
    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between w-full gap-2 lg:gap-0">
      {/* שורה 1 (מובייל) / שמאל (דסקטופ): כפתורי בקרה */}
      <div className="flex flex-wrap items-center gap-2 lg:gap-3 w-full lg:w-auto" dir="rtl">
        {/* כפתורי עזרה והיסטוריה */}
        <button
          onClick={toggleHelp}
          className="px-2 lg:px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-lg text-xs lg:text-base font-bold flex items-center gap-1 lg:gap-2 transition-all shadow-md hover:shadow-lg min-h-[44px] lg:min-h-0"
          title="מדריך למשחק"
        >
          <HelpCircle size={18} className="lg:w-5 lg:h-5" />
          <span className="hidden sm:inline">עזרה</span>
        </button>

        <button
          onClick={toggleTradeHistory}
          disabled={!gameState || isLoading}
          className="px-2 lg:px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:bg-dark-border disabled:cursor-not-allowed rounded-lg text-xs lg:text-base font-bold flex items-center gap-1 lg:gap-2 transition-all shadow-md hover:shadow-lg min-h-[44px] lg:min-h-0"
          title="היסטוריית עסקאות"
        >
          <History size={18} className="lg:w-5 lg:h-5" />
          <span className="hidden sm:inline">היסטוריה</span>
        </button>

        {/* מפריד - מוסתר על מובייל */}
        <div className="hidden lg:block h-8 w-px bg-dark-border mx-1"></div>

        {/* קבוצה 1: בקרת גרף - עכשיו באותו גודל כמו שאר הכפתורים */}
        <button
          onClick={chartResetZoom || undefined}
          disabled={!chartResetZoom}
          className="px-2 lg:px-4 py-2 bg-purple-600/90 hover:bg-purple-700 disabled:bg-dark-border disabled:cursor-not-allowed rounded-lg text-xs lg:text-base font-semibold flex items-center gap-1 lg:gap-2 transition-colors min-h-[44px] lg:min-h-0"
          title="איפוס זום"
        >
          🔍 <span className="hidden sm:inline">איפוס</span>
        </button>
        <button
          onClick={chartFitContent || undefined}
          disabled={!chartFitContent}
          className="px-2 lg:px-4 py-2 bg-blue-600/90 hover:bg-blue-700 disabled:bg-dark-border disabled:cursor-not-allowed rounded-lg text-xs lg:text-base font-semibold flex items-center gap-1 lg:gap-2 transition-colors min-h-[44px] lg:min-h-0"
          title="התאם גרף לתוכן"
        >
          📏 <span className="hidden sm:inline">התאם</span>
        </button>

      {/* מפריד - מוסתר על מובייל */}
      <div className="hidden lg:block h-8 w-px bg-dark-border mx-1"></div>

      {/* קבוצה 4: שמירה ואיפוס */}
      <button
        onClick={resetGame}
        disabled={isLoading}
        className="px-2 lg:px-4 py-2 bg-dark-border hover:bg-dark-panel rounded-lg flex items-center gap-1 lg:gap-2 transition-colors text-xs lg:text-base min-h-[44px] lg:min-h-0"
        title="התחל משחק חדש"
      >
        <RotateCcw size={18} className="lg:w-5 lg:h-5" />
      </button>

      <button
        onClick={saveAndExit}
        disabled={!gameState || isLoading}
        className="px-2 lg:px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-dark-border disabled:cursor-not-allowed rounded-lg flex items-center gap-1 lg:gap-2 transition-colors text-xs lg:text-base min-h-[44px] lg:min-h-0"
        title="שמור משחק וחזור לתפריט הראשי"
      >
        <Save size={18} className="lg:w-5 lg:h-5" />
        <span className="hidden sm:inline">שמור וצא</span>
      </button>

      <button
        onClick={saveGameState}
        disabled={!gameState || isLoading}
        className="px-2 lg:px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-dark-border disabled:cursor-not-allowed rounded-lg flex items-center gap-1 lg:gap-2 transition-colors text-xs lg:text-base min-h-[44px] lg:min-h-0"
        title="שמור משחק"
      >
        <Save size={18} className="lg:w-5 lg:h-5" />
        <span className="hidden sm:inline">שמור</span>
      </button>

      {/* מפריד - מוסתר על מובייל */}
      <div className="hidden lg:block h-8 w-px bg-dark-border mx-1"></div>

      {/* קבוצה 5: ניווט בנרות (עם חץ שמאלה) */}
      <button
        onClick={nextCandle}
        disabled={!canProgress || isLoading || isAutoPlaying}
        className="px-2 lg:px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-dark-border disabled:cursor-not-allowed rounded-lg text-xs lg:text-base font-medium flex items-center gap-1 lg:gap-2 transition-colors min-h-[44px] lg:min-h-0"
      >
        <span className="hidden sm:inline">נר הבא</span>
        <ChevronLeft size={18} className="lg:w-5 lg:h-5" />
      </button>

      {/* בורר מהירות */}
      <select
        value={autoPlaySpeed}
        onChange={(e) => setAutoPlaySpeed(Number(e.target.value))}
        className="px-2 lg:px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs lg:text-sm focus:outline-none focus:border-blue-500 min-h-[44px] lg:min-h-0"
        title="מהירות"
      >
        <option value={200}>⚡ 0.2s</option>
        <option value={500}>🚀 0.5s</option>
        <option value={1000}>⏩ 1s</option>
        <option value={2000}>▶️ 2s</option>
        <option value={3000}>🐌 3s</option>
      </select>

      {/* כפתור Play/Pause */}
      <button
        onClick={toggleAutoPlay}
        disabled={!canProgress || isLoading}
        className={`px-2 lg:px-4 py-2 ${
          isAutoPlaying ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'
        } disabled:bg-dark-border disabled:cursor-not-allowed rounded-lg text-xs lg:text-base font-medium flex items-center gap-1 lg:gap-2 transition-colors min-h-[44px] lg:min-h-0`}
        title={isAutoPlaying ? 'עצור' : 'הפעל אוטומטית'}
      >
        {isAutoPlaying ? <Pause size={18} className="lg:w-5 lg:h-5" /> : <Play size={18} className="lg:w-5 lg:h-5" />}
        <span className="hidden sm:inline">{isAutoPlaying ? 'עצור' : 'הפעל'}</span>
      </button>

      <CandleCounter/>
      </div>

      {/* שורה 2 (מובייל) / ימין (דסקטופ): מידע על הנכס והמחיר - מוצמד לימין */}
      <div className="flex flex-wrap items-center gap-2 lg:gap-3 w-full lg:w-auto lg:mr-auto">
        {/* פאנל מידע - מתכווץ על מובייל */}
        <div className="flex flex-wrap items-center gap-2 lg:gap-4 px-2 lg:px-4 py-2 bg-dark-panel/50 rounded-lg border border-dark-border text-xs lg:text-base">
          <AssetInfo />
          <div className="hidden lg:block h-6 w-px bg-dark-border"></div>
          <div className="flex items-center gap-1 lg:gap-2">
            <span className="text-xs lg:text-base font-mono font-bold text-secondary">מחיר:</span>
            <PriceDisplay />
          </div>
        </div>
      </div>
    </div>
  )
}

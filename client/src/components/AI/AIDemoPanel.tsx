import { Bot, Play, Pause, TrendingUp, TrendingDown, DollarSign, Zap, Info } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'

export default function AIDemoPanel() {
  const {
    isDemoMode,
    demoSpeed,
    showDemoExplanations,
    demoStats,
    isAutoPlaying,
    toggleDemoMode,
    setDemoSpeed,
    toggleDemoExplanations,
    toggleAutoPlay,
  } = useGameStore()

  // אם המצב לא פעיל, לא מציגים כלום
  if (!isDemoMode) return null

  const winRate = demoStats.tradesExecuted > 0
    ? ((demoStats.winsCount / demoStats.tradesExecuted) * 100).toFixed(1)
    : '0.0'

  const speedOptions = [
    { value: 0.5, label: '0.5x', desc: 'איטי' },
    { value: 1, label: '1x', desc: 'רגיל' },
    { value: 2, label: '2x', desc: 'מהיר' },
    { value: 5, label: '5x', desc: 'מהיר מאוד' },
  ]

  return (
    <div className="fixed top-20 left-4 z-40 w-80 bg-gradient-to-br from-purple-900/95 to-blue-900/95 backdrop-blur-xl border-2 border-purple-500/50 rounded-xl shadow-2xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-3 rounded-t-xl border-b border-purple-400/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-white" />
            <h3 className="text-white font-bold text-lg">AI Demo Mode</h3>
            <span className="bg-green-500 w-2 h-2 rounded-full animate-pulse"></span>
          </div>
          <button
            onClick={toggleDemoMode}
            className="text-white/80 hover:text-white transition-colors text-sm"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Play/Pause Control */}
        <div className="flex items-center justify-between bg-purple-800/30 p-3 rounded-lg border border-purple-500/20">
          <span className="text-purple-200 font-medium">סטטוס:</span>
          <button
            onClick={toggleAutoPlay}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              isAutoPlaying
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isAutoPlaying ? (
              <>
                <Pause className="w-4 h-4" />
                השהה
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                הפעל
              </>
            )}
          </button>
        </div>

        {/* Speed Control */}
        <div className="bg-purple-800/30 p-3 rounded-lg border border-purple-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-purple-200 font-medium">מהירות:</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {speedOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setDemoSpeed(option.value)}
                className={`px-2 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  demoSpeed === option.value
                    ? 'bg-purple-500 text-white border-2 border-purple-300'
                    : 'bg-purple-700/50 text-purple-200 hover:bg-purple-700 border border-purple-500/30'
                }`}
                title={option.desc}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Explanations Toggle */}
        <div className="bg-purple-800/30 p-3 rounded-lg border border-purple-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              <span className="text-purple-200 font-medium">הסברים:</span>
            </div>
            <button
              onClick={toggleDemoExplanations}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                showDemoExplanations ? 'bg-green-500' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  showDemoExplanations ? 'translate-x-7' : 'translate-x-1'
                }`}
              ></div>
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div className="bg-purple-800/30 p-3 rounded-lg border border-purple-500/20 space-y-2">
          <div className="text-purple-200 font-medium mb-2">📊 סטטיסטיקות AI:</div>

          {/* Total Trades */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-purple-300">עסקאות:</span>
            <span className="text-white font-bold">{demoStats.tradesExecuted}</span>
          </div>

          {/* Wins */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-green-400" />
              <span className="text-purple-300">רווחים:</span>
            </div>
            <span className="text-green-400 font-bold">{demoStats.winsCount}</span>
          </div>

          {/* Losses */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              <span className="text-purple-300">הפסדים:</span>
            </div>
            <span className="text-red-400 font-bold">{demoStats.lossesCount}</span>
          </div>

          {/* Win Rate */}
          <div className="flex items-center justify-between text-sm pt-2 border-t border-purple-500/20">
            <span className="text-purple-300">אחוז הצלחה:</span>
            <span
              className={`font-bold ${
                parseFloat(winRate) >= 60
                  ? 'text-green-400'
                  : parseFloat(winRate) >= 40
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }`}
            >
              {winRate}%
            </span>
          </div>

          {/* Total PnL */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-purple-300">רווח/הפסד:</span>
            </div>
            <span
              className={`font-bold ${
                demoStats.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {demoStats.totalPnL >= 0 ? '+' : ''}${demoStats.totalPnL.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Info Text */}
        <div className="bg-blue-900/30 p-2.5 rounded-lg border border-blue-500/20">
          <p className="text-blue-200 text-xs text-center leading-relaxed">
            🤖 ה-AI מזהה תבניות ונכנס לעסקאות עם ניהול סיכון של 1%. צפה וכמוד!
          </p>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import TradingChart from './components/Chart/TradingChart'
import OrderPanel from './components/Trading/OrderPanel'
import AccountInfo from './components/Trading/AccountInfo'
import PositionsList from './components/Trading/PositionsList'
import ChartControls from './components/Chart/ChartControls'
import GameStats from './components/Stats/GameStats'
import { useGameStore } from './stores/gameStore'
import { Play, Loader2 } from 'lucide-react'

function App() {
  const [isStartScreen, setIsStartScreen] = useState(true)
  const { gameState, isLoading, error, initializeGame } = useGameStore()

  const handleStartGame = async () => {
    setIsStartScreen(false)
    await initializeGame()
  }

  // הסרת preload class אחרי טעינה
  useEffect(() => {
    document.body.classList.remove('preload')
  }, [])

  // מסך התחלה
  if (isStartScreen) {
    return (
      <div className="h-screen flex items-center justify-center bg-dark-bg">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            משחק סימולציית מסחר טכני
          </h1>
          <p className="text-text-secondary mb-8 text-lg">
            אמן את כישורי הניתוח הטכני שלך במשחק מציאותי
          </p>
          <button
            onClick={handleStartGame}
            className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg font-semibold text-lg hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 flex items-center gap-2 mx-auto"
          >
            <Play size={24} />
            התחל משחק
          </button>
          <div className="mt-12 text-text-secondary text-sm">
            <p>💰 יתרה התחלתית: $10,000</p>
            <p>📊 נכס: BTC/USD</p>
            <p>⏱️ מסגרת זמן: 1 שעה</p>
            <p>🎯 תבניות: Breakout, Retest, Flag</p>
          </div>
        </div>
      </div>
    )
  }

  // מסך טעינה - רק אם אין משחק בכלל
  if (!gameState) {
    return (
      <div className="h-screen flex items-center justify-center bg-dark-bg">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4" size={48} />
          <p className="text-text-secondary">טוען משחק...</p>
        </div>
      </div>
    )
  }

  // מסך שגיאה
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-dark-bg">
        <div className="text-center">
          <p className="text-loss mb-4">❌ שגיאה: {error}</p>
          <button
            onClick={handleStartGame}
            className="px-6 py-3 bg-dark-panel rounded-lg hover:bg-dark-border"
          >
            נסה שוב
          </button>
        </div>
      </div>
    )
  }

  // מסך משחק
  return (
    <div className="h-screen flex flex-col bg-dark-bg" dir="rtl">
      {/* Header */}
      <header className="h-16 bg-dark-panel border-b border-dark-border flex items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold">משחק מסחר טכני</h1>
          <div className="text-sm text-text-secondary">
            {gameState?.asset} | {gameState?.timeframe}
          </div>
        </div>
        <ChartControls />
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chart area */}
        <div className="flex-1 flex flex-col p-4">
          <TradingChart />
        </div>

        {/* Right sidebar */}
        <div className="w-96 bg-dark-panel border-r border-dark-border flex flex-col">
          <AccountInfo />
          <OrderPanel />
          <PositionsList />
        </div>
      </div>

      {/* Stats modal (shown when game is complete) */}
      {gameState?.isComplete && <GameStats />}
    </div>
  )
}

export default App

import { useEffect, useState } from 'react'
import TradingChart from './components/Chart/TradingChart'
import OrderPanel from './components/Trading/OrderPanel'
import AccountInfo from './components/Trading/AccountInfo'
import PositionsList from './components/Trading/PositionsList'
import ChartControls from './components/Chart/ChartControls'
import EquityChart from './components/Chart/EquityChart'
import GameStats from './components/Stats/GameStats'
import { useGameStore } from './stores/gameStore'
import { Play, Loader2 } from 'lucide-react'
import { Toaster } from 'react-hot-toast'

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
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-dark-bg via-blue-950/20 to-purple-950/20 p-4" dir="rtl">
        <div className="max-w-4xl w-full">
          {/* כותרת ראשית */}
          <div className="text-center mb-12">
            <div className="inline-block mb-6 p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl backdrop-blur-sm border border-blue-500/30">
              <h1 className="text-6xl font-bold mb-3 bg-gradient-to-l from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                משחק סימולציית מסחר
              </h1>
              <div className="text-2xl font-semibold text-blue-300">
                Technical Trading Simulator
              </div>
            </div>
            <p className="text-xl text-gray-300 leading-relaxed max-w-2xl mx-auto">
              אמן את כישורי הניתוח הטכני שלך במשחק מציאותי
              <br />
              <span className="text-blue-400 font-semibold">זהה תבניות, בצע עסקאות והוכח את עצמך!</span>
            </p>
          </div>

          {/* כרטיסי מידע */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/20 rounded-xl p-6 border border-green-500/30 backdrop-blur-sm">
              <div className="text-4xl mb-2">💰</div>
              <div className="text-sm text-gray-400 mb-1">יתרה התחלתית</div>
              <div className="text-3xl font-bold text-green-400" dir="ltr">$10,000</div>
            </div>

            <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/20 rounded-xl p-6 border border-blue-500/30 backdrop-blur-sm">
              <div className="text-4xl mb-2">📊</div>
              <div className="text-sm text-gray-400 mb-1">נכס מסחר</div>
              <div className="text-3xl font-bold text-blue-400">BTC/USD</div>
            </div>

            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/20 rounded-xl p-6 border border-purple-500/30 backdrop-blur-sm">
              <div className="text-4xl mb-2">⏱️</div>
              <div className="text-sm text-gray-400 mb-1">מסגרת זמן</div>
              <div className="text-3xl font-bold text-purple-400">1 שעה</div>
            </div>

            <div className="bg-gradient-to-br from-orange-900/30 to-yellow-900/20 rounded-xl p-6 border border-orange-500/30 backdrop-blur-sm">
              <div className="text-4xl mb-2">🎯</div>
              <div className="text-sm text-gray-400 mb-1">תבניות לזיהוי</div>
              <div className="text-xl font-bold text-orange-400">
                Breakout • Retest • Flag
              </div>
            </div>
          </div>

          {/* כפתור התחלה */}
          <div className="text-center">
            <button
              onClick={handleStartGame}
              className="group relative px-12 py-5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl font-bold text-2xl hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-2xl shadow-blue-500/50 hover:shadow-purple-500/50"
            >
              <div className="flex items-center gap-3 justify-center">
                <Play size={32} className="group-hover:animate-pulse" />
                <span>התחל משחק חדש</span>
              </div>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400 to-purple-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity"></div>
            </button>

            <p className="mt-6 text-gray-400 text-sm">
              ⚡ 500 נרות • 8 תבניות טכניות • משוב בזמן אמת
            </p>
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
        <div className="flex-1 flex flex-col p-4 gap-4">
          <div className="flex-1">
            <TradingChart />
          </div>
          <EquityChart />
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

      {/* Toast notifications */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1a1f3a',
            color: '#e8eaed',
            border: '1px solid #2d3548',
            direction: 'rtl',
          },
          success: {
            iconTheme: {
              primary: '#00c853',
              secondary: '#1a1f3a',
            },
          },
          error: {
            iconTheme: {
              primary: '#ff1744',
              secondary: '#1a1f3a',
            },
          },
        }}
      />
    </div>
  )
}

export default App

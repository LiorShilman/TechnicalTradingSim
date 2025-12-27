import { useEffect, useState, useRef, useMemo } from 'react'
import TradingChart from './components/Chart/TradingChart'
import OrderPanel from './components/Trading/OrderPanel'
import AccountInfo from './components/Trading/AccountInfo'
import PositionsList from './components/Trading/PositionsList'
import PendingOrdersList from './components/Trading/PendingOrdersList'
import ChartControls from './components/Chart/ChartControls'
import EquityChart from './components/Chart/EquityChart'
import GameStats from './components/Stats/GameStats'
import { useGameStore } from './stores/gameStore'
import { Play, Loader2, Upload } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'

function App() {
  const [isStartScreen, setIsStartScreen] = useState(true)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [assetName, setAssetName] = useState('BTC/USD')
  const [timeframe, setTimeframe] = useState('1H')
  // טעינת יתרה מ-localStorage או ברירת מחדל
  const [initialBalance, setInitialBalance] = useState(() => {
    const saved = localStorage.getItem('carryOverBalance')
    return saved ? parseFloat(saved) : 10000
  })
  const [availableDateRange, setAvailableDateRange] = useState<{ start: string; end: string } | null>(null)
  const [selectedDateRange, setSelectedDateRange] = useState<{ start: string; end: string } | null>(null)
  const [refreshSavedGame, setRefreshSavedGame] = useState(0) // מונה לרענון מצב משחק שמור
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { gameState, isLoading, initializeGame, initializeGameWithCSV, loadSavedGame, getSavedGameInfo, clearSavedGame } = useGameStore()

  // בדיקה אם יש משחק שמור - מתעדכן כשמשנים את refreshSavedGame
  const savedGameInfo = useMemo(() => getSavedGameInfo(), [refreshSavedGame, getSavedGameInfo])

  const handleStartGame = async () => {
    // ⭐ CRITICAL: אל תעדכן את setIsStartScreen לפני שהמשחק נטען!
    // זה גורם ל-re-render שמאפס את הגרף

    // ניסיון לטעון משחק שמור (אם יש קובץ ותואם)
    if (uploadedFile && savedGameInfo) {
      const loaded = await loadSavedGame(uploadedFile, selectedDateRange)
      if (loaded) {
        console.log('✅ Resumed from saved game')
        setIsStartScreen(false) // ✅ רק אחרי שהמשחק נטען בהצלחה
        return
      }
    }

    // אחרת, יצירת משחק חדש
    if (uploadedFile) {
      await initializeGameWithCSV(uploadedFile, assetName, timeframe, initialBalance, selectedDateRange)
    } else {
      await initializeGame({ initialBalance })
    }

    // ✅ עדכון מסך רק אחרי שהמשחק נטען
    setIsStartScreen(false)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast.error('נא להעלות קובץ CSV בלבד')
        return
      }

      // ✅ חילוץ שם נכס ו-timeframe משם הקובץ (פורמט TradingView: ASSET_TIMEFRAME_XXXXX.csv)
      // דוגמאות: SP_SPX_1D_07c94.csv, BTCUSD_1H_abc123.csv
      // ניקוי פסיקים ורווחים מיותרים
      const fileName = file.name.replace('.csv', '').replace(/,\s*/g, '_')
      const parts = fileName.split('_')

      console.log(`📁 Parsing filename: ${file.name}`)
      console.log(`📋 Parts:`, parts)

      let detectedAsset = 'BTC/USD' // ברירת מחדל
      let detectedTimeframeFromName = ''

      if (parts.length >= 2) {
        // מציאת timeframe - מחפשים חלק שמכיל מספר ואות (1D, 4H, 15m וכו')
        const timeframeRegex = /^\d+[DHmW]$/
        let timeframeIndex = parts.findIndex(part => timeframeRegex.test(part))

        console.log(`🔍 Timeframe index: ${timeframeIndex}`)

        if (timeframeIndex !== -1) {
          // מצאנו timeframe
          detectedTimeframeFromName = parts[timeframeIndex]

          // כל מה שלפני ה-timeframe הוא שם הנכס
          const assetParts = parts.slice(0, timeframeIndex)
          console.log(`💼 Asset parts:`, assetParts)

          if (assetParts.length === 2) {
            // מקרה של SP_SPX -> SP/SPX
            detectedAsset = assetParts.join('/')
          } else if (assetParts.length === 1) {
            // מקרה של BTCUSD -> BTC/USD (אם יש USD בסוף)
            const asset = assetParts[0]
            if (asset.endsWith('USD')) {
              detectedAsset = asset.replace('USD', '/USD')
            } else if (asset.endsWith('USDT')) {
              detectedAsset = asset.replace('USDT', '/USDT')
            } else {
              detectedAsset = asset
            }
          } else {
            // מקרה מורכב יותר - פשוט מחברים עם /
            detectedAsset = assetParts.join('/')
          }

          console.log(`✅ Detected from filename: Asset=${detectedAsset}, Timeframe=${detectedTimeframeFromName}`)
        } else {
          console.log(`⚠️ No timeframe found in filename, using default`)
        }
      }

      // קריאת הקובץ וחילוץ טווח תאריכים
      try {
        const text = await file.text()
        const lines = text.split('\n').filter(line => line.trim())

        if (lines.length < 2) {
          toast.error('קובץ CSV ריק או לא תקין')
          return
        }

        // מציאת עמודת הזמן (time או timestamp)
        const header = lines[0].toLowerCase()
        const timeColumnIndex = header.split(',').findIndex(col =>
          col.includes('time') || col.includes('date')
        )

        if (timeColumnIndex === -1) {
          toast.error('לא נמצאה עמודת זמן בקובץ')
          return
        }

        // חילוץ תאריכים מהנרות הראשון והאחרון
        const firstDataLine = lines[1].split(',')
        const lastDataLine = lines[lines.length - 1].split(',')

        const startTime = firstDataLine[timeColumnIndex]?.trim()
        const endTime = lastDataLine[timeColumnIndex]?.trim()

        if (!startTime || !endTime) {
          toast.error('לא ניתן לחלץ טווח תאריכים')
          return
        }

        // המרה לפורמט תאריך
        const formatDate = (timeStr: string) => {
          // טיפול בפורמטים שונים
          const timestamp = !isNaN(Number(timeStr)) ? Number(timeStr) : Date.parse(timeStr)
          if (isNaN(timestamp)) return timeStr

          // אם זה Unix timestamp במילישניות
          const date = timestamp > 10000000000 ? new Date(timestamp) : new Date(timestamp * 1000)
          return date.toISOString().split('T')[0] // YYYY-MM-DD
        }

        const startDate = formatDate(startTime)
        const endDate = formatDate(endTime)

        // זיהוי אוטומטי של timeframe לפי הפרש הזמנים בין 2 הנרות הראשונים
        let detectedTimeframe = '1H'
        if (lines.length >= 3) {
          const secondDataLine = lines[2].split(',')
          const secondTime = secondDataLine[timeColumnIndex]?.trim()

          if (secondTime) {
            const time1 = !isNaN(Number(startTime)) ? Number(startTime) : Date.parse(startTime) / 1000
            const time2 = !isNaN(Number(secondTime)) ? Number(secondTime) : Date.parse(secondTime) / 1000
            const diffSeconds = Math.abs(time2 - time1)

            // זיהוי timeframe לפי הפרש
            if (diffSeconds <= 60) detectedTimeframe = '1m'
            else if (diffSeconds <= 300) detectedTimeframe = '5m'
            else if (diffSeconds <= 900) detectedTimeframe = '15m'
            else if (diffSeconds <= 1800) detectedTimeframe = '30m'
            else if (diffSeconds <= 3600) detectedTimeframe = '1H'
            else if (diffSeconds <= 14400) detectedTimeframe = '4H'
            else if (diffSeconds <= 86400) detectedTimeframe = '1D'
            else detectedTimeframe = '1W'

            console.log(`Auto-detected timeframe: ${detectedTimeframe} (${diffSeconds} seconds between candles)`)
          }
        }

        // ✅ שימוש ב-timeframe משם הקובץ אם קיים, אחרת מזיהוי אוטומטי
        const finalTimeframe = detectedTimeframeFromName || detectedTimeframe

        // ✅ עדכון כל המידע שזוהה
        setAssetName(detectedAsset)
        setTimeframe(finalTimeframe)
        setAvailableDateRange({ start: startDate, end: endDate })
        setSelectedDateRange({ start: startDate, end: endDate })
        setUploadedFile(file)

        console.log(`✅ Asset name updated to: ${detectedAsset}`)
        toast.success(`קובץ נטען: ${file.name}\nנכס: ${detectedAsset}\nטווח: ${startDate} - ${endDate}\nזמן: ${finalTimeframe}`)
      } catch (error) {
        console.error('Error parsing CSV:', error)
        toast.error('שגיאה בקריאת הקובץ')
      }
    }
  }

  // הסרת preload class אחרי טעינה
  useEffect(() => {
    document.body.classList.remove('preload')
  }, [])

  // כשהמשחק מתאפס (resetGame), חוזרים למסך ההתחלה
  useEffect(() => {
    if (!gameState && !isLoading) {
      setIsStartScreen(true)
      // עדכון היתרה מ-localStorage
      const saved = localStorage.getItem('carryOverBalance')
      if (saved) {
        setInitialBalance(parseFloat(saved))
      }
    }
  }, [gameState, isLoading])

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
              <div className="text-sm text-gray-400 mb-1 flex items-center justify-center gap-2">
                <span>יתרה התחלתית</span>
                {initialBalance !== 10000 && (
                  <button
                    onClick={() => {
                      localStorage.removeItem('carryOverBalance')
                      setInitialBalance(10000)
                      toast.success('היתרה אופסה ל-$10,000', { icon: '🔄' })
                    }}
                    className="text-[10px] bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-400 px-2 py-0.5 rounded transition-colors"
                    title="אפס יתרה ל-$10,000"
                  >
                    🔄 איפוס
                  </button>
                )}
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center" dir="ltr">
                  <span className="text-2xl font-bold text-green-400">$</span>
                  <input
                    type="number"
                    value={initialBalance.toFixed(2)}
                    onChange={(e) => setInitialBalance(parseFloat(e.target.value) || 0)}
                    min="100"
                    max="1000000"
                    step="100"
                    className="w-auto min-w-[120px] max-w-[200px] text-2xl font-bold text-green-400 bg-transparent border-b-2 border-green-500/30 focus:border-green-500 focus:outline-none transition-colors text-center font-mono"
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">לחץ לעריכה</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-900/30 to-yellow-900/20 rounded-xl p-6 border border-orange-500/30 backdrop-blur-sm">
              <div className="text-4xl mb-2">🎯</div>
              <div className="text-sm text-gray-400 mb-1">תבניות לזיהוי</div>
              <div className="text-xl font-bold text-orange-400">
                Breakout • Retest • Flag
              </div>
            </div>

            {uploadedFile && (
              <>
                <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/20 rounded-xl p-6 border border-blue-500/30 backdrop-blur-sm">
                  <div className="text-4xl mb-2">📊</div>
                  <div className="text-sm text-gray-400 mb-1">נכס מסחר</div>
                  <div className="text-3xl font-bold text-blue-400">{assetName}</div>
                </div>

                <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/20 rounded-xl p-6 border border-purple-500/30 backdrop-blur-sm">
                  <div className="text-4xl mb-2">⏱️</div>
                  <div className="text-sm text-gray-400 mb-1">מסגרת זמן</div>
                  <div className="text-3xl font-bold text-purple-400">
                    {timeframe === '1m' ? '1 דקה' :
                     timeframe === '5m' ? '5 דקות' :
                     timeframe === '15m' ? '15 דקות' :
                     timeframe === '30m' ? '30 דקות' :
                     timeframe === '1H' ? '1 שעה' :
                     timeframe === '4H' ? '4 שעות' :
                     timeframe === '1D' ? 'יום' :
                     timeframe === '1W' ? 'שבוע' : timeframe}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* העלאת קובץ CSV */}
          <div className="mb-6">
            <div className="bg-gradient-to-br from-amber-900/30 to-orange-900/20 rounded-xl p-6 border border-amber-500/30 backdrop-blur-sm">
              {/* אינדיקציה למשחק שמור */}
              {savedGameInfo && uploadedFile && savedGameInfo.sourceFileName === uploadedFile.name && (
                <div className="mb-4 p-3 bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-500/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-green-400 font-bold mb-1">
                        <span className="text-xl">💾</span>
                        <span>נמצא משחק שמור!</span>
                      </div>
                      <div className="text-xs text-gray-300 mr-7">
                        נשמר ב-{new Date(savedGameInfo.savedAt).toLocaleString('he-IL')} •
                        נר {savedGameInfo.currentIndex} •
                        {savedGameInfo.positions.length} פוזיציות פתוחות
                      </div>
                      <div className="text-xs text-green-300 mt-1 mr-7 font-semibold">
                        ⚡ המשחק ימשיך מהנקודה בה עצרת
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        clearSavedGame()
                        setRefreshSavedGame(prev => prev + 1) // כפיית re-render כדי לעדכן את savedGameInfo
                      }}
                      className="px-4 py-2 bg-red-600/80 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap"
                      title="מחק משחק שמור והתחל משחק חדש"
                    >
                      🗑️ התחל משחק חדש
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 mb-4">
                <div className="text-4xl">📁</div>
                <div className="flex-1">
                  <div className="text-sm text-gray-400 mb-2">העלה קובץ היסטוריה מ-TradingView (אופציונלי)</div>
                  {uploadedFile ? (
                    <div className="flex items-center gap-3">
                      <div className="text-green-400 font-bold">✓ {uploadedFile.name}</div>
                      <button
                        onClick={() => setUploadedFile(null)}
                        className="text-xs text-red-400 hover:text-red-300 underline"
                      >
                        הסר
                      </button>
                    </div>
                  ) : (
                    <div className="text-gray-500 text-sm">לא נבחר קובץ - ישתמש בנתונים סינתטיים</div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg font-bold hover:from-amber-600 hover:to-orange-700 transition-all flex items-center gap-2"
                >
                  <Upload size={20} />
                  <span>בחר CSV</span>
                </button>
              </div>

              {/* שדות Asset, Timeframe וטווח תאריכים */}
              {uploadedFile && (
                <>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-amber-500/20">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">שם הנכס / מטבע</label>
                      <input
                        type="text"
                        value={assetName}
                        onChange={(e) => setAssetName(e.target.value)}
                        placeholder="BTC/USD, ETH/USD..."
                        className="w-full px-4 py-2 bg-dark-bg/50 border border-amber-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">טווח זמן</label>
                      <select
                        value={timeframe}
                        onChange={(e) => setTimeframe(e.target.value)}
                        className="w-full px-4 py-2 bg-dark-bg/50 border border-amber-500/30 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors"
                      >
                        <option value="1m">1 דקה</option>
                        <option value="5m">5 דקות</option>
                        <option value="15m">15 דקות</option>
                        <option value="30m">30 דקות</option>
                        <option value="1H">1 שעה</option>
                        <option value="4H">4 שעות</option>
                        <option value="1D">יום</option>
                        <option value="1W">שבוע</option>
                      </select>
                    </div>
                  </div>

                  {/* בחירת טווח תאריכים */}
                  {availableDateRange && (
                    <div className="pt-4 border-t border-amber-500/20 mt-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="text-2xl">📅</div>
                          <div>
                            <div className="text-sm font-semibold text-amber-400">בחר טווח תאריכים</div>
                            <div className="text-xs text-gray-500">
                              זמין: {availableDateRange.start} עד {availableDateRange.end}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedDateRange({ start: availableDateRange.start, end: availableDateRange.end })}
                          className="px-3 py-1 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded text-xs text-amber-400 transition-colors"
                          title="איפוס לטווח המלא"
                        >
                          🔄 איפוס
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">תאריך התחלה</label>
                          <input
                            type="date"
                            value={selectedDateRange?.start || availableDateRange.start}
                            onChange={(e) => setSelectedDateRange(prev => ({ ...prev!, start: e.target.value }))}
                            min={availableDateRange.start}
                            max={selectedDateRange?.end || availableDateRange.end}
                            className="w-full px-3 py-2 bg-dark-bg/50 border border-amber-500/30 rounded-lg text-sm focus:outline-none focus:border-amber-500 transition-colors [color-scheme:dark]"
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">תאריך סיום</label>
                          <input
                            type="date"
                            value={selectedDateRange?.end || availableDateRange.end}
                            onChange={(e) => setSelectedDateRange(prev => ({ ...prev!, end: e.target.value }))}
                            min={selectedDateRange?.start || availableDateRange.start}
                            max={availableDateRange.end}
                            className="w-full px-3 py-2 bg-dark-bg/50 border border-amber-500/30 rounded-lg text-sm focus:outline-none focus:border-amber-500 transition-colors [color-scheme:dark]"
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* כפתור התחלה */}
          <div className="text-center">
            <button
              onClick={handleStartGame}
              disabled={isLoading}
              className="group relative px-12 py-5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl font-bold text-2xl hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-2xl shadow-blue-500/50 hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3 justify-center">
                <span>{uploadedFile ? 'התחל עם קובץ שלי' : 'התחל משחק חדש'}</span>
                {isLoading ? (
                  <Loader2 size={32} className="animate-spin" />
                ) : (
                  <Play size={32} className="group-hover:animate-pulse transform rotate-180" />
                )}
              </div>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400 to-purple-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity"></div>
            </button>

            <p className="mt-6 text-gray-400 text-sm">
              ⚡ {uploadedFile ? `${availableDateRange?.start || ''} - ${availableDateRange?.end || ''}` : '500 נרות'} • {uploadedFile ? 'זיהוי דפוסים אוטומטי' : '8 תבניות טכניות'} • משוב בזמן אמת
            </p>
          </div>
        </div>
      </div>
    )
  }

  // מסך טעינה - רק אם אין משחק בכלל ולא בטעינה
  if (!gameState && !isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-dark-bg">
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-4" size={48} />
          <p className="text-text-secondary">טוען משחק...</p>
        </div>
      </div>
    )
  }

  // ⚠️ הסרנו את מסך השגיאה המלא!
  // שגיאות מוצגות רק ב-toast notifications (כבר מטופל ב-gameStore)
  // זה מונע טעינה מחדש של המשחק כשיש שגיאה ושומר על כל הפוזיציות והפקודות

  // מסך משחק
  if (gameState) {
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
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
          <div style={{ flex: '1 1 0', minHeight: '0' }}>
            <TradingChart />
          </div>
          <div style={{ flex: '0 0 250px' }}>
            <EquityChart />
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-96 bg-dark-panel border-r border-dark-border flex flex-col overflow-y-auto">
          <AccountInfo />
          <OrderPanel />
          <PendingOrdersList />
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

  // Fallback - אם אין משחק ויש טעינה
  return null
}

export default App

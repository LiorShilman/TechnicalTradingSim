import { useEffect, useState, useRef, useMemo } from 'react'
import TradingChart from './components/Chart/TradingChart'
import OrderPanel from './components/Trading/OrderPanel'
import AccountInfo from './components/Trading/AccountInfo'
import PositionsList from './components/Trading/PositionsList'
import PendingOrdersList from './components/Trading/PendingOrdersList'
import ChartControls from './components/Chart/ChartControls'
import EquityChart from './components/Chart/EquityChart'
import PatternLegendPanel from './components/Chart/PatternLegendPanel'
import GameStats from './components/Stats/GameStats'
import TradeHistory from './components/Stats/TradeHistory'
import HelpModal from './components/Help/HelpModal'
import AlertSettings from './components/Settings/AlertSettings'
import { RulesSettingsPanel } from './components/Settings/RulesSettingsPanel'
import { RuleCompliancePanel } from './components/Stats/RuleCompliancePanel'
import ProfitTrail from './components/Effects/ProfitTrail'
import TargetZoneGlow from './components/Effects/TargetZoneGlow'
import EquityColorShift from './components/Effects/EquityColorShift'
import { useGameStore } from './stores/gameStore'
import { priceAlertsService } from './services/priceAlertsService'
import { useVisualEffects } from './hooks/useVisualEffects'
import { Play, Loader2, Upload, Trash2, HelpCircle } from 'lucide-react'
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
  const [priceAlerts, setPriceAlerts] = useState(() => priceAlertsService.getAlerts())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { gameState, isLoading, showStats, showTradeHistory, showHelp, toggleTradeHistory, toggleHelp, initializeGameWithCSV, loadSavedGame, getSavedGameInfo, clearSavedGame } = useGameStore()

  // בדיקה אם יש משחק שמור - מתעדכן כשמשנים את refreshSavedGame
  const savedGameInfo = useMemo(() => {
    const info = getSavedGameInfo()
    console.log('🔍 SavedGameInfo check:', {
      hasInfo: !!info,
      uploadedFileName: uploadedFile?.name,
      savedFileName: info?.sourceFileName,
      matches: info && uploadedFile && info.sourceFileName === uploadedFile.name
    })
    return info
  }, [refreshSavedGame, getSavedGameInfo, uploadedFile])

  // Visual effects hook
  const { profitTrail } = useVisualEffects(gameState)

  // כאשר gameState הופך ל-null (לאחר resetGame), חזור למסך ההתחלה
  useEffect(() => {
    if (gameState === null && !isStartScreen) {
      console.log('🔄 gameState is null, returning to start screen and refreshing saved game info')
      setIsStartScreen(true)
      setRefreshSavedGame(prev => prev + 1) // רענון מצב משחק שמור
    }
  }, [gameState, isStartScreen])

  // Price Alerts handlers
  const handleAddAlert = (alert: Omit<import('./types/game.types').PriceAlert, 'id' | 'createdAt'>) => {
    priceAlertsService.addAlert(alert)
    setPriceAlerts(priceAlertsService.getAlerts())
  }

  const handleRemoveAlert = (id: string) => {
    priceAlertsService.removeAlert(id)
    setPriceAlerts(priceAlertsService.getAlerts())
  }

  const handleToggleAlert = (id: string) => {
    priceAlertsService.toggleAlert(id)
    setPriceAlerts(priceAlertsService.getAlerts())
  }

  const handleStartGame = async (forceNewGame = false) => {
    // ⭐ CRITICAL: אל תעדכן את setIsStartScreen לפני שהמשחק נטען!
    // זה גורם ל-re-render שמאפס את הגרף

    // ניסיון לטעון משחק שמור (אם יש קובץ ותואם ולא נאלץ משחק חדש)
    if (!forceNewGame && uploadedFile && savedGameInfo) {
      const loaded = await loadSavedGame(uploadedFile, selectedDateRange)
      if (loaded) {
        console.log('✅ Resumed from saved game')
        setIsStartScreen(false) // ✅ רק אחרי שהמשחק נטען בהצלחה
        return
      }
    }

    // אחרת, יצירת משחק חדש (רק עם CSV!)
    if (uploadedFile) {
      await initializeGameWithCSV(uploadedFile, assetName, timeframe, initialBalance, selectedDateRange)
      // ✅ עדכון מסך רק אחרי שהמשחק נטען
      setIsStartScreen(false)
    } else {
      toast.error('נא להעלות קובץ CSV לפני התחלת המשחק')
    }
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
        // או מספר בלבד לפורמט FOREX (60, 240 וכו')
        const timeframeRegex = /^\d+[DHmW]$/
        const forexTimeframeRegex = /^\d+$/
        let timeframeIndex = parts.findIndex(part => timeframeRegex.test(part) || forexTimeframeRegex.test(part))

        console.log(`🔍 Timeframe index: ${timeframeIndex}`)

        if (timeframeIndex !== -1) {
          // מצאנו timeframe
          const rawTimeframe = parts[timeframeIndex]

          // המרה מפורמט FOREX (דקות) לפורמט רגיל
          if (forexTimeframeRegex.test(rawTimeframe) && !timeframeRegex.test(rawTimeframe)) {
            const minutes = parseInt(rawTimeframe)
            // המרה מדקות לפורמט TradingView
            if (minutes === 1) detectedTimeframeFromName = '1m'
            else if (minutes === 5) detectedTimeframeFromName = '5m'
            else if (minutes === 15) detectedTimeframeFromName = '15m'
            else if (minutes === 30) detectedTimeframeFromName = '30m'
            else if (minutes === 60) detectedTimeframeFromName = '1H'
            else if (minutes === 240) detectedTimeframeFromName = '4H'
            else if (minutes === 1440) detectedTimeframeFromName = '1D'
            else if (minutes === 10080) detectedTimeframeFromName = '1W'
            else detectedTimeframeFromName = `${minutes}m` // ברירת מחדל

            console.log(`🔄 Converted FOREX timeframe: ${rawTimeframe} minutes → ${detectedTimeframeFromName}`)
          } else {
            detectedTimeframeFromName = rawTimeframe
          }

          // כל מה שלפני ה-timeframe הוא שם הנכס
          const assetParts = parts.slice(0, timeframeIndex)
          console.log(`💼 Asset parts:`, assetParts)

          if (assetParts.length === 2) {
            // מקרה של SP_SPX -> SP/SPX או FX_EURGBP -> EUR/GBP
            if (assetParts[0] === 'FX' && assetParts[1].length === 6) {
              // פורמט FOREX: FX_EURGBP -> EUR/GBP
              const pair = assetParts[1]
              detectedAsset = `${pair.substring(0, 3)}/${pair.substring(3, 6)}`
            } else {
              detectedAsset = assetParts.join('/')
            }
          } else if (assetParts.length === 1) {
            // מקרה של BTCUSD -> BTC/USD (אם יש USD בסוף)
            const asset = assetParts[0]

            // בדיקה אם זה זוג FOREX בפורמט EURGBP (6 תווים)
            if (asset.length === 6 && /^[A-Z]{6}$/.test(asset)) {
              detectedAsset = `${asset.substring(0, 3)}/${asset.substring(3, 6)}`
            } else if (asset.endsWith('USD')) {
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
      <div className="min-h-screen bg-gradient-to-br from-dark-bg via-blue-950/20 to-purple-950/20 overflow-y-auto" dir="rtl">
        {/* Help Icon - Top Right Corner */}
        <div className="fixed top-4 left-4 z-50">
          <button
            onClick={toggleHelp}
            className="px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg hover:shadow-xl"
            title="מדריך למשחק"
          >
            <HelpCircle className="w-5 h-5" />
            <span>עזרה</span>
          </button>
        </div>

        <div className="max-w-4xl w-full mx-auto px-4 py-12">
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
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStartGame(false)}
                        disabled={isLoading}
                        className="px-4 py-2 bg-green-600/80 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        title="המשך משחק שמור"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>טוען...</span>
                          </>
                        ) : (
                          <>
                            <Play size={16} className="transform rotate-180" />
                            <span>המשך משחק</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          clearSavedGame()
                          setRefreshSavedGame(prev => prev + 1)
                          toast.success('משחק שמור נמחק בהצלחה! 🗑️')
                        }}
                        disabled={isLoading}
                        className="px-3 py-2 bg-red-600/80 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        title="מחק משחק שמור"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
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
                      <div className="w-full px-4 py-2 bg-dark-bg/30 border border-amber-500/20 rounded-lg text-white cursor-not-allowed">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📊</span>
                          <span className="font-semibold text-blue-400">{assetName}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">זוהה אוטומטית מהקובץ</div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">טווח זמן</label>
                      <div className="w-full px-4 py-2 bg-dark-bg/30 border border-amber-500/20 rounded-lg text-white cursor-not-allowed">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">⏱️</span>
                          <span className="font-semibold text-purple-400">
                            {timeframe === '1m' ? '1 דקה' :
                             timeframe === '5m' ? '5 דקות' :
                             timeframe === '15m' ? '15 דקות' :
                             timeframe === '30m' ? '30 דקות' :
                             timeframe === '1H' ? '1 שעה' :
                             timeframe === '4H' ? '4 שעות' :
                             timeframe === '1D' ? 'יום' :
                             timeframe === '1W' ? 'שבוע' : timeframe}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">זוהה אוטומטית מהקובץ</div>
                      </div>
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
              onClick={() => {
                // משחק חדש - לא מוחק משחק שמור אוטומטית
                handleStartGame(true)
              }}
              disabled={isLoading || !uploadedFile}
              className="group relative px-12 py-5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl font-bold text-2xl hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105 shadow-2xl shadow-blue-500/50 hover:shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3 justify-center">
                <span>התחל משחק חדש</span>
                {isLoading ? (
                  <Loader2 size={32} className="animate-spin" />
                ) : (
                  <Play size={32} className="group-hover:animate-pulse transform rotate-180" />
                )}
              </div>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-400 to-purple-500 opacity-0 group-hover:opacity-20 blur-xl transition-opacity"></div>
            </button>

            {uploadedFile && (
              <p className="mt-6 text-gray-400 text-sm">
                ⚡ {availableDateRange?.start || ''} - {availableDateRange?.end || ''} • זיהוי דפוסים אוטומטי • משוב בזמן אמת
              </p>
            )}
            {!uploadedFile && (
              <p className="mt-6 text-yellow-400 text-sm font-semibold">
                📁 נא להעלות קובץ CSV מ-TradingView כדי להתחיל
              </p>
            )}
          </div>
        </div>

        {/* Help modal - also available on start screen */}
        {showHelp && <HelpModal onClose={toggleHelp} />}

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
      {/* Visual Effects Layer */}
      <EquityColorShift
        equity={gameState.account.equity}
        initialBalance={initialBalance}
      />

      {/* Profit Trail Animation */}
      {profitTrail && (
        <ProfitTrail position={profitTrail.position} />
      )}

      {/* Target Zone Glow - for first open position with TP */}
      {gameState.positions.length > 0 && gameState.positions[0].takeProfit && (
        <TargetZoneGlow
          position={{
            type: gameState.positions[0].type,
            entryPrice: gameState.positions[0].entryPrice,
            currentPrice: gameState.candles[gameState.currentIndex]?.close || 0,
            takeProfit: gameState.positions[0].takeProfit,
          }}
        />
      )}

      {/* Header - Responsive */}
      <header className="h-auto lg:h-16 bg-dark-panel border-b border-dark-border flex flex-col lg:flex-row items-start lg:items-center justify-between px-3 lg:px-6 py-2 lg:py-0 relative z-10 gap-2 lg:gap-0">
        <div className="flex items-center gap-3 lg:gap-6 min-w-[200px] lg:min-w-[280px]">
          <h1 className="text-lg lg:text-2xl font-bold bg-gradient-to-l from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent whitespace-nowrap">
            משחק מסחר טכני
          </h1>
        </div>
        <div className="w-full overflow-x-auto">
          <ChartControls />
        </div>
      </header>

      {/* Main content - Responsive: stacked on portrait, 3-column on landscape/desktop */}
      <div className="flex-1 flex flex-col landscape:flex-row lg:flex-row overflow-hidden relative z-10">
        {/* Left sidebar - Account, Order, Lists */}
        {/* Portrait: full width + max-h-[40vh], Landscape (tablet): w-72, Desktop (lg+): w-96 full height */}
        <div className="w-full landscape:w-72 lg:!w-96 bg-dark-panel border-l border-dark-border flex flex-col max-h-[40vh] portrait:max-h-[40vh] landscape:max-h-none lg:max-h-none overflow-y-auto landscape:overflow-y-visible lg:overflow-y-visible">
          <AccountInfo />
          <OrderPanel />

          {/* רשימת פוזיציות ופקודות עתידיות - גלילה משותפת */}
          <div className="flex-1 overflow-y-auto">
            <PendingOrdersList />
            <PositionsList />
          </div>
        </div>

        {/* Chart area - אמצע */}
        {/* Portrait: full width, Landscape (tablet): flex-1, Desktop (lg+): flex-1 with EquityChart */}
        <div className="flex-1 flex flex-col p-2 landscape:p-3 lg:p-4 gap-2 landscape:gap-3 lg:gap-4 overflow-hidden">
          {/* Main Trading Chart - Takes remaining height after bottom section */}
          <div className="flex-1 min-h-0" style={{ height: 'calc(100% - 386px)' }}>
            <TradingChart />
            <AlertSettings
              priceAlerts={priceAlerts}
              onAddAlert={handleAddAlert}
              onRemoveAlert={handleRemoveAlert}
              onToggleAlert={handleToggleAlert}
              currentPrice={gameState?.candles[gameState.currentIndex]?.close || 0}
            />
          </div>
          {/* EquityChart + Pattern Legend - Fixed height bottom section */}
          <div className="hidden lg:flex flex-row gap-4" style={{ height: '370px', flexShrink: 0 }}>
            <div className="flex-[3] h-full">
              <EquityChart />
            </div>
            <div className="flex-1 h-full">
              <PatternLegendPanel />
            </div>
          </div>
        </div>

        {/* Right sidebar - כללים ומשמעת */}
        {/* Portrait: hidden, Landscape (tablet): w-64, Desktop (lg+): w-[420px] */}
        <div className="hidden landscape:flex lg:flex landscape:w-64 lg:!w-[420px] bg-dark-panel border-r border-dark-border flex-col overflow-y-auto">
          {/* כללי מסחר */}
          <div className="p-2 landscape:p-3 lg:p-4 border-b border-dark-border">
            <RulesSettingsPanel />
          </div>

          {/* משמעת מסחר */}
          <div className="p-2 landscape:p-3 lg:p-4 flex-1">
            <RuleCompliancePanel />
          </div>
        </div>
      </div>

      {/* Stats modal (shown when game is complete or when user saves and exits) */}
      {(gameState?.isComplete || showStats) && <GameStats />}

      {/* Trade History modal */}
      {showTradeHistory && gameState && (
        <TradeHistory
          closedPositions={gameState.closedPositions}
          sourceFileName={gameState.sourceFileName || 'Unknown'}
          sourceDateRange={
            typeof gameState.sourceDateRange === 'string'
              ? gameState.sourceDateRange
              : gameState.sourceDateRange
                ? `${gameState.sourceDateRange.start} - ${gameState.sourceDateRange.end}`
                : 'Unknown'
          }
          assetSymbol={gameState.asset}
          onClose={toggleTradeHistory}
        />
      )}

      {/* Help modal */}
      {showHelp && <HelpModal onClose={toggleHelp} />}

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

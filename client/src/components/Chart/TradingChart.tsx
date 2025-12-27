import { useEffect, useRef, useState } from 'react'
import { createChart, IChartApi, ISeriesApi, ISeriesApi as LineSeriesApi, Time } from 'lightweight-charts'
import { useGameStore } from '@/stores/gameStore'
import PendingOrderMenu from './PendingOrderMenu'

export default function TradingChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const volumeMASeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const patternLineSeriesRef = useRef<LineSeriesApi<'Line'>[]>([])
  const pendingOrderLineSeriesRef = useRef<LineSeriesApi<'Line'>[]>([])
  const lastCandleIndexRef = useRef<number>(-1)
  const initialIndexRef = useRef<number>(-1) // האינדקס ההתחלתי של המשחק
  const lastGameIdRef = useRef<string | null>(null) // מעקב אחרי gameId כדי לזהות משחק חדש/טעון

  const { gameState, setChartControls } = useGameStore()

  // State for pending order menu
  const [pendingOrderMenu, setPendingOrderMenu] = useState<{
    price: number
    x: number
    y: number
  } | null>(null)

  useEffect(() => {
    console.log('TradingChart: Mounting chart component')
    if (!chartContainerRef.current) return

    // יצירת גרף
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0a0e27' },
        textColor: '#e8eaed',
      },
      grid: {
        vertLines: { color: '#1e2442' },
        horzLines: { color: '#1e2442' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5, // ריווח מימין
        barSpacing: 8, // ריווח בין נרות
        fixLeftEdge: false, // מאפשר גלילה חופשית
        fixRightEdge: false, // מאפשר גלילה חופשית
      },
      rightPriceScale: {
        borderVisible: false,
        autoScale: true, // זום אוטומטי
        scaleMargins: {
          top: 0.1,
          bottom: 0.3,
        },
      },
      handleScale: {
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
        mouseWheel: true, // זום עם גלגלת
        pinch: true, // זום עם pinch במובייל
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
    })

    chartRef.current = chart

    // רישום פונקציות בקרת גרף בסטור
    const handleFitContent = () => {
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent()
      }
    }
    const handleResetZoom = () => {
      if (chartRef.current) {
        chartRef.current.timeScale().resetTimeScale()
        chartRef.current.priceScale('right').applyOptions({
          autoScale: true,
        })
      }
    }
    setChartControls(handleFitContent, handleResetZoom)

    // יצירת סדרת נרות
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#00c853',
      downColor: '#ff1744',
      borderUpColor: '#00c853',
      borderDownColor: '#ff1744',
      wickUpColor: '#00c853',
      wickDownColor: '#ff1744',
    })

    // יצירת קו MA 20 לVolume - קודם! כדי שיהיה מאחורי הברים
    const volumeMASeries = chart.addLineSeries({
      color: '#2962FF',
      lineWidth: 3, // עבה יותר
      priceScaleId: '', // אותו ציר מחירים כמו Volume
      priceLineVisible: false,
      lastValueVisible: false,
    })

    // הגדרת המרווחים של MA להיות כמו Volume
    volumeMASeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.72, // Volume מתחיל ב-72% מלמעלה (הפרדה ברורה יותר)
        bottom: 0.02, // רווח קטן מלמטה
      },
    })

    // יצירת סדרת Volume (Histogram) - אחרי MA כדי שיהיה מעל
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // ציר מחירים נפרד
    })

    // הגדרת ציר מחירים נפרד ל-Volume (בתחתית הגרף)
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.72, // Volume מתחיל ב-72% מלמעלה (הפרדה ברורה)
        bottom: 0.02, // רווח קטן מלמטה
      },
    })

    // הגדרת ציר מחירים ראשי (לנרות) - תופס 70% עליונים
    candlestickSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.02, // רווח קטן מלמעלה
        bottom: 0.30, // משאיר מקום לווליום למטה
      },
    })

    chartRef.current = chart
    candlestickSeriesRef.current = candlestickSeries
    volumeSeriesRef.current = volumeSeries
    volumeMASeriesRef.current = volumeMASeries

    // Resize handler
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        })
      }
    }

    // Auto-fit when reaching edges
    const handleVisibleLogicalRangeChange = () => {
      const logicalRange = chart.timeScale().getVisibleLogicalRange()
      if (!logicalRange) return

      // אם הגענו לקצה השמאלי או הימני, התאם את הזום
      const barSpacing = chart.timeScale().options().barSpacing
      if (logicalRange.from < 0 || barSpacing < 2) {
        chart.timeScale().applyOptions({
          barSpacing: Math.max(barSpacing, 3),
        })
      }
    }

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange)
    window.addEventListener('resize', handleResize)

    // Right-click handler for pending orders
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()

      if (!chartContainerRef.current || !chartRef.current || !candlestickSeriesRef.current) return

      // Get cursor position relative to chart
      const rect = chartContainerRef.current.getBoundingClientRect()
      const relativeY = e.clientY - rect.top

      // ✅ שימוש ב-coordinateToPrice של הסדרה עצמה (candlestickSeries)
      // זה ה-API הנכון להמרת Y coordinate למחיר
      const price = candlestickSeriesRef.current.coordinateToPrice(relativeY)

      if (price === null || price === undefined) {
        console.log('coordinateToPrice returned null - click might be outside chart area')
        return
      }

      // Show context menu with exact price
      setPendingOrderMenu({
        price: price,
        x: e.clientX,
        y: e.clientY,
      })
    }

    chartContainerRef.current.addEventListener('contextmenu', handleContextMenu)

    return () => {
      console.log('TradingChart: Unmounting chart component')
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange)
      window.removeEventListener('resize', handleResize)
      chartContainerRef.current?.removeEventListener('contextmenu', handleContextMenu)
      chart.remove()
    }
  }, [])

  // פונקציה ליצירת סימון תבניות
  const createPatternMarkers = () => {
    if (!chartRef.current || !gameState?.patterns || !gameState?.candles) return
    if (!candlestickSeriesRef.current) return

    // הסרת סימונים ישנים (קווים)
    patternLineSeriesRef.current.forEach((series: ISeriesApi<'Line'>) => {
      try {
        chartRef.current?.removeSeries(series)
      } catch (e) {
        // Series might already be removed, ignore error
      }
    })
    patternLineSeriesRef.current = []

    // רשימת markers חדשה
    const markers: any[] = []

    // יצירת סימון לכל תבנית שנחשפה
    gameState.patterns.forEach((pattern) => {
      // רק תבניות שכבר נחשפו (currentIndex עבר את ה-startIndex)
      if (gameState.currentIndex < pattern.startIndex) return

      const patternColors = {
        breakout: '#FFD700', // זהב
        retest: '#00CED1',   // טורקיז
        flag: '#FF69B4',     // ורוד
      }

      const color = patternColors[pattern.type as keyof typeof patternColors] || '#FFFFFF'

      // יצירת קו עליון (סימון גבול התבנית)
      const topLineSeries = chartRef.current!.addLineSeries({
        color,
        lineWidth: 2,
        lineStyle: 2, // dashed
        priceLineVisible: false,
        lastValueVisible: false,
      })

      // מציאת המחיר הגבוה ביותר בתבנית
      const patternCandles = gameState.candles.slice(pattern.startIndex, Math.min(pattern.endIndex + 1, gameState.currentIndex + 1))
      const maxPrice = Math.max(...patternCandles.map(c => c.high))
      const minPrice = Math.min(...patternCandles.map(c => c.low))

      // יצירת נקודות עבור הקו העליון
      const topLineData = patternCandles.map(candle => ({
        time: candle.time as Time,
        value: maxPrice * 1.01, // קצת מעל המקסימום
      }))

      topLineSeries.setData(topLineData)
      patternLineSeriesRef.current.push(topLineSeries)

      // יצירת קו תחתון
      const bottomLineSeries = chartRef.current!.addLineSeries({
        color,
        lineWidth: 2,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
      })

      const bottomLineData = patternCandles.map(candle => ({
        time: candle.time as Time,
        value: minPrice * 0.99, // קצת מתחת למינימום
      }))

      bottomLineSeries.setData(bottomLineData)
      patternLineSeriesRef.current.push(bottomLineSeries)

      // הוספת marker לתחילת התבנית
      if (pattern.startIndex <= gameState.currentIndex) {
        const startCandle = gameState.candles[pattern.startIndex]
        const patternNames = {
          breakout: '⚡ Breakout',
          retest: '🔄 Retest',
          flag: '🚩 Bull Flag',
        }

        markers.push({
          time: startCandle.time as Time,
          position: 'aboveBar' as const,
          color,
          shape: 'arrowDown' as const,
          text: patternNames[pattern.type as keyof typeof patternNames],
        })
      }
    })

    // הגדרת כל ה-markers בבת אחת
    if (markers.length > 0 && candlestickSeriesRef.current) {
      candlestickSeriesRef.current.setMarkers(markers)
    }
  }

  // פונקציה ליצירת סימון פקודות עתידיות
  const createPendingOrderLines = () => {
    if (!chartRef.current || !gameState?.pendingOrders || !gameState?.candles) return

    // הסרת קווים ישנים
    pendingOrderLineSeriesRef.current.forEach((series: ISeriesApi<'Line'>) => {
      try {
        chartRef.current?.removeSeries(series)
      } catch (e) {
        // Series might already be removed, ignore error
      }
    })
    pendingOrderLineSeriesRef.current = []

    // יצירת קו אופקי לכל פקודה עתידית
    gameState.pendingOrders.forEach((order) => {
      const color = order.type === 'long' ? '#22c55e' : '#ef4444' // ירוק ל-LONG, אדום ל-SHORT

      // יצירת קו אופקי
      const priceLine = chartRef.current!.addLineSeries({
        color,
        lineWidth: 2,
        lineStyle: 1, // dashed
        priceLineVisible: false,
        lastValueVisible: false,
      })

      // קו אופקי על פני כל הגרף
      const visibleCandles = gameState.candles.slice(0, gameState.currentIndex + 1)
      if (visibleCandles.length > 0) {
        const lineData = [
          { time: visibleCandles[0].time as Time, value: order.targetPrice },
          { time: visibleCandles[visibleCandles.length - 1].time as Time, value: order.targetPrice },
        ]

        priceLine.setData(lineData)
        pendingOrderLineSeriesRef.current.push(priceLine)
      }
    })
  }

  // עדכון נתונים כשיש נרות חדשים
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current || !volumeMASeriesRef.current || !gameState?.candles) {
      console.log('TradingChart: Missing data', {
        hasSeries: !!candlestickSeriesRef.current,
        hasVolumeSeries: !!volumeSeriesRef.current,
        hasVolumeMA: !!volumeMASeriesRef.current,
        hasCandles: !!gameState?.candles
      })
      return
    }

    const currentIndex = gameState.currentIndex
    const currentGameId = gameState.id
    console.log('TradingChart: Update triggered', {
      currentIndex,
      lastIndex: lastCandleIndexRef.current,
      currentGameId,
      lastGameId: lastGameIdRef.current
    })

    // זיהוי משחק חדש/טעון - אם ה-gameId השתנה, זה אומר שנטען משחק חדש
    const isNewGame = currentGameId !== lastGameIdRef.current

    // ⭐ CRITICAL: אם זה משחק חדש/טעון, תמיד טען את כל הנרות הגלויים, גם אם האינדקס זהה
    // זה מבטיח שהגרף יציג את המצב הנוכחי מיד בטעינה, לפני לחיצה על "הפעל"
    if (isNewGame) {
      console.log('🆕 New/Loaded game detected - forcing full chart reload')
      // אל תחזור מוקדם! המשך לקוד שטוען את כל הנרות למטה
    }

    // אם זה משחק חדש/טעון או reset, טען את כל הנתונים הגלויים
    if (isNewGame || currentIndex < lastCandleIndexRef.current || lastCandleIndexRef.current === -1) {
      // מציג את כל הנרות מההתחלה עד האינדקס הנוכחי
      const visibleCandles = gameState.candles.slice(0, currentIndex + 1)
      console.log('TradingChart: Loading all candles', {
        totalCandlesInGameState: gameState.candles.length,
        visibleCandlesCount: visibleCandles.length,
        currentIndex,
        isNewGame,
        firstCandle: visibleCandles[0],
        lastCandle: visibleCandles[visibleCandles.length - 1]
      })

      // עדכון נרות
      candlestickSeriesRef.current.setData(visibleCandles.map(c => ({
        ...c,
        time: c.time as Time
      })))

      // עדכון Volume - צבע לפי כיוון הנר
      const volumeData = visibleCandles.map(candle => ({
        time: candle.time as Time,
        value: candle.volume,
        color: candle.close >= candle.open ? '#00c85380' : '#ff174480', // ירוק/אדום עם שקיפות
      }))
      volumeSeriesRef.current.setData(volumeData)

      // אל תציג MA בטעינה ראשונית - רק אחרי שהמשתמש מתקדם בפועל
      // המשתמש צריך להתקדם 20 נרות מהאינדקס ההתחלתי כדי שה-MA יופיע
      volumeMASeriesRef.current.setData([])
      console.log(`MA Initial: No MA on first load - will appear after progressing 20 candles from index ${currentIndex}`)

      // שמירת האינדקס ההתחלתי
      initialIndexRef.current = currentIndex

      lastCandleIndexRef.current = currentIndex
      lastGameIdRef.current = currentGameId // שמירת gameId כדי לזהות משחק טעון

      // יצירת סימון תבניות
      createPatternMarkers()

      // יצירת סימון פקודות עתידיות
      createPendingOrderLines()

      if (chartRef.current && visibleCandles.length > 0) {
        // תמיד הצג את כל הנרות עד האינדקס הנוכחי
        console.log(`📊 Displaying ${visibleCandles.length} candles (0 to ${currentIndex})`)

        // גלילה לסוף (לנר האחרון) עם מרווח סביר
        chartRef.current.timeScale().scrollToPosition(-3, false)

        // התאמה אוטומטית כדי להציג את הנרות בצורה מיטבית
        setTimeout(() => {
          chartRef.current?.timeScale().fitContent()
        }, 100)
      }
      return
    }

    // אם האינדקס לא השתנה ולא נטען משחק חדש, אל תעשה כלום
    if (currentIndex === lastCandleIndexRef.current && !isNewGame) {
      console.log('TradingChart: Index unchanged, skipping')
      return
    }

    // אם זה הנר הראשון אחרי טעינת משחק שמור (initialIndex > 0),
    // צריך לטעון מחדש את כל ההיסטוריה כי update() לא יעבוד
    if (initialIndexRef.current > 0 && currentIndex === initialIndexRef.current + 1 && lastCandleIndexRef.current === initialIndexRef.current) {
      console.log(`🔄 First candle after loading saved game (initialIndex: ${initialIndexRef.current}) - reloading ALL candles`)

      // טען את כל הנרות מחדש מ-0 עד currentIndex
      const allCandles = gameState.candles.slice(0, currentIndex + 1)

      candlestickSeriesRef.current.setData(allCandles.map(c => ({
        ...c,
        time: c.time as Time
      })))

      const volumeData = allCandles.map(candle => ({
        time: candle.time as Time,
        value: candle.volume,
        color: candle.close >= candle.open ? '#00c85380' : '#ff174480',
      }))
      volumeSeriesRef.current.setData(volumeData)

      lastCandleIndexRef.current = currentIndex
      createPatternMarkers()
      createPendingOrderLines()

      if (chartRef.current) {
        chartRef.current.timeScale().scrollToPosition(3, true)
      }

      return
    }

    // אם זה נר חדש, הוסף אותו בלבד (אנימציה חלקה)
    if (currentIndex > lastCandleIndexRef.current) {
      const newCandle = gameState.candles[currentIndex]
      if (newCandle) {
        // חישוב כמה נרות התווספו מאז התחלת המשחק
        const candlesProgressed = currentIndex - initialIndexRef.current

        // עדכון נר
        candlestickSeriesRef.current.update({
          ...newCandle,
          time: newCandle.time as Time
        })

        // עדכון Volume
        volumeSeriesRef.current.update({
          time: newCandle.time as Time,
          value: newCandle.volume,
          color: newCandle.close >= newCandle.open ? '#00c85380' : '#ff174480',
        })

        // עדכון MA 20 של Volume - רק אחרי שהמשתמש התקדם 20 נרות מהאינדקס ההתחלתי!
        if (candlesProgressed >= 20) {
          // חישוב אחורה: 20 נרות אחרונים כולל הנוכחי
          const startIdx = currentIndex - 19
          const endIdx = currentIndex + 1
          const last20Candles = gameState.candles.slice(startIdx, endIdx)

          if (last20Candles.length === 20) {
            const volumeSum = last20Candles.reduce((sum, c) => sum + c.volume, 0)
            const volumeMA = volumeSum / 20

            volumeMASeriesRef.current.update({
              time: newCandle.time as Time,
              value: volumeMA,
            })

            console.log(`MA Update: progressed=${candlesProgressed}, idx=${currentIndex}, range=[${startIdx}, ${endIdx}), MA=${volumeMA.toFixed(2)}`)
          }
        } else {
          console.log(`MA Waiting: progressed=${candlesProgressed}/20, idx=${currentIndex}`)
        }

        lastCandleIndexRef.current = currentIndex

        // עדכון סימון תבניות אם נחשפה תבנית חדשה
        const hasNewPattern = gameState.patterns?.some(p => p.startIndex === currentIndex)
        if (hasNewPattern) {
          createPatternMarkers()
        }

        // עדכון סימון פקודות עתידיות (צריך להתעדכן בכל נר כי הקו מתארך)
        createPendingOrderLines()

        // גלילה אוטומטית חלקה לנר החדש
        if (chartRef.current) {
          chartRef.current.timeScale().scrollToPosition(3, true) // true = אנימציה
        }
      }
    }
  }, [gameState?.currentIndex, gameState?.id, gameState?.candles.length])

  return (
    <div className="w-full h-full bg-dark-panel rounded-lg overflow-hidden relative">
      <div ref={chartContainerRef} className="w-full h-full" />

      {/* Pending Order Menu */}
      {pendingOrderMenu && (
        <PendingOrderMenu
          price={pendingOrderMenu.price}
          x={pendingOrderMenu.x}
          y={pendingOrderMenu.y}
          onClose={() => setPendingOrderMenu(null)}
        />
      )}

      {/* קו הפרדה מודגש בין גרף נרות ל-Volume */}
      <div
        className="absolute left-0 right-0 pointer-events-none z-10"
        style={{ top: '72%', height: '4px', background: 'linear-gradient(to bottom, rgba(59, 130, 246, 0.5), rgba(59, 130, 246, 0.1))' }}
      ></div>

      {/* Pattern Legend */}
      {gameState?.patterns && gameState.patterns.some(p => p.startIndex <= gameState.currentIndex) && (
        <div className="absolute top-3 left-3 bg-dark-bg/90 backdrop-blur-sm rounded-lg p-3 text-xs border border-dark-border">
          <div className="font-semibold mb-2 text-text-secondary">תבניות זוהו:</div>
          <div className="space-y-1">
            {gameState.patterns.filter(p => p.startIndex <= gameState.currentIndex).map((pattern, idx) => {
              const patternInfo = {
                breakout: { icon: '⚡', name: 'Breakout', color: '#FFD700' },
                retest: { icon: '🔄', name: 'Retest', color: '#00CED1' },
                flag: { icon: '🚩', name: 'Bull Flag', color: '#FF69B4' },
              }
              const info = patternInfo[pattern.type as keyof typeof patternInfo]

              return (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: info.color }}></div>
                  <span>{info.icon} {info.name}</span>
                  <span className="text-text-secondary text-[10px]">
                    (נרות {pattern.startIndex}-{Math.min(pattern.endIndex, gameState.currentIndex)})
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

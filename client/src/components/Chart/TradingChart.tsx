import { useEffect, useRef, useState } from 'react'
import { createChart, IChartApi, ISeriesApi, ISeriesApi as LineSeriesApi, Time } from 'lightweight-charts'
import { useGameStore } from '@/stores/gameStore'
import PendingOrderMenu from './PendingOrderMenu'
import ChartToolsPanel from './ChartToolsPanel'
import { type MASettings } from './IndicatorControls'
import { type DrawingTool, type DrawnLine } from './DrawingControls'

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

  // Moving Average series refs
  const ma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const ma50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const ma200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  const { gameState, setChartControls } = useGameStore()

  // State for pending order menu
  const [pendingOrderMenu, setPendingOrderMenu] = useState<{
    price: number
    x: number
    y: number
  } | null>(null)

  // State for MA settings
  const [maSettings, setMASettings] = useState<MASettings>({
    ma20: false,
    ma50: false,
    ma200: false,
    startFromCurrentIndex: true,
  })

  // State for drawing tools
  const [activeTool, setActiveTool] = useState<DrawingTool>('none')
  const activeToolRef = useRef<DrawingTool>('none') // ref for event listeners
  const [drawnLines, setDrawnLines] = useState<DrawnLine[]>([])
  const drawnLinesRef = useRef<DrawnLine[]>([]) // ✅ ref for event listeners to access current drawnLines
  const drawnLineSeriesRef = useRef<LineSeriesApi<'Line'>[]>([])
  const drawnMarkersRef = useRef<any[]>([]) // markers from drawing tools (arrows, notes)
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)
  const [editingLineId, setEditingLineId] = useState<string | null>(null) // For edit modal

  // For multi-point tools (trend line, fibonacci)
  const [, setDrawingInProgress] = useState<{
    type: DrawingTool
    price: number
    time: number
    candleIndex?: number
  } | null>(null)

  // State for dragging SL/TP lines or resizing position width
  const [draggingLine, setDraggingLine] = useState<{
    lineId: string
    lineType: 'stopLoss' | 'takeProfit' | 'entry' | 'resize'
  } | null>(null)
  const draggingLineRef = useRef<{ lineId: string; lineType: 'stopLoss' | 'takeProfit' | 'entry' | 'resize' } | null>(null)

  // Preview lines for pending order (shown while menu is open)
  const previewLineSeriesRef = useRef<ISeriesApi<'Line'>[]>([])

  // Sync activeTool state with ref
  useEffect(() => {
    activeToolRef.current = activeTool
  }, [activeTool])

  // Sync draggingLine state with ref
  useEffect(() => {
    draggingLineRef.current = draggingLine
  }, [draggingLine])

  // Sync drawnLines state with ref (for event listeners)
  useEffect(() => {
    drawnLinesRef.current = drawnLines
  }, [drawnLines])

  // Load drawn lines from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('trading-game-drawings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setDrawnLines(parsed)
      } catch (e) {
        console.error('Failed to parse drawings from localStorage', e)
      }
    }
  }, [])

  // Save drawn lines to localStorage
  useEffect(() => {
    if (drawnLines.length > 0) {
      localStorage.setItem('trading-game-drawings', JSON.stringify(drawnLines))
    }
  }, [drawnLines])

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
      crosshair: {
        mode: 0, // Normal mode (0) - no magnetism, smooth crosshair movement
        vertLine: {
          width: 1,
          color: '#758696',
          style: 3, // dashed
          labelBackgroundColor: '#4a5568',
        },
        horzLine: {
          width: 1,
          color: '#758696',
          style: 3, // dashed
          labelBackgroundColor: '#4a5568',
        },
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

        // ✅ וידוא שה-volume priceScale גם מתאים את עצמו
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.priceScale().applyOptions({
            autoScale: true,
          })
        }
        if (volumeMASeriesRef.current) {
          volumeMASeriesRef.current.priceScale().applyOptions({
            autoScale: true,
          })
        }
      }
    }
    const handleResetZoom = () => {
      if (chartRef.current) {
        chartRef.current.timeScale().resetTimeScale()
        chartRef.current.priceScale('right').applyOptions({
          autoScale: true,
        })

        // ✅ גם לווליום
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.priceScale().applyOptions({
            autoScale: true,
          })
        }
        if (volumeMASeriesRef.current) {
          volumeMASeriesRef.current.priceScale().applyOptions({
            autoScale: true,
          })
        }
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
        bottom: 0.08, // רווח מספיק מלמטה כדי שלא יחתך
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
        bottom: 0.08, // רווח מספיק מלמטה כדי שלא יחתך
      },
    })

    // הגדרת ציר מחירים ראשי (לנרות) - תופס 70% עליונים
    candlestickSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.02, // רווח קטן מלמעלה
        bottom: 0.30, // משאיר מקום לווליום למטה
      },
    })

    // יצירת סדרות ממוצעים נעים (מוסתרות בהתחלה)
    const ma20Series = chart.addLineSeries({
      color: '#2196F3', // כחול
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: false, // מוסתר בהתחלה
    })

    const ma50Series = chart.addLineSeries({
      color: '#FF9800', // כתום
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: false, // מוסתר בהתחלה
    })

    const ma200Series = chart.addLineSeries({
      color: '#F44336', // אדום
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: false, // מוסתר בהתחלה
    })

    chartRef.current = chart
    candlestickSeriesRef.current = candlestickSeries
    volumeSeriesRef.current = volumeSeries
    volumeMASeriesRef.current = volumeMASeries
    ma20SeriesRef.current = ma20Series
    ma50SeriesRef.current = ma50Series
    ma200SeriesRef.current = ma200Series

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

    // Click handler for drawing tools
    const handleChartClick = (e: MouseEvent) => {
      // אם אין כלי שרטוט פעיל, לא עושים כלום
      if (activeToolRef.current === 'none') return

      if (!chartContainerRef.current || !chartRef.current || !candlestickSeriesRef.current) return

      // Get cursor position relative to chart
      const rect = chartContainerRef.current.getBoundingClientRect()
      const relativeY = e.clientY - rect.top
      const relativeX = e.clientX - rect.left

      // המרה למחיר - coordinateToPrice returns exact price at Y coordinate (not snapped to candle)
      const price = candlestickSeriesRef.current.coordinateToPrice(relativeY)
      if (price === null || price === undefined) return

      // המרה לזמן - coordinateToTime may snap to nearest bar, but that's actually desired for time alignment
      const timeScale = chartRef.current.timeScale()
      const time = timeScale.coordinateToTime(relativeX)
      if (time === null || time === undefined) return

      console.log('handleChartClick:', { price, time, relativeX, relativeY, currentTool: activeToolRef.current })

      const currentTool = activeToolRef.current

      // כלים שצריכים נקודה אחת
      if (currentTool === 'horizontal-line' || currentTool === 'horizontal-ray' || currentTool === 'arrow-up' || currentTool === 'arrow-down' || currentTool === 'long-position' || currentTool === 'short-position') {
        const toolColors: Record<string, string> = {
          'horizontal-line': '#FFD700',
          'horizontal-ray': '#00CED1',
          'arrow-up': '#4CAF50',
          'arrow-down': '#F44336',
          'long-position': '#22c55e',
          'short-position': '#ef4444',
        }

        // עבור position tools, נוסיף ברירות מחדל ל-SL/TP
        // חישוב SL/TP כאחוז קטן מהמחיר עצמו (0.5% ל-SL, 1% ל-TP = יחס 1:2)
        let defaultSL: number | undefined = undefined
        let defaultTP: number | undefined = undefined

        if (currentTool === 'long-position' || currentTool === 'short-position') {
          // מרחק SL = 0.5% מהמחיר (סיכון קטן)
          const slPercent = 0.005 // 0.5%
          const slDistance = price * slPercent

          // מרחק TP = 1% מהמחיר (רווח פוטנציאלי) = יחס R:R 1:2
          const tpDistance = slDistance * 2

          if (currentTool === 'long-position') {
            // LONG: SL מתחת, TP מעל
            defaultSL = price - slDistance
            defaultTP = price + tpDistance
          } else if (currentTool === 'short-position') {
            // SHORT: SL מעל, TP מתחת
            defaultSL = price + slDistance
            defaultTP = price - tpDistance
          }
        }

        const candleIndex = gameState?.candles.findIndex(c => c.time === time)

        // עבור position tools, נקבע endIndex התחלתי (15 נרות קדימה)
        let defaultEndIndex: number | undefined = undefined
        if ((currentTool === 'long-position' || currentTool === 'short-position') && candleIndex !== undefined && candleIndex !== -1 && gameState) {
          defaultEndIndex = Math.min(candleIndex + 15, gameState.currentIndex) // 15 נרות או עד currentIndex
        }

        const newLine: DrawnLine = {
          id: `line-${Date.now()}`,
          type: currentTool,
          price: price, // entry price
          // חצים וקווים צריכים startTime
          startTime: (currentTool === 'horizontal-ray' || currentTool === 'arrow-up' || currentTool === 'arrow-down' || currentTool === 'long-position' || currentTool === 'short-position') ? (time as number) : undefined,
          startIndex: (currentTool === 'long-position' || currentTool === 'short-position') && candleIndex !== -1 ? candleIndex : undefined,
          endIndex: defaultEndIndex, // ✅ רוחב התחלתי
          color: toolColors[currentTool] || '#FFD700',
          width: 2,
          // SL/TP עבור position tools
          ...(defaultSL && { stopLoss: defaultSL }),
          ...(defaultTP && { takeProfit: defaultTP }),
        }

        setDrawnLines((prev) => [...prev, newLine])
        setActiveTool('none')
        activeToolRef.current = 'none' // ✅ עדכון ישיר של ref כדי למנוע race condition
        e.preventDefault() // מניעת mousedown מיד אחרי ה-click
      }
      // כלים שצריכים שתי נקודות (trend line, fibonacci, measure)
      else if (currentTool === 'trend-line' || currentTool === 'fibonacci' || currentTool === 'measure') {
        setDrawingInProgress((prev) => {
          if (!prev) {
            // נקודה ראשונה - שמירה
            // מציאת אינדקס הנר
            const candleIndex = gameState?.candles.findIndex(c => c.time === time)
            return {
              type: currentTool,
              price: price,
              time: time as number,
              candleIndex: candleIndex !== -1 ? candleIndex : undefined,
            }
          } else {
            // נקודה שנייה - יצירת הקו
            const toolColors: Record<string, string> = {
              'trend-line': '#9C27B0',
              'fibonacci': '#FF9800',
              'measure': '#FFD700',
            }

            // מציאת אינדקס הנר של הנקודה השנייה
            const endCandleIndex = gameState?.candles.findIndex(c => c.time === time)

            const newLine: DrawnLine = {
              id: `line-${Date.now()}`,
              type: currentTool,
              price: prev.price,
              price2: price,
              startTime: prev.time,
              endTime: time as number,
              startIndex: prev.candleIndex,
              endIndex: endCandleIndex !== -1 ? endCandleIndex : undefined,
              color: toolColors[currentTool] || '#9C27B0',
              width: 2,
            }

            setDrawnLines((lines) => [...lines, newLine])
            setActiveTool('none')
            activeToolRef.current = 'none' // ✅ עדכון ישיר של ref
            return null
          }
        })
      }
      // כלי הערות טקסט
      else if (currentTool === 'note') {
        const text = prompt('הכנס הערה:')
        if (text) {
          const newLine: DrawnLine = {
            id: `line-${Date.now()}`,
            type: currentTool,
            price: price,
            startTime: time as number,
            text: text,
            color: '#03A9F4',
            width: 2,
          }

          setDrawnLines((prev) => [...prev, newLine])
        }
        setActiveTool('none')
        activeToolRef.current = 'none' // ✅ עדכון ישיר של ref
      }
    }

    // Right-click handler for pending orders
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()

      // אם יש כלי שרטוט פעיל, ביטול במקום תפריט
      if (activeToolRef.current !== 'none') {
        setActiveTool('none')
        activeToolRef.current = 'none' // ✅ עדכון ישיר של ref
        setDrawingInProgress(null)
        return
      }

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

    // Double-click handler for editing position tools
    const handleChartDoubleClick = (e: MouseEvent) => {
      if (!chartContainerRef.current || !chartRef.current || !candlestickSeriesRef.current) return

      // Get cursor position
      const rect = chartContainerRef.current.getBoundingClientRect()
      const relativeY = e.clientY - rect.top
      const price = candlestickSeriesRef.current.coordinateToPrice(relativeY)
      if (price === null || price === undefined) return

      // Check if we double-clicked near a position tool line
      const tolerance = 0.02 // 2% price tolerance (same as drag detection)

      const positionLine = drawnLinesRef.current.find(line => {
        if (line.type !== 'long-position' && line.type !== 'short-position') return false

        // Check if click is near entry, SL, or TP price
        const entryMatch = Math.abs((price - line.price) / line.price) < tolerance
        const slMatch = line.stopLoss && Math.abs((price - line.stopLoss) / line.stopLoss) < tolerance
        const tpMatch = line.takeProfit && Math.abs((price - line.takeProfit) / line.takeProfit) < tolerance

        return entryMatch || slMatch || tpMatch
      })

      if (positionLine) {
        console.log('Double-clicked on position tool:', positionLine.id)
        setEditingLineId(positionLine.id)
      }
    }

    // Mousedown handler for initiating drag of SL/TP lines or resize
    const handleMouseDown = (e: MouseEvent) => {
      // Only handle left click
      if (e.button !== 0) return

      // Don't interfere with drawing tools or if we're already dragging
      if (activeToolRef.current !== 'none' || draggingLineRef.current) return

      if (!chartContainerRef.current || !chartRef.current || !candlestickSeriesRef.current) return

      // Get cursor position
      const rect = chartContainerRef.current.getBoundingClientRect()
      const relativeY = e.clientY - rect.top
      const relativeX = e.clientX - rect.left
      const price = candlestickSeriesRef.current.coordinateToPrice(relativeY)
      const time = chartRef.current.timeScale().coordinateToTime(relativeX)

      if (price === null || price === undefined || time === null || time === undefined) return

      // Check if we clicked near a position tool's SL or TP line
      const priceTolerance = 0.02 // 2% price tolerance

      for (const line of drawnLinesRef.current) {
        if (line.type !== 'long-position' && line.type !== 'short-position') continue

        // Check for resize handle click (at endIndex time)
        if (line.endIndex !== undefined && gameState) {
          const endCandle = gameState.candles[line.endIndex]
          if (endCandle) {
            // חישוב טולרנס זמן מבוסס על משך נר אחד (timeframe)
            // לדוגמה: 1D = 86400 שניות, 1H = 3600 שניות
            const candleDuration = gameState.candles.length > 1
              ? Math.abs(gameState.candles[1].time - gameState.candles[0].time)
              : 86400 // default 1 day
            const timeTolerance = candleDuration * 0.5 // חצי נר טולרנס

            if (Math.abs((time as number) - endCandle.time) < timeTolerance) {
              console.log('🎯 Resize marker clicked!', { lineId: line.id, endIndex: line.endIndex, timeTolerance })
              setDraggingLine({ lineId: line.id, lineType: 'resize' })
              e.preventDefault()
              return
            }
          }
        }

        // Check SL line
        if (line.stopLoss && Math.abs((price - line.stopLoss) / line.stopLoss) < priceTolerance) {
          setDraggingLine({ lineId: line.id, lineType: 'stopLoss' })
          e.preventDefault()
          return
        }

        // Check TP line
        if (line.takeProfit && Math.abs((price - line.takeProfit) / line.takeProfit) < priceTolerance) {
          setDraggingLine({ lineId: line.id, lineType: 'takeProfit' })
          e.preventDefault()
          return
        }
      }
    }

    // Mousemove handler for dragging SL/TP lines or resizing
    const handleMouseMove = (e: MouseEvent) => {
      if (!chartContainerRef.current || !chartRef.current || !candlestickSeriesRef.current) return

      // Get cursor position
      const rect = chartContainerRef.current.getBoundingClientRect()
      const relativeY = e.clientY - rect.top
      const relativeX = e.clientX - rect.left
      const price = candlestickSeriesRef.current.coordinateToPrice(relativeY)
      const time = chartRef.current.timeScale().coordinateToTime(relativeX)

      if (price === null || price === undefined) return

      // If we're dragging, update the line position
      if (draggingLineRef.current) {
        const { lineId, lineType } = draggingLineRef.current

        if (lineType === 'resize' && time !== null && time !== undefined && gameState) {
          // Resize: update endIndex based on time
          // חישוב טולרנס זמן מבוסס על משך נר אחד
          const candleDuration = gameState.candles.length > 1
            ? Math.abs(gameState.candles[1].time - gameState.candles[0].time)
            : 86400
          const timeTolerance = candleDuration * 0.5

          // מציאת הנר הקרוב ביותר לזמן הנוכחי
          let newEndIndex = -1
          let minDistance = Infinity
          for (let i = 0; i <= gameState.currentIndex; i++) {
            const distance = Math.abs(gameState.candles[i].time - (time as number))
            if (distance < minDistance && distance < timeTolerance) {
              minDistance = distance
              newEndIndex = i
            }
          }

          if (newEndIndex !== -1) {
            console.log('↔️ Resizing to index:', newEndIndex)
            setDrawnLines(prev => prev.map(line => {
              if (line.id !== lineId) return line
              // Ensure endIndex is between startIndex and currentIndex
              const minEnd = line.startIndex !== undefined ? line.startIndex + 5 : 5 // minimum 5 candles
              const maxEnd = gameState.currentIndex
              const clampedEnd = Math.max(minEnd, Math.min(newEndIndex, maxEnd))
              console.log('📏 New endIndex:', clampedEnd, '(min:', minEnd, 'max:', maxEnd, ')')
              return { ...line, endIndex: clampedEnd }
            }))
          }
        } else if (lineType === 'stopLoss') {
          // Update SL price
          setDrawnLines(prev => prev.map(line => {
            if (line.id !== lineId) return line
            return { ...line, stopLoss: price }
          }))
        } else if (lineType === 'takeProfit') {
          // Update TP price
          setDrawnLines(prev => prev.map(line => {
            if (line.id !== lineId) return line
            return { ...line, takeProfit: price }
          }))
        }
      } else {
        // Not dragging - check if we're hovering over a draggable line/marker and change cursor
        const priceTolerance = 0.02
        let isOverDraggableLine = false
        let isOverResizeMarker = false

        if (time !== null && time !== undefined && gameState) {
          for (const line of drawnLinesRef.current) {
            if (line.type !== 'long-position' && line.type !== 'short-position') continue

            // Check if hovering over resize marker
            if (line.endIndex !== undefined) {
              const endCandle = gameState.candles[line.endIndex]
              if (endCandle) {
                // חישוב טולרנס זמן מבוסס על משך נר אחד
                const candleDuration = gameState.candles.length > 1
                  ? Math.abs(gameState.candles[1].time - gameState.candles[0].time)
                  : 86400
                const timeTolerance = candleDuration * 0.5

                if (Math.abs((time as number) - endCandle.time) < timeTolerance) {
                  isOverResizeMarker = true
                  break
                }
              }
            }

            // Check if hovering over SL or TP line
            if (line.stopLoss && Math.abs((price - line.stopLoss) / line.stopLoss) < priceTolerance) {
              isOverDraggableLine = true
              break
            }
            if (line.takeProfit && Math.abs((price - line.takeProfit) / line.takeProfit) < priceTolerance) {
              isOverDraggableLine = true
              break
            }
          }
        }

        // Change cursor style
        if (isOverResizeMarker && activeToolRef.current === 'none') {
          chartContainerRef.current.style.cursor = 'ew-resize' // ⇔ cursor for horizontal resize
        } else if (isOverDraggableLine && activeToolRef.current === 'none') {
          chartContainerRef.current.style.cursor = 'ns-resize' // ⇕ cursor for vertical drag
        } else if (activeToolRef.current !== 'none') {
          chartContainerRef.current.style.cursor = 'crosshair'
        } else {
          chartContainerRef.current.style.cursor = 'default'
        }
      }
    }

    // Mouseup handler to end dragging
    const handleMouseUp = () => {
      if (draggingLineRef.current) {
        setDraggingLine(null)
      }
    }

    chartContainerRef.current.addEventListener('click', handleChartClick)
    chartContainerRef.current.addEventListener('dblclick', handleChartDoubleClick)
    chartContainerRef.current.addEventListener('contextmenu', handleContextMenu)
    chartContainerRef.current.addEventListener('mousedown', handleMouseDown)
    chartContainerRef.current.addEventListener('mousemove', handleMouseMove)
    chartContainerRef.current.addEventListener('mouseup', handleMouseUp)
    chartContainerRef.current.addEventListener('mouseleave', handleMouseUp) // Also end drag if mouse leaves chart

    return () => {
      console.log('TradingChart: Unmounting chart component')
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange)
      window.removeEventListener('resize', handleResize)
      chartContainerRef.current?.removeEventListener('click', handleChartClick)
      chartContainerRef.current?.removeEventListener('dblclick', handleChartDoubleClick)
      chartContainerRef.current?.removeEventListener('contextmenu', handleContextMenu)
      chartContainerRef.current?.removeEventListener('mousedown', handleMouseDown)
      chartContainerRef.current?.removeEventListener('mousemove', handleMouseMove)
      chartContainerRef.current?.removeEventListener('mouseup', handleMouseUp)
      chartContainerRef.current?.removeEventListener('mouseleave', handleMouseUp)
      chart.remove()
    }
  }, [])

  // פונקציה לחישוב ממוצע נע פשוט (SMA)
  const calculateSMA = (candles: any[], period: number, startIndex: number = 0) => {
    if (!candles || candles.length < period) return []

    const smaData: { time: Time; value: number }[] = []

    // אם startFromCurrentIndex=true, מתחילים מהאינדקס הנוכחי
    const effectiveStartIndex = Math.max(startIndex, period - 1)

    for (let i = effectiveStartIndex; i < candles.length; i++) {
      // חישוב ממוצע של period נרות אחרונים
      let sum = 0
      for (let j = 0; j < period; j++) {
        sum += candles[i - j].close
      }
      const avg = sum / period

      smaData.push({
        time: candles[i].time as Time,
        value: avg,
      })
    }

    return smaData
  }

  // פונקציה לעדכון סדרות ממוצעים נעים
  const updateMASeriesVisibility = () => {
    if (!gameState?.candles || !ma20SeriesRef.current || !ma50SeriesRef.current || !ma200SeriesRef.current) return

    const visibleCandles = gameState.candles.slice(0, gameState.currentIndex + 1)
    const startIndex = maSettings.startFromCurrentIndex ? Math.max(0, gameState.currentIndex - 200) : 0

    // MA 20
    if (maSettings.ma20) {
      const ma20Data = calculateSMA(visibleCandles, 20, startIndex)
      ma20SeriesRef.current.setData(ma20Data)
      ma20SeriesRef.current.applyOptions({ visible: true })
    } else {
      ma20SeriesRef.current.applyOptions({ visible: false })
    }

    // MA 50
    if (maSettings.ma50) {
      const ma50Data = calculateSMA(visibleCandles, 50, startIndex)
      ma50SeriesRef.current.setData(ma50Data)
      ma50SeriesRef.current.applyOptions({ visible: true })
    } else {
      ma50SeriesRef.current.applyOptions({ visible: false })
    }

    // MA 200
    if (maSettings.ma200) {
      const ma200Data = calculateSMA(visibleCandles, 200, startIndex)
      ma200SeriesRef.current.setData(ma200Data)
      ma200SeriesRef.current.applyOptions({ visible: true })
    } else {
      ma200SeriesRef.current.applyOptions({ visible: false })
    }
  }

  // useEffect לעדכון ממוצעים כאשר ההגדרות או הנרות משתנים
  useEffect(() => {
    if (gameState?.candles && gameState.currentIndex >= 0) {
      updateMASeriesVisibility()
    }
  }, [maSettings, gameState?.currentIndex, gameState?.candles.length, gameState?.id])

  // פונקציה לציור קווים שרטוטיים
  const renderDrawnLines = () => {
    if (!chartRef.current || !gameState?.candles || !candlestickSeriesRef.current) return

    // הסרת קווים ישנים
    drawnLineSeriesRef.current.forEach((series) => {
      try {
        chartRef.current?.removeSeries(series)
      } catch (e) {
        // Series might already be removed, ignore error
      }
    })
    drawnLineSeriesRef.current = []

    // מערך markers לחצים והערות
    const markers: any[] = []

    console.log('renderDrawnLines: Processing', drawnLines.length, 'drawn lines')

    // ציור כל הקווים
    drawnLines.forEach((line) => {
      const isSelected = line.id === selectedLineId

      if (line.type === 'horizontal-line' || line.type === 'horizontal-ray' || line.type === 'trend-line') {
        // פונקציה להבהרת צבע - מקצועי ועדין יותר
        const brightenColor = (color: string) => {
          const hex = color.replace('#', '')
          const r = parseInt(hex.substring(0, 2), 16)
          const g = parseInt(hex.substring(2, 4), 16)
          const b = parseInt(hex.substring(4, 6), 16)
          // הבהרה עדינה יותר - רק 40 במקום 80
          const newR = Math.min(255, r + 40)
          const newG = Math.min(255, g + 40)
          const newB = Math.min(255, b + 40)
          return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
        }

        const lineSeries = chartRef.current!.addLineSeries({
          color: isSelected ? brightenColor(line.color) : line.color,
          lineWidth: isSelected ? 3 : 2, // מעט עבה יותר
          priceLineVisible: false,
          lastValueVisible: false,
          lineStyle: 0, // תמיד solid
        })

        if (line.type === 'horizontal-line') {
          const firstCandle = gameState.candles[0]
          const lastCandle = gameState.candles[gameState.currentIndex]

          if (firstCandle && lastCandle) {
            const times = [firstCandle.time, lastCandle.time].sort((a, b) => a - b)
            lineSeries.setData([
              { time: times[0] as Time, value: line.price },
              { time: times[1] as Time, value: line.price },
            ])
          }
        } else if (line.type === 'horizontal-ray' && line.startTime) {
          const lastCandle = gameState.candles[gameState.currentIndex]

          if (lastCandle) {
            const times = [line.startTime, lastCandle.time].sort((a, b) => a - b)
            lineSeries.setData([
              { time: times[0] as Time, value: line.price },
              { time: times[1] as Time, value: line.price },
            ])
          }
        } else if (line.type === 'trend-line' && line.startTime && line.endTime && line.price2 !== undefined) {
          // קו מגמה בין שתי נקודות
          // Skip if start and end are the same (invalid trend line)
          if (line.startTime === line.endTime) {
            console.warn('Skipping trend-line with same start/end time')
            return
          }

          const times = [line.startTime, line.endTime].sort((a, b) => a - b)
          lineSeries.setData([
            { time: times[0] as Time, value: line.startTime === times[0] ? line.price : line.price2 },
            { time: times[1] as Time, value: line.endTime === times[1] ? line.price2 : line.price },
          ])
        }

        drawnLineSeriesRef.current.push(lineSeries)
      }
      // פיבונצ'י - מספר קווים
      else if (line.type === 'fibonacci' && line.startTime && line.endTime && line.price2 !== undefined) {
        // Skip if start and end are the same (invalid fibonacci)
        if (line.startTime === line.endTime) {
          console.warn('Skipping fibonacci with same start/end time')
          return
        }

        const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
        const fibColors = ['#808080', '#FF6B6B', '#4ECDC4', '#FFD93D', '#6BCB77', '#4D96FF', '#9D4EDD']

        const priceDiff = line.price2 - line.price

        fibLevels.forEach((level, idx) => {
          const fibPrice = line.price + (priceDiff * level)
          const isSelectedFib = line.id === selectedLineId

          // פונקציה להבהרת צבע פיבונצ'י
          const brightenFibColor = (color: string) => {
            const hex = color.replace('#', '')
            const r = parseInt(hex.substring(0, 2), 16)
            const g = parseInt(hex.substring(2, 4), 16)
            const b = parseInt(hex.substring(4, 6), 16)
            const newR = Math.min(255, r + 50)
            const newG = Math.min(255, g + 50)
            const newB = Math.min(255, b + 50)
            return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
          }

          const fibSeries = chartRef.current!.addLineSeries({
            color: isSelectedFib ? brightenFibColor(fibColors[idx]) : fibColors[idx],
            lineWidth: isSelectedFib ? 2 : 1,
            priceLineVisible: false,
            lastValueVisible: false,
            lineStyle: 2, // dashed
          })

          const times = [line.startTime!, line.endTime!].sort((a, b) => a - b)
          fibSeries.setData([
            { time: times[0] as Time, value: fibPrice },
            { time: times[1] as Time, value: fibPrice },
          ])

          drawnLineSeriesRef.current.push(fibSeries)
        })
      }
      // כלי Measure - קו מדידה עם מידע
      else if (line.type === 'measure' && line.startTime && line.endTime && line.price2 !== undefined) {
        if (line.startTime === line.endTime) {
          console.warn('Skipping measure with same start/end time')
          return
        }

        const isSelected = line.id === selectedLineId

        // קו מדידה ראשי
        const measureSeries = chartRef.current!.addLineSeries({
          color: isSelected ? '#FFED4E' : '#FFD700',
          lineWidth: isSelected ? 3 : 2,
          priceLineVisible: false,
          lastValueVisible: false,
          lineStyle: 0, // solid
        })

        const times = [line.startTime, line.endTime].sort((a, b) => a - b)
        measureSeries.setData([
          { time: times[0] as Time, value: line.startTime === times[0] ? line.price : line.price2 },
          { time: times[1] as Time, value: line.endTime === times[1] ? line.price2 : line.price },
        ])

        drawnLineSeriesRef.current.push(measureSeries)

        // הוספת marker עם מידע
        if (line.startIndex !== undefined && line.endIndex !== undefined) {
          const priceDiff = line.price2 - line.price
          const pricePercent = ((priceDiff / line.price) * 100).toFixed(2)
          const bars = Math.abs(line.endIndex - line.startIndex)

          // marker באמצע הקו
          const midTime = times[0] + (times[1] - times[0]) / 2

          markers.push({
            time: midTime as Time,
            position: priceDiff >= 0 ? ('aboveBar' as const) : ('belowBar' as const),
            color: '#FFD700',
            shape: 'circle' as const,
            text: `Δ $${Math.abs(priceDiff).toFixed(2)} (${pricePercent}%) | ${bars} bars`,
            size: 1.3,
          })
        }
      }
      // כלי Long Position - סימולציה של עסקת LONG עם SL/TP
      else if (line.type === 'long-position' && line.startTime && line.startIndex !== undefined) {
        const isSelected = line.id === selectedLineId
        const entryPrice = line.price
        const sl = line.stopLoss
        const tp = line.takeProfit

        // חישוב זמן התחלה וסיום לפי startIndex ו-endIndex
        const startCandle = gameState.candles[line.startIndex]
        const endIndex = line.endIndex !== undefined ? line.endIndex : Math.min(line.startIndex + 15, gameState.currentIndex)
        const endCandle = gameState.candles[endIndex]

        if (!startCandle || !endCandle) return

        const times = [startCandle.time, endCandle.time].sort((a, b) => a - b)

        // קו Entry - לבן מקווקו
        const entrySeries = chartRef.current!.addLineSeries({
          color: isSelected ? '#ffffff' : '#d1d5db',
          lineWidth: isSelected ? 3 : 2,
          priceLineVisible: false,
          lastValueVisible: false,
          lineStyle: 1, // dotted
        })
        entrySeries.setData([
          { time: times[0] as Time, value: entryPrice },
          { time: times[1] as Time, value: entryPrice },
        ])
        drawnLineSeriesRef.current.push(entrySeries)

        // קו Stop Loss - אדום
        if (sl) {
          const slSeries = chartRef.current!.addLineSeries({
            color: isSelected ? '#f87171' : '#ef4444',
            lineWidth: isSelected ? 3 : 2,
            priceLineVisible: false,
            lastValueVisible: false,
            lineStyle: 2, // dashed
          })
          slSeries.setData([
            { time: times[0] as Time, value: sl },
            { time: times[1] as Time, value: sl },
          ])
          drawnLineSeriesRef.current.push(slSeries)
        }

        // קו Take Profit - ירוק
        if (tp) {
          const tpSeries = chartRef.current!.addLineSeries({
            color: isSelected ? '#4ade80' : '#22c55e',
            lineWidth: isSelected ? 3 : 2,
            priceLineVisible: false,
            lastValueVisible: false,
            lineStyle: 2, // dashed
          })
          tpSeries.setData([
            { time: times[0] as Time, value: tp },
            { time: times[1] as Time, value: tp },
          ])
          drawnLineSeriesRef.current.push(tpSeries)
        }

        // אזורי רווח/הפסד ויזואליים - מספר קווים דקים צבעוניים (LONG)
        if (sl && tp) {
          const profitSteps = 20 // יותר קווים = אזור יותר מלא
          const lossSteps = 20

          // יצירת קווים ירוקים בין Entry ל-TP
          for (let i = 0; i <= profitSteps; i++) {
            const ratio = i / profitSteps
            const price = entryPrice + (tp - entryPrice) * ratio
            const opacity = 0.15 // שקיפות מוגברת

            const profitLine = chartRef.current!.addLineSeries({
              color: `rgba(34, 197, 94, ${opacity})`,
              lineWidth: 3, // קו יותר עבה
              priceLineVisible: false,
              lastValueVisible: false,
              lineStyle: 0,
            })

            profitLine.setData([
              { time: times[0] as Time, value: price },
              { time: times[1] as Time, value: price },
            ])
            drawnLineSeriesRef.current.push(profitLine)
          }

          // יצירת קווים אדומים בין Entry ל-SL
          for (let i = 0; i <= lossSteps; i++) {
            const ratio = i / lossSteps
            const price = entryPrice - (entryPrice - sl) * ratio
            const opacity = 0.15

            const lossLine = chartRef.current!.addLineSeries({
              color: `rgba(239, 68, 68, ${opacity})`,
              lineWidth: 3,
              priceLineVisible: false,
              lastValueVisible: false,
              lineStyle: 0,
            })

            lossLine.setData([
              { time: times[0] as Time, value: price },
              { time: times[1] as Time, value: price },
            ])
            drawnLineSeriesRef.current.push(lossLine)
          }
        }

        // חישוב R:R ו-P&L
        if (sl && tp) {
          const risk = Math.abs(entryPrice - sl)
          const reward = Math.abs(tp - entryPrice)
          const rrRatio = reward / risk

          // Info marker בתחילה
          markers.push({
            time: line.startTime as Time,
            position: 'aboveBar' as const,
            color: '#22c55e',
            shape: 'circle' as const,
            text: `LONG | R:R 1:${rrRatio.toFixed(2)} | TP: +${((reward / entryPrice) * 100).toFixed(1)}% | SL: -${((risk / entryPrice) * 100).toFixed(1)}%`,
            size: 1.4,
          })
        }

        // Resize marker בסוף - ידית לגרירה (תמיד מוצג)
        const endTime = endCandle.time
        markers.push({
          time: endTime as Time,
          position: 'inBar' as const, // ממוקם על הנר במקום מעל
          color: isSelected ? '#FFD700' : '#FF9800', // כתום בהיר או זהב אם נבחר
          shape: 'square' as const,
          text: '⇔', // סמל resize
          size: 2, // גדול יותר לזיהוי קל
        })
      }
      // כלי Short Position - סימולציה של עסקת SHORT עם SL/TP
      else if (line.type === 'short-position' && line.startTime && line.startIndex !== undefined) {
        const isSelected = line.id === selectedLineId
        const entryPrice = line.price
        const sl = line.stopLoss
        const tp = line.takeProfit

        // חישוב זמן התחלה וסיום לפי startIndex ו-endIndex
        const startCandle = gameState.candles[line.startIndex]
        const endIndex = line.endIndex !== undefined ? line.endIndex : Math.min(line.startIndex + 15, gameState.currentIndex)
        const endCandle = gameState.candles[endIndex]

        if (!startCandle || !endCandle) return

        const times = [startCandle.time, endCandle.time].sort((a, b) => a - b)

        // קו Entry - לבן מקווקו
        const entrySeries = chartRef.current!.addLineSeries({
          color: isSelected ? '#ffffff' : '#d1d5db',
          lineWidth: isSelected ? 3 : 2,
          priceLineVisible: false,
          lastValueVisible: false,
          lineStyle: 1, // dotted
        })
        entrySeries.setData([
          { time: times[0] as Time, value: entryPrice },
          { time: times[1] as Time, value: entryPrice },
        ])
        drawnLineSeriesRef.current.push(entrySeries)

        // קו Stop Loss - אדום (מעל entry ב-SHORT)
        if (sl) {
          const slSeries = chartRef.current!.addLineSeries({
            color: isSelected ? '#f87171' : '#ef4444',
            lineWidth: isSelected ? 3 : 2,
            priceLineVisible: false,
            lastValueVisible: false,
            lineStyle: 2, // dashed
          })
          slSeries.setData([
            { time: times[0] as Time, value: sl },
            { time: times[1] as Time, value: sl },
          ])
          drawnLineSeriesRef.current.push(slSeries)
        }

        // קו Take Profit - ירוק (מתחת entry ב-SHORT)
        if (tp) {
          const tpSeries = chartRef.current!.addLineSeries({
            color: isSelected ? '#4ade80' : '#22c55e',
            lineWidth: isSelected ? 3 : 2,
            priceLineVisible: false,
            lastValueVisible: false,
            lineStyle: 2, // dashed
          })
          tpSeries.setData([
            { time: times[0] as Time, value: tp },
            { time: times[1] as Time, value: tp },
          ])
          drawnLineSeriesRef.current.push(tpSeries)
        }

        // אזורי רווח/הפסד ויזואליים - מספר קווים דקים צבעוניים (SHORT)
        if (sl && tp) {
          const profitSteps = 20
          const lossSteps = 20

          // יצירת קווים כחולים בין Entry ל-TP (מטה ב-SHORT)
          for (let i = 0; i <= profitSteps; i++) {
            const ratio = i / profitSteps
            const price = entryPrice - (entryPrice - tp) * ratio
            const opacity = 0.15

            const profitLine = chartRef.current!.addLineSeries({
              color: `rgba(59, 130, 246, ${opacity})`, // כחול ל-SHORT
              lineWidth: 3,
              priceLineVisible: false,
              lastValueVisible: false,
              lineStyle: 0,
            })

            profitLine.setData([
              { time: times[0] as Time, value: price },
              { time: times[1] as Time, value: price },
            ])
            drawnLineSeriesRef.current.push(profitLine)
          }

          // יצירת קווים אדומים בין Entry ל-SL (מעלה ב-SHORT)
          for (let i = 0; i <= lossSteps; i++) {
            const ratio = i / lossSteps
            const price = entryPrice + (sl - entryPrice) * ratio
            const opacity = 0.15

            const lossLine = chartRef.current!.addLineSeries({
              color: `rgba(239, 68, 68, ${opacity})`,
              lineWidth: 3,
              priceLineVisible: false,
              lastValueVisible: false,
              lineStyle: 0,
            })

            lossLine.setData([
              { time: times[0] as Time, value: price },
              { time: times[1] as Time, value: price },
            ])
            drawnLineSeriesRef.current.push(lossLine)
          }
        }

        // חישוב R:R ו-P&L
        if (sl && tp) {
          const risk = Math.abs(sl - entryPrice) // SL מעל entry ב-SHORT
          const reward = Math.abs(entryPrice - tp) // TP מתחת entry ב-SHORT
          const rrRatio = reward / risk

          // Info marker בתחילה
          markers.push({
            time: line.startTime as Time,
            position: 'belowBar' as const,
            color: '#ef4444',
            shape: 'circle' as const,
            text: `SHORT | R:R 1:${rrRatio.toFixed(2)} | TP: +${((reward / entryPrice) * 100).toFixed(1)}% | SL: -${((risk / entryPrice) * 100).toFixed(1)}%`,
            size: 1.4,
          })
        }

        // Resize marker בסוף - ידית לגרירה (תמיד מוצג)
        const endTime = endCandle.time
        markers.push({
          time: endTime as Time,
          position: 'inBar' as const, // ממוקם על הנר במקום מתחת
          color: isSelected ? '#FFD700' : '#FF9800', // כתום בהיר או זהב אם נבחר
          shape: 'square' as const,
          text: '⇔', // סמל resize
          size: 2, // גדול יותר לזיהוי קל
        })
      }
      // חצים והערות - markers
      else if (line.type === 'arrow-up' || line.type === 'arrow-down' || line.type === 'note') {
        if (line.startTime !== undefined) {
          // וידוא שהזמן תואם לנר קיים
          const candle = gameState.candles.find(c => c.time === line.startTime)
          if (!candle) {
            console.warn('Marker time does not match any candle:', line.startTime)
            // נסה למצוא את הנר הקרוב ביותר
            const closestCandle = gameState.candles.reduce((prev, curr) => {
              return Math.abs(curr.time - line.startTime!) < Math.abs(prev.time - line.startTime!) ? curr : prev
            })
            line.startTime = closestCandle.time
            console.log('Using closest candle time:', closestCandle.time)
          }

          const isSelectedMarker = line.id === selectedLineId

          // פונקציה להבהרת צבע marker
          const brightenMarkerColor = (color: string) => {
            const hex = color.replace('#', '')
            const r = parseInt(hex.substring(0, 2), 16)
            const g = parseInt(hex.substring(2, 4), 16)
            const b = parseInt(hex.substring(4, 6), 16)
            const newR = Math.min(255, r + 60)
            const newG = Math.min(255, g + 60)
            const newB = Math.min(255, b + 60)
            return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
          }

          const marker = {
            time: line.startTime as Time,
            position: line.type === 'arrow-down' ? ('aboveBar' as const) : ('belowBar' as const),
            color: isSelectedMarker ? brightenMarkerColor(line.color) : line.color,
            shape: line.type === 'arrow-up' ? ('arrowUp' as const) : line.type === 'arrow-down' ? ('arrowDown' as const) : ('circle' as const),
            text: line.type === 'note' ? line.text || '' : '',
            size: isSelectedMarker ? 1.5 : 1, // מעט גדול יותר אם נבחר
          }
          console.log('renderDrawnLines: Adding marker', line.type, 'at time', line.startTime, marker)
          markers.push(marker)
        } else {
          console.warn('Skipping marker - no startTime:', line)
        }
      }
    })

    console.log('renderDrawnLines: Created', markers.length, 'markers for arrows/notes')
    // שמירת markers כלי הציור ב-ref לשימוש ב-createPatternMarkers
    drawnMarkersRef.current = markers
  }

  // useEffect לציור קווים כאשר הם משתנים
  useEffect(() => {
    if (gameState?.candles && gameState.currentIndex >= 0) {
      renderDrawnLines()
    }
  }, [drawnLines, selectedLineId, gameState?.currentIndex, gameState?.candles.length, gameState?.id])

  // useEffect נפרד לעדכון markers (רץ אחרי renderDrawnLines)
  useEffect(() => {
    if (gameState?.candles && gameState.currentIndex >= 0) {
      // קריאה מעוכבת כדי לוודא ש-drawnMarkersRef התעדכן
      setTimeout(() => {
        createPatternMarkers()
      }, 0)
    }
  }, [drawnLines, selectedLineId, gameState?.currentIndex, gameState?.candles.length, gameState?.id, gameState?.closedPositions?.length])

  // פונקציות לניהול קווים
  const handleDeleteLine = (id: string) => {
    setDrawnLines((prev) => prev.filter((line) => line.id !== id))
  }

  const handleClearAllLines = () => {
    setDrawnLines([])
    localStorage.removeItem('trading-game-drawings')
  }

  // פונקציה ליצירת סימון עסקאות סגורות
  const createClosedTradeMarkers = (): any[] => {
    if (!gameState?.closedPositions || !gameState?.candles) return []

    const tradeMarkers: any[] = []

    gameState.closedPositions.forEach((position) => {
      // markers לכניסה
      if (position.entryIndex <= gameState.currentIndex) {
        const isLong = position.type === 'long'

        tradeMarkers.push({
          time: position.entryTime as Time,
          position: isLong ? ('belowBar' as const) : ('aboveBar' as const),
          color: isLong ? '#22c55e' : '#ef4444', // ירוק ל-LONG, אדום ל-SHORT
          shape: isLong ? ('arrowUp' as const) : ('arrowDown' as const),
          text: `${isLong ? '🟢' : '🔴'} Entry`,
          size: 1.2,
        })
      }

      // markers ליציאה (אם היציאה כבר התרחשה)
      if (position.exitIndex !== undefined && position.exitIndex <= gameState.currentIndex) {
        const isProfitable = (position.exitPnL || 0) > 0
        const pnlText = position.exitPnL
          ? `${isProfitable ? '+' : ''}$${position.exitPnL.toFixed(2)} (${position.exitPnLPercent?.toFixed(1)}%)`
          : 'Closed'

        tradeMarkers.push({
          time: position.exitTime as Time,
          position: isProfitable ? ('aboveBar' as const) : ('belowBar' as const),
          color: isProfitable ? '#22c55e' : '#ef4444',
          shape: 'circle' as const,
          text: pnlText,
          size: 1.3,
        })
      }
    })

    return tradeMarkers
  }

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

    // יצירת markers לעסקאות סגורות
    const tradeMarkers = createClosedTradeMarkers()

    // מיזוג markers תבניות, עסקאות סגורות, ו-markers כלי ציור
    const allMarkers = [...markers, ...tradeMarkers, ...drawnMarkersRef.current]

    // ⚠️ CRITICAL: חייבים למיין לפי זמן! lightweight-charts דורש סדר עולה
    allMarkers.sort((a, b) => {
      const timeA = typeof a.time === 'number' ? a.time : 0
      const timeB = typeof b.time === 'number' ? b.time : 0
      return timeA - timeB
    })

    console.log('createPatternMarkers: Merging', markers.length, 'pattern markers +', tradeMarkers.length, 'trade markers +', drawnMarkersRef.current.length, 'drawn markers =', allMarkers.length, 'total (sorted by time)')

    // הגדרת כל ה-markers בבת אחת
    if (allMarkers.length > 0 && candlestickSeriesRef.current) {
      console.log('createPatternMarkers: Setting', allMarkers.length, 'markers on candlestick series')
      candlestickSeriesRef.current.setMarkers(allMarkers)
    } else if (allMarkers.length === 0 && candlestickSeriesRef.current) {
      // Clear markers if none
      candlestickSeriesRef.current.setMarkers([])
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

      // ✅ קו אופקי מהנר שבו נוצרה הפקודה עד הנר הנוכחי
      const startIndex = order.createdAtIndex
      const endIndex = gameState.currentIndex

      // וידוא שהאינדקסים תקינים
      if (startIndex >= 0 && startIndex < gameState.candles.length &&
          endIndex >= startIndex && endIndex < gameState.candles.length) {
        const startCandle = gameState.candles[startIndex]
        const endCandle = gameState.candles[endIndex]

        const lineData = [
          { time: startCandle.time as Time, value: order.targetPrice },
          { time: endCandle.time as Time, value: order.targetPrice },
        ]

        priceLine.setData(lineData)
        pendingOrderLineSeriesRef.current.push(priceLine)
      }
    })
  }

  // פונקציה להצגת קו תצוגה מקדימה לפקודה עתידית
  const showPreviewLine = (targetPrice: number, orderType: 'long' | 'short', stopLoss?: number, takeProfit?: number) => {
    if (!chartRef.current || !gameState?.candles) return

    // הסרת קווים קודמים
    hidePreviewLine()

    const color = orderType === 'long' ? '#22c55e' : '#ef4444'

    // קו אופקי מהנר הראשון עד הנר האחרון שנראה בגרף
    const firstCandle = gameState.candles[0]
    const lastVisibleCandle = gameState.candles[gameState.currentIndex]
    if (!firstCandle || !lastVisibleCandle) return

    // קו המחיר היעד - קו אופקי על פני כל הגרף הנראה
    const priceLine = chartRef.current.addLineSeries({
      color,
      lineWidth: 3,
      lineStyle: 2, // dashed
      priceLineVisible: false,
      lastValueVisible: false,
    })
    priceLine.setData([
      { time: firstCandle.time as Time, value: targetPrice },
      { time: lastVisibleCandle.time as Time, value: targetPrice },
    ])
    previewLineSeriesRef.current.push(priceLine)

    // קווי SL/TP אם קיימים - גם הם קווים אופקיים מלאים
    if (stopLoss) {
      const slLine = chartRef.current.addLineSeries({
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: 2, // dashed
        priceLineVisible: false,
        lastValueVisible: false,
      })
      slLine.setData([
        { time: firstCandle.time as Time, value: stopLoss },
        { time: lastVisibleCandle.time as Time, value: stopLoss },
      ])
      previewLineSeriesRef.current.push(slLine)
    }

    if (takeProfit) {
      const tpLine = chartRef.current.addLineSeries({
        color: '#22c55e',
        lineWidth: 2,
        lineStyle: 2, // dashed
        priceLineVisible: false,
        lastValueVisible: false,
      })
      tpLine.setData([
        { time: firstCandle.time as Time, value: takeProfit },
        { time: lastVisibleCandle.time as Time, value: takeProfit },
      ])
      previewLineSeriesRef.current.push(tpLine)
    }
  }

  // פונקציה להסרת קו התצוגה המקדימה
  const hidePreviewLine = () => {
    if (chartRef.current) {
      previewLineSeriesRef.current.forEach((series) => {
        try {
          chartRef.current?.removeSeries(series)
        } catch (e) {
          // Series might already be removed
        }
      })
      previewLineSeriesRef.current = []
    }
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
          if (chartRef.current) {
            chartRef.current.timeScale().fitContent()

            // ✅ וידוא שה-volume priceScale גם מתאים את עצמו
            if (volumeSeriesRef.current) {
              volumeSeriesRef.current.priceScale().applyOptions({
                autoScale: true,
              })
            }
            if (volumeMASeriesRef.current) {
              volumeMASeriesRef.current.priceScale().applyOptions({
                autoScale: true,
              })
            }
          }
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
      <div
        ref={chartContainerRef}
        className="w-full h-full"
        style={{ cursor: activeTool !== 'none' ? 'crosshair' : 'default' }}
      />

      {/* Chart Tools Panel (unified) */}
      <ChartToolsPanel
        onMASettingsChange={setMASettings}
        activeTool={activeTool}
        onToolChange={setActiveTool}
        drawnLines={drawnLines}
        onDeleteLine={handleDeleteLine}
        onClearAll={handleClearAllLines}
        onSelectLine={setSelectedLineId}
      />

      {/* Pending Order Menu */}
      {pendingOrderMenu && (
        <PendingOrderMenu
          price={pendingOrderMenu.price}
          x={pendingOrderMenu.x}
          y={pendingOrderMenu.y}
          onClose={() => {
            hidePreviewLine()
            setPendingOrderMenu(null)
          }}
          onPreviewUpdate={showPreviewLine}
        />
      )}

      {/* Edit Position Tool Modal */}
      {editingLineId && (() => {
        const line = drawnLines.find(l => l.id === editingLineId)
        if (!line || (line.type !== 'long-position' && line.type !== 'short-position')) return null

        const handleSave = (newSL: number, newTP: number) => {
          setDrawnLines(prev => prev.map(l =>
            l.id === editingLineId
              ? { ...l, stopLoss: newSL, takeProfit: newTP }
              : l
          ))
          setEditingLineId(null)
        }

        return (
          <>
            {/* Background overlay */}
            <div
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setEditingLineId(null)}
            />

            {/* Modal */}
            <div
              className="fixed z-50 bg-dark-panel border border-dark-border rounded-lg shadow-2xl p-4 min-w-[300px]"
              style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-dark-border">
                <div className="text-sm font-bold text-text-primary">
                  {line.type === 'long-position' ? 'Edit LONG Position' : 'Edit SHORT Position'}
                </div>
                <button
                  onClick={() => setEditingLineId(null)}
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  ×
                </button>
              </div>

              {/* Entry Price (read-only) */}
              <div className="mb-3">
                <label className="block text-xs text-text-secondary mb-1">Entry Price</label>
                <input
                  type="number"
                  value={line.price.toFixed(2)}
                  disabled
                  className="w-full px-3 py-2 bg-dark-bg/50 border border-dark-border rounded text-sm text-text-secondary"
                />
              </div>

              {/* Stop Loss */}
              <div className="mb-3">
                <label className="block text-xs text-text-secondary mb-1">Stop Loss</label>
                <input
                  type="number"
                  defaultValue={line.stopLoss?.toFixed(2) || ''}
                  step="0.01"
                  id="edit-sl-input"
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-sm focus:outline-none focus:border-red-500"
                />
              </div>

              {/* Take Profit */}
              <div className="mb-4">
                <label className="block text-xs text-text-secondary mb-1">Take Profit</label>
                <input
                  type="number"
                  defaultValue={line.takeProfit?.toFixed(2) || ''}
                  step="0.01"
                  id="edit-tp-input"
                  className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-sm focus:outline-none focus:border-green-500"
                />
              </div>

              {/* R:R Display */}
              {line.stopLoss && line.takeProfit && (() => {
                const risk = Math.abs(line.price - line.stopLoss)
                const reward = Math.abs(line.takeProfit - line.price)
                const rrRatio = reward / risk
                return (
                  <div className="mb-4 p-2 bg-blue-900/20 border border-blue-500/30 rounded text-center">
                    <div className="text-xs text-text-secondary">Current R:R Ratio</div>
                    <div className="text-lg font-bold text-blue-400">1:{rrRatio.toFixed(2)}</div>
                  </div>
                )
              })()}

              {/* Save Button */}
              <button
                onClick={() => {
                  const slInput = document.getElementById('edit-sl-input') as HTMLInputElement
                  const tpInput = document.getElementById('edit-tp-input') as HTMLInputElement
                  const newSL = parseFloat(slInput.value)
                  const newTP = parseFloat(tpInput.value)

                  if (!isNaN(newSL) && !isNaN(newTP)) {
                    handleSave(newSL, newTP)
                  }
                }}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-semibold text-sm transition-colors"
              >
                Save Changes
              </button>
            </div>
          </>
        )
      })()}

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

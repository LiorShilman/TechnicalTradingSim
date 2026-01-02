import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createChart, type IChartApi, type ISeriesApi, type Time, type BarPrice } from 'lightweight-charts'
import type { ISeriesApi as LineSeriesApi } from 'lightweight-charts'
import { useGameStore } from '@/stores/gameStore'
import PendingOrderMenu from './PendingOrderMenu'
import ChartToolsPanel from './ChartToolsPanel'
import { type MASettings } from './IndicatorControls'
import { type DrawingTool, type DrawnLine } from './DrawingControls'
import toast from 'react-hot-toast'
import { telegramService } from '@/services/telegramNotifications'


// --- Risk/Reward Zone overlay (DOM-based rectangles) ---
// Lightweight-Charts v4 doesn't provide solid draggable rectangles out of the box.
// We render two filled rectangles (profit/loss) as absolutely positioned DIV overlays.
// Dragging is done via small TP/SL handles and reuses the existing stopLoss/takeProfit drag logic.

type ZoneOverlay = {
  lineId: string
  positionType: 'long-position' | 'short-position'
  profit: { left: number; top: number; width: number; height: number; fill: string }
  loss: { left: number; top: number; width: number; height: number; fill: string }
  // handle positions (near right edge)
  tpHandle?: { x: number; y: number }
  slHandle?: { x: number; y: number }
  startHandle?: { x: number; y: number }
  endHandle?: { x: number; y: number }
}
export default function TradingChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const volumeMASeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const patternLineSeriesRef = useRef<LineSeriesApi<'Line'>[]>([])
  const pendingOrderLineSeriesRef = useRef<LineSeriesApi<'Line'>[]>([])
  const closedPositionLineSeriesRef = useRef<LineSeriesApi<'Line'>[]>([]) // קווי חיבור לפוזיציות סגורות
  const lastCandleIndexRef = useRef<number>(-1)
  const initialIndexRef = useRef<number>(-1) // האינדקס ההתחלתי של המשחק
  const lastGameIdRef = useRef<string | null>(null) // מעקב אחרי gameId כדי לזהות משחק חדש/טעון

  // Moving Average series refs - dynamic array
  const maSeriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map())

  const { gameState, setChartControls } = useGameStore()

  // State for pending order menu
  const [pendingOrderMenu, setPendingOrderMenu] = useState<{
    price: number
    x: number
    y: number
  } | null>(null)

  // State for MA settings
  const [maSettings, setMASettings] = useState<MASettings>({
    movingAverages: [
      { id: 'ma-1', enabled: false, type: 'SMA', period: 20, color: '#3b82f6' },
      { id: 'ma-2', enabled: false, type: 'SMA', period: 50, color: '#f97316' },
      { id: 'ma-3', enabled: false, type: 'SMA', period: 200, color: '#ef4444' },
    ],
    startFromCurrentIndex: true,
  })

  // State for drawing tools
  const [activeTool, setActiveTool] = useState<DrawingTool>('none')
  const activeToolRef = useRef<DrawingTool>('none') // ref for event listeners
  const [drawnLines, setDrawnLines] = useState<DrawnLine[]>([])
  const drawnLinesRef = useRef<DrawnLine[]>([]) // ✅ ref for event listeners to access current drawnLines
  const drawnLineSeriesRef = useRef<any[]>([]) // Can hold Line, Histogram, or any other series type
  const drawnMarkersRef = useRef<any[]>([]) // markers from drawing tools (arrows, notes)
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)
  const selectedLineIdRef = useRef<string | null>(null)
  useEffect(() => {
    selectedLineIdRef.current = selectedLineId
  }, [selectedLineId])

  const [zoneOverlays, setZoneOverlays] = useState<ZoneOverlay[]>([])
  const zoneDragRef = useRef<
    | { lineId: string; kind: 'sl' | 'tp' }
    | null
  >(null)

  const [editingLineId, setEditingLineId] = useState<string | null>(null) // For edit modal

  // For multi-point tools (trend line, fibonacci, ray)
  const [drawingInProgress, setDrawingInProgress] = useState<{
    type: DrawingTool
    price: number
    time: number
    candleIndex?: number
  } | null>(null)
  const drawingInProgressRef = useRef<{
    type: DrawingTool
    price: number
    time: number
    candleIndex?: number
  } | null>(null)

  // State for dragging SL/TP lines or resizing position width
  const [draggingLine, setDraggingLine] = useState<{
    lineId: string
    lineType: 'stopLoss' | 'takeProfit' | 'entry' | 'resizeStart' | 'resizeEnd'
    originalPrice?: number // המחיר המקורי של הקו שנלחץ - לזיהוי ייחודי
  } | null>(null)
  const draggingLineRef = useRef<{ lineId: string; lineType: 'stopLoss' | 'takeProfit' | 'entry' | 'resizeStart' | 'resizeEnd'; originalPrice?: number } | null>(null)

  // Preview lines for pending order (shown while menu is open)
  const previewLineSeriesRef = useRef<ISeriesApi<'Line'>[]>([])

  // Hover state for closed positions - tracks which position index is being hovered
  const [hoveredPositionId, setHoveredPositionId] = useState<number | null>(null)
  const hoveredPositionIdRef = useRef<number | null>(null)

  // Sync activeTool state with ref
  useEffect(() => {
    activeToolRef.current = activeTool
  }, [activeTool])

  // Sync hoveredPositionId state with ref
  useEffect(() => {
    hoveredPositionIdRef.current = hoveredPositionId
  }, [hoveredPositionId])

  // Sync draggingLine state with ref
  useEffect(() => {
    draggingLineRef.current = draggingLine
  }, [draggingLine])

  // Sync drawingInProgress state with ref
  useEffect(() => {
    drawingInProgressRef.current = drawingInProgress
  }, [drawingInProgress])

  // Sync drawnLines state with ref (for event listeners)
  useEffect(() => {
    drawnLinesRef.current = drawnLines
  }, [drawnLines])

  
  // --- Zone overlays recalculation ---
  const recalcZoneOverlays = () => {
    const chart = chartRef.current
    const series = candlestickSeriesRef.current
    const container = chartContainerRef.current
    const candles = gameState?.candles

    if (!chart || !series || !container || !candles || candles.length === 0) {
      setZoneOverlays([])
      return
    }

    const timeScale = chart.timeScale()
    const overlays: ZoneOverlay[] = []

    const currentIndex = Math.min(gameState?.currentIndex ?? candles.length - 1, candles.length - 1)

    for (const line of drawnLinesRef.current) {
      if (line.type !== 'long-position' && line.type !== 'short-position') continue

      const entry = Number((line as any).price)
      const sl = (line as any).stopLoss as number | undefined
      const tp = (line as any).takeProfit as number | undefined
      if (!Number.isFinite(entry) || !Number.isFinite(sl) || !Number.isFinite(tp)) continue

      const startIdx = Math.max(0, Math.min((line as any).startIndex ?? currentIndex, candles.length - 1))
      const endIdx = Math.max(0, Math.min((line as any).endIndex ?? currentIndex, candles.length - 1))
      const a = candles[Math.min(startIdx, endIdx)]
      const b = candles[Math.max(startIdx, endIdx)]
      if (!a || !b) continue

      const x1 = timeScale.timeToCoordinate(a.time as any)
      const x2 = timeScale.timeToCoordinate(b.time as any)
      if (x1 == null || x2 == null) continue

      const left = Math.min(x1, x2)
      const right = Math.max(x1, x2)
      const width = right - left
      if (width <= 1) continue

      const yEntry = series.priceToCoordinate(entry as any)
      const ySL = series.priceToCoordinate(sl as any)
      const yTP = series.priceToCoordinate(tp as any)
      if (yEntry == null || ySL == null || yTP == null) continue

      const profitTop = Math.min(yEntry, yTP)
      const profitBottom = Math.max(yEntry, yTP)
      const lossTop = Math.min(yEntry, ySL)
      const lossBottom = Math.max(yEntry, ySL)

      const isSelected = selectedLineIdRef.current === (line as any).id

      const profitFill = isSelected ? 'rgba(74, 222, 128, 0.30)' : 'rgba(34, 197, 94, 0.28)'
      const lossFill = isSelected ? 'rgba(248, 113, 113, 0.30)' : 'rgba(239, 68, 68, 0.28)'

      // enforce correct meaning (profit zone is always green, loss zone always red)
      const profit = {
        left,
        top: profitTop,
        width,
        height: Math.max(0, profitBottom - profitTop),
        fill: profitFill,
      }
      const loss = {
        left,
        top: lossTop,
        width,
        height: Math.max(0, lossBottom - lossTop),
        fill: lossFill,
      }

      // handles on the right edge, centered on SL/TP line
      const handleX = left + width - 6
      overlays.push({
        lineId: (line as any).id,
        positionType: line.type,
        profit,
        loss,
        tpHandle: { x: handleX, y: yTP },
        slHandle: { x: handleX, y: ySL },
        // width resize handles (drag left/right to change candle span)
        startHandle: { x: Math.max(0, left - 6), y: yEntry },
        endHandle: { x: Math.max(0, left + width - 6), y: yEntry },
      })
    }

    setZoneOverlays(overlays)
  }


  const beginZoneHandleDrag = (e: ReactMouseEvent, lineId: string, kind: 'sl' | 'tp') => {
    e.preventDefault()
    e.stopPropagation()

    setSelectedLineId(lineId)

    const line = drawnLinesRef.current.find((l: any) => l.id === lineId) as any
    if (!line) return

    const originalPrice = kind === 'tp' ? Number(line.takeProfit) : Number(line.stopLoss)
    if (!Number.isFinite(originalPrice)) return

    setDraggingLine({
      lineId,
      lineType: kind === 'tp' ? 'takeProfit' : 'stopLoss',
      originalPrice,
    })
  }

  const onZoneBodyMouseDown = (e: ReactMouseEvent, lineId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedLineId(lineId)
  }

  useEffect(() => {
    // recalc after each render-affecting change
    const id = requestAnimationFrame(recalcZoneOverlays)
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.currentIndex, gameState?.candles.length, drawnLines, selectedLineId])

  // keep overlays aligned when zoom/scroll changes
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    const ts = chart.timeScale()
    const onChange = () => {
      requestAnimationFrame(recalcZoneOverlays)
    }
    ts.subscribeVisibleTimeRangeChange(onChange)
    ts.subscribeVisibleLogicalRangeChange(onChange)
    window.addEventListener('resize', onChange)

    return () => {
      ts.unsubscribeVisibleTimeRangeChange(onChange)
      ts.unsubscribeVisibleLogicalRangeChange(onChange)
      window.removeEventListener('resize', onChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
// Load drawn lines from localStorage (per game file)
  useEffect(() => {
    if (!gameState?.sourceFileName) return

    const storageKey = `trading-game-drawings-${gameState.sourceFileName}`
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setDrawnLines(parsed)
        console.log(`📐 Loaded ${parsed.length} drawings for file "${gameState.sourceFileName}"`)
      } catch (e) {
        console.error('Failed to parse drawings from localStorage', e)
      }
    } else {
      // קובץ חדש - נקה קווים
      setDrawnLines([])
      console.log(`🆕 New file "${gameState.sourceFileName}" - no drawings`)
    }
  }, [gameState?.sourceFileName])

  // Save drawn lines to localStorage (per game file)
  useEffect(() => {
    if (!gameState?.sourceFileName) return

    // Always save, even if empty (to clear old drawings)
    const storageKey = `trading-game-drawings-${gameState.sourceFileName}`
    localStorage.setItem(storageKey, JSON.stringify(drawnLines))
    console.log(`💾 Saved ${drawnLines.length} drawings for file "${gameState.sourceFileName}"`)
  }, [drawnLines, gameState?.sourceFileName])

  useEffect(() => {
    console.log('TradingChart: Mounting chart component')
    if (!chartContainerRef.current) return

    // יצירת גרף
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0a0e27' },
        textColor: '#e8eaed',
        fontSize: 13, // הגדלת גודל טקסט בציר הזמן והמחיר
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
        borderVisible: true, // הצגת גבול ציר הזמן
        borderColor: '#2962FF', // צבע כחול לגבול ציר הזמן
      },
      rightPriceScale: {
        borderVisible: true, // הצגת גבול ציר המחיר
        borderColor: '#2962FF', // צבע כחול תואם לציר הזמן
        autoScale: true, // זום אוטומטי
        scaleMargins: {
          top: 0.1,
          bottom: 0.3,
        },
      },
      watermark: {
        visible: false, // הסתרת הלוגו של TradingView
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

    // חישוב precision דינמי על פי סוג הנכס
    // קריפטו ופורקס: 4 ספרות, מניות: 2 ספרות
    const asset = gameState?.asset || 'BTC/USD'
    const isCryptoOrForex = asset.includes('/') // כל זוג מטבעות (BTC/USD, EUR/GBP וכו')
    const pricePrecision = isCryptoOrForex ? 4 : 2

    // יצירת סדרת נרות עם precision מותאם
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#00c853',
      downColor: '#ff1744',
      borderUpColor: '#00c853',
      borderDownColor: '#ff1744',
      wickUpColor: '#00c853',
      wickDownColor: '#ff1744',
      priceFormat: {
        type: 'price',
        precision: pricePrecision,
        minMove: 1 / Math.pow(10, pricePrecision), // 0.0001 לפורקס/קריפטו, 0.01 למניות
      },
    })

    // יצירת סדרת Volume (Histogram) - קודם! כדי שה-MA יופיע מעליו
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

    // יצירת קו MA 20 לVolume - אחרי ההיסטוגרמה כדי שיופיע מעליה
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

    // הגדרת ציר מחירים ראשי (לנרות) - תופס 70% עליונים
    candlestickSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.02, // רווח קטן מלמעלה
        bottom: 0.30, // משאיר מקום לווליום למטה
      },
    })

    // Note: MA series will be created dynamically in updateMASeriesVisibility

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

    // Subscribe to crosshair movement for hover detection
    const handleCrosshairMove = (param: any) => {
      if (!gameState?.closedPositions || param.point === undefined || param.time === undefined) {
        // No crosshair data - clear hover if exists
        if (hoveredPositionIdRef.current !== null) {
          console.log('🚫 Crosshair cleared - clearing hover')
          setHoveredPositionId(null)
        }
        return
      }

      const time = param.time as number
      const price = param.seriesData.get(candlestickSeries)?.close

      if (!price) {
        // No price data - clear hover if exists
        if (hoveredPositionIdRef.current !== null) {
          console.log('🚫 No price data - clearing hover')
          setHoveredPositionId(null)
        }
        return
      }

      // Check if hovering over any closed position entry marker
      const candleDuration = gameState.candles.length > 1
        ? Math.abs(gameState.candles[1].time - gameState.candles[0].time)
        : 86400
      const timeTolerance = candleDuration * 1
      const priceTolerance = price * 0.005

      let newHoveredIndex: number | null = null

      gameState.closedPositions.forEach((position, index) => {
        if (position.entryIndex > gameState.currentIndex) return

        const timeMatch = Math.abs(time - position.entryTime) < timeTolerance
        const priceMatch = Math.abs(price - position.entryPrice) < priceTolerance

        if (timeMatch && priceMatch) {
          newHoveredIndex = index
        }
      })

      // Update hover state if changed - use ref to get current value
      if (newHoveredIndex !== hoveredPositionIdRef.current) {
        console.log(`🔄 Crosshair hover: ${hoveredPositionIdRef.current} → ${newHoveredIndex}`)
        setHoveredPositionId(newHoveredIndex)
      }
    }

    chart.subscribeCrosshairMove(handleCrosshairMove)

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
          // חצים, קרן אופקית, וכלי פוזיציה צריכים startTime
          startTime: (currentTool === 'horizontal-ray' || currentTool === 'arrow-up' || currentTool === 'arrow-down' || currentTool === 'long-position' || currentTool === 'short-position') ? (time as number) : undefined,
          startIndex: (currentTool === 'long-position' || currentTool === 'short-position') && candleIndex !== -1 ? candleIndex : undefined,
          endIndex: defaultEndIndex, // ✅ רוחב התחלתי
          color: toolColors[currentTool] || '#FFD700',
          width: 2,
          // SL/TP עבור position tools
          ...(defaultSL && { stopLoss: defaultSL }),
          ...(defaultTP && { takeProfit: defaultTP }),
        }

        setDrawnLines((prev) => {
          const updated = [...prev, newLine]
          console.log(`➕ Added ${newLine.type} tool (id: ${newLine.id}), total: ${updated.length}`)
          return updated
        })
        setActiveTool('none')
        activeToolRef.current = 'none' // ✅ עדכון ישיר של ref כדי למנוע race condition
        e.preventDefault() // מניעת mousedown מיד אחרי ה-click
      }
      // כלים שצריכים שתי נקודות (ray, trend line, fibonacci, measure, rectangle)
      else if (currentTool === 'ray' || currentTool === 'trend-line' || currentTool === 'fibonacci' || currentTool === 'measure' || currentTool === 'rectangle') {
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
              'ray': '#06B6D4',
              'trend-line': '#9C27B0',
              'fibonacci': '#FF9800',
              'measure': '#FFD700',
              'rectangle': '#8B5CF6',
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
              // ברירת מחדל לשקיפות של מלבנים
              ...(currentTool === 'rectangle' && { opacity: 0.3 }),
            }

            setDrawnLines((lines) => {
              const updated = [...lines, newLine]
              console.log(`➕ Added ${newLine.type} tool (id: ${newLine.id}), total: ${updated.length}`)
              return updated
            })
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

          setDrawnLines((prev) => {
            const updated = [...prev, newLine]
            console.log(`➕ Added ${newLine.type} tool (id: ${newLine.id}), total: ${updated.length}`)
            return updated
          })
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
      // ✅ רק אם הפוזיציה נבחרה מראש ברשימה
      for (const line of drawnLinesRef.current) {
        if (line.type !== 'long-position' && line.type !== 'short-position') continue

        // ✅ גרירה מותרת רק לפוזיציה שנבחרה
        if (line.id !== selectedLineId) continue


// ✅ Click בתוך האזור הירוק/אדום (המלבן) מפעיל גרירה של TP/SL
if (line.startIndex !== undefined && line.endIndex !== undefined && gameState) {
  const isBetween = (v: number, a: number, b: number) => v >= Math.min(a, b) && v <= Math.max(a, b)

  // מציאת candle index קרוב ל-time הנוכחי
  const candleDuration = gameState.candles.length > 1
    ? Math.abs(gameState.candles[1].time - gameState.candles[0].time)
    : 86400
  const timeTolerance = candleDuration * 0.5

  let idx = -1
  let best = Infinity
  for (let i = 0; i <= gameState.currentIndex; i++) {
    const d = Math.abs(gameState.candles[i].time - (time as number))
    if (d < best && d < timeTolerance) {
      best = d
      idx = i
    }
  }

  if (idx !== -1 && idx >= line.startIndex && idx <= line.endIndex) {
    const entry = Number(line.price)
    const sl = line.stopLoss ? Number(line.stopLoss) : undefined
    const tp = line.takeProfit ? Number(line.takeProfit) : undefined

    if (sl && tp) {
      const inProfit = line.type === 'long-position'
        ? isBetween(price, entry, tp) // LONG: Entry..TP
        : isBetween(price, tp, entry) // SHORT: TP..Entry

      const inLoss = line.type === 'long-position'
        ? isBetween(price, sl, entry) // LONG: SL..Entry
        : isBetween(price, entry, sl) // SHORT: Entry..SL

      if (inProfit) {
        chartRef.current?.applyOptions({ handleScroll: false, handleScale: false })
        setDraggingLine({ lineId: line.id, lineType: 'takeProfit', originalPrice: Number(line.takeProfit) })
        e.preventDefault()
        return
      }

      if (inLoss) {
        chartRef.current?.applyOptions({ handleScroll: false, handleScale: false })
        setDraggingLine({ lineId: line.id, lineType: 'stopLoss', originalPrice: Number(line.stopLoss) })
        e.preventDefault()
        return
      }
    }
  }
}


        // Check for resize handle click (at endIndex time)
        if (line.endIndex !== undefined && gameState) {
          const endCandle = gameState.candles[line.endIndex]
          if (endCandle) {
            // חישוב טולרנס זמן מבוסס על משך נר אחד (timeframe)
            const candleDuration = gameState.candles.length > 1
              ? Math.abs(gameState.candles[1].time - gameState.candles[0].time)
              : 86400

            // טולרנס של 1.5 נרות - גדול מספיק כדי לתפוס את הקו האנכי
            const timeTolerance = candleDuration * 1.5

            if (Math.abs((time as number) - endCandle.time) < timeTolerance) {
              // השבתת גרירת הגרף בזמן drag של הקו
              chartRef.current?.applyOptions({
                handleScroll: false,
                handleScale: false,
              })
              setDraggingLine({ lineId: line.id, lineType: 'resizeEnd' })
              e.preventDefault()
              return
            }
          }
        }

        // Check SL line - using relative tolerance (2% of SL price)
        if (line.stopLoss) {
          const slTolerance = line.stopLoss * 0.02 // 2% of SL price
          if (Math.abs(price - line.stopLoss) < slTolerance) {
            // השבתת גרירת הגרף בזמן drag של הקו
            chartRef.current?.applyOptions({
              handleScroll: false,
              handleScale: false,
            })
            setDraggingLine({ lineId: line.id, lineType: 'stopLoss', originalPrice: Number(line.stopLoss) })
            e.preventDefault()
            return
          }
        }

        // Check TP line - using relative tolerance (2% of TP price)
        if (line.takeProfit) {
          const tpTolerance = line.takeProfit * 0.02 // 2% of TP price
          if (Math.abs(price - line.takeProfit) < tpTolerance) {
            // השבתת גרירת הגרף בזמן drag של הקו
            chartRef.current?.applyOptions({
              handleScroll: false,
              handleScale: false,
            })
            setDraggingLine({ lineId: line.id, lineType: 'takeProfit', originalPrice: Number(line.takeProfit) })
            e.preventDefault()
            return
          }
        }
      }
    }

    // Mousemove handler for dragging SL/TP lines or resizing
    const handleMouseMove = (e: MouseEvent) => {
      if (!chartContainerRef.current || !chartRef.current || !candlestickSeriesRef.current) return

      // If we're dragging, prevent default chart behavior (panning)
      if (draggingLineRef.current) {
        e.preventDefault()
        e.stopPropagation()
      }

      // Get cursor position
      const rect = chartContainerRef.current.getBoundingClientRect()
      const relativeY = e.clientY - rect.top
      const relativeX = e.clientX - rect.left
      const price = candlestickSeriesRef.current.coordinateToPrice(relativeY)
      const time = chartRef.current.timeScale().coordinateToTime(relativeX)

      // ⚠️ אם price או time הם null, זה אומר שהעכבר לא מעל אזור תקין של הצ'רט
      // במקרה זה, נוודא שהריחוף מתאפס (hoveredPositionId = null)
      if (price === null || price === undefined || time === null || time === undefined) {
        // Clear hover state if we're not dragging
        if (!draggingLineRef.current && hoveredPositionId !== null) {
          console.log('🚫 Mouse outside valid chart area - clearing hover')
          setHoveredPositionId(null)
        }
        return
      }

      // If we're dragging, update the line position
      if (draggingLineRef.current) {
        const { lineId, lineType } = draggingLineRef.current

        if ((lineType === 'resizeStart' || lineType === 'resizeEnd') && chartRef.current && gameState) {
          // Resize candle span by dragging left/right handle.
          // Use logical index from x coordinate and clamp to [0..currentIndex]
          const logical = chartRef.current.timeScale().coordinateToLogical(relativeX)
          if (logical === null || logical === undefined) return
          const idx = Math.max(0, Math.min(gameState.currentIndex, Math.round(Number(logical))))
          const MIN_SPAN = 5

          setDrawnLines(prev => {
            const updated = prev.map(line => {
              if (line.id !== lineId) return line

              const start = Number.isFinite(line.startIndex) ? Number(line.startIndex) : 0
              const end = Number.isFinite(line.endIndex) ? Number(line.endIndex) : gameState.currentIndex

              if (lineType === 'resizeEnd') {
                const minEnd = start + MIN_SPAN
                const maxEnd = gameState.currentIndex
                const clampedEnd = Math.max(minEnd, Math.min(idx, maxEnd))
                return { ...line, endIndex: clampedEnd }
              } else {
                // resizeStart
                const maxStart = end - MIN_SPAN
                const clampedStart = Math.max(0, Math.min(idx, maxStart))
                return { ...line, startIndex: clampedStart }
              }
            })
            drawnLinesRef.current = updated
            return updated
          })
        } else if (lineType === 'stopLoss') {
          // Update SL price with constraints
          const originalPrice = draggingLineRef.current?.originalPrice

          setDrawnLines(prev => {
            const updated = prev.map(line => {
              // ✅ זיהוי ייחודי: רק אם זה ה-lineId הנכון וגם המחיר המקורי תואם
              if (line.id !== lineId) return line

              const entryPrice = Number(line.price)
              let newSL: number

              if (line.type === 'long-position') {
                // LONG: SL (אדום) ניתן לגרירה רק מתחת ל-Entry
                // אם ניסה לגרור מעל Entry, נעצור ב-Entry
                newSL = Math.min(price, entryPrice)
              } else if (line.type === 'short-position') {
                // SHORT: SL (אדום) ניתן לגרירה רק מעל ל-Entry
                // אם ניסה לגרור מתחת Entry, נעצור ב-Entry
                newSL = Math.max(price, entryPrice)
              } else {
                newSL = price
              }

              return { ...line, stopLoss: newSL as BarPrice }
            })
            // ✅ עדכון מיידי של ref כדי שהגרירה תעבוד חלק
            drawnLinesRef.current = updated
            return updated
          })
        } else if (lineType === 'takeProfit') {
          // Update TP price with constraints
          const originalPrice = draggingLineRef.current?.originalPrice

          setDrawnLines(prev => {
            const updated = prev.map(line => {
              // ✅ זיהוי ייחודי: רק אם זה ה-lineId הנכון וגם המחיר המקורי תואם
              if (line.id !== lineId) return line

              const entryPrice = Number(line.price)
              let newTP: number

              if (line.type === 'long-position') {
                // LONG: TP (ירוק) ניתן לגרירה רק מעל ל-Entry
                // אם ניסה לגרור מתחת Entry, נעצור ב-Entry
                newTP = Math.max(price, entryPrice)
              } else if (line.type === 'short-position') {
                // SHORT: TP (ירוק) ניתן לגרירה רק מתחת ל-Entry
                // אם ניסה לגרור מעל Entry, נעצור ב-Entry
                newTP = Math.min(price, entryPrice)
              } else {
                newTP = price
              }

              return { ...line, takeProfit: newTP as BarPrice }
            })
            // ✅ עדכון מיידי של ref כדי שהגרירה תעבוד חלק
            drawnLinesRef.current = updated
            return updated
          })
        }
      } else {
        // Not dragging - check if we're hovering over a draggable line/marker and change cursor
        let isOverDraggableLine = false
        let isOverResizeMarker = false

        // Check if hovering over a closed position entry marker
        let hoveredPosIndex: number | null = null

        // ⚠️ תמיד נבדוק - גם אם time/price הם null, כדי לוודא שהריחוף יתאפס
        if (gameState?.closedPositions && time !== null && time !== undefined && price !== null) {
          const candleDuration = gameState.candles.length > 1
            ? Math.abs(gameState.candles[1].time - gameState.candles[0].time)
            : 86400
          const timeTolerance = candleDuration * 1 // טולרנס זמן (1 נר בלבד - קטן יותר!)
          const priceTolerance = price * 0.005 // טולרנס מחיר 0.5% (עוד יותר קטן!)

          gameState.closedPositions.forEach((position, index) => {
            // בדיקה אם הכניסה כבר התרחשה
            if (position.entryIndex > gameState.currentIndex) return

            // בדיקה אם העכבר קרוב לנקודת הכניסה
            const timeMatch = Math.abs((time as number) - position.entryTime) < timeTolerance
            const priceMatch = Math.abs(price - position.entryPrice) < priceTolerance

            if (timeMatch && priceMatch) {
              hoveredPosIndex = index
            }
          })
        }
        // אחרת (time או price הם null) - hoveredPosIndex נשאר null

        // עדכון מצב הריחוף - ALWAYS UPDATE, even if hoveredPosIndex is null
        // כך כאשר העכבר נע רחוק מנקודת כניסה, hoveredPosIndex יהיה null והריחוף יתאפס
        if (hoveredPosIndex !== hoveredPositionId) {
          console.log(`🔄 Hover state change: ${hoveredPositionId} → ${hoveredPosIndex}`, {
            hasTime: time !== null,
            hasPrice: price !== null,
            closedPositionsCount: gameState?.closedPositions?.length || 0
          })
          setHoveredPositionId(hoveredPosIndex)
        }

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
                const timeTolerance = candleDuration * 1.5 // טולרנס גדול יותר

                if (Math.abs((time as number) - endCandle.time) < timeTolerance) {
                  isOverResizeMarker = true
                  break
                }
              }
            }

            // Check if hovering over SL line - using relative tolerance (2% of SL price)
            if (line.stopLoss) {
              const slTolerance = line.stopLoss * 0.02
              if (Math.abs(price - line.stopLoss) < slTolerance) {
                isOverDraggableLine = true
                break
              }
            }

            // Check if hovering over TP line - using relative tolerance (2% of TP price)
            if (line.takeProfit) {
              const tpTolerance = line.takeProfit * 0.02
              if (Math.abs(price - line.takeProfit) < tpTolerance) {
                isOverDraggableLine = true
                break
              }
            }
          }
        }

        // Show preview line for ray tool
        if (drawingInProgressRef.current && drawingInProgressRef.current.type === 'ray' && time !== null && time !== undefined) {
          // Clear previous preview
          previewLineSeriesRef.current.forEach(series => chartRef.current?.removeSeries(series))
          previewLineSeriesRef.current = []

          // Draw simple preview line between two points
          const previewSeries = chartRef.current!.addLineSeries({
            color: '#06B6D4',
            lineWidth: 2,
            lineStyle: 2, // dotted
            priceLineVisible: false,
            lastValueVisible: false,
          })

          const startPrice = drawingInProgressRef.current.price
          const startTime = drawingInProgressRef.current.time
          const endPrice = price
          const endTime = time as number

          if (startTime !== endTime) {
            previewSeries.setData([
              { time: startTime as Time, value: startPrice },
              { time: endTime as Time, value: endPrice },
            ])
          }

          previewLineSeriesRef.current.push(previewSeries)
        } else {
          // Clear preview if not in drawing mode
          previewLineSeriesRef.current.forEach(series => chartRef.current?.removeSeries(series))
          previewLineSeriesRef.current = []
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
        // החזרת גרירת הגרף
        chartRef.current?.applyOptions({
          handleScroll: true,
          handleScale: true,
        })
        setDraggingLine(null)
      }
    }

    // Mouse leave handler - cancel drawing operations (like TradingView)
    const handleMouseLeave = () => {
      // Cancel any drawing in progress
      if (drawingInProgressRef.current) {
        setDrawingInProgress(null)
      }

      // Clear preview lines
      previewLineSeriesRef.current.forEach(series => chartRef.current?.removeSeries(series))
      previewLineSeriesRef.current = []

      // End dragging if active
      if (draggingLineRef.current) {
        chartRef.current?.applyOptions({
          handleScroll: true,
          handleScale: true,
        })
        setDraggingLine(null)
      }

      // Clear position hover state
      if (hoveredPositionId !== null) {
        setHoveredPositionId(null)
      }
    }

    chartContainerRef.current.addEventListener('click', handleChartClick)
    chartContainerRef.current.addEventListener('dblclick', handleChartDoubleClick)
    chartContainerRef.current.addEventListener('contextmenu', handleContextMenu)
    chartContainerRef.current.addEventListener('mousedown', handleMouseDown)
    chartContainerRef.current.addEventListener('mousemove', handleMouseMove)
    chartContainerRef.current.addEventListener('mouseup', handleMouseUp)
    chartContainerRef.current.addEventListener('mouseleave', handleMouseLeave) // Cancel drawing if mouse leaves chart

    return () => {
      console.log('TradingChart: Unmounting chart component')
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleLogicalRangeChange)
      chart.unsubscribeCrosshairMove(handleCrosshairMove)
      window.removeEventListener('resize', handleResize)
      chartContainerRef.current?.removeEventListener('click', handleChartClick)
      chartContainerRef.current?.removeEventListener('dblclick', handleChartDoubleClick)
      chartContainerRef.current?.removeEventListener('contextmenu', handleContextMenu)
      chartContainerRef.current?.removeEventListener('mousedown', handleMouseDown)
      chartContainerRef.current?.removeEventListener('mousemove', handleMouseMove)
      chartContainerRef.current?.removeEventListener('mouseup', handleMouseUp)
      chartContainerRef.current?.removeEventListener('mouseleave', handleMouseLeave)
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

  // פונקציה לחישוב ממוצע נע אקספוננציאלי (EMA)
  const calculateEMA = (candles: any[], period: number, startIndex: number = 0) => {
    if (!candles || candles.length < period) return []

    const emaData: { time: Time; value: number }[] = []
    const multiplier = 2 / (period + 1)

    // אם startFromCurrentIndex=true, מתחילים מהאינדקס הנוכחי
    const effectiveStartIndex = Math.max(startIndex, period - 1)

    // חישוב SMA ראשוני עבור נקודת התחלה
    let sum = 0
    for (let j = 0; j < period; j++) {
      sum += candles[effectiveStartIndex - j].close
    }
    let ema = sum / period

    // הוספת ה-EMA הראשון
    emaData.push({
      time: candles[effectiveStartIndex].time as Time,
      value: ema,
    })

    // חישוב EMA עבור שאר הנרות
    for (let i = effectiveStartIndex + 1; i < candles.length; i++) {
      ema = (candles[i].close - ema) * multiplier + ema
      emaData.push({
        time: candles[i].time as Time,
        value: ema,
      })
    }

    return emaData
  }

  // פונקציה לעדכון סדרות ממוצעים נעים (דינמי)
  const updateMASeriesVisibility = () => {
    if (!gameState?.candles || !chartRef.current) return

    const visibleCandles = gameState.candles.slice(0, gameState.currentIndex + 1)

    // חישוב startIndex מבוסס על התקופה הארוכה ביותר
    const maxPeriod = maSettings.movingAverages.length > 0
      ? Math.max(...maSettings.movingAverages.map(ma => ma.period))
      : 200
    const startIndex = maSettings.startFromCurrentIndex ? Math.max(0, gameState.currentIndex - maxPeriod) : 0

    // Get current MA IDs
    const currentMAIds = new Set(maSettings.movingAverages.map(ma => ma.id))

    // Remove series that are no longer in settings
    const seriesToRemove: string[] = []
    maSeriesRefs.current.forEach((series, id) => {
      if (!currentMAIds.has(id)) {
        try {
          chartRef.current?.removeSeries(series)
        } catch (e) {
          // Series might already be removed
        }
        seriesToRemove.push(id)
      }
    })
    seriesToRemove.forEach(id => maSeriesRefs.current.delete(id))

    // Update or create series for each MA
    maSettings.movingAverages.forEach(ma => {
      let series = maSeriesRefs.current.get(ma.id)

      // Create series if it doesn't exist
      if (!series && chartRef.current) {
        series = chartRef.current.addLineSeries({
          color: ma.color,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          visible: false,
        })
        maSeriesRefs.current.set(ma.id, series)
      }

      if (series) {
        if (ma.enabled) {
          // Calculate MA data
          const maData = ma.type === 'EMA'
            ? calculateEMA(visibleCandles, ma.period, startIndex)
            : calculateSMA(visibleCandles, ma.period, startIndex)

          series.setData(maData)
          series.applyOptions({
            visible: true,
            color: ma.color, // Update color in case it changed
          })
        } else {
          series.applyOptions({ visible: false })
        }
      }
    })
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

    // תיקון למשחקים ישנים: הוספת endIndex לכלים שאין להם
    const fixedLines = drawnLines.map(line => {
      if ((line.type === 'long-position' || line.type === 'short-position') && line.endIndex === undefined && line.startIndex !== undefined) {
        const defaultEndIndex = Math.min(line.startIndex + 15, gameState.currentIndex)
        console.log('🔧 Fixing old position tool - adding endIndex:', { lineId: line.id, startIndex: line.startIndex, endIndex: defaultEndIndex })
        return { ...line, endIndex: defaultEndIndex }
      }
      return line
    })

    // עדכון drawnLines אם תוקנו
    if (fixedLines.some((line, i) => line.endIndex !== drawnLines[i].endIndex)) {
      setDrawnLines(fixedLines)
      return // נצא ונרנדר מחדש עם הקווים המתוקנים
    }

    // ציור כל הקווים
    drawnLines.forEach((line) => {
      const isSelected = line.id === selectedLineId

      if (line.type === 'horizontal-line' || line.type === 'horizontal-ray' || line.type === 'ray' || line.type === 'trend-line') {
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
          // קרן אופקית - קו אופקי מנקודת התחלה עד סוף הגרף
          const lastCandle = gameState.candles[gameState.currentIndex]

          if (lastCandle) {
            const times = [line.startTime, lastCandle.time].sort((a, b) => a - b)
            lineSeries.setData([
              { time: times[0] as Time, value: line.price },
              { time: times[1] as Time, value: line.price },
            ])
          }
        } else if (line.type === 'ray' && line.startTime && line.endTime && line.price2 !== undefined) {
          // קרן בזווית - קו בין שתי נקודות (בלי הארכה עתידית)
          if (line.startTime !== line.endTime) {
            lineSeries.setData([
              { time: line.startTime as Time, value: line.price },
              { time: line.endTime as Time, value: line.price2 },
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
      // כלי Long Position - סימולציה של עסקת LONG עם SL/TP כמלבנים מלאים
      else if (line.type === 'long-position' && line.startTime && line.startIndex !== undefined) {
        const isSelected = line.id === selectedLineId
        const entryPrice = Number(line.price)
        const sl = line.stopLoss ? Number(line.stopLoss) : undefined
        const tp = line.takeProfit ? Number(line.takeProfit) : undefined

        // חישוב זמן התחלה וסיום לפי startIndex ו-endIndex
        const startCandle = gameState.candles[line.startIndex]
        const endIndex = line.endIndex !== undefined ? line.endIndex : Math.min(line.startIndex + 15, gameState.currentIndex)
        const endCandle = gameState.candles[endIndex]

        if (!startCandle || !endCandle) return

        const times = [startCandle.time, endCandle.time].sort((a, b) => a - b)

// ציור zones כ"מלבנים" אמיתיים באמצעות הרבה קווי-מילוי (פתרון יציב ב-LWC)
if (sl && tp) {
  const steps = 60 // ככל שגבוה יותר, המילוי נראה יותר "solid"

  // PROFIT (ירוק): Entry -> TP
  const minP = Math.min(entryPrice, tp)
  const maxP = Math.max(entryPrice, tp)
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps
    const priceLevel = minP + (maxP - minP) * ratio
    const profitFillLine = chartRef.current!.addLineSeries({
      color: isSelected ? 'rgba(74, 222, 128, 0.30)' : 'rgba(34, 197, 94, 0.28)',
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: false,
      lineStyle: 0,
    })
    profitFillLine.setData([
      { time: times[0] as Time, value: priceLevel },
      { time: times[1] as Time, value: priceLevel },
    ])
    drawnLineSeriesRef.current.push(profitFillLine)
  }

  // LOSS (אדום): SL -> Entry
  const minL = Math.min(sl, entryPrice)
  const maxL = Math.max(sl, entryPrice)
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps
    const priceLevel = minL + (maxL - minL) * ratio
    const lossFillLine = chartRef.current!.addLineSeries({
      color: isSelected ? 'rgba(248, 113, 113, 0.30)' : 'rgba(239, 68, 68, 0.28)',
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: false,
      lineStyle: 0,
    })
    lossFillLine.setData([
      { time: times[0] as Time, value: priceLevel },
      { time: times[1] as Time, value: priceLevel },
    ])
    drawnLineSeriesRef.current.push(lossFillLine)
  }
}

// קו Entry - לבן מקווקו (ציר אמצע)
        const entrySeries = chartRef.current!.addLineSeries({
          color: isSelected ? '#ffffff' : '#d1d5db',
          lineWidth: isSelected ? 2 : 1,
          priceLineVisible: false,
          lastValueVisible: false,
          lineStyle: 1, // dotted
        })
        entrySeries.setData([
          { time: times[0] as Time, value: entryPrice },
          { time: times[1] as Time, value: entryPrice },
        ])
        drawnLineSeriesRef.current.push(entrySeries)

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

        // Resize marker בסוף - ידית לגרירה
        const endTime = endCandle.time
        markers.push({
          time: endTime as Time,
          position: 'inBar' as const,
          color: isSelected ? '#FFD700' : '#FF9800',
          shape: 'square' as const,
          text: '⇔',
          size: 2,
        })
      }
      // כלי Short Position - סימולציה של עסקת SHORT עם SL/TP כמלבנים מלאים
      else if (line.type === 'short-position' && line.startTime && line.startIndex !== undefined) {
        const isSelected = line.id === selectedLineId
        const entryPrice = Number(line.price)
        const sl = line.stopLoss ? Number(line.stopLoss) : undefined
        const tp = line.takeProfit ? Number(line.takeProfit) : undefined

        // חישוב זמן התחלה וסיום לפי startIndex ו-endIndex
        const startCandle = gameState.candles[line.startIndex]
        const endIndex = line.endIndex !== undefined ? line.endIndex : Math.min(line.startIndex + 15, gameState.currentIndex)
        const endCandle = gameState.candles[endIndex]

        if (!startCandle || !endCandle) return

        const times = [startCandle.time, endCandle.time].sort((a, b) => a - b)

// ציור zones כ"מלבנים" אמיתיים באמצעות הרבה קווי-מילוי (פתרון יציב ב-LWC)
if (sl && tp) {
  const steps = 60

  // PROFIT (ירוק): TP -> Entry (ב-SHORT זה למטה)
  const minP = Math.min(tp, entryPrice)
  const maxP = Math.max(tp, entryPrice)
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps
    const priceLevel = minP + (maxP - minP) * ratio
    const profitFillLine = chartRef.current!.addLineSeries({
      color: isSelected ? 'rgba(74, 222, 128, 0.30)' : 'rgba(34, 197, 94, 0.28)',
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: false,
      lineStyle: 0,
    })
    profitFillLine.setData([
      { time: times[0] as Time, value: priceLevel },
      { time: times[1] as Time, value: priceLevel },
    ])
    drawnLineSeriesRef.current.push(profitFillLine)
  }

  // LOSS (אדום): Entry -> SL (ב-SHORT זה למעלה)
  const minL = Math.min(entryPrice, sl)
  const maxL = Math.max(entryPrice, sl)
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps
    const priceLevel = minL + (maxL - minL) * ratio
    const lossFillLine = chartRef.current!.addLineSeries({
      color: isSelected ? 'rgba(248, 113, 113, 0.30)' : 'rgba(239, 68, 68, 0.28)',
      lineWidth: 3,
      priceLineVisible: false,
      lastValueVisible: false,
      lineStyle: 0,
    })
    lossFillLine.setData([
      { time: times[0] as Time, value: priceLevel },
      { time: times[1] as Time, value: priceLevel },
    ])
    drawnLineSeriesRef.current.push(lossFillLine)
  }
}

// קו Entry - לבן מקווקו (ציר אמצע)
        const entrySeries = chartRef.current!.addLineSeries({
          color: isSelected ? '#ffffff' : '#d1d5db',
          lineWidth: isSelected ? 2 : 1,
          priceLineVisible: false,
          lastValueVisible: false,
          lineStyle: 1, // dotted
        })
        entrySeries.setData([
          { time: times[0] as Time, value: entryPrice },
          { time: times[1] as Time, value: entryPrice },
        ])
        drawnLineSeriesRef.current.push(entrySeries)

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

        // Resize marker בסוף - ידית לגרירה
        const endTime = endCandle.time
        markers.push({
          time: endTime as Time,
          position: 'inBar' as const,
          color: isSelected ? '#FFD700' : '#FF9800',
          shape: 'square' as const,
          text: '⇔',
          size: 2,
        })
      }
      // כלי Rectangle - מלבן צבעוני עם שקיפות
      else if (line.type === 'rectangle' && line.startTime && line.endTime && line.price2 !== undefined) {
        if (line.startTime === line.endTime) {
          console.warn('Skipping rectangle with same start/end time')
          return
        }

        const isSelected = line.id === selectedLineId
        const opacity = line.opacity !== undefined ? line.opacity : 0.3
        const steps = 30 // מספר קווים למילוי

        const times = [line.startTime, line.endTime].sort((a, b) => a - b)
        const prices = [line.price, line.price2].sort((a, b) => a - b)
        const minPrice = prices[0]
        const maxPrice = prices[1]

        // המרת hex color ל-RGB
        const hex = line.color.replace('#', '')
        const r = parseInt(hex.substring(0, 2), 16)
        const g = parseInt(hex.substring(2, 4), 16)
        const b = parseInt(hex.substring(4, 6), 16)

        // הבהרה אם נבחר
        const finalR = isSelected ? Math.min(255, r + 40) : r
        const finalG = isSelected ? Math.min(255, g + 40) : g
        const finalB = isSelected ? Math.min(255, b + 40) : b

        // מילוי המלבן עם קווים אופקיים רבים
        for (let i = 0; i <= steps; i++) {
          const ratio = i / steps
          const price = minPrice + (maxPrice - minPrice) * ratio

          const rectangleFillLine = chartRef.current!.addLineSeries({
            color: `rgba(${finalR}, ${finalG}, ${finalB}, ${opacity})`,
            lineWidth: 3,
            priceLineVisible: false,
            lastValueVisible: false,
            lineStyle: 0, // solid
          })

          rectangleFillLine.setData([
            { time: times[0] as Time, value: price },
            { time: times[1] as Time, value: price },
          ])
          drawnLineSeriesRef.current.push(rectangleFillLine)
        }

        // מסגרת המלבן - 4 קווים (top, bottom, left, right)
        const borderWidth = isSelected ? 3 : 2

        // קו עליון
        const topBorder = chartRef.current!.addLineSeries({
          color: `rgb(${finalR}, ${finalG}, ${finalB})`,
          lineWidth: borderWidth,
          priceLineVisible: false,
          lastValueVisible: false,
          lineStyle: 0,
        })
        topBorder.setData([
          { time: times[0] as Time, value: maxPrice },
          { time: times[1] as Time, value: maxPrice },
        ])
        drawnLineSeriesRef.current.push(topBorder)

        // קו תחתון
        const bottomBorder = chartRef.current!.addLineSeries({
          color: `rgb(${finalR}, ${finalG}, ${finalB})`,
          lineWidth: borderWidth,
          priceLineVisible: false,
          lastValueVisible: false,
          lineStyle: 0,
        })
        bottomBorder.setData([
          { time: times[0] as Time, value: minPrice },
          { time: times[1] as Time, value: minPrice },
        ])
        drawnLineSeriesRef.current.push(bottomBorder)

        // קווים אנכיים (שמאל וימין) - באמצעות נקודות רבות
        for (let i = 0; i <= 20; i++) {
          const ratio = i / 20
          const price = minPrice + (maxPrice - minPrice) * ratio

          // קו שמאל
          const leftBorder = chartRef.current!.addLineSeries({
            color: `rgb(${finalR}, ${finalG}, ${finalB})`,
            lineWidth: borderWidth,
            priceLineVisible: false,
            lastValueVisible: false,
            lineStyle: 0,
          })
          leftBorder.setData([{ time: times[0] as Time, value: price }])
          drawnLineSeriesRef.current.push(leftBorder)

          // קו ימין
          const rightBorder = chartRef.current!.addLineSeries({
            color: `rgb(${finalR}, ${finalG}, ${finalB})`,
            lineWidth: borderWidth,
            priceLineVisible: false,
            lastValueVisible: false,
            lineStyle: 0,
          })
          rightBorder.setData([{ time: times[1] as Time, value: price }])
          drawnLineSeriesRef.current.push(rightBorder)
        }
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
        createPatternMarkers(hoveredPositionId)
      }, 0)
    }
  }, [drawnLines, selectedLineId, gameState?.currentIndex, gameState?.candles.length, gameState?.id, gameState?.closedPositions?.length, hoveredPositionId])

  // פונקציות לניהול קווים
  const handleDeleteLine = (id: string) => {
    setDrawnLines((prev) => {
      const updated = prev.filter((line) => line.id !== id)
      console.log(`🗑️ Deleted line ${id}, remaining: ${updated.length}`)
      return updated
    })
  }

  const handleClearAllLines = () => {
    setDrawnLines([])
    if (gameState?.sourceFileName) {
      const storageKey = `trading-game-drawings-${gameState.sourceFileName}`
      localStorage.removeItem(storageKey)
      console.log(`🗑️ Cleared all drawings for file "${gameState.sourceFileName}"`)
    }
  }

  const handleUpdateLine = (id: string, updates: Partial<DrawnLine>) => {
    setDrawnLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, ...updates } : line))
    )
  }

  // בדיקת התראות בעת מעבר נר חדש
  const checkLineAlerts = (currentCandle: any, previousCandle: any) => {
    if (!currentCandle || !previousCandle) return

    drawnLinesRef.current.forEach((line) => {
      // רק לקווים אופקיים עם התראה פעילה
      if ((line.type !== 'horizontal-line' && line.type !== 'horizontal-ray') || !line.alertEnabled) {
        return
      }

      // אם ההתראה כבר הופעלה, דלג
      if (line.alertTriggered) {
        return
      }

      // עבור horizontal-line ו-horizontal-ray, השתמש ב-price (המחיר הקבוע)
      const linePrice = line.price
      const prevClose = previousCandle.close
      const currClose = currentCandle.close

      // בדיקה האם המחיר חצה את הקו
      const wasPriceAbove = prevClose > linePrice
      const isPriceAbove = currClose > linePrice

      let shouldTrigger = false

      if (line.alertDirection === 'above' && wasPriceAbove && !isPriceAbove) {
        // חציה מלמעלה למטה
        shouldTrigger = true
      } else if (line.alertDirection === 'below' && !wasPriceAbove && isPriceAbove) {
        // חציה מלמטה למעלה
        shouldTrigger = true
      } else if (line.alertDirection === 'both' && wasPriceAbove !== isPriceAbove) {
        // חציה משני הכיוונים
        shouldTrigger = true
      }

      if (shouldTrigger) {
        // הפעלת התראה ויזואלית
        const direction = isPriceAbove ? '↑' : '↓'
        const crossDirection = isPriceAbove ? 'above' : 'below'
        const message = `⚠️ התראת קו: ${direction} המחיר חצה את $${linePrice.toFixed(2)}`

        // שימוש ב-toast מהמערכת הקיימת
        toast.success(message, {
          duration: 5000,
          icon: '🔔',
          style: {
            background: '#1a1a2e',
            color: '#fff',
            border: '2px solid #FFD700',
          },
        })

        // שליחת התראה ל-Telegram
        telegramService.notifyPriceAlert({
          direction: crossDirection as 'above' | 'below',
          targetPrice: linePrice,
          currentPrice: currClose,
          asset: gameState?.asset,
        })

        // סימון שההתראה הופעלה
        handleUpdateLine(line.id, { alertTriggered: true, lastPriceAbove: isPriceAbove })

        console.log('🔔 Alert triggered:', message, { line, prevClose, currClose })
      }
    })
  }

  // פונקציה ליצירת סימון עסקאות סגורות
  // עכשיו מקבלת hoveredPositionIndex כדי להציג exit markers רק עבור פוזיציה מרחפת
  const createClosedTradeMarkers = (hoveredPositionIndex: number | null = null): any[] => {
    if (!gameState?.closedPositions || !gameState?.candles) return []

    const tradeMarkers: any[] = []

    gameState.closedPositions.forEach((position, index) => {
      // markers לכניסה - תמיד מוצגים
      if (position.entryIndex <= gameState.currentIndex) {
        const isLong = position.type === 'long'
        const isProfitable = (position.exitPnL || 0) > 0

        // צבע החץ לפי כיוון: LONG = ירוק, SHORT = אדום
        const arrowColor = isLong ? '#22c55e' : '#ef4444'

        // צבע הנקודה (background) לפי תוצאה: רווח = ירוק, הפסד = אדום
        const markerColor = isProfitable ? '#22c55e' : '#ef4444'

        tradeMarkers.push({
          time: position.entryTime as Time,
          position: isLong ? ('belowBar' as const) : ('aboveBar' as const),
          color: markerColor, // צבע הנקודה לפי תוצאה
          shape: isLong ? ('arrowUp' as const) : ('arrowDown' as const),
          text: `${isLong ? '🟢' : '🔴'} Entry`, // טקסט לפי כיוון
          size: 1.2,
        })
      }

      // markers ליציאה - רק אם מרחפים על הפוזיציה הזו!
      if (position.exitIndex !== undefined &&
          position.exitIndex <= gameState.currentIndex &&
          hoveredPositionIndex === index) {
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
  // עכשיו מקבלת hoveredPositionIndex כדי להעביר ל-createClosedTradeMarkers
  const createPatternMarkers = (hoveredPositionIndex: number | null = null) => {
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

    // יצירת markers לעסקאות סגורות (מעבירים hoveredPositionIndex)
    const tradeMarkers = createClosedTradeMarkers(hoveredPositionIndex)

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

  // פונקציה ליצירת קווי חיבור לפוזיציות סגורות
  // עכשיו מקבלת hoveredPositionIndex כדי להציג רק את הקו של הפוזיציה שמרחפים מעליה
  const createClosedPositionLines = (hoveredPositionIndex: number | null = null) => {
    if (!chartRef.current || !gameState?.closedPositions || !gameState?.candles) return

    // הסרת קווים ישנים
    closedPositionLineSeriesRef.current.forEach((series: ISeriesApi<'Line'>) => {
      try {
        chartRef.current?.removeSeries(series)
      } catch (e) {
        // Series might already be removed, ignore error
      }
    })
    closedPositionLineSeriesRef.current = []

    // יצירת קו חיבור רק לפוזיציה שמרחפים מעליה (אם יש)
    gameState.closedPositions.forEach((position, index) => {
      // ⚠️ אם אין ריחוף בכלל, לא להציג שום קו
      if (hoveredPositionIndex === null) {
        return // אין ריחוף - לא מציגים קווים
      }

      // אם יש ריחוף, נציג רק את הקו של הפוזיציה שמרחפים מעליה
      if (index !== hoveredPositionIndex) {
        return // דלג על פוזיציות אחרות
      }

      // וידוא שגם הכניסה וגם היציאה כבר התרחשו
      if (position.exitIndex === undefined ||
          position.entryIndex > gameState.currentIndex ||
          position.exitIndex > gameState.currentIndex) {
        return // לא מציגים את הקו אם היציאה עדיין לא התרחשה
      }

      const isProfitable = (position.exitPnL || 0) > 0
      const color = isProfitable ? '#22c55e' : '#ef4444' // ירוק לרווח, אדום להפסד

      // יצירת קו חיבור מנקודת כניסה לנקודת יציאה
      const connectionLine = chartRef.current!.addLineSeries({
        color,
        lineWidth: 2,
        lineStyle: 0, // solid line
        priceLineVisible: false,
        lastValueVisible: false,
      })

      // נתוני הקו - מכניסה ליציאה
      const lineData = [
        { time: position.entryTime as Time, value: position.entryPrice },
        { time: position.exitTime as Time, value: position.exitPrice },
      ]

      connectionLine.setData(lineData)
      closedPositionLineSeriesRef.current.push(connectionLine)
    })

    if (hoveredPositionIndex !== null) {
      console.log(`📊 Showing connection line for hovered position #${hoveredPositionIndex}`)
    }
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

      // חישוב Volume MA20 לכל הנרות הנראים (מאינדקס 20 ועד currentIndex)
      const volumeMAData: { time: Time; value: number }[] = []

      for (let i = 19; i <= currentIndex; i++) {
        const last20Candles = gameState.candles.slice(i - 19, i + 1)
        if (last20Candles.length === 20) {
          const volumeSum = last20Candles.reduce((sum, c) => sum + c.volume, 0)
          const volumeMA = volumeSum / 20
          volumeMAData.push({
            time: gameState.candles[i].time as Time,
            value: volumeMA,
          })
        }
      }

      volumeMASeriesRef.current.setData(volumeMAData)
      console.log(`📊 Volume MA Initial: Calculated ${volumeMAData.length} MA points from candle 20 to ${currentIndex}`)

      // עדכון נרות + Volume - עם הדגשת ווליום גבוה (1.5x MA)
      const candleData = visibleCandles.map((candle, idx) => {
        const candleIndex = idx // האינדקס ב-visibleCandles מתאים לאינדקס בגיים
        const isGreenCandle = candle.close >= candle.open

        // בדיקה אם יש MA עבור הנר הזה והאם הווליום גבוה (1.5x MA)
        const maPoint = volumeMAData.find(ma => ma.time === candle.time)
        const isHighVolume = maPoint && candle.volume >= maPoint.value * 1.5

        if (isHighVolume) {
          console.log(`🔥 High Volume at index ${candleIndex}: ${candle.volume.toFixed(0)} (MA: ${maPoint.value.toFixed(0)}, ratio: ${(candle.volume / maPoint.value).toFixed(2)}x)`)
        }

        return {
          ...candle,
          time: candle.time as Time,
          // נרות עם ווליום גבוה - צבועים בצבע בולט
          ...(isHighVolume && {
            color: isGreenCandle ? '#00ff00' : '#ff0000', // ירוק/אדום בהיר מלא
            wickColor: isGreenCandle ? '#00ff00' : '#ff0000',
            borderColor: isGreenCandle ? '#00ff00' : '#ff0000',
          })
        }
      })
      candlestickSeriesRef.current.setData(candleData)

      // עדכון Volume - צבע לפי כיוון הנר + הדגשת ווליום גבוה
      const volumeData = visibleCandles.map((candle, idx) => {
        const isGreenCandle = candle.close >= candle.open
        let color = isGreenCandle ? '#00c85380' : '#ff174480'

        // אם יש MA ווליום גבוה - צבע בולט
        const maPoint = volumeMAData.find(ma => ma.time === candle.time)
        if (maPoint && candle.volume >= maPoint.value * 1.5) {
          color = isGreenCandle ? '#00ff00cc' : '#ff0000cc'
        }

        return {
          time: candle.time as Time,
          value: candle.volume,
          color: color,
        }
      })
      volumeSeriesRef.current.setData(volumeData)

      // שמירת האינדקס ההתחלתי
      initialIndexRef.current = currentIndex

      lastCandleIndexRef.current = currentIndex
      lastGameIdRef.current = currentGameId // שמירת gameId כדי לזהות משחק טעון

      // יצירת סימון תבניות
      createPatternMarkers(hoveredPositionId ?? null)

      // יצירת סימון פקודות עתידיות
      createPendingOrderLines()

      // יצירת קווי חיבור לפוזיציות סגורות
      createClosedPositionLines(hoveredPositionId ?? null)

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
      createPatternMarkers(hoveredPositionId ?? null)
      createPendingOrderLines()
      createClosedPositionLines(hoveredPositionId ?? null)

      if (chartRef.current) {
        chartRef.current.timeScale().scrollToPosition(3, true)
      }

      return
    }

    // אם זה נר חדש, הוסף אותו בלבד (אנימציה חלקה)
    if (currentIndex > lastCandleIndexRef.current) {
      const newCandle = gameState.candles[currentIndex]
      if (newCandle) {
        // בדיקת התראות לקווים אופקיים
        const previousCandle = gameState.candles[currentIndex - 1]
        if (previousCandle) {
          checkLineAlerts(newCandle, previousCandle)
        }

        // עדכון MA 20 של Volume (מאינדקס 20 ואילך)
        let volumeMA: number | null = null
        if (currentIndex >= 19) {
          // חישוב אחורה: 20 נרות אחרונים כולל הנוכחי
          const startIdx = currentIndex - 19
          const endIdx = currentIndex + 1
          const last20Candles = gameState.candles.slice(startIdx, endIdx)

          if (last20Candles.length === 20) {
            const volumeSum = last20Candles.reduce((sum, c) => sum + c.volume, 0)
            volumeMA = volumeSum / 20

            volumeMASeriesRef.current.update({
              time: newCandle.time as Time,
              value: volumeMA,
            })

            console.log(`📊 MA Update: idx=${currentIndex}, range=[${startIdx}, ${endIdx}), MA=${volumeMA.toFixed(2)}`)
          }
        }

        // בדיקה אם ווליום גבוה (1.5x MA)
        const isGreenCandle = newCandle.close >= newCandle.open
        const isHighVolume = volumeMA && newCandle.volume >= volumeMA * 1.5

        if (isHighVolume) {
          console.log(`🔥 High Volume at index ${currentIndex}: ${newCandle.volume.toFixed(0)} (MA: ${volumeMA.toFixed(0)}, ratio: ${(newCandle.volume / volumeMA).toFixed(2)}x)`)
        }

        // עדכון נר - עם צבע בולט אם ווליום גבוה
        candlestickSeriesRef.current.update({
          ...newCandle,
          time: newCandle.time as Time,
          // נר עם ווליום גבוה - צבוע בצבע בולט
          ...(isHighVolume && {
            color: isGreenCandle ? '#00ff00' : '#ff0000',
            wickColor: isGreenCandle ? '#00ff00' : '#ff0000',
            borderColor: isGreenCandle ? '#00ff00' : '#ff0000',
          })
        })

        // עדכון Volume - צבע לפי כיוון הנר + הדגשת ווליום גבוה
        let volumeColor = isGreenCandle ? '#00c85380' : '#ff174480'
        if (isHighVolume) {
          volumeColor = isGreenCandle ? '#00ff00cc' : '#ff0000cc'
        }

        volumeSeriesRef.current.update({
          time: newCandle.time as Time,
          value: newCandle.volume,
          color: volumeColor,
        })

        lastCandleIndexRef.current = currentIndex

        // עדכון סימון תבניות אם נחשפה תבנית חדשה
        const hasNewPattern = gameState.patterns?.some(p => p.startIndex === currentIndex)
        if (hasNewPattern) {
          createPatternMarkers(hoveredPositionId ?? null)
        }

        // עדכון סימון פקודות עתידיות (צריך להתעדכן בכל נר כי הקו מתארך)
        createPendingOrderLines()

        // עדכון קווי חיבור לפוזיציות סגורות (צריך להתעדכן כאשר פוזיציה נסגרת)
        createClosedPositionLines(hoveredPositionId ?? null)

        // גלילה אוטומטית חלקה לנר החדש
        if (chartRef.current) {
          chartRef.current.timeScale().scrollToPosition(3, true) // true = אנימציה
        }
      }
    }
  }, [gameState?.currentIndex, gameState?.id, gameState?.candles.length])

  // Effect to update connection lines when hovering over position entry markers
  useEffect(() => {
    if (!chartRef.current || !gameState?.closedPositions) return

    // רק אם יש פוזיציות סגורות, עדכן את הקווים
    createClosedPositionLines(hoveredPositionId)
  }, [hoveredPositionId, gameState?.closedPositions?.length])

  return (
    <div className="w-full h-full bg-dark-panel rounded-lg overflow-hidden relative">
      <div
        ref={chartContainerRef}
        className="w-full"
        style={{
          height: 'calc(100% - 110px)', // מקום מספיק לציר התאריכים
          cursor: activeTool !== 'none' ? 'crosshair' : 'default'
        }}
      />

      {/* Risk/Reward Zones (DOM overlay) */}
      <div className="absolute inset-0 pointer-events-none">
        {zoneOverlays.map((z) => (
          <div key={z.lineId} className="absolute inset-0 pointer-events-none">
            {/* Profit zone */}
            <div
              className="absolute pointer-events-auto"
              style={{
                left: z.profit.left,
                top: z.profit.top,
                width: z.profit.width,
                height: z.profit.height,
                background: z.profit.fill,
              }}
              onMouseDown={(e) => onZoneBodyMouseDown(e, z.lineId)}
            />
            {/* Loss zone */}
            <div
              className="absolute pointer-events-auto"
              style={{
                left: z.loss.left,
                top: z.loss.top,
                width: z.loss.width,
                height: z.loss.height,
                background: z.loss.fill,
              }}
              onMouseDown={(e) => onZoneBodyMouseDown(e, z.lineId)}
            />

            {/* TP handle */}
            {z.tpHandle && (
              <div
                className="absolute pointer-events-auto"
                style={{
                  left: z.tpHandle.x,
                  top: z.tpHandle.y - 6,
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: 'rgba(34, 197, 94, 0.9)',
                  border: '1px solid rgba(0,0,0,0.35)',
                  cursor: 'ns-resize',
                }}
                onMouseDown={(e) => beginZoneHandleDrag(e, z.lineId, 'tp')}
                title="Drag TP"
              />
            )}

            {/* SL handle */}
            {z.slHandle && (
              <div
                className="absolute pointer-events-auto"
                style={{
                  left: z.slHandle.x,
                  top: z.slHandle.y - 6,
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: 'rgba(239, 68, 68, 0.9)',
                  border: '1px solid rgba(0,0,0,0.35)',
                  cursor: 'ns-resize',
                }}
                onMouseDown={(e) => beginZoneHandleDrag(e, z.lineId, 'sl')}
                title="Drag SL"
              />
            )}

            {/* Width resize handles (drag to change candle span) */}
            {z.startHandle && (
              <div
                className="absolute pointer-events-auto"
                style={{
                  left: z.startHandle.x,
                  top: z.startHandle.y - 10,
                  width: 12,
                  height: 20,
                  borderRadius: 3,
                  background: 'rgba(148, 163, 184, 0.95)',
                  border: '1px solid rgba(0,0,0,0.35)',
                  cursor: 'ew-resize',
                }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setSelectedLineId(z.lineId)
                  chartRef.current?.applyOptions({ handleScroll: false, handleScale: false })
                  setDraggingLine({ lineId: z.lineId, lineType: 'resizeStart' })
                }}
                title="Drag to resize (start)"
              />
            )}

            {z.endHandle && (
              <div
                className="absolute pointer-events-auto"
                style={{
                  left: z.endHandle.x,
                  top: z.endHandle.y - 10,
                  width: 12,
                  height: 20,
                  borderRadius: 3,
                  background: 'rgba(148, 163, 184, 0.95)',
                  border: '1px solid rgba(0,0,0,0.35)',
                  cursor: 'ew-resize',
                }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setSelectedLineId(z.lineId)
                  chartRef.current?.applyOptions({ handleScroll: false, handleScale: false })
                  setDraggingLine({ lineId: z.lineId, lineType: 'resizeEnd' })
                }}
                title="Drag to resize (end)"
              />
            )}
          </div>
        ))}
      </div>

      {/* Chart Tools Panel (unified) */}
      <ChartToolsPanel
        onMASettingsChange={setMASettings}
        activeTool={activeTool}
        onToolChange={setActiveTool}
        drawnLines={drawnLines}
        onDeleteLine={handleDeleteLine}
        onClearAll={handleClearAllLines}
        onSelectLine={setSelectedLineId}
        onUpdateLine={handleUpdateLine}
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
                  dir="ltr"
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
                  dir="ltr"
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
                  dir="ltr"
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

import { useEffect, useRef } from 'react'
import { createChart, IChartApi, ISeriesApi } from 'lightweight-charts'
import { useGameStore } from '@/stores/gameStore'

export default function TradingChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lastCandleIndexRef = useRef<number>(-1)

  const { gameState } = useGameStore()

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
      },
      rightPriceScale: {
        borderVisible: false,
      },
    })

    // יצירת סדרת נרות
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#00c853',
      downColor: '#ff1744',
      borderUpColor: '#00c853',
      borderDownColor: '#ff1744',
      wickUpColor: '#00c853',
      wickDownColor: '#ff1744',
    })

    chartRef.current = chart
    candlestickSeriesRef.current = candlestickSeries

    // Resize handler
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      console.log('TradingChart: Unmounting chart component')
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  // עדכון נתונים כשיש נרות חדשים
  useEffect(() => {
    if (!candlestickSeriesRef.current || !gameState?.candles) {
      console.log('TradingChart: Missing data', {
        hasSeries: !!candlestickSeriesRef.current,
        hasCandles: !!gameState?.candles
      })
      return
    }

    const currentIndex = gameState.currentIndex
    console.log('TradingChart: Update triggered', { currentIndex, lastIndex: lastCandleIndexRef.current })

    // אם האינדקס לא השתנה, אל תעשה כלום
    if (currentIndex === lastCandleIndexRef.current) {
      console.log('TradingChart: Index unchanged, skipping')
      return
    }

    // אם זה משחק חדש או reset, טען את כל הנתונים הגלויים
    if (currentIndex < lastCandleIndexRef.current || lastCandleIndexRef.current === -1) {
      // מציג את כל הנרות מההתחלה עד האינדקס הנוכחי
      const visibleCandles = gameState.candles.slice(0, currentIndex + 1)
      console.log('TradingChart: Loading all candles', {
        totalCandles: visibleCandles.length,
        firstCandle: visibleCandles[0],
        lastCandle: visibleCandles[visibleCandles.length - 1]
      })

      candlestickSeriesRef.current.setData(visibleCandles)
      lastCandleIndexRef.current = currentIndex

      if (chartRef.current) {
        chartRef.current.timeScale().fitContent()
      }
      return
    }

    // אם זה נר חדש, הוסף אותו בלבד (אנימציה חלקה)
    if (currentIndex > lastCandleIndexRef.current) {
      const newCandle = gameState.candles[currentIndex]
      if (newCandle) {
        candlestickSeriesRef.current.update(newCandle)
        lastCandleIndexRef.current = currentIndex

        // גלילה אוטומטית חלקה לנר החדש
        if (chartRef.current) {
          chartRef.current.timeScale().scrollToPosition(3, true) // true = אנימציה
        }
      }
    }
  }, [gameState?.currentIndex])

  return (
    <div className="flex-1 bg-dark-panel rounded-lg overflow-hidden">
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  )
}

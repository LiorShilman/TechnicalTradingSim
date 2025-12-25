import { useEffect, useRef } from 'react'
import { createChart, IChartApi, ISeriesApi } from 'lightweight-charts'
import { useGameStore } from '@/stores/gameStore'

export default function TradingChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  
  const { gameState } = useGameStore()

  useEffect(() => {
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
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  // עדכון נתונים כשיש נרות חדשים
  useEffect(() => {
    if (!candlestickSeriesRef.current || !gameState?.candles) return

    const visibleCandles = gameState.candles.slice(
      Math.max(0, gameState.currentIndex - gameState.visibleCandles),
      gameState.currentIndex + 1
    )

    candlestickSeriesRef.current.setData(visibleCandles)
    
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent()
    }
  }, [gameState?.candles, gameState?.currentIndex])

  return (
    <div className="flex-1 bg-dark-panel rounded-lg overflow-hidden">
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  )
}

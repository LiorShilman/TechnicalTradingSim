import { useEffect, useRef } from 'react'
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import { useGameStore } from '@/stores/gameStore'
import { TrendingUp } from 'lucide-react'

/**
 * גרף Equity - מציג את שווי החשבון לאורך זמן
 *
 * מאפשר לשחקן לראות את הביצועים שלו בצורה ויזואלית
 */
export default function EquityChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  const { gameState } = useGameStore()

  // יצירת הגרף
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0a0e27' },
        textColor: '#e8eaed',
        fontSize: 13, // הגדלת גודל טקסט
      },
      grid: {
        vertLines: { color: '#1e2436' },
        horzLines: { color: '#1e2436' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 200,
      timeScale: {
        timeVisible: false,
        borderColor: '#2962FF', // גבול כחול לציר הזמן
        borderVisible: true,
      },
      rightPriceScale: {
        borderColor: '#2962FF', // גבול כחול לציר המחיר
        borderVisible: true,
      },
      watermark: {
        visible: false, // הסתרת לוגו TradingView
      },
    })

    const lineSeries = chart.addLineSeries({
      color: '#00c853',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    })

    chartRef.current = chart
    lineSeriesRef.current = lineSeries

    // Resize handler
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  // עדכון נתוני הגרף
  useEffect(() => {
    if (!lineSeriesRef.current || !gameState) return

    // בניית מערך של נקודות Equity
    // כל נר = נקודת equity אחת
    const equityData: { time: Time; value: number }[] = []

    // נתחיל מהיתרה ההתחלתית
    const initialBalance = gameState.account.initialBalance
    equityData.push({
      time: (gameState.candles[0]?.time || 0) as Time,
      value: initialBalance,
    })

    // נעבור על כל נר עד האינדקס הנוכחי
    let currentEquity = initialBalance

    for (let i = 1; i <= gameState.currentIndex; i++) {
      const candle = gameState.candles[i]
      if (!candle) continue

      // נחשב את ה-PnL של כל הפוזיציות שפתוחות בנקודת זמן זו
      let unrealizedPnL = 0
      let totalPositionValue = 0

      // עבור על כל הפוזיציות שנפתחו עד עכשיו
      for (const position of gameState.positions) {
        if (position.entryIndex <= i) {
          // הפוזיציה הזו פתוחה בנקודת זמן זו
          const currentPrice = candle.close
          const priceDiff = currentPrice - position.entryPrice

          let positionPnL = 0
          if (position.type === 'long') {
            positionPnL = priceDiff * position.quantity
          } else {
            positionPnL = -priceDiff * position.quantity
          }

          unrealizedPnL += positionPnL
          totalPositionValue += position.entryPrice * position.quantity
        }
      }

      // עבור על כל הפוזיציות שנסגרו עד עכשיו
      let realizedPnL = 0
      for (const closedPosition of gameState.closedPositions) {
        if (closedPosition.exitIndex && closedPosition.exitIndex <= i) {
          realizedPnL += closedPosition.exitPnL || 0
        }
      }

      // חישוב balance נוכחי (יתרה חופשית)
      const balance = initialBalance + realizedPnL - totalPositionValue

      // Equity = balance + ערך פוזיציות + PnL לא ממומש
      currentEquity = balance + totalPositionValue + unrealizedPnL

      equityData.push({
        time: candle.time as Time,
        value: currentEquity,
      })
    }

    // עדכון הגרף
    lineSeriesRef.current.setData(equityData)

    // התאמת צבע הקו לפי רווחיות
    const isProfit = currentEquity >= initialBalance
    lineSeriesRef.current.applyOptions({
      color: isProfit ? '#00c853' : '#ff1744',
    })

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent()
    }
  }, [gameState?.currentIndex, gameState?.positions, gameState?.closedPositions])

  if (!gameState) return null

  const currentEquity = gameState.account.equity
  const initialBalance = gameState.account.initialBalance
  const totalReturn = ((currentEquity - initialBalance) / initialBalance) * 100
  const isProfit = totalReturn >= 0

  return (
    <div className="bg-dark-panel rounded-lg p-4 border border-dark-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className={isProfit ? 'text-profit' : 'text-loss'} />
          <h3 className="font-semibold">גרף Equity</h3>
        </div>
        <div className={`text-lg font-bold ${isProfit ? 'text-profit' : 'text-loss'}`} dir="ltr">
          {isProfit ? '+' : ''}{totalReturn.toFixed(2)}%
        </div>
      </div>

      <div ref={chartContainerRef} className="w-full" />

      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 border border-blue-600/30 rounded-lg p-3 text-center">
          <div className="text-blue-300 text-xs font-semibold mb-2">התחלה</div>
          <div className="font-mono font-bold text-base text-white" dir="ltr">${initialBalance.toLocaleString()}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-600/30 rounded-lg p-3 text-center">
          <div className="text-purple-300 text-xs font-semibold mb-2">נוכחי</div>
          <div className="font-mono font-bold text-base text-white" dir="ltr">${currentEquity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </div>
        <div className={`bg-gradient-to-br ${isProfit ? 'from-green-900/30 to-green-800/20 border-green-600/30' : 'from-red-900/30 to-red-800/20 border-red-600/30'} border rounded-lg p-3 text-center`}>
          <div className={`${isProfit ? 'text-green-300' : 'text-red-300'} text-xs font-semibold mb-2`}>שינוי</div>
          <div className={`font-mono font-bold text-base ${isProfit ? 'text-green-400' : 'text-red-400'}`} dir="ltr">
            {isProfit ? '+' : ''}${(currentEquity - initialBalance).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  )
}

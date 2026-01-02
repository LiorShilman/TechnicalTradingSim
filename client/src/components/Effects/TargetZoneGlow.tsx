import { useEffect, useState } from 'react'
import { Target } from 'lucide-react'

interface TargetZoneGlowProps {
  position: {
    type: 'long' | 'short'
    entryPrice: number
    currentPrice: number
    takeProfit?: number
  }
}

export default function TargetZoneGlow({ position }: TargetZoneGlowProps) {
  const [isNearTarget, setIsNearTarget] = useState(false)
  const [glowIntensity, setGlowIntensity] = useState(0)

  useEffect(() => {
    if (!position.takeProfit) {
      setIsNearTarget(false)
      return
    }

    const { currentPrice, takeProfit } = position

    // חישוב מרחק מה-TP
    const distanceToTP = Math.abs(currentPrice - takeProfit)
    const percentDistance = (distanceToTP / takeProfit) * 100

    // אם המרחק קטן מ-2% - הצג זוהר
    if (percentDistance < 2) {
      setIsNearTarget(true)
      // עוצמת הזוהר תלויה במרחק (ככל שקרוב יותר = זוהר חזק יותר)
      const intensity = Math.max(0, Math.min(1, 1 - (percentDistance / 2)))
      setGlowIntensity(intensity)
    } else {
      setIsNearTarget(false)
    }
  }, [position.currentPrice, position.takeProfit, position.type])

  if (!isNearTarget || !position.takeProfit) return null

  const distanceToTP = position.takeProfit - position.currentPrice
  const distancePercent = (distanceToTP / position.takeProfit) * 100

  return (
    <div className="fixed inset-0 pointer-events-none z-40 flex items-center justify-center">
      {/* זוהר רקע ירוק פועם */}
      <div
        className="absolute inset-0 bg-gradient-radial from-green-500/20 via-green-500/5 to-transparent animate-pulse"
        style={{
          opacity: glowIntensity * 0.6,
        }}
      />

      {/* טקסט התראה */}
      <div
        className="absolute top-1/3 bg-green-900/80 border-2 border-green-500 rounded-lg px-6 py-3 shadow-2xl"
        style={{
          opacity: glowIntensity,
          animation: 'glow 2s ease-in-out infinite',
        }}
      >
        <div className="flex items-center gap-3">
          <Target size={32} className="text-green-400 animate-ping" />
          <div>
            <div className="text-lg font-bold text-green-400 flex items-center gap-2">
              🎯 קרוב ל-Take Profit!
            </div>
            <div className="text-sm text-text-secondary mt-1">
              מרחק: {Math.abs(distancePercent).toFixed(2)}% | ${Math.abs(distanceToTP).toFixed(2)}
            </div>
            <div className="text-xs text-text-secondary mt-0.5">
              TP: ${position.takeProfit.toFixed(4)}
            </div>
          </div>
        </div>
      </div>

      {/* טבעות זוהר סביב המרכז */}
      <div
        className="absolute w-64 h-64 rounded-full border-4 border-green-500/30 animate-ping"
        style={{
          opacity: glowIntensity * 0.5,
          animationDuration: '3s',
        }}
      />
      <div
        className="absolute w-96 h-96 rounded-full border-2 border-green-500/20 animate-ping"
        style={{
          opacity: glowIntensity * 0.3,
          animationDuration: '4s',
        }}
      />

      <style>{`
        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(34, 197, 94, 0.5);
          }
          50% {
            box-shadow: 0 0 40px rgba(34, 197, 94, 0.8), 0 0 60px rgba(34, 197, 94, 0.6);
          }
        }

        .bg-gradient-radial {
          background: radial-gradient(circle, var(--tw-gradient-stops));
        }
      `}</style>
    </div>
  )
}

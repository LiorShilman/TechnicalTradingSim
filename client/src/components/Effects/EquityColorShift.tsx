import { useEffect, useState } from 'react'

interface EquityColorShiftProps {
  equity: number
  initialBalance: number
}

type PerformanceTier = 'excellent' | 'good' | 'neutral' | 'poor' | 'critical'

export default function EquityColorShift({ equity, initialBalance }: EquityColorShiftProps) {
  const [tier, setTier] = useState<PerformanceTier>('neutral')
  const [opacity, setOpacity] = useState(0.05)

  useEffect(() => {
    const returnPercent = ((equity - initialBalance) / initialBalance) * 100

    let newTier: PerformanceTier = 'neutral'
    let newOpacity = 0.05

    if (returnPercent >= 20) {
      newTier = 'excellent'
      newOpacity = 0.12
    } else if (returnPercent >= 10) {
      newTier = 'good'
      newOpacity = 0.08
    } else if (returnPercent >= -10) {
      newTier = 'neutral'
      newOpacity = 0.05
    } else if (returnPercent >= -20) {
      newTier = 'poor'
      newOpacity = 0.08
    } else {
      newTier = 'critical'
      newOpacity = 0.12
    }

    setTier(newTier)
    setOpacity(newOpacity)
  }, [equity, initialBalance])

  const getGradientColors = (): string => {
    switch (tier) {
      case 'excellent':
        return 'from-green-600 via-green-500 to-emerald-600'
      case 'good':
        return 'from-green-700 via-green-600 to-teal-700'
      case 'neutral':
        return 'from-slate-700 via-slate-600 to-slate-700'
      case 'poor':
        return 'from-orange-700 via-red-600 to-orange-700'
      case 'critical':
        return 'from-red-600 via-red-500 to-rose-600'
    }
  }

  const getPulseAnimation = (): string => {
    if (tier === 'excellent' || tier === 'critical') {
      return 'animate-pulse'
    }
    return ''
  }

  return (
    <>
      {/* רקע גרדיאנט דינמי */}
      <div
        className={`fixed inset-0 pointer-events-none z-0 bg-gradient-to-br ${getGradientColors()} ${getPulseAnimation()} transition-all duration-1000`}
        style={{
          opacity,
        }}
      />

      {/* טבעת זוהר חיצונית (רק במצבים קיצוניים) */}
      {(tier === 'excellent' || tier === 'critical') && (
        <div
          className={`fixed inset-0 pointer-events-none z-0 ${
            tier === 'excellent'
              ? 'bg-gradient-radial from-transparent via-green-500/5 to-green-500/10'
              : 'bg-gradient-radial from-transparent via-red-500/5 to-red-500/10'
          } animate-pulse`}
          style={{
            animationDuration: '3s',
          }}
        />
      )}

      {/* אינדיקטור מצב (פינה שמאלית תחתונה) */}
      <div className="fixed bottom-4 left-4 z-10 pointer-events-none">
        <div
          className={`px-3 py-1.5 rounded-lg border-2 backdrop-blur-sm ${
            tier === 'excellent'
              ? 'bg-green-900/40 border-green-500/50 text-green-400'
              : tier === 'good'
              ? 'bg-green-900/30 border-green-600/40 text-green-500'
              : tier === 'neutral'
              ? 'bg-slate-900/30 border-slate-600/40 text-slate-400'
              : tier === 'poor'
              ? 'bg-orange-900/30 border-orange-600/40 text-orange-500'
              : 'bg-red-900/40 border-red-500/50 text-red-400'
          } transition-all duration-1000`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                tier === 'excellent'
                  ? 'bg-green-400 animate-pulse'
                  : tier === 'good'
                  ? 'bg-green-500'
                  : tier === 'neutral'
                  ? 'bg-slate-400'
                  : tier === 'poor'
                  ? 'bg-orange-500'
                  : 'bg-red-400 animate-pulse'
              }`}
            />
            <span className="text-xs font-semibold">
              {tier === 'excellent'
                ? '🚀 Performance: Excellent'
                : tier === 'good'
                ? '📈 Performance: Good'
                : tier === 'neutral'
                ? '➡️ Performance: Neutral'
                : tier === 'poor'
                ? '📉 Performance: Poor'
                : '⚠️ Performance: Critical'}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        .bg-gradient-radial {
          background: radial-gradient(circle at center, var(--tw-gradient-stops));
        }
      `}</style>
    </>
  )
}

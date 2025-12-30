import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface ProfitTrailProps {
  position: {
    type: 'long' | 'short'
    exitPnL: number
    exitPnLPercent: number
  }
}

interface TrailParticle {
  id: number
  x: number
  y: number
  delay: number
}

export default function ProfitTrail({ position }: ProfitTrailProps) {
  const [particles, setParticles] = useState<TrailParticle[]>([])
  const [isVisible, setIsVisible] = useState(true)

  const isProfit = position.exitPnL > 0

  // יצירת חלקיקים בהופעה
  useEffect(() => {
    const particleCount = 12
    const newParticles: TrailParticle[] = []

    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 200 - 100, // -100 to 100
        y: Math.random() * 150 - 75,  // -75 to 75
        delay: i * 0.08, // מדורג
      })
    }

    setParticles(newParticles)

    // הסתרה אחרי 2 שניות
    const timer = setTimeout(() => setIsVisible(false), 2000)
    return () => clearTimeout(timer)
  }, [])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      {/* מרכז - סכום הרווח/הפסד */}
      <div
        className={`relative animate-bounce ${
          isProfit ? 'text-profit' : 'text-loss'
        }`}
        style={{
          animation: 'bounce 0.6s ease-out, fadeOut 2s ease-out forwards',
        }}
      >
        <div className="flex items-center gap-2">
          {position.type === 'long' ? (
            <TrendingUp size={40} className={isProfit ? 'text-profit' : 'text-loss'} />
          ) : (
            <TrendingDown size={40} className={isProfit ? 'text-profit' : 'text-loss'} />
          )}
          <div className="text-5xl font-bold font-mono">
            {isProfit ? '+' : ''}${position.exitPnL.toFixed(2)}
          </div>
        </div>
        <div className={`text-2xl font-mono text-center mt-1 ${
          isProfit ? 'text-profit' : 'text-loss'
        }`}>
          {isProfit ? '+' : ''}{position.exitPnLPercent.toFixed(2)}%
        </div>
      </div>

      {/* חלקיקים מסביב */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={`absolute w-3 h-3 rounded-full ${
            isProfit ? 'bg-profit' : 'bg-loss'
          }`}
          style={{
            left: '50%',
            top: '50%',
            animation: `trailFloat 1.5s ease-out ${particle.delay}s forwards, fadeOut 1.5s ease-out ${particle.delay}s forwards`,
            '--trail-x': `${particle.x}px`,
            '--trail-y': `${particle.y}px`,
          } as React.CSSProperties}
        />
      ))}

      <style>{`
        @keyframes trailFloat {
          0% {
            transform: translate(-50%, -50%) translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) translate(var(--trail-x), var(--trail-y)) scale(0);
            opacity: 0;
          }
        }

        @keyframes fadeOut {
          0% {
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}

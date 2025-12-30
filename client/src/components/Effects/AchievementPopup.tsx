import { useEffect, useState } from 'react'
import { Trophy, Target, TrendingUp, Award, Zap } from 'lucide-react'

export interface Achievement {
  id: string
  type: 'streak' | 'profit_factor' | 'win_rate' | 'perfect_entry' | 'big_win'
  title: string
  description: string
  icon: 'trophy' | 'target' | 'trending' | 'award' | 'zap'
  color: 'gold' | 'green' | 'blue' | 'purple' | 'orange'
}

interface AchievementPopupProps {
  achievement: Achievement | null
  onDismiss: () => void
}

export default function AchievementPopup({ achievement, onDismiss }: AchievementPopupProps) {
  const [show, setShow] = useState(false)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    if (achievement) {
      setShow(true)
      setTimeout(() => setAnimate(true), 50)

      // הסתרה אוטומטית אחרי 4 שניות
      const timer = setTimeout(() => {
        setAnimate(false)
        setTimeout(() => {
          setShow(false)
          onDismiss()
        }, 300)
      }, 4000)

      return () => clearTimeout(timer)
    }
  }, [achievement, onDismiss])

  if (!show || !achievement) return null

  // מיפוי צבעים
  const colorClasses = {
    gold: 'from-yellow-500/20 to-orange-500/20 border-yellow-400 text-yellow-400',
    green: 'from-green-500/20 to-emerald-500/20 border-green-400 text-green-400',
    blue: 'from-blue-500/20 to-cyan-500/20 border-blue-400 text-blue-400',
    purple: 'from-purple-500/20 to-pink-500/20 border-purple-400 text-purple-400',
    orange: 'from-orange-500/20 to-red-500/20 border-orange-400 text-orange-400',
  }

  // מיפוי אייקונים
  const IconComponent = {
    trophy: Trophy,
    target: Target,
    trending: TrendingUp,
    award: Award,
    zap: Zap,
  }[achievement.icon]

  const colors = colorClasses[achievement.color]

  return (
    <div className="fixed top-[140px] right-4 z-30 pointer-events-auto">
      <div
        className={`bg-gradient-to-br ${colors} border-2 rounded-xl px-6 py-4 shadow-2xl backdrop-blur-md min-w-[280px] max-w-[320px] transform transition-all duration-300 ${
          animate ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0'
        }`}
      >
        <div className="flex items-start gap-3">
          {/* אייקון */}
          <div className="flex-shrink-0 animate-bounce">
            <IconComponent size={32} className={colors.split(' ')[3]} />
          </div>

          {/* תוכן */}
          <div className="flex-1 min-w-0">
            <div className="text-xs text-text-secondary font-semibold mb-1">
              🏆 ACHIEVEMENT UNLOCKED!
            </div>
            <div className={`text-lg font-bold ${colors.split(' ')[3]} mb-1`}>
              {achievement.title}
            </div>
            <div className="text-sm text-text-secondary">{achievement.description}</div>
          </div>

          {/* כפתור סגירה */}
          <button
            onClick={() => {
              setAnimate(false)
              setTimeout(() => {
                setShow(false)
                onDismiss()
              }, 300)
            }}
            className="flex-shrink-0 text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* פס התקדמות אנימציה */}
        <div className="mt-3 h-1 bg-dark-border rounded-full overflow-hidden">
          <div
            className={`h-full ${colors.split(' ')[2].replace('border-', 'bg-')} animate-shrink`}
            style={{ animation: 'shrink 4s linear' }}
          />
        </div>
      </div>

      <style>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        .animate-shrink {
          animation: shrink 4s linear;
        }
      `}</style>
    </div>
  )
}

import { Flame, Snowflake } from 'lucide-react'

interface ComboStreakIndicatorProps {
  currentStreak: number // חיובי = נצחונות, שלילי = הפסדים
}

export default function ComboStreakIndicator({ currentStreak }: ComboStreakIndicatorProps) {
  // אם אין רצף, לא מציגים כלום
  if (currentStreak === 0) return null

  const isWinStreak = currentStreak > 0
  const streakValue = Math.abs(currentStreak)

  // קביעת עוצמת האפקט לפי אורך הרצף
  const isOnFire = streakValue >= 5 // רצף של 5+ = ON FIRE
  const isHot = streakValue >= 3 // רצף של 3+ = HOT

  return (
    <div className="fixed top-[80px] right-4 z-20">
      <div
        className={`relative px-4 py-3 rounded-lg border-2 shadow-xl backdrop-blur-sm transition-all duration-300 ${
          isWinStreak
            ? isOnFire
              ? 'bg-gradient-to-br from-orange-600/30 to-red-600/30 border-orange-400 animate-pulse'
              : isHot
              ? 'bg-gradient-to-br from-yellow-600/30 to-orange-600/30 border-yellow-400'
              : 'bg-gradient-to-br from-green-600/20 to-emerald-600/20 border-green-400'
            : 'bg-gradient-to-br from-blue-900/30 to-gray-900/30 border-blue-400/50'
        }`}
      >
        {/* אפקט זוהר ברקע */}
        {isOnFire && (
          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-orange-400/20 to-red-400/20 animate-pulse" />
        )}

        <div className="relative flex items-center gap-3">
          {/* אייקון */}
          <div className={`${isOnFire ? 'animate-bounce' : ''}`}>
            {isWinStreak ? (
              <Flame
                size={isOnFire ? 32 : 24}
                className={`${
                  isOnFire
                    ? 'text-orange-400'
                    : isHot
                    ? 'text-yellow-400'
                    : 'text-green-400'
                }`}
              />
            ) : (
              <Snowflake size={24} className="text-blue-300" />
            )}
          </div>

          {/* תוכן */}
          <div>
            <div className="text-xs text-text-secondary font-semibold">
              {isWinStreak ? (
                isOnFire ? (
                  <span className="text-orange-400 animate-pulse">🔥 ON FIRE!</span>
                ) : isHot ? (
                  <span className="text-yellow-400">⚡ HOT STREAK</span>
                ) : (
                  'Win Streak'
                )
              ) : (
                'Loss Streak'
              )}
            </div>
            <div
              className={`text-2xl font-bold font-mono ${
                isWinStreak
                  ? isOnFire
                    ? 'text-orange-400'
                    : 'text-green-400'
                  : 'text-blue-300'
              }`}
            >
              {streakValue}
            </div>
          </div>

          {/* אימוג'י מרובה לרצף ארוך */}
          {isOnFire && (
            <div className="flex flex-col gap-0.5 animate-pulse">
              <span className="text-lg">🔥</span>
              <span className="text-lg">🔥</span>
              <span className="text-lg">🔥</span>
            </div>
          )}
        </div>

        {/* טקסט תחתון */}
        {isOnFire && (
          <div className="mt-2 pt-2 border-t border-orange-400/30 text-xs text-center text-orange-300 font-semibold animate-pulse">
            UNSTOPPABLE!
          </div>
        )}
      </div>
    </div>
  )
}

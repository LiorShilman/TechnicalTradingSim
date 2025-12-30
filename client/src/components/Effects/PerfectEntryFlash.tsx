import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

interface PerfectEntryFlashProps {
  entryQuality: number // 0-100
  pnl: number
}

export default function PerfectEntryFlash({ entryQuality, pnl }: PerfectEntryFlashProps) {
  const [show, setShow] = useState(false)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    // הצגת הבזק רק עבור כניסות מצוינות ורווחיות
    if (entryQuality >= 80 && pnl > 0) {
      setShow(true)
      setAnimate(true)

      // הסתרה אחרי האנימציה
      const timer = setTimeout(() => {
        setAnimate(false)
        setTimeout(() => setShow(false), 300)
      }, 1200)

      return () => clearTimeout(timer)
    }
  }, [entryQuality, pnl])

  if (!show) return null

  // קביעת עוצמת האפקט לפי איכות הכניסה
  const isPerfect = entryQuality >= 90
  const isExcellent = entryQuality >= 80

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center">
      {/* רקע עם גרדיאנט זוהר */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${
          animate ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background: isPerfect
            ? 'radial-gradient(circle, rgba(255, 215, 0, 0.15) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(34, 197, 94, 0.1) 0%, transparent 70%)',
        }}
      />

      {/* מעגלים מתרחבים */}
      <div className="relative">
        {isPerfect && (
          <>
            {/* מעגל חיצוני - זהב */}
            <div
              className={`absolute inset-0 rounded-full border-4 border-yellow-400/40 ${
                animate ? 'animate-ping' : ''
              }`}
              style={{ width: '400px', height: '400px', margin: '-200px' }}
            />
            {/* מעגל אמצעי */}
            <div
              className={`absolute inset-0 rounded-full border-4 border-yellow-300/60 ${
                animate ? 'animate-pulse' : ''
              }`}
              style={{ width: '300px', height: '300px', margin: '-150px', animationDelay: '0.1s' }}
            />
          </>
        )}

        {isExcellent && !isPerfect && (
          <>
            {/* מעגל חיצוני - ירוק */}
            <div
              className={`absolute inset-0 rounded-full border-4 border-green-400/40 ${
                animate ? 'animate-ping' : ''
              }`}
              style={{ width: '350px', height: '350px', margin: '-175px' }}
            />
          </>
        )}

        {/* תוכן מרכזי */}
        <div
          className={`relative bg-gradient-to-br ${
            isPerfect
              ? 'from-yellow-500/20 to-orange-500/20 border-yellow-400'
              : 'from-green-500/20 to-emerald-500/20 border-green-400'
          } border-2 rounded-2xl px-8 py-6 backdrop-blur-md shadow-2xl transform transition-all duration-500 ${
            animate ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
          }`}
        >
          {/* אייקון זוהר */}
          <div className="flex items-center justify-center mb-3">
            <Sparkles
              size={48}
              className={`${isPerfect ? 'text-yellow-400' : 'text-green-400'} animate-pulse`}
            />
          </div>

          {/* טקסט */}
          <div className="text-center space-y-2">
            <div
              className={`text-3xl font-bold ${
                isPerfect ? 'text-yellow-400' : 'text-green-400'
              } animate-bounce`}
            >
              {isPerfect ? '⭐ PERFECT ENTRY! ⭐' : '✨ EXCELLENT ENTRY! ✨'}
            </div>
            <div className="text-sm text-text-secondary">
              Entry Quality: {entryQuality.toFixed(0)}/100
            </div>
            <div className={`text-lg font-mono font-bold ${pnl > 0 ? 'text-profit' : ''}`}>
              +${pnl.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import type { Achievement } from '../components/Effects/AchievementPopup'
import type { GameState } from '../types/game.types'

interface GameEffectsState {
  perfectEntryFlash: {
    show: boolean
    entryQuality: number
    pnl: number
  } | null
  achievement: Achievement | null
}

export function useGameEffects(gameState: GameState | null) {
  const [effects, setEffects] = useState<GameEffectsState>({
    perfectEntryFlash: null,
    achievement: null,
  })

  // שמירה על המצב הקודם לזיהוי שינויים
  const prevStatsRef = useRef({
    totalTrades: 0,
    currentStreak: 0,
    profitFactor: 0,
    winRate: 0,
    closedPositionsCount: 0,
  })

  useEffect(() => {
    if (!gameState) return

    const { stats, closedPositions } = gameState
    const prev = prevStatsRef.current

    // 1. בדיקה לסגירת פוזיציה חדשה (Perfect Entry Flash)
    if (closedPositions.length > prev.closedPositionsCount) {
      const lastPosition = closedPositions[closedPositions.length - 1]

      // הצגת הבזק רק עבור עסקאות רווחיות עם כניסה מצוינת
      if (lastPosition.exitPnL && lastPosition.exitPnL > 0) {
        const entryQuality = lastPosition.entryQuality || 0

        if (entryQuality >= 80) {
          setEffects(prev => ({
            ...prev,
            perfectEntryFlash: {
              show: true,
              entryQuality,
              pnl: lastPosition.exitPnL!,
            },
          }))

          // איפוס אחרי 1.5 שניות
          setTimeout(() => {
            setEffects(prev => ({ ...prev, perfectEntryFlash: null }))
          }, 1500)
        }
      }
    }

    // 2. בדיקת הישגים

    // רצף של 3 נצחונות
    if (stats.currentStreak === 3 && prev.currentStreak === 2) {
      setEffects(prev => ({
        ...prev,
        achievement: {
          id: `streak-3-${Date.now()}`,
          type: 'streak',
          title: 'Hot Streak!',
          description: '3 נצחונות ברצף 🔥',
          icon: 'zap',
          color: 'orange',
        },
      }))
    }

    // רצף של 5 נצחונות
    if (stats.currentStreak === 5 && prev.currentStreak === 4) {
      setEffects(prev => ({
        ...prev,
        achievement: {
          id: `streak-5-${Date.now()}`,
          type: 'streak',
          title: 'ON FIRE! 🔥',
          description: '5 נצחונות ברצף - אתה בוער!',
          icon: 'zap',
          color: 'orange',
        },
      }))
    }

    // רצף של 10 נצחונות
    if (stats.currentStreak === 10 && prev.currentStreak === 9) {
      setEffects(prev => ({
        ...prev,
        achievement: {
          id: `streak-10-${Date.now()}`,
          type: 'streak',
          title: 'UNSTOPPABLE! ⚡',
          description: '10 נצחונות ברצף - בלתי ניתן לעצירה!',
          icon: 'trophy',
          color: 'gold',
        },
      }))
    }

    // Profit Factor מעל 2
    if (stats.profitFactor >= 2 && prev.profitFactor < 2 && stats.totalTrades >= 5) {
      setEffects(prev => ({
        ...prev,
        achievement: {
          id: `pf-2-${Date.now()}`,
          type: 'profit_factor',
          title: 'Elite Trader 💎',
          description: `Profit Factor: ${stats.profitFactor.toFixed(2)}`,
          icon: 'trophy',
          color: 'gold',
        },
      }))
    }

    // Profit Factor מעל 3
    if (stats.profitFactor >= 3 && prev.profitFactor < 3 && stats.totalTrades >= 5) {
      setEffects(prev => ({
        ...prev,
        achievement: {
          id: `pf-3-${Date.now()}`,
          type: 'profit_factor',
          title: 'Master Trader 🏆',
          description: `Profit Factor: ${stats.profitFactor.toFixed(2)} - מדהים!`,
          icon: 'trophy',
          color: 'gold',
        },
      }))
    }

    // Win Rate מעל 70%
    if (stats.winRate >= 70 && prev.winRate < 70 && stats.totalTrades >= 5) {
      setEffects(prev => ({
        ...prev,
        achievement: {
          id: `wr-70-${Date.now()}`,
          type: 'win_rate',
          title: 'Sharp Shooter 🎯',
          description: `${stats.winRate.toFixed(1)}% Win Rate`,
          icon: 'target',
          color: 'green',
        },
      }))
    }

    // Win Rate מעל 80%
    if (stats.winRate >= 80 && prev.winRate < 80 && stats.totalTrades >= 5) {
      setEffects(prev => ({
        ...prev,
        achievement: {
          id: `wr-80-${Date.now()}`,
          type: 'win_rate',
          title: 'Sniper Elite 🎯',
          description: `${stats.winRate.toFixed(1)}% Win Rate - מדויק כמו סנייפר!`,
          icon: 'target',
          color: 'gold',
        },
      }))
    }

    // עסקה גדולה (מעל 5% רווח)
    if (closedPositions.length > prev.closedPositionsCount) {
      const lastPosition = closedPositions[closedPositions.length - 1]

      if (lastPosition.exitPnLPercent && lastPosition.exitPnLPercent >= 5) {
        setEffects(prev => ({
          ...prev,
          achievement: {
            id: `big-win-${Date.now()}`,
            type: 'big_win',
            title: 'Big Win! 💰',
            description: `+${lastPosition.exitPnLPercent.toFixed(1)}% רווח במכה אחת!`,
            icon: 'trending',
            color: 'green',
          },
        }))
      }

      // עסקה ענקית (מעל 10% רווח)
      if (lastPosition.exitPnLPercent && lastPosition.exitPnLPercent >= 10) {
        setEffects(prev => ({
          ...prev,
          achievement: {
            id: `huge-win-${Date.now()}`,
            type: 'big_win',
            title: 'JACKPOT! 💎',
            description: `+${lastPosition.exitPnLPercent.toFixed(1)}% רווח - מכה של פעם בחיים!`,
            icon: 'trophy',
            color: 'gold',
          },
        }))
      }
    }

    // עדכון מצב קודם
    prevStatsRef.current = {
      totalTrades: stats.totalTrades,
      currentStreak: stats.currentStreak,
      profitFactor: stats.profitFactor,
      winRate: stats.winRate,
      closedPositionsCount: closedPositions.length,
    }
  }, [gameState])

  const dismissAchievement = () => {
    setEffects(prev => ({ ...prev, achievement: null }))
  }

  return {
    perfectEntryFlash: effects.perfectEntryFlash,
    achievement: effects.achievement,
    dismissAchievement,
  }
}

import { useState, useEffect, useRef } from 'react'
import type { GameState } from '../types/game.types'

interface VisualEffectsState {
  profitTrail: {
    position: {
      type: 'long' | 'short'
      exitPnL: number
      exitPnLPercent: number
    }
  } | null
}

export function useVisualEffects(gameState: GameState | null) {
  const [effects, setEffects] = useState<VisualEffectsState>({
    profitTrail: null,
  })

  // שמירה על מספר הפוזיציות הסגורות
  const prevClosedCountRef = useRef(0)

  useEffect(() => {
    if (!gameState) return

    const { closedPositions } = gameState

    // 1. בדיקה לסגירת פוזיציה חדשה (Profit Trail)
    if (closedPositions.length > prevClosedCountRef.current) {
      const lastPosition = closedPositions[closedPositions.length - 1]

      // הצגת אנימציה עבור כל עסקה סגורה (רווח או הפסד)
      if (lastPosition.exitPnL !== undefined) {
        setEffects(prev => ({
          ...prev,
          profitTrail: {
            position: {
              type: lastPosition.type,
              exitPnL: lastPosition.exitPnL!,
              exitPnLPercent: lastPosition.exitPnLPercent || 0,
            },
          },
        }))

        // איפוס אחרי 2 שניות
        setTimeout(() => {
          setEffects(prev => ({ ...prev, profitTrail: null }))
        }, 2000)
      }
    }

    // עדכון מספר פוזיציות סגורות
    prevClosedCountRef.current = closedPositions.length
  }, [gameState])

  const dismissProfitTrail = () => {
    setEffects(prev => ({ ...prev, profitTrail: null }))
  }

  return {
    profitTrail: effects.profitTrail,
    dismissProfitTrail,
  }
}

import { memo } from 'react'

interface RiskRewardDisplayProps {
  riskRewardRatio: number
}

/**
 * R:R Display - memoized to prevent unnecessary re-renders
 * Only re-renders when the ratio ACTUALLY changes (not on every candle)
 */
const RiskRewardDisplay = memo(({ riskRewardRatio }: RiskRewardDisplayProps) => {
  if (riskRewardRatio <= 0) return null

  return (
    <div className="bg-dark-panel rounded p-2 border-l-2 border-l-blue-500">
      <div className="text-xs text-text-secondary">📊 יחס רווח/הפסד (R:R)</div>
      <div className={`text-lg font-bold font-mono ${riskRewardRatio >= 2 ? 'text-profit' : riskRewardRatio >= 1 ? 'text-yellow-400' : 'text-loss'}`}>
        1:{riskRewardRatio.toFixed(2)}
      </div>
      <div className="text-xs text-text-secondary mt-1">
        {riskRewardRatio >= 2 ? '✅ יחס מצוין!' : riskRewardRatio >= 1 ? '⚠️ יחס סביר' : '❌ יחס נמוך'}
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Only re-render if ratio changes by more than 0.01
  return Math.abs(prevProps.riskRewardRatio - nextProps.riskRewardRatio) < 0.01
})

RiskRewardDisplay.displayName = 'RiskRewardDisplay'

export default RiskRewardDisplay

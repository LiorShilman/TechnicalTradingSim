import { Trophy, TrendingUp, Target, Award } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'

export default function GameStats() {
  const { gameState, resetGame } = useGameStore()

  if (!gameState?.isComplete) return null

  const { stats, account } = gameState
  const totalReturn = ((account.equity - account.initialBalance) / account.initialBalance) * 100
  const isWinner = totalReturn > 0

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-panel rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-dark-border text-center">
          <Trophy size={64} className={`mx-auto mb-4 ${isWinner ? 'text-yellow-400' : 'text-text-secondary'}`} />
          <h2 className="text-3xl font-bold mb-2">
            {isWinner ? '🎉 משחק מצוין!' : '📊 סיום משחק'}
          </h2>
          <div className={`text-4xl font-mono font-bold ${isWinner ? 'text-profit' : 'text-loss'}`}>
            {isWinner ? '+' : ''}{totalReturn.toFixed(2)}%
          </div>
          <div className="text-text-secondary mt-1">
            ${account.equity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Stats */}
        <div className="p-6 space-y-6">
          {/* Trading Performance */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={20} className="text-blue-400" />
              <h3 className="font-semibold">ביצועי מסחר</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                label="סה״כ עסקאות"
                value={stats.totalTrades}
              />
              <StatCard
                label="שיעור הצלחה"
                value={`${stats.winRate.toFixed(1)}%`}
                color={stats.winRate >= 50 ? 'profit' : 'loss'}
              />
              <StatCard
                label="עסקאות מנצחות"
                value={stats.winningTrades}
                color="profit"
              />
              <StatCard
                label="עסקאות מפסידות"
                value={stats.losingTrades}
                color="loss"
              />
              <StatCard
                label="ממוצע רווח"
                value={`$${stats.averageWin.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                color="profit"
              />
              <StatCard
                label="ממוצע הפסד"
                value={`$${Math.abs(stats.averageLoss).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                color="loss"
              />
            </div>
          </div>

          {/* Risk Metrics */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target size={20} className="text-purple-400" />
              <h3 className="font-semibold">מדדי סיכון</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                label="Profit Factor"
                value={stats.profitFactor.toFixed(2)}
                color={stats.profitFactor > 1 ? 'profit' : 'loss'}
              />
              <StatCard
                label="Max Drawdown"
                value={`${stats.maxDrawdownPercent.toFixed(1)}%`}
                color="loss"
              />
            </div>
          </div>

          {/* Pattern Recognition */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Award size={20} className="text-yellow-400" />
              <h3 className="font-semibold">זיהוי תבניות</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                label="ציון זיהוי תבניות"
                value={`${stats.patternRecognitionScore.toFixed(0)}/100`}
                color={stats.patternRecognitionScore >= 70 ? 'profit' : 'loss'}
              />
              <StatCard
                label="איכות כניסות ממוצעת"
                value={`${stats.averageEntryQuality.toFixed(0)}/100`}
                color={stats.averageEntryQuality >= 70 ? 'profit' : 'loss'}
              />
            </div>
          </div>

          {/* Best/Worst Trade */}
          {stats.bestTrade && (
            <div>
              <h3 className="font-semibold mb-3">עסקה הטובה ביותר</h3>
              <div className="bg-dark-bg rounded-lg p-4 border-r-4 border-profit">
                <div className="text-profit text-2xl font-mono font-bold">
                  +${stats.bestTrade.pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-text-secondary mt-1">
                  {stats.bestTrade.patternType} | +{stats.bestTrade.pnlPercent.toFixed(2)}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action */}
        <div className="p-6 border-t border-dark-border">
          <button
            onClick={resetGame}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all"
          >
            שחק שוב
          </button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: 'profit' | 'loss' }) {
  return (
    <div className="bg-dark-bg rounded-lg p-3">
      <div className="text-xs text-text-secondary mb-1">{label}</div>
      <div className={`text-xl font-mono font-bold ${
        color === 'profit' ? 'text-profit' : color === 'loss' ? 'text-loss' : 'text-text-primary'
      }`}>
        {value}
      </div>
    </div>
  )
}

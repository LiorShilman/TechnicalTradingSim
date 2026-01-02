import { Trophy, TrendingUp, Target, Award, BookOpen } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import { getJournalStats } from '@/utils/journalAnalysis'

export default function GameStats() {
  const { gameState, showStats, resetGame } = useGameStore()

  // הצג את הסטטיסטיקות אם המשחק הסתיים או אם המשתמש ביקש (שמור ויציאה)
  if (!gameState?.isComplete && !showStats) return null
  if (!gameState) return null

  const { stats, account } = gameState
  const totalReturn = ((account.equity - account.initialBalance) / account.initialBalance) * 100
  const isWinner = totalReturn > 0

  // חישוב סטטיסטיקות יומן מסחר
  const journalStats = getJournalStats(gameState.closedPositions)

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-panel rounded-xl max-w-6xl w-full max-h-[85vh] overflow-y-auto">
        {/* Compact Header with horizontal layout */}
        <div className="px-8 py-4 border-b border-dark-border flex items-center justify-between gap-8">
          <div className="flex items-center gap-4">
            <Trophy size={48} className={`${isWinner ? 'text-yellow-400' : 'text-text-secondary'}`} />
            <div className="text-right">
              <h2 className="text-2xl font-bold mb-1">
                {isWinner ? '🎉 משחק מצוין!' : '📊 סיום משחק'}
              </h2>
              <div className="text-sm text-text-secondary">
                יתרה סופית: <span className="font-mono font-bold text-text-primary" dir="ltr">${account.equity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
          <div className="text-left">
            <div className="text-xs text-text-secondary mb-1">תשואה כוללת</div>
            <div className={`text-5xl font-mono font-bold ${isWinner ? 'text-profit' : 'text-loss'}`} dir="ltr">
              {isWinner ? '+' : ''}{totalReturn.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Stats - Wide Grid Layout */}
        <div className="p-6">
          {/* Main stats grid - 3 columns */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            {/* Trading Performance */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={18} className="text-blue-400" />
                <h3 className="font-semibold text-sm">ביצועי מסחר</h3>
              </div>
              <StatCard label="סה״כ עסקאות" value={stats.totalTrades} />
              <StatCard
                label="שיעור הצלחה"
                value={`${stats.winRate.toFixed(1)}%`}
                color={stats.winRate >= 50 ? 'profit' : 'loss'}
              />
              <StatCard label="עסקאות מנצחות" value={stats.winningTrades} color="profit" />
              <StatCard label="עסקאות מפסידות" value={stats.losingTrades} color="loss" />
            </div>

            {/* Risk & Performance Metrics */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <Target size={18} className="text-purple-400" />
                <h3 className="font-semibold text-sm">מדדי סיכון</h3>
              </div>
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

            {/* Advanced Stats & Streaks */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <Award size={18} className="text-green-400" />
                <h3 className="font-semibold text-sm">מדדים מתקדמים</h3>
              </div>
              <StatCard
                label="Sharpe Ratio"
                value={stats.sharpeRatio.toFixed(2)}
                color={stats.sharpeRatio > 1 ? 'profit' : stats.sharpeRatio > 0 ? undefined : 'loss'}
              />
              <StatCard
                label="Sortino Ratio"
                value={stats.sortinoRatio.toFixed(2)}
                color={stats.sortinoRatio > 1 ? 'profit' : stats.sortinoRatio > 0 ? undefined : 'loss'}
              />
              <StatCard
                label="Calmar Ratio"
                value={stats.calmarRatio.toFixed(2)}
                color={stats.calmarRatio > 0 ? 'profit' : 'loss'}
              />
            </div>
          </div>

          {/* Secondary row - 3 equal columns */}
          <div className="grid grid-cols-3 gap-6">
            {/* Trade Journal Stats */}
            <div className="bg-dark-bg rounded-lg p-4 border border-dark-border">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={16} className="text-purple-400" />
                <h3 className="font-semibold text-sm">יומן מסחר</h3>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-text-secondary">דיוק תחזיות</div>
                  <div className={`text-2xl font-mono font-bold ${journalStats.reflectionAccuracy >= 60 ? 'text-profit' : journalStats.reflectionAccuracy >= 40 ? 'text-yellow-400' : 'text-loss'}`} dir="ltr">
                    {journalStats.reflectionAccuracy.toFixed(0)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-text-secondary">עסקאות מתועדות</div>
                  <div className="text-lg font-mono font-bold text-text-primary" dir="ltr">
                    {journalStats.totalNotes}/{stats.totalTrades}
                  </div>
                </div>
                {journalStats.totalNotes > 0 && (
                  <div>
                    <div className="text-xs text-text-secondary">ממוצע ביטחון</div>
                    <div className="text-sm font-mono text-yellow-400" dir="ltr">
                      {'⭐'.repeat(Math.round(journalStats.averageConfidence))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Best Trade */}
            {stats.bestTrade && (
              <div className="bg-dark-bg rounded-lg p-4 border-r-4 border-profit">
                <h3 className="font-semibold text-sm mb-3">עסקה הטובה ביותר</h3>
                <div className="text-profit text-3xl font-mono font-bold" dir="ltr">
                  +${stats.bestTrade.pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-text-secondary mt-1" dir="ltr">
                  {stats.bestTrade.patternType} | +{stats.bestTrade.pnlPercent.toFixed(2)}%
                </div>
              </div>
            )}

            {/* Current Streak or Win/Loss Streaks */}
            {stats.currentStreak !== 0 ? (
              <div className={`rounded-lg p-4 border-2 ${
                stats.currentStreak > 0
                  ? 'bg-profit/10 border-profit/40'
                  : 'bg-loss/10 border-loss/40'
              }`}>
                <div className="text-center">
                  <div className="text-xs text-text-secondary mb-2">רצף נוכחי</div>
                  <div className={`text-4xl font-bold ${stats.currentStreak > 0 ? 'text-profit' : 'text-loss'}`}>
                    {stats.currentStreak > 0 ? '🔥' : '❄️'} {Math.abs(stats.currentStreak)}
                  </div>
                  <div className="text-sm text-text-secondary mt-1">
                    {stats.currentStreak > 0 ? 'נצחונות ברצף' : 'הפסדים ברצף'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-dark-bg rounded-lg p-4 border border-dark-border">
                <h3 className="font-semibold text-sm mb-3">רצפים</h3>
                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-text-secondary">מקס׳ נצחונות</div>
                    <div className={`text-2xl font-bold ${stats.maxWinStreak >= 3 ? 'text-profit' : 'text-text-primary'}`}>
                      🔥 {stats.maxWinStreak}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-text-secondary">מקס׳ הפסדים</div>
                    <div className={`text-2xl font-bold ${stats.maxLossStreak >= 3 ? 'text-loss' : 'text-text-primary'}`}>
                      ❄️ {stats.maxLossStreak}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Info note */}
          <div className="mt-4 text-xs text-text-secondary bg-dark-bg rounded p-2 text-center">
            📊 Sharpe & Sortino: {'>'}1 = טוב, {'>'}2 = מצוין | Calmar: ככל שגבוה יותר = טוב יותר
          </div>
        </div>

        {/* Action - Compact buttons */}
        <div className="px-8 py-4 border-t border-dark-border flex justify-center">
          {showStats && !gameState.isComplete ? (
            // אם המשתמש שמר ויצא (אבל המשחק לא הסתיים) - הצע לחזור או להתחיל משחק חדש
            <div className="flex gap-4">
              <button
                onClick={() => useGameStore.setState({ showStats: false })}
                className="px-8 py-2.5 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-all text-sm"
              >
                המשך לשחק
              </button>
              <button
                onClick={resetGame}
                className="px-8 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all text-sm"
              >
                שחק שוב
              </button>
            </div>
          ) : (
            // אם המשחק הסתיים - רק כפתור "שחק שוב"
            <button
              onClick={resetGame}
              className="px-12 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all text-sm"
            >
              שחק שוב
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: 'profit' | 'loss' }) {
  return (
    <div className="bg-dark-bg rounded-lg p-2.5">
      <div className="text-xs text-text-secondary mb-0.5">{label}</div>
      <div className={`text-lg font-mono font-bold ${
        color === 'profit' ? 'text-profit' : color === 'loss' ? 'text-loss' : 'text-text-primary'
      }`} dir="ltr">
        {value}
      </div>
    </div>
  )
}

import { Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'

export default function AccountInfo() {
  const { gameState } = useGameStore()

  if (!gameState || !gameState.account) return null

  const { account } = gameState
  // הרווח הכולל = Equity - יתרה התחלתית (כולל פוזיציות פתוחות)
  const totalPnL = account.equity - account.initialBalance
  const totalPnLPercent = (totalPnL / account.initialBalance) * 100
  const isProfitable = totalPnL >= 0

  return (
    <div className="p-4 border-b border-dark-border">
      <div className="flex items-center gap-2 mb-4">
        <Wallet size={20} className="text-blue-400" />
        <h3 className="font-semibold">חשבון</h3>
      </div>

      {/* Total Balance - הסכום הכולל */}
      <div className="bg-gradient-to-br from-green-900/30 to-blue-900/30 rounded-lg px-2 py-3 mb-3 border-2 border-green-500/40">
        <div className="text-xs text-text-secondary mb-1 flex justify-between items-center px-2">
          <span className="font-bold">💰 סה"כ ערך חשבון (כולל פוזיציות)</span>
          <span className="text-xs bg-green-500/30 px-2 py-0.5 rounded font-semibold animate-pulse">LIVE</span>
        </div>
        <div className="w-full overflow-x-auto px-2">
          <div className="text-2xl font-mono font-bold transition-all duration-300 text-green-400 text-right whitespace-nowrap" dir="ltr">
            ${account.equity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-green-500/20 space-y-1 px-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-text-secondary">יתרה התחלתית:</span>
            <span className="font-mono text-gray-400" dir="ltr">${account.initialBalance.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-text-secondary">רווח/הפסד כולל:</span>
            <div className={`flex items-center gap-1 ${isProfitable ? 'text-profit' : 'text-loss'}`}>
              {isProfitable ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span className="text-base font-bold font-mono" dir="ltr">
                {isProfitable ? '+' : ''}${totalPnL.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-mono" dir="ltr">
                ({isProfitable ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
        <div className="bg-dark-bg rounded-lg p-3">
          <div className="text-xs text-text-secondary mb-1">יתרה חופשית (Balance)</div>
          <div className="font-mono font-semibold transition-all duration-300" dir="ltr">
            ${account.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="bg-dark-bg rounded-lg p-3 border-l-2 border-l-blue-500">
          <div className="text-xs text-text-secondary mb-1 flex items-center gap-1">
            <span>רווח/הפסד פתוח</span>
            <span className="text-[10px] bg-blue-500/20 px-1 rounded">Live</span>
          </div>
          <div className={`font-mono font-semibold transition-all duration-300 ${account.unrealizedPnL >= 0 ? 'text-profit' : 'text-loss'}`} dir="ltr">
            {account.unrealizedPnL >= 0 ? '+' : ''}${account.unrealizedPnL.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Drawdown Warning */}
      {gameState.stats && gameState.stats.maxDrawdownPercent > 0 && (
        <div className={`rounded-lg p-3 text-xs ${
          gameState.stats.maxDrawdownPercent >= 20
            ? 'bg-loss/20 border border-loss/40'
            : gameState.stats.maxDrawdownPercent >= 10
            ? 'bg-yellow-500/20 border border-yellow-500/40'
            : 'bg-dark-bg border border-dark-border'
        }`}>
          <div className="flex justify-between items-center mb-1">
            <span className="text-text-secondary">📉 Drawdown מקסימלי:</span>
            <span className={`font-mono font-bold ${
              gameState.stats.maxDrawdownPercent >= 20
                ? 'text-loss'
                : gameState.stats.maxDrawdownPercent >= 10
                ? 'text-yellow-400'
                : 'text-text-primary'
            }`} dir="ltr">
              {gameState.stats.maxDrawdownPercent.toFixed(2)}%
            </span>
          </div>
          <div className="text-[10px] text-text-secondary" dir="ltr">
            (${gameState.stats.maxDrawdown.toLocaleString(undefined, { maximumFractionDigits: 2 })})
          </div>
          {gameState.stats.maxDrawdownPercent >= 20 && (
            <div className="mt-1 text-loss flex items-center gap-1">
              <span>⚠️</span>
              <span>Drawdown גבוה! שקול ניהול סיכון</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

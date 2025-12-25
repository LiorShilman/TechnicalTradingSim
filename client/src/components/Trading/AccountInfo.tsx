import { Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'

export default function AccountInfo() {
  const { gameState } = useGameStore()

  if (!gameState || !gameState.account) return null

  const { account } = gameState
  const totalPnL = account.realizedPnL + account.unrealizedPnL
  const totalPnLPercent = ((account.equity - account.initialBalance) / account.initialBalance) * 100
  const isProfitable = totalPnL >= 0

  return (
    <div className="p-4 border-b border-dark-border">
      <div className="flex items-center gap-2 mb-4">
        <Wallet size={20} className="text-blue-400" />
        <h3 className="font-semibold">חשבון</h3>
      </div>

      {/* Total Balance - הסכום הכולל */}
      <div className="bg-gradient-to-br from-green-900/30 to-blue-900/30 rounded-lg p-4 mb-3 border-2 border-green-500/40">
        <div className="text-xs text-text-secondary mb-1 flex justify-between items-center">
          <span className="font-bold">💰 סה"כ ערך חשבון (כולל פוזיציות)</span>
          <span className="text-xs bg-green-500/30 px-2 py-0.5 rounded font-semibold animate-pulse">LIVE</span>
        </div>
        <div className="text-4xl font-mono font-bold transition-all duration-300 text-green-400">
          ${account.equity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
        <div className="mt-2 pt-2 border-t border-green-500/20">
          <div className="text-xs text-text-secondary mb-1">רווח/הפסד כולל מתחילת המשחק:</div>
          <div className={`flex items-center gap-1 ${isProfitable ? 'text-profit' : 'text-loss'}`}>
            {isProfitable ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            <span className="text-lg font-bold">
              {isProfitable ? '+' : ''}${totalPnL.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
            <span className="text-sm">
              ({isProfitable ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-dark-bg rounded-lg p-3">
          <div className="text-xs text-text-secondary mb-1">יתרה חופשית (Balance)</div>
          <div className="font-mono font-semibold transition-all duration-300">
            ${account.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="bg-dark-bg rounded-lg p-3 border-l-2 border-l-blue-500">
          <div className="text-xs text-text-secondary mb-1 flex items-center gap-1">
            <span>רווח/הפסד פתוח</span>
            <span className="text-[10px] bg-blue-500/20 px-1 rounded">Live</span>
          </div>
          <div className={`font-mono font-semibold transition-all duration-300 ${account.unrealizedPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
            {account.unrealizedPnL >= 0 ? '+' : ''}${account.unrealizedPnL.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  )
}

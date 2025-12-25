import { Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'

export default function AccountInfo() {
  const { gameState } = useGameStore()

  if (!gameState) return null

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

      {/* Equity */}
      <div className="bg-dark-bg rounded-lg p-4 mb-3">
        <div className="text-xs text-text-secondary mb-1">סך הכל</div>
        <div className="text-3xl font-mono font-bold">
          ${account.equity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
        <div className={`flex items-center gap-1 mt-1 ${isProfitable ? 'text-profit' : 'text-loss'}`}>
          {isProfitable ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          <span className="text-sm font-medium">
            {isProfitable ? '+' : ''}${totalPnL.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
          <span className="text-xs">
            ({isProfitable ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-dark-bg rounded-lg p-3">
          <div className="text-xs text-text-secondary mb-1">יתרה חופשית</div>
          <div className="font-mono font-semibold">
            ${account.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        
        <div className="bg-dark-bg rounded-lg p-3">
          <div className="text-xs text-text-secondary mb-1">רווח/הפסד לא ממומש</div>
          <div className={`font-mono font-semibold ${account.unrealizedPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
            {account.unrealizedPnL >= 0 ? '+' : ''}${account.unrealizedPnL.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  )
}

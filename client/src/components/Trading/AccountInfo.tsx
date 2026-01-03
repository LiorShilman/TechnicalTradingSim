import { Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import { memo } from 'react'

// קומפוננטה ממוזערת לערך החשבון הכולל (Equity)
const TotalEquityDisplay = memo(() => {
  const account = useGameStore(state => state.gameState?.account)

  if (!account) return null

  const totalPnL = account.equity - account.initialBalance
  const totalPnLPercent = (totalPnL / account.initialBalance) * 100
  const isProfitable = totalPnL >= 0

  return (
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
  )
})
TotalEquityDisplay.displayName = 'TotalEquityDisplay'

// קומפוננטה ממוזערת לפרטי חשבון (Balance ו-Unrealized PnL)
const AccountDetails = memo(() => {
  const account = useGameStore(state => state.gameState?.account)

  if (!account) return null

  return (
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
  )
})
AccountDetails.displayName = 'AccountDetails'

// קומפוננטה ממוזערת לאזהרת Drawdown
const DrawdownWarning = memo(() => {
  const stats = useGameStore(state => state.gameState?.stats)

  if (!stats || stats.maxDrawdownPercent <= 0) return null

  return (
    <div className={`rounded-lg p-3 text-xs ${
      stats.maxDrawdownPercent >= 20
        ? 'bg-loss/20 border border-loss/40'
        : stats.maxDrawdownPercent >= 10
        ? 'bg-yellow-500/20 border border-yellow-500/40'
        : 'bg-dark-bg border border-dark-border'
    }`}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-text-secondary">📉 Drawdown מקסימלי:</span>
        <span className={`font-mono font-bold ${
          stats.maxDrawdownPercent >= 20
            ? 'text-loss'
            : stats.maxDrawdownPercent >= 10
            ? 'text-yellow-400'
            : 'text-text-primary'
        }`} dir="ltr">
          {stats.maxDrawdownPercent.toFixed(2)}%
        </span>
      </div>
      <div className="text-[10px] text-text-secondary" dir="ltr">
        (${stats.maxDrawdown.toLocaleString(undefined, { maximumFractionDigits: 2 })})
      </div>
      {stats.maxDrawdownPercent >= 20 && (
        <div className="mt-1 text-loss flex items-center gap-1">
          <span>⚠️</span>
          <span>Drawdown גבוה! שקול ניהול סיכון</span>
        </div>
      )}
    </div>
  )
})
DrawdownWarning.displayName = 'DrawdownWarning'

export default function AccountInfo() {
  const gameState = useGameStore(state => state.gameState)

  if (!gameState || !gameState.account) return null

  return (
    <div className="p-4 border-2 border-purple-500/30 rounded-lg bg-dark-panel/20 mb-4 mx-4">
      <div className="flex items-center gap-2 mb-4">
        <Wallet size={20} className="text-purple-400" />
        <h3 className="font-semibold">חשבון</h3>
      </div>

      <TotalEquityDisplay />
      <AccountDetails />
      <DrawdownWarning />
    </div>
  )
}

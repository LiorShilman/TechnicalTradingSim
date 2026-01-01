import { X, TrendingUp, TrendingDown, Calendar, DollarSign, Percent, Clock } from 'lucide-react'
import type { Position } from '@/types/game.types'

interface TradeHistoryProps {
  closedPositions: Position[]
  sourceFileName: string
  sourceDateRange: string
  assetSymbol: string
  onClose: () => void
}

export default function TradeHistory({
  closedPositions,
  sourceFileName,
  sourceDateRange,
  assetSymbol,
  onClose,
}: TradeHistoryProps) {
  // Group trades by date
  const groupedTrades = closedPositions.reduce((groups, position) => {
    if (!position.exitTime) return groups

    const date = new Date(position.exitTime * 1000).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(position)
    return groups
  }, {} as Record<string, Position[]>)

  // Calculate totals
  const totalTrades = closedPositions.length
  const winningTrades = closedPositions.filter(p => (p.exitPnL || 0) > 0).length
  const losingTrades = closedPositions.filter(p => (p.exitPnL || 0) <= 0).length
  const totalPnL = closedPositions.reduce((sum, p) => sum + (p.exitPnL || 0), 0)
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0

  return (
    <>
      {/* Background overlay */}
      <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="fixed z-[110] bg-gradient-to-br from-dark-panel via-dark-bg to-dark-panel border-2 border-blue-500/30 rounded-xl shadow-2xl overflow-hidden"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: '1200px',
          height: '85vh',
          maxHeight: '800px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-purple-700 px-6 py-4 border-b-2 border-blue-400/30">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Calendar className="w-6 h-6" />
                היסטוריית עסקאות
              </h2>
              <div className="text-sm text-blue-100 mt-1 flex items-center gap-4">
                <span>📁 {sourceFileName}</span>
                <span>📅 {sourceDateRange}</span>
                <span>💎 {assetSymbol}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-red-400 transition-colors p-2 hover:bg-white/10 rounded-lg"
            >
              <X size={24} />
            </button>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-5 gap-3 mt-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20">
              <div className="text-xs text-blue-200">סך עסקאות</div>
              <div className="text-lg font-bold text-white">{totalTrades}</div>
            </div>
            <div className="bg-green-500/20 backdrop-blur-sm rounded-lg px-3 py-2 border border-green-400/30">
              <div className="text-xs text-green-200">מנצחות</div>
              <div className="text-lg font-bold text-green-400">{winningTrades}</div>
            </div>
            <div className="bg-red-500/20 backdrop-blur-sm rounded-lg px-3 py-2 border border-red-400/30">
              <div className="text-xs text-red-200">מפסידות</div>
              <div className="text-lg font-bold text-red-400">{losingTrades}</div>
            </div>
            <div className="bg-yellow-500/20 backdrop-blur-sm rounded-lg px-3 py-2 border border-yellow-400/30">
              <div className="text-xs text-yellow-200">אחוז ניצחון</div>
              <div className="text-lg font-bold text-yellow-400">{winRate.toFixed(1)}%</div>
            </div>
            <div className={`backdrop-blur-sm rounded-lg px-3 py-2 border ${totalPnL >= 0 ? 'bg-green-500/20 border-green-400/30' : 'bg-red-500/20 border-red-400/30'}`}>
              <div className={`text-xs ${totalPnL >= 0 ? 'text-green-200' : 'text-red-200'}`}>רווח/הפסד כולל</div>
              <div className={`text-lg font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`} dir="ltr">
                {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)}$
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto h-[calc(100%-240px)] px-6 py-4 pb-20">
          {Object.keys(groupedTrades).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-secondary">
              <Calendar className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">אין עסקאות להצגה</p>
              <p className="text-sm mt-2">פתח עסקאות וסגור אותן כדי לראות כאן את ההיסטוריה</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedTrades).map(([date, trades]) => (
                <div key={date} className="space-y-3">
                  {/* Date Header */}
                  <div className="flex items-center gap-2 text-blue-400 font-bold sticky top-0 bg-dark-bg/90 backdrop-blur-sm py-2 z-10 border-b border-blue-500/30">
                    <Calendar className="w-4 h-4" />
                    <span>{date}</span>
                    <span className="text-xs text-text-secondary">({trades.length} עסקאות)</span>
                  </div>

                  {/* Trades for this date */}
                  <div className="space-y-2">
                    {trades.map((position, idx) => {
                      const isProfit = (position.exitPnL || 0) > 0
                      const pnl = position.exitPnL || 0
                      const pnlPercent = position.exitPnLPercent || 0

                      return (
                        <div
                          key={idx}
                          className={`bg-dark-panel border-2 rounded-lg p-4 hover:shadow-lg transition-all ${
                            isProfit
                              ? 'border-green-500/30 hover:border-green-500/50'
                              : 'border-red-500/30 hover:border-red-500/50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            {/* Left: Position Info */}
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                {/* Position Type Badge */}
                                {position.type === 'long' ? (
                                  <div className="flex items-center gap-1.5 bg-green-500/20 border border-green-500/40 rounded-lg px-3 py-1">
                                    <TrendingUp className="w-4 h-4 text-green-400" />
                                    <span className="text-sm font-bold text-green-400">LONG</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/40 rounded-lg px-3 py-1">
                                    <TrendingDown className="w-4 h-4 text-red-400" />
                                    <span className="text-sm font-bold text-red-400">SHORT</span>
                                  </div>
                                )}

                                {/* Exit Reason Badge */}
                                {position.exitReason && (
                                  <div className={`text-xs px-2 py-1 rounded ${
                                    position.exitReason === 'stop_loss'
                                      ? 'bg-red-900/30 text-red-400 border border-red-500/30'
                                      : position.exitReason === 'take_profit'
                                      ? 'bg-green-900/30 text-green-400 border border-green-500/30'
                                      : 'bg-blue-900/30 text-blue-400 border border-blue-500/30'
                                  }`}>
                                    {position.exitReason === 'stop_loss' && '🛑 Stop Loss'}
                                    {position.exitReason === 'take_profit' && '🎯 Take Profit'}
                                    {position.exitReason === 'manual' && '✋ סגירה ידנית'}
                                  </div>
                                )}

                                {/* Quantity */}
                                <div className="text-xs text-text-secondary" dir="ltr">
                                  {position.quantity.toFixed(4)} {assetSymbol}
                                </div>
                              </div>

                              {/* Entry/Exit Prices and Times */}
                              <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                                <div>
                                  <div className="text-xs text-text-secondary mb-1">מחיר כניסה</div>
                                  <div className="font-mono font-bold text-blue-400" dir="ltr">
                                    ${position.entryPrice.toFixed(4)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-text-secondary mb-1">מחיר יציאה</div>
                                  <div className="font-mono font-bold text-purple-400" dir="ltr">
                                    ${(position.exitPrice || 0).toFixed(4)}
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                  <div className="text-text-secondary mb-1">שעת סגירה</div>
                                  <div className="font-mono text-text-primary flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {position.exitTime
                                      ? new Date(position.exitTime * 1000).toLocaleTimeString('he-IL', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          second: '2-digit',
                                        })
                                      : 'N/A'}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-text-secondary mb-1">זמן החזקה</div>
                                  <div className="font-mono text-text-primary">
                                    {position.exitTime && position.entryTime
                                      ? (() => {
                                          const diffSeconds = position.exitTime - position.entryTime
                                          const hours = Math.floor(diffSeconds / 3600)
                                          const minutes = Math.floor((diffSeconds % 3600) / 60)
                                          if (hours > 0) {
                                            return `${hours}ש ${minutes}ד`
                                          }
                                          return `${minutes} דק'`
                                        })()
                                      : 'N/A'}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Right: P&L */}
                            <div className="text-left ml-4">
                              <div className={`text-2xl font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`} dir="ltr">
                                <DollarSign className="inline w-5 h-5 mb-1" />
                                {isProfit ? '+' : ''}{pnl.toFixed(2)}
                              </div>
                              <div className={`text-sm font-semibold flex items-center gap-1 ${isProfit ? 'text-green-500' : 'text-red-500'}`} dir="ltr">
                                <Percent className="w-3 h-3" />
                                {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-dark-bg via-dark-panel to-transparent px-6 py-2 border-t border-dark-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg font-bold text-white transition-all"
          >
            סגור
          </button>
        </div>
      </div>
    </>
  )
}

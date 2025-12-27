import { XCircle } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'

export default function PositionsList() {
  const { gameState, executeTrade, isLoading } = useGameStore()

  if (!gameState || !gameState.positions) return null

  const { positions } = gameState

  // שם הנכס המלא (למשל: SP/SPX, BTC/USD)
  const assetSymbol = gameState.asset || 'BTC/USD'

  const handleClose = async (positionId: string) => {
    const position = positions.find(p => p.id === positionId)
    if (position) {
      await executeTrade('sell', position.quantity, positionId)
    }
  }

  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <h3 className="font-semibold mb-4">פוזיציות פתוחות ({positions.length})</h3>

      {positions.length === 0 ? (
        <div className="text-center text-text-secondary py-8 text-sm">
          אין פוזיציות פתוחות
        </div>
      ) : (
        <div className="space-y-2">
          {positions.map((position) => {
            const isProfitable = position.currentPnL >= 0
            
            return (
              <div
                key={position.id}
                className="bg-dark-bg rounded-lg p-3 border-r-4"
                style={{ borderColor: isProfitable ? '#00c853' : '#ff1744' }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-xs text-text-secondary">
                      {position.type === 'long' ? '📈 Long' : '📉 Short'}
                    </div>
                    <div className="font-mono font-semibold">
                      {position.quantity} {assetSymbol}
                    </div>
                  </div>
                  <button
                    onClick={() => handleClose(position.id)}
                    disabled={isLoading}
                    className="px-3 py-1 bg-loss hover:bg-red-700 disabled:bg-dark-border disabled:cursor-not-allowed rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5"
                    title="סגור פוזיציה"
                  >
                    <XCircle size={14} />
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div>
                    <span className="text-text-secondary">כניסה: </span>
                    <span className="font-mono" dir="ltr">${position.entryPrice.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary">נר: </span>
                    <span className="font-mono">#{position.entryIndex}</span>
                  </div>
                </div>

                <div className={`text-sm font-semibold ${isProfitable ? 'text-profit' : 'text-loss'}`} dir="ltr">
                  {isProfitable ? '+' : ''}${position.currentPnL.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  <span className="text-xs ml-1">
                    ({isProfitable ? '+' : ''}{position.currentPnLPercent.toFixed(2)}%)
                  </span>
                </div>

                {/* Stop Loss / Take Profit */}
                {(position.stopLoss || position.takeProfit) && (
                  <div className="mt-2 pt-2 border-t border-dark-border grid grid-cols-2 gap-2 text-xs">
                    {position.stopLoss && (
                      <div>
                        <span className="text-red-400">🛑 SL: </span>
                        <span className="font-mono" dir="ltr">${position.stopLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                    )}
                    {position.takeProfit && (
                      <div>
                        <span className="text-green-400">🎯 TP: </span>
                        <span className="font-mono" dir="ltr">${position.takeProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                    )}
                  </div>
                )}

                {position.patternEntry && (
                  <div className="mt-2 pt-2 border-t border-dark-border">
                    <div className="text-xs text-text-secondary">
                      תבנית: {position.patternEntry.patternType}
                    </div>
                    <div className="text-xs">
                      איכות כניסה: {position.patternEntry.entryQuality}/100
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

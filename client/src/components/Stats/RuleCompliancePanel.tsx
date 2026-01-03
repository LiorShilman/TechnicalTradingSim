import { useMemo } from 'react'
import { useGameStore } from '@/stores/gameStore'
import { Shield, AlertTriangle, XCircle, TrendingUp, Trash2 } from 'lucide-react'

/**
 * פאנל משמעת מסחר - הצגת הפרות וסטטיסטיקה
 * משולב בסיידבר ימני - תמיד גלוי
 */
export const RuleCompliancePanel = () => {
  const violations = useGameStore(state => state.ruleViolations)
  const closedPositions = useGameStore(state => state.gameState?.closedPositions || [])
  const clearViolations = useGameStore(state => state.clearViolations)

  // חישוב ציון משמעת
  const complianceScore = useMemo(() => {
    const totalTrades = closedPositions.length
    if (totalTrades === 0) return 100

    const criticalViolations = violations.filter(v => v.severity === 'critical').length
    return Math.max(0, ((totalTrades - criticalViolations) / totalTrades) * 100)
  }, [violations, closedPositions])

  // ספירת הפרות לפי סוג
  const violationsByType = useMemo(() => {
    const counts: Record<string, number> = {}
    violations.forEach(v => {
      counts[v.rule] = (counts[v.rule] || 0) + 1
    })
    return counts
  }, [violations])

  // הפרות אחרונות
  const recentViolations = useMemo(() => {
    return violations.slice(-5).reverse()
  }, [violations])

  // הפרות שהיו בעסקאות מנצחות (גרוע יותר!)
  const profitableViolations = useMemo(() => {
    return violations.filter(v => v.tradePnL && v.tradePnL > 0).length
  }, [violations])

  const ruleLabels: Record<string, string> = {
    requireStopLoss: 'חוסר SL',
    requireTakeProfit: 'חוסר TP',
    minRRRatio: 'R:R נמוך',
    maxDailyTrades: 'Overtrading',
    maxConsecutiveLosses: 'רצף הפסדים',
    maxRiskPerTrade: 'סיכון גבוה',
  }

  return (
    <div className="border-2 border-purple-600/40 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-purple-400" />
          <h3 className="text-xl font-bold text-white">משמעת מסחר</h3>
        </div>
        {violations.length > 0 && (
          <button
            onClick={clearViolations}
            className="text-gray-400 hover:text-red-400 transition-colors flex items-center gap-1 text-sm"
            title="נקה הכל"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ציון משמעת */}
      <div className="text-center mb-4">
        <div
          className="text-6xl font-bold mb-2"
          style={{
            color: complianceScore >= 90 ? '#22c55e' : complianceScore >= 70 ? '#eab308' : '#ef4444'
          }}
        >
          {complianceScore.toFixed(0)}%
        </div>
        <p className="text-gray-400 text-sm">
          {complianceScore >= 90 && '🏆 משמעת מצוינת!'}
          {complianceScore >= 70 && complianceScore < 90 && '👍 משמעת טובה'}
          {complianceScore < 70 && complianceScore >= 50 && '⚠️ צריך שיפור'}
          {complianceScore < 50 && '🚨 משמעת חלשה - סיכון גבוה!'}
        </p>
      </div>

      {/* סטטיסטיקה */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-gray-800 rounded p-3">
          <p className="text-xs text-gray-400 mb-1">סה"כ הפרות</p>
          <p className="text-2xl font-bold text-white">{violations.length}</p>
        </div>
        <div className="bg-gray-800 rounded p-3">
          <p className="text-xs text-gray-400 mb-1">קריטיות</p>
          <p className="text-2xl font-bold text-red-400">
            {violations.filter(v => v.severity === 'critical').length}
          </p>
        </div>
        <div className="bg-gray-800 rounded p-3">
          <p className="text-xs text-gray-400 mb-1">אזהרות</p>
          <p className="text-2xl font-bold text-yellow-400">
            {violations.filter(v => v.severity === 'warning').length}
          </p>
        </div>
        <div className="bg-gray-800 rounded p-3">
          <p className="text-xs text-gray-400 mb-1">הפרות רווחיות</p>
          <p className="text-2xl font-bold text-orange-400">
            {profitableViolations}
          </p>
        </div>
      </div>

      {/* פירוט לפי סוג */}
      {Object.keys(violationsByType).length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-bold text-gray-300 mb-3">פירוט לפי סוג הפרה</h4>
          <div className="space-y-2">
            {Object.entries(violationsByType).map(([rule, count]) => (
              <div key={rule} className="flex items-center justify-between bg-gray-800 rounded p-2">
                <span className="text-sm text-gray-300">{ruleLabels[rule] || rule}</span>
                <span className="text-lg font-bold text-white">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* הפרות אחרונות */}
      {recentViolations.length > 0 ? (
        <div>
          <h4 className="text-sm font-bold text-gray-300 mb-3">הפרות אחרונות</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentViolations.map((v) => (
              <div
                key={v.id}
                className={`p-3 rounded border-r-4 ${
                  v.severity === 'critical'
                    ? 'bg-red-900/20 border-red-500'
                    : 'bg-yellow-900/20 border-yellow-500'
                }`}
              >
                <div className="flex items-start gap-2">
                  {v.severity === 'critical' ? (
                    <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white leading-tight">{v.message}</p>
                    <p className="text-xs text-gray-400 mt-1" dir="ltr">
                      {new Date(v.timestamp).toLocaleTimeString('he-IL')}
                    </p>
                    {v.tradePnL !== undefined && v.tradePnL > 0 && (
                      <div className="mt-1 flex items-center gap-1 text-xs">
                        <TrendingUp className="w-3 h-3 text-yellow-400" />
                        <span className="text-yellow-400">
                          רווחת ${v.tradePnL.toFixed(2)} למרות ההפרה
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <Shield className="w-16 h-16 text-green-500 mx-auto mb-3" />
          <p className="text-gray-300 font-medium">אין הפרות!</p>
          <p className="text-xs text-gray-400 mt-1">המשך במשמעת הזו 💪</p>
        </div>
      )}

      {/* הסבר על הפרות רווחיות */}
      {profitableViolations > 0 && (
        <div className="mt-4 p-3 bg-orange-900/30 border border-orange-600/40 rounded text-xs text-gray-300">
          ⚠️ <strong>שים לב:</strong> {profitableViolations} הפרות היו בעסקאות מנצחות.
          זה לא הופך את ההפרה לנכונה! רווח חד-פעמי ≠ אסטרטגיה טובה.
        </div>
      )}
    </div>
  )
}

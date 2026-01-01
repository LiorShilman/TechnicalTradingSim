import { useState } from 'react'
import { useGameStore } from '@/stores/gameStore'
import { Settings, Save, RotateCcw } from 'lucide-react'

/**
 * פאנל הגדרת כללי מסחר
 * משולב בסיידבר ימני - תמיד גלוי
 */
export const RulesSettingsPanel = () => {
  const tradingRules = useGameStore(state => state.tradingRules)
  const updateTradingRules = useGameStore(state => state.updateTradingRules)

  // State מקומי לעריכה
  const [localRules, setLocalRules] = useState(tradingRules)

  const handleSave = () => {
    updateTradingRules(localRules)
  }

  const handleReset = () => {
    const defaultRules = {
      maxDailyTrades: 5,
      minRRRatio: 1.5,
      maxRiskPerTrade: 2,
      requireStopLoss: true,
      requireTakeProfit: false,
      maxConsecutiveLosses: 3,
    }
    setLocalRules(defaultRules)
  }

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-purple-600/40 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-6 h-6 text-purple-400" />
        <h3 className="text-xl font-bold text-white">כללי מסחר</h3>
      </div>

      {/* כללים */}
      <div className="space-y-4">
        {/* 1. מקסימום עסקאות יומיות */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            מקסימום עסקאות ביום
          </label>
          <input
            type="number"
            min="1"
            max="20"
            value={localRules.maxDailyTrades}
            onChange={(e) => setLocalRules({ ...localRules, maxDailyTrades: parseInt(e.target.value) })}
            className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
            dir="ltr"
          />
          <p className="text-xs text-gray-400 mt-1">מונע overtrading</p>
        </div>

        {/* 2. R:R מינימלי */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            R:R מינימלי (Risk:Reward)
          </label>
          <input
            type="number"
            min="1"
            max="5"
            step="0.1"
            value={localRules.minRRRatio}
            onChange={(e) => setLocalRules({ ...localRules, minRRRatio: parseFloat(e.target.value) })}
            className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
            dir="ltr"
          />
          <p className="text-xs text-gray-400 mt-1">
            לדוגמה: 1.5 = TP צריך להיות פי 1.5 מ-SL
          </p>
        </div>

        {/* 3. סיכון מקסימלי */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            סיכון מקסימלי לעסקה (%)
          </label>
          <input
            type="number"
            min="0.5"
            max="10"
            step="0.5"
            value={localRules.maxRiskPerTrade}
            onChange={(e) => setLocalRules({ ...localRules, maxRiskPerTrade: parseFloat(e.target.value) })}
            className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
            dir="ltr"
          />
          <p className="text-xs text-gray-400 mt-1">
            אחוז מההון שמותר לסכן (מקצועי: 1-2%)
          </p>
        </div>

        {/* 4. חובת Stop Loss */}
        <div className="flex items-center justify-between p-3 bg-gray-800 rounded border border-gray-700">
          <div>
            <p className="font-medium text-white">חובת Stop Loss</p>
            <p className="text-xs text-gray-400">אסור לפתוח עסקה ללא SL</p>
          </div>
          <label className="relative inline-block w-12 h-6">
            <input
              type="checkbox"
              checked={localRules.requireStopLoss}
              onChange={(e) => setLocalRules({ ...localRules, requireStopLoss: e.target.checked })}
              className="sr-only peer"
            />
            <span className="absolute cursor-pointer inset-0 bg-gray-600 rounded-full peer-checked:bg-green-500 transition-colors"></span>
            <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-6"></span>
          </label>
        </div>

        {/* 5. חובת Take Profit */}
        <div className="flex items-center justify-between p-3 bg-gray-800 rounded border border-gray-700">
          <div>
            <p className="font-medium text-white">חובת Take Profit</p>
            <p className="text-xs text-gray-400">אסור לפתוח עסקה ללא TP</p>
          </div>
          <label className="relative inline-block w-12 h-6">
            <input
              type="checkbox"
              checked={localRules.requireTakeProfit}
              onChange={(e) => setLocalRules({ ...localRules, requireTakeProfit: e.target.checked })}
              className="sr-only peer"
            />
            <span className="absolute cursor-pointer inset-0 bg-gray-600 rounded-full peer-checked:bg-green-500 transition-colors"></span>
            <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-6"></span>
          </label>
        </div>

        {/* 6. מקסימום הפסדים ברצף */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            מקסימום הפסדים ברצף
          </label>
          <input
            type="number"
            min="2"
            max="10"
            value={localRules.maxConsecutiveLosses}
            onChange={(e) => setLocalRules({ ...localRules, maxConsecutiveLosses: parseInt(e.target.value) })}
            className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
            dir="ltr"
          />
          <p className="text-xs text-gray-400 mt-1">
            התראה לפני הפסד נוסף
          </p>
        </div>
      </div>

      {/* כפתורים */}
      <div className="flex gap-2 mt-6">
        <button
          onClick={handleSave}
          className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded font-bold hover:from-green-700 hover:to-green-800 transition-all flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          שמור
        </button>
        <button
          onClick={handleReset}
          className="flex-1 bg-gradient-to-r from-yellow-600 to-yellow-700 text-white px-4 py-2 rounded font-bold hover:from-yellow-700 hover:to-yellow-800 transition-all flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          אפס
        </button>
      </div>

      {/* הסבר */}
      <div className="mt-4 p-3 bg-blue-900/30 border border-blue-600/40 rounded text-xs text-gray-300">
        💡 <strong>למה כללים?</strong> כללים עוזרים לפתח משמעת מסחר. הפרות מתועדות
        ומוצגות בסטטיסטיקה - גם כשמרוויחים למרות ההפרה!
      </div>
    </div>
  )
}

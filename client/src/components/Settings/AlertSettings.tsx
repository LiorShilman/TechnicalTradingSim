import { useState, useEffect } from 'react'
import { Bell, Send, Check, X, ExternalLink, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { telegramService } from '../../services/telegramNotifications'
import { PriceAlert } from '../../types/game.types'

interface AlertSettingsProps {
  priceAlerts: PriceAlert[]
  onAddAlert: (alert: Omit<PriceAlert, 'id' | 'createdAt'>) => void
  onRemoveAlert: (id: string) => void
  onToggleAlert: (id: string) => void
  currentPrice: number
}

export default function AlertSettings({
  priceAlerts,
  onAddAlert,
  onRemoveAlert,
  onToggleAlert,
  currentPrice,
}: AlertSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'telegram' | 'price'>('telegram')

  // Telegram settings
  const [enabled, setEnabled] = useState(false)
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  // Price alerts settings
  const [newAlertPrice, setNewAlertPrice] = useState('')
  const [newAlertDirection, setNewAlertDirection] = useState<'above' | 'below'>('above')
  const [newAlertNote, setNewAlertNote] = useState('')

  // טעינת הגדרות בעת טעינת הקומפוננטה
  useEffect(() => {
    const config = telegramService.getConfig()
    if (config) {
      setEnabled(config.enabled)
      setBotToken(config.botToken)
      setChatId(config.chatId)
    }
  }, [])

  const handleSave = () => {
    telegramService.saveConfig({
      enabled,
      botToken: botToken.trim(),
      chatId: chatId.trim(),
    })
    setTestResult(null)
  }

  const handleTest = async () => {
    // שמירה לפני בדיקה
    handleSave()

    setIsTesting(true)
    setTestResult(null)

    const success = await telegramService.testConnection()

    setIsTesting(false)
    setTestResult(success ? 'success' : 'error')

    // איפוס הודעת תוצאה אחרי 3 שניות
    setTimeout(() => setTestResult(null), 3000)
  }

  const handleAddAlert = () => {
    const price = parseFloat(newAlertPrice)
    if (isNaN(price) || price <= 0) {
      return
    }

    onAddAlert({
      targetPrice: price,
      direction: newAlertDirection,
      enabled: true,
      createdAtPrice: currentPrice,
      note: newAlertNote.trim() || undefined,
    })

    // איפוס טופס
    setNewAlertPrice('')
    setNewAlertNote('')
  }

  // מיון התראות מחיר לפי מחיר
  const sortedAlerts = [...priceAlerts].sort((a, b) => b.targetPrice - a.targetPrice)

  const openTelegramGuide = () => {
    window.open('https://core.telegram.org/bots/tutorial', '_blank')
  }

return (
  <div
    className={`absolute top-16 left-6 z-10 bg-dark-panel/95 border-2 border-yellow-600/40 rounded-lg shadow-xl overflow-hidden
    transition-[width] duration-200 ease-out
    ${isExpanded ? 'w-[300px]' : 'w-[140px]'}`}
  >
    {/* Header */}
    <button
      onClick={() => setIsExpanded(!isExpanded)}
      className="w-full px-3 py-2 flex items-center justify-start gap-2 hover:bg-dark-bg/50 transition-colors"
    >
      <Bell size={16} className="text-yellow-400" />

      <span className="text-sm font-bold text-text-primary whitespace-nowrap text-left w-full">
        Alerts
      </span>

      {(enabled && telegramService.isEnabled()) || priceAlerts.filter(a => a.enabled).length > 0 ? (
        <span className="text-xs text-green-400 flex-shrink-0">●</span>
      ) : null}
    </button>

    {/* Expanded settings */}
    {isExpanded && (
      <div className="border-t border-dark-border w-full">
        {/* Tabs */}
        <div className="flex border-b border-dark-border">
          <button
            onClick={() => setActiveTab('telegram')}
            className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
              activeTab === 'telegram'
                ? 'bg-dark-bg/50 text-text-primary border-b-2 border-blue-500'
                : 'text-text-secondary hover:bg-dark-bg/30'
            }`}
          >
            Telegram
          </button>
          <button
            onClick={() => setActiveTab('price')}
            className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors ${
              activeTab === 'price'
                ? 'bg-dark-bg/50 text-text-primary border-b-2 border-yellow-500'
                : 'text-text-secondary hover:bg-dark-bg/30'
            }`}
          >
            Price Alerts
            {priceAlerts.filter(a => a.enabled).length > 0 && (
              <span className="ml-1 bg-yellow-600 px-1.5 py-0.5 rounded text-[10px]">
                {priceAlerts.filter(a => a.enabled).length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="px-3 py-2 space-y-3">
          {/* Telegram Tab */}
          {activeTab === 'telegram' && (
            <>
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-secondary">התראות Telegram</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

              {/* Configuration Fields */}
              <div className="space-y-2">
                {/* Bot Token */}
                <div className="space-y-1">
                  <label className="text-xs text-text-secondary flex items-center justify-between">
                    <span>Bot Token</span>
                    <button
                      onClick={openTelegramGuide}
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      title="איך ליצור בוט?"
                    >
                      <ExternalLink size={12} />
                      <span>מדריך</span>
                    </button>
                  </label>
                  <input
                    type="text"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    className="w-full px-2 py-1.5 bg-dark-bg border border-dark-border rounded text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                {/* Chat ID */}
                <div className="space-y-1">
                  <label className="text-xs text-text-secondary">Chat ID</label>
                  <input
                    type="text"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder="123456789"
                    className="w-full px-2 py-1.5 bg-dark-bg border border-dark-border rounded text-xs focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <p className="text-[10px] text-text-secondary">
                    שלח /start ל-@userinfobot לקבל את ה-Chat ID שלך
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSave}
                  className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                >
                  <Check size={12} />
                  <span>שמור</span>
                </button>
                <button
                  onClick={handleTest}
                  disabled={isTesting || !botToken.trim() || !chatId.trim()}
                  className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                >
                  {isTesting ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      <span>שולח...</span>
                    </>
                  ) : (
                    <>
                      <Send size={12} />
                      <span>בדיקה</span>
                    </>
                  )}
                </button>
              </div>

              {/* Test Result */}
              {testResult === 'success' && (
                <div className="flex items-center gap-2 px-2 py-1.5 bg-green-900/30 border border-green-600/50 rounded text-xs text-green-400">
                  <Check size={14} />
                  <span>הודעת בדיקה נשלחה בהצלחה!</span>
                </div>
              )}
              {testResult === 'error' && (
                <div className="flex items-center gap-2 px-2 py-1.5 bg-red-900/30 border border-red-600/50 rounded text-xs text-red-400">
                  <X size={14} />
                  <span>שגיאה בשליחה. בדוק את הפרטים.</span>
                </div>
              )}

              {/* Info */}
              <div className="pt-2 border-t border-dark-border">
                <p className="text-[10px] text-text-secondary leading-relaxed">
                  תקבל התראות עבור:
                  <br />• סגירת פוזיציה ב-Stop Loss
                  <br />• סגירת פוזיציה ב-Take Profit
                  <br />• מילוי Pending Orders
                  <br />• התראות מחיר
                </p>
              </div>
            </>
          )}

          {/* Price Alerts Tab */}
          {activeTab === 'price' && (
            <>
              {/* Add new alert form */}
              <div className="space-y-2 pb-3 border-b border-dark-border mt-1">
                <div className="text-xs font-semibold text-text-secondary">הוסף התראה חדשה</div>

                {/* Price and Direction inputs */}
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={newAlertPrice}
                    onChange={(e) => setNewAlertPrice(e.target.value)}
                    placeholder="מחיר"
                    step="0.01"
                    dir="ltr"
                    className="w-[140px] px-2 py-1.5 bg-dark-bg border border-dark-border rounded text-xs focus:outline-none focus:border-yellow-500"
                  />
                  <select
                    value={newAlertDirection}
                    onChange={(e) => setNewAlertDirection(e.target.value as 'above' | 'below')}
                    className="flex-1 px-2 py-1.5 bg-dark-bg border border-dark-border rounded text-xs focus:outline-none focus:border-yellow-500"
                  >
                    <option value="above">מעל ↑</option>
                    <option value="below">מתחת ↓</option>
                  </select>
                </div>

                {/* Note input */}
                <input
                  type="text"
                  value={newAlertNote}
                  onChange={(e) => setNewAlertNote(e.target.value)}
                  placeholder="הערה (אופציונלי)"
                  maxLength={50}
                  className="w-full px-2 py-1.5 bg-dark-bg border border-dark-border rounded text-xs focus:outline-none focus:border-yellow-500 mt-1"
                />

                {/* Add button */}
                <button
                  onClick={handleAddAlert}
                  disabled={!newAlertPrice || parseFloat(newAlertPrice) <= 0}
                  className="w-full px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                >
                  <Plus size={12} />
                  <span>הוסף התראה</span>
                </button>
              </div>

              {/* Alerts list */}
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {sortedAlerts.length === 0 ? (
                  <div className="text-xs text-text-secondary text-center py-6">
                    אין התראות פעילות
                  </div>
                ) : (
                  sortedAlerts.map((alert) => {
                    const distance = alert.targetPrice - currentPrice
                    const distancePercent = (distance / currentPrice) * 100

                    return (
                      <div
                        key={alert.id}
                        className={`p-2 rounded border ${
                          alert.enabled
                            ? 'bg-dark-bg/50 border-dark-border'
                            : 'bg-dark-bg/20 border-dark-border/50 opacity-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <button
                              onClick={() => onToggleAlert(alert.id)}
                              className="text-text-secondary hover:text-text-primary transition-colors mt-0.5 flex-shrink-0"
                              title={alert.enabled ? 'השבת' : 'הפעל'}
                            >
                              {alert.enabled ? (
                                <ToggleRight size={16} className="text-yellow-400" />
                              ) : (
                                <ToggleLeft size={16} />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold">
                                  ${alert.targetPrice.toFixed(2)}
                                </span>
                                <span
                                  className={`text-xs ${
                                    alert.direction === 'above' ? 'text-green-400' : 'text-red-400'
                                  }`}
                                >
                                  {alert.direction === 'above' ? '↑' : '↓'}
                                </span>
                              </div>
                              {alert.note && (
                                <div className="text-[10px] text-text-secondary mt-0.5 truncate">
                                  {alert.note}
                                </div>
                              )}
                              <div
                                className={`text-[10px] mt-1 ${
                                  Math.abs(distancePercent) < 1
                                    ? 'text-yellow-400 font-semibold'
                                    : 'text-text-secondary'
                                }`}
                              >
                                {distance > 0 ? '+' : ''}
                                {distance.toFixed(2)}$ ({distancePercent > 0 ? '+' : ''}
                                {distancePercent.toFixed(2)}%)
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => onRemoveAlert(alert.id)}
                            className="text-text-secondary hover:text-red-400 transition-colors flex-shrink-0"
                            title="מחק"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Info */}
              {sortedAlerts.length > 0 && (
                <div className="pt-2 border-t border-dark-border">
                  <p className="text-[10px] text-text-secondary">
                    מחיר נוכחי: <span className="font-semibold">${currentPrice.toFixed(2)}</span>
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    )}
  </div>
)

}

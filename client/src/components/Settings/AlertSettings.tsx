import { useState, useEffect } from 'react'
import { Bell, BellOff, Send, Check, X, ExternalLink } from 'lucide-react'
import { telegramService } from '../../services/telegramNotifications'

export default function AlertSettings() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [botToken, setBotToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

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

  const openTelegramGuide = () => {
    window.open('https://core.telegram.org/bots/tutorial', '_blank')
  }

  return (
    <div className="absolute top-14 left-2 z-10 bg-dark-panel/95 border border-dark-border rounded-lg shadow-lg overflow-hidden w-[280px]">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between gap-2 hover:bg-dark-bg/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {enabled && telegramService.isEnabled() ? (
            <Bell size={16} className="text-green-400" />
          ) : (
            <BellOff size={16} className="text-gray-400" />
          )}
          <span className="text-sm font-bold text-text-primary">Alerts</span>
        </div>
        <div className="flex items-center gap-2">
          {enabled && telegramService.isEnabled() && (
            <span className="text-xs text-green-400">●</span>
          )}
        </div>
      </button>

      {/* Expanded settings */}
      {isExpanded && (
        <div className="px-3 py-2 border-t border-dark-border space-y-3">
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
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

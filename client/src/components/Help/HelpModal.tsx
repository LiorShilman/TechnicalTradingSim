import { useState } from 'react'
import { X, BookOpen, TrendingUp, Target, Shield, Zap, LineChart, Bell } from 'lucide-react'

interface HelpModalProps {
  onClose: () => void
}

type TabType = 'start' | 'rules' | 'tools' | 'orders' | 'journal' | 'tips'

export default function HelpModal({ onClose }: HelpModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('start')

  const tabs = [
    { id: 'start' as TabType, label: 'התחלה מהירה', icon: Zap },
    { id: 'rules' as TabType, label: 'כללי מסחר', icon: Shield },
    { id: 'journal' as TabType, label: 'יומן מסחר', icon: BookOpen },
    { id: 'tools' as TabType, label: 'כלי גרף', icon: LineChart },
    { id: 'orders' as TabType, label: 'פקודות ממתינות', icon: Target },
    { id: 'tips' as TabType, label: 'טיפים למסחר', icon: TrendingUp },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[90vw] max-w-5xl h-[85vh] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-2 border-purple-600/40 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-white" />
            <h2 className="text-3xl font-bold text-white">מדריך למשחק</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
            title="סגור"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 bg-gray-800/50">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white border-b-2 border-purple-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'start' && <QuickStartTab />}
          {activeTab === 'rules' && <TradingRulesTab />}
          {activeTab === 'journal' && <TradeJournalTab />}
          {activeTab === 'tools' && <ChartToolsTab />}
          {activeTab === 'orders' && <PendingOrdersTab />}
          {activeTab === 'tips' && <TradingTipsTab />}
        </div>

        {/* Footer */}
        <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 p-4 border-t border-gray-700">
          <p className="text-center text-gray-300 text-sm">
            💡 <strong>טיפ:</strong> השתמש בכפתור "שמור וצא" כדי לשמור את ההתקדמות שלך בכל עת
          </p>
        </div>
      </div>
    </div>
  )
}

// ===== Tab Components =====

function QuickStartTab() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-600/40 rounded-lg p-6">
        <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <Zap className="w-6 h-6 text-yellow-400" />
          ברוכים הבאים למשחק סימולציה למסחר טכני!
        </h3>
        <p className="text-gray-300 text-lg leading-relaxed">
          משחק זה נועד לאמן אותך לזהות תבניות טכניות, לנהל פוזיציות, ולפתח משמעת מסחר.
          אתה מקבל נתוני מחיר אמיתיים מ-TradingView ויכול לתרגל מסחר ללא סיכון!
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="text-xl font-bold text-purple-400">צעדים ראשונים:</h4>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">1</div>
            <div>
              <h5 className="font-bold text-white mb-1">העלה קובץ CSV מ-TradingView</h5>
              <p className="text-gray-400 text-sm">ייצא נתונים מ-TradingView (OHLCV) והעלה אותם למערכת. המערכת תזהה אוטומטית את הנכס והטיימפריים.</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">2</div>
            <div>
              <h5 className="font-bold text-white mb-1">נווט בגרף</h5>
              <p className="text-gray-400 text-sm">
                השתמש בכפתור "הבא" כדי להתקדם נר אחר נר, או הפעל Auto-Play למעבר אוטומטי.
                ניתן לשנות מהירות דרך כפתור ההגדרות.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">3</div>
            <div>
              <h5 className="font-bold text-white mb-1">תעד מחשבות לפני העסקה (מומלץ מאוד!)</h5>
              <p className="text-gray-400 text-sm">
                לפני כל עסקה, תוכל לפתוח <strong className="text-purple-400">יומן מסחר</strong> ולענות על 3 שאלות:<br/>
                • מדוע אתה נכנס לעסקה זו?<br/>
                • מה הציפייה שלך? (רווח/הפסד/איזון)<br/>
                • רמת הביטחון שלך (1-5 כוכבים)<br/>
                <span className="text-yellow-300">בסיום המשחק תראה כמה מדויקות היו התחזיות שלך!</span>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">4</div>
            <div>
              <h5 className="font-bold text-white mb-1">פתח עסקאות</h5>
              <p className="text-gray-400 text-sm">
                <strong className="text-green-400">BUY LONG</strong> - קנייה (רווח כשהמחיר עולה)<br/>
                <strong className="text-red-400">SELL SHORT</strong> - מכירה בשורט (רווח כשהמחיר יורד)<br/>
                הגדר Stop Loss ו-Take Profit לניהול סיכון נכון!
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">5</div>
            <div>
              <h5 className="font-bold text-white mb-1">עקוב אחר הביצועים</h5>
              <p className="text-gray-400 text-sm">
                בסיידבר הימני תמצא את פאנל <strong>משמעת מסחר</strong> שעוקב אחר ההפרות שלך.
                שמור על ציון גבוה כדי לפתח הרגלי מסחר טובים!
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-900/30 border border-blue-600/40 rounded-lg p-4">
        <p className="text-blue-200 text-sm">
          <Bell className="inline w-4 h-4 mr-1" />
          <strong>טיפ:</strong> השתמש בכפתור "היסטוריה" בטולבר כדי לראות את כל העסקאות שביצעת ולנתח את הביצועים.
        </p>
      </div>
    </div>
  )
}

function TradingRulesTab() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-600/40 rounded-lg p-6">
        <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <Shield className="w-6 h-6 text-purple-400" />
          מערכת משמעת מסחר
        </h3>
        <p className="text-gray-300 text-lg leading-relaxed">
          המערכת עוקבת אחר הפרות של כללי מסחר ומחשבת ציון משמעת.
          <strong className="text-yellow-400"> הפרות רווחיות</strong> עדיין נספרות - כי רווח חד-פעמי לא אומר שהאסטרטגיה נכונה!
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="text-xl font-bold text-purple-400">6 הכללים במערכת:</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800/50 border-l-4 border-red-500 rounded-lg p-4">
            <h5 className="font-bold text-white mb-2">1. חובת Stop Loss (קריטי)</h5>
            <p className="text-gray-400 text-sm">
              כל עסקה חייבת להיות עם SL. ללא SL = סיכון בלתי מוגבל!
            </p>
          </div>

          <div className="bg-gray-800/50 border-l-4 border-yellow-500 rounded-lg p-4">
            <h5 className="font-bold text-white mb-2">2. חובת Take Profit (אזהרה)</h5>
            <p className="text-gray-400 text-sm">
              מומלץ להגדיר TP מראש כדי לנעול רווחים.
            </p>
          </div>

          <div className="bg-gray-800/50 border-l-4 border-yellow-500 rounded-lg p-4">
            <h5 className="font-bold text-white mb-2">3. R:R מינימלי (אזהרה)</h5>
            <p className="text-gray-400 text-sm">
              יחס Risk:Reward מינימלי של 1.5:1. אם מסכן $100, צריך לכוון לרווח של $150+.
            </p>
          </div>

          <div className="bg-gray-800/50 border-l-4 border-red-500 rounded-lg p-4">
            <h5 className="font-bold text-white mb-2">4. מקס עסקאות יומיות (קריטי)</h5>
            <p className="text-gray-400 text-sm">
              מונע Overtrading. ברירת מחדל: 5 עסקאות ביום.
            </p>
          </div>

          <div className="bg-gray-800/50 border-l-4 border-red-500 rounded-lg p-4">
            <h5 className="font-bold text-white mb-2">5. מקס הפסדים ברצף (קריטי)</h5>
            <p className="text-gray-400 text-sm">
              אחרי 3 הפסדים ברצף - תקבל התראה. זמן לעצור ולנתח!
            </p>
          </div>

          <div className="bg-gray-800/50 border-l-4 border-gray-500 rounded-lg p-4">
            <h5 className="font-bold text-white mb-2">6. סיכון מקסימלי (עתידי)</h5>
            <p className="text-gray-400 text-sm">
              אחוז מקסימלי מההון לסכן בעסקה אחת. ברירת מחדל: 2%.
            </p>
          </div>
        </div>

        <div className="bg-orange-900/30 border border-orange-600/40 rounded-lg p-4">
          <h5 className="font-bold text-orange-300 mb-2">⚠️ למה הפרות רווחיות זה רע?</h5>
          <p className="text-orange-200 text-sm leading-relaxed">
            אם פתחת עסקה ללא SL והרווחת - <strong>זה עדיין טעות!</strong><br/>
            פעם אחת הרווח יציל אותך, אבל בטווח הארוך חוסר משמעת יהרוס את החשבון.
            <br/><strong className="text-yellow-300">תהליך נכון &gt; תוצאה מזדמנת</strong>
          </p>
        </div>

        <div className="bg-green-900/30 border border-green-600/40 rounded-lg p-4">
          <h5 className="font-bold text-green-300 mb-2">🎯 ציון משמעת</h5>
          <p className="text-green-200 text-sm">
            הציון מחושב: <code className="bg-gray-800 px-2 py-1 rounded">(עסקאות סה"כ - הפרות קריטיות) / עסקאות סה"כ × 100</code><br/>
            <strong className="text-green-400">90%+</strong> = משמעת מצוינת<br/>
            <strong className="text-yellow-400">70-89%</strong> = משמעת טובה<br/>
            <strong className="text-red-400">&lt;70%</strong> = צריך שיפור
          </p>
        </div>
      </div>
    </div>
  )
}

function ChartToolsTab() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-600/40 rounded-lg p-6">
        <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <LineChart className="w-6 h-6 text-blue-400" />
          כלי ציור ואינדיקטורים
        </h3>
        <p className="text-gray-300 text-lg leading-relaxed">
          הגרף מצויד ב-11 כלי ציור מקצועיים ומערכת MA בלתי מוגבלת. כל הכלים נשמרים אוטומטית!
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="text-xl font-bold text-purple-400">Moving Averages (MAs):</h4>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <ul className="space-y-2 text-gray-300">
            <li>• <strong className="text-white">ללא הגבלה:</strong> הוסף כמה MA שתרצה (SMA או EMA)</li>
            <li>• <strong className="text-white">בחירת צבעים:</strong> כל MA עם צבע ייחודי שניתן לשנות</li>
            <li>• <strong className="text-white">תקופה מותאמת:</strong> כל ערך מ-1 עד 500</li>
            <li>• <strong className="text-white">חישוב מהנר הנוכחי:</strong> מצב סימולציה אמיתי</li>
          </ul>
        </div>

        <h4 className="text-xl font-bold text-purple-400">11 כלי ציור:</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <h5 className="font-bold text-yellow-400 mb-1">🔔 Horizontal Line</h5>
            <p className="text-gray-400 text-sm">קו אופקי עם התראות מחיר</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <h5 className="font-bold text-cyan-400 mb-1">→ Horizontal Ray</h5>
            <p className="text-gray-400 text-sm">קו אופקי המשתרע ימינה</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <h5 className="font-bold text-purple-400 mb-1">📈 Trend Line</h5>
            <p className="text-gray-400 text-sm">קו מגמה בין שתי נקודות</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <h5 className="font-bold text-purple-300 mb-1">▭ Rectangle</h5>
            <p className="text-gray-400 text-sm">מלבן צבעוני לאזורי תמיכה/התנגדות</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <h5 className="font-bold text-green-400 mb-1">↑ Arrow Up</h5>
            <p className="text-gray-400 text-sm">סימון אותות שוריים</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <h5 className="font-bold text-red-400 mb-1">↓ Arrow Down</h5>
            <p className="text-gray-400 text-sm">סימון אותות דוביים</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <h5 className="font-bold text-yellow-300 mb-1">📊 Fibonacci</h5>
            <p className="text-gray-400 text-sm">7 רמות פיבונאצ'י אוטומטיות</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <h5 className="font-bold text-blue-400 mb-1">📝 Text Note</h5>
            <p className="text-gray-400 text-sm">הערות טקסט על הגרף</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <h5 className="font-bold text-yellow-400 mb-1">📏 Measure Tool</h5>
            <p className="text-gray-400 text-sm">מדידת מרחק ($, %, bars)</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <h5 className="font-bold text-green-500 mb-1">📈 LONG Simulator</h5>
            <p className="text-gray-400 text-sm">סימולטור עסקה ארוכה עם SL/TP</p>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
            <h5 className="font-bold text-red-500 mb-1">📉 SHORT Simulator</h5>
            <p className="text-gray-400 text-sm">סימולטור עסקה קצרה עם SL/TP</p>
          </div>
        </div>

        <div className="bg-blue-900/30 border border-blue-600/40 rounded-lg p-4">
          <p className="text-blue-200 text-sm">
            💡 <strong>טיפ:</strong> כל הכלים נשמרים לפי קובץ CSV! טען אותו קובץ שוב והציורים שלך יופיעו.
            גרור את קווי SL/TP במסימולטורים או לחץ פעמיים לעריכה מדויקת.
          </p>
        </div>
      </div>
    </div>
  )
}

function PendingOrdersTab() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-600/40 rounded-lg p-6">
        <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <Target className="w-6 h-6 text-green-400" />
          פקודות ממתינות (Pending Orders)
        </h3>
        <p className="text-gray-300 text-lg leading-relaxed">
          הגדר עסקאות שיפתחו אוטומטית כשהמחיר יגיע לרמה מסוימת. מושלם לתפיסת breakouts!
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="text-xl font-bold text-purple-400">איך ליצור פקודה ממתינה?</h4>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">1</div>
            <div>
              <h5 className="font-bold text-white mb-1">לחץ ימני על הגרף</h5>
              <p className="text-gray-400 text-sm">
                לחץ ימני בדיוק במקום שאתה רוצה שהפקודה תבוצע. המערכת תזהה את המחיר המדויק.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">2</div>
            <div>
              <h5 className="font-bold text-white mb-1">בחר סוג פקודה</h5>
              <p className="text-gray-400 text-sm mb-2">4 סוגי פקודות זמינים:</p>
              <div className="space-y-1 text-sm">
                <div className="text-green-400">• <strong>Buy Stop</strong> - קנייה מעל המחיר הנוכחי (breakout long)</div>
                <div className="text-green-400">• <strong>Buy Limit</strong> - קנייה מתחת למחיר (pullback long)</div>
                <div className="text-red-400">• <strong>Sell Stop</strong> - מכירה מתחת למחיר (breakdown short)</div>
                <div className="text-red-400">• <strong>Sell Limit</strong> - מכירה מעל המחיר (retracement short)</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">3</div>
            <div>
              <h5 className="font-bold text-white mb-1">הגדר SL/TP וכמות</h5>
              <p className="text-gray-400 text-sm">
                במודאל הפקודה אפשר להגדיר:<br/>
                • <strong className="text-white">מחיר מדויק</strong> לכניסה (ניתן לעריכה)<br/>
                • <strong className="text-red-400">Stop Loss</strong> במחיר מדויק<br/>
                • <strong className="text-green-400">Take Profit</strong> במחיר מדויק<br/>
                • <strong className="text-blue-400">כמות אוטומטית</strong> לפי סיכון (2% ברירת מחדל)
              </p>
            </div>
          </div>
        </div>

        <h4 className="text-xl font-bold text-purple-400 mt-6">תכונות מתקדמות:</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800/50 border-l-4 border-blue-500 rounded-lg p-4">
            <h5 className="font-bold text-white mb-2">📊 ויזואליזציה</h5>
            <p className="text-gray-400 text-sm">
              קווים מקווקווים מציינים פקודות ממתינות:<br/>
              <span className="text-green-400">■ ירוק</span> = LONG orders<br/>
              <span className="text-red-400">■ אדום</span> = SHORT orders
            </p>
          </div>

          <div className="bg-gray-800/50 border-l-4 border-purple-500 rounded-lg p-4">
            <h5 className="font-bold text-white mb-2">✏️ עריכה וביטול</h5>
            <p className="text-gray-400 text-sm">
              בסיידבר השמאלי תראה את כל הפקודות הממתינות.<br/>
              לחץ על עריכה (✏️) או ביטול (❌) בכל עת.
            </p>
          </div>

          <div className="bg-gray-800/50 border-l-4 border-yellow-500 rounded-lg p-4">
            <h5 className="font-bold text-white mb-2">🎯 חישוב סיכון אוטומטי</h5>
            <p className="text-gray-400 text-sm">
              המערכת מחשבת כמות מומלצת לפי:<br/>
              <code className="bg-gray-700 px-1 rounded text-xs">כמות = (הון × סיכון%) / |מחיר - SL|</code>
            </p>
          </div>

          <div className="bg-gray-800/50 border-l-4 border-green-500 rounded-lg p-4">
            <h5 className="font-bold text-white mb-2">⚡ ביצוע אוטומטי</h5>
            <p className="text-gray-400 text-sm">
              הפקודה תבוצע רק כשהמחיר <strong>חוצה</strong> את הרמה בכיוון הנכון.
              אין ביצוע מיידי!
            </p>
          </div>
        </div>

        <div className="bg-orange-900/30 border border-orange-600/40 rounded-lg p-4">
          <h5 className="font-bold text-orange-300 mb-2">⚠️ חשוב לדעת:</h5>
          <p className="text-orange-200 text-sm leading-relaxed">
            • פקודות ממתינות <strong>נשמרות</strong> במשחק ונטענות מחדש<br/>
            • ניתן לערוך SL/TP גם אחרי יצירת הפקודה<br/>
            • הפקודה תבוטל אוטומטית אם תסגור את המשחק ותתחיל חדש
          </p>
        </div>
      </div>
    </div>
  )
}

function TradeJournalTab() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-600/40 rounded-lg p-6">
        <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-purple-400" />
          יומן מסחר (Trade Journal)
        </h3>
        <p className="text-gray-300 text-lg leading-relaxed">
          תכונה חדשה! תעד את המחשבות שלך לפני כל עסקה וקבל משוב על דיוק התחזיות שלך.
          <strong className="text-purple-400"> רפלקציה = למידה עמוקה!</strong>
        </p>
      </div>

      <div className="space-y-4">
        <h4 className="text-xl font-bold text-purple-400">איך זה עובד?</h4>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">1</div>
            <div>
              <h5 className="font-bold text-white mb-1">המודאל מופיע לפני כל עסקה</h5>
              <p className="text-gray-400 text-sm">
                כשאתה לוחץ על <strong className="text-green-400">Buy Long</strong> או <strong className="text-red-400">Sell Short</strong>,
                יופיע מודאל יומן מסחר עם 3 שאלות.
              </p>
            </div>
          </div>
        </div>

        <h4 className="text-xl font-bold text-purple-400 mt-6">3 השאלות ביומן:</h4>

        <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-l-4 border-purple-500 rounded-lg p-4">
          <h5 className="font-bold text-purple-300 mb-2 text-lg">📝 שאלה 1: מדוע נכנס לעסקה?</h5>
          <p className="text-gray-300 text-sm leading-relaxed mb-3">
            תאר במילים שלך למה אתה נכנס לעסקה הזו. מה ראית בגרף? איזו תבנית? איזה אינדיקטור?
          </p>
          <div className="bg-gray-800/60 rounded p-3 text-sm text-gray-400">
            <strong className="text-white">דוגמה:</strong> "זיהיתי breakout מעל קו התנגדות עם ווליום גבוה. SL מתחת לשפל, TP ליד ההתנגדות הבאה."
          </div>
          <p className="text-yellow-300 text-xs mt-2">
            ✅ מינימום 10 תווים, מקסימום 300
          </p>
        </div>

        <div className="bg-gradient-to-r from-green-900/40 to-yellow-900/40 border-l-4 border-green-500 rounded-lg p-4">
          <h5 className="font-bold text-green-300 mb-2 text-lg">🎯 שאלה 2: מה הציפייה?</h5>
          <p className="text-gray-300 text-sm leading-relaxed mb-3">
            בחר את התוצאה הצפויה מהעסקה הזו:
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-green-400 text-2xl">📈</span>
              <strong className="text-green-400">רווח</strong>
              <span className="text-gray-400">- אני מצפה שהעסקה תסגר ברווח</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-yellow-400 text-2xl">〰️</span>
              <strong className="text-yellow-400">איזון</strong>
              <span className="text-gray-400">- עסקת גידור או ניסיון למזער הפסד</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-2xl">📉</span>
              <strong className="text-red-400">הפסד</strong>
              <span className="text-gray-400">- החלטה רגשית/אימפולסיבית (תיעוד לשם למידה)</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-yellow-900/40 to-orange-900/40 border-l-4 border-yellow-500 rounded-lg p-4">
          <h5 className="font-bold text-yellow-300 mb-2 text-lg">⭐ שאלה 3: רמת ביטחון</h5>
          <p className="text-gray-300 text-sm leading-relaxed mb-3">
            דרג את רמת הביטחון שלך בעסקה הזו (1-5 כוכבים):
          </p>
          <div className="space-y-1 text-sm text-gray-400">
            <div>⭐ <strong className="text-white">1 כוכב</strong> - נמוך מאוד, לא בטוח בכלל</div>
            <div>⭐⭐ <strong className="text-white">2 כוכבים</strong> - נמוך, יש ספקות</div>
            <div>⭐⭐⭐ <strong className="text-white">3 כוכבים</strong> - בינוני, setup סביר</div>
            <div>⭐⭐⭐⭐ <strong className="text-white">4 כוכבים</strong> - גבוה, setup טוב</div>
            <div>⭐⭐⭐⭐⭐ <strong className="text-white">5 כוכבים</strong> - גבוה מאוד, setup מצוין!</div>
          </div>
        </div>

        <h4 className="text-xl font-bold text-purple-400 mt-6">מה קורה עם המידע?</h4>

        <div className="bg-blue-900/30 border-l-4 border-blue-500 rounded-lg p-4">
          <h5 className="font-bold text-blue-300 mb-2">📊 Reflection Accuracy</h5>
          <p className="text-blue-100 text-sm leading-relaxed">
            בסיום המשחק, המערכת תחשב את <strong>דיוק התחזיות</strong> שלך:<br/>
            • כמה עסקאות שציפית לרווח - באמת הרוויחו?<br/>
            • כמה עסקאות שציפית להפסד - באמת הפסידו?<br/>
            <br/>
            <strong className="text-green-400">60%+ דיוק</strong> = מעולה! 🎯<br/>
            <strong className="text-yellow-400">40-60% דיוק</strong> = סביר, צריך שיפור 📈<br/>
            <strong className="text-red-400">&lt;40% דיוק</strong> = התחזיות לא מדויקות ❌
          </p>
        </div>

        <div className="bg-purple-900/30 border-l-4 border-purple-500 rounded-lg p-4">
          <h5 className="font-bold text-purple-300 mb-2">📈 Overconfidence Bias</h5>
          <p className="text-purple-100 text-sm leading-relaxed">
            המערכת תזהה אם אתה סובל מ-<strong>ביטחון יתר</strong>:<br/>
            • עסקאות עם ביטחון גבוה (4-5 כוכבים) שהפסידו = ביטחון יתר<br/>
            • למד לזהות מתי אתה יותר מדי בטוח ביכולות שלך
          </p>
        </div>

        <div className="bg-orange-900/30 border border-orange-600/40 rounded-lg p-4">
          <h5 className="font-bold text-orange-300 mb-2">💡 למה זה חשוב?</h5>
          <p className="text-orange-200 text-sm leading-relaxed">
            <strong>תיעוד מחשבות לפני העסקה</strong> מאלץ אותך לחשוב בצורה מובנית ולא אימפולסיבית!<br/>
            • מונע החלטות FOMO (Fear Of Missing Out)<br/>
            • מחייב תכנון ברור לפני כניסה<br/>
            • יוצר תהליך למידה מתמשך<br/>
            <br/>
            <strong className="text-yellow-300">אפשר לדלג על היומן</strong> (כפתור "דלג"), אבל מומלץ מאוד להשתמש בו!
          </p>
        </div>

        <div className="bg-green-900/30 border border-green-600/40 rounded-lg p-4">
          <h5 className="font-bold text-green-300 mb-2">🏆 בסטטיסטיקות הסיום תראה:</h5>
          <div className="text-green-100 text-sm space-y-1">
            <div>✅ <strong>דיוק תחזיות:</strong> אחוז ההצלחה שלך לחזות את התוצאה</div>
            <div>✅ <strong>עסקאות מתועדות:</strong> כמה עסקאות תיעדת מתוך הכל</div>
            <div>✅ <strong>ממוצע ביטחון:</strong> כמה כוכבים בממוצע נתת לעסקאות שלך</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TradingTipsTab() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-600/40 rounded-lg p-6">
        <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-green-400" />
          טיפים למסחר מוצלח
        </h3>
        <p className="text-gray-300 text-lg leading-relaxed">
          עקרונות מסחר שיעזרו לך להצליח במשחק (ובמסחר אמיתי!)
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-green-900/30 border-l-4 border-green-500 rounded-lg p-4">
          <h5 className="font-bold text-green-300 mb-2 text-lg">✅ תמיד השתמש ב-Stop Loss</h5>
          <p className="text-green-100 text-sm leading-relaxed">
            SL הוא ביטוח החיים שלך. ללא SL, עסקה אחת יכולה למחוק את כל הרווחים שלך.
            <strong className="block mt-1">כלל ברזל: אף עסקה ללא SL!</strong>
          </p>
        </div>

        <div className="bg-blue-900/30 border-l-4 border-blue-500 rounded-lg p-4">
          <h5 className="font-bold text-blue-300 mb-2 text-lg">📊 שמור על R:R של 1.5:1 ומעלה</h5>
          <p className="text-blue-100 text-sm leading-relaxed">
            אם מסכן $100 (SL), כוון לרווח של $150+ (TP). ככה גם עם win rate של 50% תהיה רווחי!
            <strong className="block mt-1">נוסחה: win rate × avg win &gt; loss rate × avg loss</strong>
          </p>
        </div>

        <div className="bg-purple-900/30 border-l-4 border-purple-500 rounded-lg p-4">
          <h5 className="font-bold text-purple-300 mb-2 text-lg">🎯 נהל סיכון קבוע</h5>
          <p className="text-purple-100 text-sm leading-relaxed">
            סכן לא יותר מ-1-2% מההון בעסקה אחת. זה מאפשר לך לספוג סדרת הפסדים בלי לפגוע בחשבון.
            <strong className="block mt-1">דוגמה: חשבון $10,000 → סיכון $100-$200 לעסקה</strong>
          </p>
        </div>

        <div className="bg-yellow-900/30 border-l-4 border-yellow-500 rounded-lg p-4">
          <h5 className="font-bold text-yellow-300 mb-2 text-lg">⏸️ עצור אחרי 3 הפסדים ברצף</h5>
          <p className="text-yellow-100 text-sm leading-relaxed">
            כשאתה ברצף הפסדים, אתה בסטרס ועושה טעויות. תעצור, תנתח מה השתבש, ותחזור רק כשאתה רגוע.
            <strong className="block mt-1">Emotional trading = Losing trading</strong>
          </p>
        </div>

        <div className="bg-red-900/30 border-l-4 border-red-500 rounded-lg p-4">
          <h5 className="font-bold text-red-300 mb-2 text-lg">🚫 אל תעשה Overtrading</h5>
          <p className="text-red-100 text-sm leading-relaxed">
            איכות &gt; כמות. 2-3 עסקאות איכותיות ביום עדיפות על 10 עסקאות אקראיות.
            <strong className="block mt-1">הגדר מגבלה יומית ב"כללי מסחר"!</strong>
          </p>
        </div>

        <div className="bg-indigo-900/30 border-l-4 border-indigo-500 rounded-lg p-4">
          <h5 className="font-bold text-indigo-300 mb-2 text-lg">📝 נהל יומן מסחר</h5>
          <p className="text-indigo-100 text-sm leading-relaxed">
            השתמש בכפתור "היסטוריה" כדי לראות את כל העסקאות. נתח מה עבד ומה לא.
            <strong className="block mt-1">למד מהטעויות במקום לחזור עליהן!</strong>
          </p>
        </div>

        <div className="bg-teal-900/30 border-l-4 border-teal-500 rounded-lg p-4">
          <h5 className="font-bold text-teal-300 mb-2 text-lg">🎨 השתמש בכלי ציור</h5>
          <p className="text-teal-100 text-sm leading-relaxed">
            סמן רמות תמיכה/התנגדות חשובות, קווי מגמה, ואזורי כניסה. זה יעזור לך לקבל החלטות מושכלות.
            <strong className="block mt-1">הכנה טובה = מסחר טוב</strong>
          </p>
        </div>

        <div className="bg-pink-900/30 border-l-4 border-pink-500 rounded-lg p-4">
          <h5 className="font-bold text-pink-300 mb-2 text-lg">⚖️ תהליך &gt; תוצאה</h5>
          <p className="text-pink-100 text-sm leading-relaxed">
            עסקה מנצחת עם הפרת כללים זה עדיין טעות! שמור על משמעת גבוהה גם כשמרוויח.
            <strong className="block mt-1">בטווח הארוך, משמעת = רווחיות</strong>
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-green-600/20 to-blue-600/20 border border-green-600/40 rounded-lg p-6">
        <h4 className="font-bold text-green-300 mb-3 text-xl">🏆 נוסחה להצלחה:</h4>
        <div className="text-green-100 space-y-2 text-sm">
          <p>1️⃣ <strong>תכנון:</strong> זהה תבנית, הגדר SL/TP מראש</p>
          <p>2️⃣ <strong>סבלנות:</strong> חכה לכניסה אידיאלית, אל תיכנס מרדיפה</p>
          <p>3️⃣ <strong>משמעת:</strong> עמוד בכללים גם כשקשה</p>
          <p>4️⃣ <strong>ניתוח:</strong> למד מכל עסקה, טובה או רעה</p>
          <p>5️⃣ <strong>התמדה:</strong> התקדמות לוקחת זמן, אל תתייאש!</p>
        </div>
      </div>
    </div>
  )
}

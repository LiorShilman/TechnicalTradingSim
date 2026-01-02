import { useState } from 'react'
import { Star, BookOpen, TrendingUp, Minus, TrendingDown, X } from 'lucide-react'

interface TradeNoteModalProps {
  onSubmit: (note: {
    thoughts: string
    expectedOutcome: 'win' | 'loss' | 'breakeven'
    confidence: number
  }) => void
  onSkip: () => void
  positionType: 'long' | 'short'
}

export default function TradeNoteModal({ onSubmit, onSkip, positionType }: TradeNoteModalProps) {
  const [thoughts, setThoughts] = useState('')
  const [expectedOutcome, setExpectedOutcome] = useState<'win' | 'loss' | 'breakeven'>('win')
  const [confidence, setConfidence] = useState(3)

  const handleSubmit = () => {
    if (thoughts.trim().length < 10) {
      alert('אנא הזן לפחות 10 תווים כדי לתעד את המחשבות שלך')
      return
    }
    onSubmit({ thoughts: thoughts.trim(), expectedOutcome, confidence })
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-panel border-2 border-purple-500/50 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 p-6 border-b border-purple-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen size={28} className="text-purple-400" />
              <div>
                <h2 className="text-2xl font-bold text-white">יומן מסחר</h2>
                <p className="text-purple-300 text-sm mt-1">תיעוד מחשבות לפני ביצוע העסקה (מומלץ מאוד)</p>
              </div>
            </div>
            <button
              onClick={onSkip}
              className="text-gray-400 hover:text-white transition-colors"
              title="סגור"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* שאלה 1: מדוע נכנס? */}
          <div>
            <label className="block text-white font-semibold mb-2 text-lg">
              📝 מדוע אתה נכנס לעסקה {positionType === 'long' ? 'LONG' : 'SHORT'} זו?
            </label>
            <textarea
              value={thoughts}
              onChange={(e) => setThoughts(e.target.value)}
              placeholder="לדוגמה: זיהיתי breakout עם ווליום גבוה מעל קו התמיכה. SL מתחת לשפל, TP ליד ההתנגדות הבאה..."
              maxLength={300}
              rows={4}
              className="w-full bg-dark-bg border border-purple-500/30 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
              dir="rtl"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-400">מינימום 10 תווים</span>
              <span className={`text-xs ${thoughts.length > 250 ? 'text-yellow-400' : 'text-gray-400'}`}>
                {thoughts.length}/300
              </span>
            </div>
          </div>

          {/* שאלה 2: מה הציפייה? */}
          <div>
            <label className="block text-white font-semibold mb-3 text-lg">
              🎯 מה הציפייה שלך מהעסקה?
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setExpectedOutcome('win')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  expectedOutcome === 'win'
                    ? 'bg-green-600/30 border-green-500 shadow-lg shadow-green-500/20'
                    : 'bg-dark-bg border-gray-600 hover:border-green-500/50'
                }`}
              >
                <TrendingUp size={32} className={expectedOutcome === 'win' ? 'text-green-400' : 'text-gray-400'} />
                <div className="mt-2 font-bold text-white">רווח</div>
                <div className="text-xs text-gray-400">📈</div>
              </button>

              <button
                onClick={() => setExpectedOutcome('breakeven')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  expectedOutcome === 'breakeven'
                    ? 'bg-yellow-600/30 border-yellow-500 shadow-lg shadow-yellow-500/20'
                    : 'bg-dark-bg border-gray-600 hover:border-yellow-500/50'
                }`}
              >
                <Minus size={32} className={expectedOutcome === 'breakeven' ? 'text-yellow-400' : 'text-gray-400'} />
                <div className="mt-2 font-bold text-white">איזון</div>
                <div className="text-xs text-gray-400">〰️</div>
              </button>

              <button
                onClick={() => setExpectedOutcome('loss')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  expectedOutcome === 'loss'
                    ? 'bg-red-600/30 border-red-500 shadow-lg shadow-red-500/20'
                    : 'bg-dark-bg border-gray-600 hover:border-red-500/50'
                }`}
              >
                <TrendingDown size={32} className={expectedOutcome === 'loss' ? 'text-red-400' : 'text-gray-400'} />
                <div className="mt-2 font-bold text-white">הפסד</div>
                <div className="text-xs text-gray-400">📉</div>
              </button>
            </div>
          </div>

          {/* שאלה 3: רמת ביטחון */}
          <div>
            <label className="block text-white font-semibold mb-3 text-lg">
              ⭐ רמת הביטחון שלך (1-5 כוכבים)
            </label>
            <div className="flex items-center justify-center gap-4 bg-dark-bg rounded-lg p-6 border border-purple-500/30">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setConfidence(star)}
                  className="transition-transform hover:scale-125"
                >
                  <Star
                    size={40}
                    className={star <= confidence ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}
                  />
                </button>
              ))}
            </div>
            <div className="text-center mt-3 text-sm text-gray-400">
              {confidence === 1 && 'נמוך מאוד - לא בטוח בכלל'}
              {confidence === 2 && 'נמוך - יש ספקות'}
              {confidence === 3 && 'בינוני - setup סביר'}
              {confidence === 4 && 'גבוה - setup טוב'}
              {confidence === 5 && 'גבוה מאוד - setup מצוין!'}
            </div>
          </div>

          {/* Info box */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-300 text-sm leading-relaxed">
              💡 <strong>למה זה חשוב?</strong> תיעוד מחשבות לפני העסקה מאלץ אותך לחשוב בצורה מובנית ומונע החלטות
              אימפולסיביות. אחר כך תוכל להשוות את התחזית למציאות וללמוד מהטעויות.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-dark-bg p-6 border-t border-purple-500/30 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={thoughts.trim().length < 10}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed rounded-lg font-bold text-white transition-all shadow-lg"
          >
            ✅ שמור והמשך לעסקה
          </button>
          <button
            onClick={onSkip}
            className="px-6 py-3 bg-dark-border hover:bg-dark-panel rounded-lg font-semibold text-gray-300 transition-colors"
          >
            ⏭️ דלג (לא מומלץ)
          </button>
        </div>
      </div>
    </div>
  )
}

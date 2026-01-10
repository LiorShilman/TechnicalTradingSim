import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info' | 'success'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'אישור',
  cancelText = 'ביטול',
  type = 'warning',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null

  const typeConfig = {
    danger: {
      icon: XCircle,
      iconColor: 'text-red-500',
      borderColor: 'border-red-500/50',
      bgGradient: 'from-red-900/40 to-red-800/20',
      confirmBg: 'bg-red-600 hover:bg-red-700',
      confirmText: 'text-white',
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-yellow-500',
      borderColor: 'border-yellow-500/50',
      bgGradient: 'from-yellow-900/40 to-orange-800/20',
      confirmBg: 'bg-yellow-600 hover:bg-yellow-700',
      confirmText: 'text-white',
    },
    info: {
      icon: Info,
      iconColor: 'text-blue-500',
      borderColor: 'border-blue-500/50',
      bgGradient: 'from-blue-900/40 to-cyan-800/20',
      confirmBg: 'bg-blue-600 hover:bg-blue-700',
      confirmText: 'text-white',
    },
    success: {
      icon: CheckCircle,
      iconColor: 'text-green-500',
      borderColor: 'border-green-500/50',
      bgGradient: 'from-green-900/40 to-emerald-800/20',
      confirmBg: 'bg-green-600 hover:bg-green-700',
      confirmText: 'text-white',
    },
  }

  const config = typeConfig[type]
  const Icon = config.icon

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fadeIn">
      <div
        className={`bg-gradient-to-br ${config.bgGradient} backdrop-blur-md rounded-2xl p-6 border-2 ${config.borderColor} max-w-md w-full shadow-2xl animate-scaleIn`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon and Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`${config.iconColor} animate-pulse`}>
            <Icon className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
        </div>

        {/* Message */}
        <p className="text-gray-200 mb-6 leading-relaxed text-base">{message}</p>

        {/* Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 bg-gray-600/50 hover:bg-gray-600/70 text-white rounded-lg font-semibold transition-all duration-200 border border-gray-500/30"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-2.5 ${config.confirmBg} ${config.confirmText} rounded-lg font-semibold transition-all duration-200 shadow-lg`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

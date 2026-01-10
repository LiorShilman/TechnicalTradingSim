import toast from 'react-hot-toast'

/**
 * Toast מעוצבים עם סגנון אחיד לכל האפליקציה
 *
 * תומך ב-4 סוגים:
 * - success (ירוק) - פעולות הצלחה
 * - error (אדום) - שגיאות
 * - warning (צהוב/כתום) - אזהרות
 * - info (כחול) - מידע כללי
 */

const baseStyle = {
  borderRadius: '12px',
  backdropFilter: 'blur(12px)',
  padding: '12px 20px',
  fontSize: '15px',
  fontWeight: '600',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
  maxWidth: '500px',
  border: '2px solid',
}

export const customToast = {
  success: (message: string, icon = '✅') => {
    return toast.success(message, {
      icon: icon,
      style: {
        ...baseStyle,
        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(22, 163, 74, 0.15) 100%)',
        color: '#bbf7d0', // green-200
        borderColor: 'rgba(34, 197, 94, 0.5)',
      },
      iconTheme: {
        primary: '#22c55e', // green-500
        secondary: '#052e16', // green-950
      },
      duration: 3000,
    })
  },

  error: (message: string, icon = '❌') => {
    return toast.error(message, {
      icon: icon,
      style: {
        ...baseStyle,
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.15) 100%)',
        color: '#fecaca', // red-200
        borderColor: 'rgba(239, 68, 68, 0.5)',
      },
      iconTheme: {
        primary: '#ef4444', // red-500
        secondary: '#450a0a', // red-950
      },
      duration: 4000,
    })
  },

  warning: (message: string, icon = '⚠️') => {
    return toast(message, {
      icon: icon,
      style: {
        ...baseStyle,
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.15) 100%)',
        color: '#fed7aa', // orange-200
        borderColor: 'rgba(245, 158, 11, 0.5)',
      },
      duration: 3500,
    })
  },

  info: (message: string, icon = 'ℹ️') => {
    return toast(message, {
      icon: icon,
      style: {
        ...baseStyle,
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.15) 100%)',
        color: '#bfdbfe', // blue-200
        borderColor: 'rgba(59, 130, 246, 0.5)',
      },
      duration: 3000,
    })
  },

  // Toast מיוחדים עם אייקונים מותאמים
  save: (message: string) => {
    return customToast.success(message, '💾')
  },

  delete: (message: string) => {
    return customToast.success(message, '🗑️')
  },

  load: (message: string) => {
    return customToast.success(message, '🎮')
  },

  update: (message: string) => {
    return customToast.success(message, '✏️')
  },

  trade: (message: string, isProfit: boolean) => {
    return customToast.success(message, isProfit ? '📈' : '📉')
  },

  pattern: (message: string) => {
    return customToast.info(message, '🎯')
  },

  alert: (message: string) => {
    return customToast.warning(message, '🔔')
  },

  reset: (message: string) => {
    return customToast.info(message, '🔄')
  },
}

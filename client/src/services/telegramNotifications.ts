/**
 * Telegram Notifications Service
 *
 * שירות לשליחת התראות דרך Telegram Bot API
 * חינמי לחלוטין וללא הגבלות
 */

interface TelegramConfig {
  botToken: string
  chatId: string
  enabled: boolean
}

const STORAGE_KEY = 'telegram-notifications-config'

class TelegramNotificationService {
  private config: TelegramConfig | null = null

  constructor() {
    this.loadConfig()
  }

  /**
   * טעינת הגדרות מ-localStorage
   */
  private loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        this.config = JSON.parse(saved)
      }
    } catch (error) {
      console.error('Failed to load Telegram config:', error)
    }
  }

  /**
   * שמירת הגדרות ל-localStorage
   */
  saveConfig(config: TelegramConfig) {
    this.config = config
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  }

  /**
   * קבלת הגדרות נוכחיות
   */
  getConfig(): TelegramConfig | null {
    return this.config
  }

  /**
   * בדיקה האם התראות מופעלות
   */
  isEnabled(): boolean {
    return this.config?.enabled === true && !!this.config.botToken && !!this.config.chatId
  }

  /**
   * שליחת הודעה ל-Telegram
   */
  async sendMessage(message: string): Promise<boolean> {
    if (!this.isEnabled()) {
      console.log('Telegram notifications disabled or not configured')
      return false
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.config!.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: this.config!.chatId,
            text: message,
            parse_mode: 'HTML',
          }),
        }
      )

      const data = await response.json()

      if (!data.ok) {
        console.error('Telegram API error:', data)
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to send Telegram message:', error)
      return false
    }
  }

  /**
   * התראה על סגירת פוזיציה ב-SL
   */
  async notifyStopLoss(params: {
    type: 'LONG' | 'SHORT'
    entryPrice: number
    exitPrice: number
    quantity: number
    pnl: number
    pnlPercent: number
  }) {
    const emoji = params.type === 'LONG' ? '📉' : '📈'
    const message = `
${emoji} <b>Stop Loss Hit!</b>

Type: ${params.type}
Entry: $${params.entryPrice.toFixed(2)}
Exit: $${params.exitPrice.toFixed(2)}
Quantity: ${params.quantity.toFixed(3)} BTC

<b>P&L: $${params.pnl.toFixed(2)} (${params.pnlPercent.toFixed(2)}%)</b>
    `.trim()

    return this.sendMessage(message)
  }

  /**
   * התראה על סגירת פוזיציה ב-TP
   */
  async notifyTakeProfit(params: {
    type: 'LONG' | 'SHORT'
    entryPrice: number
    exitPrice: number
    quantity: number
    pnl: number
    pnlPercent: number
  }) {
    const emoji = '🎯'
    const message = `
${emoji} <b>Take Profit Hit!</b>

Type: ${params.type}
Entry: $${params.entryPrice.toFixed(2)}
Exit: $${params.exitPrice.toFixed(2)}
Quantity: ${params.quantity.toFixed(3)} BTC

<b>P&L: $${params.pnl.toFixed(2)} (${params.pnlPercent.toFixed(2)}%)</b>
    `.trim()

    return this.sendMessage(message)
  }

  /**
   * התראה על סגירת פוזיציה ידנית
   */
  async notifyPositionClosed(params: {
    type: 'LONG' | 'SHORT'
    entryPrice: number
    exitPrice: number
    quantity: number
    pnl: number
    pnlPercent: number
  }) {
    const emoji = params.pnl >= 0 ? '✅' : '❌'
    const message = `
${emoji} <b>Position Closed</b>

Type: ${params.type}
Entry: $${params.entryPrice.toFixed(2)}
Exit: $${params.exitPrice.toFixed(2)}
Quantity: ${params.quantity.toFixed(3)} BTC

<b>P&L: $${params.pnl.toFixed(2)} (${params.pnlPercent.toFixed(2)}%)</b>
    `.trim()

    return this.sendMessage(message)
  }

  /**
   * התראה על מילוי Pending Order
   */
  async notifyPendingOrderFilled(params: {
    type: 'LONG' | 'SHORT'
    orderType: string
    targetPrice: number
    quantity: number
  }) {
    const emoji = params.type === 'LONG' ? '🟢' : '🔴'
    const message = `
${emoji} <b>Pending Order Filled!</b>

Order: ${params.orderType}
Type: ${params.type}
Price: $${params.targetPrice.toFixed(2)}
Quantity: ${params.quantity.toFixed(3)} BTC
    `.trim()

    return this.sendMessage(message)
  }

  /**
   * בדיקת חיבור - שליחת הודעת test
   */
  async testConnection(): Promise<boolean> {
    return this.sendMessage('🎮 <b>Trading Simulator Connected!</b>\n\nYou will receive alerts for:\n• Stop Loss hits\n• Take Profit hits\n• Position closures\n• Pending order fills')
  }
}

// יצירת instance יחיד (singleton)
export const telegramService = new TelegramNotificationService()

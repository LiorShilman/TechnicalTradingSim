import { PriceAlert } from '../types/game.types'

const STORAGE_KEY = 'trading-game-price-alerts'

class PriceAlertsService {
  private alerts: PriceAlert[] = []

  constructor() {
    this.loadAlerts()
  }

  /**
   * טעינת התראות מ-localStorage
   */
  private loadAlerts() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        this.alerts = JSON.parse(saved)
      }
    } catch (error) {
      console.error('Failed to load price alerts:', error)
      this.alerts = []
    }
  }

  /**
   * שמירת התראות ל-localStorage
   */
  private saveAlerts() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.alerts))
    } catch (error) {
      console.error('Failed to save price alerts:', error)
    }
  }

  /**
   * קבלת כל ההתראות
   */
  getAlerts(): PriceAlert[] {
    return [...this.alerts]
  }

  /**
   * הוספת התראה חדשה
   */
  addAlert(alert: Omit<PriceAlert, 'id' | 'createdAt'>): PriceAlert {
    const newAlert: PriceAlert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
    }

    this.alerts.push(newAlert)
    this.saveAlerts()

    return newAlert
  }

  /**
   * הסרת התראה
   */
  removeAlert(id: string): boolean {
    const initialLength = this.alerts.length
    this.alerts = this.alerts.filter(a => a.id !== id)

    if (this.alerts.length !== initialLength) {
      this.saveAlerts()
      return true
    }

    return false
  }

  /**
   * הפעלה/כיבוי התראה
   */
  toggleAlert(id: string): boolean {
    const alert = this.alerts.find(a => a.id === id)
    if (alert) {
      alert.enabled = !alert.enabled
      this.saveAlerts()
      return true
    }
    return false
  }

  /**
   * בדיקה אם התראות הופעלו
   * מחזיר מערך של התראות שהופעלו
   */
  checkAlerts(currentPrice: number, previousPrice: number): PriceAlert[] {
    const triggeredAlerts: PriceAlert[] = []

    for (const alert of this.alerts) {
      if (!alert.enabled) continue

      let triggered = false

      if (alert.direction === 'above') {
        // התראה כשעובר מעל - בדיקה אם חצינו את המחיר מלמטה למעלה
        if (previousPrice < alert.targetPrice && currentPrice >= alert.targetPrice) {
          triggered = true
        }
      } else {
        // התראה כשעובר מתחת - בדיקה אם חצינו את המחיר מלמעלה למטה
        if (previousPrice > alert.targetPrice && currentPrice <= alert.targetPrice) {
          triggered = true
        }
      }

      if (triggered) {
        triggeredAlerts.push(alert)
        // השבתת ההתראה אחרי שהופעלה (one-time alert)
        alert.enabled = false
      }
    }

    if (triggeredAlerts.length > 0) {
      this.saveAlerts()
    }

    return triggeredAlerts
  }

  /**
   * ניקוי כל ההתראות
   */
  clearAll() {
    this.alerts = []
    this.saveAlerts()
  }
}

// יצירת instance יחיד (singleton)
export const priceAlertsService = new PriceAlertsService()

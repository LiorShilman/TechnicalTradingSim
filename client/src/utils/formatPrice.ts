/**
 * פונקציות עזר לעיצוב מחירים עם precision אוטומטי
 */

/**
 * מחשבת את ה-precision (מספר ספרות עשרוניות) מדגימת מחירים
 */
export function calculatePrecisionFromPrices(prices: number[]): number {
  if (!prices || prices.length === 0) return 2

  let maxDecimals = 0

  for (const price of prices) {
    const priceStr = price.toString()
    const decimalPart = priceStr.split('.')[1]
    if (decimalPart) {
      // סופר רק ספרות משמעותיות (לא nullים בסוף)
      const significantDecimals = decimalPart.replace(/0+$/, '').length
      maxDecimals = Math.max(maxDecimals, significantDecimals)
    }
  }

  // הגבלה ל-4 ספרות מקסימום
  return Math.min(Math.max(maxDecimals, 2), 4)
}

/**
 * מעצבת מחיר עם precision אוטומטי
 * אם precision לא מסופק, משתמשת ב-2 ספרות כברירת מחדל
 */
export function formatPrice(price: number, precision?: number): string {
  const finalPrecision = precision ?? 2
  return price.toFixed(finalPrecision)
}

/**
 * מעצבת כמות עם precision אוטומטי
 * כמויות בדרך כלל צריכות יותר דיוק (עד 4 ספרות)
 */
export function formatQuantity(quantity: number, precision: number = 4): string {
  return quantity.toFixed(precision)
}

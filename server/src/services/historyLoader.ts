/**
 * טעינת נתוני היסטוריה אמיתיים מקובץ CSV
 *
 * תומך בפורמטים:
 * 1. TradingView Export (time, open, high, low, close, volume)
 * 2. Binance Export (timestamp, open, high, low, close, volume)
 * 3. Generic OHLCV CSV
 */

import fs from 'fs'
import path from 'path'
import type { Candle } from '../types/index.js'

/**
 * פונקציה לפירוק שורה מ-CSV
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

/**
 * המרת timestamp לפורמט Unix (שניות)
 */
function parseTimestamp(value: string): number {
  // אם זה כבר Unix timestamp (9-13 ספרות)
  // תומך גם בtimestamps משנות ה-90 (9 ספרות, כמו 877467600 = 1997)
  if (/^\d{9,13}$/.test(value)) {
    const num = parseInt(value)
    // אם זה milliseconds (13 ספרות), המר לשניות
    return num > 9999999999 ? Math.floor(num / 1000) : num
  }

  // אם זה תאריך ISO (2024-01-01 או 2024-01-01T12:00:00)
  const date = new Date(value)
  if (!isNaN(date.getTime())) {
    return Math.floor(date.getTime() / 1000)
  }

  throw new Error(`Invalid timestamp format: ${value}`)
}

/**
 * זיהוי פורמט ה-CSV לפי header
 */
function detectFormat(header: string[]): 'tradingview' | 'binance' | 'generic' | null {
  const headerLower = header.map(h => h.toLowerCase().trim())

  // TradingView: time, open, high, low, close, volume
  if (
    headerLower.includes('time') &&
    headerLower.includes('open') &&
    headerLower.includes('high') &&
    headerLower.includes('low') &&
    headerLower.includes('close')
  ) {
    return 'tradingview'
  }

  // Binance: timestamp או open_time
  if (
    (headerLower.includes('timestamp') || headerLower.includes('open_time')) &&
    headerLower.includes('open') &&
    headerLower.includes('high') &&
    headerLower.includes('low') &&
    headerLower.includes('close')
  ) {
    return 'binance'
  }

  // Generic: לפחות 5 עמודות מספריות
  if (header.length >= 5) {
    return 'generic'
  }

  return null
}

/**
 * פרסור תוכן CSV מ-string
 */
export function parseCSVContent(content: string): Candle[] {
  const lines = content.split('\n').filter(line => line.trim().length > 0)

  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row')
  }

  // פירוק header
  const header = parseCSVLine(lines[0])
  const format = detectFormat(header)

  if (!format) {
    throw new Error('Unable to detect CSV format. Expected columns: time/timestamp, open, high, low, close, volume')
  }

  console.log(`Detected format: ${format}`)
  console.log(`Header: ${header.join(', ')}`)

  // מיפוי עמודות
  const headerLower = header.map(h => h.toLowerCase().trim())
  const indices = {
    time: headerLower.findIndex(h => h === 'time' || h === 'timestamp' || h === 'open_time' || h === 'date'),
    open: headerLower.findIndex(h => h === 'open'),
    high: headerLower.findIndex(h => h === 'high'),
    low: headerLower.findIndex(h => h === 'low'),
    close: headerLower.findIndex(h => h === 'close'),
    volume: headerLower.findIndex(h => h === 'volume' || h === 'vol'),
  }

  // אם אין עמודת time, נניח שהעמודה הראשונה היא time
  if (indices.time === -1) {
    indices.time = 0
  }

  console.log(`Column indices:`, indices)

  // פירוק שורות נתונים
  const candles: Candle[] = []
  let skippedRows = 0

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i])

      // דילוג על שורות ריקות או לא תקינות
      if (values.length < 5) {
        skippedRows++
        continue
      }

      const time = parseTimestamp(values[indices.time])
      const open = parseFloat(values[indices.open])
      const high = parseFloat(values[indices.high])
      const low = parseFloat(values[indices.low])
      const close = parseFloat(values[indices.close])
      const volume = indices.volume !== -1 ? parseFloat(values[indices.volume]) : 1000

      // בדיקת תקינות
      if (isNaN(time) || isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
        skippedRows++
        continue
      }

      // בדיקה שה-OHLC הגיוני (high >= low, high >= open/close, low <= open/close)
      if (high < low || high < open || high < close || low > open || low > close) {
        console.warn(`Invalid OHLC at line ${i + 1}: H=${high} L=${low} O=${open} C=${close}`)
        skippedRows++
        continue
      }

      candles.push({
        time,
        open,
        high,
        low,
        close,
        volume: isNaN(volume) ? 1000 : volume,
      })
    } catch (error) {
      console.warn(`Error parsing line ${i + 1}:`, error)
      skippedRows++
    }
  }

  console.log(`✅ Parsed ${candles.length} candles`)
  if (skippedRows > 0) {
    console.log(`⚠️  Skipped ${skippedRows} invalid rows`)
  }

  // מיון לפי זמן (ascending)
  candles.sort((a, b) => a.time - b.time)

  return candles
}

/**
 * טעינת קובץ CSV והמרה לנרות
 */
export function loadHistoryFromCSV(filePath: string): Candle[] {
  console.log(`Loading history from: ${filePath}`)

  // קריאת הקובץ
  const fullPath = path.resolve(filePath)
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`)
  }

  const content = fs.readFileSync(fullPath, 'utf-8')
  return parseCSVContent(content)
}

/**
 * טעינת קובץ ברירת מחדל אם קיים
 */
export function loadDefaultHistory(): Candle[] | null {
  const defaultPaths = [
    path.join(process.cwd(), 'data', 'btc_1h.csv'),
    path.join(process.cwd(), 'data', 'history.csv'),
    path.join(process.cwd(), 'btc_history.csv'),
  ]

  for (const filePath of defaultPaths) {
    if (fs.existsSync(filePath)) {
      console.log(`Found default history file: ${filePath}`)
      return loadHistoryFromCSV(filePath)
    }
  }

  console.log('No default history file found')
  return null
}

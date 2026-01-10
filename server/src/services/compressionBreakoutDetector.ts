/**
 * Compression Spring Breakout Detector 🔧
 *
 * קונסספט: דשדוש אמיתי = קפיץ דחוס
 * ככל שהמחיר נדחס יותר (טווח צר, נפח יורד), יש יותר אנרגיה לפריצה חזקה
 *
 * אלגוריתם (3 שלבים):
 * 1. זיהוי "Squeeze Zone" - אזור דחיסה (15-25 נרות)
 * 2. מדידת "לחץ" - Pressure Build-up (איכות הדחיסה)
 * 3. זיהוי פריצה "נפיצה" - Explosive Breakout (נר גדול + נפח)
 *
 * יתרונות:
 * - פחות false breakouts (דרישה לנפח גבוה)
 * - יותר explosive moves (מוצא דשדושים עם אנרגיה)
 * - עובד על כל נכס (מבוסס על ATR ו-%)
 */

import type { Candle, Pattern } from '../types/index.js'

interface CompressionZone {
  startIndex: number
  endIndex: number
  high: number
  low: number
  range: number
  avgPrice: number
  rangePct: number
  highTouches: number
  lowTouches: number
  atrSlope: number      // שיפוע ATR (שלילי = התכווצות)
  volumeSlope: number   // שיפוע נפח (שלילי = ירידה)
  symmetryScore: number // ציון סימטריה (0-1)
  priceDriftPct: number // תנועת מחיר % per candle (קרוב ל-0 = אופקי)
}

/**
 * חישוב ATR (Average True Range)
 */
function calculateATR(candles: Candle[], period: number = 14): number[] {
  const atr: number[] = []

  for (let i = 0; i < candles.length; i++) {
    if (i < period) {
      atr.push(0)
      continue
    }

    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      const h = candles[j].high
      const l = candles[j].low
      const prevClose = j > 0 ? candles[j - 1].close : candles[j].close

      const tr = Math.max(
        h - l,
        Math.abs(h - prevClose),
        Math.abs(l - prevClose)
      )
      sum += tr
    }

    atr.push(sum / period)
  }

  return atr
}

/**
 * חישוב שיפוע (slope) של מערך
 * שיפוע חיובי = עליה, שיפוע שלילי = ירידה
 */
function calculateSlope(values: number[]): number {
  if (values.length < 2) return 0

  const n = values.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0

  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += values[i]
    sumXY += i * values[i]
    sumX2 += i * i
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  return slope
}

/**
 * זיהוי אזורי דחיסה (Compression Zones)
 *
 * מחפש חלונות של 15-25 נרות עם:
 * - טווח צר (< 3% של מחיר ממוצע)
 * - ATR יורד (סימן לדחיסה)
 * - נפח יורד (סימן לעייפות לפני התפרצות)
 * - נגיעות סימטריות בתקרה וברצפה
 */
function findCompressionZones(
  candles: Candle[],
  atr: number[],
  minWindow: number = 15,
  maxWindow: number = 25,
  maxRangePct: number = 0.03  // 3% מקסימום
): CompressionZone[] {
  const zones: CompressionZone[] = []

  console.log(`🔍 Scanning for compression zones (${minWindow}-${maxWindow} bars, max ${(maxRangePct * 100).toFixed(1)}% range)...`)

  // סריקה עם חלון גמיש
  for (let windowSize = minWindow; windowSize <= maxWindow; windowSize++) {
    for (let i = windowSize; i < candles.length - 5; i++) {
      const start = i - windowSize + 1
      const end = i

      const window = candles.slice(start, end + 1)

      // 1. חישוב טווח מחירים
      const high = Math.max(...window.map(c => c.high))
      const low = Math.min(...window.map(c => c.low))
      const range = high - low
      const avgPrice = (high + low) / 2
      const rangePct = range / avgPrice

      // סינון: טווח צר מדי
      if (rangePct > maxRangePct) continue

      // 2. בדיקת ATR יורד (דחיסה)
      const windowATR = atr.slice(start, end + 1).filter(a => a > 0)
      if (windowATR.length < 5) continue

      const atrSlope = calculateSlope(windowATR)

      // דרישה מרוככת: ATR יורד או יציב (לא עולה חזק)
      // אפשר גם ATR שטוח (slope ≈ 0) - עדיין דשדוש
      if (atrSlope > 0.0001) continue // מאפשר slope קטן חיובי

      // 3. בדיקת נפח יורד (אופציונלי)
      const windowVolumes = window.map(c => c.volume).filter(v => v > 0)
      const volumeSlope = windowVolumes.length >= 5 ? calculateSlope(windowVolumes) : 0

      // 4. ספירת נגיעות בתקרה וברצפה
      const touchTolerance = range * 0.08 // 8% מהטווח (הרחבה מ-5%)
      let highTouches = 0
      let lowTouches = 0

      for (const candle of window) {
        if (Math.abs(candle.high - high) <= touchTolerance) highTouches++
        if (Math.abs(candle.low - low) <= touchTolerance) lowTouches++
      }

      // דרישה מרוככת: לפחות 2 נגיעות בכל צד (במקום 3)
      // דשדוש יכול להיות תקף גם עם פחות נגיעות אם הוא הומוגני
      if (highTouches < 2 || lowTouches < 2) continue

      // 5. חישוב ציון סימטריה (0-1)
      // ציון גבוה = נגיעות דומות בשני הצדדים
      const touchDiff = Math.abs(highTouches - lowTouches)
      const touchTotal = highTouches + lowTouches
      const symmetryScore = 1 - (touchDiff / touchTotal)

      // דרישה מרוככת: סימטריה סבירה (> 0.4)
      // 0.6 היה קפדני מדי - דשדושים יכולים להיות אסימטריים מעט
      if (symmetryScore < 0.4) continue

      // 6. בדיקת drift (תנועה אופקית)
      // דשדוש אמיתי = תנועה צידית/אופקית ללא מגמה
      const closePrices = window.map(c => c.close)
      const priceSlope = calculateSlope(closePrices)
      const priceDriftPct = Math.abs(priceSlope) / avgPrice

      // דרישה מרוככת: תנועה אופקית (drift < 1.2% per candle)
      // 0.5% היה קפדני מדי - דחה דשדושים לגיטימיים עם עליה/ירידה מתונה
      const maxDriftPct = 0.012 // 1.2% per candle = ~24% over 20 bars (reasonable)
      if (priceDriftPct > maxDriftPct) {
        console.log(`      ❌ Rejected zone ${start}-${end}: Price drift too high (${(priceDriftPct * 100).toFixed(3)}% > ${(maxDriftPct * 100).toFixed(1)}%)`)
        continue
      }

      zones.push({
        startIndex: start,
        endIndex: end,
        high,
        low,
        range,
        avgPrice,
        rangePct,
        highTouches,
        lowTouches,
        atrSlope,
        volumeSlope,
        symmetryScore,
        priceDriftPct,
      })
    }
  }

  console.log(`   📦 Found ${zones.length} potential compression zones`)
  return zones
}

/**
 * חישוב ציון "לחץ" (Pressure Score)
 *
 * מבוסס על:
 * 1. טווח צר (40 נקודות) - ככל שצר יותר = יותר נקודות
 * 2. משך אופטימלי (20 נקודות) - 15-20 נרות = אופטימלי
 * 3. התכווצות ATR (20 נקודות) - שיפוע שלילי חזק = יותר נקודות
 * 4. ירידת נפח (10 נקודות) - שיפוע שלילי = יותר נקודות
 * 5. סימטריה (10 נקודות) - נגיעות שוות = יותר נקודות
 *
 * סה"כ: 0-100 נקודות
 */
function calculatePressureScore(zone: CompressionZone): number {
  const windowSize = zone.endIndex - zone.startIndex + 1

  // 1. טווח צר (0-40 נקודות)
  // 0.5% = 40 נקודות, 3% = 0 נקודות
  const rangeScore = Math.max(0, 40 * (1 - zone.rangePct / 0.03))

  // 2. משך אופטימלי (0-20 נקודות)
  // 20-30 נרות = 20 נקודות (עדכון לטווח החדש)
  let durationScore = 0
  if (windowSize >= 20 && windowSize <= 30) {
    durationScore = 20  // אופטימלי
  } else if (windowSize >= 17 && windowSize <= 35) {
    durationScore = 15  // טוב
  } else if (windowSize >= 12) {
    durationScore = 10  // סביר
  } else {
    durationScore = 5   // קצר מדי
  }

  // 3. התכווצות ATR (0-20 נקודות)
  // שיפוע שלילי חזק = יותר נקודות
  const atrScore = Math.min(20, Math.abs(zone.atrSlope) * 1000)

  // 4. ירידת נפח (0-10 נקודות)
  const volumeScore = zone.volumeSlope < 0
    ? Math.min(10, Math.abs(zone.volumeSlope) * 1000)
    : 0

  // 5. סימטריה (0-10 נקודות)
  const symmetryScore = zone.symmetryScore * 10

  const totalScore = rangeScore + durationScore + atrScore + volumeScore + symmetryScore

  return Math.round(Math.min(100, totalScore))
}

/**
 * זיהוי פריצה "נפיצה" (Explosive Breakout)
 *
 * דרישות לפריצה תקפה:
 * 1. נר פריצה גדול (range > 1.5x ATR average)
 * 2. נפח גבוה (> 1.5x average של הדשדוש)
 * 3. סגירה מעבר לרמה (לא רק פתיל)
 * 4. 2 נרות הבאים לא חוזרים לתוך הדשדוש (< 50% retracement)
 */
function detectExplosiveBreakout(
  candles: Candle[],
  zone: CompressionZone,
  atr: number[],
  minVolSpike: number = 1.5,
  minRangeMultiplier: number = 1.5
): { direction: 'UP' | 'DOWN'; breakoutIndex: number } | null {
  const zoneCandles = candles.slice(zone.startIndex, zone.endIndex + 1)
  const avgVolume = zoneCandles.reduce((sum, c) => sum + c.volume, 0) / zoneCandles.length
  const avgATR = atr.slice(zone.startIndex, zone.endIndex + 1).reduce((sum, a) => sum + a, 0) / (zone.endIndex - zone.startIndex + 1)

  // חיפוש פריצה ב-5 נרות הבאים
  const maxLookAhead = 5

  for (let i = 1; i <= maxLookAhead; i++) {
    const breakoutIndex = zone.endIndex + i
    if (breakoutIndex + 2 >= candles.length) break

    const breakoutCandle = candles[breakoutIndex]
    const breakoutRange = breakoutCandle.high - breakoutCandle.low

    // דרישה 1: נר גדול (מרוכך - רק 1.2x ATR במקום 1.5x)
    if (breakoutRange < avgATR * minRangeMultiplier) {
      console.log(`         ⚠️ Candle too small: ${breakoutRange.toFixed(2)} < ${(avgATR * minRangeMultiplier).toFixed(2)} (${minRangeMultiplier}x ATR)`)
      continue
    }

    // דרישה 2: נפח גבוה (מרוכך - 1.3x במקום 1.5x, או בכלל דילוג אם אין נפח)
    if (avgVolume > 0 && breakoutCandle.volume < avgVolume * minVolSpike) {
      console.log(`         ⚠️ Volume too low: ${breakoutCandle.volume.toFixed(0)} < ${(avgVolume * minVolSpike).toFixed(0)} (${minVolSpike}x avg)`)
      continue
    }

    // בדיקת כיוון פריצה
    let direction: 'UP' | 'DOWN' | null = null

    // פריצה למעלה?
    if (breakoutCandle.close > zone.high) {
      direction = 'UP'
    }
    // פריצה למטה?
    else if (breakoutCandle.close < zone.low) {
      direction = 'DOWN'
    }

    if (!direction) continue

    // דרישה 4: 2 נרות הבאים לא חוזרים עמוק לתוך הדשדוש
    const follow1 = candles[breakoutIndex + 1]
    const follow2 = candles[breakoutIndex + 2]

    const allowedRetracement = zone.range * 0.5

    if (direction === 'UP') {
      // בדיקה: לא חזרו מתחת לתקרה - 50%
      if (follow1.close < zone.high - allowedRetracement) continue
      if (follow2.close < zone.high - allowedRetracement) continue

      console.log(`      ✅ Explosive UP breakout at index ${breakoutIndex}`)
      console.log(`         Range: ${breakoutRange.toFixed(2)} (${(breakoutRange / avgATR).toFixed(2)}x ATR)`)
      console.log(`         Volume: ${breakoutCandle.volume.toFixed(0)} (${(breakoutCandle.volume / avgVolume).toFixed(2)}x avg)`)

      return { direction: 'UP', breakoutIndex }
    } else {
      // בדיקה: לא חזרו מעל לרצפה + 50%
      if (follow1.close > zone.low + allowedRetracement) continue
      if (follow2.close > zone.low + allowedRetracement) continue

      console.log(`      ✅ Explosive DOWN breakout at index ${breakoutIndex}`)
      console.log(`         Range: ${breakoutRange.toFixed(2)} (${(breakoutRange / avgATR).toFixed(2)}x ATR)`)
      console.log(`         Volume: ${breakoutCandle.volume.toFixed(0)} (${(breakoutCandle.volume / avgVolume).toFixed(2)}x avg)`)

      return { direction: 'DOWN', breakoutIndex }
    }
  }

  return null
}

/**
 * פונקציה ראשית: זיהוי תבניות Compression Spring Breakout
 */
export function detectCompressionBreakouts(
  candles: Candle[],
  maxPatterns: number,
  options: {
    minWindow?: number
    maxWindow?: number
    maxRangePct?: number
    minVolSpike?: number
    minRangeMultiplier?: number
    minPressureScore?: number
  } = {}
): Pattern[] {
  const {
    minWindow = 15,
    maxWindow = 25,
    maxRangePct = 0.03,     // 3% max range
    minVolSpike = 1.5,      // 1.5x volume spike
    minRangeMultiplier = 1.5, // 1.5x ATR for breakout candle
    minPressureScore = 60,  // minimum pressure score
  } = options

  console.log(`🔧 Compression Spring Breakout Detector`)
  console.log(`   Window: ${minWindow}-${maxWindow} bars`)
  console.log(`   Max Range: ${(maxRangePct * 100).toFixed(1)}%`)
  console.log(`   Min Volume Spike: ${minVolSpike}x`)
  console.log(`   Min Breakout Size: ${minRangeMultiplier}x ATR`)
  console.log(`   Min Pressure Score: ${minPressureScore}`)

  // חישוב ATR
  const atr = calculateATR(candles, 14)

  // שלב 1: מציאת אזורי דחיסה
  const zones = findCompressionZones(candles, atr, minWindow, maxWindow, maxRangePct)

  const patterns: Pattern[] = []
  const minGap = 20 // מרווח מינימלי בין תבניות

  console.log(`   🔎 Analyzing ${zones.length} compression zones...`)

  for (const zone of zones) {
    if (patterns.length >= maxPatterns) {
      console.log(`   🛑 Reached max patterns limit (${maxPatterns})`)
      break
    }

    // בדיקת חפיפה עם תבניות קיימות
    const hasOverlap = patterns.some(p => {
      const rangeStart = Math.min(p.startIndex, p.endIndex) - minGap
      const rangeEnd = Math.max(p.startIndex, p.endIndex) + minGap
      return zone.startIndex >= rangeStart && zone.startIndex <= rangeEnd
    })

    if (hasOverlap) continue

    // שלב 2: חישוב ציון לחץ
    const pressureScore = calculatePressureScore(zone)

    console.log(`   🔧 Zone ${zone.startIndex}-${zone.endIndex}:`)
    console.log(`      Range: ${(zone.rangePct * 100).toFixed(2)}%`)
    console.log(`      Touches: ${zone.highTouches}H / ${zone.lowTouches}L`)
    console.log(`      ATR Slope: ${zone.atrSlope.toFixed(6)} (${zone.atrSlope < 0 ? 'contracting ✓' : 'expanding ✗'})`)
    console.log(`      Symmetry: ${(zone.symmetryScore * 100).toFixed(0)}%`)
    console.log(`      Price Drift: ${(zone.priceDriftPct * 100).toFixed(3)}% per candle (${Math.abs(zone.priceDriftPct) < 0.005 ? 'horizontal ✓' : 'trending ✗'})`)
    console.log(`      Pressure Score: ${pressureScore}`)

    if (pressureScore < minPressureScore) {
      console.log(`      ❌ Pressure too low (< ${minPressureScore})`)
      continue
    }

    // שלב 3: חיפוש פריצה נפיצה
    const breakout = detectExplosiveBreakout(candles, zone, atr, minVolSpike, minRangeMultiplier)

    if (!breakout) {
      console.log(`      ❌ No explosive breakout found`)
      continue
    }

    // יצירת תבנית
    const direction = breakout.direction
    const breakoutCandle = candles[breakout.breakoutIndex]

    const expectedEntry = direction === 'UP'
      ? breakoutCandle.close * 1.002
      : breakoutCandle.close * 0.998

    const expectedExit = direction === 'UP'
      ? breakoutCandle.close + (zone.range * 3)  // Measured move: 3x height
      : breakoutCandle.close - (zone.range * 3)

    const stopLoss = direction === 'UP'
      ? zone.low - (zone.range * 0.1)
      : zone.high + (zone.range * 0.1)

    const windowSize = zone.endIndex - zone.startIndex + 1

    patterns.push({
      type: 'breakout',
      startIndex: zone.startIndex,
      endIndex: zone.endIndex,  // קופסה מסתיימת בסוף הדשדוש, לא בנר הפריצה
      expectedEntry,
      expectedExit,
      stopLoss,
      metadata: {
        quality: pressureScore,
        description: direction === 'UP'
          ? `פריצה נפיצה למעלה (Compression ${windowSize} נרות)`
          : `פריצה נפיצה למטה (Compression ${windowSize} נרות)`,
        hint: direction === 'UP'
          ? `🔧 קפיץ דחוס:\n1️⃣ דשדוש ${windowSize} נרות בטווח ${(zone.rangePct * 100).toFixed(2)}%\n2️⃣ ATR התכווץ (${zone.atrSlope.toFixed(4)}), נפח ירד\n3️⃣ ${zone.highTouches} נגיעות בתקרה, ${zone.lowTouches} ברצפה\n4️⃣ פריצה נפיצה למעלה (${minRangeMultiplier}x ATR, ${minVolSpike}x נפח)\n💡 כניסה: ${expectedEntry.toFixed(2)} | SL: ${stopLoss.toFixed(2)} | ציון לחץ: ${pressureScore}`
          : `🔧 קפיץ דחוס:\n1️⃣ דשדוש ${windowSize} נרות בטווח ${(zone.rangePct * 100).toFixed(2)}%\n2️⃣ ATR התכווץ (${zone.atrSlope.toFixed(4)}), נפח ירד\n3️⃣ ${zone.highTouches} נגיעות בתקרה, ${zone.lowTouches} ברצפה\n4️⃣ פריצה נפיצה למטה (${minRangeMultiplier}x ATR, ${minVolSpike}x נפח)\n💡 כניסה: ${expectedEntry.toFixed(2)} | SL: ${stopLoss.toFixed(2)} | ציון לחץ: ${pressureScore}`,
        breakoutIndex: breakout.breakoutIndex,  // נר הפריצה נשמר כאן במקום
      },
    })

    console.log(`   ✅ Compression Breakout #${patterns.length} (pressure: ${pressureScore}, direction: ${direction})`)
  }

  console.log(`   📊 Total compression breakout patterns: ${patterns.length}`)
  return patterns
}

# CSV Upload Feature - Guide

## Overview

The trading simulator now supports **uploading your own CSV files** from TradingView (or other platforms) to practice trading on real market data with **automatic pattern detection**!

## Features

✅ Upload CSV files directly from the UI (no server file placement needed)
✅ Automatic parsing of TradingView export format
✅ **Intelligent pattern detection** - finds real Breakout, Retest, and Bull Flag patterns in your data
✅ Support for files with many technical indicators (POC, VAH, Delta, etc.) - uses only OHLCV
✅ Validates data before creating the game
✅ Works with any timeframe (1H recommended)

---

## How to Use

### Step 1: Export Data from TradingView

1. Open [TradingView](https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT)
2. Select your desired timeframe (1H recommended for best experience)
3. Click the **download/export** icon (📥)
4. Choose **"Export chart data"**
5. Select **CSV** format
6. Save the file to your computer

### Step 2: Upload in the Game

1. Start the trading simulator
2. On the **start screen**, you'll see a new section: **"העלה קובץ היסטוריה מ-TradingView"**
3. Click the **"בחר CSV"** button
4. Select your exported CSV file
5. You'll see: **"✓ filename.csv"** (green confirmation)
6. Click **"התחל עם קובץ שלי"** to start the game

### Step 3: Play with Real Data!

The game will:
- Parse your CSV file (extracts OHLCV from all columns)
- **Automatically detect 8 technical patterns** in the real data:
  - ~3-4 Breakout patterns
  - ~2-3 Retest patterns
  - ~2 Bull Flag patterns
- Create a game with up to 500 candles
- Let you practice pattern recognition on **real market movements**!

---

## Supported CSV Formats

### TradingView Export (Full Format)

The system handles TradingView exports with **all technical indicators** and extracts only what's needed:

```csv
time,open,high,low,close,POC,VAH,VAL,Prev POC,Daily POC,Weekly POC,Monthly POC,Delta,Buy Pressure %,Sell Pressure %,Imbalance,Volume Ratio,CVD,OFI,VWDM,Volume
2024-01-01 00:00,42000.00,42150.00,41900.00,42050.00,42000,42100,41950,41900,42000,41800,41500,150,52.5,47.5,5.0,1.11,2500,125,42025,1250.5
2024-01-01 01:00,42050.00,42180.00,42020.00,42100.00,42080,42150,42030,42000,42050,41850,41520,180,53.2,46.8,6.4,1.14,2680,142,42085,1180.3
```

**Used columns:** `time`, `open`, `high`, `low`, `close`, `volume`
**Ignored columns:** All the technical indicators (POC, VAH, VAL, Delta, etc.)

### Simple OHLCV Format

Also works with basic exports:

```csv
time,open,high,low,close,volume
2024-01-01 00:00:00,42000.50,42150.25,41900.00,42100.75,1250.5
2024-01-01 01:00:00,42100.75,42200.00,42050.00,42180.25,1180.3
```

### Binance Format

```csv
timestamp,open,high,low,close,volume
1704067200000,42000.50,42150.25,41900.00,42100.75,1250.5
1704070800000,42100.75,42200.00,42050.00,42180.25,1180.3
```

---

## Pattern Detection Algorithm

The system uses **intelligent algorithms** to find real patterns in your data:

### 1. Breakout Detection
- Scans for consolidation ranges (10-20 candles with <3% movement)
- Identifies breakout candles (>0.3% move outside range)
- Confirms continuation (at least 3 of 5 following candles continue the move)
- **Quality score:** 70-95 based on consolidation tightness

### 2. Retest Detection
- Finds strong upward moves (2-10% over 5-10 candles)
- Detects pullbacks to support (30-70% Fibonacci retracement)
- Confirms bounce (4 of 5 candles must recover)
- **Quality score:** 75-95 based on Fibonacci level precision

### 3. Bull Flag Detection
- Identifies strong pole (3-15% upward move)
- Finds flag consolidation (<4% range, below pole top)
- Confirms breakout (3 of 4 candles break flag high)
- **Quality score:** 65-95 based on pole strength

**Pattern spacing:** Minimum 30 candles between patterns to avoid overlap

---

## Requirements

- **Minimum candles:** 100 (recommended: 500+)
- **File size:** Up to 10MB
- **Format:** CSV with proper OHLC columns
- **Timeframe:** Any (1H recommended for optimal game experience)

---

## Example: Testing Locally

A sample CSV file is included in `test-data/sample_tradingview.csv` with 50 candles of realistic BTC data (with all TradingView indicators).

You can use this file to test the feature:
1. Start the game
2. Click "בחר CSV"
3. Navigate to `test-data/sample_tradingview.csv`
4. Upload and play!

---

## Troubleshooting

### "Invalid CSV format" error
- Check that your file has a header row with column names
- Ensure columns include: `time` (or `timestamp`), `open`, `high`, `low`, `close`
- Volume column is optional

### "Insufficient data" error
- Your CSV has less than 100 candles
- Download more historical data from TradingView (zoom out to show more candles)

### "No patterns detected" warning
- Your data might not contain clear patterns
- Try a different time period or asset
- Ensure you have at least 150+ candles for pattern detection

### File upload fails
- Check file size (max 10MB)
- Ensure file extension is `.csv`
- Try re-exporting from TradingView

---

## Technical Details

### Backend Processing

1. **CSV Parser** (`historyLoader.ts`):
   - Auto-detects CSV format (TradingView, Binance, Generic)
   - Parses timestamps (ISO dates, Unix seconds/ms)
   - Validates OHLC logic (high ≥ low, etc.)
   - Filters invalid rows

2. **Pattern Detector** (`patternDetector.ts`):
   - Scans entire dataset for patterns
   - Calculates expected entry/exit points
   - Assigns quality scores (70-95)
   - Ensures patterns don't overlap

3. **Game Controller** (`gameController.ts`):
   - Receives file via Multer middleware
   - Creates game state with detected patterns
   - Returns to client for gameplay

### API Endpoint

```
POST /api/game/upload-csv
Content-Type: multipart/form-data

Body: csvFile (File)

Response: {
  game: {
    id: string,
    candles: Candle[],
    patterns: Pattern[], // Auto-detected!
    ...
  }
}
```

---

## Advantages Over Synthetic Data

✅ **100% realistic price action** - No artificial smoothing
✅ **Real support/resistance levels** - Learn from actual market structure
✅ **Authentic volatility** - Experience real market conditions
✅ **Pattern recognition practice** - The detector finds REAL patterns, not injected ones
✅ **Professional training** - Same data professional traders analyze

---

## Future Enhancements

Planned features:
- [ ] Support for more pattern types (Head & Shoulders, Double Top/Bottom)
- [ ] Pattern quality filtering (only show high-quality patterns)
- [ ] Multi-timeframe analysis
- [ ] Pattern heatmap visualization
- [ ] Export detected patterns to JSON

---

**Ready to practice on real market data? Upload your CSV and start trading!** 🚀

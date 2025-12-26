# How to Use Real Bitcoin Historical Data

## Quick Start

The trading simulator now supports loading **real Bitcoin price data** from CSV files instead of using synthetic (artificial) candles!

### Step 1: Download Bitcoin Data

Choose one of these options:

#### Option 1: TradingView (Easiest, Best Quality)

1. Visit [TradingView Bitcoin Chart](https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT)
2. Click the **timeframe** button and select **1H** (1 hour)
3. Click the **export** icon (📊 download button) at the top
4. Select "Export chart data"
5. Choose "CSV" format
6. Save the file

#### Option 2: Binance Historical Data

1. Visit [Binance Data Portal](https://www.binance.com/en/landing/data)
2. Choose "Spot" → "BTCUSDT"
3. Select "1h" (hourly) interval
4. Download the ZIP file
5. Extract the CSV file

#### Option 3: Crypto Data Download

1. Visit [CryptoDataDownload - Binance](https://www.cryptodatadownload.com/data/binance/)
2. Download "Binance_BTCUSDT_1h.csv"

### Step 2: Place the File in the Correct Location

Rename your downloaded CSV file to **`btc_1h.csv`** and place it in:

```
server/data/btc_1h.csv
```

**Full path example:**
```
technical-trading-simulator/
└── server/
    └── data/
        └── btc_1h.csv   ← Put your file here
```

### Step 3: Restart the Server

If the server is already running, restart it:

```bash
cd server
npm run dev
```

You should see this message in the console:

```
✅ Using real historical data (XXXX candles available)
```

If you see this instead:

```
ℹ️  No real data found, generating synthetic candles
```

Then the CSV file was not found. Check the file name and location.

## Supported CSV Formats

The system automatically detects these formats:

### Format 1: TradingView Export

```csv
time,open,high,low,close,volume
2024-01-01 00:00:00,42000.50,42150.25,41900.00,42100.75,1250.5
2024-01-01 01:00:00,42100.75,42200.00,42050.00,42180.25,1180.3
```

### Format 2: Binance API Export

```csv
timestamp,open,high,low,close,volume
1704067200000,42000.50,42150.25,41900.00,42100.75,1250.5
1704070800000,42100.75,42200.00,42050.00,42180.25,1180.3
```

### Format 3: Generic OHLCV (No Header)

```csv
1704067200,42000.50,42150.25,41900.00,42100.75,1250.5
1704070800,42100.75,42200.00,42050.00,42180.25,1180.3
```

## Requirements

- **Minimum candles:** 500 (recommended: 1000+)
- **Timeframe:** 1 hour (1H) for best game experience
- **Columns:** Must include time, open, high, low, close (volume optional)

## Alternative File Names

If you can't name it `btc_1h.csv`, the system will also check for:

- `server/data/history.csv`
- `server/btc_history.csv` (in the server root directory)

## Benefits of Real Data

✅ **100% realistic candle patterns** - No artificial movements
✅ **Real market volatility** - Authentic price action
✅ **Actual support/resistance levels** - Learn from real charts
✅ **Professional practice** - Train on the same data pros use

## Troubleshooting

### "No real data found" message

1. Check file location: Must be in `server/data/btc_1h.csv`
2. Check file name: Must be exactly `btc_1h.csv` (lowercase)
3. Check file format: Must be CSV with proper columns
4. Restart the server after adding the file

### "Real data found but only X candles" message

Your CSV file doesn't have enough data. Download more historical data (at least 500-1000 candles).

### Server crashes when loading CSV

The CSV might have invalid data. Check for:
- Empty rows
- Missing values
- Invalid numbers (text in number columns)
- Incorrect date/time format

## Example: Quick Test with Sample Data

Create a minimal test file at `server/data/btc_1h.csv`:

```csv
time,open,high,low,close,volume
2024-01-01 00:00:00,42000,42100,41900,42050,1000
2024-01-01 01:00:00,42050,42150,42000,42100,1100
2024-01-01 02:00:00,42100,42200,42050,42150,1050
```

(Add at least 500 similar rows for a full game)

## What Happens to Pattern Detection?

The system still generates technical patterns (Breakout, Retest, Bull Flag) by **injecting them into the real data** at random positions. This gives you the best of both worlds:

- Real market data for realistic price movement
- Embedded patterns for learning pattern recognition

---

**Ready to trade with real data? Follow the steps above and start the server!** 🚀

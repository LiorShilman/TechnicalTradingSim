# Chart Features Guide

## Overview

The TradingChart component now includes advanced features for professional chart analysis:

## ✅ Volume Display

### Features:
- **Histogram display** at the bottom 28% of the chart (clearly separated from price)
- **Enhanced visual separation** - Thick gradient blue line (4px) at 72% height dividing price and volume
- **Color-coded bars:**
  - 🟢 Green (semi-transparent) - Bullish candles (close ≥ open)
  - 🔴 Red (semi-transparent) - Bearish candles (close < open)
- **MA 20 overlay** - Thick blue line (3px) showing 20-period moving average of volume
  - **Behind volume bars** for better visibility
  - **Starts from bar 20** - Only calculated when 20 candles are available
- **Real-time updates** - Volume and MA update with each new candle
- **Separate price scale** - Volume has its own Y-axis

### Technical Details:
- Volume occupies bottom 28% of chart height (72% from top)
- Price candles occupy top 70% of chart height (30% margin at bottom)
- Clear visual separation with blue border line at 72%
- MA created **before** histogram so it renders behind the bars
- MA calculation adapts to available candles (not just 20+)
- Uses `addHistogramSeries()` with custom `priceScaleId`
- MA uses `addLineSeries()` (lineWidth: 3) with same `priceScaleId` as volume
- Colors: `#00c85380` (green), `#ff174480` (red) with 50% opacity, `#2962FF` (MA blue, thick)

## ✅ Interactive Controls

### Mouse & Keyboard:
- **Scroll/Drag:** Pan horizontally through time
- **Mouse Wheel:** Zoom in/out on time axis
- **Ctrl + Mouse Wheel:** Zoom in/out on price axis
- **Drag Price Scale:** Adjust price range manually
- **Double Click:** Reset zoom to auto-scale

### Control Buttons:
All chart control buttons are located in the **top control bar** (header):

1. **📏 התאם (Fit Content)** - Blue button
   - Automatically fits all visible candles to screen
   - Use when: Chart is zoomed too far in/out

2. **🔍 איפוס (Reset Zoom)** - Purple button
   - Resets both time and price scales
   - Returns to default view with auto-scaling enabled
   - Use when: Chart view is misaligned

### Quick Trading Buttons:
Located in the **top control bar** (header), right side:

1. **BUY LONG** - Green button
   - Quick buy 0.01 BTC LONG position
   - Click for instant market order

2. **SELL SHORT** - Red button
   - Quick sell 0.01 BTC SHORT position
   - Click for instant market order

## ✅ Auto-Scaling

### Price Auto-Scale:
- Automatically adjusts price range to fit visible candles
- Maintains 10% margin at top and 30% margin at bottom (for volume)
- Triggered when:
  - New candles appear
  - User scrolls to different time range
  - Chart is resized

### Edge Detection:
- Prevents zooming too far out (minimum bar spacing: 3px)
- Prevents scrolling beyond data bounds
- Smooth scroll behavior when reaching edges

## ✅ Asset & Timeframe Display

The chart header displays:
- **Asset Name:** Customizable (e.g., "BTC/USD", "ETH/USD")
- **Timeframe:** Shows selected interval (1m, 5m, 15m, 30m, 1H, 4H, 1D, 1W)

Both are configurable when uploading CSV files.

## ✅ Pattern Markers (When Enabled)

Visual indicators for detected patterns:
- **⚡ Breakout** - Gold color (#FFD700)
- **🔄 Retest** - Cyan color (#00CED1)
- **🚩 Bull Flag** - Pink color (#FF69B4)

Patterns are highlighted with:
- Dashed lines at top and bottom of pattern range
- Arrow markers at pattern start
- Legend in top-left showing detected patterns

## Configuration Options

### Chart Layout:
```typescript
layout: {
  background: '#0a0e27', // Dark blue background
  textColor: '#e8eaed',  // Light gray text
}
```

### Grid:
```typescript
grid: {
  vertLines: '#1e2442', // Subtle vertical lines
  horzLines: '#1e2442', // Subtle horizontal lines
}
```

### Time Scale:
```typescript
timeScale: {
  timeVisible: true,      // Show time labels
  secondsVisible: false,  // Hide seconds
  rightOffset: 5,         // Space on right side
  barSpacing: 8,          // Space between candles
  fixLeftEdge: false,     // Allow free scrolling
  fixRightEdge: false,    // Allow free scrolling
}
```

### Interaction:
```typescript
handleScale: {
  mouseWheel: true,  // Zoom with wheel
  pinch: true,       // Zoom with pinch (mobile)
}

handleScroll: {
  mouseWheel: true,        // Scroll with wheel
  pressedMouseMove: true,  // Drag to scroll
  horzTouchDrag: true,     // Touch drag (mobile)
}
```

## Volume Configuration

### Histogram Series:
```typescript
{
  color: '#26a69a',        // Default teal (unused - overridden per bar)
  priceFormat: {
    type: 'volume',        // Volume formatting
  },
  priceScaleId: '',        // Separate scale
}
```

### Scale Margins:
```typescript
// Volume scale (bottom 30%)
volumeSeries.priceScale().applyOptions({
  scaleMargins: {
    top: 0.7,    // Starts at 70% from top
    bottom: 0,   // Ends at bottom
  },
})

// Price scale (top 70%)
candlestickSeries.priceScale().applyOptions({
  scaleMargins: {
    top: 0.1,    // 10% margin at top
    bottom: 0.3, // 30% reserved for volume
  },
})
```

## Responsive Design

- **Auto-resize** on window resize
- **Maintains aspect ratio** of candlesticks
- **Preserves zoom level** during resize
- **Smooth animations** for all interactions

## Performance Optimizations

- **Incremental updates** - Only new candles are added, not full redraw
- **Efficient rendering** - Lightweight Charts library (TradingView)
- **Debounced resize** - Prevents excessive redraws
- **Lazy pattern markers** - Only rendered when visible

## Troubleshooting

### Volume not visible?
- Check that CSV has `volume` column
- Verify volume values are > 0
- Try clicking "📏 התאם" button

### Chart too zoomed in/out?
- Click "🔍 איפוס" to reset
- Use mouse wheel to adjust zoom
- Click "📏 התאם" to fit all data

### Can't scroll to beginning/end?
- Edge protection is active (prevents scrolling beyond data)
- This is intentional behavior

### Colors look wrong?
- Volume uses semi-transparent colors by design
- Green/red match candlestick colors for consistency

---

**All chart features are fully functional and tested!** 🎨📊

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **technical trading simulation game** for learning pattern recognition and realistic trading practice. Built as a monorepo with React (Vite + TypeScript) frontend and Express (TypeScript) backend.

**Key Concept**: The game uses all candles loaded from the CSV file (no limit) with embedded technical patterns (Breakout, Retest, Bull Flag). Players progress manually or automatically through candles, make LONG/SHORT trades, and receive feedback on pattern recognition quality and trade timing.

**NEW: CSV Upload Feature**: The system now supports **uploading CSV files directly from the UI**! Users can export data from TradingView (with all technical indicators) and upload it through the start screen. The system automatically:
- Parses TradingView CSV format (extracts OHLCV, ignores indicators like POC, VAH, Delta, etc.)
- **Auto-detects asset name and timeframe** from TradingView export filenames (e.g., "SP_SPX, 1D_07c94.csv" → SP/SPX, 1D)
  - **Read-only display**: Asset and timeframe shown as non-editable with visual indicators
  - Asset parsed from filename or CSV content
  - Timeframe detected from filename or calculated from candle intervals
- **Detects real patterns** (Breakout, Retest, Bull Flag) in the uploaded data using intelligent algorithms
- Creates a game with detected patterns for realistic training
- **Pattern visualization**: Displays detected patterns on charts with colored boxes and markers
See `CSV_UPLOAD_GUIDE.md` for detailed user instructions.

**LEGACY: File-based Real Data Support**: Still supports loading from `server/data/btc_1h.csv`. See `HOW_TO_USE_REAL_DATA.md`.

## Development Commands

### Client (React + Vite)
```bash
cd client
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Build for production (TypeScript + Vite)
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Server (Express + TypeScript)
```bash
cd server
npm install          # Install dependencies
cp .env.example .env # Create environment file
npm run dev          # Start dev server with hot-reload (http://localhost:5000)
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled production server
```

### Quick Start
Run in two terminals:
1. `cd server && npm run dev`
2. `cd client && npm run dev`

Test server health: `curl http://localhost:5000/api/health`

## Architecture

### Monorepo Structure
- **client/**: React frontend (state managed with Zustand)
- **server/**: Express REST API backend
- **Shared types**: Duplicated in `client/src/types/game.types.ts` and `server/src/types/index.ts` (keep in sync)

### Key Architectural Patterns

#### State Management (Client)
- **Zustand store** at `client/src/stores/gameStore.ts` manages global game state
- Store actions: `initializeGame()`, `nextCandle()`, `executeTrade()`, `resetGame()`
- Components consume state via `useGameStore()` hook
- API calls are made from store actions, not components

#### Data Flow
1. **Game Init**: Client → `POST /api/game/new` → Server generates 500 candles + 8 patterns → Returns initial state
2. **Next Candle**: Client → `POST /api/game/:id/next` → Server reveals next candle, updates positions PnL (LONG/SHORT) → Returns updated state + feedback
3. **Trade**: Client → `POST /api/game/:id/trade` → Server opens/closes LONG or SHORT position → Returns position + account + feedback

#### Server Architecture
- **In-memory storage**: Games stored in `Map()` in `gameController.ts` (no database currently)
- **Pattern Generation**: `patternGenerator.ts` creates technical patterns (currently stub implementations)
- **Candle Generation**: `candleGenerator.ts` generates realistic OHLCV data
- **Game Logic**: All in `gameController.ts` - manages positions, calculates PnL, evaluates trade quality

### Critical Files

**Server:**
- `server/src/server.ts` - Express app entry point, CORS, routes
- `server/src/routes/gameRoutes.ts` - API endpoints (`/new`, `/:id`, `/:id/next`, `/:id/trade`, `/:id/pending-order`, `/:id/pending-order/:orderId`)
- `server/src/controllers/gameController.ts` - Core game logic, in-memory storage
- `server/src/services/patternGenerator.ts` - Generates Breakout/Retest/Flag patterns
- `server/src/services/candleGenerator.ts` - Generates realistic candle data
- `server/src/types/index.ts` - Shared TypeScript types

**Client:**
- `client/src/stores/gameStore.ts` - Zustand state management with localStorage persistence
- `client/src/services/api.ts` - Axios API client with interceptors
- `client/src/services/telegramNotifications.ts` - Telegram Bot API service for sending alerts
- `client/src/services/priceAlertsService.ts` - Price alerts management with crossing detection
- `client/src/types/game.types.ts` - Shared TypeScript types (duplicate of server types)
- `client/src/components/Chart/TradingChart.tsx` - Lightweight Charts integration with pattern visualization, drawing tools, and dynamic MA series management
- `client/src/components/Chart/ChartToolsPanel.tsx` - Unified panel for indicators (unlimited MAs) and drawing tools with selection
- `client/src/components/Chart/IndicatorControls.tsx` - MA settings panel with Add/Remove functionality and color customization
- `client/src/components/Settings/AlertSettings.tsx` - Unified alerts panel with Telegram config and price alerts (tabbed interface)
- `client/src/components/Trading/OrderPanel.tsx` - Buy/Sell interface with advanced SL/TP and risk management
- `client/src/components/Trading/AccountInfo.tsx` - Real-time account balance and P&L display
- `client/src/components/Trading/PositionsList.tsx` - Displays open positions with edit and close functionality
- `client/src/components/Trading/PendingOrdersList.tsx` - Displays and manages pending orders with edit and cancel functionality
- `client/src/components/Trading/EditPositionModal.tsx` - Modal for editing SL/TP on positions and pending orders
- `client/src/components/Stats/GameStats.tsx` - End-game statistics display
- `client/src/App.tsx` - Main app with CSV upload, filename parsing, and balance persistence

### Technology Stack

**Frontend:**
- React 18 + TypeScript
- Vite (build tool, dev server)
- Lightweight Charts (TradingView charting library)
- Tailwind CSS (utility-first styling)
- Zustand (lightweight state management)
- Axios (HTTP client)
- Lucide React (icons)

**Backend:**
- Node.js + Express
- TypeScript (with tsx for dev hot-reload)
- UUID (game ID generation)
- CORS (cross-origin requests)
- dotenv (environment variables)

## Type System

### Core Data Structures

**Candle**: OHLCV data with Unix timestamp
```typescript
{ time: number, open: number, high: number, low: number, close: number, volume: number }
```

**Pattern**: Technical pattern metadata
- Contains: type, startIndex, endIndex, expectedEntry, expectedExit, stopLoss
- Metadata: quality (0-100), description, optional hint
- Types: 'breakout' | 'retest' | 'flag'

**Position**: Trading position (open or closed)
- Type: 'long' | 'short'
- Tracks: entry/exit price, time, index, quantity
- PnL calculated: currentPnL, currentPnLPercent (live, inverted for SHORT), exitPnL (realized)
- Pattern entry tracking: patternType, entryQuality (0-100)

**GameState**: Complete game state
- Contains: candles array, patterns, currentIndex (which candle visible)
- Account: balance, equity, realized/unrealized PnL
- Positions: open positions, closedPositions history
- Stats: win rate, profit factor, pattern recognition score, etc.
- Feedback: array of feedback messages with type/timestamp

**Important**: Types are duplicated between client and server. When modifying types, update both files.

## Game Logic

### Pattern Generation
Patterns are embedded in the 500-candle sequence (8 patterns total):
1. **Breakout**: Consolidation (10-15 candles) → Breakout candle (1.5-2.5% move) → Continuation (0.5-1.3% per candle)
2. **Retest**: Breakout (0.8-1.6% per candle) → Pullback to broken level → Bounce continuation (1-1.8% per candle)
3. **Bull Flag**: Strong upward pole (1.2-2.2% per candle) → Downward consolidation flag → Breakout continuation (1.2-2.2% per candle)

Pattern metadata includes expected entry/exit prices for quality scoring. Price movements are realistic (0.5-2.5% per candle).

### Feedback System
Server evaluates trades and generates feedback:
- Pattern hints: "Breakout pattern forming..."
- Trade quality: "Good entry! Caught early" vs "Late entry - pattern played out"
- Entry quality scored 0-100 based on proximity to expectedEntry
- Stored in `feedbackHistory` and displayed real-time

### PnL Calculation
- **Unrealized PnL**: Updated every candle based on current close price vs entry
  - LONG: profit when price goes up (`priceDiff * quantity`)
  - SHORT: profit when price goes down (`-priceDiff * quantity`)
- **Realized PnL**: Calculated on position close, added to account balance
- **Equity**: balance + unrealized PnL of all open positions (displayed prominently in real-time)

### Game Progression
- Player sees first 50 candles initially (starts at index 49)
- Clicks "Next" to reveal next candle OR uses Auto-Play with configurable speed
- Opens LONG positions with "Buy Long" button
- Opens SHORT positions with "Sell Short" button
- Closes positions with "Close" button (professional design with XCircle icon)
- Game ends when reaching last candle, shows GameStats
- Can save game state at any time and resume later from same point (including open positions)

### Advanced Trading Features (OrderPanel)
The OrderPanel (`OrderPanel.tsx`) provides professional trading capabilities:

**Basic Trading:**
- Quantity input with 0.001 BTC precision (supports fractional crypto trading)
- **Smart default quantity**: Automatically set to 1% of account equity on game load
  - Example: $13,000 account, $5,000 SNP price → 0.026 SNP (1% = $130)
  - Prevents hardcoded 0.1 BTC default (which would be $5,000 position = 38% of account)
- Real-time total value calculation and portfolio percentage display
- Current price display with live updates
- **Scrollable panel**: `max-h-[calc(100vh-100px)] overflow-y-auto` allows access to all settings

**Advanced Settings (Expandable):**
- **Stop Loss**: Percentage-based SL with live price calculation
- **Take Profit**: Percentage-based TP with live price calculation
- **Risk-Reward Ratio Display**: Automatically calculates and displays R:R ratio (1:X format)
  - Color coded: Green (≥2:1 excellent), Yellow (≥1:1 acceptable), Red (<1:1 poor)

**Risk Management:**
- Maximum risk per trade (% of account equity)
- Default: 2% (professional trading standard for risk management)
- Real-time risk calculation in dollars and percentage
- Recommended position size calculator based on risk parameters
- Risk warning when position size exceeds configured risk tolerance
- Auto-calculate button to use recommended quantity
- **Auto-quantity from risk**: When Risk Management is enabled, quantity automatically updates to recommended value
  - Triggers on: Risk Management toggle, Risk% change, Stop Loss% change, Stop Loss toggle
  - Formula: `(Equity × Risk%) / (Price × SL%)`
  - Example: $10,000 equity, 1% risk, $50,000 price, 2% SL → 0.1 BTC
  - Updates in real-time as you adjust risk/SL parameters
- **Persistent Preferences**: SL%, TP%, Risk%, and checkbox states saved to localStorage
  - Auto-saves whenever values or checkboxes change
  - Restored on next session (including enabled/disabled state of SL, TP, Risk Management)
  - Allows users to set their preferred trading parameters once
  - Example: If user enables SL with 2% and TP with 5%, next game starts with those exact settings

**Technical Implementation:**
- Uses `useRef` to freeze SL/TP/RR values during price changes (prevents UI flicker)
- Values only recalculate when user changes settings, not on every candle
- For SHORT positions: SL/TP prices are inverted automatically
- Trading preferences saved to localStorage via useEffect on change
- `useEffect` hook (lines 285-290) auto-updates quantity when risk parameters change
- `useEffect` hook (lines 300-308) sets smart default quantity on game load (1% of equity)

## Configuration

### Default Game Settings
- **CSV Upload Required**: Game MUST start with a CSV file upload (random/synthetic data option removed)
- Asset: BTC/USD (auto-detected from CSV filename if uploaded)
- Timeframe: 1H (auto-detected from CSV filename if uploaded)
- Initial balance: $10,000 (adjustable in start screen, persists via localStorage)
- Total candles: All candles from uploaded CSV (no limit)
- Visible candles: 100 (window size)
- Initial visible index: 49 (first 50 candles shown)
- Total patterns: 8 (distributed throughout the game)
- Auto-play speeds: 0.5s, 1s, 2s, 3s (configurable)
- Quantity precision: 0.001 BTC minimum (supports fractional crypto trading)

### Environment Variables
Server uses `.env` file (copy from `.env.example`):
- `PORT=5000` - Server port
- `NODE_ENV=development` - Environment mode

Client uses Vite proxy in development (configured in `vite.config.ts`) to avoid CORS.

## Development Notes

### TypeScript Configuration
- Both client and server use `"type": "module"` in package.json
- ES modules with `.js` extensions in imports (TypeScript requirement for ES modules)
- Server uses `tsx watch` for hot-reload during development

### CSS and Scrolling
- **Global body overflow**: `client/src/index.css` sets `body { overflow: auto }` to enable page scrolling
  - **IMPORTANT**: Never set `overflow: hidden` on body - this prevents all scrolling in the app
  - Start screen and other full-page views rely on body scroll for accessibility
- **Component-level scrolling**: Individual panels (ChartToolsPanel, IndicatorControls) use `overflow-y-auto` with max-height constraints
- **Custom scrollbar**: Defined in index.css with dark theme styling (8px width, dark colors)

### State Synchronization
Client state is derived from server responses. Never modify state locally without server call:
- Candles: Server controls revelation (client just displays)
- Positions: Server calculates PnL (client displays current values)
- Account: Server manages balance/equity (client is read-only)

### Pattern Generator Implementation
Currently stub implementations in `patternGenerator.ts`. When implementing:
- Modify candles array in-place at startIndex
- Return Pattern object with accurate expectedEntry/Exit based on generated candles
- Set quality (0-100) based on pattern clarity
- Include Hebrew hints in metadata.hint for educational feedback

### Error Handling
- Client: Axios interceptor catches errors, extracts `response.data.message`
- Server: Express error middleware catches unhandled errors
- Store errors in `gameStore.error`, display to user via toast notifications
- **CRITICAL**: Errors do NOT reset the game or reload from localStorage
  - Previous bug #1: errors caused `gameState` to become undefined, triggering game reset
  - Previous bug #2: App.tsx showed full-screen error with "Try Again" button that reloaded from localStorage
  - **Fix #1**: Only set `error` and `isLoading` in catch blocks, keeping `gameState` intact
  - **Fix #2**: Removed full-screen error UI - errors shown only as toast notifications
  - **Result**: When operations fail (insufficient funds, etc.), all positions and pending orders are preserved
  - Game continues normally after error - user can fix issue and continue playing

### Chart Integration
Lightweight Charts (TradingView) integration:
- Displays candlestick series with **dynamic price precision**:
  - **Crypto/Forex** (assets with '/'): 4 decimal places (e.g., BTC/USD, EUR/GBP → 1.2345)
  - **Stocks/Indices** (no '/'): 2 decimal places (e.g., SP/SPX → 5432.12)
  - Automatically detects asset type from `gameState.asset`
  - `minMove` calculated dynamically: 0.0001 for crypto/forex, 0.01 for stocks
- Chart instance managed in TradingChart component
- Data format: `{ time: number, open, high, low, close }` (seconds-based timestamps)
- Volume displayed as histogram series
- **Pattern visualization**: Displays detected patterns with colored boxes (green for Breakout, blue for Retest, purple for Bull Flag) and markers
- **Closed Trades Visualization**: Displays entry/exit markers and connection lines for completed trades
  - **Entry markers**: Green arrow up (🟢 Entry) for LONG, red arrow down (🔴 Entry) for SHORT
  - **Exit markers**: Circle with P&L text showing profit/loss amount and percentage
    - Green circle above bar for profitable trades (e.g., "+$52.30 (5.2%)")
    - Red circle below bar for losing trades (e.g., "-$23.10 (-2.3%)")
  - **Connection lines**: Solid lines connecting entry point to exit point
    - Green line for profitable trades (exitPnL > 0)
    - Red line for losing trades (exitPnL ≤ 0)
    - Line width: 2px, solid style (lineStyle: 0)
    - Only visible when both entry and exit have occurred (based on currentIndex)
    - Automatically updates when positions close or when progressing through candles
  - Markers only appear for trades that occurred at or before current candle index
  - Automatically updates when positions are closed or when progressing through candles
  - Integrated with pattern markers and drawing tools, sorted by time
- **Drawing Tools System** (ChartToolsPanel + TradingChart):
  - **Unified panel** combining indicators and drawing tools with tabbed interface
  - **Scrollable sections**: Both indicators and drawing tools sections have overflow-y-auto with max-height constraints
    - Panel container: `max-h-[calc(100vh-20px)]` to prevent exceeding viewport
    - Inner sections: `max-h-[calc(100vh-140px)]` for scrollable content areas
    - Drawing tools list: `max-h-48` to ensure drawn lines list remains visible below
  - **Moving Averages**: Dynamic unlimited MAs with Add/Remove functionality:
    - **Unlimited MAs**: Users can add as many moving averages as needed (no fixed limit)
    - **Add/Remove**: "הוסף" (Add) button to create new MAs, trash icon to delete each MA
    - Type selection: SMA (Simple Moving Average) or EMA (Exponential Moving Average)
    - Custom period: Any value from 1 to 500
    - **Color customization**: Each MA has unique color with color picker for customization
    - Automatic color assignment from predefined palette (8 colors)
    - Default settings: 3 MAs (20, 50, 200 SMA, all disabled by default)
    - Option to calculate from current index only (real-time simulation mode)
    - localStorage persistence with key 'trading-game-ma-settings-v3'
    - **Dynamic chart series management**: Series automatically created/removed based on MA list
  - **Eleven drawing tools** for technical analysis:
    1. **Horizontal Line**: Full-width line across entire chart (#FFD700 gold)
       - **Price alerts**: Bell icon (🔔) for enabling alerts when price crosses the line
       - Alert directions: Above (cross from above to below), Below (cross from below to above), Both
       - Visual notification: Toast message with gold border when alert triggers
       - One-time trigger: Alert disables after triggering (can be reset by changing direction)
    2. **Horizontal Ray**: Line extending right from click point (#00CED1 cyan)
       - **Price alerts**: Same alert functionality as Horizontal Line
    3. **Trend Line**: Two-point line between candles (#9C27B0 purple)
    4. **Rectangle**: Two-point colored rectangle with adjustable opacity (#8B5CF6 purple)
       - Click twice to define corners (diagonal points)
       - Filled with semi-transparent color (default opacity: 0.3)
       - Border frame highlights selected rectangles
       - Useful for marking support/resistance zones, consolidation areas
    5. **Arrow Up ↑**: Marker below candle for bullish signals (#4CAF50 green)
    6. **Arrow Down ↓**: Marker above candle for bearish signals (#F44336 red)
    7. **Fibonacci Retracement**: 7 levels (0, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%) between two points
    8. **Text Note**: Custom text marker on chart (#03A9F4 blue)
    9. **Measure Tool**: Two-point measurement showing price change ($), percentage (%), and number of bars (#FFD700 gold)
       - Displays: `Δ $XX.XX (±X.X%) | N bars`
       - Marker positioned at midpoint of measurement line
    10. **Long Position Simulator**: Interactive LONG trade planning tool with automatic SL/TP and visual profit/loss zones
       - Single-click on chart to place entry point
       - **Smart default SL/TP**: Automatically calculates SL/TP based on small percentage of entry price with 1:2 R:R ratio
         - SL distance = 0.5% of entry price (very small, relative to price)
         - TP distance = SL distance × 2 (for 1:2 R:R)
         - Example: Entry at $50,000 → SL at $49,750, TP at $50,500
       - **Visual lines**:
         - Entry: White dotted horizontal line
         - Stop Loss: Red dashed line below entry
         - Take Profit: Green dashed line above entry
       - **Colored profit/loss zones** (TradingView-style):
         - Green semi-transparent rectangle between Entry and TP (profit zone)
         - Red semi-transparent rectangle between Entry and SL (loss zone)
         - Zones rendered using HistogramSeries for proper fill display
       - **Info marker** displays: `LONG | R:R 1:X.XX | TP: +X.X% | SL: -X.X%`
       - All lines extend across entire visible chart
       - Selection highlighting: brightens all lines when selected
       - **Drag to adjust**: Click and drag SL or TP lines to new price levels
         - Cursor changes to ns-resize (⇕) when hovering over draggable lines
         - Real-time visual updates as lines are dragged
         - Zones automatically recalculate during drag
       - **Double-click to edit**: Double-click anywhere on the tool (near Entry/SL/TP lines) to open edit modal
         - Modal allows precise editing of SL and TP values
         - Real-time R:R ratio display in modal
         - Zones automatically update after saving changes
    11. **Short Position Simulator**: Interactive SHORT trade planning tool with automatic SL/TP and visual profit/loss zones
        - Single-click on chart to place entry point
        - **Smart default SL/TP**: Automatically calculates SL/TP based on small percentage of entry price with 1:2 R:R ratio (inverted for SHORT)
          - SL distance = 0.5% of entry price (very small, relative to price)
          - SL above entry, TP below entry (SHORT profits when price drops)
          - Example: Entry at $50,000 → SL at $50,250, TP at $49,500
        - **Visual lines**:
          - Entry: White dotted horizontal line
          - Stop Loss: Red dashed line above entry (inverted for SHORT)
          - Take Profit: Green dashed line below entry (inverted for SHORT)
        - **Colored profit/loss zones** (TradingView-style, inverted):
          - Blue semi-transparent rectangle between Entry and TP below (profit zone for SHORT)
          - Red semi-transparent rectangle between Entry and SL above (loss zone for SHORT)
          - Zones rendered using HistogramSeries with negative/positive values
        - **Info marker** displays: `SHORT | R:R 1:X.XX | TP: +X.X% | SL: -X.X%`
        - All lines extend across entire visible chart
        - Selection highlighting: brightens all lines when selected
        - **Drag to adjust**: Click and drag SL or TP lines to new price levels
          - Cursor changes to ns-resize (⇕) when hovering over draggable lines
          - Real-time visual updates as lines are dragged
          - Zones automatically recalculate during drag
        - **Double-click to edit**: Double-click anywhere on the tool (near Entry/SL/TP lines) to open edit modal
          - Modal allows precise editing of SL and TP values
          - Real-time R:R ratio display in modal
          - Zones automatically update after saving changes
  - **Professional selection highlighting**:
    - Click on drawn object in list to select it
    - Selected objects brightened using RGB color manipulation (+40 for lines, +50 for Fib, +60 for markers)
    - Selected line width increases (2→3 for lines, 1→2 for Fib, size 1→1.5 for markers)
    - List shows gradient background with left border for selected item
    - Delete button appears only for selected items (prevents accidental deletion)
  - **Crosshair behavior**: Mode 0 (normal) - smooth continuous movement without magnetism to candles
  - **Marker time ordering**: All markers (patterns + drawings) sorted by time before passing to lightweight-charts API
  - **localStorage persistence by file**: All drawn lines saved and restored across sessions
    - Storage key: `trading-game-drawings-${sourceFileName}` (per CSV file, not per game)
    - Drawings persist when loading same CSV file multiple times
    - Survives game resets and page refreshes
    - Debug logging: `💾 Saved N drawings`, `📐 Loaded N drawings`, `➕ Added tool`, `🗑️ Deleted line`
  - **Hebrew descriptions**: Each tool has Hebrew tooltip explaining its use
- **Pending Orders**: Right-click on chart to create pending order at exact price
  - Uses `candlestickSeriesRef.current.coordinateToPrice(relativeY)` for accurate price detection
  - The `coordinateToPrice` method is called on the series (not priceScale) to convert Y-coordinate to price
  - Price is captured at exact mouse Y-coordinate on chart
  - Context menu appears at click location with precise price for order entry
  - **Four order types** based on price direction:
    - **Buy Stop**: Long entry above current price (breakout)
    - **Buy Limit**: Long entry below current price (pullback)
    - **Sell Stop**: Short entry below current price (breakdown)
    - **Sell Limit**: Short entry above current price (retracement)
  - Orders execute only when price crosses target in correct direction (prevents instant execution)
  - **Visual pending order lines**: Horizontal dashed lines drawn from creation candle to current candle
    - Green for LONG orders, red for SHORT orders
    - Lines extend with each new candle (not from chart start)
  - **PendingOrdersList Component**: Professional UI displaying all pending orders in sidebar
    - Shows order type (Buy Stop/Limit, Sell Stop/Limit), direction (LONG/SHORT), target price, quantity
    - Displays distance from current price in both $ and %
    - Shows SL/TP values if defined (color-coded green/red)
    - Edit button to modify pending orders (Edit2 icon)
    - Cancel button with XCircle icon to delete pending orders
    - Color-coded by order type: green for buy orders, red for sell orders
    - Positioned between OrderPanel and PositionsList in sidebar
    - Scrollable if many orders exist
  - **PendingOrderMenu Component**: Context menu for creating pending orders with precise price-based controls
    - **Editable target price**: Price input field with 4 decimal precision (crypto/forex support)
      - User can modify the price after right-clicking on chart
      - Initial price from chart click is automatically rounded to 4 decimals (prevents floating-point display issues)
      - Price changes are also rounded to 4 decimals on input
      - All calculations (SL/TP/quantity/trade value) update dynamically when price changes
      - Real-time display of current price below for comparison
    - **Price-based SL/TP (NOT percentages)**: User enters exact prices
      - Stop Loss input: Exact price with 4 decimal precision
      - Take Profit input: Exact price with 4 decimal precision
      - Header shows calculated percentage distance for reference (color-coded: red for SL, green for TP)
      - Automatically validates based on position type (LONG: SL < entry < TP, SHORT: TP < entry < SL)
    - **Smart default quantity**: 1% of equity divided by target price
      - Example: $10,000 equity, $50,000 price → 0.002 BTC (not hardcoded 0.01)
      - Updates dynamically when target price changes
    - **Real-time trade value display**: Shows total position value (quantity × price) in header
      - Updates instantly as quantity or price changes
      - Helps user understand position sizing in dollar terms
    - **Auto-quantity calculation from risk**: Based on absolute price difference
      - Risk percentage input (default 2% of equity)
      - Formula: `quantity = (equity × risk%) / |targetPrice - stopLoss|`
      - Uses actual price distance, not percentage
      - "חשב" (Calculate) button applies recommended quantity
      - Button disabled until SL price is set
      - Real-time recommended quantity display below input field
    - **Position type preview**: LONG/SHORT buttons to preview position direction
      - Visual indicator of selected type (green for LONG, red for SHORT)
    - **4 decimal precision throughout**: All prices display with .toFixed(4) for forex/crypto
    - Centered modal (50% x/y with transform) with purple-themed risk section
    - Clean, professional UI with color-coded borders (red for SL, green for TP)

### Telegram Notifications & Price Alerts
The app supports free Telegram notifications and custom price alerts:

**Telegram Integration (`telegramNotifications.ts`):**
- Free Telegram Bot API for instant notifications to phone
- localStorage config persistence (bot token, chat ID, enabled state)
- HTML-formatted messages with emojis for visual clarity
- Test connection feature with success/error feedback
- Notification types:
  - Stop Loss hits (with P&L, entry/exit prices)
  - Take Profit hits (with P&L, entry/exit prices)
  - Position closures (manual, with P&L)
  - Pending order fills (order type, price, quantity)
  - Price alerts (crossing notifications)
  - Horizontal line alerts (when price crosses drawn lines with alerts enabled)

**Price Alerts System (`priceAlertsService.ts`):**
- TradingView-style price alerts with directional crossing detection
- Alert directions: Above (trigger when price crosses from below to above), Below (trigger when price crosses from above to below)
- One-time alerts: Auto-disable after triggering to prevent spam
- localStorage persistence for all alerts
- Alert properties: targetPrice, direction, enabled, createdAt, createdAtPrice, optional note
- Real-time checking during candle progression
- Integration with Telegram service for instant notifications

**AlertSettings Component (`AlertSettings.tsx`):**
- Unified panel combining Telegram config and price alerts
- Positioned at `top-[120px] left-4` with dynamic width (140px collapsed, 300px expanded)
- Smooth width transition animation with `transition-[width] duration-200 ease-out`
- Two-tab interface: "Telegram" and "Price Alerts"
- **Telegram Tab:**
  - Enable/disable toggle with visual slider
  - Bot Token and Chat ID input fields
  - "מדריך" (Guide) button linking to Telegram bot creation tutorial
  - Save and Test buttons with loading states
  - Success/error feedback messages with auto-dismiss (3s)
  - Info section listing all notification types
- **Price Alerts Tab:**
  - Add alert form with:
    - Price input (140px fixed width)
    - Direction select (flex-1 for responsive width)
    - Note input (optional, 50 char max) with margin-top spacing
    - Add button (Plus icon)
  - Alerts list (max-height: 320px, scrollable):
    - Toggle enable/disable (ToggleLeft/ToggleRight icons)
    - Target price display with direction arrow (↑/↓)
    - Optional note display (truncated)
    - Distance from current price ($ and %) with color coding (yellow if <1% away)
    - Delete button (Trash2 icon)
  - Current price display at bottom
  - Alerts sorted by price (descending)
- Green dot indicator when any alerts are enabled (Telegram or price alerts)
- Bell icon in header with yellow color
- Border: `border-2 border-yellow-600/40` for visual prominence

### Balance Persistence with localStorage
The app persists account balance across sessions using localStorage:
- Balance saved automatically after every trade execution
- Balance saved when SL/TP triggers during candle progression
- Saved balance carried over to new games
- Reset button available to clear balance and restart with default $10,000
- Implementation in `gameStore.ts`: saves `account.equity` to `localStorage.carryOverBalance`

### Save and Exit with Stats Display
The "שמור וצא" (Save and Exit) button provides comprehensive game statistics before returning to menu:

**Flow:**
1. User clicks "שמור וצא" button in ChartControls
2. `saveAndExit()` in gameStore saves game state to localStorage
3. After 500ms delay (for toast notification), sets `showStats: true`
4. GameStats modal appears with full statistics

**GameStats Modal Design:**
- **Wide horizontal layout** (`max-w-6xl` ≈ 1152px) instead of vertical
- **Compact header**: Trophy + title on left, total return (large %) on right
- **3-column grid layout**:
  - Column 1: Trading Performance (total trades, win rate, winning/losing trades)
  - Column 2: Risk Metrics (profit factor, max drawdown, avg win/loss)
  - Column 3: Advanced Metrics (Sharpe, Sortino, Calmar ratios)
- **Secondary row** (3 equal columns):
  - Pattern Recognition (recognition score + entry quality)
  - Best Trade (P&L display with pattern type)
  - Current Streak or Max Streaks (win/loss streaks)
- **Compact buttons**: Centered at bottom with reduced padding

**Modal Behavior:**
- **When game is complete** (`isComplete === true`):
  - Shows only "שחק שוב" (Play Again) button
  - Clicking it calls `resetGame()` and returns to start screen

- **When saved mid-game** (`showStats === true` but not `isComplete`):
  - Shows TWO buttons side-by-side:
    - "המשך לשחק" (Continue Playing): Sets `showStats: false`, returns to game
    - "שחק שוב" (Play Again): Calls `resetGame()`, starts fresh game

**State Management:**
- `showStats: boolean` in gameStore controls modal visibility
- `resetGame()` explicitly sets `showStats: false` to clear state
- Both `isComplete` and `showStats` trigger stats display: `{(gameState?.isComplete || showStats) && <GameStats />}`

**User Experience:**
- Wide layout prevents vertical overflow, fits better on screen
- Allows reviewing performance mid-game without losing progress
- Clear choice between continuing current game or starting new one
- Toast confirmation ("משחק נשמר בהצלחה! 💾") before stats appear

### Dynamic Moving Averages Architecture
The MA system supports unlimited moving averages with dynamic management:

**Data Structure:**
```typescript
interface MovingAverage {
  id: string        // unique identifier (e.g., "ma-1734567890")
  enabled: boolean  // visibility toggle
  type: 'SMA' | 'EMA'
  period: number
  color: string     // hex color for this MA
}

interface MASettings {
  movingAverages: MovingAverage[]
  startFromCurrentIndex: boolean
}
```

**Key Files:**
- `IndicatorControls.tsx`: MA settings panel with Add/Remove UI
  - `handleAddMA()`: Creates new MA with unique ID and auto-assigned color
  - `handleRemoveMA(id)`: Removes MA from array
  - `handleUpdateMA(id, updates)`: Updates specific MA properties
  - Default 3 MAs: 20, 50, 200 (SMA, disabled)
  - 8-color palette for auto-assignment
  - localStorage key: `trading-game-ma-settings-v3`

- `TradingChart.tsx`: Dynamic chart series management
  - `maSeriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map())`
  - `updateMASeriesVisibility()`: Core function that:
    - Creates new series for added MAs
    - Removes series for deleted MAs
    - Updates colors if changed
    - Recalculates data when enabled/disabled
  - Each MA series has unique color and visibility state

- `ChartToolsPanel.tsx`: Unified panel with indicators tab
  - Displays dynamic MA list with map() over movingAverages array
  - Shows color indicator, type/period summary
  - Expandable settings for each MA
  - Calculation mode checkbox

**Migration:**
- Previous versions (v1, v2) used fixed `ma1`, `ma2`, `ma3` properties
- v3 uses array-based structure for unlimited MAs
- No automatic migration - old settings ignored, defaults to 3 MAs

### Save/Load Game State
Complete game state is saved to localStorage and can be resumed:
- **What is saved**: positions, closed positions, pending orders, account balance, stats, feedback history, current candle index
- **Pending orders**: Fully preserved with all properties (type, orderType, targetPrice, createdAtIndex, SL/TP)
- **Save trigger**: Manual save via UI or automatic on exit
- **Load trigger**: Automatic on game start if saved file matches uploaded CSV
- **Validation**: Ensures saved game matches current file name and date range
- Console logs show saved/restored state including pending order count for debugging

### TradingView Filename Parsing
When uploading CSV files from TradingView, the system auto-detects asset and timeframe:

**Standard Format:**
- Filename format: `ASSET_TIMEFRAME_XXXXX.csv` (e.g., "SP_SPX_1D_07c94.csv", "BTCUSD_1H_abc123.csv")
- Handles commas and spaces in filenames: "SP_SPX, 1D_07c94.csv" → SP/SPX, 1D
- Timeframe patterns: 1m, 5m, 15m, 30m, 1H, 4H, 1D, 1W
- Asset formatting: Converts underscores to slashes (SP_SPX → SP/SPX)

**FOREX Format Support:**
- Filename format: `FX_EURGBP_240_XXXXX.csv` → EUR/GBP, 4H
- Timeframe in minutes: 1, 5, 15, 30, 60, 240, 1440 (1D), 10080 (1W)
- Auto-converts minutes to standard format: 240 → 4H, 60 → 1H, 1440 → 1D
- FOREX pair parsing: FX_EURGBP → EUR/GBP (splits 6-character pair in half)
- Also supports standalone FOREX pairs: EURGBP_240 → EUR/GBP, 4H

**Technical Implementation:**
- Two regex patterns: `/^\d+[DHmW]$/` for standard, `/^\d+$/` for FOREX minutes
- FOREX conversion logic in `App.tsx` lines 110-127
- Asset detection handles FX_ prefix and 6-character pairs (lines 133-159)
- Implementation in `App.tsx`: cleans filename with `.replace(/,\s*/g, '_')` before parsing
- Debug logging: `🔄 Converted FOREX timeframe: 240 minutes → 4H`

### RTL (Right-to-Left) Layout Support
The UI supports Hebrew text with proper RTL layout:
- Hebrew labels aligned right, numeric values aligned left using `dir="ltr"`
- Flexbox alignment: `justify-between` for label-value pairs, `justify-end` for right-aligned numbers
- Used throughout: OrderPanel, AccountInfo, GameStats components
- Number formatting: `toLocaleString()` with `maximumFractionDigits` for consistent decimal display

### Save/Load Game State
The system supports saving and resuming games:
- **Save**: Games are saved to localStorage with full state (positions, balance, stats, candles progress)
- **Auto-detect**: When uploading same CSV file, system detects matching saved game
- **Resume**: Restores exact state including currentIndex, positions, and account balance
- **Start Fresh**: "🗑️ התחל משחק חדש" button allows clearing saved game and starting fresh
- **Chart Loading**: Fixed to display all candles immediately on load (removed React.StrictMode double-rendering)
- **Initial State**: New games start with 50 candles visible (currentIndex: 49)
- Implementation: `gameStore.ts` handles save/load, `App.tsx` checks for matching saved games with useMemo
- Saved state includes: gameId, sourceFileName, sourceDateRange, currentIndex, positions, closedPositions, stats, feedbackHistory

### React Configuration
- **React.StrictMode removed** from `main.tsx` to prevent double-rendering issues with chart
- This was causing the TradingChart to mount → unmount → mount on game load
- Chart now loads correctly on first render when resuming saved games

### Asset Display
- Asset names displayed as full format (e.g., "SP/SPX", "BTC/USD") throughout UI
- Extracted from `gameState.asset` in OrderPanel, PositionsList, ChartControls
- Supports indices (SP/SPX), crypto (BTC/USD), and any other asset format
- Auto-detects from TradingView filenames and preserves full name

## Development Workflow

When adding features:
1. **Types first**: Update both `server/src/types/index.ts` and `client/src/types/game.types.ts`
2. **Server logic**: Implement in `gameController.ts` or relevant service
3. **API endpoint**: Add to `gameRoutes.ts` if new endpoint needed
4. **Client API**: Add method to `client/src/services/api.ts`
5. **Store action**: Add to `gameStore.ts` to handle state update
6. **UI component**: Create/update component to consume from store
7. **Test**: Run both dev servers, test in browser console + UI

When debugging:
- Server logs: Check terminal running `npm run dev`
- Client logs: Check browser Developer Console
- Network: Inspect API calls in browser Network tab
- State: Add `console.log(useGameStore.getState())` in components

## Code Style

- Hebrew comments are allowed and present in codebase
- Types: Always explicit, no `any` types
- Exports: Named exports preferred (except default for router/App)
- Error handling: Always wrap API calls in try-catch
- Async/await: Preferred over promises
- Console logs: Used extensively for debugging (remove in production)

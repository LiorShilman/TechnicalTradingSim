# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **technical trading simulation game** for learning pattern recognition and realistic trading practice. Built as a monorepo with React (Vite + TypeScript) frontend and Express (TypeScript) backend.

**Key Concept**: The game uses all candles loaded from the CSV file (no limit) with embedded technical patterns (Breakout, Retest, Bull Flag). Players progress manually or automatically through candles, make LONG/SHORT trades, and receive feedback on pattern recognition quality and trade timing.

**NEW: CSV Upload Feature**: The system now supports **uploading CSV files directly from the UI**! Users can export data from TradingView (with all technical indicators) and upload it through the start screen. The system automatically:
- Parses TradingView CSV format (extracts OHLCV, ignores indicators like POC, VAH, Delta, etc.)
- **Auto-detects asset name and timeframe** from TradingView export filenames (e.g., "SP_SPX, 1D_07c94.csv" → SP/SPX, 1D)
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
- `client/src/types/game.types.ts` - Shared TypeScript types (duplicate of server types)
- `client/src/components/Chart/TradingChart.tsx` - Lightweight Charts integration with pattern visualization
- `client/src/components/Trading/OrderPanel.tsx` - Buy/Sell interface with advanced SL/TP and risk management
- `client/src/components/Trading/AccountInfo.tsx` - Real-time account balance and P&L display
- `client/src/components/Trading/PendingOrdersList.tsx` - Displays and manages pending orders with cancel functionality
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
- Real-time total value calculation and portfolio percentage display
- Current price display with live updates

**Advanced Settings (Expandable):**
- **Stop Loss**: Percentage-based SL with live price calculation
- **Take Profit**: Percentage-based TP with live price calculation
- **Risk-Reward Ratio Display**: Automatically calculates and displays R:R ratio (1:X format)
  - Color coded: Green (≥2:1 excellent), Yellow (≥1:1 acceptable), Red (<1:1 poor)

**Risk Management:**
- Maximum risk per trade (% of account equity)
- Real-time risk calculation in dollars and percentage
- Recommended position size calculator based on risk parameters
- Risk warning when position size exceeds configured risk tolerance
- Auto-calculate button to use recommended quantity

**Technical Implementation:**
- Uses `useRef` to freeze SL/TP/RR values during price changes (prevents UI flicker)
- Values only recalculate when user changes settings, not on every candle
- For SHORT positions: SL/TP prices are inverted automatically

## Configuration

### Default Game Settings
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
- Displays candlestick series
- Chart instance managed in TradingChart component
- Data format: `{ time: number, open, high, low, close }` (seconds-based timestamps)
- Volume displayed as histogram series
- **Pattern visualization**: Displays detected patterns with colored boxes (green for Breakout, blue for Retest, purple for Bull Flag) and markers
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
    - Cancel button with XCircle icon to delete pending orders
    - Color-coded by order type: green for buy orders, red for sell orders
    - Positioned between OrderPanel and PositionsList in sidebar
    - Scrollable if many orders exist (max-h-80)

### Balance Persistence with localStorage
The app persists account balance across sessions using localStorage:
- Balance saved automatically after every trade execution
- Balance saved when SL/TP triggers during candle progression
- Saved balance carried over to new games
- Reset button available to clear balance and restart with default $10,000
- Implementation in `gameStore.ts`: saves `account.equity` to `localStorage.carryOverBalance`

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
- Filename format: `ASSET_TIMEFRAME_XXXXX.csv` (e.g., "SP_SPX_1D_07c94.csv", "BTCUSD_1H_abc123.csv")
- Handles commas and spaces in filenames: "SP_SPX, 1D_07c94.csv" → SP/SPX, 1D
- Timeframe patterns: 1m, 5m, 15m, 30m, 1H, 4H, 1D, 1W
- Asset formatting: Converts underscores to slashes (SP_SPX → SP/SPX)
- Implementation in `App.tsx`: cleans filename with `.replace(/,\s*/g, '_')` before parsing

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

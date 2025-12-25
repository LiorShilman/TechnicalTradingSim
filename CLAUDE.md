# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **technical trading simulation game** for learning pattern recognition and realistic trading practice. Built as a monorepo with React (Vite + TypeScript) frontend and Express (TypeScript) backend.

**Key Concept**: The game generates 100 candles with embedded technical patterns (Breakout, Retest, Bull Flag). Players progress manually through candles, make trades, and receive feedback on pattern recognition quality and trade timing.

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
1. **Game Init**: Client → `POST /api/game/new` → Server generates 100 candles + patterns → Returns initial state
2. **Next Candle**: Client → `POST /api/game/:id/next` → Server reveals next candle, updates positions PnL → Returns updated state + feedback
3. **Trade**: Client → `POST /api/game/:id/trade` → Server opens/closes position → Returns position + account + feedback

#### Server Architecture
- **In-memory storage**: Games stored in `Map()` in `gameController.ts` (no database currently)
- **Pattern Generation**: `patternGenerator.ts` creates technical patterns (currently stub implementations)
- **Candle Generation**: `candleGenerator.ts` generates realistic OHLCV data
- **Game Logic**: All in `gameController.ts` - manages positions, calculates PnL, evaluates trade quality

### Critical Files

**Server:**
- `server/src/server.ts` - Express app entry point, CORS, routes
- `server/src/routes/gameRoutes.ts` - API endpoints (`/new`, `/:id`, `/:id/next`, `/:id/trade`)
- `server/src/controllers/gameController.ts` - Core game logic, in-memory storage
- `server/src/services/patternGenerator.ts` - Generates Breakout/Retest/Flag patterns
- `server/src/services/candleGenerator.ts` - Generates realistic candle data
- `server/src/types/index.ts` - Shared TypeScript types

**Client:**
- `client/src/stores/gameStore.ts` - Zustand state management
- `client/src/services/api.ts` - Axios API client with interceptors
- `client/src/types/game.types.ts` - Shared TypeScript types (duplicate of server types)
- `client/src/components/Chart/TradingChart.tsx` - Lightweight Charts integration
- `client/src/components/Trading/OrderPanel.tsx` - Buy/Sell interface
- `client/src/components/Stats/GameStats.tsx` - End-game statistics display

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
- Tracks: entry/exit price, time, index, quantity
- PnL calculated: currentPnL, currentPnLPercent (live), exitPnL (realized)
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
Patterns are embedded in the 100-candle sequence:
1. **Breakout**: Consolidation (10-15 candles) → Large breakout candle → Continuation (3-5 candles)
2. **Retest**: Breakout → Pullback to broken level → Bounce continuation
3. **Bull Flag**: Strong upward pole → Downward consolidation flag → Breakout continuation

Pattern metadata includes expected entry/exit prices for quality scoring.

### Feedback System
Server evaluates trades and generates feedback:
- Pattern hints: "Breakout pattern forming..."
- Trade quality: "Good entry! Caught early" vs "Late entry - pattern played out"
- Entry quality scored 0-100 based on proximity to expectedEntry
- Stored in `feedbackHistory` and displayed real-time

### PnL Calculation
- **Unrealized PnL**: Updated every candle based on current close price vs entry
- **Realized PnL**: Calculated on position close, added to account balance
- **Equity**: balance + unrealized PnL of all open positions

### Game Progression
- Player sees first 20 candles initially
- Clicks "Next" to reveal next candle (server increments currentIndex)
- Opens positions with Buy button (creates Position)
- Closes positions with Sell button (calculates realized PnL)
- Game ends at candle 100, shows GameStats

## Configuration

### Default Game Settings
- Asset: BTC/USD
- Timeframe: 1H (hourly candles)
- Initial balance: $10,000
- Total candles: 100
- Visible candles: 50 (window size)
- Initial visible index: 19 (first 20 candles shown)

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
- Store errors in `gameStore.error`, display to user, clear with `clearError()`

### Chart Integration
Lightweight Charts (TradingView) integration:
- Displays candlestick series
- Chart instance managed in TradingChart component
- Data format: `{ time: number, open, high, low, close }` (seconds-based timestamps)
- Volume displayed as histogram series

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

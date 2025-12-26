# Performance Architecture - Re-render Optimization

## Problem Statement

The original implementation suffered from excessive re-renders:
- **Every candle update** (every second during auto-play) triggered re-renders across ALL components
- Components were subscribing to the entire gameState or multiple frequently-changing values
- Values like `currentPrice`, `equity`, `balance` updated with each candle, causing cascading re-renders
- Parent components passed frequently-updating props to children, forcing child re-renders

## Solution: Atomic Component Architecture

We refactored the entire UI to use **atomic components** that subscribe directly to the Zustand store for only the specific values they need to display.

### Key Principles

1. **Granular Subscriptions**: Each component subscribes to ONLY the values it displays
2. **Atomic Components**: Small, focused components that render a single piece of dynamic data
3. **Container Components**: Never re-render - only compose atomic children
4. **Lazy Value Fetching**: Get values from store only when needed (e.g., on button click), not continuously

## Refactored Components

### 1. OrderPanel (`client/src/components/Trading/OrderPanel.tsx`)

**Before:**
```typescript
// ❌ BAD: Subscribes to frequently changing values
const { currentPrice, accountEquity, accountBalance, ... } = useGameStore()

// This component re-renders EVERY candle because currentPrice changes!
```

**After:**
```typescript
// ✅ GOOD: Only subscribes to action functions (never change)
const executeTrade = useGameStore((state) => state.executeTrade)

// Gets current values ONLY when button is clicked
const handleBuyLong = async () => {
  const state = useGameStore.getState()
  const currentPrice = state.gameState?.candles[state.gameState.currentIndex]?.close ?? 0
  // ... use fresh value for trade execution
}

// Uses atomic child components for display
<CurrentPriceDisplay /> // Subscribes directly, parent doesn't re-render
<QuantityInputWrapper /> // Subscribes directly, parent doesn't re-render
```

### 2. CurrentPriceDisplay (`client/src/components/Trading/CurrentPriceDisplay.tsx`)

**Atomic component** that subscribes ONLY to current price:

```typescript
export default function CurrentPriceDisplay() {
  // This component re-renders when price changes
  // But parent OrderPanel does NOT re-render
  const currentPrice = useGameStore((state) =>
    state.gameState?.candles[state.gameState.currentIndex]?.close ?? 0
  )
  const priceStep = useGameStore((state) => state.gameState?.priceStep ?? 0.01)

  return (
    <div className="bg-dark-bg rounded-lg p-3 mb-4">
      <div className="text-xs text-text-secondary mb-1">מחיר נוכחי</div>
      <div className="text-2xl font-mono font-bold" dir="ltr">
        ${currentPrice.toLocaleString(...)}
      </div>
    </div>
  )
}
```

### 3. QuantityInputWrapper (`client/src/components/Trading/QuantityInputWrapper.tsx`)

**Wrapper component** that subscribes to dynamic values but doesn't pass them as props to parent:

```typescript
export default function QuantityInputWrapper({ quantity, onQuantityChange }) {
  // Subscribe here, not in parent
  const currentPrice = useGameStore((state) => state.gameState?.candles[...].close ?? 0)
  const accountBalance = useGameStore((state) => state.gameState?.account.balance ?? 0)

  return (
    <QuantityInput
      initialValue={quantity}
      currentPrice={currentPrice}  // This component re-renders, parent doesn't
      accountBalance={accountBalance}
      onQuantityChange={onQuantityChange}
    />
  )
}
```

### 4. AccountInfo (`client/src/components/Trading/AccountInfo.tsx`)

**Container component** that NEVER re-renders:

```typescript
export default function AccountInfo() {
  // No store subscriptions here!
  return (
    <div className="p-4 border-b border-dark-border">
      <AccountBalance />      {/* Subscribes to balance */}
      <AccountEquity />       {/* Subscribes to equity */}
      <AccountPnLDisplay />   {/* Subscribes to unrealizedPnL */}
      <DrawdownWarning />     {/* Subscribes to drawdown */}
    </div>
  )
}
```

### 5. PositionsList (`client/src/components/Trading/PositionsList.tsx`)

**Memoized position cards** that only re-render when their specific position changes:

```typescript
export default function PositionsList() {
  // Only subscribes to positions array reference
  const positions = useGameStore((state) => state.gameState?.positions ?? [])

  return (
    <div>
      {positions.map((position) => (
        <PositionCard key={position.id} positionId={position.id} />
      ))}
    </div>
  )
}

// Each card subscribes to its own position by ID
const PositionCard = memo(({ positionId }) => {
  const position = useGameStore((state) =>
    state.gameState?.positions.find(p => p.id === positionId)
  )
  // ... renders position data
}, (prev, next) => prev.positionId === next.positionId)
```

## Created Atomic Components

### Account Components (`client/src/components/Account/`)

1. **AccountBalance.tsx** - Displays available balance
2. **AccountEquity.tsx** - Displays total equity
3. **AccountPnLDisplay.tsx** - Displays unrealized PnL
4. **DrawdownWarning.tsx** - Shows drawdown warning

### Trading Components (`client/src/components/Trading/`)

1. **CurrentPriceDisplay.tsx** - Shows current candle price
2. **QuantityInputWrapper.tsx** - Wraps QuantityInput with store subscriptions
3. **AdvancedSettings.tsx** - SL/TP/Risk management settings (subscribes to price)

## Performance Benefits

### Before Refactoring
- **OrderPanel**: Re-rendered every candle (every second during auto-play)
- **AccountInfo**: Re-rendered every candle
- **PositionsList**: Re-rendered every candle for ALL positions
- **Total re-renders per candle**: ~10-15+ components

### After Refactoring
- **OrderPanel**: NEVER re-renders (only when user changes settings)
- **AccountInfo container**: NEVER re-renders
- **AccountEquity**: Re-renders only when equity changes
- **CurrentPriceDisplay**: Re-renders only when price changes
- **PositionCard**: Only the specific card re-renders when its PnL changes
- **Total re-renders per candle**: ~2-3 atomic components (only those displaying changing values)

## How to Add New Components

When adding new UI components, follow these patterns:

### Pattern 1: Display-Only Atomic Component
```typescript
// ✅ Component that displays a single dynamic value
export default function MyAtomicComponent() {
  const myValue = useGameStore((state) => state.gameState?.myValue ?? 0)

  return <div>{myValue}</div>
}
```

### Pattern 2: Container Component
```typescript
// ✅ Component that composes atomic children
export default function MyContainer() {
  // NO store subscriptions here!
  return (
    <div>
      <AtomicChild1 />
      <AtomicChild2 />
    </div>
  )
}
```

### Pattern 3: Action Component
```typescript
// ✅ Component that executes actions (subscribe to functions only)
export default function MyActionButton() {
  const executeAction = useGameStore((state) => state.executeAction)

  const handleClick = () => {
    // Get fresh values only when needed
    const value = useGameStore.getState().gameState?.value
    executeAction(value)
  }

  return <button onClick={handleClick}>Execute</button>
}
```

### Pattern 4: Memoized List Item
```typescript
// ✅ Component in a list that should only update when its own data changes
const MyListItem = memo(({ itemId }) => {
  const item = useGameStore((state) =>
    state.items.find(i => i.id === itemId)
  )

  return <div>{item.name}</div>
}, (prev, next) => prev.itemId === next.itemId)
```

## Anti-Patterns to Avoid

### ❌ DON'T: Subscribe to frequently changing values in parent components
```typescript
// BAD: This will cause parent and all children to re-render
export default function ParentComponent() {
  const currentPrice = useGameStore((state) => state.gameState?.candles[...].close)

  return (
    <div>
      <Child1 />  {/* Re-renders unnecessarily */}
      <Child2 />  {/* Re-renders unnecessarily */}
      <div>{currentPrice}</div>
    </div>
  )
}
```

### ❌ DON'T: Pass frequently changing values as props
```typescript
// BAD: Child re-renders every time price changes even if it doesn't use it
<ChildComponent currentPrice={currentPrice} />
```

### ❌ DON'T: Use shallow equality for objects that change frequently
```typescript
// BAD: shallowEqual doesn't help if values actually change
const { currentPrice, equity } = useGameStore((state) => ({
  currentPrice: state.gameState?.candles[...].close,
  equity: state.gameState?.account.equity
}), shallowEqual)  // Still re-renders every candle!
```

## Testing Performance

To verify reduced re-renders:

1. Open Chrome DevTools
2. Go to "Components" tab (React DevTools extension)
3. Click the "⚙️" icon → Enable "Highlight updates when components render"
4. Start auto-play in the game
5. **Before refactoring**: Entire right panel flashes every second
6. **After refactoring**: Only specific price/value displays flash

## Zustand Best Practices Used

1. **Selector Functions**: Use selector functions to extract only needed values
2. **getState()**: Use `useGameStore.getState()` for one-time reads in event handlers
3. **Function Subscriptions**: Subscribe to action functions (they never change)
4. **Granular Selectors**: Create one selector per value when possible
5. **Avoid Object Spread**: Don't spread multiple values into an object unless needed

## File Organization

```
client/src/components/
├── Account/                     # Atomic account display components
│   ├── AccountBalance.tsx       # Balance display
│   ├── AccountEquity.tsx        # Equity display
│   ├── AccountPnLDisplay.tsx    # Unrealized PnL display
│   └── DrawdownWarning.tsx      # Drawdown warning
├── Trading/
│   ├── OrderPanel.tsx           # Container (no subscriptions)
│   ├── CurrentPriceDisplay.tsx  # Atomic price display
│   ├── QuantityInputWrapper.tsx # Wrapper with subscriptions
│   ├── QuantityInput.tsx        # Memoized input component
│   ├── AdvancedSettings.tsx     # Settings panel (subscribes to price)
│   ├── AccountInfo.tsx          # Container (no subscriptions)
│   └── PositionsList.tsx        # Memoized list with atomic cards
```

## Results

- **Reduced re-renders by ~80-90%**
- **Smoother UI updates** - only changed values flicker
- **Better performance** during auto-play
- **Easier to maintain** - clear separation of concerns
- **Scalable architecture** - easy to add new components following patterns

## Migration Guide

If you encounter performance issues in other components:

1. **Identify the problem**: Use React DevTools to find components re-rendering unnecessarily
2. **Analyze subscriptions**: Check what values the component subscribes to
3. **Split if needed**: Extract frequently-changing displays into atomic components
4. **Move subscriptions**: Move store subscriptions from parent to children
5. **Lazy fetch**: For actions, fetch values only when needed using `getState()`
6. **Test**: Verify reduced re-renders with DevTools highlighting

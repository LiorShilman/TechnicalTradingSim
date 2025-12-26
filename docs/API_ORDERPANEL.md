# OrderPanel Component - API Documentation

## Overview

The `OrderPanel` component is a professional-grade trading interface that implements advanced order management, risk control, and position sizing features. It's the primary interface for executing LONG and SHORT trades in the Technical Trading Simulator.

**Location**: `client/src/components/Trading/OrderPanel.tsx`

---

## Features Summary

### Core Trading Features
- ✅ LONG and SHORT position support
- ✅ Fractional quantity trading (0.001 BTC minimum)
- ✅ Real-time position value calculation
- ✅ Portfolio percentage display

### Risk Management Features
- ✅ Stop Loss (SL) with percentage-based configuration
- ✅ Take Profit (TP) with percentage-based configuration
- ✅ Risk-Reward Ratio (R:R) calculation and visualization
- ✅ Maximum risk per trade configuration
- ✅ Recommended position size calculator
- ✅ Risk warning system

### UX Features
- ✅ Price freeze mechanism (prevents UI flicker)
- ✅ Expandable advanced settings panel
- ✅ Color-coded R:R feedback
- ✅ One-click auto-calculate for recommended position size

---

## Component Interface

### Props
The component has **no props** - it consumes all state from the Zustand store via `useGameStore()`.

### Store Dependencies
```typescript
const { gameState, executeTrade, isLoading } = useGameStore()
```

**Required Store State**:
- `gameState.candles` - Candle data for current price
- `gameState.currentIndex` - Current candle index
- `gameState.account.equity` - Account equity (balance + unrealized P&L)
- `gameState.isComplete` - Game completion status

**Required Store Actions**:
- `executeTrade(action, quantity, positionId, positionType, stopLoss, takeProfit)` - Execute trade

---

## State Management

### Local State

| State Variable | Type | Default | Description |
|---------------|------|---------|-------------|
| `quantity` | string | '0.1' | Trade quantity in BTC |
| `showAdvanced` | boolean | false | Toggle advanced settings panel |
| `stopLossPercent` | string | '2' | Stop Loss percentage |
| `takeProfitPercent` | string | '5' | Take Profit percentage |
| `useStopLoss` | boolean | false | Enable/disable SL |
| `useTakeProfit` | boolean | false | Enable/disable TP |
| `useRiskManagement` | boolean | false | Enable/disable risk management |
| `riskPercentPerTrade` | string | '2' | Max risk per trade (% of equity) |

### Ref State (Frozen Values)

| Ref | Type | Purpose |
|-----|------|---------|
| `frozenStopLossPriceRef` | number \| undefined | Frozen SL price (LONG positions) |
| `frozenTakeProfitPriceRef` | number \| undefined | Frozen TP price (LONG positions) |
| `frozenRiskRewardRef` | number | Frozen R:R ratio |

**Why Refs?** These values are intentionally frozen to prevent UI flicker during rapid price movements. They recalculate only when user changes settings, not on every candle update.

---

## Key Calculations

### 1. Stop Loss Price (LONG)
```typescript
SL Price = Current Price × (1 - SL% / 100)
```
**Example**: Price = $50,000, SL = 2%
→ SL Price = $50,000 × (1 - 0.02) = **$49,000**

### 2. Take Profit Price (LONG)
```typescript
TP Price = Current Price × (1 + TP% / 100)
```
**Example**: Price = $50,000, TP = 5%
→ TP Price = $50,000 × (1 + 0.05) = **$52,500**

### 3. Risk-Reward Ratio
```typescript
R:R = TP% / SL%
```
**Example**: TP = 5%, SL = 2%
→ R:R = 5 / 2 = **2.5** (displayed as "1:2.5")

**Color Coding**:
- 🟢 Green: R:R ≥ 2.0 (Excellent)
- 🟡 Yellow: R:R ≥ 1.0 (Acceptable)
- 🔴 Red: R:R < 1.0 (Poor)

### 4. Recommended Position Size
```typescript
Recommended Quantity = (Account Equity × Risk%) / (Current Price × SL%)
```

**Example**:
- Account Equity: $10,000
- Risk per trade: 2% ($200)
- Current Price: $50,000
- Stop Loss: 2% ($1,000 per BTC)

```
Quantity = ($10,000 × 0.02) / ($50,000 × 0.02)
         = $200 / $1,000
         = 0.2 BTC
```

**Verification**: If price drops 2% and hits SL:
- Loss per BTC = $50,000 × 0.02 = $1,000
- Total loss = 0.2 BTC × $1,000 = **$200** ✅ (exactly 2% of $10,000)

### 5. Risk Amount (Two Modes)

**Risk Management Mode** (recommended):
```typescript
Risk = Account Equity × Risk%
```
**Example**: $10,000 × 2% = **$200** (consistent risk per trade)

**Simple Mode** (fallback):
```typescript
Risk = Position Value × SL%
```
**Example**: $5,000 position × 2% = **$100** (risk varies with position size)

### 6. Actual Risk Percentage
```typescript
Actual Risk% = (Risk Amount / Account Equity) × 100
```
Used to warn when position size exceeds configured risk tolerance.

---

## SHORT Position Logic (Inverted SL/TP)

SHORT positions profit when price goes DOWN, so SL/TP are inverted:

| LONG Position | SHORT Position |
|--------------|----------------|
| SL BELOW entry (stop falling price) | SL ABOVE entry (stop rising price) |
| TP ABOVE entry (profit from rise) | TP BELOW entry (profit from drop) |

### SHORT Calculations

**Stop Loss** (ABOVE entry):
```typescript
SHORT SL = Current Price × (1 + SL% / 100)
```
**Example**: Entry = $50,000, SL = 2%
→ SHORT SL = $50,000 × 1.02 = **$51,000** (exit if price rises)

**Take Profit** (BELOW entry):
```typescript
SHORT TP = Current Price × (1 - TP% / 100)
```
**Example**: Entry = $50,000, TP = 5%
→ SHORT TP = $50,000 × 0.95 = **$47,500** (profit if price drops)

### Why Calculate SHORT SL/TP Fresh?
SHORT SL/TP are calculated using **current price at execution time** (not frozen refs) to ensure accurate inversion based on exact entry price.

---

## Price Freeze Pattern (Advanced)

### Problem
Without freezing, SL/TP prices recalculate on every candle update (every 0.5-3s in auto-play), causing confusing UI flicker.

### Solution
Use React refs to "freeze" values when settings change, not when price changes.

### Implementation
```typescript
useEffect(() => {
  // Capture price at setting change (not every candle)
  const priceAtSettingChange = currentPrice

  // Calculate and freeze SL/TP
  frozenStopLossPriceRef.current = priceAtSettingChange × (1 - SL%)
  frozenTakeProfitPriceRef.current = priceAtSettingChange × (1 + TP%)
  frozenRiskRewardRef.current = TP% / SL%

  // ⚠️ INTENTIONAL: Excludes gameState/currentIndex from deps
  // to prevent recalculation during price changes
}, [useStopLoss, useTakeProfit, stopLossPercent, takeProfitPercent])
```

### Key Points
- ✅ Values freeze when user changes settings
- ✅ Values remain stable during price movements
- ✅ `totalValue` and `currentPrice` remain reactive (needed for trade execution)
- ✅ eslint-disable comments are intentional (see inline docs)

---

## Usage Examples

### Basic LONG Trade
```typescript
// User input: 0.1 BTC
// Current price: $50,000
// No SL/TP

// Executed trade:
executeTrade('buy', 0.1, undefined, 'long', undefined, undefined)
```

### LONG Trade with SL/TP
```typescript
// User input: 0.1 BTC
// Current price: $50,000
// SL: 2% → $49,000
// TP: 5% → $52,500

// Executed trade:
executeTrade('buy', 0.1, undefined, 'long', 49000, 52500)
```

### SHORT Trade with SL/TP
```typescript
// User input: 0.1 BTC
// Current price: $50,000
// SL: 2% → $51,000 (INVERTED - above entry)
// TP: 5% → $47,500 (INVERTED - below entry)

// Executed trade:
executeTrade('buy', 0.1, undefined, 'short', 51000, 47500)
```

### Risk-Managed Trade
```typescript
// Account: $10,000
// Risk per trade: 2%
// SL: 2%
// Current price: $50,000

// Recommended quantity: 0.2 BTC
// User clicks "Use Recommended Quantity"
// Executed trade ensures max $200 loss (2% of account)
```

---

## Event Handlers

### `handleBuyLong()`
Opens a LONG position using frozen SL/TP prices from refs.

**Validation**: Requires `quantityNum > 0`

### `handleSellShort()`
Opens a SHORT position with inverted SL/TP calculated fresh from current price.

**Validation**: Requires `quantityNum > 0`

---

## UI Components

### Basic Section
1. **Current Price Display** - Shows latest candle close price
2. **Quantity Input** - Number input with 0.001 step, displays total value and portfolio %
3. **Buy Long Button** - Green button with TrendingUp icon
4. **Sell Short Button** - Red button with TrendingDown icon

### Advanced Section (Expandable)
1. **Stop Loss** - Checkbox + percentage input + live price display
2. **Take Profit** - Checkbox + percentage input + live price display
3. **R:R Display** - Color-coded ratio with feedback (Excellent/Acceptable/Poor)
4. **Risk Management** - Checkbox + risk % input + risk analysis panel
5. **Risk Analysis Panel** - Shows actual risk in $ and %, recommended quantity
6. **Auto-Calculate Button** - One-click to use recommended quantity

### Advanced Settings Toggle
**Button**: Settings icon (Lucide `Settings`)
**Behavior**: Toggles blue background when active

---

## Accessibility & UX

### RTL Support
- Hebrew labels aligned right
- Numeric values aligned left with `dir="ltr"`
- Uses flexbox `justify-between` for label-value pairs

### Number Formatting
- Prices: `toLocaleString()` with `maximumFractionDigits: 2`
- Percentages: `toFixed(2)`
- Quantities: `toFixed(3)` (BTC precision)

### Disabled States
- Inputs disabled when `!canTrade` (game complete or loading)
- Buttons disabled when `!canTrade` or `quantityNum <= 0`

### Color Coding
- **Profit/Green**: LONG button, TP prices
- **Loss/Red**: SHORT button, SL prices, risk warnings
- **Blue**: Advanced settings, R:R neutral, recommended quantities
- **Yellow**: R:R acceptable (1:1 to 2:1)

---

## Integration Points

### Store Actions Used
- `executeTrade(action, quantity, positionId, positionType, stopLoss, takeProfit)`

### Store State Consumed
- `gameState.candles[currentIndex].close` - Current price
- `gameState.account.equity` - Account equity
- `gameState.isComplete` - Game status
- `isLoading` - Loading state

### External Dependencies
- `lucide-react` - Icons (TrendingUp, TrendingDown, Settings)
- Zustand store - State management
- Tailwind CSS - Styling

---

## Future Enhancements

### Potential Improvements
1. **Trailing Stop Loss** - SL that moves with price
2. **OCO Orders** - One-Cancels-Other (SL and TP linked)
3. **Partial Close** - Close portion of position
4. **Average Price** - Multiple entries at different prices
5. **Leverage Support** - Margin trading simulation
6. **Preset Templates** - Save/load SL/TP configurations

### Known Limitations
1. **Single Position** - Can't have multiple positions open simultaneously (current design)
2. **Percentage-Based Only** - No absolute price SL/TP input
3. **No Bracket Orders** - Can't set SL/TP after position opens
4. **Fixed Asset** - Hardcoded to BTC (could be dynamic)

---

## Troubleshooting

### Issue: SL/TP prices keep changing
**Cause**: Normal behavior - they recalculate when you change settings
**Solution**: Values are intentionally frozen between setting changes

### Issue: SHORT SL is above entry price
**Cause**: Correct behavior - SHORT SL must be inverted
**Solution**: This is intentional - SHORT profits from price drops

### Issue: Risk warning shows even with recommended quantity
**Cause**: Floating point rounding or user modified quantity after auto-calculate
**Solution**: Click "Use Recommended Quantity" again or adjust manually

### Issue: Can't trade
**Checks**:
1. Game not complete? (`gameState.isComplete === false`)
2. Not loading? (`isLoading === false`)
3. Quantity > 0? (`quantityNum > 0`)
4. Game state exists? (`gameState !== null`)

---

## Testing

### Unit Test Cases
1. ✅ SL price calculation (LONG)
2. ✅ TP price calculation (LONG)
3. ✅ SHORT SL inversion
4. ✅ SHORT TP inversion
5. ✅ R:R ratio calculation
6. ✅ Recommended quantity formula
7. ✅ Risk amount (both modes)
8. ✅ Actual risk percentage
9. ✅ Price freeze on setting change (not price change)

### Integration Test Cases
1. ✅ Execute LONG trade without SL/TP
2. ✅ Execute LONG trade with SL/TP
3. ✅ Execute SHORT trade with inverted SL/TP
4. ✅ Risk warning triggers correctly
5. ✅ Auto-calculate sets correct quantity
6. ✅ Advanced panel toggles correctly
7. ✅ Disabled state when game complete

---

## Code Quality

### Documentation Coverage
- ✅ Component-level JSDoc
- ✅ All state variables documented
- ✅ All ref variables documented
- ✅ Complex calculations explained with examples
- ✅ Handler functions documented
- ✅ Price freeze pattern explained

### Type Safety
- ✅ TypeScript strict mode
- ✅ All state typed explicitly
- ✅ Ref types include `undefined` for safety
- ✅ Number parsing with fallback (`|| 0`)

### Performance
- ✅ Refs prevent unnecessary re-renders
- ✅ Frozen values avoid expensive recalculations
- ✅ Zustand selector optimized (no unnecessary subscriptions)

---

## Related Files

- **Component**: `client/src/components/Trading/OrderPanel.tsx`
- **Store**: `client/src/stores/gameStore.ts`
- **API**: `client/src/services/api.ts`
- **Types**: `client/src/types/game.types.ts`
- **Server Logic**: `server/src/controllers/gameController.ts`

---

## Changelog

### v1.0.0 - Initial Implementation
- Basic LONG/SHORT trading
- SL/TP support
- Risk management
- Price freeze pattern
- Comprehensive documentation

---

**Last Updated**: 2025-12-26
**Author**: Technical Trading Simulator Team
**Maintainer**: Claude Code Documentation System

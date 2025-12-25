# מדריך פיתוח מפורט - משחק סימולציית מסחר טכני

## 🎯 מטרת הפרויקט

משחק הדמיה מקצועי לאימון זיהוי תבניות טכניות וסימולציית מסחר ריאליסטית.
המשחק משלב למידה עם חוויית משחק, ונותן feedback על איכות המסחר.

---

## 📋 דרישות MVP (Minimum Viable Product)

### תכונות ליבה:
1. ✅ גרף נרות יפניים אינטראקטיבי
2. ✅ מנוע ייצור תבניות טכניות (Breakout, Retest, Flag)
3. ✅ מנגנון מסחר (Buy/Sell) עם ניהול פוזיציות
4. ✅ חישוב PnL בזמן אמת
5. ✅ התקדמות ידנית (Next Candle)
6. ✅ feedback על זיהוי תבניות
7. ✅ סטטיסטיקות סיום משחק

### הגדרות ראשוניות:
- **נכס**: Bitcoin (BTC/USD)
- **Timeframe**: 1H (שעה)
- **סכום התחלתי**: $10,000
- **אורך משחק**: 100 נרות
- **תבניות**: Breakout, Retest, Bull Flag

---

## 🏗️ ארכיטקטורה

### Stack טכנולוגי:

**Frontend:**
- React 18+ (TypeScript)
- Vite (Build tool)
- Lightweight Charts (TradingView)
- Tailwind CSS (Styling)
- Zustand (State Management)

**Backend:**
- Node.js + Express (TypeScript)
- REST API
- In-memory data (בהתחלה, אפשר DB מאוחר יותר)

### מבנה Monorepo:
```
trading-game/
├── client/          # React Frontend
├── server/          # Express Backend
└── shared/          # Shared types & utils
```

---

## 📁 מבנה קבצים מפורט

### Client Structure:
```
client/
├── public/
├── src/
│   ├── components/
│   │   ├── Chart/
│   │   │   ├── TradingChart.tsx      # Main chart component
│   │   │   ├── ChartControls.tsx     # Next/Reset buttons
│   │   │   └── PatternOverlay.tsx    # Visual pattern hints
│   │   ├── Trading/
│   │   │   ├── OrderPanel.tsx        # Buy/Sell interface
│   │   │   ├── PositionsList.tsx     # Open positions
│   │   │   └── AccountInfo.tsx       # Balance, PnL
│   │   ├── Feedback/
│   │   │   ├── TradeAlert.tsx        # Trade notifications
│   │   │   └── PatternFeedback.tsx   # Pattern recognition feedback
│   │   └── Stats/
│   │       └── GameStats.tsx         # End game statistics
│   ├── hooks/
│   │   ├── useGameState.ts           # Game state management
│   │   ├── useChart.ts               # Chart interactions
│   │   └── useTrading.ts             # Trading logic
│   ├── stores/
│   │   └── gameStore.ts              # Zustand store
│   ├── services/
│   │   ├── api.ts                    # API client
│   │   └── chartService.ts           # Chart utilities
│   ├── types/
│   │   └── game.types.ts             # TypeScript types
│   ├── utils/
│   │   ├── calculations.ts           # PnL, etc.
│   │   └── formatters.ts             # Number/date formatting
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

### Server Structure:
```
server/
├── src/
│   ├── controllers/
│   │   └── gameController.ts         # Game endpoints
│   ├── services/
│   │   ├── patternGenerator.ts       # Generate technical patterns
│   │   ├── candleGenerator.ts        # Generate price data
│   │   └── gameEngine.ts             # Game logic
│   ├── models/
│   │   ├── Game.ts                   # Game state model
│   │   ├── Candle.ts                 # Candle data model
│   │   └── Position.ts               # Trading position model
│   ├── routes/
│   │   └── gameRoutes.ts             # API routes
│   ├── utils/
│   │   ├── technicalAnalysis.ts      # TA utilities
│   │   └── validators.ts             # Input validation
│   ├── types/
│   │   └── index.ts                  # Shared types
│   └── server.ts                     # Express app
├── package.json
└── tsconfig.json
```

---

## 🔧 הגדרות טכניות

### Package.json - Client:
```json
{
  "name": "trading-game-client",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lightweight-charts": "^4.1.3",
    "zustand": "^4.5.0",
    "axios": "^1.6.5",
    "lucide-react": "^0.344.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.3",
    "vite": "^5.1.0",
    "tailwindcss": "^3.4.1",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.35"
  }
}
```

### Package.json - Server:
```json
{
  "name": "trading-game-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.4.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/node": "^20.11.5",
    "typescript": "^5.3.3",
    "tsx": "^4.7.0"
  }
}
```

---

## 🎮 לוגיקת המשחק

### 1. אתחול משחק:
```typescript
// Server generates:
- 100 candles with embedded patterns
- Pattern metadata (type, location, expected entry/exit)
- Initial account: $10,000
```

### 2. מהלך המשחק:
```typescript
// Client displays:
- Current visible candles (last 50)
- Account balance
- Open positions

// User actions:
- Click "Next" → reveal next candle
- Click "Buy/Sell" → open position
- Click "Close" → close position
```

### 3. מנוע דפוסים:
```typescript
// Pattern types:
1. Breakout:
   - Consolidation (10-15 candles)
   - Breakout candle (large volume)
   - Continuation (3-5 candles up)

2. Retest:
   - After breakout
   - Price returns to broken level
   - Bounce and continue

3. Bull Flag:
   - Strong move up (pole)
   - Consolidation down (flag)
   - Breakout continuation
```

### 4. Feedback מנגנון:
```typescript
// Real-time feedback:
- "Pattern detected: Breakout forming"
- "Good entry! Caught the breakout early"
- "Late entry - pattern already played out"
- "Excellent exit timing!"

// Scoring:
- Entry quality: 0-100
- Exit quality: 0-100
- Pattern recognition: 0-100
```

---

## 🚀 שלבי פיתוח (בסדר עדיפות)

### Phase 1: Setup & Infrastructure (יום 1)
- [x] יצירת מבנה פרויקט
- [ ] התקנת dependencies
- [ ] הגדרת TypeScript configs
- [ ] הגדרת Vite + Tailwind
- [ ] יצירת Express server בסיסי
- [ ] API endpoints ראשוניים

### Phase 2: Core Game Engine (ימים 2-3)
- [ ] מודל נתונים (Candle, Position, Game)
- [ ] מנוע ייצור נרות בסיסי
- [ ] לוגיקת Breakout pattern
- [ ] חישובי PnL
- [ ] API למשחק חדש + next candle

### Phase 3: Chart & UI (ימים 4-5)
- [ ] אינטגרציה של Lightweight Charts
- [ ] תצוגת נרות
- [ ] פאנל מסחר (Buy/Sell)
- [ ] תצוגת חשבון
- [ ] כפתורי Next/Reset

### Phase 4: Trading Logic (יום 6)
- [ ] פתיחת פוזיציות
- [ ] סגירת פוזיציות
- [ ] חישוב PnL בזמן אמת
- [ ] ניהול מספר פוזיציות

### Phase 5: Patterns & Feedback (ימים 7-8)
- [ ] מנוע Retest pattern
- [ ] מנוע Bull Flag pattern
- [ ] זיהוי איכות כניסה/יציאה
- [ ] הצגת feedback בזמן אמת
- [ ] ציונים ומדדים

### Phase 6: Polish & Stats (ימים 9-10)
- [ ] מסך סטטיסטיקות
- [ ] אנימציות
- [ ] צלילים (אופציונלי)
- [ ] responsive design
- [ ] בדיקות ותיקוני באגים

---

## 💡 עצות לפיתוח עם Claude Code

### 1. גישה מודולרית:
```bash
# פתח קובץ אחד בכל פעם
# דוגמה:
"צור את קובץ patternGenerator.ts עם לוגיקת Breakout בלבד"
```

### 2. בדיקות שוטפות:
```bash
# אחרי כל שלב, הרץ:
npm run dev

# ובדוק שהכל עובד לפני המשך
```

### 3. Git commits תכופים:
```bash
git add .
git commit -m "feat: add breakout pattern generator"
```

### 4. שאלות ספציפיות:
```
❌ "תכתב לי את כל המשחק"
✅ "תכתב פונקציה שמייצרת 20 נרות עם breakout pattern באמצע"
```

### 5. דיבאג מסודר:
```typescript
// הוסף console.log בנקודות מפתח:
console.log('Pattern generated:', pattern);
console.log('PnL calculated:', pnl);
```

---

## 📊 Data Structures מרכזיים

### Candle:
```typescript
interface Candle {
  time: number;        // Unix timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

### Pattern:
```typescript
interface Pattern {
  type: 'breakout' | 'retest' | 'flag';
  startIndex: number;
  endIndex: number;
  expectedEntry: number;    // Price
  expectedExit: number;     // Price
  stopLoss: number;
  metadata: {
    quality: number;        // 0-100
    description: string;
  };
}
```

### Position:
```typescript
interface Position {
  id: string;
  type: 'long' | 'short';
  entryPrice: number;
  entryTime: number;
  quantity: number;
  currentPnL: number;
  exitPrice?: number;
  exitTime?: number;
}
```

### GameState:
```typescript
interface GameState {
  id: string;
  candles: Candle[];
  patterns: Pattern[];
  currentIndex: number;     // Which candle we're at
  account: {
    balance: number;
    initialBalance: number;
    equity: number;
  };
  positions: Position[];
  stats: {
    totalTrades: number;
    winningTrades: number;
    maxDrawdown: number;
    patternRecognitionScore: number;
  };
}
```

---

## 🎨 UI/UX Guidelines

### עיצוב:
- **צבעים**: Dark mode מקצועי (רקע #0a0e27, טקסט #e8eaed)
- **פונטים**: Inter / Roboto Mono למספרים
- **ירוק/אדום**: #00c853 / #ff1744
- **כפתורים**: Rounded, shadows, hover effects

### Responsive:
- Desktop first (1920x1080)
- גרף תופס 70% מהמסך
- פאנלים בצד ימין

### אנימציות:
- Smooth transitions (200ms)
- הדגשה על trade חדש
- נר חדש = fade in

---

## 🧪 בדיקות ראשוניות

### Test scenarios:
1. ✅ יצירת משחק חדש
2. ✅ לחיצה על Next 10 פעמים
3. ✅ פתיחת Long position
4. ✅ נר חדש = עדכון PnL
5. ✅ סגירת Position = קבלת רווח/הפסד
6. ✅ זיהוי Breakout pattern
7. ✅ Feedback על כניסה טובה
8. ✅ סיום משחק + stats

---

## 📝 דוגמאות API

### POST /api/game/new
```json
Response:
{
  "gameId": "uuid",
  "candles": [...],  // First 20 visible
  "account": {
    "balance": 10000,
    "equity": 10000
  },
  "currentIndex": 19
}
```

### POST /api/game/:id/next
```json
Response:
{
  "candle": {...},
  "currentIndex": 20,
  "positions": [...],  // Updated PnL
  "feedback": {
    "type": "pattern_hint",
    "message": "Breakout pattern forming..."
  }
}
```

### POST /api/game/:id/trade
```json
Request:
{
  "type": "buy",
  "quantity": 0.5
}

Response:
{
  "position": {...},
  "account": {...}
}
```

---

## 🔐 חוקי עבודה

1. **קוד נקי**: ESLint + Prettier
2. **Types תמיד**: אף משתנה ללא type
3. **Error handling**: try-catch בכל API call
4. **Comments**: רק למקומות מורכבים
5. **Hebrew**: תגובות בעברית מותרות
6. **Commits**: בעברית או אנגלית

---

## 🎯 Definition of Done

### MVP מוכן כאשר:
- [x] יש מסך משחק עובד
- [ ] אפשר לשחק משחק שלם (100 נרות)
- [ ] יש 3 תבניות שונות
- [ ] Feedback עובד
- [ ] סטטיסטיקות בסוף
- [ ] אין באגים קריטיים
- [ ] ה-UI נראה מקצועי

---

## 📚 משאבים

### Lightweight Charts:
- [Docs](https://tradingview.github.io/lightweight-charts/)
- [Examples](https://tradingview.github.io/lightweight-charts/tutorials)

### Technical Patterns:
- [Chart Patterns](https://www.investopedia.com/articles/technical/112601.asp)
- [Candlestick Patterns](https://www.investopedia.com/trading/candlestick-charting-what-is-it/)

---

**בהצלחה! 🚀**

*מסמך זה הוא ה"מפה" שלך. כל פעם שאתה תקוע, חזור לכאן.*
*עדכן אותו ככל שהפרויקט מתפתח.*

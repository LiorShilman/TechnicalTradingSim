# 🎮 משחק סימולציית מסחר טכני

משחק הדמייה מקצועי לאימון זיהוי תבניות טכניות וסימולציית מסחר ריאליסטית.

## 📁 מבנה הפרויקט

```
trading-game/
├── client/          # React Frontend (Vite + TypeScript + Tailwind)
├── server/          # Express Backend (TypeScript)
├── DEVELOPMENT_GUIDE.md    # מדריך פיתוח מפורט
└── README.md
```

## 🚀 התקנה מהירה

### דרישות מוקדמות
- Node.js 18+ 
- npm או yarn

### שלב 1: התקנת תלויות

**Client:**
```bash
cd client
npm install
```

**Server:**
```bash
cd server
npm install
cp .env.example .env
```

### שלב 2: הרצה

**Terminal 1 - Server:**
```bash
cd server
npm run dev
```

**Terminal 2 - Client:**
```bash
cd client
npm run dev
```

פתח בדפדפן: http://localhost:3000

## 📚 תיעוד

קרא את **[DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)** למדריך פיתוח מלא ומפורט.

## 🎯 תכונות MVP

- ✅ גרף נרות יפניים אינטראקטיבי
- ✅ מנוע ייצור תבניות טכניות
- ✅ מנגנון מסחר Buy/Sell
- ✅ חישוב PnL בזמן אמת
- ✅ Feedback על זיהוי תבניות
- ✅ סטטיסטיקות סיום משחק

## 🛠️ טכנולוגיות

**Frontend:**
- React 18 + TypeScript
- Vite
- Lightweight Charts (TradingView)
- Tailwind CSS
- Zustand

**Backend:**
- Node.js + Express
- TypeScript
- REST API

## 📝 הנחיות פיתוח

1. עבור לפי השלבים ב-DEVELOPMENT_GUIDE.md
2. התחל עם Phase 1: Setup
3. המשך ל-Phase 2: Core Game Engine
4. בדוק כל שלב לפני המשך

## 🐛 דיבאג

```bash
# בדוק שהשרת רץ
curl http://localhost:5000/api/health

# בדוק logs
# Server: ראה terminal
# Client: פתח Developer Console
```

## 📖 למידה

המשחק מלמד:
- זיהוי תבניות טכניות
- Timing של כניסות ויציאות
- ניהול סיכונים
- קריאת גרפים

## 🤝 תרומה

פרויקט זה נבנה בעזרת Claude Code.

---

**בהצלחה! 🚀**

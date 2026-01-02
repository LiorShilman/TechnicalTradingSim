# Production Deployment Guide

## הוראות Deployment ל-IIS

### 1. Build הפרויקט

#### Client (React):
```bash
cd client
npm run build
```
הקבצים יווצרו בתיקייה `client/dist`

#### Server (Node.js):
```bash
cd server
npm run build
```
הקבצים יווצרו בתיקייה `server/dist`

### 2. העתקת קבצים ל-IIS

1. העתק את התוכן של `client/dist` לתיקייה:
   ```
   C:\inetpub\wwwroot\TechnicalTradingSim
   ```

2. ודא שקובץ `web.config` נמצא בתיקייה (מועתק אוטומטית מ-`client/web.config`)

### 3. הגדרת IIS

1. פתח IIS Manager
2. צור Application Pool חדש:
   - שם: `TechnicalTradingSim`
   - .NET CLR version: No Managed Code

3. צור Application חדש תחת Default Web Site:
   - Alias: `TechnicalTradingSim`
   - Physical path: `C:\inetpub\wwwroot\TechnicalTradingSim`
   - Application pool: `TechnicalTradingSim`

4. Binding:
   - Type: HTTP
   - Port: 17500
   - IP address: All Unassigned

### 4. הרצת הסרוור עם PM2

1. התקן PM2 גלובלית (אם לא מותקן):
```bash
npm install -g pm2
```

2. הרץ את הסרוור:
```bash
cd E:\AllMyProjects\technical-trading-simulator
pm2 start ecosystem.config.js --env production
```

3. פקודות ניהול PM2:
```bash
pm2 status                          # בדיקת סטטוס
pm2 logs technical-trading-sim-server  # צפייה בלוגים
pm2 restart technical-trading-sim-server  # הפעלה מחדש
pm2 stop technical-trading-sim-server     # עצירה
pm2 delete technical-trading-sim-server   # מחיקה
```

4. שמירת תצורת PM2 (אוטומטית בהפעלה):
```bash
pm2 save
pm2 startup
```

### 5. בדיקת הפרויקט

1. **Client**: פתח דפדפן בכתובת:
   ```
   http://shilmanlior2608.ddns.net:17500/TechnicalTradingSim/
   ```

2. **Server Health Check**:
   ```
   http://shilmanlior2608.ddns.net:17500/api/health
   ```

### 6. Troubleshooting

#### בעיות CORS:
- ודא שהסרוור רץ בפורט 17500
- בדוק שה-CORS מוגדר נכון ב-`server/src/server.ts`

#### בעיות Routing:
- ודא שקובץ `web.config` קיים ומוגדר נכון
- בדוק שה-base path ב-`vite.config.ts` הוא `/TechnicalTradingSim/`

#### הסרוור לא עולה:
```bash
pm2 logs technical-trading-sim-server  # בדיקת שגיאות
```

## Structure

```
E:\AllMyProjects\technical-trading-simulator\
├── client/
│   ├── dist/                    # → העתק ל-IIS
│   ├── .env.production          # VITE_SERVER_URL
│   └── web.config               # → מועתק אוטומטית ל-dist
├── server/
│   ├── dist/                    # קומפילציה של TypeScript
│   ├── .env.production          # PORT=17500
│   └── src/
└── ecosystem.config.js          # PM2 configuration
```

## URLs

- **Production Client**: http://shilmanlior2608.ddns.net:17500/TechnicalTradingSim/
- **Production API**: http://shilmanlior2608.ddns.net:17500/api/
- **Development Client**: http://localhost:3000
- **Development Server**: http://localhost:5000

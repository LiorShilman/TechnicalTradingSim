# LSP Setup Scripts

תיעוד לסקריפטים האוטומטיים להתקנה והגדרת סביבת LSP.

## מה הסקריפטים עושים?

הסקריפטים מבצעים התקנה והגדרה מלאה של סביבת ה-LSP:

1. ✅ **בודק התקנת Claude Code** - מוודא שה-CLI מותקן
2. ✅ **מוודא מבנה פרויקט** - בודק שקיימים תיקיות client ו-server
3. ✅ **מתקין תלויות npm** - מריץ `npm install` בשני הפרויקטים
4. ✅ **מגדיר marketplace** - מוסיף את `claude-code-lsps` marketplace
5. ✅ **מתקין vtsls plugin** - מתקין את TypeScript LSP
6. ✅ **מאמת הגדרות** - בודק שהכל מוגדר נכון

## איזה סקריפט להשתמש?

### Windows (מומלץ)

#### PowerShell (Windows 10/11)
```powershell
# הרץ מתיקיית הפרויקט הראשית
.\setup-lsp.ps1
```

**לפני הריצה הראשונה**, אפשר הרצת סקריפטים:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

#### Command Prompt (CMD)
```cmd
setup-lsp.bat
```

### Linux / macOS

```bash
# תן הרשאות ריצה
chmod +x setup-lsp.sh

# הרץ את הסקריפט
./setup-lsp.sh
```

## מתי להשתמש בסקריפטים?

### שימוש ראשוני (מחשב חדש)
כשמתקינים את הפרויקט לראשונה על מחשב חדש:
```bash
# 1. שכפל את הפרויקט
git clone https://github.com/LiorShilman/TechnicalTradingSim.git
cd TechnicalTradingSim

# 2. הרץ את סקריפט ההתקנה
.\setup-lsp.ps1  # Windows PowerShell
# או
./setup-lsp.sh   # Linux/macOS
```

### החלפת מחשב
כשעוברים ממחשב אחד לאחר:
```bash
# 1. משוך שינויים עדכניים
git pull

# 2. הרץ את סקריפט ההתקנה
.\setup-lsp.ps1  # Windows
```

### אחרי `git clone` חדש
כל פעם ששוכפלים את הפרויקט מחדש:
```bash
git clone <repo-url>
cd <project-dir>
.\setup-lsp.ps1  # או ./setup-lsp.sh
```

### תיקון סביבת פיתוח מקולקלת
אם משהו לא עובד:
```bash
# נקה node_modules
rm -rf client/node_modules server/node_modules
rm -rf .claude

# הרץ מחדש את ההתקנה
.\setup-lsp.ps1
```

## מה קורה בזמן הריצה?

### שלב 1: בדיקת Claude Code
```
[1/6] Checking Claude Code installation...
✅ Claude Code is installed
```

### שלב 2: אימות מבנה פרויקט
```
[2/6] Verifying project structure...
✅ Project structure verified
```

### שלב 3: התקנת תלויות (הכי ארוך)
```
[3/6] Installing npm dependencies...
Installing client dependencies...
[████████████████] 100%
Installing server dependencies...
[████████████████] 100%
✅ npm dependencies installed
```

**⏱️ זמן ריצה**: 2-5 דקות (תלוי במהירות האינטרנט)

### שלב 4: הגדרת Marketplace
```
[4/6] Configuring Claude Code marketplace...
✅ Marketplace added
```

### שלב 5: התקנת LSP Plugin
```
[5/6] Installing TypeScript LSP plugin...
Installing vtsls@claude-code-lsps...
✅ vtsls plugin installed
```

### שלב 6: אימות הגדרות
```
[6/6] Verifying LSP configuration...
✅ .claude/settings.json exists
✅ vtsls plugin is enabled
✅ Client ESLint config exists
✅ Server ESLint config exists
```

## פלט סופי

```
==========================================
🎉 LSP Setup Complete!
==========================================

What's installed:
  ✅ TypeScript LSP (vtsls) - Type-aware navigation
  ✅ ESLint - Code quality analysis
  ✅ Client dependencies - React + Vite
  ✅ Server dependencies - Express + TypeScript

LSP Capabilities:
  • Type-aware code navigation
  • Intelligent autocomplete
  • Real-time diagnostics
  • Go to definition / Find references

Test your setup:
  $ cd client && npm run lint
  $ cd server && npm run lint
  $ cd client && npx tsc --noEmit

⚠️  Note: You may need to restart your Claude Code session
    for the LSP plugin to fully activate.
```

## בדיקת התקנה תקינה

אחרי הרצת הסקריפט, בדוק:

### 1. בדוק שהפלאגין מותקן
```bash
claude plugin marketplace list
# צריך להציג: claude-code-lsps
```

### 2. בדוק הגדרות
```bash
cat .claude/settings.json
# צריך להכיל: "vtsls@claude-code-lsps": true
```

### 3. הרץ בדיקות TypeScript
```bash
cd client
npm run lint
npx tsc --noEmit
```

אם אין שגיאות - ההתקנה הצליחה! ✅

## פתרון בעיות

### שגיאה: "Claude Code CLI is not installed"

**פתרון**: התקן את Claude Code CLI:
1. לך ל-https://claude.ai/code
2. עקוב אחרי הוראות ההתקנה למערכת ההפעלה שלך
3. אמת: `claude --version`

### שגיאה: "Must run this script from project root"

**פתרון**: הרץ את הסקריפט מתיקיית השורש של הפרויקט:
```bash
cd path/to/TechnicalTradingSim
.\setup-lsp.ps1
```

### שגיאה: "npm install failed"

**פתרון 1**: בדוק חיבור אינטרנט

**פתרון 2**: נקה cache של npm:
```bash
npm cache clean --force
```

**פתרון 3**: מחק node_modules והתקן מחדש:
```bash
rm -rf client/node_modules server/node_modules
.\setup-lsp.ps1
```

### שגיאה: "plugin marketplace add failed"

**פתרון**: הרץ באופן ידני:
```bash
claude plugin marketplace add boostvolt/claude-code-lsps
```

### שגיאה: "vtsls plugin not enabled"

**פתרון**: הרץ באופן ידני:
```bash
claude plugin install vtsls@claude-code-lsps --scope project
```

### PowerShell: "execution of scripts is disabled"

**פתרון**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## התקנה ידנית (אם הסקריפט נכשל)

אם הסקריפט לא עובד, בצע באופן ידני:

```bash
# 1. התקן תלויות
cd client && npm install && cd ..
cd server && npm install && cd ..

# 2. הוסף marketplace
claude plugin marketplace add boostvolt/claude-code-lsps

# 3. התקן plugin
claude plugin install vtsls@claude-code-lsps --scope project

# 4. אמת
cat .claude/settings.json
```

## קבצים שנוצרים

הסקריפט יוצר/משנה:

```
.claude/
├── settings.json           # הגדרות plugins (חדש או מעודכן)
└── settings.local.json     # הגדרות מקומיות (אם קיים)

client/
├── node_modules/           # תלויות React
└── .eslintrc.cjs          # הגדרות ESLint (קיים)

server/
├── node_modules/           # תלויות Express
└── eslint.config.js       # הגדרות ESLint (קיים)
```

## קבצי סקריפט

| קובץ | מערכת הפעלה | תיאור |
|------|-------------|--------|
| `setup-lsp.sh` | Linux/macOS/Git Bash | Bash script עם צבעים |
| `setup-lsp.ps1` | Windows PowerShell | PowerShell script מודרני |
| `setup-lsp.bat` | Windows CMD | Batch script לתאימות |

## אחזוק

### עדכון LSP Plugin

```bash
# עדכן marketplace
claude plugin marketplace update

# עדכן plugin
claude plugin update vtsls@claude-code-lsps
```

### הסרת LSP Plugin

```bash
claude plugin uninstall vtsls@claude-code-lsps
```

### הסרת Marketplace

```bash
claude plugin marketplace remove claude-code-lsps
```

## תיעוד נוסף

- **LSP_SETUP.md** - מדריך מפורט להגדרת LSP
- **LSP_TEST_RESULTS.md** - תוצאות בדיקות LSP
- **CLAUDE.md** - תיעוד הפרויקט הכללי

## תמיכה

אם נתקלת בבעיות:
1. בדוק את קובץ [LSP_SETUP.md](LSP_SETUP.md) - פתרון בעיות
2. הרץ בדיקות ידניות: `npm run lint`, `npx tsc --noEmit`
3. פתח issue ב-GitHub עם פלט השגיאה המלא

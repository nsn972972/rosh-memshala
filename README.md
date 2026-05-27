# ראשממשלת.ישראל

אתר הצבעות אינטראקטיבי — לחצו על המועמד שלכם והשפיעו על תוצאות הבחירות לכנסת ה-26.

## מה האתר עושה

- מציג את המועמדים לראשות הממשלה (נתניהו, בנט, אייזנקוט, ליברמן)
- כל לחיצה מוסיפה קול למועמד בזמן אמת
- תוצאות מתעדכנות בשרת ומוצגות לכל המשתתפים

## ארכיטקטורה

| קובץ | תיאור |
|------|-------|
| `index.html` | ממשק המשתמש — HTML/CSS/JS סטטי |
| `worker.js` | Cloudflare Worker — API לספירת הקלקות |

ה-backend בנוי על **Cloudflare Workers + Durable Objects** לשמירת state גלובלי.

## פריסה

### Frontend
העלו את `index.html` לכל שרת סטטי (GitHub Pages, Cloudflare Pages, Netlify וכו').

### Backend (Cloudflare Worker)
```bash
npm install -g wrangler
wrangler login
wrangler init ramashmemshelet-api
# העתיקו את תוכן worker.js לתוך src/index.js
wrangler deploy
```
לאחר הפריסה, הכניסו את ה-URL שמתקבל לתוך `API_URL` בקובץ `index.html`.

## טכנולוגיות

- HTML / CSS / Vanilla JS
- Cloudflare Workers
- Cloudflare Durable Objects

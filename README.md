# ראשממשלת.ישראל

**מי יהיה ראש ממשלת ישראל?** — עמוד אחד: ספירה לאחור לבחירות לכנסת ה־26 (27.10.2026) והמשחק "61 — יש לך דקה": דקה אחת להרכיב רוב של 61 מנדטים לפי ממוצע הסקרים, ולגלות מי ראש הממשלה בקואליציה שלך. משחק, לא תחזית.

## מבנה

| נתיב | תיאור |
|------|-------|
| `index.html` | כל האתר: כותרת, ספירה לאחור, והמשחק (קוד האפליקציה בתוך הקובץ) |
| `game/` | נכסי המשחק — `engine.js`, `style.css` (כל הכללים תחת `.g61`), `polls.json` |
| `game61/poll-updater/` | עדכון אוטומטי של `game/polls.json` מממוצע הסקרים |
| `game61/game/engine.test.cjs` | בדיקות מנוע המשחק |
| `.github/workflows/update-polls.yml` | הרצת העדכון כל שעתיים |

פרטים: `game61/README-he.md`. אפיון: `game61/docs/`.

## בדיקות

```bash
node game61/game/engine.test.cjs
node game61/poll-updater/test/core.test.mjs
```

## פריסה

אתר סטטי ב־GitHub Pages (דומיין ב־`CNAME`, Cloudflare לפניו). כל push ל־`main` עולה לאוויר.
אחרי שינוי ב־`game/style.css` או ב־`game/engine.js` — להעלות את `?v=` בקישורים אליהם ב־`index.html` (הדפדפנים שומרים אותם 4 שעות).

**שינוי תאריך הבחירות / תקופת האיסור:** `game61/poll-updater/config.json`, `ELECTION` בתוך `index.html`, ו־`ELECTION_DATE` של הספירה לאחור ב־`index.html`.

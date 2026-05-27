// ============================================================
// Cloudflare Worker — Backend עבור ראשממשלת.ישראל
// ============================================================
//
// ארכיטקטורה: Worker + Durable Object (Counter pattern)
// - Worker מטפל בכל הבקשות וממעיל אותן ל-Durable Object יחיד
// - Durable Object שומר state עקבי (counter per candidate)
// - Cloudflare מטפל אוטומטית בקאש, DDoS, וסקייל
//
// ============================================================
// הוראות פריסה:
// ============================================================
// 1. npm install -g wrangler
// 2. wrangler login
// 3. צור פרויקט: wrangler init ramashmemshelet-api
// 4. החלף src/index.js בקוד הזה
// 5. צור wrangler.toml (ראה למטה)
// 6. wrangler deploy
// 7. קח את ה-URL שמתקבל והכנס אותו בקובץ index.html ל-API_URL
//
// ============================================================
// wrangler.toml — צריך להיראות ככה:
// ============================================================
/*
name = "ramashmemshelet-api"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[durable_objects.bindings]]
name = "VOTES"
class_name = "VoteCounter"

[[migrations]]
tag = "v1"
new_classes = ["VoteCounter"]
*/
// ============================================================

const ALLOWED_CANDIDATES = ['bibi', 'bennett', 'eisenkot', 'lieberman'];
const MAX_CLICKS_PER_REQUEST = 100; // הגבל batch ליחיד
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // בפרודקשן: שים את הדומיין שלך כאן
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ============================================================
// Worker — הנקודת כניסה
// ============================================================
export default {
  async fetch(request, env) {
    // טפל ב-CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname !== '/api/state') {
      return new Response('Not found', { status: 404, headers: CORS_HEADERS });
    }

    // rate limiting פר-IP בסיסי דרך Cloudflare
    // (אפשר להוסיף עוד שכבת הגנה דרך Cloudflare WAF + Turnstile בעת הצורך)

    // העבר לDurable Object
    const id = env.VOTES.idFromName('global');
    const stub = env.VOTES.get(id);
    return stub.fetch(request);
  },
};

// ============================================================
// Durable Object — ה-state האמיתי
// ============================================================
export class VoteCounter {
  constructor(state, env) {
    this.state = state;
    this.totals = null;
  }

  async loadTotals() {
    if (this.totals === null) {
      this.totals = (await this.state.storage.get('totals')) || {
        bibi: 0, bennett: 0, eisenkot: 0, lieberman: 0,
      };
    }
    return this.totals;
  }

  async saveTotals() {
    await this.state.storage.put('totals', this.totals);
  }

  async fetch(request) {
    const totals = await this.loadTotals();

    if (request.method === 'GET') {
      return jsonResponse({ totals });
    }

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        const clicks = body?.clicks || {};

        // ולידציה
        let totalAdded = 0;
        for (const key of Object.keys(clicks)) {
          if (!ALLOWED_CANDIDATES.includes(key)) continue;
          const val = Number(clicks[key]) | 0;
          if (val < 0 || val > MAX_CLICKS_PER_REQUEST) continue;
          totals[key] = (totals[key] || 0) + val;
          totalAdded += val;
        }

        if (totalAdded > 0) {
          // שמור async — לא מחכים לדיסק כדי לחזור מהר
          this.state.waitUntil(this.saveTotals());
        }

        return jsonResponse({ totals });
      } catch (e) {
        return jsonResponse({ error: 'Invalid request' }, 400);
      }
    }

    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...CORS_HEADERS,
    },
  });
}

/* 61 — game engine (pure, no DOM). Fictional data only. */
(function (root) {
  const TARGET = 61, TOTAL = 120, TIME_LIMIT = 60, SET_VERSION = 1;
  // name → icon → color are fixed together, so a name always looks the same
  const PARTIES = [
    { id: 'gal',     nameHe: 'גל',    icon: 'wave',        color: '#7CC4F2' },
    { id: 'rimon',   nameHe: 'רימון', icon: 'pomegranate', color: '#F59DB8' },
    { id: 'ofek',    nameHe: 'אופק',  icon: 'horizon',     color: '#F2A488' },
    { id: 'nahal',   nameHe: 'נחל',   icon: 'stream',      color: '#5ED3C6' },
    { id: 'kochav',  nameHe: 'כוכב',  icon: 'star',        color: '#B3A6FF' },
    { id: 'zayit',   nameHe: 'זית',   icon: 'olive',       color: '#C9D3E0' },
    { id: 'matzpen', nameHe: 'מצפן',  icon: 'compass',     color: '#8FB0FF' },
    { id: 'shahar',  nameHe: 'שחר',   icon: 'sunrise',     color: '#E8C99A' },
  ];

  function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // all subsets (as index arrays) summing exactly to target, optional card cap
  function solutions(seats, target = TARGET, maxCards) {
    const n = seats.length, out = [];
    for (let m = 1; m < (1 << n); m++) {
      let s = 0, idx = [];
      for (let i = 0; i < n; i++) if ((m >> i) & 1) { s += seats[i]; idx.push(i); }
      if (s === target && (!maxCards || idx.length <= maxCards)) out.push(idx);
    }
    return out;
  }

  function validate(sc) {
    const errors = [];
    const seats = sc.cards.map(c => c.seats);
    const sum = seats.reduce((a, b) => a + b, 0);
    if (sum !== TOTAL) errors.push('sum ' + sum + ' != ' + TOTAL);
    if (seats.some(s => !Number.isInteger(s) || s <= 0)) errors.push('invalid seat value');
    if (sc.kind === 'historical' && (!sc.sourceUrl || !sc.sourceDate)) errors.push('historical scenario needs source');
    if (!solutions(seats, sc.targetSeats, sc.rules && sc.rules.maxCards).length) errors.push('unsolvable');
    return { ok: errors.length === 0, errors };
  }

  function makeSeats(rng) {
    const n = 8, seats = Array(n).fill(4); // floor of 4 seats per card
    const w = Array.from({ length: n }, () => Math.pow(rng(), 2) + 0.12);
    const wsum = w.reduce((a, b) => a + b, 0);
    for (let u = 0; u < TOTAL - 4 * n; u++) {
      let r = rng() * wsum, i = 0;
      while (r > w[i] && i < n - 1) { r -= w[i]; i++; }
      seats[i]++;
    }
    return seats.sort((a, b) => b - a);
  }

  function goodPuzzle(seats) {
    if (new Set(seats).size !== seats.length) return false;
    if (seats[0] > 35) return false;
    const sols = solutions(seats);
    return sols.length >= 1 && sols.length <= 3 && sols.every(s => s.length >= 3);
  }

  function buildScenario(id, seedKey, title) {
    const rng = mulberry32(hashStr(seedKey));
    let seats = null;
    for (let a = 0; a < 2000; a++) { const s = makeSeats(rng); if (goodPuzzle(s)) { seats = s; break; } }
    if (!seats) seats = [32, 24, 14, 12, 11, 10, 9, 8];
    const order = PARTIES.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    return scenario(id, title, seats.map((s, i) => ({ ...order[i], seats: s })));
  }

  function scenario(id, title, cards) {
    return { id, version: SET_VERSION, kind: 'fictional', title, targetSeats: TARGET, totalSeats: TOTAL,
      timeLimitSeconds: TIME_LIMIT, cards, rules: { exactTarget: true } };
  }

  const SAMPLE = scenario('sample-v1', 'סיבוב דמיוני', [32, 24, 14, 12, 11, 10, 9, 8].map((s, i) => ({ ...PARTIES[i], seats: s })));

  function israelDate(d = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  }
  const isDateStr = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  function dailyScenario(dateStr) { return buildScenario('daily-' + dateStr, 'daily|v' + SET_VERSION + '|' + dateStr, 'האתגר היומי'); }
  function classicScenario(seed) { return seed === 0 ? SAMPLE : buildScenario('classic-' + seed, 'classic|v' + SET_VERSION + '|' + seed, 'סיבוב דמיוני'); }

  /* ---------- real-polls mode ---------- */
  // Live data comes from /game/polls.json (written by poll-updater). This snapshot is the offline fallback.
  const POLLS_SNAPSHOT = {"version": 1, "hidden": false, "source": {"name": "ממוצע הסקרים של \"המדד\"", "url": "https://themadad.com/", "latestPoll": "2026-09-16", "fetchedAt": "2026-09-23T09:00:00.000Z"}, "minSeats": 3.9, "lists": [{"id": "yashar", "nameHe": "ישר!", "avg": 22, "seats": 23, "leader": "גדי איזנקוט"}, {"id": "likud", "nameHe": "הליכוד", "avg": 21.7, "seats": 22, "leader": "בנימין נתניהו"}, {"id": "beyachad", "nameHe": "ביחד", "avg": 12.1, "seats": 12, "leader": "נפתלי בנט"}, {"id": "democrats", "nameHe": "הדמוקרטים", "avg": 9, "seats": 9, "leader": "יאיר גולן"}, {"id": "ybeytenu", "nameHe": "ישראל ביתנו", "avg": 8, "seats": 8, "leader": "אביגדור ליברמן"}, {"id": "shas", "nameHe": "ש״ס", "avg": 7.8, "seats": 8, "leader": "אריה דרעי"}, {"id": "utj", "nameHe": "יהדות התורה", "avg": 7.7, "seats": 8, "leader": "יצחק גולדקנופף"}, {"id": "otzma", "nameHe": "עוצמה יהודית", "avg": 7.6, "seats": 8, "leader": "איתמר בן גביר"}, {"id": "joint", "nameHe": "הרשימה המשותפת", "avg": 7.1, "seats": 7, "leader": "יוסף ג׳בארין"}, {"id": "rzp", "nameHe": "הציונות הדתית / זהות", "avg": 6, "seats": 6, "leader": "בצלאל סמוטריץ׳"}, {"id": "raam", "nameHe": "רע״מ", "avg": 5.2, "seats": 5, "leader": "מנסור עבאס"}, {"id": "winter", "nameHe": "עמך ישראל", "avg": 4.1, "seats": 4, "leader": "עופר וינטר"}], "excluded": [{"nameHe": "הנדל וזליכה", "avg": 3.5}, {"nameHe": "כחול לבן", "avg": 1.1}], "generatedAt": "2026-09-23T09:00:00.000Z"};
  const POLL_COLORS = ['#7CC4F2','#F59DB8','#5ED3C6','#B3A6FF','#F2A488','#8FB0FF','#E8C99A','#C9D3E0','#9EE6A8','#F7B7E0','#A8E0F0','#FFD1A1','#D6C3FF','#B8F0D0'];
  // neutral game palette assigned by rank — not party branding
  function pollsFromData(d) {
    if (!d || d.hidden || !Array.isArray(d.lists)) return null;
    const lists = d.lists.filter(l => Number.isInteger(l.seats) && l.seats > 0);
    if (lists.reduce((a, l) => a + l.seats, 0) !== TOTAL || lists.length < 2) return null;
    const sc = scenario('polls-' + (d.source && d.source.latestPoll || 'x'), 'ממוצע הסקרים',
      lists.map((l, i) => ({ id: l.id, nameHe: l.nameHe, seats: l.seats, leader: l.leader || null, avg: l.avg, color: POLL_COLORS[i % POLL_COLORS.length] })));
    sc.kind = 'polls'; sc.rules = { exactTarget: false };
    sc.source = { name: d.source.name, url: d.source.url, asOf: (d.source.fetchedAt || '').slice(0, 10), latestPoll: d.source.latestPoll, minSeats: d.minSeats };
    sc.excluded = d.excluded || [];
    return sc;
  }
  const POLLS = pollsFromData(POLLS_SNAPSHOT);
  const POLL_SOURCE = POLLS.source;

  // game rule (a simplification, not a prediction): PM = leader of the largest list in the coalition
  function primeMinister(cards, ids) {
    const inC = ids.map(id => cards.find(c => c.id === id)); if (!inC.length) return null;
    const max = Math.max(...inC.map(c => c.seats)); const top = inC.filter(c => c.seats === max);
    return { lists: top, names: top.map(c => c.leader || ('ראש ' + c.nameHe)) };
  }

  function sumOf(cards, ids) { return ids.reduce((a, id) => a + (cards.find(c => c.id === id) || { seats: 0 }).seats, 0); }
  function evaluate(sum) { return sum === TARGET ? 'win' : sum > TARGET ? 'over' : 'under'; }

  const api = { TARGET, TOTAL, TIME_LIMIT, SET_VERSION, PARTIES, SAMPLE, solutions, validate, dailyScenario, classicScenario,
    israelDate, isDateStr, sumOf, evaluate, hashStr, POLLS, POLL_SOURCE, pollsFromData, primeMinister };
  if (typeof module !== 'undefined') module.exports = api; else root.Engine = api;
})(typeof window !== 'undefined' ? window : this);

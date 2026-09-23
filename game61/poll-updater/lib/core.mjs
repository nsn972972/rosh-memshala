// Pure logic for the poll updater — no network, no fs. Tested in test/core.test.mjs
export const norm = s => String(s ?? '').replace(/[״"']/g, '"').replace(/\s+/g, ' ').replace(/\s*\/\s*/g, ' / ').trim();

const clean = html => html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
  .replace(/&quot;/g, '"').replace(/&#0?39;|&#8217;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// Finds the table whose header contains "ממוצע המדד" and returns [{name, avg}] + the latest poll date in the header
export function parseAverageTable(html, header = 'ממוצע המדד') {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  for (const t of tables) {
    const rows = (t.match(/<tr[\s\S]*?<\/tr>/gi) || []).map(r => (r.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi) || []).map(clean));
    const hi = rows.findIndex(r => r.some(c => c.includes(header)));
    if (hi < 0) continue;
    const col = rows[hi].findIndex(c => c.includes(header));
    const dates = rows[hi].join(' ').match(/\d{4}-\d{2}-\d{2}/g) || [];
    const lists = [];
    for (const r of rows.slice(hi + 1)) {
      const name = r[0], v = parseFloat(String(r[col]).replace(',', '.'));
      if (!name || /סך הכל|total/i.test(name)) continue;
      if (Number.isFinite(v)) lists.push({ name, avg: v });
    }
    return { lists, latestPoll: dates.sort().pop() || null };
  }
  throw new Error('average table not found — the source page layout may have changed');
}

export function mapLists(parsed, parties, minSeats) {
  const byAlias = new Map();
  parties.forEach(p => [p.nameHe, ...p.aliases].forEach(a => byAlias.set(norm(a), p)));
  const mapped = [], unknown = [];
  for (const row of parsed) {
    const p = byAlias.get(norm(row.name));
    if (p) mapped.push({ ...p, avg: row.avg });
    else if (row.avg >= minSeats) unknown.push(row.name); // an unmapped list that matters → stop
  }
  return { mapped, unknown };
}

export function normalize(mapped, minSeats, total = 120) {
  const inList = mapped.filter(p => p.avg >= minSeats), sum = inList.reduce((a, p) => a + p.avg, 0);
  const ex = inList.map(p => ({ ...p, q: p.avg * total / sum }));
  ex.forEach(p => { p.seats = Math.floor(p.q); });
  const left = total - ex.reduce((a, p) => a + p.seats, 0);
  [...ex].sort((a, b) => (b.q - b.seats) - (a.q - a.seats) || b.avg - a.avg).slice(0, left).forEach(p => { p.seats++; });
  return {
    lists: ex.sort((a, b) => b.seats - a.seats || b.avg - a.avg).map(p => ({ id: p.id, nameHe: p.nameHe, avg: p.avg, seats: p.seats, leader: p.leader || null })),
    excluded: mapped.filter(p => p.avg < minSeats).map(p => ({ nameHe: p.nameHe, avg: p.avg })),
  };
}

// every list that can be the largest in some 61+ coalition needs a leader
export function possibleLargest(lists) {
  const n = lists.length, need = new Set();
  for (let m = 1; m < (1 << n); m++) {
    let s = 0, max = -1, top = [];
    for (let i = 0; i < n; i++) if ((m >> i) & 1) { s += lists[i].seats; if (lists[i].seats > max) { max = lists[i].seats; top = [i]; } else if (lists[i].seats === max) top.push(i); }
    if (s >= 61) top.forEach(i => need.add(lists[i].id));
  }
  return [...need];
}

export function validate(out, prev, cfg) {
  const errors = [];
  const sum = out.lists.reduce((a, l) => a + l.seats, 0);
  if (sum !== 120) errors.push('seat sum ' + sum);
  if (out.lists.length < cfg.minLists) errors.push('only ' + out.lists.length + ' lists');
  const noLeader = possibleLargest(out.lists).filter(id => !out.lists.find(l => l.id === id).leader);
  if (noLeader.length) errors.push('missing leader for possible PM list: ' + noLeader.join(', '));
  if (prev && !prev.hidden && prev.lists) for (const l of out.lists) {
    const p = prev.lists.find(x => x.id === l.id);
    if (p && Math.abs(p.seats - l.seats) > cfg.maxSeatJump) errors.push('jump ' + l.id + ' ' + p.seats + '→' + l.seats);
  }
  return errors;
}

// wall-clock in Israel as "YYYY-MM-DDTHH:MM" (string compare works)
export function israelNow(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export const inBlackout = (cfg, d = new Date()) => { const t = israelNow(d); return t >= cfg.blackoutStart && t < cfg.blackoutEnd; };

export function build(html, parties, cfg, prev, now = new Date()) {
  if (inBlackout(cfg, now)) return { ok: true, data: { version: 1, hidden: true, reason: 'blackout', generatedAt: now.toISOString() } };
  const parsed = parseAverageTable(html);
  const { mapped, unknown } = mapLists(parsed.lists, parties, cfg.minSeats);
  if (unknown.length) return { ok: false, errors: ['unknown lists above threshold: ' + unknown.join(', ')] };
  const n = normalize(mapped, cfg.minSeats);
  const data = { version: 1, hidden: false, source: { ...cfg.source, latestPoll: parsed.latestPoll, fetchedAt: now.toISOString() },
    minSeats: cfg.minSeats, lists: n.lists, excluded: n.excluded, generatedAt: now.toISOString() };
  const errors = validate(data, prev, cfg);
  return errors.length ? { ok: false, errors } : { ok: true, data };
}

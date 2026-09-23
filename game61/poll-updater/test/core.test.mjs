import assert from 'node:assert/strict';
import { readFileSync, rmSync, readFileSync as rf } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
import { parseAverageTable, mapLists, normalize, build, inBlackout, validate } from '../lib/core.mjs';
const html = readFileSync(new URL('./fixtures/madad-2026-09-23.html', import.meta.url), 'utf8');
const parties = JSON.parse(readFileSync(new URL('../parties.json', import.meta.url), 'utf8')).lists;
const cfg = JSON.parse(readFileSync(new URL('../config.json', import.meta.url), 'utf8'));
let n = 0; const t = (name, f) => { f(); n++; console.log('✓', name); };
const NOW = new Date('2026-09-23T09:00:00Z');

t('parses the average column and latest poll date', () => { const p = parseAverageTable(html); assert.equal(p.lists.length, 14); assert.equal(p.lists[1].avg, 21.7); assert.equal(p.latestPoll, '2026-09-16'); });
t('maps aliases incl. quote variants', () => { const { mapped, unknown } = mapLists(parseAverageTable(html).lists, parties, 3.9); assert.equal(unknown.length, 0); assert.ok(mapped.find(m => m.id === 'winter')); });
t('normalizes to 120 with expected seats', () => { const r = build(html, parties, cfg, null, NOW); assert.ok(r.ok, r.errors); assert.deepEqual(r.data.lists.map(l => l.seats), [23,22,12,9,8,8,8,8,7,6,5,4]); });
t('excludes lists under threshold', () => assert.deepEqual(build(html, parties, cfg, null, NOW).data.excluded.map(e => e.avg), [3.5, 1.1]));
t('unknown list above threshold blocks publish', () => { const r = build(html.replace('עופר וינטר', 'רשימה חדשה'), parties, cfg, null, NOW); assert.ok(!r.ok); assert.match(r.errors[0], /unknown/); });
t('unknown list below threshold is ignored', () => assert.ok(build(html.replace('כחול לבן', 'רשימה זעירה'), parties, cfg, null, NOW).ok));
t('layout change throws (keeps old file)', () => assert.throws(() => build('<table><tr><td>x</td></tr></table>', parties, cfg, null, NOW)));
t('seat jump gate', () => { const prev = build(html, parties, cfg, null, NOW).data; const p2 = { ...prev, lists: prev.lists.map(l => l.id === 'likud' ? { ...l, seats: 30 } : l) }; assert.ok(!build(html, parties, cfg, p2, NOW).ok); });
t('missing leader for a possible PM list blocks', () => { const pp = parties.map(p => p.id === 'democrats' ? { ...p, leader: null } : p); const r = build(html, pp, cfg, null, NOW); assert.ok(!r.ok); assert.match(r.errors.join(), /democrats/); });
t('blackout window (Israel time)', () => {
  assert.ok(!inBlackout(cfg, new Date('2026-10-22T20:59:00Z'))); // 23:59 Thu IL
  assert.ok(inBlackout(cfg, new Date('2026-10-22T21:00:00Z')));  // 00:00 Fri IL
  assert.ok(inBlackout(cfg, new Date('2026-10-27T19:59:00Z')));  // 21:59 election day (IST, after DST ends 25.10)
  assert.ok(!inBlackout(cfg, new Date('2026-10-27T20:00:00Z'))); // 22:00 polls close
  assert.equal(build(html, parties, cfg, null, new Date('2026-10-24T10:00:00Z')).data.hidden, true); });
t('CLI: writes file, then reports no change, and refuses bad data', () => {
  const tmp = join(ROOT, 'test/.tmp'), out = join(tmp, 'polls.json'); rmSync(tmp, { recursive: true, force: true });
  const run = (...a) => execFileSync('node', ['update-polls.mjs', '--html', 'test/fixtures/madad-2026-09-23.html', '--out', out, ...a], { encoding: 'utf8', cwd: ROOT });
  assert.match(run(), /published/); const j = JSON.parse(rf(out, 'utf8')); assert.equal(j.lists.reduce((a, l) => a + l.seats, 0), 120);
  assert.match(run(), /no change/);
  let failed = false; try { execFileSync('node', ['update-polls.mjs', '--html', 'package.json', '--out', out], { stdio: 'pipe', cwd: ROOT }); } catch (e) { failed = e.status === 3; }
  assert.ok(failed); assert.equal(JSON.parse(rf(out, 'utf8')).lists.length, 12);
  rmSync(tmp, { recursive: true, force: true }); });
console.log(n + ' updater tests passed');

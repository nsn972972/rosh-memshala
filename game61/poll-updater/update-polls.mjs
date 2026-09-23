#!/usr/bin/env node
// Fetches the poll average, validates it and writes public/game/polls.json.
// Any failure leaves the previous file untouched and exits non-zero (the scheduled job then emails the repo owner).
// Usage: node poll-updater/update-polls.mjs [--html fixture.html] [--force]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './lib/core.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), arg = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const cfg = JSON.parse(await readFile(resolve(here, 'config.json'), 'utf8'));
const parties = JSON.parse(await readFile(resolve(here, 'parties.json'), 'utf8')).lists;
const outPath = resolve(here, '..', arg('--out') || cfg.output);

let prev = null; try { prev = JSON.parse(await readFile(outPath, 'utf8')); } catch {}
if (args.includes('--force') && prev) prev = null; // skip the seat-jump gate after a human check

let html;
if (arg('--html')) html = await readFile(arg('--html'), 'utf8');
else {
  const res = await fetch(cfg.source.url, { headers: { 'User-Agent': 'game61-poll-updater (contact: site owner)' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) { console.error('fetch failed', res.status); process.exit(2); }
  html = await res.text();
}

let r; try { r = build(html, parties, cfg, prev); } catch (e) { console.error('✗', e.message); process.exit(3); }
if (!r.ok) { console.error('✗ not published:\n  ' + r.errors.join('\n  ')); process.exit(4); }

const same = prev && JSON.stringify({ ...prev, generatedAt: 0, source: { ...prev.source, fetchedAt: 0 } }) === JSON.stringify({ ...r.data, generatedAt: 0, source: { ...r.data.source, fetchedAt: 0 } });
if (same) { console.log('= no change'); process.exit(0); }
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(r.data, null, 2) + '\n');
console.log(r.data.hidden ? '✓ blackout: poll mode hidden' : '✓ published ' + r.data.lists.map(l => l.nameHe + ' ' + l.seats).join(', '));

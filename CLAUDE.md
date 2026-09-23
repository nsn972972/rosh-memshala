# ראשממשלת.ישראל — project instructions

## What this repo is
Static site on GitHub Pages (custom domain in `CNAME`, Cloudflare in front). No build step.
The site is a **single page** — do not add separate pages.
- `index.html` — the whole site: candidate support counter + countdown, then the game section `#game` at the end. Counter API in `worker.js` (Cloudflare Worker + Durable Object). Do not change the counter or existing content without an explicit request.
- The game "61 — יש לך דקה" (full spec: `game61/docs/61_claude_product_spec_he.md`):
  - React app (UMD React + htm from CDN, no build) mounts into `#game-root` from the **inline** script at the end of `index.html`, wrapped in an IIFE so its names don't collide with the homepage script. Kept inline on purpose: Windows Defender flags it as `Trojan:Win32/MalUri.A!cl` (false positive) when saved as a separate `app.js`, which blocks local editing.
  - `game/style.css` — every rule is scoped under `.g61`, keyframes are prefixed `g61-`. Keep it that way: the homepage has its own `.countdown`, `@keyframes pulse`, and global `h1`/`header`/`*` rules.
  - The page's only `h1` and `main` belong to the homepage; game screens use `h2` and `div`. Don't autofocus or scroll to the game on a plain visit — only after the player interacts or arrives via a share link (`#/daily/…`, `#/c/…`, `#/coalition`).
  - `game/engine.js` — pure game logic (no DOM), shared by the page and the tests.
  - GitHub Pages serves CSS/JS with a 4-hour browser cache: after changing `game/style.css` or `game/engine.js`, bump the `?v=` on their links in `index.html`.
  - `game/polls.json` — written by the poll updater; the engine has an embedded snapshot as fallback.
- `game61/poll-updater/` — fetches the poll average, maps names (`parties.json`), normalizes to 120, validates, writes `game/polls.json`.
- `.github/workflows/update-polls.yml` — runs the updater every 2h; commits only changed, validated data.

## Commands
- Engine tests: `node game61/game/engine.test.cjs`
- Updater tests: `node game61/poll-updater/test/core.test.mjs`
- Updater dry run against the live source: `node game61/poll-updater/update-polls.mjs --out <tmp>/polls.json`
- Local preview: any static server from the repo root (paths are absolute, e.g. `/game/engine.js`).

## Game data modes
- **Main mode — published poll average.** Seats come from a published poll average (currently "המדד"), rounded to 120, lists under the threshold excluded. Every screen in this mode shows the source name + link, the latest poll date, the update date and the exclusions, and the badge "משחק על בסיס ממוצע סקרים · לא תחזית".
- **Blackout.** From `blackoutStart` to `blackoutEnd` (Israel time, `game61/poll-updater/config.json`) the updater writes `{"hidden": true}`; the client also hides poll mode from `ELECTION.pollsHiddenFrom` in `index.html`. Both dates must be verified against the election propaganda law before changing them.
- **Secondary mode — fictional.** Classic and daily challenges use fictional lists (גל, רימון, …) labeled "משחק דמיוני · לא סקר בחירות".
- The "PM = leader of the largest list in the coalition" rule is a game simplification, not a prediction; keep it labeled as such.

## Data and fairness
- Never fabricate polls, seat numbers, alliances, leaders or electoral claims. New or merged lists go into `parties.json` only from the source; `leader` must be verified.
- Historical scenarios require a checked official source, source date and verifiable seat totals.
- Rankings, if implemented, compare game speed only — never parties or coalitions.
- Do not collect or infer players' political preferences from game actions. No sign-up. Best times stay in localStorage only.
- Do not mix homepage support counts with game results or poll data.

## UX and engineering
- Hebrew, real RTL, 360px mobile support are mandatory.
- Touch, pointer and keyboard must all work; tapping cards alone must suffice.
- Timer starts only after the player actively begins.
- Every daily challenge must be deterministic (Asia/Jerusalem date + set version) and solvable. Changing the generator = bump `SET_VERSION`, keep old links working.
- Respect `prefers-reduced-motion`; sound off by default; accessible contrast.
- Share links point to the same challenge on the homepage (hash routes `#/daily/YYYY-MM-DD`, `#/c/<seed>`). Do not claim personal dynamic OG cards without a server.
- Run the tests and report actual results, never imaginary passes.
- Do not deploy (push to `main` = deploy), change DNS, or run the workflow without explicit authorization.

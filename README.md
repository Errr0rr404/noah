# Noah's Super World

A single-page, comic-book mini-game toybox made for **Noah** (age 5).
Big tap targets, mostly-winning play, and feedback that works without
reading: sound, pops, haptics, and confetti.

No build step, no npm packages, no backend. Open the files or drop the
repo on a static host.

## Who it's for

- **Noah** — tablet-first play at home
- **Family** — Mom, Dad, and sister Manha appear in the Family screen
- **Whoever hosts it** — deploy the repo root as a static site (Cloudflare
  Workers is already configured)

## Tech stack

Versions come from the files themselves (there is no `package.json`):

| Piece | What the code uses |
| --- | --- |
| Markup / style / logic | Plain HTML, CSS, vanilla JavaScript — no framework, no bundler |
| Sound | Web Audio API (oscillators only; no audio files) |
| Persistence | `localStorage` keys prefixed `noah:` (in-memory fallback if storage is blocked) |
| Motion | Canvas 2D for confetti and **Noah World**; CSS for the rest |
| Fonts | Google Fonts CDN: **Baloo 2** + **Luckiest Guy**, with `system-ui` / `cursive` fallbacks |
| PWA | `manifest.json` + `sw.js` (register only on `http`/`https`; `file://` stays a double-click) |
| Host | Cloudflare Worker `world-of-noah` — static assets of the repo root (`wrangler.jsonc`) |

Asset cache-busting uses query strings (`styles.css?v=3`, `script.js?v=3`,
`mascot.js?v=3`) plus a matching service-worker cache name
(`noah-super-world-v3`). Bump those together when shipping JS/CSS changes.

## Screens

Home grid plus **13** hash-routed screens (`#soccer`, `#world`, …).
Nav arrows, left/right swipe, and `←`/`→` cycle games. `Esc` returns home.
Unknown hashes fall back to home.

| Tile | Route | Play |
| --- | --- | --- |
| World | `#world` | Noah World — canvas playground: joystick or drag to walk, JUMP, coins, rainbow obby (no death) |
| Soccer | `#soccer` | Soccer Star — shoot the glowing lane past the keeper |
| Race | `#cars` | Tap Race — pick cars, tap to beat a slow rival |
| Bats | `#batman` | Bat Catch — tap bats; moon fires a bat-signal sweep |
| Punch | `#kickboxing` | Power Punch — 10-second mash, belt ranks |
| Police | `#police` | Police Chase — 15-second robber tap |
| Blast | `#blaster` | Silly Blaster — endless splat (can't lose) |
| Stack | `#minecraft` | Block Stack — drop-and-align tower (soft miss, no game-over) |
| Bikes | `#bikes` | Bike Run — jump / double-jump, 3 hearts, star shield |
| Family | `#family` | Noah's Family — tap Mom, Dad, Manha, Noah |
| Friends | `#friends` | My 10 Friends — high-five every friend to finish a round |
| Run! | `#nostudy` | Catch the Book — the book flees; every 6th tap catches it |
| Trophies | `#trophies` | My Trophies — sticker wall from stored bests |

Home also has a **PARTY TIME** confetti button. A CSS-shape Super Noah
mascot hops on confetti, tile taps, and a poke (`mascot.js`).

## Run locally

Static files only. Either open `index.html` in a browser (`file://` —
sound and games work; the service worker does **not** register) or serve
the folder:

```sh
python3 -m http.server
```

Then open http://localhost:8000. Any other static server on the repo
root is fine.

First tap/click unlocks Web Audio (browser autoplay rules) and fires a
welcome confetti burst.

## Test

There is **no test runner, CI, or lint script**. Check by playing:

1. Serve the folder (or open `index.html`).
2. Walk the home tiles, swipe / arrows between games, `Esc` back home.
3. Confirm mute persists after a refresh.
4. On `http(s)`, DevTools → Application → service worker registered;
   airplane mode should still load the precached shell.
5. Optional: `prefers-reduced-motion: reduce` should quiet shakes,
   bursts, and heavy animation.

## Deploy

Cloudflare Workers static assets, no build command. Public URL:
**https://noah.worldofz.info** (preview: `world-of-noah.worldofz.workers.dev`).

`wrangler.jsonc` + `worker.js` publish the repo root and set:

- security headers (`X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`)
- `Cache-Control: public, max-age=0, must-revalidate` on HTML, JS, CSS,
  and `/sw.js` so a tablet does not keep yesterday's game
- 1-hour cache on `/manifest.json`

`404.html` meta-refreshes to `/`. A push to `main` on
`https://github.com/Errr0rr404/noah.git` runs
`.github/workflows/deploy-cloudflare.yml` (`CLOUDFLARE_API_TOKEN`).
Local: `npx wrangler deploy` from the repo root.

After a JS/CSS change, bump the `?v=` query on the three asset links in
`index.html` **and** the `CACHE` / `PRECACHE` entries in `sw.js` so
installed tablets pick up the new files.

The site previously lived on Netlify (`world-of-noah.netlify.app`). Production is Cloudflare only.

## Environment variables

None. The site reads no `process.env` or secrets. All
tuning is in the source files.

Browser `localStorage` keys (names only; values are scores / flags):

`noah:sound`, `noah:soccerBest`, `noah:raceWins`, `noah:batBest`,
`noah:punchBest`, `noah:copBest`, `noah:blastBest`, `noah:stackBest`,
`noah:worldBest`, `noah:worldObby`, `noah:bikeBest`, `noah:bikeRide`,
`noah:fives`, `noah:friendsRound`, `noah:friendsDone`,
`noah:trophiesEarned`, `noah:trophySeen:<id>`

Private / blocked storage falls back to in-memory defaults (progress
resets on reload).

## Repo layout

```
.
├── index.html      # Home + every game screen, PWA / font / SW hooks
├── styles.css      # Comic theme, layout, animations
├── script.js       # Router, sound, confetti, all game logic
├── mascot.js       # Home mascot cheers (listens for `noah:confetti`)
├── manifest.json   # Add-to-home-screen metadata
├── sw.js           # Same-origin cache-first SW
├── 404.html        # Miss → home
├── wrangler.jsonc  # Cloudflare Worker + custom domain
├── worker.js       # Cache / security headers
├── .github/workflows/deploy-cloudflare.yml
├── PLAN.md         # Dated 2026-06-02 audit / roadmap (historical)
└── README.md       # This file
```

No `docs/`, app `package.json`, or test directory.

## Historical notes

`PLAN.md` is a **2026-06-02** multi-agent audit and improvement plan. It
describes the app as it was then (11 games) and proposed later work.
Several items have since shipped (fairness, juice, trophies, PWA shell,
Noah World). Do not treat that file as current product status.

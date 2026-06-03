# Noah's Super World — Improvement Plan

> Produced by a multi-agent Opus research run: 7 analysis agents audited distinct
> dimensions of the live code, every finding was adversarially fact-checked against
> the actual source (53 confirmed, 2 dropped as inaccurate/constraint-breaking), a
> 3-philosophy game-design panel proposed new games, and a synthesis pass folded it
> all into the prioritized roadmap below. All recommendations respect the hard
> constraints: **dependency-free** (opens by double-clicking), **non-reader-friendly**,
> **mostly-winning** (a 5yo should rarely lose), big tap targets, tablet-first.

## State of the app

Genuinely well-built, dependency-free kids' toybox: 11 mini-games on one hash-routed
page, a clean Web Audio SFX engine, canvas confetti, a CSS-shape mascot, `localStorage`
best-scores, haptics, and a consistent **sound + pop + confetti** feedback vocabulary
that makes it playable without reading. The architecture is solid (`registerGame`
`enter`/`leave` hooks, one rAF loop at a time, proper timer cleanup), so the work ahead
is overwhelmingly **tuning and additive juice, not rebuilds**.

The most urgent issues are a small set of **fairness violations** against the
"mostly-winning" constraint and **three text-only START gates** that strand a non-reader
on a dead stage. The biggest delight wins are cheap: per-game win jingles, confetti that
fires from the finger, escalating combo pitch, and personalizing content with Noah's
loves (Golden Lamborghini, Cybertruck, dirt bike, his 10 friends). One real infra gap:
the comic font is a Google Fonts CDN dependency with no fallback and no offline cache.

## Top themes

1. **Honor "mostly-winning" everywhere** — the few games that can truly punish (Block
   Stack crash, Bike Run terminal crash, Soccer's inverted rule, Tap Race rival loss)
   should fail soft/funny, using mechanisms already in the code.
2. **Make every game playable by a non-reader with no dead-end** — kill the 3 text-only
   START gates (first-tap-to-start) and replace inverted/text-only rules with
   show-don't-tell visual cues.
3. **Cheap, high-leverage juice that reuses existing systems** — per-game win jingles,
   confetti from the finger, combo pitch, comic burst shapes, a livelier mascot.
4. **Personalize for THIS kid** — Golden Lambo + Cybertruck in the race, an unlockable
   dirt bike, his 10 named friends, and a Trophy Room celebrating progress already in
   `localStorage`.
5. **Offline + accessibility hardening** — self-host/fallback the font, add a tiny PWA
   layer, and route confetti/shake through a reduced-motion check.

---

## Phase 1 — Fairness & non-reader access (do first)

These directly fix the hard-constraint violations. All are small JS/CSS, dependency-free.

### 1.1 Block Stack: forgiving snap + never crash-to-game-over `[small / high]`
`script.js` (Minecraft IIFE)
- Widen the perfect/snap window at `script.js:978` from `overhang > 12` to **~30–40px**
  so most drops auto-snap full-width and fire the PERFECT path (lines 982–989) instead
  of shrinking the tower.
- Lower the speed cap at `script.js:994` to ~`Math.min(3.0, speed + 0.06)`.
- Soften the complete-miss at `script.js:968–972`: instead of `gameOver()` + `Sound.crash()`,
  re-spawn the same block (auto-retry) with a playful wobble/boing.
- Keep a **minimum block-width floor** so it never becomes an unplayable sliver.
- *Why:* the single biggest "mostly-winning" violation — imprecise timing scores 0–3 and
  hears a crash.

### 1.2 Bike Run: soft, non-terminal crash + starting shield `[small / high]`
`script.js` (Bikes IIFE, ~1170–1194)
- Grant a free **~2.5s starting shield** each run (`shieldUntil = Date.now()+2500` in
  `start()`, ~line 1179).
- Give **3 hearts** 💛💛💛: on an unshielded hit, decrement a life, remove that rock, play
  a bouncy `Sound.boom()` (not `crash()`), `floatPop('OOPS! 💨')`, grant ~1.5s invincibility
  so hits don't chain. Only call `crash()` at 0 lives.
- Raise shield-star frequency at `script.js:1144` to ~`rand(500,900)`.
- *Why:* today any rock/cactus ends the run with a crash sound; a 5yo crashes within
  seconds, repeatedly.

### 1.3 Soccer: show-don't-tell "shoot HERE" cue + reset-on-enter `[small / high]`
`script.js` (Soccer IIFE), `index.html:96`
- In `placeKeeper()`/`keeperTick()`, toggle an `open` class on the two shoot-buttons whose
  zone ≠ `keeperZone`, and a dim `blocked` class on the keeper's zone — so the inverted
  rule ("shoot where the keeper is NOT", 303–305) is **visible without reading**.
- **Reset `score=0`/`streak=0` in `enter()`** (it currently never resets, so
  `keeperInterval()` shrinks every replay — see bug 2 below).
- Keep the ~66% fair-by-construction scoring.

### 1.4 Tap Race: tilt toward Noah and soften any loss `[trivial / medium]`
`script.js` (Cars IIFE)
- Slow the rival at `script.js:404` to ~`rand(0.35,0.7)` and add a "choke near the line":
  once `rPos > 80`, multiply its step by ~0.4 so it stalls before finishing.
- In `finish(false)` (437–438) replace "Rival won — tap faster next time!" with
  "So close — go again! 🏁" and swap `Sound.sad()` for `Sound.pop()`/a cheer.
- Optional small catch-up nudge when `pPos < rPos`.

### 1.5 Kill the 3 text-only START gates (first-tap-to-start) `[medium / high]`
`script.js` (Cars, Kickboxing, Police)
- Make the **first tap on the play area itself** start the game: Punch bag handler
  (`601`) calls `startChallenge()` instead of showing "Tap START to begin!"; Police starts
  on a `chaseZone` tap; Race starts on a track tap.
- Prefer tap-to-start over true auto-start so the timer doesn't burn before he's ready.
- Add a pulsing 👇 wiggle on the idle big-button. (Stack/Bikes already auto-start — leave
  them.)
- *Why:* a non-reader taps the bag/robber/track and gets a static stage + a word-only
  button — a dead end — while Batman/Blaster auto-start, so behavior looks broken.

### 1.6 Bigger, slower-fleeing robber in Police `[trivial / medium]`
- Bump `.robber` font-size ~3rem→3.8rem + `padding:10px` so the hitbox clears 48px; raise
  the flee floor at `script.js:654` to `Math.max(1500, 1900 - score*15)`; optionally scale
  the robber up when `time<=5`.

### 1.7 Fix No-Study touch dodge (bug 6) while in this area `[small]`
- Add a `pointermove` dodge alongside the dead `mouseenter` one (`script.js:1331`), gated
  `taps%6 !== 5` so the catch stays guaranteed.

---

## Phase 2 — Cheap, high-leverage juice (best delight-per-effort)

All reuse the existing `Sound`/`confettiBurst`/`floatPop` helpers. Mostly trivial/small.

| # | Change | Effort/Impact | Where |
|---|--------|---------------|-------|
| 2.1 | **Per-game win jingles** instead of one universal `Sound.win()` (winGoal/winPower/winHero + keep arpeggio as default) | small / high | `script.js` win sites: soccer 321, kickboxing 590, blaster 823, bat sweep 528 |
| 2.2 | **Confetti fires from the finger** — add `confettiBurst(count, x, y)` defaulting to center; pass `e.clientX/Y` at per-tap hits | small / high | `script.js:120–126` + blaster/bat/punch/police handlers |
| 2.3 | **Escalating combo pitch** — `combo:(n)=>tone(523*1.0595**min(n,24),0.1,'triangle',0.18)`; wire into Police (701), Blaster (818), Soccer streaks | small / high | `script.js` |
| 2.4 | **Attack ramp** — in `tone()` (46) start gain at 0.0001 and ramp to vol over ~8ms to kill the leading click on all 15 sounds | trivial / medium | `script.js:46` |
| 2.5 | **Master gain + compressor** — route `tone()` through a lazily-built `master(~0.7)→DynamicsCompressor→destination` in `ensure()`; soften `crash()` sawtooth 0.25→0.18 | small / medium | `script.js:48` |
| 2.6 | **Comic "KA-POW" burst shapes** at impact — `spawnBurst(x,y,word,color)` reusing the `.mascot-burst` star clip-path (`styles.css:198`); call from blaster blast (807) + punch (~600); gate under reduced-motion | small / high | `styles.css`, `script.js` |
| 2.7 | **Squash/stretch** on tap targets — `.tile:active` scaleY .92/scaleX 1.04; punch-bag `.hit` compress frame; add `.bat`/`.punch-bag`/`.keeper` to reduced-motion block | small / high | `styles.css` |
| 2.8 | **Confetti variety + hard cap** — per-particle shape (rect/circle/streamer + ~15% emoji ⭐⚡💥⚽); cap at ~280 particles so party button/mega-blast can't balloon | small / high | `script.js` |
| 2.9 | **Signature pickup/moment sounds** — coin ka-ching at bike pickup (1134), sparkle for Mom #1 (1221), bat-signal sweep sound (528), shield whoosh (1152) | small / high | `script.js` |
| 2.10 | **Escalating countdown tick** — `tickUrgent(left)` climbing 850→1000→1150Hz at kickboxing 578 / police 673 | trivial / medium | `script.js` |
| 2.11 | **Nav arrows show next/prev game's emoji** (reuse home-tile emoji) updated in `show()`/`setChrome()` + one-time wiggle | small / high | `script.js`, `styles.css`, `index.html` |
| 2.12 | **Move nav arrows out of the resting-thumb zone** (`styles.css:154` top:50% → bottom corners) + audible mute cue + visible "sound off" state | small / medium | `styles.css`, `script.js` |
| 2.13 | **Delete `background-attachment: fixed`** (`styles.css:55`) — removes a mobile scroll-repaint source at zero visual cost | trivial / medium | `styles.css` |
| 2.14 | **Fix low-contrast white card-text** on gold/yellow stages — scoped `.card-gold .card-text, .card-yellow .card-text { color: var(--ink); }` | trivial / low | `styles.css` |
| 2.15 | **Repurpose dead `Sound.miss`** (57, zero call sites) into a soft rising near-miss "boing" for No-Study "So close!" (1324–1327) — never the harsh 160Hz sawtooth | trivial / low | `script.js` |
| 2.16 | **Mascot reacts beyond home** — wire `cheer()` to home/sound buttons; replace the `window.confettiBurst` monkey-patch with a CustomEvent (bug 4) | trivial / low | `mascot.js` |
| 2.17 | **Keyboard `:focus-visible` ring** — 4px `var(--sun)` outline on all native buttons | trivial / low | `styles.css` |

---

## Phase 3 — Personalization (make it HIS world)

### 3.1 Golden Lambo + Cybertruck in the race + unlock the dirt bike `[medium / high]`
- Add **GOLDEN LAMBO** and **CYBERTRUCK** picks to `#carPick`/`#rivalPick`, rendered as
  tiny CSS-shape racers (gold wedge / silver Cybertruck silhouette) via the mascot's
  CSS-shape approach. Apply the shape class to **the racer the button controls** (player OR
  rival — `wirePicker` is shared, never hardcode `#playerCar`); keep the emoji `textContent`
  path for the others. Give the Lambo a gentle `STEP` boost (tap, `script.js:417`) — fun but
  still mostly-winning.
- Turn the existing free 🏍️ into a **LOCKED dirt-bike reward** unlocked at a low persisted
  `bikeBest` (~60–80m), with a stored unlock flag that re-checks on load.
- *Tradeoff:* CSS-shape vehicles are fiddly; locking the currently-free bike could briefly
  frustrate, so keep the threshold low and persist the unlock.

### 3.2 Name his 10 real friends `[small / medium]`
- Give the 10 anonymous emoji faces real names (trivially editable in code in case a
  friendship changes); add an occasional neighbor-combo pop.

### 3.3 Warmer differentiation for Family / Friends `[small]`
- Family: distinct existing-engine sound per member (Mom→goal/perfect sparkle, Dad→pop,
  Manha→jump, Noah→win) + different burst color.

### 3.4 Phone-friendly high-five targets `[small / medium]`
- Under 420px set `.friends-grid` to `repeat(4,1fr)` (4/4/2) and give `.friend`
  `padding:12px 6px` + `min-height:60px`. Keep 5-across on tablet/desktop.

### 3.5 Shared `noah:ride` key
- One `Store` key (`noah:ride`) as the single source of truth for his chosen vehicle, read
  by Race / Bikes / and the new Garage + Launch games.

---

## Phase 4 — Trophy / Sticker Room (12th tile) `[medium / high]`

Add a **"My Trophies 🏆"** tile + screen that reads existing `Store` values and renders a
wall of big emoji stickers: earned in full color, unearned as faded silhouettes for a
"collect them all" pull.

- Map unlocks to real thresholds: `soccerBest>=5`, `raceWins>=1`, `batBest>=10`,
  `punchBest>=70` (black belt) + lower belt tiers, `copBest>=10`, `blastBest>=30`,
  `stackBest>=10`, `bikeBest>=100`, `fives>0`. **Not** `friendsRound` (defaults to 1).
- On a newly-crossed threshold (persist a per-trophy `seen` flag) fire `confettiBurst` +
  that sticker's win jingle.
- Register like other games (`enter()` re-reads `Store`); add to `ORDER`.
- *Tradeoff:* makes `localStorage` durability matter more — if `Store` falls back to
  in-memory (private mode / cleared), the wall resets. Decide on namespacing if Noah +
  Manha share the device.
- *Why:* the app already persists rich progress but only surfaces it as a tiny corner
  badge. Biggest untapped personalization win, sitting in data that already exists.

---

## Phase 5 — New games (fill genuine genre gaps)

The current 11 lean heavily on "tap fast / tap the moving thing." These three add the
**charge-and-release**, **drag/trace**, and **discrete-reveal** genres the app lacks. Each
must follow the `registerGame(id,{enter,leave})` contract — `leave()` **must** cancel rAF,
clear timers, and remove spawned DOM (the "one loop at a time" invariant).

### 5.1 Noah's Garage 🎨 `[medium]` — calm drag/clean sandbox
A no-timer sandbox: his golden Lamborghini starts covered in mud; he **scrubs it clean
with his finger**, then taps color chips to repaint and stickers to decorate. A picker
switches Lambo / Cybertruck / dirt bike / police car, and whatever he customizes becomes
his ride across the site (`noah:ride`).
- *Impl:* section `id="garage"` `card-blue`. Big car (emoji from `noah:ride`) under
  `mud-splat` spans. `pointermove` fades each mud span (`Sound.pop`); all-clean →
  `Sound.goal` + horn beep + `confettiBurst(90)`. `#garagePick` switches vehicle + writes
  `Store`. A "Make it muddy again" big-button re-adds mud. No timer, no lose state.

### 5.2 Lambo Launch 🏎️ `[medium]` — charge-and-release
Hold the big GO pad to rev his golden Lambo/Cybertruck, **release to rocket** it down a
strip over a canyon of junk cars. Green zone = nitro boost. No crash, no rival, no losing.
- *Impl:* section `id="launch"` `card-gold`. Reuse `.power-bar`/`#powerFill`
  (`styles.css:846`) + a green-zone band. `pointerdown` → rAF oscillating the fill + a held
  rev tone; `pointerup` → animate the car (flip + `Sound.boom` + `shakeEl`); green zone →
  `confettiBurst(120)`. Vehicle pick-row mirrors `ridePick` (`script.js:1198–1204`); reads
  `noah:ride`. Add `ORDER` + `t-gold` tile + `TILE_BEST` `launchBest`. A weak release still
  drives far — mostly-winning is automatic.

### 5.3 Diamond Dig ⛏️ `[medium]` — discrete reveal (real Minecraft fantasy)
A grid of Minecraft blocks. **Tap to crack then crumble** a block, revealing a gem, gold, a
diamond jackpot, a friendly creeper that clears neighbors, or a hidden golden Lambo. Clear
the grid → motherlode, then a deeper layer slides in.
- *Impl:* section `id="dig"` `card-cube`, a CSS-grid (`#digGrid`) of `dig-block` buttons
  reusing the Minecraft color arrays + inset box-shadow (`styles.css:901–906`). `enter()`
  builds N buttons with a weighted payload + `tapsLeft` 1–3; click decrements (`Sound.tick`
  + `cracked` class); reveal pops a float + counts a diamond; creeper reveals 4 neighbors
  (`Sound.boom`); diamond → `confettiBurst(80)`. All-revealed rebuilds. Reuse `splat`
  (`styles.css:1160`). `Store` `digDiamonds` + `TILE_BEST`. No fail state; every tap reveals
  something good or funny.

---

## Phase 6 — Infra hardening (parallelizable)

### 6.1 Reduced-motion + per-frame perf hardening `[medium]`
- Add a shared `REDUCE` flag (`matchMedia('(prefers-reduced-motion: reduce)')` + change
  listener): clamp `confettiBurst` to ~8–12 (still play `Sound.win`/`Haptics.win`), make
  `shakeEl` a no-op, and extend the CSS `@media` block (1297–1313) to cover
  `.shake`/`.float-pop`/`.blast-target.splat`/`.flee`/`.soccer-flash.show`/keeper dives.
- Move per-frame motion off layout props onto `transform` where safe (clouds, rocks,
  Minecraft mover via `translateX`) — but wrap coins/stars/bike (which run infinite
  transform spins) in an **outer positioned div** so the spin isn't clobbered. *Profile on
  the real tablet first.*

### 6.2 Self-host the comic font + minimal PWA `[medium]`
- Harden every `'Luckiest Guy', cursive` fallback to a rounded/playful stack **and/or**
  self-host `Luckiest-Guy.woff2` (~30KB) + Baloo 2 weights via `@font-face`
  `font-display:swap`, deleting the 3 Google links (`index.html:14–16`).
- Add a hand-written `manifest.json` (reuse the ⚡ emoji-SVG icon, `#ffcf33` theme) and a
  `service-worker.js` precaching the 4 files cache-first, registered guarded so `file://`
  double-click no-ops.
- *Tradeoff:* self-hosting commits a binary `.woff2` (still build-free, double-clickable,
  but mildly against the "just text files" spirit — flag it). SW only runs over http(s)
  (Netlify), so the font fix and SW are independent — ship the fallback regardless.
  **Validate by toggling airplane mode on the actual tablet.**

### 6.3 Confetti DPR cap (within 2.8) and small cleanups
- Confetti canvas allocates at full CSS-pixel resolution with no DPR cap (see 2.8 cap).
- Router/ORDER, mascot decouple, Minecraft-rotation fixes — see Bugs below.

---

## Phase 7 — Optional: procedural background ambience `[large]`

A self-contained `Music` module (own state, **not** folded into `Sound.on`) playing
per-section mood (soccer crowd pad, bikes chill arpeggio, family warm chords, batman low
drone) via the `AudioContext` from `Sound.ensure()`, started/stopped in each
`enter()`/`leave()`. Exposed via a second button or long-press on 🔊, persisted, only
(re)started after the `welcome()` gesture, fully stopped/disconnected on leave.
- *Off by default.* Most effort, easiest to get wrong (leaking oscillators across screens,
  iOS unlock timing). Do last, only if there's appetite.

---

## Confirmed bugs & correctness (code-verified)

1. **Minecraft block bounces off stale cached width after tablet rotation.** `areaW/areaH`
   are cached only in `reset()` (`script.js:948`); `frame()` (919–926) keeps the old range
   if the tablet rotates mid-game, so the block sweeps off-screen and can't be timed.
   *Fix:* recompute `areaW/areaH` live each tick and re-clamp `mb.x` before drawing.
2. **Soccer difficulty creeps across replays.** `enter()` (`script.js:344`) never resets
   `score`/`streak`, so `keeperInterval()=max(900,1400-score*10)` (289) speeds the keeper
   toward the 900ms floor every revisit. *Fix:* reset `score=0`/`streak=0` in `enter()` for
   parity with batman/police. (The "double-stack teleport" framing is **not** reachable —
   the router always leaves before entering — so this is difficulty-drift, not a crash.)
3. **Sound clipping under rapid tapping.** `tone()` connects each gain straight to
   `ctx.destination` (`script.js:48`) with no master/limiter; mashing punch/blaster sums
   gains past 1.0 and crackles. *Fix:* shared master `GainNode(~0.5–0.7)` + optional
   `DynamicsCompressor` in `ensure()` (see 2.5). Do **not** add a naive global throttle (it
   would swallow the intentional layered notes in win/goal/jump/laser/boom).
4. **`mascot.js` monkey-patches `window.confettiBurst`** (20–26) — works only because
   `confettiBurst` is a top-level function decl resolving as a window property; becomes a
   no-op the moment `script.js` is scoped/IIFE'd, and is load-order-sensitive. *Fix:*
   `document.dispatchEvent(new CustomEvent('noah:confetti'))` in `confettiBurst()` +
   `addEventListener` in `mascot.js`.
5. **Router URL/state desync on a bad deep-link (cosmetic).** `show()` coerces an unknown id
   to `home` (175) before the `id===current` check (176), leaving a stale `#bogus` hash.
   Harmless + self-heals, but *fix:* clear the hash on coercion, and derive `ORDER` from the
   DOM (`[...document.querySelectorAll('section.game')].map(s=>s.id)`) so nav order can't
   drift from the HTML.
6. **No-Study dodge relies on `mouseenter`** (`script.js:1331`) — dead on touch, so the book
   only moves on tap on Noah's tablet. *Fix:* add a `pointermove`/`touchmove` dodge, gated
   the same way (skip when `taps%6===5`).

---

## Recommended sequence

1. **Phase 1** — Fairness & non-reader access (highest constraint risk).
2. **Phase 2** — Cheap, high-leverage juice (best delight-per-effort).
3. **Phase 3** — Personalization (establish the `noah:ride` key here).
4. **Phase 4** — Trophy Room (motivates Phase 3 unlocks; make persistence a conscious decision).
5. **Phase 5** — New games (genre gaps; honor the `leave()`-cleanup invariant).
6. **Phase 6** — Infra hardening (parallelizable; profile perf on the real tablet first).
7. **Phase 7** — Optional ambience, off by default, only if there's appetite.

---

## Risks & validation gaps (read before building)

- **Watch Noah play on the real tablet** — the single most important validation, and it's
  unavailable from code. Every tuning number (Block Stack snap window, Bike Run shield/lives,
  Tap Race rival speed, robber size/cadence) is an educated guess; "forgiving enough" for a
  specific 5yo is empirical.
- **Device-blind analysis** — which tablet/browser/GPU is unknown. Several perf items
  (confetti cap, transform-vs-layout, `background-attachment:fixed`) may be theoretical on
  his hardware (iOS Safari already clamps some). **Profile before the transform refactor.**
- **Persistence durability is under-covered** — `Store` falls back to in-memory if
  `localStorage` is unavailable/cleared, so best-scores, the dirt-bike unlock, and the Trophy
  wall can silently vanish. Trophy Room/unlocks make this matter more. Consider Noah + Manha
  sharing the device under one namespace.
- **New-feature wiring risk** — the shared `wirePicker` must not break; `noah:ride` needs one
  source of truth + sensible defaults; every new `registerGame` **must** supply a `leave()`
  that cancels rAF + clears timers + removes DOM.
- **Taste calls need a human** — whether 👻/🧟 in Blaster are "mildly spooky" for Noah; friend
  names must be trivially editable; locking the currently-free dirt bike may frustrate more
  than motivate.
- **Heavy on adding, light on subtraction** — 11 games + 3 proposed risks menu-bloat for a
  5yo. Nobody knows which tiles he actually plays. Watch real usage before adding more;
  consider merging the overlapping Punch/Police pair or cutting a rarely-opened game.
- **Offline behavior asserted, not verified** — confirm by literally toggling airplane mode
  before committing binary fonts + a service worker.
- **First-launch flow unobserved** — validate audio reliably unlocks on Noah's first touch,
  and that an empty-space first tap firing a full 120-confetti celebration doesn't read as
  confusing on a cold start.
</content>

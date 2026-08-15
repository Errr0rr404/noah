/* ============================================================
   Noah's Super World — single-screen app, mini-games & sounds
   ============================================================ */

/* ---------- Tiny persistence helper (best scores & sound) ----------
   Wrapped in try/catch so it never breaks if storage is unavailable
   (e.g. private browsing). Falls back to in-memory defaults. */
const Store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('noah:' + key);
      return v === null ? fallback : v;
    } catch (_) { return fallback; }
  },
  getNum(key, fallback = 0) {
    const raw = this.get(key, null);
    if (raw === null) return fallback;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : fallback;
  },
  set(key, val) {
    try { localStorage.setItem('noah:' + key, val); } catch (_) {}
  },
};

/* ---------- Little helpers ---------- */
const $ = (id) => document.getElementById(id);
const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ---------- Sound engine (Web Audio, no files needed) ---------- */
const Sound = (() => {
  let ctx = null;
  let on = true;
  let master = null;
  const ensure = () => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Shared master bus: gentle gain + soft limiter so overlapping/spam
      // taps stay loud-but-clean instead of clipping on tablet speakers.
      master = ctx.createGain();
      master.gain.value = 0.7;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 6;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.12;
      master.connect(limiter).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const tone = (freq, dur = 0.15, type = 'sine', vol = 0.2) => {
    if (!on) return;
    const c = ensure();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t = c.currentTime;
    // Tiny attack ramp removes the start "click"; exponential decay to silence.
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(t + dur);
  };
  const arpeggio = (notes, step = 120, dur = 0.18, type = 'sine', vol = 0.2) => {
    notes.forEach((f, i) => setTimeout(() => tone(f, dur, type, vol), i * step));
  };
  return {
    setOn(v) { on = v; },
    isOn() { return on; },
    unlock() { try { ensure(); } catch (_) {} },
    blip: () => tone(660, 0.1, 'square', 0.15),
    goal: () => { tone(523, 0.12); setTimeout(() => tone(659, 0.12), 110); setTimeout(() => tone(784, 0.22), 220); },
    // Soft rising "boing" for near-misses (never a harsh fail buzzer)
    miss: () => { tone(280, 0.1, 'sine', 0.14); setTimeout(() => tone(420, 0.16, 'triangle', 0.14), 90); },
    punch: () => tone(120, 0.12, 'square', 0.25),
    win: () => arpeggio([523, 587, 659, 784, 1047]),
    winGoal: () => arpeggio([523, 659, 784, 1047], 100, 0.16),
    winPower: () => arpeggio([200, 300, 450, 600, 900], 90, 0.12, 'square', 0.18),
    winHero: () => arpeggio([392, 523, 659, 784, 1047, 784], 110, 0.14),
    siren: () => { tone(700, 0.2, 'sine', 0.2); setTimeout(() => tone(500, 0.2, 'sine', 0.2), 200); },
    pop: () => tone(880, 0.08, 'triangle', 0.2),
    whoosh: () => tone(300, 0.25, 'sine', 0.15),
    sad: () => { tone(400, 0.18); setTimeout(() => tone(300, 0.28), 160); },
    jump: () => { tone(420, 0.1, 'square', 0.18); setTimeout(() => tone(680, 0.1, 'square', 0.16), 90); },
    crash: () => { tone(140, 0.35, 'sawtooth', 0.18); setTimeout(() => tone(90, 0.3, 'square', 0.16), 80); },
    tick: () => tone(800, 0.05, 'square', 0.12),
    tickUrgent: (left = 3) => tone(850 + (3 - clamp(left, 1, 3)) * 150, 0.07, 'square', 0.14),
    perfect: () => { tone(880, 0.1); setTimeout(() => tone(1320, 0.16), 100); },
    laser: () => { tone(1150, 0.05, 'square', 0.16); setTimeout(() => tone(430, 0.12, 'sawtooth', 0.16), 45); },
    boom: () => { tone(180, 0.18, 'square', 0.22); setTimeout(() => tone(90, 0.24, 'sawtooth', 0.2), 60); },
    // Escalating combo pitch — higher as the streak climbs
    combo: (n = 1) => tone(523 * Math.pow(1.0595, Math.min(n, 24)), 0.1, 'triangle', 0.18),
    coin: () => { tone(988, 0.06, 'square', 0.14); setTimeout(() => tone(1319, 0.12, 'square', 0.12), 70); },
    sparkle: () => { tone(1200, 0.08, 'sine', 0.12); setTimeout(() => tone(1600, 0.1, 'triangle', 0.1), 80); },
  };
})();

/* ---------- Haptics (tiny vibration buzz where supported; silent no-op on iOS) ---------- */
const Haptics = (() => {
  const can = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  const buzz = (p) => { if (!can) return; try { navigator.vibrate(p); } catch (_) {} };
  return {
    tap: () => buzz(10),
    hit: () => buzz(22),
    win: () => buzz([16, 40, 16, 40, 50]),
  };
})();

/* ---------- Floating "+1" / emoji pop ---------- */
function floatPop(x, y, text, color = '#fff') {
  const el = document.createElement('div');
  el.className = 'float-pop';
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.color = color;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
function popFromEvent(e, text, color) {
  const p = (e && e.touches && e.touches[0]) ? e.touches[0] : e;
  const x = (p && p.clientX) || window.innerWidth / 2;
  const y = (p && p.clientY) || window.innerHeight / 2;
  Haptics.tap();
  floatPop(x - 10, y - 30, text, color);
}

/* ---------- Reduced motion (shared flag for confetti/shake/bursts) ---------- */
let REDUCE = false;
try {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  REDUCE = !!mq.matches;
  const onChange = (e) => { REDUCE = !!e.matches; };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
} catch (_) {}

/* ---------- Screen shake — a quick "impact" wobble on a stage ---------- */
function shakeEl(el) {
  if (REDUCE || !el) return;
  clearTimeout(el._shakeT);
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  el._shakeT = setTimeout(() => el.classList.remove('shake'), 420);
}

/* ---------- Comic "KA-POW!" burst at impact points ---------- */
function spawnBurst(x, y, word = 'KA-POW!', color = '#ffd23f') {
  if (REDUCE) return;
  const el = document.createElement('div');
  el.className = 'comic-burst';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.setProperty('--burst-color', color);
  el.innerHTML = `<span class="comic-burst-star" aria-hidden="true"></span><span class="comic-burst-word">${word}</span>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 720);
}
function burstFromEvent(e, word, color) {
  const p = (e && e.touches && e.touches[0]) ? e.touches[0] : e;
  const x = (p && p.clientX) || window.innerWidth / 2;
  const y = (p && p.clientY) || window.innerHeight / 2;
  spawnBurst(x, y, word, color);
}

/* ============================================================
   CONFETTI
   ============================================================ */
const canvas = $('confettiCanvas');
const cctx = canvas.getContext('2d');
let confetti = [];
const CONFETTI_CAP = 280;
const CONFETTI_EMOJIS = ['⭐', '⚡', '💥', '⚽', '🦇', '🏆', '🧊'];
function sizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeCanvas();
window.addEventListener('resize', sizeCanvas);

function confettiBurst(count = 90, ox, oy) {
  if (ox == null) ox = innerWidth / 2;
  if (oy == null) oy = innerHeight / 2;
  if (REDUCE) count = Math.min(count, 12);
  const room = CONFETTI_CAP - confetti.length;
  if (room <= 0) return;
  count = Math.min(count, room);
  Haptics.win();
  const colors = ['#ffd23f', '#ff5e5b', '#4d8bff', '#2ecc71', '#9b5de5', '#ff6fb5', '#ff9f1c'];
  for (let i = 0; i < count; i++) {
    const roll = Math.random();
    const shape = roll < 0.14 ? 'emoji' : roll < 0.45 ? 'circle' : roll < 0.75 ? 'rect' : 'streamer';
    confetti.push({
      x: ox + (Math.random() - 0.5) * 200,
      y: oy,
      vx: (Math.random() - 0.5) * 12,
      vy: Math.random() * -14 - 4,
      size: 6 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 20,
      life: 100 + Math.random() * 40,
      shape,
      emoji: CONFETTI_EMOJIS[Math.floor(Math.random() * CONFETTI_EMOJIS.length)],
    });
  }
  if (!rafRunning) loop();
  window.dispatchEvent(new Event('noah:confetti'));
}
/** Confetti from a tap/click event (falls back to screen center). */
function confettiAt(e, count = 90) {
  const p = (e && e.touches && e.touches[0]) ? e.touches[0] : e;
  const x = (p && p.clientX != null) ? p.clientX : innerWidth / 2;
  const y = (p && p.clientY != null) ? p.clientY : innerHeight / 2;
  confettiBurst(count, x, y);
}
let rafRunning = false;
function loop() {
  rafRunning = true;
  cctx.clearRect(0, 0, innerWidth, innerHeight);
  confetti.forEach(p => {
    p.vy += 0.4; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
    cctx.save();
    cctx.translate(p.x, p.y);
    cctx.rotate(p.rot * Math.PI / 180);
    if (p.shape === 'emoji') {
      cctx.font = `${Math.round(p.size * 2.2)}px serif`;
      cctx.textAlign = 'center';
      cctx.textBaseline = 'middle';
      cctx.fillText(p.emoji, 0, 0);
    } else if (p.shape === 'circle') {
      cctx.fillStyle = p.color;
      cctx.beginPath();
      cctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
      cctx.fill();
    } else if (p.shape === 'streamer') {
      cctx.fillStyle = p.color;
      cctx.fillRect(-p.size * 0.15, -p.size, p.size * 0.3, p.size * 1.6);
    } else {
      cctx.fillStyle = p.color;
      cctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    }
    cctx.restore();
  });
  confetti = confetti.filter(p => p.life > 0 && p.y < innerHeight + 50);
  if (confetti.length) requestAnimationFrame(loop);
  else { cctx.clearRect(0, 0, innerWidth, innerHeight); rafRunning = false; }
}

/* ============================================================
   SCREEN ROUTER  (one game at a time + swipe + arrows)
   ============================================================ */
// Derive game order from the DOM so nav never drifts from the HTML tile grid.
const ORDER = [...document.querySelectorAll('section.game')].map(s => s.id);
const Games = {};                       // id -> { enter, leave }
const registerGame = (id, hooks) => { Games[id] = hooks; };

// Emoji labels for prev/next arrows (matches home tiles)
const GAME_EMOJI = {
  soccer: '⚽', cars: '🏎️', batman: '🦇', kickboxing: '🥊', police: '🚓',
  blaster: '🔫', minecraft: '⛏️', world: '🧊', bikes: '🏍️', family: '❤️', friends: '🙌',
  nostudy: '📚', trophies: '🏆',
};

const homeBtn = $('homeBtn');
const navPrev = $('navPrev');
const navNext = $('navNext');
let current = 'home';

function setChrome(isGame) {
  homeBtn.hidden = !isGame;
  navPrev.hidden = !isGame;
  navNext.hidden = !isGame;
  if (isGame) {
    const i = ORDER.indexOf(current);
    if (i >= 0) {
      const prevId = ORDER[(i - 1 + ORDER.length) % ORDER.length];
      const nextId = ORDER[(i + 1) % ORDER.length];
      navPrev.textContent = GAME_EMOJI[prevId] || '‹';
      navNext.textContent = GAME_EMOJI[nextId] || '›';
      navPrev.setAttribute('aria-label', 'Previous game');
      navNext.setAttribute('aria-label', 'Next game');
    }
  }
}

function show(id) {
  if (id !== 'home' && !$(id)) {
    id = 'home';
    // Drop the bogus hash so the URL matches the screen (avoids a stuck '#typo').
    if (location.hash) { try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { location.hash = ''; } }
  }
  if (id === current) return;

  const prev = Games[current];
  if (prev && prev.leave) prev.leave();
  const prevEl = $(current);
  if (prevEl) prevEl.classList.remove('active');

  current = id;
  const el = $(id);
  el.classList.add('active');
  setChrome(id !== 'home');
  window.scrollTo(0, 0);
  if (id === 'home') refreshTileBadges();

  const g = Games[id];
  if (g && g.enter) g.enter();
}

function go(id) { if (id === current) return; location.hash = id === 'home' ? '' : id; }
function fromHash() { return (location.hash || '').replace('#', '') || 'home'; }

function step(dir) {
  if (current === 'home') return;
  const i = ORDER.indexOf(current);
  if (i < 0) return;
  const next = ORDER[(i + dir + ORDER.length) % ORDER.length];
  go(next);
}

window.addEventListener('hashchange', () => show(fromHash()));
homeBtn.addEventListener('click', () => { Sound.pop(); go('home'); });
navPrev.addEventListener('click', () => { Sound.pop(); step(-1); });
navNext.addEventListener('click', () => { Sound.pop(); step(1); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') go('home');
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'ArrowRight') step(1);
});

/* Home tiles */
document.querySelectorAll('.tile').forEach((tile, i) => {
  tile.style.setProperty('--i', i);
  tile.addEventListener('click', () => { Sound.pop(); go(tile.dataset.go); });
});

/* Best-score badges on the home tiles — progress at a glance */
const TILE_BEST = {
  soccer: ['soccerBest', '🏆'], cars: ['raceWins', '🏆'], batman: ['batBest', '🏆'],
  kickboxing: ['punchBest', '🏆'], police: ['copBest', '🏆'], blaster: ['blastBest', '🏆'],
  minecraft: ['stackBest', '🏆'], world: ['worldBest', '🪙'], bikes: ['bikeBest', '🏆'],
  friends: ['friendsDone', '🔁'], trophies: ['trophiesEarned', '🏆'],
};
function refreshTileBadges() {
  document.querySelectorAll('.tile').forEach(tile => {
    const cfg = TILE_BEST[tile.dataset.go];
    let badge = tile.querySelector('.t-best');
    const n = cfg ? Store.getNum(cfg[0]) : 0;
    if (!cfg || n <= 0) { if (badge) badge.remove(); return; }
    if (!badge) { badge = document.createElement('span'); badge.className = 't-best'; tile.appendChild(badge); }
    badge.textContent = cfg[1] + ' ' + n;
  });
}
refreshTileBadges();

/* Swipe between games (horizontal, with a comfortable threshold) */
(() => {
  let sx = 0, sy = 0, tracking = false;
  window.addEventListener('touchstart', (e) => {
    if (current === 'home' || e.touches.length !== 1) { tracking = false; return; }
    if (e.target && e.target.closest && e.target.closest('[data-no-swipe]')) { tracking = false; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
  }, { passive: true });
  window.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      step(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
})();

/* ---------- Sound toggle (remembers your choice) ---------- */
const soundToggle = $('soundToggle');
Sound.setOn(Store.get('sound', '1') === '1');
function syncSoundToggle() {
  soundToggle.textContent = Sound.isOn() ? '🔊' : '🔇';
  soundToggle.setAttribute('aria-pressed', Sound.isOn() ? 'true' : 'false');
}
syncSoundToggle();
soundToggle.addEventListener('click', () => {
  Sound.setOn(!Sound.isOn());
  syncSoundToggle();
  Store.set('sound', Sound.isOn() ? '1' : '0');
  if (Sound.isOn()) Sound.blip();
});

/* Party button (home) */
$('partyBtn').addEventListener('click', () => { confettiBurst(160); Sound.win(); });

/* ============================================================
   SOCCER — aim & shoot past a hopping keeper
   ============================================================ */
(() => {
  const ball = $('ball');
  const keeper = $('keeper');
  const flash = $('soccerFlash');
  const field = ball.closest('.soccer-field');
  const scoreEl = $('soccerScore'), streakEl = $('soccerStreak'), bestEl = $('soccerBest');
  const zonePct = ['16.66%', '50%', '83.33%'];
  const cheers = ['GOAL! ⚽', 'TOP BINS! 🎯', 'GOLAZO! 🌟', 'SUPER GOAL! 💥', 'WHAT A SHOT! 🚀', 'BANGER! 🔥'];
  let score = 0, streak = 0, best = Store.getNum('soccerBest');
  let keeperZone = 1, busy = false, timer = null, flyTimer = null, landTimer = null;

  bestEl.textContent = best;
  const shootBtns = document.querySelectorAll('.shoot-btn');
  placeKeeper(1);

  function placeKeeper(z) {
    keeperZone = z; keeper.style.left = zonePct[z];
    shootBtns.forEach(b => b.classList.toggle('open', parseInt(b.dataset.shoot, 10) !== z));
  }
  function keeperInterval() { return Math.max(900, 1400 - score * 10); }
  function keeperTick() {
    let z; do { z = randInt(0, 2); } while (z === keeperZone);
    placeKeeper(z);
    timer = setTimeout(keeperTick, keeperInterval());
  }
  function showFlash(txt) { flash.textContent = txt; flash.classList.remove('show'); void flash.offsetWidth; flash.classList.add('show'); }

  function shoot(zone) {
    if (busy) return;
    busy = true;
    const aimedAt = keeperZone;          // where the keeper is at kick time = fair
    ball.style.left = zonePct[zone];
    ball.style.bottom = '120px';
    ball.classList.add('fly');
    const scored = zone !== aimedAt;

    flyTimer = setTimeout(() => {
      if (scored) {
        score++; streak++;
        scoreEl.textContent = score;
        streakEl.textContent = streak;
        Sound.goal();
        // Keeper dives the WRONG way — pure comedy for the kid
        const dive = (zone === 0) ? 'dive-r' : 'dive-l';
        keeper.classList.add(dive);
        setTimeout(() => keeper.classList.remove(dive), 450);
        // On a streak the ball catches fire 🔥
        ball.classList.toggle('fire', streak >= 3);
        showFlash(streak >= 3 ? `🔥 ${streak} IN A ROW! 🔥` : cheers[randInt(0, cheers.length - 1)]);
        shakeEl(field);
        Sound.combo(streak);
        if (streak > best) { best = streak; bestEl.textContent = best; Store.set('soccerBest', best); }
        if (streak % 3 === 0) { confettiBurst(70); Sound.winGoal(); }
      } else {
        streak = 0; streakEl.textContent = 0;
        ball.classList.remove('fire');
        keeper.classList.add('save');
        Sound.sad();
        showFlash('SAVED! 🧤');
        setTimeout(() => keeper.classList.remove('save'), 400);
      }
    }, 430);

    landTimer = setTimeout(() => {
      ball.classList.remove('fly');
      ball.style.left = '50%';
      ball.style.bottom = '12px';
      busy = false;
    }, 950);
  }

  shootBtns.forEach(b =>
    b.addEventListener('click', () => shoot(parseInt(b.dataset.shoot, 10))));

  registerGame('soccer', {
    enter() {
      score = 0; streak = 0; busy = false;
      scoreEl.textContent = 0; streakEl.textContent = 0;
      ball.classList.remove('fire', 'fly');
      ball.style.left = '50%'; ball.style.bottom = '12px';
      placeKeeper(1);
      keeperTick();
    },
    leave() {
      clearTimeout(timer);
      clearTimeout(flyTimer);
      clearTimeout(landTimer);
      busy = false;
    },
  });
})();

/* ============================================================
   CAR RACE — tap fast to beat the rival
   ============================================================ */
(() => {
  const player = $('playerCar'), rival = $('rivalCar');
  const raceEl = player.closest('.race');
  const btn = $('raceBtn'), msg = $('raceMsg'), winsEl = $('raceWins');
  let wins = Store.getNum('raceWins');
  let state = 'idle';          // idle | countdown | racing | done
  let pPos = 0, rPos = 0, rivalTimer = null, countTimer = null, lastTap = 0;
  const STEP = 8.5;            // how far each tap pushes the player (~12 taps to win)

  // Little dust puff kicked up behind the player's car on every tap
  function puff() {
    const lane = player.parentElement;
    const el = document.createElement('span');
    el.className = 'dust';
    el.textContent = '💨';
    el.style.left = player.style.left;
    lane.appendChild(el);
    setTimeout(() => el.remove(), 450);
  }

  winsEl.textContent = wins;

  function place() {
    player.style.left = `calc(6px + ${pPos}% * 0.86)`;
    rival.style.left = `calc(6px + ${rPos}% * 0.86)`;
  }
  function reset() {
    pPos = 0; rPos = 0;
    player.style.transition = rival.style.transition = 'left 0s';
    place();
    requestAnimationFrame(() => { player.style.transition = rival.style.transition = 'left .12s linear'; });
  }
  function stopTimers() { clearInterval(rivalTimer); clearTimeout(countTimer); clearInterval(countTimer); rivalTimer = countTimer = null; }

  function startRace() {
    if (state === 'racing' || state === 'countdown') return;
    reset();
    state = 'countdown';
    let n = 3;
    msg.textContent = '3...'; btn.textContent = '⏳';
    Sound.tick();
    countTimer = setInterval(() => {
      n--;
      if (n > 0) { msg.textContent = n + '...'; Sound.tick(); }
      else {
        clearInterval(countTimer);
        msg.textContent = 'GO GO GO! TAP! 🏎️💨';
        btn.textContent = 'TAP! TAP! 💨';
        state = 'racing';
        Sound.whoosh();
        // Rival creeps forward — slower + chokes near the line so Noah mostly wins
        rivalTimer = setInterval(() => {
          let step = rand(0.35, 0.7);
          if (rPos > 80) step *= 0.4;                 // stall near the finish
          if (pPos < rPos - 8) step *= 0.75;          // tiny catch-up nudge for player
          rPos = clamp(rPos + step, 0, 100);
          place();
          if (rPos >= 100) finish(false);
        }, 90);
      }
    }, 700);
  }

  function tap() {
    if (state === 'idle') { startRace(); return; }
    if (state !== 'racing') return;
    const now = Date.now();
    const fast = now - lastTap < 170;     // rapid taps earn a nitro boost
    lastTap = now;
    pPos = clamp(pPos + (fast ? STEP * 1.6 : STEP), 0, 100);
    place();
    puff();
    if (fast) {
      player.classList.remove('nitro'); void player.offsetWidth; player.classList.add('nitro');
      Sound.whoosh();
    } else Sound.pop();
    if (pPos >= 100) finish(true);
  }

  function finish(playerWon) {
    if (state === 'done') return;
    state = 'done';
    stopTimers();
    if (playerWon) {
      wins++; winsEl.textContent = wins; Store.set('raceWins', wins);
      msg.textContent = '🏆 YOU WIN! 🏆';
      player.classList.remove('nitro');
      Sound.win(); confettiBurst(140); shakeEl(raceEl);
    } else {
      msg.textContent = 'So close — go again! 🏁';
      Sound.pop(); confettiBurst(60);
    }
    btn.textContent = 'RACE AGAIN! 🚦';
    state = 'idle';
  }

  // First click (button or track) starts; clicks during the race accelerate.
  btn.addEventListener('click', () => { if (state === 'idle') startRace(); else tap(); });
  raceEl.addEventListener('click', () => { if (state === 'idle') startRace(); else if (state === 'racing') tap(); });
  // Each row picks one racer's car; both have a default already marked active.
  function wirePicker(rowId, racerEl) {
    document.querySelectorAll(rowId + ' .pick-btn').forEach(b =>
      b.addEventListener('click', () => {
        document.querySelectorAll(rowId + ' .pick-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        racerEl.textContent = b.dataset.car;
        Sound.pop();
      }));
  }
  wirePicker('#carPick', player);
  wirePicker('#rivalPick', rival);

  registerGame('cars', {
    enter() { state = 'idle'; reset(); msg.textContent = 'Pick your racer, hit GO, then TAP fast to win! 🏁'; btn.textContent = 'GO! 🚦'; },
    leave() { stopTimers(); state = 'idle'; },
  });
})();

/* ============================================================
   BATMAN — catch the flying bats
   ============================================================ */
(() => {
  const sky = $('batSky'), moon = $('moon'), batLogo = $('batLogo'), hero = $('batHero');
  const scoreEl = $('batScore'), bestEl = $('batBest');
  let score = 0, best = Store.getNum('batBest');
  let spawnTimer = null, active = false, sweepReady = true, cooldownTimer = null;
  const bats = new Set();
  const lifeTimers = new Set();

  bestEl.textContent = best;

  function signal() {
    batLogo.classList.add('show');
    hero.classList.add('show');
    Sound.whoosh();
  }
  function spawnBat() {
    if (!active) return;
    const villain = Math.random() < 0.18;
    const b = document.createElement('div');
    b.className = 'bat' + (villain ? ' villain' : '');
    b.textContent = villain ? '🦹' : '🦇';
    b.style.left = rand(8, Math.max(8, sky.clientWidth - 56)) + 'px';
    b.style.top = rand(46, Math.max(46, sky.clientHeight - 56)) + 'px';
    bats.add(b);
    sky.appendChild(b);
    const life = setTimeout(() => { b.remove(); bats.delete(b); lifeTimers.delete(life); }, villain ? 2200 : 2800);
    lifeTimers.add(life);
    b.addEventListener('click', (e) => {
      clearTimeout(life); lifeTimers.delete(life);
      const pts = villain ? 3 : 1;
      score += pts;
      scoreEl.textContent = score;
      b.classList.add('caught');
      bats.delete(b);
      setTimeout(() => b.remove(), 280);
      Sound.combo(score);
      popFromEvent(e, villain ? '+3 🦹' : '+1 🦇', '#ffd23f');
      if (score > best) { best = score; bestEl.textContent = best; Store.set('batBest', best); }
      if (score > 0 && score % 10 === 0) { confettiAt(e, 80); Sound.winHero(); }
    });
    const gap = Math.max(700, 1200 - score * 8);
    spawnTimer = setTimeout(spawnBat, gap);
  }
  function clearBats() { lifeTimers.forEach(clearTimeout); lifeTimers.clear(); bats.forEach(b => b.remove()); bats.clear(); }

  // BAT-SIGNAL BLAST — tap the moon to catch every bat at once (short cooldown)
  function sweep() {
    if (!active) return;
    signal();
    if (!sweepReady) { confettiBurst(20); return; }
    sweepReady = false;
    moon.classList.add('cooldown');
    let caught = 0;
    bats.forEach(b => {
      score += b.classList.contains('villain') ? 3 : 1;
      caught++;
      b.classList.add('caught');
      setTimeout(() => b.remove(), 280);
    });
    bats.clear();
    scoreEl.textContent = score;
    if (caught > 0) {
      Sound.winHero(); confettiBurst(80); shakeEl(sky);
      if (score > best) { best = score; bestEl.textContent = best; Store.set('batBest', best); }
    } else { confettiBurst(30); }
    cooldownTimer = setTimeout(() => { sweepReady = true; moon.classList.remove('cooldown'); }, 2600);
  }
  moon.addEventListener('click', sweep);

  registerGame('batman', {
    enter() {
      score = 0; scoreEl.textContent = 0;
      active = true; sweepReady = true; moon.classList.remove('cooldown');
      signal();
      spawnTimer = setTimeout(spawnBat, 600);
    },
    leave() {
      active = false;
      clearTimeout(spawnTimer);
      clearTimeout(cooldownTimer);
      clearBats();
      batLogo.classList.remove('show');
      hero.classList.remove('show');
    },
  });
})();

/* ============================================================
   KICKBOXING — 10-second power challenge
   ============================================================ */
(() => {
  const bag = $('punchBag'), startBtn = $('punchStart');
  const scoreEl = $('punchScore'), bestEl = $('punchBest'), timerEl = $('punchTimer');
  const praise = $('punchPraise'), fill = $('powerFill'), msg = $('punchMsg');
  const cheers = ['POW! 💥', 'BAM! 👊', 'WHAM! 🥊', 'BOOM! 💢', 'KAPOW! ⭐', 'Strong! 💪'];
  const belts = [[0, '🤍 White Belt'], [8, '💛 Yellow Belt'], [16, '🧡 Orange Belt'], [26, '💚 Green Belt'], [38, '💙 Blue Belt'], [52, '❤️ Red Belt'], [70, '🥋 BLACK BELT!']];
  const stage = bag.closest('.punch-stage');
  let score = 0, best = Store.getNum('punchBest'), time = 10, running = false, timer = null, beltIdx = 0;

  bestEl.textContent = best;

  function setTimer(t) { time = t; timerEl.textContent = t; }
  function startChallenge() {
    if (running) return;
    running = true;
    score = 0; scoreEl.textContent = 0; beltIdx = 0;
    fill.style.width = '0%';
    praise.textContent = '';
    setTimer(10);
    startBtn.textContent = 'PUNCH! 👊';
    msg.textContent = 'GO! Punch as fast as you can! 💥';
    timer = setInterval(() => {
      setTimer(time - 1);
      if (time <= 3 && time > 0) Sound.tickUrgent(time);
      if (time <= 0) endChallenge();
    }, 1000);
  }
  function endChallenge() {
    running = false;
    clearInterval(timer);
    setTimer(10);
    startBtn.textContent = 'PLAY AGAIN 🥊';
    if (score > best) {
      best = score; bestEl.textContent = best; Store.set('punchBest', best);
      msg.textContent = `🏆 NEW RECORD! ${score} punches! 🏆`;
      confettiBurst(140); Sound.winPower();
    } else {
      msg.textContent = `Time! You punched ${score} times! 💪`;
      confettiBurst(60); Sound.perfect();
    }
    praise.textContent = '';
  }

  bag.addEventListener('click', (e) => {
    bag.classList.remove('hit'); void bag.offsetWidth; bag.classList.add('hit');
    Sound.punch();
    if (!running) { startChallenge(); }
    score++;
    scoreEl.textContent = score;
    fill.style.width = clamp(score * 2.2, 0, 100) + '%';
    // Belt promotion as the punch count climbs
    let b = 0;
    for (let i = belts.length - 1; i >= 0; i--) { if (score >= belts[i][0]) { b = i; break; } }
    if (b > beltIdx) {
      beltIdx = b;
      msg.textContent = `NEW RANK: ${belts[b][1]}`;
      confettiAt(e, 60); Sound.perfect();
    }
    // Every 10th hit is a screen-shaking MEGA PUNCH
    if (score % 10 === 0) {
      praise.textContent = 'MEGA PUNCH! 💥🔥';
      Sound.boom(); confettiAt(e, 50); shakeEl(stage);
      burstFromEvent(e, 'KAPOW!', '#ff5e5b');
      popFromEvent(e, '💥', '#ffd23f');
    } else {
      praise.textContent = cheers[randInt(0, cheers.length - 1)];
      popFromEvent(e, '+1', '#fff');
      if (score % 5 === 0) burstFromEvent(e, 'POW!', '#ffd23f');
    }
  });
  startBtn.addEventListener('click', () => { if (!running) startChallenge(); });

  registerGame('kickboxing', {
    enter() {
      running = false; score = 0; scoreEl.textContent = 0; beltIdx = 0;
      fill.style.width = '0%'; setTimer(10);
      startBtn.textContent = 'START 🥊';
      msg.textContent = 'Tap START, then punch as FAST as you can for 10 seconds! 💥';
      praise.textContent = '';
    },
    leave() { running = false; clearInterval(timer); },
  });
})();

/* ============================================================
   POLICE — 15-second robber catch
   ============================================================ */
(() => {
  const zone = $('chaseZone'), robber = $('robber'), siren = $('siren');
  const startBtn = $('copStart'), scoreEl = $('copScore'), bestEl = $('copBest');
  const timerEl = $('copTimer'), msg = $('copMsg');
  const ROUND = 15;
  let score = 0, best = Store.getNum('copBest'), time = ROUND, running = false;
  let clock = null, fleeTimer = null, combo = 0, lastCatch = 0;

  bestEl.textContent = best;

  function moveRobber() {
    const maxX = zone.clientWidth - 64, maxY = zone.clientHeight - 64;
    robber.style.left = rand(12, Math.max(12, maxX)) + 'px';
    robber.style.top = rand(12, Math.max(12, maxY)) + 'px';
    robber.classList.remove('pop'); void robber.offsetWidth; robber.classList.add('pop');
  }
  function fleeInterval() { return Math.max(1500, 1900 - score * 15); }
  function scheduleFlee() {
    clearTimeout(fleeTimer);
    fleeTimer = setTimeout(() => { if (running) { moveRobber(); scheduleFlee(); } }, fleeInterval());
  }
  function stopTimers() { clearInterval(clock); clearTimeout(fleeTimer); clock = fleeTimer = null; }

  function start() {
    if (running) return;
    running = true;
    score = 0; scoreEl.textContent = 0; combo = 0; lastCatch = 0;
    time = ROUND; timerEl.textContent = time;
    robber.hidden = false;
    robber.classList.toggle('big', time <= 5);
    moveRobber();
    scheduleFlee();
    startBtn.textContent = 'CATCH! 🚔';
    msg.textContent = 'GO! Tap the robber! 🚨';
    clock = setInterval(() => {
      time--; timerEl.textContent = Math.max(0, time);
      robber.classList.toggle('big', time <= 5);  // easier target near the end
      if (time <= 3 && time > 0) Sound.tickUrgent(time);
      if (time <= 0) end();
    }, 1000);
  }
  function end() {
    running = false;
    stopTimers();
    robber.hidden = true;
    robber.classList.remove('big');
    timerEl.textContent = ROUND;
    startBtn.textContent = 'PLAY AGAIN 🚨';
    if (score > best) {
      best = score; bestEl.textContent = best; Store.set('copBest', best);
      msg.textContent = `🏆 NEW RECORD! Caught ${score}! 🏆`;
      confettiBurst(140); Sound.win();
    } else {
      msg.textContent = `Time! You caught ${score} robbers! 👮`;
      confettiBurst(60); Sound.siren();
    }
  }

  robber.addEventListener('click', (e) => {
    if (!running) { start(); return; }
    const now = Date.now();
    if (now - lastCatch < 1200) combo++; else combo = 1;
    lastCatch = now;
    const onCombo = combo >= 3;
    score += onCombo ? 2 : 1;          // a hot streak catches are worth double
    scoreEl.textContent = score;
    if (onCombo) { Sound.combo(combo); Sound.perfect(); } else Sound.siren();
    siren.classList.add('active');
    setTimeout(() => siren.classList.remove('active'), 600);
    popFromEvent(e, onCombo ? `COMBO x${combo}! 🔥` : 'CAUGHT! 🚔', onCombo ? '#ffd23f' : '#fff');
    if (onCombo) shakeEl(zone);
    moveRobber();
    scheduleFlee();
    if (score % 5 === 0) confettiAt(e, 70);
  });
  // First tap on the chase zone starts the round (non-reader friendly)
  zone.addEventListener('click', (e) => {
    if (running) return;
    if (e.target === robber) return;   // robber handler starts + catches
    start();
  });
  startBtn.addEventListener('click', () => { if (!running) start(); });

  registerGame('police', {
    enter() {
      running = false; score = 0; scoreEl.textContent = 0;
      time = ROUND; timerEl.textContent = ROUND;
      robber.hidden = true;
      startBtn.textContent = 'START 🚨';
      msg.textContent = 'Tap START, then catch as many robbers as you can! 🚨';
    },
    leave() { running = false; stopTimers(); robber.hidden = true; },
  });
})();

/* ============================================================
   BLASTER — tap the silly space critters to blast them
   (endless & friendly: you can't lose, just blast for a high score)
   ============================================================ */
(() => {
  const zone = $('blastZone'), blaster = $('blasterGun'), msg = $('blastMsg');
  const scoreEl = $('blastScore'), streakEl = $('blastStreak'), bestEl = $('blastBest');
  // Goofy invaders — nothing scary, just silly stuff to splat
  const critters = ['👽', '👾', '🤖', '👻', '🤡', '💩', '🦠', '🍌', '🐙', '🥦', '🧟', '🦷'];
  const blasts = ['BLAM! 💥', 'ZAP! ⚡', 'PEW PEW! 🔫', 'SPLAT! 💦', 'KABOOM! 🎆', 'BONK! 🌟', 'GOTCHA! 😜', 'BOINK! 🤪', 'SQUISH! 🫠'];
  let score = 0, streak = 0, best = Store.getNum('blastBest');
  let spawnTimer = null, active = false;
  const targets = new Set();

  bestEl.textContent = best;

  // The blaster sits bottom-centre; beams fire from its muzzle.
  function muzzle() { return { x: zone.clientWidth / 2, y: zone.clientHeight - 40 }; }

  function fireBeam(tx, ty) {
    const m = muzzle();
    const dist = Math.hypot(tx - m.x, ty - m.y);
    const ang = Math.atan2(tx - m.x, -(ty - m.y)) * 180 / Math.PI;  // 0° = straight up
    const beam = document.createElement('div');
    beam.className = 'laser-beam';
    beam.style.left = m.x + 'px';
    beam.style.bottom = (zone.clientHeight - m.y) + 'px';
    beam.style.height = dist + 'px';
    beam.style.setProperty('--ang', ang + 'deg');
    zone.appendChild(beam);
    setTimeout(() => beam.remove(), 260);
    blaster.classList.remove('recoil'); void blaster.offsetWidth; blaster.classList.add('recoil');
  }

  function targetCenter(t) {
    const zr = zone.getBoundingClientRect(), r = t.getBoundingClientRect();
    return { x: r.left - zr.left + r.width / 2, y: r.top - zr.top + r.height / 2 };
  }

  function spawnTarget() {
    if (!active) return;
    const roll = Math.random();
    const bomb = roll < 0.07;                           // rare bomb clears the screen
    const mega = !bomb && roll < 0.21;                  // golden UFO worth +5
    const t = document.createElement('div');
    t.className = 'blast-target' + (mega ? ' mega' : '') + (bomb ? ' bomb' : '');
    t.textContent = bomb ? '💣' : (mega ? '🛸' : critters[randInt(0, critters.length - 1)]);
    const size = mega ? 70 : 56;
    t.style.left = rand(8, Math.max(8, zone.clientWidth - size)) + 'px';
    t.style.top = rand(40, Math.max(40, zone.clientHeight - size - 70)) + 'px';
    targets.add(t);
    zone.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    const life = setTimeout(() => escape(t), mega || bomb ? 2400 : 2900);
    t._life = life;   // stash so clearTargets()/leave() can cancel it
    t.addEventListener('click', (e) => {
      e.stopPropagation(); clearTimeout(life);
      if (bomb) bombBlast(t, e); else blast(t, e, mega);
    });
    spawnTimer = setTimeout(spawnTarget, Math.max(420, 1050 - score * 14));
  }

  // Tap the bomb to splat EVERY critter on screen at once
  function bombBlast(bombT, e) {
    if (!targets.has(bombT)) return;
    targets.delete(bombT);
    const bc = targetCenter(bombT);
    fireBeam(bc.x, bc.y);
    bombT.classList.add('splat');
    setTimeout(() => bombT.remove(), 320);
    let gained = 1;
    targets.forEach(t => {
      gained++;
      t.classList.add('splat');
      setTimeout(() => t.remove(), 320);
    });
    targets.clear();
    const prev = score;
    score += gained; streak += gained;
    scoreEl.textContent = score; streakEl.textContent = streak;
    Sound.boom(); confettiAt(e, 100); shakeEl(zone);
    burstFromEvent(e, 'BOOM!', '#ff9f1c');
    popFromEvent(e, `💣 BOOM! +${gained}`, '#ff9f1c');
    if (Math.floor(score / 10) > Math.floor(prev / 10)) Sound.winPower();
    if (score > best) { best = score; bestEl.textContent = best; Store.set('blastBest', best); }
  }

  function blast(t, e, mega) {
    if (!targets.has(t)) return;
    targets.delete(t);
    const c = targetCenter(t);
    fireBeam(c.x, c.y);
    const pts = mega ? 5 : 1;
    score += pts; streak++;
    scoreEl.textContent = score;
    streakEl.textContent = streak;
    t.classList.add('splat');
    setTimeout(() => t.remove(), 320);
    Sound.laser();
    Sound.combo(streak);
    setTimeout(() => (mega ? Sound.boom() : Sound.pop()), 60);
    popFromEvent(e, mega ? '+5 🛸💥' : blasts[randInt(0, blasts.length - 1)], mega ? '#ffd23f' : '#5ee7df');
    if (mega) burstFromEvent(e, 'ZAP!', '#ffd23f');
    if (score > best) { best = score; bestEl.textContent = best; Store.set('blastBest', best); }
    if (mega) confettiAt(e, 60);
    if (Math.floor(score / 10) > Math.floor((score - pts) / 10)) { confettiAt(e, 90); Sound.winPower(); }
  }

  // Escaped critter — no penalty, it just zooms off blowing a raspberry
  function escape(t) {
    if (!targets.has(t)) return;
    targets.delete(t);
    streak = Math.max(0, streak - 2);   // soft nudge, not a full wipe
    streakEl.textContent = streak;
    t.classList.add('flee');
    Sound.whoosh();
    setTimeout(() => t.remove(), 320);
  }

  function clearTargets() { targets.forEach(t => { clearTimeout(t._life); t.remove(); }); targets.clear(); }

  // Tapping empty space still fires a fun "pew" — no penalty, all juice
  zone.addEventListener('click', (e) => {
    if (!active) return;
    const zr = zone.getBoundingClientRect();
    fireBeam(e.clientX - zr.left, e.clientY - zr.top);
    Sound.laser();
  });

  registerGame('blaster', {
    enter() {
      score = 0; streak = 0;
      scoreEl.textContent = 0; streakEl.textContent = 0;
      active = true;
      msg.textContent = 'Goofy space critters invaded! Tap them to BLAST them! 👽💥';
      spawnTimer = setTimeout(spawnTarget, 500);
    },
    leave() {
      active = false;
      clearTimeout(spawnTimer);
      clearTargets();
    },
  });
})();

/* ============================================================
   MINECRAFT — block stacker (drop & align)
   ============================================================ */
(() => {
  const area = $('stackArea'), stack = $('stack'), inner = $('stackInner');
  const moving = $('movingBlock'), dropBtn = $('dropBtn');
  const scoreEl = $('stackScore'), bestEl = $('stackBest'), msg = $('stackMsg');
  const BH = 26;
  const colors = [
    ['#7bc043', '#5a9e2f', '#3e7320'], // grass
    ['#b5651d', '#8a4a14', '#5e3210'], // dirt
    ['#9e9e9e', '#7a7a7a', '#5a5a5a'], // stone
    ['#f4d35e', '#e0b93f', '#b8932f'], // gold
    ['#4fc3f7', '#2a9fd6', '#1b6fa0'], // diamond
  ];
  let best = Store.getNum('stackBest');
  let areaW = 0, areaH = 0;
  let blocks = [];          // {left, width}
  let mb = null;            // {x, width, dir, color}
  let speed = 2, rafId = null, over = false, perfectStreak = 0;

  bestEl.textContent = best;

  function styleBlock(el, c) {
    el.style.background = `linear-gradient(180deg, ${c[0]}, ${c[1]})`;
    el.style.borderColor = c[2];
  }
  function renderPlaced(b, i) {
    const el = document.createElement('div');
    el.className = 'block placed';
    el.style.left = b.left + 'px';
    el.style.bottom = (i * BH) + 'px';
    el.style.width = b.width + 'px';
    el.style.height = BH + 'px';
    styleBlock(el, colors[i % colors.length]);
    inner.appendChild(el);
  }
  function updateCamera() {
    const topY = blocks.length * BH + BH;       // top edge of the moving block
    const camera = Math.max(0, topY - (areaH - 50));
    stack.style.transform = `translateY(${camera}px)`;
  }
  function spawnMoving() {
    const below = blocks[blocks.length - 1];
    const w = below.width;
    // First block spawns aligned over the base so an eager first tap can't
    // insta-lose; later blocks start from the edge for a real timing challenge.
    const startX = (blocks.length === 1) ? below.left : 0;
    mb = { x: startX, width: w, dir: 1, color: colors[blocks.length % colors.length] };
    moving.style.width = w + 'px';
    moving.style.height = BH + 'px';
    moving.style.bottom = (blocks.length * BH) + 'px';
    moving.style.left = startX + 'px';
    styleBlock(moving, mb.color);
    moving.style.display = 'block';
    updateCamera();
  }
  function syncArea() {
    const w = area.clientWidth, h = area.clientHeight;
    if (w) areaW = w;
    if (h) areaH = h;
    // Keep any in-flight block fully on the (possibly narrower) stage.
    if (mb) {
      if (mb.width > areaW) mb.width = areaW;
      if (mb.x + mb.width > areaW) mb.x = Math.max(0, areaW - mb.width);
      moving.style.width = mb.width + 'px';
      moving.style.left = mb.x + 'px';
    }
    updateCamera();
  }
  function frame() {
    if (over || !mb) return;
    mb.x += mb.dir * speed;
    if (mb.x <= 0) { mb.x = 0; mb.dir = 1; }
    else if (mb.x + mb.width >= areaW) { mb.x = areaW - mb.width; mb.dir = -1; }
    moving.style.left = mb.x + 'px';
    rafId = requestAnimationFrame(frame);
  }
  function fallaway(left, width, color) {
    const el = document.createElement('div');
    el.className = 'block falling';
    el.style.left = left + 'px';
    el.style.bottom = (blocks.length * BH) + 'px';
    el.style.width = width + 'px';
    el.style.height = BH + 'px';
    styleBlock(el, color);
    inner.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = `translateY(${areaH + 60}px) rotate(${rand(-40, 40)}deg)`;
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 650);
  }

  function reset() {
    over = false;
    perfectStreak = 0;
    inner.innerHTML = '';
    blocks = [];
    areaW = area.clientWidth; areaH = area.clientHeight;
    speed = Math.max(1.2, areaW / 230);
    const baseW = Math.min(150, areaW * 0.5);
    blocks.push({ left: (areaW - baseW) / 2, width: baseW });
    renderPlaced(blocks[0], 0);
    scoreEl.textContent = 0;
    msg.textContent = 'Tap DROP to stack the block. Keep it straight! 🟩';
    dropBtn.textContent = 'DROP 🧱';
    spawnMoving();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  }

  function drop() {
    if (over || !mb) return;
    const top = blocks[blocks.length - 1];
    const left = Math.max(top.left, mb.x);
    const right = Math.min(top.left + top.width, mb.x + mb.width);
    const overlap = right - left;

    if (overlap <= 0) {                 // missed completely — soft retry, tower stays
      fallaway(mb.x, mb.width, mb.color);
      perfectStreak = 0;
      Sound.pop();
      shakeEl(area);
      msg.textContent = 'Whoops! Try again — tap DROP! 🙈';
      spawnMoving();
      return;
    }
    // overhang slice falls away — small misses (<=12px) snap to a perfect,
    // full-width block so a young player's tower keeps its size.
    const overhang = mb.width - overlap;
    // Forgiving grace: ~14% of the block width, min 16px, so near-misses snap
    // to a full-width "perfect" across small and large tablets alike.
    const snapGrace = Math.max(16, mb.width * 0.14);
    let placedLeft = left, placedWidth = overlap;
    if (overhang > snapGrace) {
      const hangLeft = (mb.x < left) ? mb.x : right;
      fallaway(hangLeft, overhang, mb.color);
      perfectStreak = 0;
    } else {
      placedLeft = top.left; placedWidth = top.width;
      perfectStreak++;
      Sound.perfect();
      confettiBurst(perfectStreak >= 3 ? 60 : 30);
      msg.textContent = perfectStreak >= 2 ? `PERFECT! x${perfectStreak} 🌟` : 'PERFECT! 🌟';
      if (perfectStreak >= 3) shakeEl(area);
    }
    const MIN_W = 28;
    if (placedWidth < MIN_W) {           // never shrink below a tappable floor
      placedLeft = Math.max(0, Math.min(placedLeft, areaW - MIN_W));
      placedWidth = MIN_W;
    }
    blocks.push({ left: placedLeft, width: placedWidth });
    renderPlaced(blocks[blocks.length - 1], blocks.length - 1);
    const height = blocks.length - 1;
    scoreEl.textContent = height;
    // Endless mode: the tower never "falls", so the best score climbs live here
    // (it used to be persisted only in the now-removed crash/game-over path).
    if (height > best) { best = height; bestEl.textContent = best; Store.set('stackBest', best); }
    Sound.pop();
    speed = Math.min(3.0, speed + 0.06);
    if (height % 10 === 0) { confettiBurst(90); Sound.win(); }
    spawnMoving();
  }

  dropBtn.addEventListener('click', () => { if (over) reset(); else drop(); });
  area.addEventListener('click', () => { if (over) reset(); else drop(); });

  function onResize() { syncArea(); }

  registerGame('minecraft', {
    enter() { window.addEventListener('resize', onResize); reset(); },
    leave() {
      over = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    },
  });
})();

/* ============================================================
   NOAH WORLD — tiny Roblox-style 3D playground
   Walk, jump, collect coins, finish the rainbow obby.
   Mostly-winning: no death, falling just lands (or a soft respawn).
   ============================================================ */
(() => {
  const stage = $('worldStage'), canvas = $('worldCanvas');
  const stick = $('worldStick'), knob = $('worldKnob'), hint = $('worldHint');
  const jumpBtn = $('worldJump'), msg = $('worldMsg');
  const scoreEl = $('worldScore'), bestEl = $('worldBest');
  if (!stage || !canvas) return;
  const ctx = canvas.getContext('2d');

  const PW = 0.42, PD = 0.42, PH = 1.85;
  let W = 320, H = 280, FOV = 260;
  let active = false, rafId = null, lastT = 0;
  let px = 0, py = 0, pz = 0, vx = 0, vy = 0, vz = 0, yaw = 0;
  let grounded = true, walkPhase = 0, score = 0, best = Store.getNum('worldBest');
  let won = false, honked = false, hinted = false;
  let stickX = 0, stickY = 0, stickHeld = false, canvasHeld = false;
  let walkTx = null, walkTz = null;
  const keys = Object.create(null);
  const cam = { x: 0, y: 10.2, z: -16.5 };
  let basis = { fx: 0, fy: 0, fz: 1, rx: 1, ry: 0, rz: 0, ux: 0, uy: 1, uz: 0 };
  let solids = [];
  let coins = [];
  let pals = [];
  const cheers = ['NICE! 🌟', 'COIN! 🪙', 'YES! 🎉', 'WOO! ⚡', 'GOT IT! 💥'];

  if (bestEl) bestEl.textContent = best;

  function box(x, y, z, w, h, d, color, extra) {
    return Object.assign({ x, y, z, w, h, d, color, solid: true }, extra || {});
  }
  function hexRgb(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(hex, k, fog) {
    const rgb = hexRgb(hex);
    const sky = [110, 200, 150];
    const f = fog || 0;
    const r = clamp(Math.round(rgb[0] * k * (1 - f) + sky[0] * f), 0, 255);
    const g = clamp(Math.round(rgb[1] * k * (1 - f) + sky[1] * f), 0, 255);
    const b = clamp(Math.round(rgb[2] * k * (1 - f) + sky[2] * f), 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function buildWorld() {
    solids = [];
    // Baseplate + spawn + path
    solids.push(box(0, -0.35, 6, 70, 0.35, 80, '#2ebb5a', { solid: false, topOnly: true }));
    solids.push(box(0, 0, 0, 4.2, 0.1, 4.2, '#9aa3b2'));
    solids.push(box(0, 0.1, 0, 1.6, 0.06, 1.6, '#ffd23f', { solid: false }));
    solids.push(box(0, 0, 3.4, 2.2, 0.08, 3.2, '#f4d35e', { solid: false }));
    // Bounce pad — a mercy launch toward the obby
    solids.push(box(0, 0, 5.4, 2.4, 0.28, 2.4, '#5ee7df', { tag: 'bounce' }));
    // House (solid block + roof dressing)
    solids.push(box(-10.2, 0, -7.4, 5.2, 3.1, 5.2, '#fff1d6'));
    solids.push(box(-10.2, 3.1, -7.4, 5.8, 0.45, 5.8, '#ff5e5b', { solid: false }));
    solids.push(box(-10.2, 3.55, -7.4, 4.2, 0.4, 4.2, '#e74c3c', { solid: false }));
    solids.push(box(-10.2, 3.95, -7.4, 2.4, 0.35, 2.4, '#c0392b', { solid: false }));
    solids.push(box(-8.6, 3.3, -5.6, 0.55, 1.1, 0.55, '#8b5a2b', { solid: false }));
    solids.push(box(-8.4, 2.2, -4.75, 0.12, 0.7, 0.9, '#4d8bff', { solid: false }));
    solids.push(box(-11.8, 2.2, -4.75, 0.12, 0.7, 0.9, '#4d8bff', { solid: false }));
    solids.push(box(-10.2, 1.15, -4.72, 1.1, 1.15, 0.12, '#6b3a17', { solid: false }));
    solids.push(box(-9.4, 2.45, -4.68, 0.55, 0.45, 0.08, '#ffd23f', { solid: false }));
    // Golden Lambo
    solids.push(box(9.4, 0.28, -5.2, 2.9, 0.5, 1.35, '#ffd23f'));
    solids.push(box(9.7, 0.78, -5.2, 1.5, 0.38, 1.2, '#fff8dc'));
    solids.push(box(8.2, 0.12, -5.75, 0.45, 0.28, 0.28, '#20143a'));
    solids.push(box(8.2, 0.12, -4.65, 0.45, 0.28, 0.28, '#20143a'));
    solids.push(box(10.55, 0.12, -5.75, 0.45, 0.28, 0.28, '#20143a'));
    solids.push(box(10.55, 0.12, -4.65, 0.45, 0.28, 0.28, '#20143a'));
    // Trees
    [[-13, 4], [12, 3], [-6, -12], [7, -11], [13, 14]].forEach(([x, z]) => {
      solids.push(box(x, 0, z, 0.55, 1.35, 0.55, '#8b5a2b'));
      solids.push(box(x, 1.3, z, 2.15, 1.9, 2.15, '#27ae60', { solid: false }));
    });
    // Flower dots
    [[-4, 2.2, '#ff6fb5'], [4.4, 1.4, '#9b5de5'], [-3.2, -3.5, '#ff5e5b'], [5.6, -2.4, '#ffd23f']].forEach(([x, z, c]) => {
      solids.push(box(x, 0, z, 0.35, 0.45, 0.35, c, { solid: false }));
    });
    // Rainbow obby — almost a straight line so running forward + jump wins
    solids.push(box(0, 0.15, 8.2, 4.2, 0.42, 3.8, '#2ecc71'));
    solids.push(box(0.4, 1.2, 11.6, 4.0, 0.42, 3.6, '#ffd23f'));
    solids.push(box(-0.3, 2.25, 15.0, 4.0, 0.42, 3.6, '#ff9f1c'));
    solids.push(box(0.3, 3.3, 18.4, 4.0, 0.42, 3.6, '#ff5e5b'));
    solids.push(box(0, 4.4, 22.0, 4.8, 0.5, 4.4, '#9b5de5', { tag: 'finish' }));
    // Little showcase towers
    solids.push(box(-6.5, 0, 8, 1.1, 1.1, 1.1, '#4d8bff'));
    solids.push(box(-6.5, 1.1, 8, 0.85, 0.85, 0.85, '#ff6fb5'));
    solids.push(box(-6.5, 1.95, 8, 0.6, 0.6, 0.6, '#ffd23f'));

    coins = [
      { x: 1.6, y: 0.7, z: 1.8 }, { x: -1.8, y: 0.7, z: 2.2 },
      { x: 0, y: 1.1, z: 5.4 }, { x: -8.4, y: 0.8, z: -3.6 },
      { x: 9.4, y: 1.6, z: -5.2 }, { x: 0, y: 1.2, z: 8.2 },
      { x: 0.4, y: 2.25, z: 11.6 }, { x: -0.3, y: 3.3, z: 15.0 },
      { x: 0.3, y: 4.35, z: 18.4 }, { x: -1.1, y: 5.55, z: 21.4 },
      { x: 1.1, y: 5.55, z: 22.4 }, { x: 0, y: 5.85, z: 22.0 },
    ].map((c) => Object.assign({ got: false, spin: rand(0, Math.PI * 2) }, c));

    pals = [
      { x: -5.4, z: 2.6, name: 'Leo', face: '👦', hit: false, pal: { head: '#ffcd9e', torso: '#2ecc71', arms: '#ffcd9e', legs: '#1e8449' } },
      { x: 5.2, z: 1.8, name: 'Mia', face: '👧', hit: false, pal: { head: '#ffcd9e', torso: '#ff6fb5', arms: '#ffcd9e', legs: '#9b5de5' } },
      { x: -7.2, z: -3.4, name: 'Sam', face: '🧒', hit: false, pal: { head: '#ffcd9e', torso: '#ff9f1c', arms: '#ffcd9e', legs: '#e67e22' } },
    ];
  }

  function sizeWorld() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, stage.clientWidth);
    H = Math.max(1, stage.clientHeight);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    FOV = H * 0.92;
  }

  function updateBasis() {
    let fx = px - cam.x, fy = (py + 1.35) - cam.y, fz = pz - cam.z;
    const fl = Math.hypot(fx, fy, fz) || 1;
    fx /= fl; fy /= fl; fz /= fl;
    let rx = -fz, ry = 0, rz = fx;
    const rl = Math.hypot(rx, rz) || 1;
    rx /= rl; rz /= rl;
    const ux = ry * fz - rz * fy;
    const uy = rz * fx - rx * fz;
    const uz = rx * fy - ry * fx;
    basis = { fx, fy, fz, rx, ry, rz, ux, uy, uz };
  }
  function project(x, y, z) {
    const b = basis;
    const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    const cz = dx * b.fx + dy * b.fy + dz * b.fz;
    if (cz < 0.45) return null;
    const cx = dx * b.rx + dy * b.ry + dz * b.rz;
    const cy = dx * b.ux + dy * b.uy + dz * b.uz;
    return { x: W / 2 + cx * FOV / cz, y: H / 2 - cy * FOV / cz, z: cz, s: FOV / cz };
  }
  function screenToGround(sx, sy) {
    const b = basis;
    const cdx = (sx - W / 2) / FOV;
    const cdy = -(sy - H / 2) / FOV;
    const dx = b.rx * cdx + b.ux * cdy + b.fx;
    const dy = b.ry * cdx + b.uy * cdy + b.fy;
    const dz = b.rz * cdx + b.uz * cdy + b.fz;
    if (Math.abs(dy) < 1e-4) return null;
    const t = -cam.y / dy;
    if (t < 0.4) return null;
    return { x: cam.x + dx * t, z: cam.z + dz * t };
  }

  const FACE = [
    { i: [4, 5, 6, 7], k: 1.16 },
    { i: [0, 1, 5, 4], k: 0.90 },
    { i: [3, 2, 6, 7], k: 1.02 },
    { i: [0, 3, 7, 4], k: 0.76 },
    { i: [1, 2, 6, 5], k: 0.88 },
  ];
  function vertsOf(b) {
    const hw = b.w / 2, hd = b.d / 2;
    return [
      [b.x - hw, b.y, b.z - hd], [b.x + hw, b.y, b.z - hd],
      [b.x + hw, b.y, b.z + hd], [b.x - hw, b.y, b.z + hd],
      [b.x - hw, b.y + b.h, b.z - hd], [b.x + hw, b.y + b.h, b.z - hd],
      [b.x + hw, b.y + b.h, b.z + hd], [b.x - hw, b.y + b.h, b.z + hd],
    ];
  }
  function putFigure(list, x, y, z, pal, anim, faceYaw, moving) {
    const bob = (!REDUCE && moving) ? Math.sin(anim) * 0.05 : 0;
    const swing = (!REDUCE && moving) ? Math.sin(anim) * 0.2 : 0;
    const cy = y + bob;
    const c = Math.cos(faceYaw), s = Math.sin(faceYaw);
    function put(lx, ly, lz, w, h, d, color) {
      list.push({
        x: x + lx * c + lz * s, y: cy + ly, z: z - lx * s + lz * c,
        w, h, d, color, solid: false,
      });
    }
    put(0, 1.32, 0, 0.64, 0.56, 0.58, pal.head);
    put(0, 0.62, 0, 0.82, 0.7, 0.48, pal.torso);
    put(-0.56, 0.68, 0, 0.24, 0.56, 0.24, pal.arms);
    put(0.56, 0.68, 0, 0.24, 0.56, 0.24, pal.arms);
    put(-0.22, 0, swing, 0.3, 0.62, 0.3, pal.legs);
    put(0.22, 0, -swing, 0.3, 0.62, 0.3, pal.legs);
    if (pal.cape) put(0, 0.58, -0.34, 0.62, 0.78, 0.1, pal.cape);
  }

  function collectFaces(boxes, out) {
    for (const b of boxes) {
      const vs = vertsOf(b);
      const faces = b.topOnly ? FACE.filter((f) => f.k > 1.1) : FACE;
      for (const f of faces) {
        const pts = [];
        let depth = 0, ok = true;
        for (const idx of f.i) {
          const p = project(vs[idx][0], vs[idx][1], vs[idx][2]);
          if (!p) { ok = false; break; }
          pts.push(p);
          depth += p.z;
        }
        if (!ok) continue;
        out.push({ kind: 'face', z: depth / 4, pts, color: b.color, k: f.k });
      }
    }
  }

  function draw() {
    updateBasis();
    ctx.clearRect(0, 0, W, H);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#7ad7ff');
    sky.addColorStop(0.55, '#4dc3ff');
    sky.addColorStop(1, '#9be7a6');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Sun
    ctx.beginPath();
    ctx.fillStyle = '#ffe566';
    ctx.arc(W * 0.84, H * 0.14, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#20143a';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Soft screen-space clouds
    ctx.fillStyle = 'rgba(255,255,255,.78)';
    [[0.18, 0.16, 34], [0.42, 0.10, 26], [0.62, 0.18, 22]].forEach(([nx, ny, r]) => {
      const cx = (nx * W + (-cam.x * 4) % W + W) % W;
      ctx.beginPath();
      ctx.ellipse(cx, ny * H, r, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    const drawBoxes = solids.slice();
    const moving = Math.hypot(vx, vz) > 0.02;
    if (moving) walkPhase += 0.28;
    putFigure(drawBoxes, px, py, pz, {
      head: '#ffd84d', torso: '#4d8bff', arms: '#ffd84d', legs: '#ff5e5b', cape: '#e74c3c',
    }, walkPhase, yaw, moving);
    pals.forEach((p, i) => {
      putFigure(drawBoxes, p.x, 0, p.z, p.pal, lastT * 0.004 + i, 0.6, false);
    });

    const items = [];
    collectFaces(drawBoxes, items);

    // Ground studs (classic Roblox plate)
    for (let gx = -22; gx <= 22; gx += 2) {
      for (let gz = -16; gz <= 32; gz += 2) {
        const p = project(gx, 0.03, gz);
        if (!p || p.z > 32 || p.x < -20 || p.x > W + 20) continue;
        items.push({ kind: 'stud', z: p.z, p });
      }
    }
    // Player blob shadow
    const sh = project(px, 0.02, pz);
    if (sh) items.push({ kind: 'shadow', z: sh.z - 0.01, p: sh });

    coins.forEach((c) => {
      if (c.got) return;
      const p = project(c.x, c.y, c.z);
      if (p) items.push({ kind: 'coin', z: p.z, p, spin: c.spin });
    });
    const trophy = project(0, 6.2, 22.0);
    if (trophy) items.push({ kind: 'trophy', z: trophy.z, p: trophy });

    items.sort((a, b) => b.z - a.z);
    for (const it of items) {
      const fog = clamp((it.z - 16) / 36, 0, 0.28);
      if (it.kind === 'face') {
        ctx.beginPath();
        ctx.moveTo(it.pts[0].x, it.pts[0].y);
        for (let i = 1; i < it.pts.length; i++) ctx.lineTo(it.pts[i].x, it.pts[i].y);
        ctx.closePath();
        ctx.fillStyle = shade(it.color, it.k, fog);
        ctx.fill();
        ctx.strokeStyle = 'rgba(32,20,58,' + (0.85 - fog * 0.5) + ')';
        ctx.lineWidth = Math.max(1, (it.pts[0].s || 8) * 0.045);
        ctx.lineJoin = 'round';
        ctx.stroke();
      } else if (it.kind === 'stud') {
        ctx.beginPath();
        ctx.ellipse(it.p.x, it.p.y, it.p.s * 0.16, it.p.s * 0.08, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(20,60,30,' + (0.16 * (1 - fog)) + ')';
        ctx.fill();
      } else if (it.kind === 'shadow') {
        ctx.beginPath();
        ctx.ellipse(it.p.x, it.p.y, it.p.s * 0.42, it.p.s * 0.18, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(32,20,58,.28)';
        ctx.fill();
      } else if (it.kind === 'coin') {
        const squish = 0.35 + Math.abs(Math.cos(it.spin)) * 0.65;
        ctx.beginPath();
        ctx.ellipse(it.p.x, it.p.y, it.p.s * 0.28 * squish, it.p.s * 0.28, 0, 0, Math.PI * 2);
        ctx.fillStyle = shade('#ffd23f', 1.05, fog);
        ctx.fill();
        ctx.strokeStyle = '#20143a';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (it.kind === 'trophy') {
        ctx.save();
        ctx.font = Math.round(it.p.s * 0.85) + 'px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(won ? '🏆' : '🌟', it.p.x, it.p.y);
        ctx.restore();
      }
    }
  }

  function overlaps(x, y, z, b) {
    const hw = b.w / 2, hd = b.d / 2;
    return x + PW > b.x - hw && x - PW < b.x + hw &&
           z + PD > b.z - hd && z - PD < b.z + hd &&
           y < b.y + b.h && y + PH > b.y;
  }
  function collide(prevY) {
    grounded = py <= 0.02;
    if (py < 0) { py = 0; vy = 0; grounded = true; }
    for (const b of solids) {
      if (!b.solid) continue;
      if (!overlaps(px, py, pz, b)) continue;
      const top = b.y + b.h;
      const step = top - prevY;
      const crossedTop = prevY >= top - 0.14 && py <= top + 0.1;
      const walkOnto = step >= -0.08 && step <= 0.75 && py < top + 0.2;
      // Land when falling onto a top, or stepping up onto a short pad.
      if (vy <= 0.2 && (crossedTop || walkOnto)) {
        py = top;
        vy = 0;
        grounded = true;
        if (b.tag === 'bounce') {
          vy = 0.4;
          grounded = false;
          Sound.jump();
        }
        continue;
      }
      const hw = b.w / 2, hd = b.d / 2;
      const dxL = (px + PW) - (b.x - hw);
      const dxR = (b.x + hw) - (px - PW);
      const dzN = (pz + PD) - (b.z - hd);
      const dzF = (b.z + hd) - (pz - PD);
      if (Math.min(dxL, dxR) < Math.min(dzN, dzF)) {
        px += (dxL < dxR) ? -dxL : dxR;
      } else {
        pz += (dzN < dzF) ? -dzN : dzF;
      }
    }
  }

  function popAtPlayer(text, color) {
    const p = project(px, py + 1.8, pz);
    if (!p) { floatPop(innerWidth / 2, innerHeight / 2, text, color); return; }
    const r = canvas.getBoundingClientRect();
    floatPop(r.left + p.x, r.top + p.y, text, color);
  }

  function persistBest() {
    if (score > best) {
      best = score;
      if (bestEl) bestEl.textContent = best;
      Store.set('worldBest', best);
    }
  }
  function finishObby() {
    won = true;
    score += 10;
    if (scoreEl) scoreEl.textContent = score;
    persistBest();
    Store.set('worldObby', 1);
    if (msg) msg.textContent = 'YOU DID THE OBBY! 🏆🌈';
    Sound.winHero();
    confettiBurst(140);
    popAtPlayer('🏆 OBBY!', '#ffd23f');
    shakeEl(stage);
  }

  function hideHint() {
    if (hinted) return;
    hinted = true;
    if (hint) hint.classList.add('hide');
  }
  function jump() {
    if (!active) return;
    hideHint();
    if (grounded) {
      vy = 0.3;
      grounded = false;
      Sound.jump();
      Haptics.tap();
    }
  }

  function setStick(nx, ny) {
    stickX = clamp(nx, -1, 1);
    stickY = clamp(ny, -1, 1);
    if (knob) knob.style.transform = 'translate(calc(-50% + ' + (stickX * 28) + 'px), calc(-50% + ' + (stickY * 28) + 'px))';
  }
  function stickFromEvent(e) {
    const r = stick.getBoundingClientRect();
    const p = (e.touches && e.touches[0]) ? e.touches[0] : e;
    const nx = ((p.clientX - r.left) / r.width - 0.5) * 2;
    const ny = ((p.clientY - r.top) / r.height - 0.5) * 2;
    const mag = Math.hypot(nx, ny) || 1;
    const cap = Math.min(1, mag);
    setStick((nx / mag) * cap, (ny / mag) * cap);
  }
  function aimFromEvent(e) {
    const r = canvas.getBoundingClientRect();
    const p = (e.touches && e.touches[0]) ? e.touches[0] : e;
    const g = screenToGround(p.clientX - r.left, p.clientY - r.top);
    if (!g) return;
    walkTx = g.x; walkTz = g.z;
    hideHint();
  }

  function stepWorld(dt) {
    let ix = stickX, iz = -stickY;
    if (keys.w || keys.arrowup) iz += 1;
    if (keys.s || keys.arrowdown) iz -= 1;
    if (keys.a) ix -= 1;
    if (keys.d) ix += 1;
    // Camera-relative: stick forward = world +Z (obby), right = +X
    if (!stickHeld && walkTx != null) {
      const dx = walkTx - px, dz = walkTz - pz;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.35) { walkTx = walkTz = null; ix = 0; iz = 0; }
      else { ix = dx / dist; iz = dz / dist; }
    }
    const mag = Math.hypot(ix, iz);
    if (mag > 1) { ix /= mag; iz /= mag; }
    const speed = 0.135 * dt;
    vx = ix * speed;
    vz = iz * speed;
    if (mag > 0.08) yaw = Math.atan2(ix, iz);

    const prevY = py;
    px += vx;
    pz += vz;
    vy -= 0.011 * dt;
    py += vy * dt;

    collide(prevY);

    if (!won && grounded && py >= 4.75 && Math.hypot(px, pz - 22.0) < 2.2) {
      finishObby();
    }

    // Soft world bounds — oops, back to spawn
    if (py < -1.5 || Math.abs(px) > 18 || pz < -16 || pz > 30) {
      px = 0; py = 0; pz = 0; vx = vy = vz = 0;
      walkTx = walkTz = null;
      Sound.whoosh();
      if (msg) msg.textContent = 'OOPS! Back to spawn 💨';
      popAtPlayer('OOPS! 💨', '#fff');
    }

    coins.forEach((c) => {
      if (c.got) return;
      c.spin += 0.09 * dt;
      if (Math.hypot(px - c.x, pz - c.z) < 0.95 && Math.abs((py + 1) - c.y) < 1.4) {
        c.got = true;
        score++;
        if (scoreEl) scoreEl.textContent = score;
        persistBest();
        Sound.coin();
        Haptics.tap();
        popAtPlayer(cheers[randInt(0, cheers.length - 1)], '#ffd23f');
        if (score % 5 === 0) { confettiBurst(50); Sound.perfect(); }
      }
    });
    pals.forEach((p) => {
      if (p.hit) return;
      if (Math.hypot(px - p.x, pz - p.z) < 1.25 && py < 1.2) {
        p.hit = true;
        score++;
        if (scoreEl) scoreEl.textContent = score;
        persistBest();
        Sound.pop();
        popAtPlayer('🙌 ' + p.name + '!', '#fff');
        if (msg) msg.textContent = 'High five, ' + p.name + '! 🙌';
      }
    });
    if (!honked && Math.hypot(px - 9.4, pz + 5.2) < 1.7 && py < 1.4) {
      honked = true;
      Sound.goal();
      popAtPlayer('BEEP BEEP! 🏎️', '#ffd23f');
    }

    const ck = REDUCE ? 1 : 0.14;
    cam.x += (px - cam.x) * ck;
    cam.y += ((py + 10.2) - cam.y) * ck;
    cam.z += ((pz - 16.5) - cam.z) * ck;
  }

  function loop(now) {
    if (!active) return;
    const dt = Math.min(2.2, (now - lastT) / 16.67);
    lastT = now;
    stepWorld(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function onStickDown(e) {
    if (!active) return;
    stickHeld = true;
    walkTx = walkTz = null;
    hideHint();
    if (e.pointerId != null && stick.setPointerCapture) {
      try { stick.setPointerCapture(e.pointerId); } catch (_) {}
    }
    stickFromEvent(e);
    if (e.cancelable) e.preventDefault();
  }
  function onStickMove(e) {
    if (!stickHeld) return;
    stickFromEvent(e);
    if (e.cancelable) e.preventDefault();
  }
  function onStickUp() {
    stickHeld = false;
    setStick(0, 0);
  }
  function onCanvasDown(e) {
    if (!active || e.target !== canvas) return;
    canvasHeld = true;
    if (e.pointerId != null && canvas.setPointerCapture) {
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
    aimFromEvent(e);
  }
  function onCanvasMove(e) {
    if (canvasHeld) aimFromEvent(e);
  }
  function onCanvasUp() { canvasHeld = false; }
  function onKey(e, down) {
    if (!active) return;
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'a' || k === 's' || k === 'd' || k === ' ') {
      keys[k] = down;
      if (k === ' ' && down) { e.preventDefault(); jump(); }
      if (down) hideHint();
    }
  }
  const keyDown = (e) => onKey(e, true);
  const keyUp = (e) => onKey(e, false);

  function bind() {
    stick.addEventListener('pointerdown', onStickDown);
    stick.addEventListener('pointermove', onStickMove);
    stick.addEventListener('pointerup', onStickUp);
    stick.addEventListener('pointercancel', onStickUp);
    canvas.addEventListener('pointerdown', onCanvasDown);
    canvas.addEventListener('pointermove', onCanvasMove);
    canvas.addEventListener('pointerup', onCanvasUp);
    canvas.addEventListener('pointercancel', onCanvasUp);
    jumpBtn.addEventListener('click', jump);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('resize', sizeWorld);
  }
  function unbind() {
    stick.removeEventListener('pointerdown', onStickDown);
    stick.removeEventListener('pointermove', onStickMove);
    stick.removeEventListener('pointerup', onStickUp);
    stick.removeEventListener('pointercancel', onStickUp);
    canvas.removeEventListener('pointerdown', onCanvasDown);
    canvas.removeEventListener('pointermove', onCanvasMove);
    canvas.removeEventListener('pointerup', onCanvasUp);
    canvas.removeEventListener('pointercancel', onCanvasUp);
    jumpBtn.removeEventListener('click', jump);
    window.removeEventListener('keydown', keyDown);
    window.removeEventListener('keyup', keyUp);
    window.removeEventListener('resize', sizeWorld);
  }

  function reset() {
    px = 0; py = 0; pz = 0; vx = 0; vy = 0; vz = 0; yaw = 0;
    grounded = true; walkPhase = 0; score = 0; won = false; honked = false;
    hinted = false; stickHeld = false; canvasHeld = false;
    walkTx = walkTz = null;
    Object.keys(keys).forEach((k) => { keys[k] = false; });
    setStick(0, 0);
    if (hint) hint.classList.remove('hide');
    if (scoreEl) scoreEl.textContent = 0;
    if (msg) msg.textContent = 'Drag to run, tap JUMP, grab coins, finish the rainbow! 🌈';
    buildWorld();
    cam.x = 0; cam.y = 10.2; cam.z = -16.5;
    sizeWorld();
    lastT = performance.now();
  }

  let bound = false;
  registerGame('world', {
    enter() {
      reset();
      active = true;
      if (!bound) { bind(); bound = true; }
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(loop);
    },
    leave() {
      active = false;
      cancelAnimationFrame(rafId);
      rafId = null;
      stickHeld = false;
      canvasHeld = false;
      setStick(0, 0);
      if (bound) { unbind(); bound = false; }
    },
  });
})();

/* ============================================================
   BIKES — endless jump runner
   ============================================================ */
(() => {
  const area = $('runArea'), bike = $('bike'), jumpBtn = $('jumpBtn');
  const scoreEl = $('bikeScore'), bestEl = $('bikeBest'), heartsEl = $('bikeHearts');
  function updateHearts() { if (heartsEl) heartsEl.textContent = '❤️'.repeat(Math.max(0, lives)) || '💔'; }
  let best = Store.getNum('bikeBest');
  const GROUND = 26, BIKE_X = 36, BIKE_W = 40;
  let areaW = 0;
  let y = 0, vy = 0, dist = 0, speed = 3, running = false, rafId = null;
  let rocks = [];           // {el, x}
  let coins = [];           // {el, x, y}
  let clouds = [];          // {el, x, sp}   drifting background (parallax)
  let stars = [];           // {el, x, y}    shield power-ups
  let spawnGap = 0, coinGap = 0, cloudGap = 0, starGap = 0;
  let jumps = 0, shieldUntil = 0;
  let lives = 3;            // hearts: a hit costs one, run ends only at 0

  bestEl.textContent = best;

  function clearRocks() { rocks.forEach(r => r.el.remove()); rocks = []; }
  function clearCoins() { coins.forEach(c => c.el.remove()); coins = []; }
  function clearClouds() { clouds.forEach(c => c.el.remove()); clouds = []; }
  function clearStars() { stars.forEach(s => s.el.remove()); stars = []; }
  function spawnCloud() {
    const el = document.createElement('div');
    el.className = 'cloud';
    el.textContent = Math.random() < 0.5 ? '☁️' : '⛅';
    el.style.left = areaW + 'px';
    el.style.bottom = rand(78, 150) + 'px';
    el.style.fontSize = rand(1.4, 2.6).toFixed(2) + 'rem';
    area.appendChild(el);
    clouds.push({ el, x: areaW, sp: rand(0.3, 0.6) });
  }
  function spawnStar() {
    const el = document.createElement('div');
    el.className = 'star-pow';
    el.textContent = '⭐';
    const sy = rand(42, 92);
    el.style.left = areaW + 'px';
    el.style.bottom = (GROUND + sy) + 'px';
    area.appendChild(el);
    stars.push({ el, x: areaW, y: sy });
  }
  function spawnCoin() {
    const el = document.createElement('div');
    el.className = 'coin';
    el.textContent = '🪙';
    const cy = rand(40, 92);                 // floating at a jumpable height
    el.style.left = areaW + 'px';
    el.style.bottom = (GROUND + cy) + 'px';
    area.appendChild(el);
    coins.push({ el, x: areaW, y: cy });
  }
  function spawnRock() {
    const el = document.createElement('div');
    el.className = 'rock';
    el.textContent = Math.random() < 0.5 ? '🪨' : '🌵';
    el.style.left = areaW + 'px';
    area.appendChild(el);
    rocks.push({ el, x: areaW });
  }
  function jump() {
    if (!running) { start(); return; }
    // Double-jump: one launch from the ground + one extra mid-air hop
    if (jumps < 2) {
      vy = jumps === 0 ? 12.5 : 11;
      jumps++;
      Sound.jump(); Haptics.tap();
    }
  }
  function frame() {
    if (!running) return;
    areaW = area.clientWidth;   // keep spawn edge correct across rotation/resize
    // physics
    vy -= 0.55; y += vy;
    if (y <= 0) { y = 0; vy = 0; jumps = 0; }   // landed → jumps refill
    bike.style.bottom = (GROUND + y) + 'px';

    const shielded = Date.now() < shieldUntil;
    bike.classList.toggle('shield', shielded);

    // world speed ramps up slowly
    speed = 2.4 + dist * 0.0010;
    dist += speed * 0.12;
    scoreEl.textContent = Math.floor(dist);

    // drifting clouds (slow parallax behind the action)
    for (const c of clouds) { c.x -= speed * c.sp; c.el.style.left = c.x + 'px'; }
    while (clouds.length && clouds[0].x < -90) { clouds[0].el.remove(); clouds.shift(); }
    cloudGap -= speed;
    if (cloudGap <= 0) { spawnCloud(); cloudGap = rand(220, 440); }

    // move rocks
    for (const r of rocks) { r.x -= speed; r.el.style.left = r.x + 'px'; }
    while (rocks.length && rocks[0].x < -40) { rocks[0].el.remove(); rocks.shift(); }

    // spawn rocks with a clearable gap
    spawnGap -= speed;
    if (spawnGap <= 0) { spawnRock(); spawnGap = rand(240, 400) + speed * 34; }

    // floating coins — jump into them for bonus metres
    for (const c of coins) { c.x -= speed; c.el.style.left = c.x + 'px'; }
    while (coins.length && coins[0].x < -40) { coins[0].el.remove(); coins.shift(); }
    coinGap -= speed;
    if (coinGap <= 0) { spawnCoin(); coinGap = rand(300, 560); }
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      if (c.x < BIKE_X + BIKE_W && c.x + 30 > BIKE_X && Math.abs(y - c.y) < 30) {
        c.el.classList.add('got');
        setTimeout(() => c.el.remove(), 250);
        coins.splice(i, 1);
        dist += 5;                          // bonus distance
        Sound.coin(); Haptics.tap();
        const ar = area.getBoundingClientRect();
        floatPop(ar.left + BIKE_X + 6, ar.top + 36, '+5 🪙', '#ffd23f');
      }
    }

    // shield stars — grab one for ~5s of invincibility
    for (const s of stars) { s.x -= speed; s.el.style.left = s.x + 'px'; }
    while (stars.length && stars[0].x < -40) { stars[0].el.remove(); stars.shift(); }
    starGap -= speed;
    if (starGap <= 0) { spawnStar(); starGap = rand(500, 900); }
    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i];
      if (s.x < BIKE_X + BIKE_W && s.x + 30 > BIKE_X && Math.abs(y - s.y) < 32) {
        s.el.classList.add('got');
        setTimeout(() => s.el.remove(), 250);
        stars.splice(i, 1);
        shieldUntil = Date.now() + 5000;
        Sound.whoosh(); Sound.perfect(); Haptics.hit();
        const ar = area.getBoundingClientRect();
        floatPop(ar.left + BIKE_X + 6, ar.top + 30, 'SHIELD! ⭐', '#ffd23f');
      }
    }

    // collision — while shielded, smash through rocks instead of crashing
    if (shielded) {
      for (let i = rocks.length - 1; i >= 0; i--) {
        const r = rocks[i];
        if (r.x < BIKE_X + BIKE_W - 6 && r.x + 30 > BIKE_X + 6 && y < 20) {
          r.el.classList.add('smashed');
          setTimeout(() => r.el.remove(), 250);
          rocks.splice(i, 1);
          Sound.boom();
        }
      }
    } else {
      for (let i = rocks.length - 1; i >= 0; i--) {
        const r = rocks[i];
        if (r.x < BIKE_X + BIKE_W - 16 && r.x + 30 > BIKE_X + 16 && y < 16) {
          lives--;
          r.el.classList.add('smashed');
          setTimeout(() => r.el.remove(), 250);
          rocks.splice(i, 1);
          if (lives <= 0) { crash(); return; }
          shieldUntil = Date.now() + 1500;   // brief mercy invincibility
          Sound.boom(); Haptics.hit(); shakeEl(area);  // soft hit, not crash
          const ar = area.getBoundingClientRect();
          floatPop(ar.left + BIKE_X + 6, ar.top + 30, 'OOPS! 💨', '#fff');
          updateHearts();
          break;
        }
      }
    }
    rafId = requestAnimationFrame(frame);
  }
  function start() {
    clearRocks(); clearCoins(); clearClouds(); clearStars();
    y = 0; vy = 0; dist = 0; speed = 3; spawnGap = 80; coinGap = 160;
    cloudGap = 0; starGap = 400; jumps = 0; lives = 3;
    shieldUntil = Date.now() + 2500; running = true;   // opening grace shield
    updateHearts();
    bike.classList.remove('shield');
    bike.style.bottom = GROUND + 'px';
    scoreEl.textContent = 0;
    jumpBtn.textContent = 'JUMP 🦘';
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  }
  function crash() {
    running = false;
    cancelAnimationFrame(rafId);
    Sound.crash(); Haptics.hit(); shakeEl(area);
    if (heartsEl) heartsEl.textContent = '💔';
    const m = Math.floor(dist);
    if (m > best) { best = m; bestEl.textContent = best; Store.set('bikeBest', best); confettiBurst(120); Sound.win(); }
    jumpBtn.textContent = 'RUN AGAIN 🔁';
  }

  jumpBtn.addEventListener('click', jump);
  area.addEventListener('click', () => { jump(); });
  function selectRide(b) {
    document.querySelectorAll('#ridePick .pick-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    bike.textContent = b.dataset.ride;
    Store.set('bikeRide', b.dataset.ride);
  }
  document.querySelectorAll('#ridePick .pick-btn').forEach(b =>
    b.addEventListener('click', () => { selectRide(b); Sound.pop(); }));
  (() => {
    const saved = Store.get('bikeRide', '🚲');
    const btn = [...document.querySelectorAll('#ridePick .pick-btn')].find(x => x.dataset.ride === saved);
    if (btn) selectRide(btn);
  })();

  registerGame('bikes', {
    enter() { areaW = area.clientWidth; start(); },
    leave() { running = false; cancelAnimationFrame(rafId); clearRocks(); clearCoins(); clearClouds(); clearStars(); bike.classList.remove('shield'); },
  });
})();

/* ============================================================
   FAMILY — send love (fills the love meter)
   ============================================================ */
(() => {
  const msg = $('loveMsg'), fill = $('loveFill');
  let love = 0;
  let burstTimers = [];
  const clearBurst = () => { burstTimers.forEach(clearTimeout); burstTimers = []; };
  // Per-person sound + burst color so each family member feels unique
  const personFx = {
    Mom:   { sound: () => Sound.sparkle(), burst: '#ff6fb5', word: 'MOM!' },
    Dad:   { sound: () => Sound.pop(),     burst: '#4d8bff', word: 'DAD!' },
    Manha: { sound: () => Sound.jump(),    burst: '#ffd23f', word: 'SIS!' },
    Noah:  { sound: () => Sound.blip(),    burst: '#2ecc71', word: 'ME!' },
  };
  document.querySelectorAll('.person').forEach(p => {
    p.addEventListener('click', (e) => {
      msg.textContent = p.dataset.love;
      const name = (p.querySelector('.name') || {}).textContent || '';
      const fx = personFx[name] || { sound: () => Sound.pop(), burst: '#fff', word: 'LOVE!' };
      fx.sound();
      popFromEvent(e, '💖', fx.burst);
      if (p.classList.contains('fav')) burstFromEvent(e, fx.word, fx.burst);
      p.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
        { duration: 350 }
      );
      love = Math.min(100, love + (p.classList.contains('fav') ? 16 : 11));
      fill.style.width = love + '%';
      if (love >= 100) {
        msg.textContent = "Noah's family is FULL of love! 💖";
        confettiAt(e, 120); Sound.win();
        const hearts = ['💖', '💝', '💞', '❤️', '💕', '💗'];
        for (let i = 0; i < 14; i++) {
          burstTimers.push(setTimeout(() => floatPop(
            rand(40, innerWidth - 40),
            rand(innerHeight * 0.4, innerHeight * 0.7),
            hearts[randInt(0, hearts.length - 1)], '#ff6fb5'
          ), i * 65));
        }
        love = 0;
        burstTimers.push(setTimeout(() => { fill.style.width = '0%'; }, 700));
      } else if (p.classList.contains('fav')) {
        confettiAt(e, 40);
      }
    });
  });
  registerGame('family', {
    enter() { clearBurst(); love = 0; fill.style.width = '0%'; msg.textContent = ''; },
    leave() { clearBurst(); },
  });
})();

/* ============================================================
   FRIENDS — high-five all 10 to win a round
   Names are trivially editable here if a friendship changes.
   ============================================================ */
(() => {
  const grid = $('friendsGrid'), scoreEl = $('fiveScore'), roundEl = $('friendsRound');
  const note = document.querySelector('#friends .card-text');
  // Editable list — face + first name for each of Noah's 10 friends
  const friends = [
    { face: '👦', name: 'Leo' },
    { face: '👧', name: 'Mia' },
    { face: '🧒', name: 'Sam' },
    { face: '👦🏽', name: 'Omar' },
    { face: '👧🏾', name: 'Ava' },
    { face: '🧒🏼', name: 'Max' },
    { face: '👦🏿', name: 'Jay' },
    { face: '👧🏻', name: 'Zoe' },
    { face: '🧒🏽', name: 'Ben' },
    { face: '👦🏼', name: 'Kai' }
  ];
  const reactions = ['🙌', '✋', '🤚', '👏', '🤩', '😄', '🎉'];
  let total = Store.getNum('fives');
  let round = Store.getNum('friendsRound', 1);
  let done = new Set();
  let resetT = null;

  scoreEl.textContent = total;
  roundEl.textContent = round;

  friends.forEach((f, idx) => {
    const btn = document.createElement('button');
    btn.className = 'friend';
    btn.innerHTML = `<span class="friend-face">${f.face}</span><span class="friend-name">${f.name}</span>`;
    btn.setAttribute('aria-label', 'High five ' + f.name);
    btn.addEventListener('click', (e) => {
      btn.classList.remove('fived'); void btn.offsetWidth; btn.classList.add('fived');
      Sound.pop();
      popFromEvent(e, reactions[randInt(0, reactions.length - 1)], '#fff');
      total++; scoreEl.textContent = total; Store.set('fives', total);
      done.add(idx);
      const left = friends.length - done.size;
      if (done.size === friends.length) {
        note.textContent = '🎉 Round complete! High-five them all again! 🙌';
        confettiAt(e, 120); Sound.win();
        round++; roundEl.textContent = round; Store.set('friendsRound', round); Store.set('friendsDone', round - 1);
        done.clear();
        clearTimeout(resetT);
        resetT = setTimeout(() => grid.querySelectorAll('.friend').forEach(el => el.classList.remove('fived')), 700);
      } else {
        note.textContent = `${left} more friend${left === 1 ? '' : 's'} to high-five! ✋`;
      }
    });
    grid.appendChild(btn);
  });

  registerGame('friends', {
    enter() {
      done.clear();
      note.textContent = 'High-five all 10 friends to win the round! 🙌';
      grid.querySelectorAll('.friend').forEach(el => el.classList.remove('fived'));
    },
    leave() { clearTimeout(resetT); },
  });
})();

/* ============================================================
   TROPHY ROOM — wall of earned stickers from real best scores
   ============================================================ */
(() => {
  const wall = $('trophyWall');
  const note = document.querySelector('#trophies .card-text');
  if (!wall) return;

  const TROPHIES = [
    { id: 'soccer5',  key: 'soccerBest',  min: 5,   emoji: '⚽', label: 'Soccer Star' },
    { id: 'race1',    key: 'raceWins',    min: 1,   emoji: '🏎️', label: 'Race Champ' },
    { id: 'bat10',    key: 'batBest',     min: 10,  emoji: '🦇', label: 'Bat Catcher' },
    { id: 'punch38',  key: 'punchBest',   min: 38,  emoji: '💙', label: 'Blue Belt' },
    { id: 'punch70',  key: 'punchBest',   min: 70,  emoji: '🥋', label: 'Black Belt' },
    { id: 'cop10',    key: 'copBest',     min: 10,  emoji: '🚓', label: 'Top Cop' },
    { id: 'blast30',  key: 'blastBest',   min: 30,  emoji: '🔫', label: 'Blaster Ace' },
    { id: 'stack10',  key: 'stackBest',   min: 10,  emoji: '🧱', label: 'Stack Master' },
    { id: 'bike100',  key: 'bikeBest',    min: 100, emoji: '🏍️', label: 'Bike Hero' },
    { id: 'fives1',   key: 'fives',       min: 1,   emoji: '🙌', label: 'Friend Five' },
    { id: 'rounds',   key: 'friendsDone', min: 1,   emoji: '🔁', label: 'Round Champ' },
    { id: 'goal1',    key: 'soccerBest',  min: 1,   emoji: '🎉', label: 'First Goal' },
    { id: 'world8',   key: 'worldBest',   min: 8,   emoji: '🪙', label: 'Coin Hunter' },
    { id: 'obby1',    key: 'worldObby',   min: 1,   emoji: '🧊', label: 'Obby Champ' },
  ];

  function render() {
    wall.innerHTML = '';
    let earned = 0;
    const newly = [];
    TROPHIES.forEach(t => {
      const has = Store.getNum(t.key) >= t.min;
      if (has) earned++;
      const seenKey = 'trophySeen:' + t.id;
      if (has && Store.get(seenKey, '0') !== '1') {
        newly.push(t);
        Store.set(seenKey, '1');
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'trophy' + (has ? ' earned' : ' locked');
      btn.innerHTML = `<span class="trophy-emoji">${t.emoji}</span><span class="trophy-label">${t.label}</span>`;
      btn.setAttribute('aria-label', has ? t.label + ' unlocked' : t.label + ' locked');
      btn.addEventListener('click', (e) => {
        if (!has) { Sound.miss(); popFromEvent(e, '🔒', '#fff'); return; }
        Sound.perfect();
        confettiAt(e, 50);
        popFromEvent(e, t.emoji, '#ffd23f');
      });
      wall.appendChild(btn);
    });
    Store.set('trophiesEarned', earned);
    if (note) {
      note.textContent = earned === 0
        ? 'Play games to earn shiny trophies! 🏆'
        : `You unlocked ${earned} of ${TROPHIES.length} trophies! 🌟`;
    }
    if (newly.length) {
      confettiBurst(100);
      Sound.win();
      newly.forEach((t, i) => {
        setTimeout(() => floatPop(
          rand(60, innerWidth - 60),
          rand(innerHeight * 0.35, innerHeight * 0.6),
          t.emoji + ' NEW!', '#ffd23f'
        ), i * 180);
      });
    }
  }

  registerGame('trophies', {
    enter() { render(); },
    leave() {},
  });
})();

/* ============================================================
   NO STUDY — the book runs away from your taps
   ============================================================ */
(() => {
  const zone = $('studyZone'), book = $('bookBtn'), msg = $('studyMsg');
  const dodges = ['Nope! 😜', 'Too slow! 🏃', 'Hee hee! 😆', 'Catch me! 💨', 'No study! 📚', 'Missed! 🙈'];
  let taps = 0;

  function center() { book.style.left = '50%'; book.style.top = '90px'; book.style.transform = 'translateX(-50%)'; }
  function flee() {
    const maxX = zone.clientWidth - 90, maxY = zone.clientHeight - 90;
    book.style.left = rand(10, Math.max(10, maxX)) + 'px';
    book.style.top = rand(10, Math.max(10, maxY)) + 'px';
    book.style.transform = `rotate(${rand(-20, 20)}deg)`;
  }

  book.addEventListener('click', (e) => {
    taps++;
    Sound.whoosh();
    if (taps % 6 === 0) {
      msg.textContent = 'You caught it! Now... PLAY TIME! 🎉';
      confettiBurst(120); Sound.win();
      center();
    } else {
      const close = taps % 6 === 5;       // one tap away from catching it
      msg.textContent = close ? 'So close! One more tap! 😮' : dodges[randInt(0, dodges.length - 1)];
      if (close) Sound.miss();             // distinct 'ooh, so close!' cue (was dead helper)
      flee();
      popFromEvent(e, close ? '😅' : '💨', '#fff');
    }
  });
  // Dodge when a finger/pointer approaches the book (works on touch AND mouse).
  // Gated on taps%6!==5 so the guaranteed-catch 'one more tap' state holds still,
  // and throttled so the book doesn't jitter/teleport on every move event.
  let lastDodge = 0;
  function dodgeFrom(e) {
    if (taps % 6 === 5) return;            // hold still when one tap away
    const now = Date.now();
    if (now - lastDodge < 280) return;     // throttle: at most ~1 dodge / 0.28s
    const r = book.getBoundingClientRect();
    const p = (e.touches && e.touches[0]) ? e.touches[0] : e;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dist = Math.hypot((p.clientX || 0) - cx, (p.clientY || 0) - cy);
    if (dist > r.width * 0.9) return;      // only flee when the finger is close
    lastDodge = now;
    flee();
  }
  zone.addEventListener('pointermove', dodgeFrom);
  zone.addEventListener('touchmove', dodgeFrom, { passive: true });

  registerGame('nostudy', {
    enter() { taps = 0; msg.textContent = ''; center(); },
    leave() {},
  });
})();

/* ============================================================
   BOOT
   ============================================================ */
/* Welcome confetti on first interaction (unlocks audio too) */
let welcomed = false;
function welcome() {
  if (welcomed) return;
  welcomed = true;
  Sound.unlock();
  confettiBurst(120);
  Sound.win();
}
document.body.addEventListener('click', welcome, { once: true });
document.body.addEventListener('touchstart', welcome, { once: true, passive: true });

/* Open whatever the URL points at (supports deep links / refresh) */
show(fromHash());

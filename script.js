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
    const n = parseInt(this.get(key, fallback), 10);
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
  const ensure = () => {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
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
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + dur);
  };
  return {
    setOn(v) { on = v; },
    isOn() { return on; },
    blip: () => tone(660, 0.1, 'square', 0.15),
    goal: () => { tone(523, 0.12); setTimeout(() => tone(659, 0.12), 110); setTimeout(() => tone(784, 0.22), 220); },
    miss: () => tone(160, 0.3, 'sawtooth', 0.15),
    punch: () => tone(120, 0.12, 'square', 0.25),
    win: () => { [523, 587, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18), i * 120)); },
    siren: () => { tone(700, 0.2, 'sine', 0.2); setTimeout(() => tone(500, 0.2, 'sine', 0.2), 200); },
    pop: () => tone(880, 0.08, 'triangle', 0.2),
    whoosh: () => tone(300, 0.25, 'sine', 0.15),
    sad: () => { tone(400, 0.18); setTimeout(() => tone(300, 0.28), 160); },
    jump: () => { tone(420, 0.1, 'square', 0.18); setTimeout(() => tone(680, 0.1, 'square', 0.16), 90); },
    crash: () => { tone(140, 0.35, 'sawtooth', 0.25); setTimeout(() => tone(90, 0.3, 'square', 0.2), 80); },
    tick: () => tone(800, 0.05, 'square', 0.12),
    perfect: () => { tone(880, 0.1); setTimeout(() => tone(1320, 0.16), 100); },
    laser: () => { tone(1150, 0.05, 'square', 0.16); setTimeout(() => tone(430, 0.12, 'sawtooth', 0.16), 45); },
    boom: () => { tone(180, 0.18, 'square', 0.22); setTimeout(() => tone(90, 0.24, 'sawtooth', 0.2), 60); },
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

/* ============================================================
   CONFETTI
   ============================================================ */
const canvas = $('confettiCanvas');
const cctx = canvas.getContext('2d');
let confetti = [];
function sizeCanvas() { canvas.width = innerWidth; canvas.height = innerHeight; }
sizeCanvas();
window.addEventListener('resize', sizeCanvas);

function confettiBurst(count = 90) {
  Haptics.win();
  const colors = ['#ffd23f', '#ff5e5b', '#4d8bff', '#2ecc71', '#9b5de5', '#ff6fb5', '#ff9f1c'];
  for (let i = 0; i < count; i++) {
    confetti.push({
      x: innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: innerHeight / 2,
      vx: (Math.random() - 0.5) * 12,
      vy: Math.random() * -14 - 4,
      size: 6 + Math.random() * 8,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 20,
      life: 100 + Math.random() * 40,
    });
  }
  if (!rafRunning) loop();
}
let rafRunning = false;
function loop() {
  rafRunning = true;
  cctx.clearRect(0, 0, canvas.width, canvas.height);
  confetti.forEach(p => {
    p.vy += 0.4; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
    cctx.save();
    cctx.translate(p.x, p.y);
    cctx.rotate(p.rot * Math.PI / 180);
    cctx.fillStyle = p.color;
    cctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    cctx.restore();
  });
  confetti = confetti.filter(p => p.life > 0 && p.y < canvas.height + 50);
  if (confetti.length) requestAnimationFrame(loop);
  else { cctx.clearRect(0, 0, canvas.width, canvas.height); rafRunning = false; }
}

/* ============================================================
   SCREEN ROUTER  (one game at a time + swipe + arrows)
   ============================================================ */
const ORDER = ['soccer', 'cars', 'batman', 'kickboxing', 'police', 'blaster', 'minecraft', 'bikes', 'family', 'friends', 'nostudy'];
const Games = {};                       // id -> { enter, leave }
const registerGame = (id, hooks) => { Games[id] = hooks; };

const homeBtn = $('homeBtn');
const navPrev = $('navPrev');
const navNext = $('navNext');
let current = 'home';

function setChrome(isGame) {
  homeBtn.hidden = !isGame;
  navPrev.hidden = !isGame;
  navNext.hidden = !isGame;
}

function show(id) {
  if (id !== 'home' && !$(id)) id = 'home';
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
  minecraft: ['stackBest', '🏆'], bikes: ['bikeBest', '🏆'], friends: ['friendsRound', '🔁'],
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
soundToggle.textContent = Sound.isOn() ? '🔊' : '🔇';
soundToggle.addEventListener('click', () => {
  Sound.setOn(!Sound.isOn());
  soundToggle.textContent = Sound.isOn() ? '🔊' : '🔇';
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
  const scoreEl = $('soccerScore'), streakEl = $('soccerStreak'), bestEl = $('soccerBest');
  const zonePct = ['16.66%', '50%', '83.33%'];
  let score = 0, streak = 0, best = Store.getNum('soccerBest');
  let keeperZone = 1, busy = false, timer = null;

  bestEl.textContent = best;
  placeKeeper(1);

  function placeKeeper(z) { keeperZone = z; keeper.style.left = zonePct[z]; }
  function keeperInterval() { return Math.max(420, 850 - score * 18); }
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

    setTimeout(() => {
      if (scored) {
        score++; streak++;
        scoreEl.textContent = score;
        streakEl.textContent = streak;
        Sound.goal();
        showFlash('GOAL! ⚽');
        if (streak > best) { best = streak; bestEl.textContent = best; Store.set('soccerBest', best); }
        if (streak % 3 === 0) confettiBurst(70);
      } else {
        streak = 0; streakEl.textContent = 0;
        keeper.classList.add('save');
        Sound.sad();
        showFlash('SAVED! 🧤');
        setTimeout(() => keeper.classList.remove('save'), 400);
      }
    }, 430);

    setTimeout(() => {
      ball.classList.remove('fly');
      ball.style.left = '50%';
      ball.style.bottom = '12px';
      busy = false;
    }, 950);
  }

  document.querySelectorAll('.shoot-btn').forEach(b =>
    b.addEventListener('click', () => shoot(parseInt(b.dataset.shoot, 10))));

  registerGame('soccer', {
    enter() { keeperTick(); },
    leave() { clearTimeout(timer); },
  });
})();

/* ============================================================
   CAR RACE — tap fast to beat the rival
   ============================================================ */
(() => {
  const player = $('playerCar'), rival = $('rivalCar');
  const btn = $('raceBtn'), msg = $('raceMsg'), winsEl = $('raceWins');
  let wins = Store.getNum('raceWins');
  let state = 'idle';          // idle | countdown | racing | done
  let pPos = 0, rPos = 0, rivalTimer = null, countTimer = null;
  const STEP = 5.2;            // how far each tap pushes the player

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
        // rival creeps forward on its own — beatable by a fast tapper
        rivalTimer = setInterval(() => {
          rPos = clamp(rPos + rand(0.9, 1.7), 0, 100);
          place();
          if (rPos >= 100) finish(false);
        }, 90);
      }
    }, 700);
  }

  function tap() {
    if (state !== 'racing') return;
    pPos = clamp(pPos + STEP, 0, 100);
    place();
    Sound.pop();
    if (pPos >= 100) finish(true);
  }

  function finish(playerWon) {
    if (state === 'done') return;
    state = 'done';
    stopTimers();
    if (playerWon) {
      wins++; winsEl.textContent = wins; Store.set('raceWins', wins);
      msg.textContent = '🏆 YOU WIN! 🏆';
      Sound.win(); confettiBurst(140);
    } else {
      msg.textContent = 'Rival won — tap faster next time! 🔁';
      Sound.sad();
    }
    btn.textContent = 'RACE AGAIN! 🚦';
    state = 'idle';
  }

  // First click starts the race; clicks during the race accelerate.
  btn.addEventListener('click', () => { if (state === 'idle') startRace(); else tap(); });
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
  let spawnTimer = null, active = false;
  const bats = new Set();

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
    const life = setTimeout(() => { b.remove(); bats.delete(b); }, villain ? 1100 : 1500);
    b.addEventListener('click', (e) => {
      clearTimeout(life);
      const pts = villain ? 3 : 1;
      score += pts;
      scoreEl.textContent = score;
      b.classList.add('caught');
      bats.delete(b);
      setTimeout(() => b.remove(), 280);
      Sound.pop();
      popFromEvent(e, villain ? '+3 🦹' : '+1 🦇', '#ffd23f');
      if (score > best) { best = score; bestEl.textContent = best; Store.set('batBest', best); }
      if (score > 0 && score % 10 === 0) { confettiBurst(80); Sound.win(); }
    });
    const gap = Math.max(420, 1000 - score * 12);
    spawnTimer = setTimeout(spawnBat, gap);
  }
  function clearBats() { bats.forEach(b => b.remove()); bats.clear(); }

  moon.addEventListener('click', () => { signal(); confettiBurst(40); });

  registerGame('batman', {
    enter() {
      score = 0; scoreEl.textContent = 0;
      active = true;
      signal();
      spawnTimer = setTimeout(spawnBat, 600);
    },
    leave() {
      active = false;
      clearTimeout(spawnTimer);
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
  let score = 0, best = Store.getNum('punchBest'), time = 10, running = false, timer = null;

  bestEl.textContent = best;

  function setTimer(t) { time = t; timerEl.textContent = t; }
  function startChallenge() {
    if (running) return;
    running = true;
    score = 0; scoreEl.textContent = 0;
    fill.style.width = '0%';
    praise.textContent = '';
    setTimer(10);
    startBtn.textContent = 'PUNCH! 👊';
    msg.textContent = 'GO! Punch as fast as you can! 💥';
    timer = setInterval(() => {
      setTimer(time - 1);
      if (time <= 3 && time > 0) Sound.tick();
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
      confettiBurst(140); Sound.win();
    } else {
      msg.textContent = `Time! You punched ${score} times! 💪`;
      Sound.sad();
    }
    praise.textContent = '';
  }

  bag.addEventListener('click', (e) => {
    bag.classList.remove('hit'); void bag.offsetWidth; bag.classList.add('hit');
    Sound.punch();
    if (!running) { praise.textContent = 'Tap START to begin! ⏱️'; return; }
    score++;
    scoreEl.textContent = score;
    fill.style.width = clamp(score * 2.2, 0, 100) + '%';
    praise.textContent = cheers[randInt(0, cheers.length - 1)];
    popFromEvent(e, '+1', '#fff');
  });
  startBtn.addEventListener('click', () => { if (!running) startChallenge(); });

  registerGame('kickboxing', {
    enter() {
      running = false; score = 0; scoreEl.textContent = 0;
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
  let score = 0, best = Store.getNum('copBest'), time = 15, running = false;
  let clock = null, fleeTimer = null;

  bestEl.textContent = best;

  function moveRobber() {
    const maxX = zone.clientWidth - 64, maxY = zone.clientHeight - 64;
    robber.style.left = rand(12, Math.max(12, maxX)) + 'px';
    robber.style.top = rand(12, Math.max(12, maxY)) + 'px';
    robber.classList.remove('pop'); void robber.offsetWidth; robber.classList.add('pop');
  }
  function fleeInterval() { return Math.max(550, 1300 - score * 35); }
  function scheduleFlee() {
    clearTimeout(fleeTimer);
    fleeTimer = setTimeout(() => { if (running) { moveRobber(); scheduleFlee(); } }, fleeInterval());
  }
  function stopTimers() { clearInterval(clock); clearTimeout(fleeTimer); clock = fleeTimer = null; }

  function start() {
    if (running) return;
    running = true;
    score = 0; scoreEl.textContent = 0;
    time = 15; timerEl.textContent = time;
    robber.hidden = false;
    moveRobber();
    scheduleFlee();
    startBtn.textContent = 'CATCH! 🚔';
    msg.textContent = 'GO! Tap the robber! 🚨';
    clock = setInterval(() => {
      time--; timerEl.textContent = Math.max(0, time);
      if (time <= 3 && time > 0) Sound.tick();
      if (time <= 0) end();
    }, 1000);
  }
  function end() {
    running = false;
    stopTimers();
    robber.hidden = true;
    timerEl.textContent = 15;
    startBtn.textContent = 'PLAY AGAIN 🚨';
    if (score > best) {
      best = score; bestEl.textContent = best; Store.set('copBest', best);
      msg.textContent = `🏆 NEW RECORD! Caught ${score}! 🏆`;
      confettiBurst(140); Sound.win();
    } else {
      msg.textContent = `Time! You caught ${score} robbers! 👮`;
      Sound.sad();
    }
  }

  robber.addEventListener('click', (e) => {
    if (!running) return;
    score++; scoreEl.textContent = score;
    Sound.siren();
    siren.classList.add('active');
    setTimeout(() => siren.classList.remove('active'), 600);
    popFromEvent(e, 'CAUGHT! 🚔', '#fff');
    moveRobber();
    scheduleFlee();
    if (score % 5 === 0) confettiBurst(70);
  });
  startBtn.addEventListener('click', () => { if (!running) start(); });

  registerGame('police', {
    enter() {
      running = false; score = 0; scoreEl.textContent = 0;
      time = 15; timerEl.textContent = 15;
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
  const zone = $('blastZone'), blaster = $('blaster'), msg = $('blastMsg');
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
    const mega = Math.random() < 0.14;                 // rare golden UFO worth +5
    const t = document.createElement('div');
    t.className = 'blast-target' + (mega ? ' mega' : '');
    t.textContent = mega ? '🛸' : critters[randInt(0, critters.length - 1)];
    const size = mega ? 70 : 56;
    t.style.left = rand(8, Math.max(8, zone.clientWidth - size)) + 'px';
    t.style.top = rand(40, Math.max(40, zone.clientHeight - size - 70)) + 'px';
    targets.add(t);
    zone.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    const life = setTimeout(() => escape(t), mega ? 1500 : 1900);
    t.addEventListener('click', (e) => { e.stopPropagation(); clearTimeout(life); blast(t, e, mega); });
    spawnTimer = setTimeout(spawnTarget, Math.max(420, 1050 - score * 14));
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
    setTimeout(() => (mega ? Sound.boom() : Sound.pop()), 60);
    popFromEvent(e, mega ? '+5 🛸💥' : blasts[randInt(0, blasts.length - 1)], mega ? '#ffd23f' : '#5ee7df');
    if (score > best) { best = score; bestEl.textContent = best; Store.set('blastBest', best); }
    if (mega) confettiBurst(60);
    if (Math.floor(score / 10) > Math.floor((score - pts) / 10)) { confettiBurst(90); Sound.win(); }
  }

  // Escaped critter — no penalty, it just zooms off blowing a raspberry
  function escape(t) {
    if (!targets.has(t)) return;
    targets.delete(t);
    streak = 0; streakEl.textContent = 0;
    t.classList.add('flee');
    Sound.whoosh();
    setTimeout(() => t.remove(), 320);
  }

  function clearTargets() { targets.forEach(t => t.remove()); targets.clear(); }

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
  let speed = 2, rafId = null, over = false;

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
    inner.innerHTML = '';
    blocks = [];
    areaW = area.clientWidth; areaH = area.clientHeight;
    speed = Math.max(1.8, areaW / 150);
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

    if (overlap <= 0) {                 // missed completely — tower falls
      fallaway(mb.x, mb.width, mb.color);
      moving.style.display = 'none';
      gameOver();
      return;
    }
    // overhang slice falls away
    const overhang = mb.width - overlap;
    if (overhang > 1) {
      const hangLeft = (mb.x < left) ? mb.x : right;
      fallaway(hangLeft, overhang, mb.color);
    } else {
      Sound.perfect();
      confettiBurst(30);
    }
    blocks.push({ left, width: overlap });
    renderPlaced(blocks[blocks.length - 1], blocks.length - 1);
    scoreEl.textContent = blocks.length - 1;
    Sound.pop();
    speed = Math.min(7, speed + 0.18);
    if ((blocks.length - 1) % 10 === 0) { confettiBurst(90); Sound.win(); }
    spawnMoving();
  }

  function gameOver() {
    over = true;
    cancelAnimationFrame(rafId);
    Sound.crash();
    const h = blocks.length - 1;
    if (h > best) {
      best = h; bestEl.textContent = best; Store.set('stackBest', best);
      confettiBurst(120); Sound.win();
      msg.textContent = `🏆 NEW RECORD! ${h} blocks! 🏆`;
    } else {
      msg.textContent = `Tower fell at ${h} blocks! Tap to try again 🔁`;
    }
    dropBtn.textContent = 'PLAY AGAIN 🔁';
  }

  dropBtn.addEventListener('click', () => { if (over) reset(); else drop(); });
  area.addEventListener('click', () => { if (over) reset(); else drop(); });

  registerGame('minecraft', {
    enter() { reset(); },
    leave() { over = true; cancelAnimationFrame(rafId); },
  });
})();

/* ============================================================
   BIKES — endless jump runner
   ============================================================ */
(() => {
  const area = $('runArea'), bike = $('bike'), jumpBtn = $('jumpBtn');
  const scoreEl = $('bikeScore'), bestEl = $('bikeBest');
  let best = Store.getNum('bikeBest');
  const GROUND = 26, BIKE_X = 36, BIKE_W = 40;
  let areaW = 0;
  let y = 0, vy = 0, dist = 0, speed = 3, running = false, rafId = null;
  let rocks = [];           // {el, x}
  let coins = [];           // {el, x, y}
  let spawnGap = 0, coinGap = 0;

  bestEl.textContent = best;

  function clearRocks() { rocks.forEach(r => r.el.remove()); rocks = []; }
  function clearCoins() { coins.forEach(c => c.el.remove()); coins = []; }
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
    if (y <= 0.5) { vy = 11; Sound.jump(); Haptics.tap(); }
  }
  function frame() {
    if (!running) return;
    // physics
    vy -= 0.62; y += vy;
    if (y <= 0) { y = 0; vy = 0; }
    bike.style.bottom = (GROUND + y) + 'px';

    // world speed ramps up slowly
    speed = 3 + dist * 0.0016;
    dist += speed * 0.12;
    scoreEl.textContent = Math.floor(dist);

    // move rocks
    for (const r of rocks) { r.x -= speed; r.el.style.left = r.x + 'px'; }
    while (rocks.length && rocks[0].x < -40) { rocks[0].el.remove(); rocks.shift(); }

    // spawn rocks with a clearable gap
    spawnGap -= speed;
    if (spawnGap <= 0) { spawnRock(); spawnGap = rand(150, 280) + speed * 26; }

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
        Sound.pop(); Haptics.tap();
        const ar = area.getBoundingClientRect();
        floatPop(ar.left + BIKE_X + 6, ar.top + 36, '+5 🪙', '#ffd23f');
      }
    }

    // collision (forgiving hitbox)
    for (const r of rocks) {
      if (r.x < BIKE_X + BIKE_W - 8 && r.x + 30 > BIKE_X + 8 && y < 24) { crash(); return; }
    }
    rafId = requestAnimationFrame(frame);
  }
  function start() {
    clearRocks(); clearCoins();
    y = 0; vy = 0; dist = 0; speed = 3; spawnGap = 80; coinGap = 160; running = true;
    bike.style.bottom = GROUND + 'px';
    scoreEl.textContent = 0;
    jumpBtn.textContent = 'JUMP 🦘';
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(frame);
  }
  function crash() {
    running = false;
    cancelAnimationFrame(rafId);
    Sound.crash();
    const m = Math.floor(dist);
    if (m > best) { best = m; bestEl.textContent = best; Store.set('bikeBest', best); confettiBurst(120); Sound.win(); }
    jumpBtn.textContent = 'RUN AGAIN 🔁';
  }

  jumpBtn.addEventListener('click', jump);
  area.addEventListener('click', () => { if (running) jump(); });
  document.querySelectorAll('#ridePick .pick-btn').forEach(b =>
    b.addEventListener('click', () => {
      document.querySelectorAll('#ridePick .pick-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      bike.textContent = b.dataset.ride;
      Sound.pop();
    }));

  registerGame('bikes', {
    enter() { areaW = area.clientWidth; start(); },
    leave() { running = false; cancelAnimationFrame(rafId); clearRocks(); clearCoins(); },
  });
})();

/* ============================================================
   FAMILY — send love (fills the love meter)
   ============================================================ */
(() => {
  const msg = $('loveMsg'), fill = $('loveFill');
  let love = 0;
  document.querySelectorAll('.person').forEach(p => {
    p.addEventListener('click', (e) => {
      msg.textContent = p.dataset.love;
      Sound.pop();
      popFromEvent(e, '💖', '#fff');
      p.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }],
        { duration: 350 }
      );
      love = Math.min(100, love + (p.classList.contains('fav') ? 16 : 11));
      fill.style.width = love + '%';
      if (love >= 100) {
        msg.textContent = "Noah's family is FULL of love! 💖";
        confettiBurst(120); Sound.win();
        love = 0;
        setTimeout(() => { fill.style.width = '0%'; }, 700);
      } else if (p.classList.contains('fav')) {
        confettiBurst(40);
      }
    });
  });
  registerGame('family', { enter() {}, leave() {} });
})();

/* ============================================================
   FRIENDS — high-five all 10 to win a round
   ============================================================ */
(() => {
  const grid = $('friendsGrid'), scoreEl = $('fiveScore'), roundEl = $('friendsRound');
  const faces = ['👦', '👧', '🧒', '👦🏽', '👧🏾', '🧒🏼', '👦🏿', '👧🏻', '🧒🏽', '👦🏼'];
  let total = Store.getNum('fives');
  let round = Store.getNum('friendsRound', 1);
  let done = new Set();

  scoreEl.textContent = total;
  roundEl.textContent = round;

  faces.forEach((face, idx) => {
    const btn = document.createElement('button');
    btn.className = 'friend';
    btn.textContent = face;
    btn.setAttribute('aria-label', 'High five friend');
    btn.addEventListener('click', (e) => {
      btn.classList.remove('fived'); void btn.offsetWidth; btn.classList.add('fived');
      Sound.pop();
      popFromEvent(e, '🙌', '#fff');
      total++; scoreEl.textContent = total; Store.set('fives', total);
      done.add(idx);
      if (done.size === faces.length) {
        confettiBurst(120); Sound.win();
        round++; roundEl.textContent = round; Store.set('friendsRound', round);
        done.clear();
        setTimeout(() => grid.querySelectorAll('.friend').forEach(f => f.classList.remove('fived')), 700);
      }
    });
    grid.appendChild(btn);
  });

  registerGame('friends', {
    enter() { done.clear(); grid.querySelectorAll('.friend').forEach(f => f.classList.remove('fived')); },
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
      msg.textContent = dodges[randInt(0, dodges.length - 1)];
      flee();
      popFromEvent(e, '💨', '#fff');
    }
  });
  // Desktop: book also dodges when the pointer gets close
  book.addEventListener('mouseenter', () => { if (taps % 6 !== 5) flee(); });

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
  confettiBurst(120);
  Sound.win();
}
document.body.addEventListener('click', welcome, { once: true });
document.body.addEventListener('touchstart', welcome, { once: true });

/* Open whatever the URL points at (supports deep links / refresh) */
show(fromHash());

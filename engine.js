/* ============================================
   engine.js — 🔧 B담당 (엔진/시스템)
   게임 루프, 상태머신, 물리, 입력, 스폰, 충돌.
   state 는 엔진이 소유 — render.js 는 읽기만 합니다.
   ============================================ */
'use strict';

// ---------- 월드 상수 ----------
const LANE_X = [-1, 0, 1];     // lane world offsets
const PLAYER_Z = 2.2;          // player depth — pushed toward screen center

// ---------- 게임 상태 (단일 소유: engine) ----------
const state = {
  mode: 'menu',                // 'menu' | 'intro' | 'play'
  running: false, dead: false, introT: 0,
  dist: 0, coins: 0, speed: 16, t: 0,
  lane: 1, laneX: 0,           // current smooth x (in lane units)
  y: 0, vy: 0, jumping: false, jumps: 0,
  sliding: 0,                  // slide timer
  shake: 0, deadT: 0,
  best: +(localStorage.getItem('tr_best') || 0),
};
let obstacles = [];  // {z, lane, type}  type: 'log'|'bar'|'wall'
let coinsArr = [];   // {z, lane, y}
let decos = [];      // side decorations {z, side, kind}
let nextSpawnZ = 30;
let nextDecoZ = 2;

// ---------- 리셋 / 스폰 ----------
function reset() {
  state.dist = 0; state.coins = 0; state.speed = 16; state.t = 0;
  state.lane = 1; state.laneX = 0; state.y = 0; state.vy = 0;
  state.jumping = false; state.jumps = 0; state.sliding = 0; state.dead = false;
  state.shake = 0; state.deadT = 0;
  obstacles = []; coinsArr = []; decos = [];
  nextSpawnZ = 30; nextDecoZ = 2;
  for (let z = 2; z < DRAW_FAR; z += 2.2) spawnDeco(z);
  nextDecoZ = DRAW_FAR;
}

function spawnDeco(z) {
  for (const side of [-1, 1]) {
    if (Math.random() < 0.75) {
      decos.push({ z, side, kind: Math.random() < 0.22 ? 'lamp' : (Math.random() < 0.5 ? 'tree' : 'bush') });
    }
  }
}

function spawnPattern(z) {
  const r = Math.random();
  const lanes = [0, 1, 2];
  if (r < 0.3) {
    // single wall — dodge sideways
    const l = lanes[(Math.random() * 3) | 0];
    obstacles.push({ z, lane: l, type: 'wall' });
  } else if (r < 0.5) {
    // two walls, one gap
    const gap = (Math.random() * 3) | 0;
    lanes.filter(l => l !== gap).forEach(l => obstacles.push({ z, lane: l, type: 'wall' }));
    for (let i = 0; i < 3; i++) coinsArr.push({ z: z + 2 + i * 1.4, lane: gap, y: 0 });
  } else if (r < 0.72) {
    // full-width log — jump
    lanes.forEach(l => obstacles.push({ z, lane: l, type: 'log' }));
    const cl = (Math.random() * 3) | 0;
    for (let i = 0; i < 4; i++) coinsArr.push({ z: z - 1.2 + i * 1.1, lane: cl, y: [0, .45, .6, .45][i] || 0 });
  } else if (r < 0.9) {
    // full-width overhead bar — slide
    lanes.forEach(l => obstacles.push({ z, lane: l, type: 'bar' }));
  } else {
    // coin trail
    const cl = (Math.random() * 3) | 0;
    for (let i = 0; i < 6; i++) coinsArr.push({ z: z + i * 1.3, lane: cl, y: 0 });
  }
}

// ---------- 입력 ----------
function moveLane(d) {
  if (!state.running || state.dead) return;
  const nl = Math.min(2, Math.max(0, state.lane + d));
  if (nl !== state.lane) { state.lane = nl; sfx.lane(); }
}
function doJump() {
  if (!state.running || state.dead) return;
  if (!state.jumping) {
    state.jumping = true; state.jumps = 1; state.vy = 1.55; state.sliding = 0; sfx.jump();
  } else if (state.jumps === 1) { // double jump!
    state.jumps = 2; state.vy = 1.45; sfx.jump2();
  }
}
function doSlide() {
  if (!state.running || state.dead) return;
  if (state.jumping) { state.vy = -2.6; } // fast-fall into slide
  state.sliding = 0.62; sfx.slide();
}
window.addEventListener('keydown', e => {
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
  if (state.mode === 'intro') { startPlay(); return; }
  if (!state.running && (e.key === ' ' || e.key === 'Enter')) { startBtn.click(); return; }
  if (e.key === 'ArrowLeft' || e.key === 'a') moveLane(-1);
  else if (e.key === 'ArrowRight' || e.key === 'd') moveLane(1);
  else if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w') doJump();
  else if (e.key === 'ArrowDown' || e.key === 's') doSlide();
});
let tsx = 0, tsy = 0, tst = 0;
window.addEventListener('touchstart', e => {
  const t = e.touches[0]; tsx = t.clientX; tsy = t.clientY; tst = performance.now();
}, { passive: true });
canvas.addEventListener('pointerdown', () => { if (state.mode === 'intro') startPlay(); });
window.addEventListener('touchend', e => {
  if (state.mode === 'intro') { startPlay(); return; }
  const t = e.changedTouches[0];
  const dx = t.clientX - tsx, dy = t.clientY - tsy;
  if (performance.now() - tst > 600) return;
  if (Math.abs(dx) < 24 && Math.abs(dy) < 24) { doJump(); return; }
  if (Math.abs(dx) > Math.abs(dy)) moveLane(dx > 0 ? 1 : -1);
  else (dy < 0 ? doJump() : doSlide());
}, { passive: true });

// ---------- 상태머신 / 업데이트 ----------
function startPlay() {
  state.mode = 'play';
  state.running = true;
}
function updateIntro(dt) {
  state.t += dt;
  state.introT += dt;
  const T = state.introT;
  if (T > 2.1) { // world starts scrolling as PooPoo flees
    const sp = Math.min(16, (T - 2.1) * 12);
    const dz = sp * dt;
    for (const d of decos) d.z -= dz;
    decos = decos.filter(d => d.z > -2);
    nextDecoZ -= dz;
    while (nextDecoZ < DRAW_FAR) { spawnDeco(DRAW_FAR); nextDecoZ += 2.2; }
  }
  if (T >= 3.7) startPlay();
}
function update(dt) {
  if (state.mode === 'intro') { updateIntro(dt); return; }
  if (!state.running) return;
  state.t += dt;
  if (state.dead) {
    state.deadT += dt;
    state.shake = Math.max(0, state.shake - dt * 30);
    if (state.deadT > 1.1) gameOver();
    return;
  }
  state.speed = Math.min(46, 16 + state.t * 0.45);
  const dz = state.speed * dt;
  state.dist += dz;

  // lane smoothing
  const target = LANE_X[state.lane];
  state.laneX += (target - state.laneX) * Math.min(1, dt * 12);

  // jump physics
  if (state.jumping) {
    state.y += state.vy * dt * 2.4;
    state.vy -= dt * 7.2;
    if (state.y <= 0) { state.y = 0; state.jumping = false; state.jumps = 0; state.vy = 0; }
  }
  if (state.sliding > 0) state.sliding -= dt;

  // advance world
  for (const o of obstacles) o.z -= dz;
  for (const c of coinsArr) c.z -= dz;
  for (const d of decos) d.z -= dz;
  obstacles = obstacles.filter(o => o.z > -3);
  coinsArr = coinsArr.filter(c => c.z > -2 && !c.got);
  decos = decos.filter(d => d.z > -2);

  nextSpawnZ -= dz; nextDecoZ -= dz;
  while (nextSpawnZ < DRAW_FAR) {
    spawnPattern(DRAW_FAR + (DRAW_FAR - nextSpawnZ));
    nextSpawnZ += 16 + Math.random() * 10 + state.speed * 0.35; // breathing room between patterns
  }
  while (nextDecoZ < DRAW_FAR) { spawnDeco(DRAW_FAR); nextDecoZ += 2.2; }

  // collisions (player at z≈PLAYER_Z)
  for (const o of obstacles) {
    if (o.z > PLAYER_Z - 0.8 && o.z < PLAYER_Z + 0.7 && Math.abs(LANE_X[o.lane] - state.laneX) < 0.55) {
      let hit = false;
      if (o.type === 'log') hit = state.y < 0.3;
      else if (o.type === 'bar') hit = state.sliding <= 0 && state.y < 0.75;
      else hit = state.y < 1.0;
      if (hit) { die(); return; }
    }
  }
  for (const c of coinsArr) {
    if (!c.got && c.z > PLAYER_Z - 1.0 && c.z < PLAYER_Z + 1.0 &&
        Math.abs(LANE_X[c.lane] - state.laneX) < 0.5 &&
        Math.abs((c.y || 0) - state.y) < 0.5) {
      c.got = true; state.coins++; sfx.coin();
    }
  }
  updateHUD(state.dist, state.coins);
}

function die() {
  state.dead = true; state.shake = 1; sfx.crash();
  if (navigator.vibrate) navigator.vibrate(150);
}

// ---------- 게임 루프 ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
reset();
requestAnimationFrame(frame);

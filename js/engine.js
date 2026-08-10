/* ============================================
   engine.js — 🔧 B담당 (엔진/시스템)
   게임 루프, 상태머신, 물리, 입력, 스폰, 충돌.
   state 는 엔진이 소유 — render.js 는 읽기만 합니다.
   ============================================ */
'use strict';

// ---------- 월드 상수 ----------
const LANE_X = [-1, 0, 1];     // lane world offsets
const PLAYER_Z = 2.2;          // player depth — pushed toward screen center
const MAX_LIVES = 3;           // 시작 목숨
const INVULN_TIME = 2.0;       // 부활 후 무적 시간(초)

// ---------- 점프 밸런스 ----------
// 도달 높이 = 1.2 * v² / GRAVITY  (아래 update()의 적분식에서 유도)
//   1단(2.1) → 0.67 : 벤치(0.30)는 넘고 화분(0.73)은 못 넘음
//   2단      → 누른 시점과 상관없이 항상 JUMP2_PEAK 까지. 화분은 넘되 현수막 천보다는 낮게
//              (속도를 고정하면 언제 눌렀냐에 따라 정점이 0.5~1.4로 널뛰어 기준을 잡을 수 없다)
// 판정 구간(z 폭 1.5)을 지나는 동안 높이가 오르내리므로, 기준선은 그 구간의 최저점보다
// 넉넉히 아래에 둬야 "정점은 넘었는데 끝자락에서 걸리는" 일이 없다.
const GRAVITY    = 8.5;
const JUMP_V1    = 1.75;       // 1단 점프 → 정점 0.45~0.54 (프레임레이트에 따라, 아래 참고)
const JUMP2_PEAK = 0.9;        // 2단 점프 도달 높이(고정). 현수막 천 윗단(y≈1.03)보다 낮게
const H_BENCH    = 0.25;       // 나무의자 — 1단 점프로 통과
// 화분 — 1단으로는 못 넘고 2단이라야 통과.
// ⚠️ 오일러 적분이라 dt가 커질수록 1단 정점이 올라간다(실측):
//    120fps 0.450 · 60fps 0.468 · 30fps 0.504 · 20fps 0.540 (dt 상한 0.05가 최악값)
//    0.55 로 두면 저프레임에서 여유가 0.01(2%)밖에 없어 사실상 넘길락 말락 한다.
//    최악값 0.540 위로 넉넉히, 2단 정점(0.951) 아래로 충분히 → 0.62
const H_PLANT    = 0.62;

// ---------- 휴지 투척 밸런스 ----------
const THROW_WARN  = 0.9;       // 빨간 경고 박스가 먼저 떠 있는 시간(초)
const THROW_SPEED = 3.0;       // 날아오는 속도 — 총 예고 시간 약 1.9초

// ---------- 게임 상태 (단일 소유: engine) ----------
const state = {
  mode: 'menu',                // 'menu' | 'intro' | 'play'
  running: false, dead: false, introT: 0,
  dist: 0, coins: 0, speed: 16, t: 0,
  lives: MAX_LIVES,            // 남은 목숨
  invuln: 0,                   // 부활 직후 무적 타이머
  hurtT: 0,                    // 피격 연출 타이머
  lane: 1, laneX: 0,           // current smooth x (in lane units)
  y: 0, vy: 0, jumping: false, jumps: 0,
  sliding: 0,                  // slide timer
  shake: 0, deadT: 0,
  best: +(localStorage.getItem('poopoo_best_score') || 0),
};
let obstacles = [];  // {z, lane, type}  type: 'log'|'bar'|'wall'
let coinsArr = [];   // {z, lane, y}
let decos = [];      // side decorations {z, side, kind}
let throwsArr = [];  // 추격자가 던진 휴지 {z, lane, age, y}
let nextSpawnZ = 30;
let nextDecoZ = 2;
let nextThrowT = 3;  // 다음 휴지 투척 시각 (state.t 기준)
let lastStepIdx = 0; // 발소리를 다리 애니메이션에 맞추기 위한 걸음 번호

// ---------- 리셋 / 스폰 ----------
function reset() {
  state.dist = 0; state.coins = 0; state.speed = 16; state.t = 0;
  state.lane = 1; state.laneX = 0; state.y = 0; state.vy = 0;
  state.jumping = false; state.jumps = 0; state.sliding = 0; state.dead = false;
  state.shake = 0; state.deadT = 0;
  state.lives = MAX_LIVES; state.invuln = 0; state.hurtT = 0;
  obstacles = []; coinsArr = []; decos = []; throwsArr = [];
  nextSpawnZ = 30; nextDecoZ = 2; nextThrowT = 3; lastStepIdx = 0;
  let dz0 = 2;
  for (; dz0 < DRAW_FAR; dz0 += 2.2) spawnDeco(dz0);
  nextDecoZ = dz0;          // 초기 배치의 격자를 그대로 이어받아야 줄 간격이 안 어긋난다
}

/* [데코] 산책로 양옆 "줄 맞춤" 배치 (장식 전용 · 충돌/게임플레이 무관)
   종류마다 도로 중심에서의 거리(밴드)를 고정한다 → 원근 때문에 지평선 한 점으로 수렴하는
   곧은 줄이 되어 가로수길처럼 보인다. 위치·크기·좌우·종류를 전부 카운터 t 로 결정하는 게 핵심:
   난수를 쓰면 같은 종류가 제각각 흩어져(예전 x 가 2.6~3.2 사이 랜덤) 줄이 무너지고 산만해진다.
     ⚠️ 도로 가장자리는 |x| = 1/0.62 ≈ 1.61 (screenPos 의 0.62 계수) → 모든 밴드는 그 바깥에 둔다.
     ⚠️ z 도 흔들지 않는다. 예전 zJ() 가 ±2.2 범위로 흩뿌려 깊이 방향 줄도 어긋나 있었다.
   obstacles/충돌/스폰규칙 등 게임 로직은 전혀 건드리지 않는다(장식 배열 decos 만 채움). */
const DECO_BAND = {          // 도로 중심에서의 거리 — 가까운 것부터 바깥으로
  edge: 1.63,   // 꽃·잔디의 "안쪽 끝"이 놓일 선 (중심이 아님 — 아래 DECO_INSET 참고)
  lamp: 2.00,   // 가로등
  prop: 2.35,   // 쓰레기통
  bird: 2.65,   // 비둘기
  tree: 3.05,   // 가로수
  far:  4.35,   // 먼 나무 (깊이감용)
};
/* 꽃·잔디는 스프라이트 폭이 제각각(레인 단위 0.56~1.20)이라 중심을 같은 밴드에 두면
   넓은 풀숲만 도로 안으로 파고든다(grass2 는 안쪽 끝이 1.18 까지 들어와 레인을 침범했다).
   그래서 "중심"이 아니라 "안쪽 끝"을 DECO_BAND.edge 선에 맞춘다 → 길가에 곧은 화단 띠가 된다.
   값 = 스프라이트 중심에서 안쪽 끝까지의 거리(레인 단위, 알파 실측 · 원근과 무관한 상수).
   ⚠️ hf(크기)를 바꾸면 이 값도 같이 바뀌므로 다시 재야 한다.
   (도로 가장자리 = 1/0.62 ≈ 1.613, 주행 레인 바깥 경계 = 1.5) */
const DECO_INSET = {
  flower1: 0.352, flower2: 0.333, flower3: 0.265, flower4: 0.552, flower5: 0.512,
  grass1: 0.444, grass2: 0.604,
};
function spawnDeco(zBase) {
  const FLW = ['flower1', 'flower2', 'flower3', 'flower4', 'flower5'];
  const GRS = ['grass1', 'grass2'];
  const TREES = ['tree1', 'tree2', 'tree3', 'tree4'];
  const B = DECO_BAND;
  const z = zBase;                                      // 흔들지 않음 — 호출 간격(2.2z)이 곧 줄 간격
  const t = (spawnDeco._t = (spawnDeco._t || 0) + 1);   // 배치 리듬용 카운터(장식 전용)

  // ── 꽃·잔디: 길 가장자리를 따라 좌우 대칭으로 이어지는 화단 띠 (4.4z 간격) ──
  //   중심이 아니라 "안쪽 끝"을 B.edge 선에 맞춰 폭이 다른 스프라이트끼리도 줄이 맞는다.
  //   좌측 사본은 flip 하므로 좌우가 정확히 거울 대칭이 되고 안쪽 끝도 같은 선에 놓인다.
  if (t % 2 === 0) {
    const k = t >> 1;
    const flower = k % 2 === 0;
    const img = flower ? FLW[k % FLW.length] : GRS[k % GRS.length];
    const cx = B.edge + (DECO_INSET[img] || 0);
    for (const s of [-1, 1])
      decos.push({ z, kind: 'img', img, x: s * cx, hf: flower ? 0.15 : 0.16, flip: s < 0 });
  }
  // ── 가로등: 좌우 번갈아 (한쪽 기준 ≈17.6z) ──
  if (t % 4 === 1) {
    const left = t % 8 === 1;
    decos.push({ z, kind: 'img', img: left ? 'lamp1' : 'lamp2', x: (left ? 1 : -1) * B.lamp, hf: 0.64 });
  }
  // ── 가로수: 좌우 번갈아 (한쪽 기준 ≈13.2z) · 종류는 순서대로 순환 ──
  if (t % 3 === 0) {
    const s = (t % 6 === 0) ? -1 : 1;
    decos.push({ z, kind: 'img', img: TREES[((t / 3) | 0) % TREES.length], x: s * B.tree, hf: 0.66, flip: s < 0 });
  }
  // ── 먼 나무: 바깥 밴드에 작게, 아주 가끔 (≈19.8z) → 깊이감만 ──
  if (t % 9 === 4) {
    const s = (t % 18 === 4) ? 1 : -1;
    decos.push({ z, kind: 'img', img: TREES[((t / 9) | 0) % TREES.length], x: s * B.far, hf: 0.45, flip: s < 0 });
  }
  // ── 장식용 벤치는 두지 않는다: 점프로 넘는 '장애물 벤치'(obstacle_bench.png)와 생김새가 겹쳐
  //    길가의 벤치를 피해야 할 장애물로 착각하게 만든다. bench1/bench2 스프라이트는 미사용.
  // ── 쓰레기통 (≈48.4z) ──
  if (t % 11 === 6) {
    const s = (t % 22 === 6) ? 1 : -1;
    decos.push({ z, kind: 'img', img: 'trash', x: s * B.prop, hf: 0.20 });
  }
  // ── 비둘기 (≈57.2z) ──
  if (t % 13 === 5) {
    const s = (t % 26 === 5) ? -1 : 1;
    decos.push({ z, kind: 'img', img: s < 0 ? 'pigeon1' : 'pigeon3', x: s * B.bird, hf: 0.14, flip: s > 0 });
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
    state.jumping = true; state.jumps = 1; state.vy = JUMP_V1; state.sliding = 0; sfx.jump();
  } else if (state.jumps === 1) { // double jump!
    // 현재 높이에서 JUMP2_PEAK 까지 딱 닿을 만큼의 속도를 준다 → 정점이 항상 일정
    const need = Math.max(0, JUMP2_PEAK - state.y);
    state.jumps = 2; state.vy = Math.sqrt(need * GRAVITY / 1.2); sfx.jump2();
  }
}
function doSlide() {
  if (!state.running || state.dead) return;
  // 키를 꾹 누르면 keydown 이 자동 반복되므로, 이미 미끄러지는 중이면 소리를 다시 내지 않는다
  const already = state.sliding > 0;
  if (state.jumping) { state.vy = -2.6; } // fast-fall into slide
  state.sliding = 0.62;
  if (!already) sfx.slide();
}
window.addEventListener('keydown', e => {
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
  if (e.key === 'm' || e.key === 'M') { bgm.toggle(); return; }   // 배경음악 켜기/끄기
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
  nextThrowT = state.t + 4; // 게임 시작 직후엔 던지지 않도록 여유
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
    while (nextDecoZ < DRAW_FAR) { spawnDeco(nextDecoZ); nextDecoZ += 2.2; }
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
    if (state.deadT > 1.6) gameOver(); // 게임오버 음악이 화음으로 넘어갈 때 UI 등장
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
    state.vy -= dt * GRAVITY;
    if (state.y <= 0) {           // 착지
      state.y = 0; state.jumping = false; state.jumps = 0; state.vy = 0;
      sfx.land();
    }
  }
  if (state.sliding > 0) state.sliding -= dt;

  // 발소리 — render의 다리 애니메이션(state.t * 13)과 같은 위상으로 한 걸음씩
  const stepIdx = Math.floor(state.t * 13 / Math.PI);
  if (state.jumping || state.sliding > 0) {
    lastStepIdx = stepIdx;        // 공중/슬라이딩 중엔 발소리 없음
  } else if (stepIdx !== lastStepIdx) {
    lastStepIdx = stepIdx;
    sfx.step();
  }
  if (state.invuln > 0) state.invuln -= dt;
  if (state.hurtT > 0) state.hurtT -= dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 3);

  // advance world
  // zPrev = 이번 프레임에 이동하기 직전 위치. 아래 충돌 판정에서 "지나간 구간"을 훑는 데 쓴다.
  for (const o of obstacles) { o.zPrev = o.z; o.z -= dz; }
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
  while (nextDecoZ < DRAW_FAR) { spawnDeco(nextDecoZ); nextDecoZ += 2.2; }

  // collisions (player at z≈PLAYER_Z) — 무적 중에는 통과
  // ⚠️ 판정 창(폭 1.5)을 "현재 z"로만 보면, 한 프레임 이동량 dz 가 창보다 커질 때
  //    장애물이 창을 통째로 건너뛰어 충돌이 아예 검사되지 않는다(터널링).
  //    dz = speed*dt 이고 dt 상한이 0.05, 후반 speed 46 → dz 2.3 > 1.5 이라 실제로 발생한다.
  //    (실측: 20fps·speed 43 에서 위상에 따라 60번 중 13번이 그냥 통과됨 — 점프 여부와 무관)
  //    그래서 zPrev→z 로 지나간 구간이 창과 겹치는지로 판정한다.
  if (state.invuln <= 0) {
    for (const o of obstacles) {
      const zPrev = o.zPrev ?? o.z;   // 갓 스폰된 장애물은 아직 zPrev 가 없다(멀리 있어 무해하지만 안전하게)
      if (o.z < PLAYER_Z + 0.7 && zPrev > PLAYER_Z - 0.8 && Math.abs(LANE_X[o.lane] - state.laneX) < 0.55) {
        let hit = false;
        if (o.type === 'log') hit = state.y < H_BENCH;          // 나무의자 — 1단 점프
        else if (o.type === 'bar') hit = state.sliding <= 0;    // 현수막 — 오직 슬라이딩
        else hit = state.y < H_PLANT;                           // 화분 — 2단 점프
        if (hit) { hitPlayer(); break; } // respawn()이 배열을 갈아끼우므로 즉시 중단
      }
    }
    if (state.dead) return;
  }
  for (const c of coinsArr) {
    if (!c.got && c.z > PLAYER_Z - 1.0 && c.z < PLAYER_Z + 1.0 &&
        Math.abs(LANE_X[c.lane] - state.laneX) < 0.5 &&
        Math.abs((c.y || 0) - state.y) < 0.5) {
      c.got = true; state.coins++; sfx.coin();
    }
  }

  // 추격자의 휴지 투척!
  // 먼저 해당 레인에 빨간 경고 박스를 띄우고(THROW_WARN), 그 뒤에 실제로 날아온다.
  // 경고 + 비행 시간을 합쳐 약 1.9초 — 그 사이에 레인을 옮기거나 점프해서 피하면 된다.
  if (state.t > nextThrowT) {
    nextThrowT = state.t + Math.max(2.2, 5.5 - state.t * 0.03) + Math.random() * 2;
    throwsArr.push({ z: -0.9, lane: state.lane, age: 0, y: 0, warn: THROW_WARN });
    sfx.throw();
  }
  let tpHit = false;
  for (const th of throwsArr) {
    if (th.warn > 0) { th.warn -= dt; continue; }   // 아직 경고 단계 — 날아오지 않음
    th.age += dt;
    th.z += THROW_SPEED * dt; // 플레이어 기준 상대 속도로 전진
    th.y = Math.abs(Math.sin(th.age * 9)) * Math.max(0, 0.45 - th.age * 0.22); // 통통 튀며 굴러옴
    if (!tpHit && state.invuln <= 0 &&
        th.z > PLAYER_Z - 0.5 && th.z < PLAYER_Z + 0.5 &&
        Math.abs(LANE_X[th.lane] - state.laneX) < 0.5 && state.y < 0.3) {
      tpHit = true;
    }
  }
  throwsArr = throwsArr.filter(th => th.z < 14);
  if (tpHit) { hitPlayer(); if (state.dead) return; }

  updateHUD(state.dist, state.coins);
}

// ---------- 피격 / 부활 / 사망 ----------
function hitPlayer() {
  if (state.dead || state.invuln > 0) return;
  state.lives--;
  state.shake = 1;
  if (navigator.vibrate) navigator.vibrate(state.lives > 0 ? 90 : 150);
  if (state.lives > 0) {
    state.hurtT = 0.6;
    state.invuln = INVULN_TIME;
    sfx.hurt();
    respawn();
  } else {
    // 게임오버 연출: 마지막 목숨이 닳는 소리 → 게임오버 음악
    bgm.stop(700);   // 배경음악을 걷어내야 게임오버 음악이 묻히지 않는다
    sfx.hurt();
    setTimeout(() => sfx.gameOver(), 600);
    state.dead = true; // deadT가 쌓이면 gameOver() 호출
  }
  updateLives(state.lives);
}

// 목숨이 남았을 때: 가운데 차선(시작 위치)에서 다시 달린다
function respawn() {
  state.lane = 1;
  state.y = 0; state.vy = 0;
  state.jumping = false; state.jumps = 0; state.sliding = 0;
  // 부활 직후 즉사하지 않도록 앞쪽 위험물 정리
  obstacles = obstacles.filter(o => o.z > PLAYER_Z + 7);
  throwsArr = [];
  nextThrowT = state.t + 3;
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

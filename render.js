/* ============================================
   render.js — 🎨 A담당 (디자인/연출)
   모든 그리기 함수. 여기서 게임의 "보이는 것" 전부를 담당.
   규칙:
   - state / obstacles / coinsArr / decos 는 읽기만! 절대 수정 금지 (엔진 소유)
   - 좌표 변환은 view.js 의 screenPos() 사용
   ============================================ */
'use strict';

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- 배경 ----------
function drawSky() {
  const hy = horizonY();
  const g = ctx.createLinearGradient(0, 0, 0, hy * 1.25);
  g.addColorStop(0, '#5fb2ef'); g.addColorStop(0.7, '#a8d9f7'); g.addColorStop(1, '#e3f4ff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, hy * 1.25);
  // sun
  ctx.fillStyle = 'rgba(255,245,190,0.95)';
  ctx.beginPath(); ctx.arc(W * 0.82, hy * 0.3, Math.min(W, H) * 0.05, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,240,160,0.3)';
  ctx.beginPath(); ctx.arc(W * 0.82, hy * 0.3, Math.min(W, H) * 0.1, 0, 7); ctx.fill();
  // drifting clouds
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  for (let i = 0; i < 5; i++) {
    const cw = Math.min(W, H) * (0.09 + (i % 3) * 0.03);
    const cx = ((i * 231 + state.t * (10 + i * 3)) % (W + cw * 4)) - cw * 2;
    const cy = hy * (0.14 + ((i * 53) % 4) * 0.16);
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw, cw * 0.38, 0, 0, 7);
    ctx.ellipse(cx - cw * 0.6, cy + cw * 0.1, cw * 0.6, cw * 0.28, 0, 0, 7);
    ctx.ellipse(cx + cw * 0.6, cy + cw * 0.12, cw * 0.55, cw * 0.26, 0, 0, 7);
    ctx.fill();
  }
  // distant tree lines (two layers)
  ctx.fillStyle = '#8fc47e';
  ctx.beginPath(); ctx.moveTo(0, hy + 4);
  for (let x = 0; x <= W; x += 48) {
    ctx.quadraticCurveTo(x + 24, hy - 26 - 10 * Math.abs(Math.sin(x * 0.31)), x + 48, hy + 4);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#5da24c';
  ctx.beginPath(); ctx.moveTo(0, hy + 4);
  for (let x = -20; x <= W; x += 38) {
    ctx.quadraticCurveTo(x + 19, hy - 14 - 8 * Math.abs(Math.sin(x * 0.53)), x + 38, hy + 4);
  }
  ctx.closePath(); ctx.fill();
}

function drawGround() {
  const hy = horizonY();
  // grass sides
  const gg = ctx.createLinearGradient(0, hy, 0, H);
  gg.addColorStop(0, '#79bd50'); gg.addColorStop(1, '#3f8a26');
  ctx.fillStyle = gg; ctx.fillRect(0, hy, W, H - hy);
  // park walkway as trapezoid
  const near = screenPos(0, 0), far = screenPos(0, DRAW_FAR);
  const halfN = near.roadHalfNear, halfF = halfN * proj(DRAW_FAR);
  const rg = ctx.createLinearGradient(0, hy, 0, H);
  rg.addColorStop(0, '#b7ad98'); rg.addColorStop(1, '#d8cfba');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.moveTo(W / 2 - halfF, far.y); ctx.lineTo(W / 2 + halfF, far.y);
  ctx.lineTo(W / 2 + halfN, near.y); ctx.lineTo(W / 2 - halfN, near.y);
  ctx.closePath(); ctx.fill();
  // cross seams scrolling
  ctx.strokeStyle = 'rgba(120,110,90,0.55)';
  const off = state.dist % 3;
  for (let z = 3 - off; z < DRAW_FAR; z += 3) {
    const p = screenPos(0, z), hw = halfN * p.f;
    ctx.lineWidth = Math.max(1, 3 * p.f);
    ctx.beginPath(); ctx.moveTo(W / 2 - hw, p.y); ctx.lineTo(W / 2 + hw, p.y); ctx.stroke();
  }
  // lane divider lines
  ctx.strokeStyle = 'rgba(120,110,90,0.45)';
  for (const lx of [-0.5, 0.5]) {
    ctx.lineWidth = 2;
    const a = screenPos(lx, 0.01), b = screenPos(lx, DRAW_FAR);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  // walkway edges
  ctx.strokeStyle = '#8a8170'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(W / 2 - halfF, far.y); ctx.lineTo(W / 2 - halfN, near.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W / 2 + halfF, far.y); ctx.lineTo(W / 2 + halfN, near.y); ctx.stroke();
}

// ---------- 길가 장식 (나무/가로등/꽃덤불) ----------
function drawDeco(d) {
  const p = screenPos(d.side * 1.9, d.z);
  const s = p.f * Math.min(W, H);
  if (s < 4) return;
  if (d.kind === 'tree') {
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(p.x - s * 0.025, p.y - s * 0.32, s * 0.05, s * 0.32);
    ctx.fillStyle = '#3e8f2e';
    ctx.beginPath();
    ctx.arc(p.x, p.y - s * 0.42, s * 0.14, 0, 7);
    ctx.arc(p.x - s * 0.1, p.y - s * 0.33, s * 0.1, 0, 7);
    ctx.arc(p.x + s * 0.1, p.y - s * 0.33, s * 0.1, 0, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath(); ctx.arc(p.x - s * 0.04, p.y - s * 0.47, s * 0.07, 0, 7); ctx.fill();
  } else if (d.kind === 'lamp') {
    ctx.fillStyle = '#3d4a44';
    ctx.fillRect(p.x - s * 0.014, p.y - s * 0.46, s * 0.028, s * 0.46);
    ctx.fillRect(p.x - s * 0.035, p.y - s * 0.02, s * 0.07, s * 0.02);
    const gg = ctx.createRadialGradient(p.x, p.y - s * 0.5, 0, p.x, p.y - s * 0.5, s * 0.09);
    gg.addColorStop(0, 'rgba(255,250,220,0.75)'); gg.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(p.x, p.y - s * 0.5, s * 0.09, 0, 7); ctx.fill();
    ctx.fillStyle = '#f3f6ef';
    ctx.beginPath(); ctx.arc(p.x, p.y - s * 0.5, s * 0.04, 0, 7); ctx.fill();
    ctx.fillStyle = '#3d4a44';
    ctx.beginPath(); ctx.arc(p.x, p.y - s * 0.55, s * 0.016, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = '#2f7a28';
    ctx.beginPath();
    ctx.arc(p.x - s * 0.06, p.y - s * 0.045, s * 0.06, 0, 7);
    ctx.arc(p.x + s * 0.02, p.y - s * 0.07, s * 0.075, 0, 7);
    ctx.arc(p.x + s * 0.09, p.y - s * 0.04, s * 0.055, 0, 7);
    ctx.fill();
    const fc = ['#ff7fb2', '#ffd23e', '#ff5d5d'];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = fc[i];
      ctx.beginPath();
      ctx.arc(p.x + (i - 1) * s * 0.06, p.y - s * (0.07 + (i % 2) * 0.035), s * 0.014, 0, 7);
      ctx.fill();
    }
  }
}

// ---------- 장애물 (벤치/현수막/덤불 울타리) ----------
function drawObstacle(o) {
  const p = screenPos(LANE_X[o.lane], o.z);
  const s = p.f * Math.min(W, H);
  if (s < 3) return;
  const w = s * 0.34;
  if (o.type === 'log') { // park bench — jump over
    ctx.fillStyle = '#2e5e46';
    ctx.fillRect(p.x - w / 2 + s * 0.02, p.y - s * 0.065, s * 0.018, s * 0.065);
    ctx.fillRect(p.x + w / 2 - s * 0.038, p.y - s * 0.065, s * 0.018, s * 0.065);
    ctx.fillStyle = '#b0793f';
    roundRect(p.x - w / 2, p.y - s * 0.085, w, s * 0.034, s * 0.01); ctx.fill();
    roundRect(p.x - w / 2, p.y - s * 0.15, w, s * 0.026, s * 0.01); ctx.fill();
    roundRect(p.x - w / 2, p.y - s * 0.117, w, s * 0.026, s * 0.01); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(p.x - w / 2, p.y - s * 0.15, w, s * 0.008, s * 0.004); ctx.fill();
  } else if (o.type === 'bar') { // event banner — slide under
    ctx.fillStyle = '#8a5a2e';
    ctx.fillRect(p.x - w / 2 - s * 0.035, p.y - s * 0.36, s * 0.028, s * 0.36);
    ctx.fillRect(p.x + w / 2 + s * 0.007, p.y - s * 0.36, s * 0.028, s * 0.36);
    ctx.fillStyle = '#e2554f';
    roundRect(p.x - w / 2 - s * 0.05, p.y - s * 0.35, w + s * 0.1, s * 0.165, s * 0.02); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    roundRect(p.x - w / 2 - s * 0.05, p.y - s * 0.35, w + s * 0.1, s * 0.04, s * 0.02); ctx.fill();
    if (s > 130) {
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${s * 0.05}px 'Segoe UI', sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('공원 마라톤', p.x, p.y - s * 0.265);
    }
  } else { // hedge fence — dodge sideways
    ctx.fillStyle = '#8a8170';
    ctx.fillRect(p.x - w / 2, p.y - s * 0.125, w, s * 0.025);
    ctx.fillStyle = '#2f7a28';
    ctx.beginPath();
    ctx.arc(p.x - w * 0.33, p.y - s * 0.145, s * 0.07, 0, 7);
    ctx.arc(p.x, p.y - s * 0.175, s * 0.082, 0, 7);
    ctx.arc(p.x + w * 0.33, p.y - s * 0.145, s * 0.07, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#3e9a35';
    ctx.beginPath();
    ctx.arc(p.x - w * 0.18, p.y - s * 0.19, s * 0.045, 0, 7);
    ctx.arc(p.x + w * 0.2, p.y - s * 0.182, s * 0.042, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#5f564a';
    ctx.fillRect(p.x - w / 2, p.y - s * 0.1, w, s * 0.1);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = Math.max(1, s * 0.008);
    for (let i = 0; i < 4; i++) {
      const vx = p.x - w / 2 + w * (0.14 + i * 0.24);
      ctx.beginPath(); ctx.moveTo(vx, p.y - s * 0.1); ctx.lineTo(vx, p.y); ctx.stroke();
    }
  }
}

// ---------- 아이템 (두루마리 휴지) ----------
function drawCoin(c) {
  const p = screenPos(LANE_X[c.lane], c.z, (c.y || 0) + 0.28 + Math.sin(state.t * 6 + c.z) * 0.03);
  const s = p.f * Math.min(W, H) * 0.05;
  if (s < 1.5) return;
  const squish = Math.max(0.3, Math.abs(Math.sin(state.t * 4 + c.z * 0.8)));
  ctx.fillStyle = '#cdd6dc';
  ctx.beginPath(); ctx.ellipse(p.x, p.y, s * squish, s, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#f7fafc';
  ctx.beginPath(); ctx.ellipse(p.x - s * 0.12, p.y, s * squish * 0.85, s * 0.88, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#aeb9c0';
  ctx.beginPath(); ctx.ellipse(p.x - s * 0.12, p.y, s * squish * 0.32, s * 0.34, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#f7fafc';
  ctx.fillRect(p.x - s * 0.05, p.y + s * 0.65, s * 0.75, s * 0.32);
}

// ---------- 변기 캐릭터 '푸푸' ----------
// glossy ceramic toilet, back view (origin = feet)
function drawToiletBack(u, run, tuck, dead) {
  ctx.lineCap = 'round';
  // little running legs
  ctx.strokeStyle = '#3c3c46'; ctx.lineWidth = u * 0.55;
  const legA = Math.sin(run) * 1.0;
  ctx.beginPath();
  if (tuck) {
    ctx.moveTo(-u * 0.7, -u * 0.9); ctx.lineTo(-u * 1.1, -u * 0.2);
    ctx.moveTo(u * 0.7, -u * 0.9); ctx.lineTo(u * 1.1, -u * 0.2);
  } else {
    ctx.moveTo(-u * 0.6, -u * 0.9); ctx.lineTo(-u * 0.6 + Math.sin(legA) * u, 0);
    ctx.moveTo(u * 0.6, -u * 0.9); ctx.lineTo(u * 0.6 - Math.sin(legA) * u, 0);
  }
  ctx.stroke();
  // flared pedestal foot
  let g = ctx.createLinearGradient(0, -u * 1.5, 0, 0);
  g.addColorStop(0, '#dfe8ee'); g.addColorStop(1, '#aebdc8');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-u * 0.8, -u * 1.5);
  ctx.lineTo(-u * 1.2, -u * 0.25);
  ctx.quadraticCurveTo(-u * 1.25, -u * 0.05, -u * 1.0, -u * 0.05);
  ctx.lineTo(u * 1.0, -u * 0.05);
  ctx.quadraticCurveTo(u * 1.25, -u * 0.05, u * 1.2, -u * 0.25);
  ctx.lineTo(u * 0.8, -u * 1.5);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(140,160,175,.5)'; ctx.lineWidth = u * 0.06; ctx.stroke();
  // bowl narrowing from the seat down to the foot (classic toilet profile)
  g = ctx.createLinearGradient(-u * 2.2, -u * 2.6, u * 2.2, -u * 1.4);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#f2f7fa');
  g.addColorStop(0.8, '#cfdae2'); g.addColorStop(1, '#b4c3cd');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-u * 2.1, -u * 3.2);
  ctx.bezierCurveTo(-u * 2.2, -u * 2.15, -u * 1.5, -u * 1.55, -u * 0.85, -u * 1.45);
  ctx.lineTo(u * 0.85, -u * 1.45);
  ctx.bezierCurveTo(u * 1.5, -u * 1.55, u * 2.2, -u * 2.15, u * 2.1, -u * 3.2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(140,160,175,.55)'; ctx.lineWidth = u * 0.07; ctx.stroke();
  // rim light on bowl
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = u * 0.13;
  ctx.beginPath();
  ctx.moveTo(-u * 1.85, -u * 3.0);
  ctx.quadraticCurveTo(-u * 1.85, -u * 2.0, -u * 1.1, -u * 1.7);
  ctx.stroke();
  // seat + lid stack (wider than the tank)
  g = ctx.createLinearGradient(0, -u * 4.1, 0, -u * 2.6);
  g.addColorStop(0, '#f4f8fb'); g.addColorStop(1, '#bdcad4');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, -u * 3.25, u * 2.35, u * 0.8, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(140,160,175,.6)'; ctx.lineWidth = u * 0.08;
  ctx.beginPath(); ctx.ellipse(0, -u * 3.25, u * 2.35, u * 0.8, 0, 0, 7); ctx.stroke();
  g = ctx.createLinearGradient(0, -u * 4.3, 0, -u * 3.1);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d3dee6');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, -u * 3.55, u * 2.15, u * 0.68, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(140,160,175,.5)'; ctx.lineWidth = u * 0.07;
  ctx.beginPath(); ctx.ellipse(0, -u * 3.55, u * 2.15, u * 0.68, 0, 0, 7); ctx.stroke();
  // seat hinges
  ctx.fillStyle = '#b9c8d2';
  roundRect(-u * 0.85, -u * 4.05, u * 0.5, u * 0.26, u * 0.1); ctx.fill();
  roundRect(u * 0.35, -u * 4.05, u * 0.5, u * 0.26, u * 0.1); ctx.fill();
  // tank — wide and squarish
  g = ctx.createLinearGradient(-u * 2.0, 0, u * 2.0, 0);
  g.addColorStop(0, '#eef4f8'); g.addColorStop(0.28, '#ffffff');
  g.addColorStop(0.75, '#dde7ed'); g.addColorStop(1, '#b9c8d2');
  ctx.fillStyle = g;
  roundRect(-u * 2.0, -u * 6.4, u * 4.0, u * 2.75, u * 0.3); ctx.fill();
  ctx.strokeStyle = 'rgba(140,160,175,.5)'; ctx.lineWidth = u * 0.07;
  roundRect(-u * 2.0, -u * 6.4, u * 4.0, u * 2.75, u * 0.3); ctx.stroke();
  // vertical gloss streak
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  roundRect(-u * 1.6, -u * 6.15, u * 0.42, u * 2.2, u * 0.2); ctx.fill();
  // tank lid
  g = ctx.createLinearGradient(0, -u * 7.0, 0, -u * 6.3);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c9d5dd');
  ctx.fillStyle = g;
  roundRect(-u * 2.2, -u * 6.95, u * 4.4, u * 0.6, u * 0.24); ctx.fill();
  ctx.strokeStyle = 'rgba(140,160,175,.5)'; ctx.lineWidth = u * 0.06;
  roundRect(-u * 2.2, -u * 6.95, u * 4.4, u * 0.6, u * 0.24); ctx.stroke();
  // chrome flush button
  g = ctx.createRadialGradient(u * 1.45, -u * 6.72, 0, u * 1.4, -u * 6.65, u * 0.3);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#c3ced6'); g.addColorStop(1, '#7f929f');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(u * 1.4, -u * 6.65, u * 0.24, 0, 7); ctx.fill();
  // face on the tank (worried!)
  const blink = Math.sin(state.t * 2.7) > 0.96 ? 0.15 : 1;
  ctx.fillStyle = '#23262e';
  ctx.beginPath();
  ctx.ellipse(-u * 0.55, -u * 5.05, u * 0.26, u * 0.34 * blink, 0, 0, 7);
  ctx.ellipse(u * 0.55, -u * 5.05, u * 0.26, u * 0.34 * blink, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#fff'; // eye highlights
  ctx.beginPath();
  ctx.arc(-u * 0.62, -u * 5.18, u * 0.08 * blink, 0, 7);
  ctx.arc(u * 0.48, -u * 5.18, u * 0.08 * blink, 0, 7);
  ctx.fill();
  // worried brows (inner ends raised)
  ctx.strokeStyle = '#39404d'; ctx.lineWidth = u * 0.13;
  ctx.beginPath();
  ctx.moveTo(-u * 0.85, -u * 5.5); ctx.lineTo(-u * 0.3, -u * 5.68);
  ctx.moveTo(u * 0.85, -u * 5.5); ctx.lineTo(u * 0.3, -u * 5.68);
  ctx.stroke();
  // mouth
  ctx.strokeStyle = '#39404d'; ctx.lineWidth = u * 0.14;
  ctx.beginPath();
  if (dead) ctx.arc(0, -u * 4.05, u * 0.35, 0.15 * Math.PI, 0.85 * Math.PI);
  else ctx.arc(0, -u * 4.45, u * 0.38, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  // blush
  ctx.fillStyle = 'rgba(245,160,150,.5)';
  ctx.beginPath();
  ctx.ellipse(-u * 1.05, -u * 4.6, u * 0.22, u * 0.13, 0, 0, 7);
  ctx.ellipse(u * 1.05, -u * 4.6, u * 0.22, u * 0.13, 0, 0, 7);
  ctx.fill();
  // sweat drop
  ctx.fillStyle = '#7ec7f2';
  const sw = Math.abs(Math.sin(state.t * 10));
  ctx.beginPath();
  ctx.ellipse(u * 1.45, -u * (5.7 - sw * 0.35), u * 0.16, u * 0.24, 0.3, 0, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.beginPath(); ctx.arc(u * 1.4, -u * (5.78 - sw * 0.35), u * 0.05, 0, 7); ctx.fill();
}

function drawPlayer() {
  const p = screenPos(state.laneX, PLAYER_Z, state.y);
  const s = Math.min(W, H) * proj(PLAYER_Z);
  const run = state.t * 13;
  const bob = state.jumping ? 0 : Math.abs(Math.sin(run)) * s * 0.011;
  const slide = state.sliding > 0;
  const u = s * PLAYER_SCALE;

  ctx.save();
  ctx.translate(p.x, p.y - bob);
  // soft ground shadow (before tilt so it stays down)
  const sh = ctx.createRadialGradient(0, state.y * s * 0.22, 0, 0, state.y * s * 0.22, u * 2.4);
  sh.addColorStop(0, 'rgba(0,0,0,.32)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.ellipse(0, state.y * s * 0.22, u * Math.max(0.9, 2.4 - state.y), u * 0.6, 0, 0, 7);
  ctx.fill();

  if (state.dead) ctx.rotate(Math.min(1.5, state.deadT * 4));
  if (slide) ctx.scale(1.18, 0.52); // duck: squashed toilet
  // 부활 직후 무적: 깜빡임
  if (state.invuln > 0) ctx.globalAlpha = Math.floor(state.t * 14) % 2 ? 0.28 : 0.92;
  drawToiletBack(u, run, state.jumping && !slide, state.dead);
  ctx.restore();
}

// crying toilet, front view — for the opening cinematic (origin = feet)
function drawToiletFront(U, T) {
  const cry = T > 1.05;
  ctx.lineCap = 'round';
  // stubby legs
  ctx.strokeStyle = '#3c3c46'; ctx.lineWidth = U * 0.55;
  ctx.beginPath();
  ctx.moveTo(-U * 0.7, -U * 0.8); ctx.lineTo(-U * 0.7, 0);
  ctx.moveTo(U * 0.7, -U * 0.8); ctx.lineTo(U * 0.7, 0);
  ctx.stroke();
  // tank behind
  let g = ctx.createLinearGradient(-U * 1.75, 0, U * 1.75, 0);
  g.addColorStop(0, '#b9c8d2'); g.addColorStop(0.3, '#ffffff');
  g.addColorStop(0.7, '#eef4f8'); g.addColorStop(1, '#c2d0da');
  ctx.fillStyle = g;
  roundRect(-U * 1.75, -U * 6.6, U * 3.5, U * 3.4, U * 0.45); ctx.fill();
  ctx.strokeStyle = 'rgba(140,160,175,.5)'; ctx.lineWidth = U * 0.07;
  roundRect(-U * 1.75, -U * 6.6, U * 3.5, U * 3.4, U * 0.45); ctx.stroke();
  // tank lid
  g = ctx.createLinearGradient(0, -U * 7.1, 0, -U * 6.4);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c9d5dd');
  ctx.fillStyle = g;
  roundRect(-U * 1.95, -U * 7.05, U * 3.9, U * 0.65, U * 0.28); ctx.fill();
  // face
  if (!cry) { // calm & happy
    ctx.fillStyle = '#23262e';
    ctx.beginPath();
    ctx.ellipse(-U * 0.6, -U * 5.3, U * 0.26, U * 0.34, 0, 0, 7);
    ctx.ellipse(U * 0.6, -U * 5.3, U * 0.26, U * 0.34, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-U * 0.67, -U * 5.43, U * 0.08, 0, 7);
    ctx.arc(U * 0.53, -U * 5.43, U * 0.08, 0, 7);
    ctx.fill();
    ctx.strokeStyle = '#39404d'; ctx.lineWidth = U * 0.14;
    ctx.beginPath(); ctx.arc(0, -U * 4.75, U * 0.4, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
  } else { // sobbing (like the sketch!)
    ctx.strokeStyle = '#23262e'; ctx.lineWidth = U * 0.16;
    ctx.beginPath(); // squeezed-shut eyes  > <
    ctx.moveTo(-U * 0.9, -U * 5.5); ctx.lineTo(-U * 0.35, -U * 5.3); ctx.lineTo(-U * 0.9, -U * 5.1);
    ctx.moveTo(U * 0.9, -U * 5.5); ctx.lineTo(U * 0.35, -U * 5.3); ctx.lineTo(U * 0.9, -U * 5.1);
    ctx.stroke();
    // wailing mouth
    const mw = U * (0.5 + 0.08 * Math.sin(state.t * 16));
    ctx.fillStyle = '#4a2530';
    ctx.beginPath(); ctx.ellipse(0, -U * 4.45, mw, U * 0.42, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e08a80';
    ctx.beginPath(); ctx.ellipse(0, -U * 4.25, mw * 0.55, U * 0.16, 0, 0, 7); ctx.fill();
    // tear streams (blue wavy lines, like the sketch)
    ctx.strokeStyle = 'rgba(90,180,245,.9)'; ctx.lineWidth = U * 0.2;
    for (const sx of [-0.62, 0.62]) {
      for (const o of [-0.14, 0.14]) {
        ctx.beginPath();
        ctx.moveTo(U * (sx + o), -U * 5.15);
        ctx.quadraticCurveTo(
          U * (sx + o + Math.sin(state.t * 14 + sx) * 0.12), -U * 4.4,
          U * (sx + o + Math.sin(state.t * 10 + o * 9) * 0.15), -U * 3.55);
        ctx.stroke();
      }
    }
    // tear splash droplets
    ctx.fillStyle = 'rgba(120,195,245,.85)';
    for (let i = 0; i < 4; i++) {
      const f = (state.t * 2.2 + i * 0.25) % 1;
      ctx.beginPath();
      ctx.arc(U * (i % 2 ? 1.6 : -1.6) * (0.8 + f * 0.5), -U * (5.2 - f * 1.6), U * 0.1 * (1 - f), 0, 7);
      ctx.fill();
    }
  }
  // seat ring (front, slightly from above)
  g = ctx.createLinearGradient(0, -U * 3.75, 0, -U * 2.3);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c3d0d9');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, -U * 3.0, U * 2.05, U * 0.78, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(140,160,175,.55)'; ctx.lineWidth = U * 0.08;
  ctx.beginPath(); ctx.ellipse(0, -U * 3.0, U * 2.05, U * 0.78, 0, 0, 7); ctx.stroke();
  // bowl hole
  ctx.fillStyle = '#7e909c';
  ctx.beginPath(); ctx.ellipse(0, -U * 2.97, U * 1.4, U * 0.46, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#5c6c76';
  ctx.beginPath(); ctx.ellipse(0, -U * 2.95, U * 1.05, U * 0.3, 0, 0, 7); ctx.fill();
  // bowl body
  g = ctx.createLinearGradient(-U * 2.1, -U * 2.4, U * 2.1, -U * 1);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#eef4f8'); g.addColorStop(1, '#b4c3cd');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-U * 2.0, -U * 2.75);
  ctx.bezierCurveTo(-U * 2.1, -U * 1.3, -U * 1.1, -U * 0.75, 0, -U * 0.75);
  ctx.bezierCurveTo(U * 1.1, -U * 0.75, U * 2.1, -U * 1.3, U * 2.0, -U * 2.75);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(140,160,175,.5)'; ctx.lineWidth = U * 0.07;
  ctx.stroke();
  // gloss on bowl
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.beginPath(); ctx.ellipse(-U * 1.1, -U * 1.9, U * 0.34, U * 0.62, 0.35, 0, 7); ctx.fill();
}

// ---------- 군중 (인트로 정면) ----------
function drawCrowdFront(x, y, u, i) {
  if (u < 2) return;
  const run = state.t * 12 + i * 1.7;
  const bob = Math.abs(Math.sin(run)) * u * 0.4;
  const shirt = CROWD_COLORS[i % CROWD_COLORS.length];
  const skin = ['#e8b789', '#d99c66', '#f0c9a0'][i % 3];
  ctx.save();
  ctx.translate(x, y - bob);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#3a3f4a'; ctx.lineWidth = u * 0.85;
  const la = Math.sin(run) * 0.9;
  ctx.beginPath();
  ctx.moveTo(0, -u * 2.9); ctx.lineTo(Math.sin(la) * u * 1.5, -u * 0.3);
  ctx.moveTo(0, -u * 2.9); ctx.lineTo(-Math.sin(la) * u * 1.4, -u * 0.35);
  ctx.stroke();
  ctx.strokeStyle = shirt; ctx.lineWidth = u * 1.6;
  ctx.beginPath(); ctx.moveTo(0, -u * 5.2); ctx.lineTo(0, -u * 2.9); ctx.stroke();
  // arms flailing overhead
  ctx.strokeStyle = skin; ctx.lineWidth = u * 0.6;
  ctx.beginPath();
  ctx.moveTo(-u * 0.5, -u * 4.9); ctx.lineTo(-u * 1.4, -u * 6.4 + Math.sin(run) * u * 0.4);
  ctx.moveTo(u * 0.5, -u * 4.9); ctx.lineTo(u * 1.4, -u * 6.4 - Math.sin(run) * u * 0.4);
  ctx.stroke();
  if (i % 3 === 0) { // some wave toilet paper
    const wx = u * 1.4, wy = -u * 6.4 - Math.sin(run) * u * 0.4;
    ctx.fillStyle = '#f7fafc';
    ctx.beginPath(); ctx.arc(wx, wy - u * 0.35, u * 0.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#aeb9c0';
    ctx.beginPath(); ctx.arc(wx, wy - u * 0.35, u * 0.2, 0, 7); ctx.fill();
  }
  // head, desperate face
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(0, -u * 6.2, u * 0.95, 0, 7); ctx.fill();
  ctx.fillStyle = ['#2f2418', '#111', '#6b3410'][i % 3];
  ctx.beginPath(); ctx.arc(0, -u * 6.5, u * 0.95, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  if (u > 5) {
    ctx.strokeStyle = '#2b2118'; ctx.lineWidth = u * 0.12;
    ctx.beginPath(); // anguished brows
    ctx.moveTo(-u * 0.55, -u * 6.5); ctx.lineTo(-u * 0.15, -u * 6.35);
    ctx.moveTo(u * 0.55, -u * 6.5); ctx.lineTo(u * 0.15, -u * 6.35);
    ctx.stroke();
    ctx.fillStyle = '#2b2118';
    ctx.beginPath(); // eyes + open mouth
    ctx.arc(-u * 0.33, -u * 6.15, u * 0.09, 0, 7);
    ctx.arc(u * 0.33, -u * 6.15, u * 0.09, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#5c2020';
    ctx.beginPath(); ctx.ellipse(0, -u * 5.75, u * 0.22, u * 0.28, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(126,199,242,.9)';
    ctx.beginPath(); ctx.arc(u * 0.85, -u * 6.6, u * 0.12, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// ---------- 던져진 휴지 (뒤에서 굴러오는 방해물) ----------
function drawThrownRoll(th) {
  const gp = screenPos(LANE_X[th.lane], th.z, 0);
  const p = screenPos(LANE_X[th.lane], th.z, th.y + 0.05);
  const s = p.f * Math.min(W, H) * 0.055;
  if (s < 2) return;
  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.ellipse(gp.x, gp.y, s * 0.9, s * 0.28, 0, 0, 7); ctx.fill();
  // unrolling paper strip trailing behind
  ctx.strokeStyle = 'rgba(247,250,252,.9)'; ctx.lineWidth = s * 0.35; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(p.x, p.y + s * 0.2);
  ctx.quadraticCurveTo(p.x - s * 0.8, p.y + s * (1.1 + 0.15 * Math.sin(state.t * 13)),
                       p.x - s * 1.6, p.y + s * (2.0 + 0.3 * Math.sin(state.t * 9)));
  ctx.stroke();
  // spinning roll
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate((th.age * 16) % (Math.PI * 2));
  ctx.fillStyle = '#f7fafc';
  ctx.beginPath(); ctx.arc(0, 0, s, 0, 7); ctx.fill();
  ctx.strokeStyle = '#cdd6dc'; ctx.lineWidth = s * 0.1;
  ctx.beginPath(); ctx.arc(0, 0, s, 0, 7); ctx.stroke();
  ctx.fillStyle = '#aeb9c0';
  ctx.beginPath(); ctx.arc(0, 0, s * 0.35, 0, 7); ctx.fill();
  ctx.fillStyle = '#8b989f';
  ctx.beginPath(); ctx.arc(0, 0, s * 0.18, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(180,195,205,.8)'; ctx.lineWidth = s * 0.08;
  ctx.beginPath(); ctx.moveTo(s * 0.4, 0); ctx.lineTo(s * 0.85, 0); ctx.stroke();
  ctx.restore();
  // 경고는 바닥의 빨간 레인 박스(drawLaneWarning)가 대신한다
}

// 휴지가 날아올 레인을 바닥 전체에 반투명 빨간 박스로 미리 알려준다.
// 바닥 표시라 캐릭터·장애물보다 먼저(아래에) 그린다.
function drawLaneWarning(lane, alpha) {
  const lx = LANE_X[lane], zN = 0.05, zF = 18, halfW = 0.5;
  const nl = screenPos(lx - halfW, zN), nr = screenPos(lx + halfW, zN);
  const fl = screenPos(lx - halfW, zF), fr = screenPos(lx + halfW, zF);
  // 멀수록 옅어져 원근감이 살아난다
  const g = ctx.createLinearGradient(0, fl.y, 0, nl.y);
  g.addColorStop(0, 'rgba(255,60,45,0)');
  g.addColorStop(0.45, `rgba(255,60,45,${0.28 * alpha})`);
  g.addColorStop(1, `rgba(235,35,30,${0.58 * alpha})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(fl.x, fl.y); ctx.lineTo(fr.x, fr.y);
  ctx.lineTo(nr.x, nr.y); ctx.lineTo(nl.x, nl.y);
  ctx.closePath(); ctx.fill();
  // 양옆 테두리
  ctx.strokeStyle = `rgba(255,110,95,${0.8 * alpha})`;
  ctx.lineWidth = Math.max(2, Math.min(W, H) * 0.006);
  ctx.beginPath(); ctx.moveTo(fl.x, fl.y); ctx.lineTo(nl.x, nl.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(fr.x, fr.y); ctx.lineTo(nr.x, nr.y); ctx.stroke();
}

// 경고 중이거나 아직 플레이어를 지나지 않은 휴지들의 레인을 표시
function drawThrowWarnings() {
  const pulse = 0.62 + 0.38 * Math.sin(state.t * 11);
  for (const th of throwsArr) {
    if (th.warn > 0 || th.z < PLAYER_Z + 0.4) drawLaneWarning(th.lane, pulse);
  }
}

// ---------- 추격자들 (게임 중, 뒷모습) ----------
function drawChasers() {
  const catchUp = state.dead ? Math.min(1, state.deadT * 1.4) : 0;
  for (const c of CHASERS) {
    const baseZ = -0.85 + c.zoff;
    const z = baseZ + catchUp * (PLAYER_Z + 0.5 - baseZ);
    const laneOff = c.off + (state.laneX - c.off) * catchUp * 0.85;
    const sway = Math.sin(state.t * 1.7 + c.ph) * 0.06;
    const p = screenPos(laneOff + sway, z);
    const s = Math.min(W, H) * proj(z);
    const u = s * CHASER_SCALE;
    const run = state.t * 12 + c.ph;
    const bob = Math.abs(Math.sin(run)) * u * 0.45;
    ctx.save();
    ctx.translate(p.x, p.y - bob);
    ctx.lineCap = 'round';
    // legs
    ctx.strokeStyle = c.pants; ctx.lineWidth = u * 0.9;
    const la = Math.sin(run) * 0.9;
    ctx.beginPath();
    ctx.moveTo(0, -u * 2.9); ctx.lineTo(Math.sin(la) * u * 1.6, -u * 0.3);
    ctx.moveTo(0, -u * 2.9); ctx.lineTo(-Math.sin(la) * u * 1.5, -u * 0.35);
    ctx.stroke();
    // torso
    ctx.strokeStyle = c.shirt; ctx.lineWidth = u * 1.7;
    ctx.beginPath(); ctx.moveTo(0, -u * 5.3); ctx.lineTo(0, -u * 2.9); ctx.stroke();
    if (c.tp) {
      // one arm pumping, one arm waving a TP roll overhead
      ctx.strokeStyle = c.skin; ctx.lineWidth = u * 0.65;
      ctx.beginPath(); ctx.moveTo(-u * 0.4, -u * 5.0);
      ctx.lineTo(-u * 0.4 - Math.sin(run) * u * 1.3, -u * 3.6); ctx.stroke();
      const wx = u * (1.5 + Math.sin(state.t * 9 + c.ph) * 0.5), wy = -u * 7.1;
      ctx.beginPath(); ctx.moveTo(u * 0.5, -u * 5.0); ctx.lineTo(wx, wy); ctx.stroke();
      // roll + fluttering paper strip
      ctx.fillStyle = '#f7fafc';
      ctx.beginPath(); ctx.arc(wx, wy - u * 0.4, u * 0.62, 0, 7); ctx.fill();
      ctx.fillStyle = '#aeb9c0';
      ctx.beginPath(); ctx.arc(wx, wy - u * 0.4, u * 0.24, 0, 7); ctx.fill();
      ctx.strokeStyle = '#f7fafc'; ctx.lineWidth = u * 0.34;
      ctx.beginPath(); ctx.moveTo(wx + u * 0.5, wy - u * 0.4);
      ctx.quadraticCurveTo(wx + u * 1.4, wy + u * 0.4 + Math.sin(state.t * 11 + c.ph) * u * 0.5,
                           wx + u * 2.1, wy - u * 0.2 + Math.cos(state.t * 9 + c.ph) * u * 0.6);
      ctx.stroke();
    } else {
      // both hands clenched behind — holding it in
      ctx.strokeStyle = c.skin; ctx.lineWidth = u * 0.65;
      ctx.beginPath();
      ctx.moveTo(-u * 0.6, -u * 5.0); ctx.quadraticCurveTo(-u * 1.3, -u * 3.6, -u * 0.35, -u * 2.6);
      ctx.moveTo(u * 0.6, -u * 5.0); ctx.quadraticCurveTo(u * 1.3, -u * 3.6, u * 0.35, -u * 2.6);
      ctx.stroke();
    }
    // head + hair
    ctx.fillStyle = c.skin;
    ctx.beginPath(); ctx.arc(0, -u * 6.3, u * 1.0, 0, 7); ctx.fill();
    ctx.fillStyle = c.hair;
    ctx.beginPath(); ctx.arc(0, -u * 6.55, u * 1.0, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
    // flying sweat drops
    ctx.fillStyle = 'rgba(126,199,242,0.9)';
    for (const sd of [-1, 1]) {
      const f = (state.t * 3 + c.ph * 0.7) % 1;
      ctx.beginPath();
      ctx.arc(sd * u * (1.2 + f * 1.1), -u * (6.5 + f * 0.8), u * 0.16 * (1 - f), 0, 7);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawVignette() {
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.24)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ---------- 프레임 렌더 (엔진의 frame()이 매 프레임 호출) ----------
function render() {
  if (state.mode === 'intro') { renderIntro(); return; }
  ctx.save();
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * state.shake * 18, (Math.random() - 0.5) * state.shake * 18);
  }
  drawSky();
  drawGround();
  drawThrowWarnings();   // 바닥 경고 표시 — 장애물·캐릭터보다 아래
  // far → near (player sorted in so near obstacles pass in front of him)
  const drawables = [
    ...decos.map(d => ({ z: d.z, fn: () => drawDeco(d) })),
    ...obstacles.map(o => ({ z: o.z, fn: () => drawObstacle(o) })),
    ...coinsArr.filter(c => !c.got).map(c => ({ z: c.z, fn: () => drawCoin(c) })),
    ...throwsArr.filter(th => th.warn <= 0).map(th => ({ z: th.z, fn: () => drawThrownRoll(th) })),
    { z: PLAYER_Z, fn: drawPlayer },
  ].sort((a, b) => b.z - a.z);
  for (const d of drawables) d.fn();
  drawChasers();
  ctx.restore();
  drawVignette();
  if (state.hurtT > 0 && !state.dead) { // 목숨 하나 잃은 순간 붉은 플래시
    ctx.fillStyle = `rgba(215,45,40,${Math.min(0.34, state.hurtT * 0.55)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (state.dead) {
    ctx.fillStyle = `rgba(120,80,25,${Math.min(0.32, state.deadT)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// ---------- 오프닝 시네마틱 ----------
function renderIntro() {
  const T = state.introT;
  const M = Math.min(W, H);
  drawSky();
  drawGround();
  const ds = [...decos].sort((a, b) => b.z - a.z);
  for (const d of ds) drawDeco(d);

  // the 100-person stampede pouring in from the horizon
  if (T < 2.7) {
    ctx.save();
    ctx.globalAlpha = 1 - easeIO((T - 2.3) / 0.4);
    const crowdZ = Math.max(3.8, 30 - T * 9);
    for (let i = 0; i < 14; i++) {
      const cz = crowdZ + (i % 5) * 2.6 + ((i * 37) % 7) * 0.9;
      const off = (((i * 2.63) % 5) - 2) * 0.8 + Math.sin(state.t * 6 + i) * 0.05;
      const pp = screenPos(off, cz);
      drawCrowdFront(pp.x, pp.y, M * proj(cz) * 0.03, i);
    }
    ctx.restore();
  }

  // PooPoo: big crying close-up → flips around → runs to his gameplay spot
  const k = easeIO((T - 2.1) / 0.7);
  const homeP = screenPos(0, PLAYER_Z);
  const cx = W / 2 + (homeP.x - W / 2) * k;
  const cy = H * 0.68 + (homeP.y - H * 0.68) * k;
  const U = M * 0.052 + (M * proj(PLAYER_Z) * PLAYER_SCALE - M * 0.052) * k;
  const flip = T < 2.1 ? 1 : Math.cos(Math.min(1, (T - 2.1) / 0.5) * Math.PI);
  ctx.save();
  ctx.translate(cx, cy);
  const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, U * 2.4);
  sh.addColorStop(0, 'rgba(0,0,0,.3)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.beginPath(); ctx.ellipse(0, 0, U * 2.4, U * 0.6, 0, 0, 7); ctx.fill();
  const tremble = T > 1.05 && T < 2.1 ? Math.sin(state.t * 30) * U * 0.06 : 0;
  ctx.translate(tremble, 0);
  ctx.scale(Math.max(0.08, Math.abs(flip)), 1);
  if (flip > 0) drawToiletFront(U, T);
  else drawToiletBack(U, state.t * 13, false, false);
  ctx.restore();

  if (T > 2.6) drawChasers();

  // cinematic letterbox
  let lb = H * 0.085 * easeIO(T * 2.2);
  if (T > 3.0) lb *= 1 - easeIO((T - 3.0) / 0.6);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, lb);
  ctx.fillRect(0, H - lb, W, lb);

  // captions
  let cap = '', a = 0;
  if (T < 1.05) { cap = "어느 평화로운 오후, 공원 화장실의 변기 '푸푸'"; a = easeIO(T / 0.3) * easeIO((1.05 - T) / 0.25); }
  else if (T < 2.1) { cap = '급똥 환자 100명이 들이닥쳤다?!'; a = easeIO((T - 1.05) / 0.25) * easeIO((2.1 - T) / 0.25); }
  else if (T < 3.4) { cap = '도망쳐, 푸푸!!!'; a = easeIO((T - 2.1) / 0.25) * easeIO((3.4 - T) / 0.3); }
  if (cap && a > 0.01) {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.font = `900 ${M * 0.042}px 'Segoe UI', sans-serif`;
    ctx.lineWidth = M * 0.012; ctx.strokeStyle = 'rgba(0,0,0,.75)';
    ctx.strokeText(cap, W / 2, H * 0.885);
    ctx.fillStyle = '#fff';
    ctx.fillText(cap, W / 2, H * 0.885);
    ctx.restore();
  }
  // skip hint
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.font = `600 ${Math.max(11, M * 0.018)}px 'Segoe UI', sans-serif`;
  ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff';
  ctx.fillText('클릭 / 아무 키 → 건너뛰기 ▶', W - 16, lb + 10);
  ctx.restore();
  drawVignette();
}

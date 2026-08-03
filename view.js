/* ============================================
   view.js — 🔧 B담당 (엔진/시스템)
   캔버스 셋업, 리사이즈, 원근 투영.
   ⚠️ screenPos(laneOff, z, yWorld) → {x, y, f, roadHalfNear}
      시그니처는 render.js 전체가 의존하므로 함부로 바꾸지 말 것!
   ============================================ */
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let W = 900, H = 600;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ---------- 원근 투영 ----------
const FOV = 7;        // perspective strength
const DRAW_FAR = 75;  // furthest drawn z

function horizonY() { return H * 0.32; }
function baseY() { return H * 0.94; }
function proj(z) { return FOV / (FOV + z); } // 1 at z=0 → 0 far
function screenPos(laneOff, z, yWorld = 0) {
  const f = proj(z);
  const roadHalfNear = Math.min(W, H * 1.4) * 0.46;
  const x = W / 2 + laneOff * roadHalfNear * 0.62 * f;
  const y = horizonY() + (baseY() - horizonY()) * f - yWorld * (baseY() - horizonY()) * f * 0.55;
  return { x, y, f, roadHalfNear };
}

// 공용 이징 함수
function easeIO(k) { return k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k); }

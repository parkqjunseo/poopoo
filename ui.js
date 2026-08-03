/* ============================================
   ui.js — 🔧 B담당 (엔진/시스템)
   HUD 갱신, 게임오버 화면, 최고기록(localStorage), 버튼 이벤트.
   ⚠️ index.html 의 ID에 의존: scoreBox coinBox overlay ovMsg ovStats ovBest startBtn
   ============================================ */
'use strict';

const scoreBox = document.getElementById('scoreBox');
const coinBox = document.getElementById('coinBox');
const overlay = document.getElementById('overlay');
const ovMsg = document.getElementById('ovMsg');
const ovStats = document.getElementById('ovStats');
const ovBest = document.getElementById('ovBest');
const startBtn = document.getElementById('startBtn');
const ovTitle = overlay.querySelector('h1');

function updateHUD(dist, coins) {
  scoreBox.textContent = Math.floor(dist) + ' m';
  coinBox.textContent = '🧻 ' + coins;
}

function gameOver() {
  state.running = false;
  const d = Math.floor(state.dist);
  const nb = d > state.best;
  if (nb) { state.best = d; localStorage.setItem('tr_best', d); }
  ovTitle.textContent = 'GAME OVER';
  ovMsg.innerHTML = nb ? '🏆 신기록 달성! 그리고... 잡혔다 💩' : '💩 급한 사람들에게 잡히고 말았다...';
  ovStats.classList.remove('hidden');
  ovStats.innerHTML = `달린 거리 <b>${d} m</b> &nbsp;·&nbsp; 휴지 <b>🧻 ${state.coins}</b>`;
  ovBest.textContent = `🏆 최고 기록 ${state.best} m`;
  startBtn.textContent = '⟳ 다시 도망치기';
  overlay.classList.remove('hidden');
}

// 첫 화면 최고기록 표시
ovBest.textContent = state.best ? `🏆 최고 기록 ${state.best} m` : '';

startBtn.addEventListener('click', () => {
  audio();
  reset();
  state.mode = 'intro';
  state.introT = 0;
  state.running = false;
  overlay.classList.add('hidden');
});

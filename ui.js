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
const ovScore = document.getElementById('ovScore');
const ovBest = document.getElementById('ovBest');
const livesBox = document.getElementById('livesBox');
const startBtn = document.getElementById('startBtn');
const ovTitle = overlay.querySelector('h1');

// 점수 = 달린 거리 + 휴지 1개당 10점
function calcScore(dist, coins) { return Math.floor(dist) + coins * 10; }

function updateHUD(dist, coins) {
  scoreBox.textContent = Math.floor(dist) + ' m';
  coinBox.textContent = '🧻 ' + coins;
}

// ---------- 목숨 하트 ----------
let shownLives = -1;
function updateLives(lives) {
  if (lives === shownLives) return;
  const lost = shownLives >= 0 && lives < shownLives;
  shownLives = lives;
  livesBox.innerHTML = Array.from({ length: MAX_LIVES }, (_, i) =>
    `<span class="heart${i < lives ? '' : ' lost'}">❤️</span>`).join('');
  if (lost) {
    livesBox.classList.remove('hurt');
    void livesBox.offsetWidth;      // 애니메이션 재시작
    livesBox.classList.add('hurt');
  }
}

function gameOver() {
  state.running = false;
  const d = Math.floor(state.dist);
  const score = calcScore(state.dist, state.coins);
  const nb = score > state.best;
  if (nb) { state.best = score; localStorage.setItem('poopoo_best_score', score); }
  ovTitle.textContent = 'GAME OVER';
  ovMsg.innerHTML = nb ? '🏆 신기록 달성! 그래도... 결국 잡혔다 💩' : '💩 목숨을 모두 잃고 붙잡히고 말았다...';
  ovScore.classList.remove('hidden');
  ovScore.innerHTML = `<small>최종 점수</small>${score.toLocaleString()}`;
  ovStats.classList.remove('hidden');
  ovStats.innerHTML = `달린 거리 <b>${d} m</b> &nbsp;·&nbsp; 휴지 <b>🧻 ${state.coins}</b>`;
  ovBest.textContent = `🏆 최고 점수 ${state.best.toLocaleString()}`;
  startBtn.textContent = '⟳ 다시 시작';
  overlay.classList.remove('hidden');
}

// 첫 화면 초기 표시
ovBest.textContent = state.best ? `🏆 최고 점수 ${state.best.toLocaleString()}` : '';
updateLives(MAX_LIVES);

startBtn.addEventListener('click', () => {
  audio();
  loadClips();      // 효과음 mp3 클립들 미리 디코딩
  reset();
  updateLives(state.lives);
  state.mode = 'intro';
  state.introT = 0;
  state.running = false;
  overlay.classList.add('hidden');
});

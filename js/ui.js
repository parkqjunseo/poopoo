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

/* ---------- 기록 보관 (기록 모달용) ----------
   최고 점수는 원래 있었지만, 그때 모은 휴지 수 · 달성 일시 · 총 플레이 시간은
   저장하는 곳이 없어서 새로 만든다. 최고 점수 키는 기존 것을 그대로 쓴다. */
const REC = {
  score: 'poopoo_best_score',   // 기존 키 (main.js 도 같은 키를 읽는다)
  coins: 'poopoo_best_coins',   // 최고 기록을 세운 판에서 모은 휴지
  at:    'poopoo_best_at',      // 최고 기록 달성 시각 (epoch ms)
  play:  'poopoo_play_ms',      // 총 플레이 시간 누적
};
function recGet(k) { try { return +(localStorage.getItem(k) || 0); } catch (e) { return 0; } }
function recSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 시크릿 모드 */ } }

function getRecords() {
  return { score: recGet(REC.score), coins: recGet(REC.coins),
           at: recGet(REC.at), playMs: recGet(REC.play) };
}
// "2026.08.10" — 행에서 값이 쓸 수 있는 폭이 라벨 끝(49.6%)~70.8% 뿐이라 시각까지 넣으면
// 글자를 2.6cqw 까지 줄여야 해서 읽기 힘들어진다(실측). 날짜만 넣고 크기를 살렸다.
function recFmtDate(ts) {
  if (!ts) return '-';
  const d = new Date(ts), p2 = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}`;
}
function recFmtPlay(ms) {
  if (!ms) return '-';
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  if (h) return `${h}시간 ${m}분`;
  if (m) return `${m}분 ${s % 60}초`;
  return `${s}초`;
}

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
  // 이 기능이 생기기 전에 세운 최고 기록은 휴지 수·달성 일시가 없다(= at 이 0).
  // 그 경우 신기록을 다시 세우기 전까지 기록 화면이 계속 "-" 로 남으므로,
  // 업데이트 후 첫 판에서 한 번 채워 넣는다(원래 판의 값은 복원할 수 없다).
  const legacy = !recGet(REC.at) && recGet(REC.score) > 0;
  if (nb || legacy) {
    if (nb) { state.best = score; recSet(REC.score, score); }
    recSet(REC.coins, state.coins);   // 최고 기록을 세운 판의 휴지 수
    recSet(REC.at, Date.now());       // 달성 일시
  }
  recSet(REC.play, recGet(REC.play) + Math.round(state.t * 1000));  // 총 플레이 시간 누적
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
  loadClips();      // 효과음 클립들 미리 디코딩
  bgm.start();      // 배경음악 (클릭이라는 사용자 동작이 있어야 브라우저가 허용)
  reset();
  updateLives(state.lives);
  state.mode = 'intro';
  state.introT = 0;
  state.running = false;
  overlay.classList.add('hidden');
});

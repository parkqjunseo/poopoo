/* ============================================================
   POO POO RUN — main.js  (A담당 · 오버레이/버튼 배선 어댑터)
   - 모듈(config/view/audio/render/engine/ui)은 절대 수정 안 함
   - 이 파일은 새 디자인의 버튼/게임오버 슬롯을 엔진 state에 연결만 함
   - 반드시 6개 모듈 다음(맨 마지막)에 로드
   ============================================================ */

/* [0] localStorage guard (시크릿 모드 등 대비) */
(function(){try{window.localStorage.getItem('__t');}catch(e){var m={};try{Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:function(k){return (k in m)?m[k]:null;},setItem:function(k,v){m[k]=String(v);},removeItem:function(k){delete m[k];}}});}catch(_){}}})();

/* [1] 시작화면 배경 주입(선택) — 해당 요소 없으면 조용히 무시 */
(function(){var b=document.querySelector('.startStage .bg'),d=document.querySelector('.startBackdrop');if(b&&d){var set=function(){d.style.backgroundImage="url('"+b.src+"')";};b.complete?set():b.addEventListener('load',set);}})();

/* [2] 버튼·모달·게임오버 슬롯 배선 */
(function () {
  function byId(id){ return document.getElementById(id); }
  var overlay=byId('overlay'), startBtn=byId('startBtn'), ovStats=byId('ovStats');
  var playBtn=byId('playBtn'), retryBtn=byId('retryBtn'), howBtn=byId('howBtn'), recBtn=byId('recBtn');
  var controls=byId('controlsPanel'), records=byId('recordsPanel'), recBody=byId('recBody');
  var scoreBig=byId('scoreBig'), statDist=byId('statDist'), statCoin=byId('statCoin'), statBest=byId('statBest');
  var hud=byId('hud');

  if (playBtn && startBtn)  playBtn.addEventListener('click', function(){ startBtn.click(); });
  if (retryBtn && startBtn) retryBtn.addEventListener('click', function(){ startBtn.click(); });
  if (howBtn && controls)   howBtn.addEventListener('click', function(){ controls.classList.add('open'); });
  if (recBtn && records)    recBtn.addEventListener('click', function(){ showRecords(); records.classList.add('open'); });
  var cClose=byId('controlsClose'); if (cClose) cClose.addEventListener('click', function(){ controls.classList.remove('open'); });
  var rClose=byId('recordsClose'); if (rClose) rClose.addEventListener('click', function(){ records.classList.remove('open'); });
  if (controls) controls.addEventListener('pointerdown', function(e){ if(e.target===controls) controls.classList.remove('open'); });
  if (records)  records.addEventListener('pointerdown', function(e){ if(e.target===records) records.classList.remove('open'); });

  // ui.js와 동일 키 사용 (기록 따로 노는 문제 방지)
  function bestScore(){ try { return +(localStorage.getItem('poopoo_best_score')||0); } catch(e){ return 0; } }
  function showRecords(){
    if(!recBody) return;
    var bs=bestScore(), bd=(typeof state!=='undefined'?state.best:0);
    recBody.innerHTML = bs ? ('👑 최고 점수<br><b>'+bs.toLocaleString()+' 점</b><br><br>🏁 최고 거리 <b>'+bd+' m</b>')
                           : '아직 기록이 없어요!<br>먼저 한 판 도망쳐 보세요 🚽';
  }

  function sync(){
    if(!overlay || !ovStats) return;
    var playing = overlay.classList.contains('hidden');
    if(hud) hud.style.display = playing ? 'flex' : 'none';
    var go = !ovStats.classList.contains('hidden');
    overlay.classList.toggle('gameover', go);
    if (go && typeof state !== 'undefined') {
      var dist=Math.floor(state.dist), coins=state.coins, score=dist + coins*10;
      var bs=bestScore(); if (score>bs){ bs=score; try{localStorage.setItem('poopoo_best_score',bs);}catch(e){} }
      if(scoreBig) scoreBig.textContent=score.toLocaleString();
      if(statDist) statDist.textContent=dist+' m';
      if(statCoin) statCoin.textContent=coins+' 개';
      if(statBest) statBest.textContent=bs.toLocaleString();
    }
  }
  if(overlay) new MutationObserver(sync).observe(overlay, { attributes:true, attributeFilter:['class'] });
  if(ovStats) new MutationObserver(sync).observe(ovStats, { attributes:true, attributeFilter:['class'] });
  sync();
})();

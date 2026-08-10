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
  // record_box.png 아트의 빈 슬롯에 값을 채운다 (기록 저장·포맷은 ui.js 소관)
  function showRecords(){
    var r = (typeof getRecords==='function') ? getRecords()
                                             : { score:bestScore(), coins:0, at:0, playMs:0 };
    var set=function(id,v){ var el=byId(id); if(el) el.textContent=v; };
    var has = r.score > 0;
    set('recScore', has ? r.score.toLocaleString() : '');
    // 휴지 0개로 세운 기록도 "0 개" 로 보여야 한다 (0 을 falsy 로 걸러 "-" 가 뜨던 문제)
    set('recCoins', has ? r.coins.toLocaleString()+' 개' : '-');
    set('recDate',  r.at && typeof recFmtDate==='function' ? recFmtDate(r.at) : '-');
    set('recTime',  r.playMs && typeof recFmtPlay==='function' ? recFmtPlay(r.playMs) : '-');
    // 기록이 하나도 없으면 점수 자리에 안내 문구를 대신 보여준다
    if(recBody) recBody.classList.toggle('hidden', has);
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

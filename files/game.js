"use strict";
/* ============================================================
   PooPoo — pseudo-3D lane-runner racing (single file)
   ============================================================ */
const cv=document.getElementById('world'), ctx=cv.getContext('2d');
let W=0,H=0,DPR=1,HORIZON=0;
function resize(){
  DPR=Math.min(2,window.devicePixelRatio||1);
  W=cv.clientWidth;H=cv.clientHeight;
  cv.width=W*DPR;cv.height=H*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);
  HORIZON=H*0.36;
}
window.addEventListener('resize',resize);resize();

/* ---------- audio ---------- */
let AC=null;
function ac(){if(!AC){try{AC=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}return AC;}
function beep(f,d,t,v,to){f=f||440;d=d||.12;t=t||'square';v=v||.2;const a=ac();if(!a)return;
  const o=a.createOscillator(),g=a.createGain();o.type=t;o.frequency.value=f;
  if(to)o.frequency.exponentialRampToValueAtTime(to,a.currentTime+d);
  g.gain.value=v;g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+d);
  o.connect(g).connect(a.destination);o.start();o.stop(a.currentTime+d);}
function noise(d,fF,fT,v){d=d||.4;fF=fF||700;fT=fT||1600;v=v||.35;const a=ac();if(!a)return;
  const b=a.createBuffer(1,a.sampleRate*d,a.sampleRate),ch=b.getChannelData(0);
  for(let i=0;i<ch.length;i++)ch[i]=(Math.random()*2-1)*Math.pow(1-i/ch.length,1.4);
  const s=a.createBufferSource();s.buffer=b;const bp=a.createBiquadFilter();bp.type='bandpass';
  bp.frequency.value=fF;bp.frequency.exponentialRampToValueAtTime(fT,a.currentTime+d*.9);
  const g=a.createGain();g.gain.value=v;g.gain.exponentialRampToValueAtTime(.001,a.currentTime+d);
  s.connect(bp).connect(g).connect(a.destination);s.start();}
const S={flush:()=>noise(.4,700,1700,.32),boost:()=>{beep(300,.3,'sawtooth',.22,900);noise(.3,600,1400,.2);},
  coin:()=>beep(1040,.07,'square',.15,1560),hit:()=>{beep(150,.25,'sawtooth',.28,60);noise(.2,300,120,.2);},
  item:()=>beep(760,.1,'square',.16,1140),use:()=>beep(520,.16,'triangle',.2,180),
  jump:()=>beep(600,.12,'sine',.18,1000),slide:()=>noise(.18,900,300,.18),
  tick:()=>beep(520,.1,'square',.2),go:()=>beep(900,.25,'square',.25),
  win:()=>{beep(700,.15,'square',.2);setTimeout(()=>beep(1050,.25,'square',.2),140);}};

/* ---------- projection (pseudo-3D) ---------- */
const FOCAL=270, CAM_BACK=200, CAM_Y=205, LANE_WX=54, ROAD_HALF=104, Z_FAR=920, CURVE_K=0.00020;
let curveVal=0;
function bend(relZ){return curveVal*relZ*relZ*CURVE_K;}
function project(worldX,worldY,relZ){
  const dz=relZ+CAM_BACK, sc=CAM_BACK/dz;
  return {x:W/2+bend(relZ)+worldX*FOCAL/dz, y:HORIZON+(CAM_Y-worldY)*FOCAL/dz, s:sc};
}

/* ---------- config ---------- */
const SPEED_BASE=305;
const DIFF={easy:{ai:.86,mist:.9,rub:.12},normal:{ai:.96,mist:.6,rub:.07},hard:{ai:1.04,mist:.35,rub:.035}};
const SKINS=[
  {id:'basic',nm:'기본',top:'😀',color:'#ffffff'},
  {id:'gold', nm:'황금',top:'👑',color:'#ffd23f'},
  {id:'cat',  nm:'고양이',top:'🐱',color:'#ffb3c6'},
  {id:'dino', nm:'공룡',top:'🦕',color:'#57c785'},
  {id:'space',nm:'우주',top:'👽',color:'#b18cff'},
];
const NAMES=["금변기","냄새킹","똥별","물총이","쾌변러","막힘이","황금똥"];
const RIVAL_COLORS=["#ff6b6b","#57c785","#38c6ff","#b18cff","#ff8a3d","#ff5fa2","#c0f542"];

const OBST=[
  {t:'jump', em:'🧻'},{t:'jump', em:'🌀'},
  {t:'slide',em:'💦'},{t:'slide',em:'🔧'},{t:'slide',em:'🫧'},
  {t:'lane', em:'🪠'},{t:'lane', em:'🤖'},{t:'lane', em:'🚽'},
  {t:'slip', em:'🧼'},{t:'slip', em:'🟦'}
];
const ITEMS={
  cannon:{em:'💧',nm:'물대포'}, bomb:{em:'🧻',nm:'휴지폭탄'}, missile:{em:'🪠',nm:'플런저미사일'},
  bidet:{em:'🚿',nm:'비데부스터'}, fresh:{em:'🌬️',nm:'방향제'}, golden:{em:'👑',nm:'황금변기'}
};
const ITEM_KEYS=Object.keys(ITEMS);

/* ---------- state ---------- */
let mode='race', diffKey='normal', skinIdx=0;
let state='menu';
let RACE_LEN=5200;
let racers=[], player=null, ents=[], fx=[], raceTime=0, finishedCount=0;
let elimTimer=0, aliveCount=8, shake=0, boostGauge=0;

/* ---------- world seed ---------- */
function pushObst(arr,z){
  const o=OBST[Math.floor(Math.random()*OBST.length)];
  const lane=Math.floor(Math.random()*3)-1;
  arr.push({kind:'obst',t:o.t,em:o.em,lane,z,resolved:false});
  if(Math.random()<0.5){ const safe=safeLane(lane); for(let k=0;k<3;k++) arr.push({kind:'coin',lane:safe,z:z+k*36,resolved:false}); }
}
function seedTrack(len){
  ents=[]; let z=520;
  while(z<len+800){
    const r=Math.random();
    if(r<0.62) pushObst(ents,z);
    else if(r<0.82){ const lane=Math.floor(Math.random()*3)-1; for(let k=0;k<4;k++) ents.push({kind:'coin',lane,z:z+k*34,resolved:false}); }
    else ents.push({kind:'item',lane:Math.floor(Math.random()*3)-1,z,resolved:false});
    z+=150+Math.random()*130;
  }
  ents.sort((a,b)=>a.z-b.z);
}
function safeLane(block){let l;do{l=Math.floor(Math.random()*3)-1;}while(l===block);return l;}
function appendTrack(){
  let z=ents[ents.length-1].z+150; const add=[];
  for(let i=0;i<40;i++){
    const r=Math.random();
    if(r<0.62) pushObst(add,z);
    else if(r<0.82){const lane=Math.floor(Math.random()*3)-1;for(let k=0;k<4;k++)add.push({kind:'coin',lane,z:z+k*34,resolved:false});}
    else add.push({kind:'item',lane:Math.floor(Math.random()*3)-1,z,resolved:false});
    z+=150+Math.random()*130;
  }
  ents=ents.concat(add);
}

/* ---------- racers ---------- */
function makeRacers(){
  racers=[];
  const n=mode==='time'?1:8;
  for(let i=0;i<n;i++){
    const isP=i===0;
    racers.push({
      id:i, isPlayer:isP, name:isP?'YOU':NAMES[i-1],
      color:isP?SKINS[skinIdx].color:RIVAL_COLORS[i-1],
      skin:isP?SKINS[skinIdx]:null,
      dist:0, speed:0, laneF:0, lane:0, y:0, vy:0, jumping:false, sliding:0,
      slip:0, stun:0, slow:0, boostT:0, bidetT:0, goldenT:0, blindT:0,
      item:null, itemTimer:1+Math.random()*3, laneTimer:0,
      finished:false, finishTime:0, alive:true, elimAt:0, livePlace:i+1, coins:0,
    });
  }
  player=racers[0];
}

/* ---------- input ---------- */
function laneMove(r,d){if(!r||r.finished||!r.alive)return;r.lane=Math.max(-1,Math.min(1,r.lane+d));}
function jump(r){if(!r||r.finished||!r.alive)return;if(!r.jumping&&r.sliding<=0){r.jumping=true;r.vy=560;if(r.isPlayer)S.jump();}}
function slide(r){if(!r||r.finished||!r.alive)return;if(!r.jumping){r.sliding=0.6;if(r.isPlayer)S.slide();}}
window.addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(e.repeat||state!=='race')return;
  if(e.code==='ArrowLeft'||e.code==='KeyA')laneMove(player,-1);
  else if(e.code==='ArrowRight'||e.code==='KeyD')laneMove(player,1);
  else if(e.code==='ArrowUp'||e.code==='KeyW')jump(player);
  else if(e.code==='ArrowDown'||e.code==='KeyS')slide(player);
  else if(e.code==='Space')useItem(player);
  else if(e.code==='ShiftLeft'||e.code==='ShiftRight')useBoost(player);
});
let tsx=0,tsy=0;
const gEl=document.getElementById('game');
gEl.addEventListener('touchstart',e=>{const t=e.changedTouches[0];tsx=t.clientX;tsy=t.clientY;},{passive:true});
gEl.addEventListener('touchend',e=>{
  if(state!=='race')return;
  const t=e.changedTouches[0],dx=t.clientX-tsx,dy=t.clientY-tsy;
  if(Math.abs(dx)<24&&Math.abs(dy)<24)return;
  if(Math.abs(dx)>Math.abs(dy))laneMove(player,dx>0?1:-1);
  else if(dy<0)jump(player);else slide(player);
},{passive:true});
function bindTap(id,fn){const el=document.getElementById(id);
  const h=e=>{e.preventDefault();if(state==='race')fn();};
  el.addEventListener('touchstart',h,{passive:false});el.addEventListener('mousedown',h);}
bindTap('tItem',()=>useItem(player));bindTap('tBoost',()=>useBoost(player));
if('ontouchstart'in window)document.body.classList.add('touch-on');

/* ---------- abilities ---------- */
function useBoost(r){
  if(!r||r.finished||!r.alive)return;
  if(r.isPlayer){if(boostGauge<25)return;boostGauge-=25;r.boostT=Math.max(r.boostT,1.3);S.boost();}
  else r.boostT=Math.max(r.boostT,1.2);
  for(let i=0;i<10;i++)fx.push(water(r));
}
function useItem(r){
  if(!r||r.finished||!r.alive||!r.item)return;
  const it=r.item;r.item=null;S.use();applyItem(r,it);
}
function applyItem(user,it){
  const alive=racers.filter(o=>o!==user&&o.alive&&!o.finished);
  const ahead=alive.filter(o=>o.dist>user.dist).sort((a,b)=>a.dist-b.dist)[0];
  const behind=alive.filter(o=>o.dist<user.dist).sort((a,b)=>b.dist-a.dist)[0];
  const leader=alive.slice().sort((a,b)=>b.dist-a.dist)[0];
  if(it==='cannon'&&ahead)knock(ahead,240);
  else if(it==='missile'&&leader){knock(leader,300);leader.stun=Math.max(leader.stun,.4);}
  else if(it==='bomb'&&behind){behind.slow=Math.max(behind.slow,1.4);if(behind.isPlayer)blind(1.6);}
  else if(it==='bidet'){user.bidetT=Math.max(user.bidetT,3);if(user.isPlayer)S.boost();}
  else if(it==='fresh'){alive.forEach(o=>{if(o.dist<user.dist)o.slow=Math.max(o.slow,3);});}
  else if(it==='golden')user.goldenT=Math.max(user.goldenT,4);
}
function knock(r,amt){r.dist=Math.max(0,r.dist-amt);r.speed*=0.5;if(r.isPlayer){shake=12;S.hit();}}
function blind(t){player.blindT=Math.max(player.blindT,t);}
function water(r){return{lane:r.laneF,rel:8,vy:-(100+Math.random()*160),vx:(Math.random()-.5)*120,
  x:0,y:0,life:.5,max:.5,c:'56,198,255',s:5+Math.random()*4};}

/* ---------- flow ---------- */
function startGame(){
  RACE_LEN=mode==='survive'?999999:(mode==='time'?6200:7200);
  seedTrack(mode==='survive'?16000:RACE_LEN);
  makeRacers();raceTime=0;finishedCount=0;boostGauge=0;
  aliveCount=racers.length;elimTimer=7;shake=0;curveVal=0;fx=[];
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('results').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('modeChip').textContent=mode==='race'?'일반 레이스':mode==='time'?'타임어택':'생존 모드';
  document.getElementById('rankTot').textContent='/'+racers.length;
  state='countdown';
  const cd=document.getElementById('countdown'),num=document.getElementById('cnum');
  cd.classList.remove('hidden');let n=3;num.textContent=n;num.style.color='';S.tick();
  const iv=setInterval(()=>{n--;
    if(n>0){num.textContent=n;S.tick();}
    else if(n===0){num.textContent='GO!';num.style.color='var(--gold)';S.go();}
    else{clearInterval(iv);cd.classList.add('hidden');state='race';}
  },800);
}

/* ---------- update ---------- */
function update(dt){
  raceTime+=dt;
  curveVal+=(Math.sin(player.dist*0.0009)*0.9-curveVal)*0.05;
  const cfg=DIFF[diffKey];

  racers.forEach(r=>{
    if(r.finished||!r.alive){r.speed*=0.92;r.dist+=r.speed*dt;return;}
    for(const k of ['slip','stun','slow','boostT','bidetT','goldenT','blindT'])if(r[k]>0)r[k]=Math.max(0,r[k]-dt);

    if(!r.isPlayer){
      r.laneTimer-=dt;
      if(r.laneTimer<=0){r.laneTimer=0.6+Math.random()*1.2;if(Math.random()<0.5)r.lane=Math.floor(Math.random()*3)-1;}
      r.itemTimer-=dt;
      if(r.item&&r.itemTimer<=0){r.itemTimer=2+Math.random()*3;if(Math.random()<0.8){applyItem(r,r.item);r.item=null;}}
      if(!r.item&&Math.random()<0.15*dt)r.item=ITEM_KEYS[Math.floor(Math.random()*ITEM_KEYS.length)];
      if(Math.random()<(cfg.mist*0.12)*dt)r.slow=Math.max(r.slow,.5);
    }

    r.laneF+=(r.lane-r.laneF)*Math.min(1,dt*12);
    if(r.slip>0)r.laneF+=Math.sin(raceTime*20+r.id)*0.05;

    if(r.jumping){r.vy-=1500*dt;r.y+=r.vy*dt;if(r.y<=0){r.y=0;r.jumping=false;r.vy=0;}}
    if(r.sliding>0)r.sliding-=dt;

    let mult=1;
    if(r.stun>0)mult*=0.4;
    if(r.slow>0)mult*=0.62;
    if(r.bidetT>0)mult*=1.9;else if(r.boostT>0)mult*=1.7;
    if(r.goldenT>0)mult=Math.max(mult,1.5);
    let target=SPEED_BASE*mult;
    if(!r.isPlayer){
      target*=cfg.ai;
      const gap=leaderDist()-r.dist;
      target*=1+Math.max(-0.05,Math.min(cfg.rub,gap/4000*cfg.rub*10));
    }
    if(r.speed<target)r.speed=Math.min(target,r.speed+520*dt);
    else r.speed=Math.max(target,r.speed-900*dt);
    r.dist+=r.speed*dt;

    if(r.isPlayer){
      resolvePlayer(r);
      if((r.boostT>0||r.bidetT>0)&&Math.random()<0.5)fx.push(water(r));
    }
  });

  computePlaces();

  if(mode!=='survive'){
    racers.forEach(r=>{if(!r.finished&&r.dist>=RACE_LEN)finishRacer(r);});
    if(player.finished)endSoon();
  }else{
    elimTimer-=dt;
    if(elimTimer<=0&&aliveCount>1){
      elimTimer=7;
      const last=racers.filter(r=>r.alive).sort((a,b)=>a.dist-b.dist)[0];
      last.alive=false;last.elimAt=raceTime;aliveCount--;
      if(last.isPlayer){shake=14;S.hit();endSoon();}
      else if(aliveCount===1){const win=racers.find(r=>r.alive);if(win){win.finished=true;win.finishTime=raceTime;}endSoon();}
    }
    if(ents.length&&player.dist>ents[ents.length-1].z-2000)appendTrack();
  }

  fx.forEach(p=>{p.y+=p.vy*dt;p.x+=p.vx*dt;p.vy+=600*dt;p.life-=dt;});
  fx=fx.filter(p=>p.life>0);
  if(shake>0)shake=Math.max(0,shake-dt*24);
}

function resolvePlayer(r){
  const eff=Math.round(r.laneF);
  for(const e of ents){
    if(e.resolved)continue;
    const rel=e.z-r.dist;
    if(rel>0)continue;
    e.resolved=true;
    if(rel<-40)continue;
    if(e.lane!==eff)continue;
    if(e.kind==='coin'){r.coins++;boostGauge=Math.min(100,boostGauge+9);S.coin();
      fx.push({lane:e.lane,rel:6,x:0,y:0,vy:-200,vx:0,life:.4,max:.4,c:'255,210,63',s:6});}
    else if(e.kind==='item'){if(!r.item){r.item=ITEM_KEYS[Math.floor(Math.random()*ITEM_KEYS.length)];S.item();}}
    else if(e.kind==='obst'){
      if(r.goldenT>0)continue;
      const air=r.jumping&&r.y>28, duck=r.sliding>0;
      let hit=false;
      if(e.t==='jump')hit=!air;
      else if(e.t==='slide')hit=!duck;
      else if(e.t==='lane')hit=true;
      else if(e.t==='slip'){if(!air)r.slip=Math.max(r.slip,0.9);continue;}
      if(hit){r.speed*=0.42;r.stun=Math.max(r.stun,0.5);r.dist-=14;shake=10;S.hit();
        for(let i=0;i<6;i++)fx.push({lane:e.lane,rel:6,x:0,y:0,vy:-150-Math.random()*150,vx:(Math.random()-.5)*160,life:.5,max:.5,c:'255,120,120',s:6});}
    }
  }
}

function leaderDist(){let m=0;racers.forEach(r=>{if(r.dist>m)m=r.dist;});return m;}
function computePlaces(){[...racers].sort(rankCmp).forEach((r,i)=>r.livePlace=i+1);}
function rankCmp(a,b){
  if(a.finished&&b.finished)return a.finishTime-b.finishTime;
  if(a.finished)return -1;if(b.finished)return 1;
  if(!a.alive&&!b.alive)return b.elimAt-a.elimAt;
  if(!a.alive)return 1;if(!b.alive)return -1;
  return b.dist-a.dist;
}
function finishRacer(r){if(r.finished)return;r.finished=true;r.finishTime=raceTime;finishedCount++;if(r.isPlayer)S.win();}
let endT=null;
function endSoon(){if(endT!==null)return;endT=setTimeout(()=>{endT=null;endRace();},1300);}
function endRace(){[...racers].sort(rankCmp).forEach((r,i)=>r.finalPlace=i+1);state='results';showResults([...racers].sort(rankCmp));}

/* ---------- render ---------- */
function draw(){
  ctx.clearRect(0,0,W,H);
  if(!player){return;}
  ctx.save();
  if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);
  drawBg();drawRoad();
  const list=[];
  for(const e of ents){const rel=e.z-player.dist;if(rel>-30&&rel<Z_FAR)list.push({rel,kind:e.kind,e});}
  if(mode!=='time')racers.forEach(r=>{if(r.isPlayer||!r.alive)return;const rel=r.dist-player.dist;
    if(rel>4&&rel<Z_FAR)list.push({rel,kind:'rival',r});});
  list.sort((a,b)=>b.rel-a.rel);
  for(const o of list){ if(o.kind==='rival')drawRival(o.r,o.rel); else drawEntity(o.e,o.rel); }
  drawFx();drawPlayer();
  ctx.restore();
  if(state==='race'||state==='countdown')updateHUD();
}
function drawBg(){
  const g=ctx.createLinearGradient(0,0,0,HORIZON);
  g.addColorStop(0,'#0a3a4a');g.addColorStop(1,'#12667a');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,HORIZON+4);
  ctx.fillStyle='rgba(255,255,255,.05)';
  for(let i=-2;i<=2;i++){ctx.beginPath();ctx.arc(W/2+i*W/4+bend(Z_FAR),HORIZON,60,Math.PI,0);ctx.fill();}
  ctx.fillStyle='#0c2029';ctx.fillRect(0,HORIZON,W,H-HORIZON);
}
function edge(side,relZ){return project(side*ROAD_HALF,0,relZ);}
function drawRoad(){
  const N=34;
  for(let i=0;i<N;i++){
    const zA=Z_FAR*(i/N),zB=Z_FAR*((i+1)/N);
    const lA=edge(-1,zA),rA=edge(1,zA),lB=edge(-1,zB),rB=edge(1,zB);
    const seg=Math.floor((player.dist+zA)/60)%2;
    ctx.fillStyle=seg?'#20323a':'#26404a';
    ctx.beginPath();ctx.moveTo(lA.x,lA.y);ctx.lineTo(rA.x,rA.y);ctx.lineTo(rB.x,rB.y);ctx.lineTo(lB.x,lB.y);ctx.closePath();ctx.fill();
    ctx.fillStyle=seg?'#15252c':'#1a2e36';
    const glA=project(-ROAD_HALF-46,0,zA),glB=project(-ROAD_HALF-46,0,zB);
    const grA=project(ROAD_HALF+46,0,zA),grB=project(ROAD_HALF+46,0,zB);
    ctx.beginPath();ctx.moveTo(lA.x,lA.y);ctx.lineTo(lB.x,lB.y);ctx.lineTo(glB.x,glB.y);ctx.lineTo(glA.x,glA.y);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(rA.x,rA.y);ctx.lineTo(rB.x,rB.y);ctx.lineTo(grB.x,grB.y);ctx.lineTo(grA.x,grA.y);ctx.closePath();ctx.fill();
  }
  [-26,26].forEach(lx=>{
    for(let z=0;z<Z_FAR;z+=60){
      if(!(Math.floor((player.dist+z)/60)%2))continue;
      const a=project(lx,0,z),b=project(lx,0,Math.min(Z_FAR,z+34));
      ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=Math.max(1,3*a.s);
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
  });
}
function emoji(txt,x,y,size){ctx.font=size+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(txt,x,y);}
function drawEntity(e,rel){
  const p=project(e.lane*LANE_WX,e.kind==='obst'?0:14,rel);
  const sz=(e.kind==='coin'?30:e.kind==='item'?40:48)*p.s;
  if(e.kind==='coin')emoji('🪙',p.x,p.y-sz*0.2+Math.sin(raceTime*6+e.z)*3,sz);
  else if(e.kind==='item'){
    ctx.save();ctx.globalAlpha=.9;ctx.fillStyle='rgba(177,140,255,.25)';
    ctx.beginPath();ctx.arc(p.x,p.y-sz*0.3,sz*0.6,0,7);ctx.fill();ctx.restore();
    emoji('🎁',p.x,p.y-sz*0.3+Math.sin(raceTime*5)*3,sz);
  }else{
    emoji(e.em,p.x,p.y-sz*0.35,sz);
    const tag=e.t==='jump'?'⬆':e.t==='slide'?'⬇':e.t==='slip'?'≈':'⟷';
    ctx.fillStyle='rgba(255,255,255,'+Math.min(.8,p.s)+')';ctx.font=(14*p.s)+'px sans-serif';
    ctx.textAlign='center';ctx.fillText(tag,p.x,p.y+6*p.s);
  }
}
function drawToilet(x,y,size,skinColor,topEm,wob){
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(0,size*0.32,size*0.42,size*0.16,0,0,7);ctx.fill();
  ctx.fillStyle=skinColor;ctx.globalAlpha=.9;ctx.beginPath();ctx.arc(0,0,size*0.5,0,7);ctx.fill();
  ctx.globalAlpha=1;ctx.fillStyle='rgba(255,255,255,.85)';ctx.beginPath();ctx.arc(0,0,size*0.4,0,7);ctx.fill();
  if(wob)ctx.rotate(wob);
  emoji('🚽',0,size*0.04,size*0.9);
  if(topEm)emoji(topEm,0,-size*0.5,size*0.5);
  ctx.restore();
}
function drawRival(r,rel){
  const p=project(r.laneF*LANE_WX,r.y*0.5,rel);const size=52*p.s;
  drawToilet(p.x,p.y-size*0.3,size,r.color,null,r.slip>0?Math.sin(raceTime*20+r.id)*0.3:0);
  if(r.boostT>0||r.bidetT>0)emoji('💨',p.x,p.y+4,26*p.s);
  ctx.fillStyle='rgba(255,255,255,'+Math.min(.9,p.s)+')';ctx.font='bold '+(13*p.s)+'px "Trebuchet MS"';
  ctx.textAlign='center';ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=3;
  ctx.strokeText(r.name,p.x,p.y-size*0.9);ctx.fillText(r.name,p.x,p.y-size*0.9);
  if(r.goldenT>0){ctx.strokeStyle='rgba(255,210,63,.8)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y-size*0.3,size*0.6,0,7);ctx.stroke();}
}
function drawPlayer(){
  const r=player,p=project(r.laneF*LANE_WX,r.y,0),size=58,squish=r.sliding>0?0.6:1;
  ctx.save();ctx.translate(p.x,p.y-size*0.3);ctx.scale(1,squish);
  drawToilet(0,0,size,r.skin.color,r.skin.top,r.slip>0?Math.sin(raceTime*22)*0.28:0);
  ctx.restore();
  if(r.boostT>0||r.bidetT>0)emoji('💨',p.x,p.y+14,30);
  if(r.goldenT>0){ctx.strokeStyle='rgba(255,210,63,'+(0.5+Math.sin(raceTime*20)*0.4)+')';ctx.lineWidth=5;
    ctx.beginPath();ctx.arc(p.x,p.y-size*0.3,size*0.7,0,7);ctx.stroke();}
  if(r.stun>0)emoji('💫',p.x,p.y-size,26);
}
function drawFx(){
  fx.forEach(o=>{
    const p=project((o.lane||0)*LANE_WX,0,o.rel||8);
    const a=Math.max(0,o.life/o.max);
    ctx.fillStyle='rgba('+o.c+','+a+')';
    ctx.beginPath();ctx.arc(p.x+(o.x||0),p.y+(o.y||0),o.s*p.s,0,7);ctx.fill();
  });
}

/* ---------- HUD ---------- */
const el={rank:document.getElementById('rankV'),coin:document.getElementById('coinV'),
  fill:document.getElementById('progFill'),flag:document.getElementById('flag'),
  slot:document.getElementById('itemSlot'),itemEm:document.getElementById('itemEm'),
  boostBar:document.querySelector('#boostBar>i'),boostBox:document.getElementById('boostBox'),
  spd:document.getElementById('spd'),track:document.getElementById('progTrack'),
  progLabel:document.getElementById('progLabel'),blind:document.getElementById('blind')};
let pdots=[];
function ensureDots(){if(pdots.length)return;racers.forEach(()=>{const d=document.createElement('div');d.className='pdot';el.track.appendChild(d);pdots.push(d);});}
function updateHUD(){
  if(!player)return;
  el.rank.textContent=player.livePlace||1;
  el.coin.textContent=player.coins;
  el.spd.innerHTML=Math.round(player.speed/3)+' <span>km/h</span>';
  if(mode==='survive'){el.progLabel.textContent='생존 '+aliveCount+'명 · 탈락까지 '+Math.max(0,Math.ceil(elimTimer))+'s';
    el.fill.style.width=Math.min(100,(player.dist%3000)/30)+'%';el.flag.textContent='☠️';}
  else{const pct=Math.min(100,player.dist/RACE_LEN*100);
    el.fill.style.width=pct+'%';el.flag.textContent='🏁';
    el.progLabel.textContent='남은 거리 '+Math.max(0,Math.round((RACE_LEN-player.dist)/10))+'m';}
  if(mode==='race'){ensureDots();
    racers.forEach((r,i)=>{if(!pdots[i])return;pdots[i].style.left=Math.min(100,r.dist/RACE_LEN*100)+'%';
      pdots[i].style.background=r.color;pdots[i].style.width=r.isPlayer?'12px':'9px';
      pdots[i].style.height=r.isPlayer?'12px':'9px';pdots[i].style.zIndex=r.isPlayer?5:2;});}
  if(player.item){el.slot.classList.remove('empty');el.itemEm.textContent=ITEMS[player.item].em;}
  else{el.slot.classList.add('empty');el.itemEm.textContent='—';}
  el.boostBar.style.width=boostGauge+'%';el.boostBox.classList.toggle('ready',boostGauge>=25);
  el.blind.classList.toggle('on',player.blindT>0);
}

/* ---------- results ---------- */
function showResults(order){
  document.getElementById('hud').classList.add('hidden');
  pdots.forEach(d=>d.remove());pdots=[];el.blind.classList.remove('on');
  const me=order.findIndex(r=>r.isPlayer)+1;
  const medal=me===1?'🥇':me===2?'🥈':me===3?'🥉':'🚽';
  document.getElementById('placeTxt').textContent=me===1?'🥇 우승!!':(me+'위 '+medal);
  document.getElementById('resTitle').textContent=mode==='time'?'기록':'최종 순위';
  const box=document.getElementById('stand');box.innerHTML='';
  if(mode==='time'){
    const row=document.createElement('div');row.className='r me';
    row.innerHTML='<div class="nm">🚽 <b>YOU</b></div><div>'+player.finishTime.toFixed(2)+'s</div>';box.appendChild(row);
  }else{
    order.forEach((r,i)=>{
      const row=document.createElement('div');row.className='r'+(r.isPlayer?' me':'');
      const mk=i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1);
      const tail=r.finished?r.finishTime.toFixed(1)+'s':(!r.alive?'탈락':'DNF');
      row.innerHTML='<div class="nm"><span style="width:22px;text-align:center;display:inline-block">'+mk+'</span>🚽 '+(r.isPlayer?'<b>YOU</b>':r.name)+'</div><div>'+tail+'</div>';
      box.appendChild(row);
    });
  }
  const bonus=me===1?200:me===2?120:me===3?80:40;
  document.getElementById('coinEarn').textContent=player.coins*3+bonus;
  document.getElementById('mvp').textContent=order[0].isPlayer?'YOU 👑':order[0].name;
  document.getElementById('results').classList.remove('hidden');
  if(me===1)S.win();
}

/* ---------- menu ---------- */
function buildSkins(){
  const row=document.getElementById('skinRow');row.innerHTML='';
  SKINS.forEach((s,i)=>{const d=document.createElement('div');d.className='skin'+(i===0?' sel':'');
    d.innerHTML='<div class="em">'+s.top+'</div><div class="nm">'+s.nm+' 변기</div>';
    d.addEventListener('click',()=>{document.querySelectorAll('.skin').forEach(x=>x.classList.remove('sel'));
      d.classList.add('sel');skinIdx=i;beep(680,.06,'square',.12);});row.appendChild(d);});
}
buildSkins();
document.querySelectorAll('#modeSeg button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#modeSeg button').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');mode=b.dataset.m;beep(640,.06,'square',.12);}));
document.querySelectorAll('#diffSeg button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#diffSeg button').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');diffKey=b.dataset.d;beep(720,.06,'square',.12);}));
document.getElementById('startBtn').addEventListener('click',()=>{ac();startGame();});
document.getElementById('againBtn').addEventListener('click',()=>{
  document.getElementById('results').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');state='menu';});

/* ---------- loop ---------- */
let last=performance.now();
function loop(now){
  let dt=(now-last)/1000;last=now;dt=Math.min(dt,0.05);
  if(state==='race')update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

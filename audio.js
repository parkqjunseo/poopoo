/* ============================================
   audio.js — 🔧 B담당 (엔진/시스템)
   WebAudio 효과음. 새 효과음은 sfx에 추가.

   합성 재료 두 가지
     beep()  : 오실레이터 — 음정이 있는 소리 (점프, 코인, 물 튀는 소리)
     noise() : 필터드 화이트노이즈 — 음정이 없는 소리 (발소리, 마찰, 파열, 물)
   ============================================ */
'use strict';

let AC = null;
function audio() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === 'suspended') AC.resume();
  return AC;
}

// 모든 소리가 거쳐가는 마스터 버스 — 동시에 여러 소리가 나도 찢어지지 않게 압축
let MASTER = null;
function master() {
  const ac = audio();
  if (!MASTER) {
    MASTER = ac.createGain();
    MASTER.gain.value = 0.9;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -10;   // 와장창 뒤에 오는 소리까지 눌러버리지 않게 완만하게
    comp.ratio.value = 4;
    comp.release.value = 0.45;
    MASTER.connect(comp);
    comp.connect(ac.destination);
  }
  return MASTER;
}

/* ============================================
   배경음악 — 페이드 인으로 시작, 게임오버 때 페이드 아웃.
   무한 반복은 곡을 그냥 이어붙이면 이음매에서 뚝 끊기므로,
   한 회차의 끝과 다음 회차의 앞을 서로 겹쳐(크로스페이드) 넘어가게 한다.
   ============================================ */
const BGM_SRC   = 'bgm-quick-silver-jump.mp3';
const BGM_VOL   = 0.3;    // 효과음에 묻히지 않을 정도
const BGM_FADE  = 1.4;    // 시작·종료 페이드(초)
const BGM_XFADE = 2.0;    // 반복 이음매에서 겹치는 길이(초)

let bgmBuf = null, bgmGainNode = null, bgmSources = [];
let bgmTimer = null, bgmNextAt = 0, bgmLoading = false, bgmWanted = false;

function bgmGain() {
  const ac = audio();
  if (!bgmGainNode) {
    bgmGainNode = ac.createGain();
    bgmGainNode.gain.value = 0;
    bgmGainNode.connect(master());
  }
  return bgmGainNode;
}

function loadBgm() {
  if (bgmBuf || bgmLoading) return;
  bgmLoading = true;
  fetch(BGM_SRC)
    .then(r => r.arrayBuffer())
    .then(b => audio().decodeAudioData(b))
    .then(buf => {
      bgmBuf = buf; bgmLoading = false;
      if (bgmWanted) bgm.start();      // 로딩 끝나면 밀린 재생 요청 처리
    })
    .catch(() => { bgmLoading = false; });   // 실패해도 게임은 그대로 진행
}

// 한 회차를 예약하고, 다음 회차가 시작될 시각을 돌려준다
function bgmScheduleOnce(startAt) {
  const ac = audio();
  const dur = bgmBuf.duration;
  const x = Math.min(BGM_XFADE, dur / 3);
  const src = ac.createBufferSource();
  src.buffer = bgmBuf;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, startAt);
  g.gain.linearRampToValueAtTime(1, startAt + x);          // 앞부분 서서히 올라오고
  g.gain.setValueAtTime(1, startAt + dur - x);
  g.gain.linearRampToValueAtTime(0.0001, startAt + dur);   // 뒷부분 서서히 빠진다
  src.connect(g); g.connect(bgmGain());
  src.start(startAt);
  src.stop(startAt + dur + 0.05);
  src.onended = () => { bgmSources = bgmSources.filter(s => s !== src); };
  bgmSources.push(src);
  return startAt + dur - x;    // 겹치는 만큼 당겨서 다음 회차 시작
}

// 몇 초 앞까지 미리 예약해 둬야 끊김 없이 이어진다
function bgmPump() {
  if (!bgmBuf) return;
  const ac = audio();
  while (bgmNextAt < ac.currentTime + 4) bgmNextAt = bgmScheduleOnce(bgmNextAt);
}

const bgm = {
  start: () => {
    bgmWanted = true;
    if (!bgmBuf) { loadBgm(); return; }
    const ac = audio();
    bgm.stop(0);                       // 이전 재생이 남아 있으면 정리
    bgmWanted = true;
    bgmNextAt = ac.currentTime + 0.05;
    bgmPump();
    const g = bgmGain().gain;
    g.cancelScheduledValues(ac.currentTime);
    g.setValueAtTime(0.0001, ac.currentTime);
    g.linearRampToValueAtTime(BGM_VOL, ac.currentTime + BGM_FADE);
    clearInterval(bgmTimer);
    bgmTimer = setInterval(bgmPump, 1000);
  },
  stop: (ms = 900) => {
    bgmWanted = false;
    clearInterval(bgmTimer); bgmTimer = null;
    if (!bgmGainNode) return;
    const ac = audio(), g = bgmGain().gain;
    const t = ac.currentTime + ms / 1000;
    g.cancelScheduledValues(ac.currentTime);
    g.setValueAtTime(g.value, ac.currentTime);
    g.linearRampToValueAtTime(0.0001, Math.max(t, ac.currentTime + 0.01));
    const srcs = bgmSources.slice();
    bgmSources = [];
    srcs.forEach(s => { try { s.stop(t + 0.05); } catch (e) {} });
  },
  // 음소거 토글 — 켜면 true 반환
  toggle: () => {
    if (bgmTimer) { bgm.stop(300); return false; }
    bgm.start(); return true;
  },
};

/* ============================================
   파일 기반 효과음
   짧은 오디오 클립(wav/mp3 모두 가능)을 미리 디코딩해 두고 필요할 때 재생한다.
     vol  : 음량
     from : 클립에서 잘라 쓸 시작 위치(초)
     len  : 재생 길이(초), 0이면 클립 전체
   파일이 없거나 디코딩에 실패하면 각 소리의 합성음으로 자동 대체된다.
   ============================================ */
const CLIPS = {
  jump:  { src: 'sfx-jump.wav',  vol: 0.5,  from: 0, len: 0 },   // 1단 점프
  jump2: { src: 'sfx-jump2.wav', vol: 0.5,  from: 0, len: 0 },   // 2단 점프
  slide: { src: 'sfx-slide.wav', vol: 0.5,  from: 0, len: 0 },   // 슬라이딩
  lane:  { src: 'sfx-lane.wav',  vol: 0.35, from: 0, len: 0 },   // 좌우 이동
  coin:  { src: 'sfx-coin.wav',  vol: 0.45, from: 0, len: 0 },   // 휴지 획득
  hurt:  { src: 'sfx-hurt.wav',  vol: 0.5,  from: 0, len: 0 },   // 목숨 감소 (그 외는 합성음)
};

function loadClips() {
  for (const c of Object.values(CLIPS)) {
    if (c.buf || c.loading) continue;
    c.loading = true;
    fetch(c.src)
      .then(r => r.arrayBuffer())
      .then(b => audio().decodeAudioData(b))
      .then(buf => { c.buf = buf; c.loading = false; })
      .catch(() => { c.loading = false; c.failed = true; });
  }
}

// 재생 중인 클립을 짧게 줄이며 멈춘다 (그냥 끊으면 '딱' 하는 잡음이 난다)
function stopClip(name) {
  const c = CLIPS[name];
  if (!c || !c.playing) return;
  try {
    const ac = audio();
    const { src, gain } = c.playing;
    gain.gain.cancelScheduledValues(ac.currentTime);
    gain.gain.setValueAtTime(gain.gain.value, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.03);
    src.stop(ac.currentTime + 0.04);
  } catch (e) {}
  c.playing = null;
}

// rate: 재생 속도(=음정). 같은 소리를 살짝 다르게 쓰고 싶을 때 사용
function playClip(name, rate = 1) {
  const c = CLIPS[name];
  if (!c) return false;
  if (!c.buf) { if (!c.failed) loadClips(); return false; }
  try {
    const ac = audio();
    stopClip(name);   // 연달아 재생될 때 소리가 겹쳐 쌓이지 않도록
    const src = ac.createBufferSource();
    src.buffer = c.buf;
    src.playbackRate.value = rate;
    const gain = ac.createGain();
    gain.gain.value = c.vol;
    src.connect(gain); gain.connect(master());
    if (c.len > 0) src.start(0, c.from, c.len); else src.start(0, c.from);
    const mine = { src, gain };
    c.playing = mine;
    src.onended = () => { if (c.playing === mine) c.playing = null; };
    return true;
  } catch (e) { return false; }
}

// env를 주면 부드럽게 부풀었다 사라지는 음 (화음·지속음)
// 생략하면 튕기듯 감쇠하는 음 (타격음·짧은 신호음)
function beep(freq, dur, type = 'square', vol = 0.12, slide = 0, env) {
  try {
    const ac = audio();
    const o = ac.createOscillator(), g = ac.createGain();
    const t0 = ac.currentTime;
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    if (env) {
      const a = env.attack || 0.01, h = env.hold || 0;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + a);
      g.gain.setValueAtTime(vol, t0 + a + h);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    } else {
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    }
    o.connect(g); g.connect(master());
    o.start(); o.stop(t0 + dur);
  } catch (e) {}
}

// 오실레이터 하나로 여러 음을 이어서 연주한다.
// 음이 바뀔 때 끊고 다시 치는 게 아니라 음정이 미끄러지듯 옮겨가서(레가토)
// 멜로디가 뚝뚝 끊기지 않고 자연스럽게 이어진다.
//   notes: [{ f: 주파수, t: 시작 시각(초) }, ...]
function melody(notes, opts = {}) {
  try {
    const ac = audio();
    const o = ac.createOscillator(), g = ac.createGain();
    const t0 = ac.currentTime;
    const vol = opts.vol != null ? opts.vol : 0.12;
    const glide = opts.glide != null ? opts.glide : 0.05;   // 음 사이를 미끄러지는 시간
    const last = notes[notes.length - 1];
    const end = last.t + (opts.tail || 0.5);
    o.type = opts.type || 'square';

    // 음정 — 각 음을 유지하다 다음 음 직전에 부드럽게 미끄러진다
    o.frequency.setValueAtTime(notes[0].f, t0);
    for (let i = 1; i < notes.length; i++) {
      const st = t0 + notes[i].t;
      o.frequency.setValueAtTime(notes[i - 1].f, Math.max(t0, st - glide));
      o.frequency.exponentialRampToValueAtTime(notes[i].f, st);
    }

    // 음량 — 음이 바뀔 때마다 살짝 눌렀다 펴서 또박또박 들리게 (완전 평평하면 사이렌처럼 들림)
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (opts.attack || 0.04));
    for (let i = 1; i < notes.length; i++) {
      const st = t0 + notes[i].t;
      g.gain.setValueAtTime(vol * 0.7, Math.max(t0 + 0.001, st - glide));
      g.gain.linearRampToValueAtTime(vol, st + 0.035);
    }
    g.gain.setValueAtTime(vol, t0 + last.t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + end);

    o.connect(g); g.connect(master());
    o.start(); o.stop(t0 + end);
  } catch (e) {}
}

// 화이트노이즈 버퍼는 한 번만 만들어 재사용
let NOISE_BUF = null;
function noiseBuffer() {
  const ac = audio();
  if (!NOISE_BUF) {
    const len = ac.sampleRate * 2;
    NOISE_BUF = ac.createBuffer(1, len, ac.sampleRate);
    const d = NOISE_BUF.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return NOISE_BUF;
}

// f0 → f1 으로 필터가 훑고 지나가는 노이즈
//   env를 주면 "붙었다 유지되다 사라지는" 소리 (물소리·군중처럼 길게 끄는 소리)
//   env를 생략하면 즉시 감쇠하는 타격음 (발소리·파열음)
function noise(dur, vol, type, f0, f1, q = 1, env) {
  try {
    const ac = audio();
    const src = ac.createBufferSource();
    src.buffer = noiseBuffer();
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4; // 같은 버퍼라도 매번 다르게
    const flt = ac.createBiquadFilter();
    flt.type = type;
    const t0 = ac.currentTime;
    flt.frequency.setValueAtTime(Math.max(40, f0), t0);
    if (f1 && f1 !== f0) {
      flt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
    }
    flt.Q.value = q;
    const g = ac.createGain();
    if (env) {
      const a = env.attack || 0.01;
      const h = env.hold || 0;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + a);
      g.gain.setValueAtTime(vol, t0 + a + h);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    } else {
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    }
    src.connect(flt); flt.connect(g); g.connect(master());
    src.start(); src.stop(t0 + dur);
  } catch (e) {}
}

const sfx = {
  // ---------- 이동 모션 ----------
  // 산책로를 딛는 발소리 (한 걸음마다, 매번 살짝 다르게)
  step: () => {
    noise(0.07, 0.075, 'lowpass', 800 + Math.random() * 400, 240, 1);
    beep(92 + Math.random() * 26, 0.06, 'sine', 0.05, -32);
  },
  // 도약 — mp3 클립
  jump: () => {
    if (playClip('jump')) return;
    beep(280, 0.2, 'sine', 0.15, 340);
    noise(0.13, 0.06, 'bandpass', 650, 2400, 0.8);
  },
  // 2단 점프 — mp3 클립. 1단 소리가 아직 울리는 중이면 겹치지 않게 걷어낸다
  jump2: () => {
    stopClip('jump');
    if (playClip('jump2')) return;
    beep(450, 0.18, 'sine', 0.13, 430);
    beep(690, 0.14, 'triangle', 0.075, 520);
    noise(0.12, 0.05, 'bandpass', 1300, 3400, 0.9);
  },
  // 착지 — 도자기가 바닥에 쿵
  land: () => {
    beep(125, 0.16, 'sine', 0.16, -65);
    noise(0.13, 0.1, 'lowpass', 750, 170, 1);
  },
  // 슬라이딩 — 클립. 실패하면 합성음 후보(slideVariants)로 대체
  slide: () => { if (!playClip('slide')) slideVariants[SLIDE_PICK](); },
  // 좌우 이동 — 클립. 실패하면 기존 합성음으로 대체
  lane: () => { if (!playClip('lane')) beep(500, 0.06, 'triangle', 0.08); },
  // 휴지 획득 — 클립. 실패하면 기존 합성음으로 대체
  coin: () => {
    if (playClip('coin')) return;
    beep(1180, 0.09, 'square', 0.09);
    setTimeout(() => beep(1570, 0.12, 'square', 0.09), 60);
  },
  throw: () => beep(950, 0.28, 'sawtooth', 0.06, -600),

  // ---------- 피격 ----------
  // 목숨 감소 — mp3 클립. 실패하면 기존 합성음으로 대체
  hurt: () => {
    if (playClip('hurt')) return;
    beep(320, 0.22, 'square', 0.16, -160);
    setTimeout(() => beep(200, 0.26, 'triangle', 0.13, -90), 90);
  },
  // 목숨 감소 — 도자기에 쩍 하고 금이 간다
  crack: () => {
    noise(0.05, 0.13, 'highpass', 3200, 3200, 1);
    beep(2400, 0.05, 'square', 0.09, -1400);
    setTimeout(() => {
      beep(1500, 0.07, 'square', 0.07, -900);
      noise(0.09, 0.08, 'bandpass', 1900, 650, 2);
    }, 55);
  },

  // ---------- 게임오버 ----------
  // 와장창!!! — 변기 다리가 산산조각 (뒤에 올 소리를 덮지 않도록 짧고 굵게)
  shatter: () => {
    noise(0.22, 0.28, 'highpass', 2800, 900, 0.7); // 터지는 순간
    beep(115, 0.42, 'sawtooth', 0.18, -58);        // 묵직한 충격
    for (let i = 0; i < 8; i++) {                  // 파편이 사방으로 튄다
      setTimeout(() => {
        beep(2900 - i * 210 + Math.random() * 700, 0.06, 'square', 0.06, -1500);
        noise(0.08, 0.055, 'bandpass', 2200 + Math.random() * 2000, 900, 3);
      }, 35 + i * 45);
    }
    setTimeout(() => noise(0.35, 0.06, 'lowpass', 420, 130, 1), 230); // 잔해가 구름
  },

  // 게임오버 음악 — 하강하는 멜로디 + 낮은 단조 화음 (↓ gameOverMusic 에서 고름)
  gameOver: () => gameOverMusic[GAMEOVER_PICK](),
  crash: () => { beep(140, 0.4, 'sawtooth', 0.22, -90); beep(90, 0.55, 'square', 0.18, -50); },
};

/* ============================================
   슬라이딩 효과음 후보
   sound-test.html 에서 들어보고 SLIDE_PICK 만 바꾸면 교체됩니다.
   ============================================ */
const slideVariants = {
  // A. 스키드 — 공명이 확 내려꽂히는 "슈욱", 속도감이 가장 큼
  skid: () => {
    noise(0.5, 0.2, 'bandpass', 3000, 560, 9, { attack: 0.03, hold: 0.09 });
    noise(0.45, 0.05, 'highpass', 1900, 900, 1, { attack: 0.04, hold: 0.08 });
  },

  // B. 사각사각 — 옷이 바닥에 쓸리는 마른 마찰음, 튀지 않고 자연스러움
  scrape: () => {
    noise(0.6, 0.15, 'bandpass', 1100, 700, 2.5, { attack: 0.08, hold: 0.24 });
    noise(0.6, 0.07, 'lowpass', 1300, 480, 1, { attack: 0.09, hold: 0.22 });
  },

  // C. 휘익 — 공기를 가르며 지나가는 부드러운 바람 소리
  whoosh: () => {
    noise(0.65, 0.17, 'highpass', 600, 2600, 0.9, { attack: 0.15, hold: 0.1 });
    noise(0.65, 0.09, 'bandpass', 1700, 750, 1.5, { attack: 0.17, hold: 0.08 });
  },

  // D. 뾰로롱 — 만화식 슬라이드 휘슬. 게임의 코믹한 톤과 가장 잘 맞음
  whistle: () => {
    beep(1100, 0.4, 'sine', 0.1, -820, { attack: 0.03, hold: 0.05 });
    beep(2200, 0.4, 'sine', 0.028, -1650, { attack: 0.03, hold: 0.05 });
    noise(0.36, 0.045, 'bandpass', 1500, 520, 3, { attack: 0.04, hold: 0.05 });
  },

  // E. 짧게 쓱— 툭 — 미끄러지다 바닥에 걸려 멈추는 느낌
  brake: () => {
    noise(0.32, 0.18, 'bandpass', 2200, 820, 6, { attack: 0.02, hold: 0.06 });
    setTimeout(() => noise(0.16, 0.09, 'lowpass', 520, 200, 1), 290);
  },
};
let SLIDE_PICK = 'whistle';   // ← 여기만 바꾸면 게임에 적용됨

/* ============================================
   게임오버 음악
   sound-test.html 에서 들어보고 GAMEOVER_PICK 만 바꾸면 교체됩니다.
   ============================================ */
const gameOverMusic = {
  // A. 레트로 아케이드 — 음이 미끄러지듯 내려오다 Dm 화음으로 잦아든다
  retro: () => {
    melody([                       // D5 → C#5 → B4 → A#4
      { f: 587.33, t: 0    },
      { f: 554.37, t: 0.19 },
      { f: 493.88, t: 0.38 },
      { f: 466.16, t: 0.57 },
    ], { type: 'square', vol: 0.115, glide: 0.055, attack: 0.05, tail: 0.52 });
    setTimeout(() => {             // 멜로디 꼬리와 겹치며 스르르 올라오는 Dm 화음
      beep(293.66, 1.7, 'square',   0.09,  0, { attack: 0.09, hold: 0.55 }); // D4
      beep(349.23, 1.7, 'square',   0.075, 0, { attack: 0.11, hold: 0.50 }); // F4
      beep(440.00, 1.7, 'square',   0.06,  0, { attack: 0.13, hold: 0.45 }); // A4
      beep(146.83, 1.9, 'triangle', 0.125, 0, { attack: 0.07, hold: 0.70 }); // D3
      beep(73.42,  2.0, 'sine',     0.125, 0, { attack: 0.08, hold: 0.80 }); // D2
    }, 830);
  },

  // B. 뿌우— 실패 트롬본 — 음과 음이 미끄러져 붙는 "왕 왕 왕 와아앙"
  trombone: () => {
    melody([                       // C4 → A#3 → G#3 → G3
      { f: 261.63, t: 0    },
      { f: 233.08, t: 0.34 },
      { f: 207.65, t: 0.68 },
      { f: 196.00, t: 1.02 },
    ], { type: 'sawtooth', vol: 0.14, glide: 0.13, attack: 0.05, tail: 1.05 });
    setTimeout(() => beep(92.50, 1.3, 'sine', 0.11, 0, { attack: 0.08, hold: 0.5 }), 1020);
  },

  // C. 무겁게 가라앉는 — 저음이 서서히 내려앉는 진지한 버전
  somber: () => {
    melody([                       // A3 → G3 → F3
      { f: 220.00, t: 0    },
      { f: 196.00, t: 0.55 },
      { f: 174.61, t: 1.10 },
    ], { type: 'triangle', vol: 0.12, glide: 0.35, attack: 0.12, tail: 1.2 });
    beep(261.63, 2.4, 'triangle', 0.075, -87, { attack: 0.15, hold: 0.9 }); // C4 → F3
    beep(87.31,  2.6, 'sine',     0.13,  -20, { attack: 0.1,  hold: 1.1 }); // F2 저음
    setTimeout(() => beep(1174.7, 0.9, 'sine', 0.045, -580), 260);          // 아득한 잔향
  },
};
let GAMEOVER_PICK = 'somber';   // ← 여기만 바꾸면 게임에 적용됨

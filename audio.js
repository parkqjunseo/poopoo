/* ============================================
   audio.js — 🔧 B담당 (엔진/시스템)
   WebAudio 효과음. 새 효과음은 sfx에 추가.
   ============================================ */
'use strict';

let AC = null;
function audio() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function beep(freq, dur, type = 'square', vol = 0.12, slide = 0) {
  try {
    const ac = audio();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ac.currentTime + dur);
    g.gain.setValueAtTime(vol, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + dur);
  } catch (e) {}
}
const sfx = {
  coin: () => { beep(1180, 0.09, 'square', 0.09); setTimeout(() => beep(1570, 0.12, 'square', 0.09), 60); },
  jump: () => beep(300, 0.22, 'sine', 0.16, 320),
  jump2: () => beep(430, 0.2, 'sine', 0.16, 380),
  slide: () => beep(220, 0.18, 'sawtooth', 0.07, -80),
  lane: () => beep(500, 0.06, 'triangle', 0.08),
  crash: () => { beep(140, 0.4, 'sawtooth', 0.22, -90); beep(90, 0.55, 'square', 0.18, -50); },
};

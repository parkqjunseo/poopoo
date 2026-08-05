/* ============================================
   config.js — 🎨 A담당 (디자인/연출)
   색·스프라이트 크기 등 비주얼 튜닝 수치.
   여기 숫자만 바꿔도 게임 느낌이 달라집니다.
   ============================================ */
'use strict';

// 플레이어(변기)/추격자 스프라이트 크기 배율
const PLAYER_SCALE = 0.042;
const CHASER_SCALE = 0.026;

// 인트로 군중 셔츠 색 팔레트
const CROWD_COLORS = ['#3f6fd8', '#2e9e4f', '#c542a0', '#d97b28', '#7a54c9', '#c8452c'];

// 게임 중 뒤쫓아오는 사람들 (off: 좌우 위치, zoff: 앞뒤 줄, tp: 휴지 들었는지)
const CHASERS = [
  { off: -0.85, zoff: 0,     tp: true,  shirt: '#3f6fd8', pants: '#374151', skin: '#e8b789', hair: '#2f2418', ph: 0 },
  { off: 0.02,  zoff: 0,     tp: false, shirt: '#2e9e4f', pants: '#5a4632', skin: '#d99c66', hair: '#111',    ph: 2.1 },
  { off: 0.88,  zoff: 0,     tp: true,  shirt: '#c542a0', pants: '#2f3a52', skin: '#f0c9a0', hair: '#6b3410', ph: 4.2 },
  { off: -0.38, zoff: -0.45, tp: false, shirt: '#d97b28', pants: '#2c2c34', skin: '#e8b789', hair: '#222',    ph: 1.3 },
  { off: 0.48,  zoff: -0.5,  tp: true,  shirt: '#7a54c9', pants: '#33404f', skin: '#caa27a', hair: '#3d2c1a', ph: 3.4 },
];

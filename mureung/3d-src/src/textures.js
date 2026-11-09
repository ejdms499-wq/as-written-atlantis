import * as THREE from 'three';
import { rng, vnoise } from './world.js';

function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// 타일되는 잡음 (지형 세부)
export function noiseTex() {
  const N = 256, [c, g] = cv(N, N), im = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let s = 0, a = .5, f = 4, n = 0;
    for (let k = 0; k < 5; k++) {
      // 주기 경계에서 이어지도록 래핑
      const P = f, X = x / N * P, Y = y / N * P;
      const fx = X % P, fy = Y % P;
      const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
      const h = (a1, b1) => vnoise(((a1 % P) + P) % P + k * 31, ((b1 % P) + P) % P - k * 13);
      const uu = u * u * (3 - 2 * u), vv = v * v * (3 - 2 * v);
      const A = h(i, j), B = h(i + 1, j), C = h(i, j + 1), D = h(i + 1, j + 1);
      s += a * (A + (B - A) * uu + (C - A) * vv + (A - B - C + D) * uu * vv); n += a; a *= .5; f *= 2;
    }
    const v = Math.round(s / n * 255), o = (y * N + x) * 4;
    im.data[o] = im.data[o + 1] = im.data[o + 2] = v; im.data[o + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return tex(c, true, false);
}

function flower(g, x, y, r, R) {
  const pink = ['#f2a3b9', '#ee8fab', '#e97d9d', '#f5b6c8', '#e46f92'][(R() * 5) | 0];
  const rot = R() * 6.28;
  for (let k = 0; k < 5; k++) {
    const a = rot + k * 1.2566;
    g.save(); g.translate(x + Math.cos(a) * r * .5, y + Math.sin(a) * r * .5); g.rotate(a);
    g.beginPath(); g.ellipse(0, 0, r * .62, r * .46, 0, 0, 6.283);
    g.fillStyle = pink; g.fill();
    g.fillStyle = 'rgba(255,235,240,.35)'; g.beginPath(); g.ellipse(r * .1, 0, r * .3, r * .2, 0, 0, 6.283); g.fill();
    g.restore();
  }
  g.fillStyle = '#c0546e'; g.beginPath(); g.arc(x, y, r * .26, 0, 6.283); g.fill();
  g.fillStyle = '#f2d27a';
  for (let k = 0; k < 7; k++) { const a = R() * 6.28, d = r * (.2 + R() * .2); g.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.6, 1.6); }
}
// 복숭아꽃 송이 (잔가지 + 꽃 + 봉오리)
export function blossomTex() {
  const N = 256, [c, g] = cv(N, N), R = rng(7);
  for (let q = 0; q < 4; q++) {
    const ox = (q % 2) * 128, oy = (q >> 1) * 128;
    g.strokeStyle = '#4a3328'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(ox + 10 + R() * 20, oy + 118); g.quadraticCurveTo(ox + 64, oy + 70, ox + 110 + R() * 10, oy + 14 + R() * 20); g.stroke();
    for (let i = 0; i < 16; i++) {
      const t = R(), x = ox + 14 + t * 100 + (R() - .5) * 40, y = oy + 112 - t * 90 + (R() - .5) * 40;
      flower(g, Math.max(ox + 14, Math.min(ox + 114, x)), Math.max(oy + 14, Math.min(oy + 114, y)), 9 + R() * 7, R);
    }
    for (let i = 0; i < 4; i++) { g.fillStyle = '#d9718e'; g.beginPath(); g.arc(ox + 20 + R() * 88, oy + 20 + R() * 88, 3.5, 0, 6.283); g.fill(); }
  }
  const t = tex(c, false); t.premultiplyAlpha = false; return t;
}
// 잎 송이 (뽕나무/대나무/일반 나무)
export function leafTex(kind) {
  const N = 256, [c, g] = cv(N, N), R = rng(kind === 'bamboo' ? 11 : 13);
  for (let q = 0; q < 4; q++) {
    const ox = (q % 2) * 128, oy = (q >> 1) * 128;
    const n = kind === 'bamboo' ? 26 : 18;
    for (let i = 0; i < n; i++) {
      const x = ox + 16 + R() * 96, y = oy + 16 + R() * 96, a = R() * 6.28;
      const col = kind === 'bamboo' ? ['#6f8f3a', '#86a345', '#5c7a2f', '#9ab055'][(R() * 4) | 0] : ['#4f7a2a', '#5f8c33', '#3f6823', '#6c9a3b'][(R() * 4) | 0];
      g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = col;
      g.beginPath();
      if (kind === 'bamboo') { g.ellipse(0, 0, 18, 3.2, 0, 0, 6.283); }
      else { g.moveTo(-15, 0); g.quadraticCurveTo(0, -13, 15, 0); g.quadraticCurveTo(0, 13, -15, 0); }
      g.fill();
      g.strokeStyle = 'rgba(30,50,15,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-13, 0); g.lineTo(13, 0); g.stroke();
      g.restore();
    }
  }
  return tex(c, false);
}
// 꽃잎 한 장
export function petalTex() {
  const [c, g] = cv(32, 32);
  g.fillStyle = '#f7c4d1'; g.beginPath(); g.moveTo(16, 2); g.quadraticCurveTo(30, 14, 16, 30); g.quadraticCurveTo(2, 14, 16, 2); g.fill();
  g.fillStyle = 'rgba(232,140,165,.8)'; g.beginPath(); g.ellipse(16, 26, 3, 4, 0, 0, 6.283); g.fill();
  return tex(c, false);
}
// 회색 기와
export function tileTex() {
  const [c, g] = cv(128, 128);
  g.fillStyle = '#5d6063'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 8; i++) {
    const x = i * 16;
    const gr = g.createLinearGradient(x, 0, x + 16, 0);
    gr.addColorStop(0, '#3e4245'); gr.addColorStop(.5, '#7a7e80'); gr.addColorStop(1, '#3e4245');
    g.fillStyle = gr; g.fillRect(x + 1, 0, 14, 128);
  }
  for (let j = 0; j < 8; j++) { g.fillStyle = 'rgba(20,22,24,.35)'; g.fillRect(0, j * 16, 128, 2); }
  return tex(c);
}
// 초가 지붕
export function thatchTex() {
  const [c, g] = cv(128, 128), R = rng(5);
  g.fillStyle = '#9c8455'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const x = R() * 128, y = R() * 128, l = 6 + R() * 14;
    g.strokeStyle = ['#b9a06a', '#8a733f', '#c9b27a', '#7a6538'][(R() * 4) | 0]; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * 2, y + l); g.stroke();
  }
  return tex(c);
}
// 바위 (굴 벽)
export function rockTex() {
  const N = 256, [c, g] = cv(N, N), im = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const P = 8, X = x / N * P, Y = y / N * P;
    let s = 0, a = .5;
    for (let k = 0, f = 1; k < 4; k++, f *= 2) { const XX = (X * f) % (P * f), YY = (Y * f) % (P * f); s += a * vnoise(XX + k * 9, YY - k * 5); a *= .5; }
    const v = 90 + s * 110, o = (y * N + x) * 4;
    im.data[o] = v * 1.02; im.data[o + 1] = v * .96; im.data[o + 2] = v * .88; im.data[o + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return tex(c);
}

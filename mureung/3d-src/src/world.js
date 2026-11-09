// 『도화원기』 공간 배치 — 높이 함수, 시내, 굴, 분지
export const ss = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

function hash(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z, o = 4) {
  let s = 0, a = .5, f = 1, n = 0;
  for (let k = 0; k < o; k++) { s += a * vnoise(x * f + k * 17.3, z * f - k * 9.1); n += a; f *= 2.03; a *= .5; }
  return s / n;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// 시내 중심선 (배는 z=+470 → +14 로 거슬러 올라감: 林盡水源)
export const xc = z => 7 * Math.sin(z / 55) * ss(10, 80, z);
export const halfW = z => 6.5 + 6 * ss(24, 8, z);
export const WATER_Y = -0.35, POND_Y = 1.55;
export const BASIN = [0, -300];
export const PONDS = [[-78, -178, 16], [96, -214, 13], [-14, -350, 8]];
export const FOREST = [22, 390];   // 夾岸數百步 (약 370m)

function hOut(x, z) {
  const s = Math.abs(x - xc(z)), hw = halfW(z);
  const bed = -1.15 * (1 - ss(hw - 1.5, hw + 2.5, s));
  const bank = 0.35 * fbm(x * .05, z * .05) * ss(hw, hw + 6, s);
  const hills = ss(42, 170, s) * (55 + 60 * fbm(x * .006 + 3, z * .006)) + ss(25, 60, s) * 3 * fbm(x * .03, z * .03);
  return bed + bank + hills;
}
function hBasin(x, z) {
  const dx = x - BASIN[0], dz = z - BASIN[1], d = Math.hypot(dx, dz);
  const ang = Math.atan2(dz, dx), exitK = ss(.12, .45, Math.abs(ang - Math.PI / 2));   // 굴 출구 방향은 고정
  const rIn = 232 + exitK * 26 * (fbm(Math.cos(ang) * 3 + 5, Math.sin(ang) * 3 + 1, 3) - .45) * 2;
  let h = 2 + 0.35 * (fbm(x * .02 + 7, z * .02) - .5);
  h += ss(rIn, rIn + 40, d) * (30 + 22 * fbm(x * .012, z * .012));                       // 푸른 산자락
  h += ss(rIn + 22, rIn + 135, d) * (125 + 170 * (fbm(x * .006 + 1, z * .006 + 2) - .35)); // 봉우리
  h += ss(rIn + 10, rIn + 60, d) * 10 * fbm(x * .05, z * .05);
  for (const [px, pz, r] of PONDS) { const q = Math.hypot(x - px, z - pz); if (q < r) h -= 1.0 * (1 - ss(r * .55, r, q)); }
  return h;
}
function rise(x, z) {
  // 굴이 있는 쪽은 깎아지른 바위벽, 멀어질수록 비탈진 산
  const k = ss(46, 18, Math.abs(x - 10));
  const cliff = 105 * (1 - Math.exp(-Math.max(0, 4 - z) / 14)) + 25 * fbm(x * .05, z * .05) * ss(4, -10, z);
  const slope = 190 * ss(30 + 20 * fbm(x * .01, 3), -150, z);
  return k * cliff + (1 - k) * slope;
}
export function H(x, z) { return Math.min(hOut(x, z) + rise(x, z), hBasin(x, z)); }

// 굴: 바닥 높이를 따라가는 중심선. 처음엔 겨우 한 사람(初極狹 纔通人), 끝에서 넓어짐
export const TUN_PTS = [[18, .25, 4.25], [18, .25, 1], [17, .3, -8], [13, .6, -20], [9, 1.0, -32], [7.5, 1.4, -44], [5, 1.8, -55], [3, 2.0, -62], [2.6, 2.02, -66.8]];
export const tunW = t => lerp(.78, .5, ss(0, .1, t)) + ss(.72, 1, t) * 1.25;
export const tunH = t => 1.18 + ss(.72, 1, t) * .7;

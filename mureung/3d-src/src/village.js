import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { H, rng } from './world.js';

const V3 = THREE.Vector3;
function paint(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (!g.index) g.setIndex([...Array(n).keys()]);
  return g;
}
function box(w, h, d, x, y, z, hex, ry = 0) { const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); return paint(g, hex); }
function cylG(r0, r1, h, x, y, z, hex, seg = 10) { const g = new THREE.CylinderGeometry(r1, r0, h, seg); g.translate(x, y + h / 2, z); return paint(g, hex); }

// 맞배지붕(懸山) 두 면 — 기와 또는 초가 (지붕 재질은 따로)
function gableRoof(w, d, rise, over, y0) {
  const hw = w / 2 + over, hd = d / 2 + over * .9, th = .16;
  const slope = Math.atan2(rise, hd), len = Math.hypot(rise, hd) + .05;
  const parts = [];
  for (const s of [-1, 1]) {
    const g = new THREE.BoxGeometry(hw * 2, th, len, 1, 1, 1);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * hw * .9, uv.getY(i) * len * .9);
    g.rotateX(s * slope); g.translate(0, y0 + rise / 2, s * hd / 2);
    parts.push(g);
  }
  // 용마루
  const r = new THREE.BoxGeometry(hw * 2 + .1, .26, .34); r.translate(0, y0 + rise + .05, 0);
  const uv = r.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * .2, uv.getY(i) * .2);
  parts.push(r);
  return mergeGeometries(parts);
}
// 박공벽 삼각형
function gableWall(w, d, rise, y0, hex) {
  const hd = d / 2, P = [];
  for (const s of [-1, 1]) { const x = s * w / 2; P.push(x, y0, -hd, x, y0, hd, x, y0 + rise, 0); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(12).fill(0), 2));
  g.computeVertexNormals(); return paint(g, hex);
}

/*
  집 한 채: 낮은 흙 기단, 흙벽에 짙은 나무 기둥, 곧은 살창(直欞窓), 판문.
  진(晉)대 시골집 — 처마가 들린 후대 양식이나 일본식 경사 초가는 쓰지 않음.
*/
function house(o) {
  const { w, d, wallH, door, open } = o, wall = o.wall || 0xcbb795, post = 0x3b2a1e;
  const W = [], segs = [];
  W.push(box(w + .6, .35, d + .6, 0, .17, 0, 0x8d7d66));
  const y0 = .35, hz = d / 2, hx = w / 2;
  // 앞벽(+z): 문 구멍
  const dw = door, side = (w - dw) / 2;
  W.push(box(side, wallH, .22, -hx + side / 2, y0 + wallH / 2, hz, wall), box(side, wallH, .22, hx - side / 2, y0 + wallH / 2, hz, wall));
  W.push(box(dw, wallH - 2.0, .22, 0, y0 + 2.0 + (wallH - 2.0) / 2, hz, wall));
  if (!open) W.push(box(dw - .1, 2.0, .08, 0, y0 + 1.0, hz + .06, 0x4a3426));
  W.push(box(w, wallH, .22, 0, y0 + wallH / 2, -hz, wall), box(.22, wallH, d, -hx, y0 + wallH / 2, 0, wall), box(.22, wallH, d, hx, y0 + wallH / 2, 0, wall));
  // 기둥과 가로대
  for (const x of [-hx, -dw / 2 - .1, dw / 2 + .1, hx]) W.push(box(.2, wallH, .26, x, y0 + wallH / 2, hz + .02, post));
  for (const x of [-hx, hx]) W.push(box(.26, wallH, .2, x, y0 + wallH / 2, -hz, post));
  W.push(box(w + .1, .2, .28, 0, y0 + wallH - .1, hz + .03, post));
  // 살창
  for (const sx of [-1, 1]) {
    const cx = sx * (dw / 2 + side / 2), wy = y0 + 1.55;
    W.push(box(1.1, .8, .05, cx, wy, hz + .12, 0x2a1d14));
    for (let k = -2; k <= 2; k++) W.push(box(.05, .8, .06, cx + k * .2, wy, hz + .15, 0x6b5038));
    W.push(box(1.2, .07, .08, cx, wy + .43, hz + .15, post), box(1.2, .07, .08, cx, wy - .43, hz + .15, post));
  }
  W.push(gableWall(w, d, o.rise, y0 + wallH, wall));
  segs.push([-hx, hz, -dw / 2, hz], [dw / 2, hz, hx, hz], [hx, hz, hx, -hz], [hx, -hz, -hx, -hz], [-hx, -hz, -hx, hz]);
  if (!open) segs.push([-dw / 2, hz, dw / 2, hz]);
  return { walls: mergeGeometries(W), roof: gableRoof(w, d, o.rise, o.over || .7, y0 + wallH), segs };
}

function xform(g, x, y, z, ry) { const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z); return g.clone().applyMatrix4(m); }
function xseg(s, x, z, ry) { const c = Math.cos(ry), sn = Math.sin(ry); const f = (a, b) => [x + a * c + b * sn, z - a * sn + b * c]; return [...f(s[0], s[1]), ...f(s[2], s[3])]; }

export function buildVillage(tex) {
  const R = rng(91), walls = [], tiles = [], thatch = [], segs = [], circles = [];
  const group = new THREE.Group();
  const add = (h, x, z, ry, roofKind) => {
    const y = H(x, z) - .05;
    walls.push(xform(h.walls, x, y, z, ry)); (roofKind === 'tile' ? tiles : thatch).push(xform(h.roof, x, y, z, ry));
    h.segs.forEach(s => segs.push(xseg(s, x, z, ry)));
  };
  // 마당 담장(版築 흙담) — 남쪽에 문
  const yardWall = (x, z, w, d) => {
    const y = H(x, z) - .1, gate = 2.4, hw = w / 2, hd = d / 2, P = [];
    const seg = (x1, z1, x2, z2) => { const len = Math.hypot(x2 - x1, z2 - z1), a = Math.atan2(x2 - x1, z2 - z1);
      P.push(box(.5, 1.5, len, (x1 + x2) / 2, y + .75, (z1 + z2) / 2, 0xb7a17c, a));
      P.push(box(.7, .18, len + .2, (x1 + x2) / 2, y + 1.55, (z1 + z2) / 2, 0x6f6455, a));
      segs.push([x1, z1, x2, z2]); };
    seg(x - hw, z + hd, x - gate / 2, z + hd); seg(x + gate / 2, z + hd, x + hw, z + hd);
    seg(x + hw, z + hd, x + hw, z - hd); seg(x + hw, z - hd, x - hw, z - hd); seg(x - hw, z - hd, x - hw, z + hd);
    walls.push(...P);
  };
  const compounds = [];
  const COLS = [-58, -30, -2, 26, 54, 82], ROWS = [-284, -318];
  for (const zz of ROWS) for (const xx of COLS) {
    const host = xx === 26 && zz === -284;
    const x = xx + (R() - .5) * 2, z = zz + (R() - .5) * 2;
    yardWall(x, z, 22, 26);
    const main = house({ w: 9 + R(), d: 5.4, wallH: 2.7, door: 1.5, rise: 1.7, open: host });
    add(main, x, z - 6, 0, host || R() < .55 ? 'tile' : 'thatch');
    const shed = house({ w: 4.6, d: 3.6, wallH: 2.3, door: 1.2, rise: 1.1 });
    add(shed, x - 6.3, z + 3.2, Math.PI / 2, 'thatch');
    compounds.push({ x, z, host, door: new V3(x, H(x, z), z - 6 + 2.7 + .8) });
  }
  // 둥근 곳간(囷) — 한·진대 명기(明器)에 보이는 모양
  for (const [x, z] of [[-74, -300], [96, -300], [40, -350]]) {
    const y = H(x, z) - .05;
    walls.push(cylG(1.9, 1.9, 2.4, x, y, z, 0xc2ad86, 16), cylG(2.05, 2.05, .3, x, y, z, 0x8d7d66, 16));
    const c = new THREE.ConeGeometry(2.6, 2.0, 16); c.translate(x, y + 3.4, z); thatch.push(c);
    circles.push([x, z, 2.2]);
  }
  // 두레박 장대(桔槔) — 못가의 우물
  {
    const x = -22, z = -302, y = H(x, z);
    walls.push(cylG(.7, .7, .7, x, y, z, 0x8c8478, 12));
    walls.push(box(.18, 3.2, .18, x + 1.6, y + 1.6, z, 0x4a3a2a));
    const beam = new THREE.BoxGeometry(6.5, .12, .12); beam.rotateZ(.32); beam.translate(x + 1.2, y + 3.1, z); walls.push(paint(beam, 0x5a4532));
    walls.push(box(.05, 2.0, .05, x - 1.6, y + 2.0, z, 0x3a2a1a), cylG(.18, .2, .3, x - 1.6, y + .85, z, 0x5a4532, 8));
    walls.push(box(.5, .45, .45, x + 4.3, y + 4.0, z, 0x7d7468));
    circles.push([x, z, .9]);
  }
  const wallMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 });
  const tileMat = new THREE.MeshStandardMaterial({ map: tex.tile, roughness: .75, color: 0xd8d8d8 });
  const thatchMat = new THREE.MeshStandardMaterial({ map: tex.thatch, roughness: 1 });
  const mk = (arr, m) => { if (!arr.length) return; const me = new THREE.Mesh(mergeGeometries(arr.map(g => g.index ? g : (g.setIndex([...Array(g.attributes.position.count).keys()]), g))), m); me.castShadow = me.receiveShadow = true; group.add(me); };
  mk(walls, wallMat); mk(tiles, tileMat);
  // 초가 지붕: 원기둥 곳간 지붕은 uv가 달라 따로
  mk(thatch.filter(g => g.attributes.uv), thatchMat);

  // 주인집 안: 자리(席), 낮은 상(案), 술동이, 귀잔(耳杯), 닭 요리 — 의자 없음
  const host = compounds.find(c => c.host);
  const ix = host.x, iz = host.z - 6, iy = H(ix, iz) - .05 + .35;
  const F = [];
  F.push(box(6.2, .03, 3.4, ix, iy + .015, iz - .2, 0xc7b07a));
  for (let k = -3; k <= 3; k++) F.push(box(.02, .035, 3.4, ix + k * .88, iy + .02, iz - .2, 0xa89058));
  F.push(box(2.2, .08, 1.0, ix, iy + .36, iz - .4, 0x5a2a1c), box(.08, .32, .08, ix - 1, iy + .16, iz - .8, 0x3a1a10), box(.08, .32, .08, ix + 1, iy + .16, iz - .8, 0x3a1a10), box(.08, .32, .08, ix - 1, iy + .16, iz, 0x3a1a10), box(.08, .32, .08, ix + 1, iy + .16, iz, 0x3a1a10));
  for (const dx of [-.7, -.25, .25, .7]) { const c = new THREE.SphereGeometry(.09, 10, 6); c.scale(1.4, .4, 1); c.translate(ix + dx, iy + .42, iz - .1 - (dx > 0 ? .5 : 0)); F.push(paint(c, 0x8f1f1a)); }
  { const j = new THREE.SphereGeometry(.28, 14, 10); j.scale(1, 1.2, 1); j.translate(ix - 1.6, iy + .32, iz - .9); F.push(paint(j, 0x6a5a48)); F.push(cylG(.13, .1, .14, ix - 1.6, iy + .62, iz - .9, 0x6a5a48)); }
  { const p = cylG(.32, .28, .05, ix + .1, iy + .4, iz - .4, 0x3a2a20, 16); F.push(p); const ch = new THREE.SphereGeometry(.2, 12, 8); ch.scale(1.3, .7, 1); ch.translate(ix + .1, iy + .52, iz - .4); F.push(paint(ch, 0xa8682e)); }
  const fm = new THREE.Mesh(mergeGeometries(F), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6 }));
  fm.castShadow = fm.receiveShadow = true; group.add(fm);
  const lamp = new THREE.PointLight(0xffd8a8, 6, 9, 1.6); lamp.position.set(ix, iy + 2.2, iz); group.add(lamp);

  group.userData = { segs, circles, compounds, host, feastPos: new V3(ix, iy, iz - .4) };
  return group;
}

// 배 (작은 평저 고깃배)
export function buildBoat() {
  const g = new THREE.BoxGeometry(1.35, .5, 5.6, 2, 1, 14), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i) / 2.8, e = Math.pow(Math.abs(z), 2.2);
    p.setX(i, p.getX(i) * (1 - e * .72) * (p.getY(i) < 0 ? .82 : 1));
    p.setY(i, p.getY(i) + e * .32 + (p.getY(i) > 0 ? 0 : 0));
  }
  g.computeVertexNormals(); paint(g, 0x4e3a2a);
  const deck = new THREE.BoxGeometry(1.0, .05, 4.3); deck.translate(0, .2, 0); paint(deck, 0x7a6248);
  const ribs = [-1.4, -.4, .6, 1.5].map(z => box(1.05, .18, .07, 0, .3, z, 0x3e2e22));
  const basket = cylG(.16, .2, .22, .34, .22, -.9, 0x8a7448, 10);
  const pole = new THREE.CylinderGeometry(.025, .03, 4.4, 6); pole.rotateX(Math.PI / 2); pole.rotateY(.04); pole.translate(-.36, .3, -.1); paint(pole, 0x9a8a5a);
  const net = new THREE.SphereGeometry(.3, 8, 6); net.scale(1.2, .35, .9); net.translate(-.15, .26, 1.4); paint(net, 0x5a5444);
  const m = new THREE.Mesh(mergeGeometries([g, deck, ...ribs, basket, pole, net]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 }));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// 표시(誌): 나무에 묶은 붉은 천
export function markCloth() {
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .1, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xa11e1e, side: THREE.DoubleSide, roughness: .8 }));
  band.position.y = 1.2; g.add(band);
  const tail = new THREE.Mesh(new THREE.PlaneGeometry(.12, .6), band.material); tail.position.set(.18, .92, 0); tail.rotation.z = .2; g.add(tail);
  g.userData.tail = tail;
  return g;
}

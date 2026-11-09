import * as THREE from 'three';
import { rng } from './world.js';

const V3 = THREE.Vector3;
const matCache = {};
const mat = hex => matCache[hex] || (matCache[hex] = new THREE.MeshStandardMaterial({ color: hex, roughness: .9 }));
function part(geo, hex, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat(hex)); m.position.set(x, y, z); m.castShadow = true; return m; }

// 옷: 거친 삼베(갈색·흰빛 도는 베·쪽빛 바랜 색) — 진대 서민의 짧은 웃옷(短褐)과 바지
const CLOTH = [0xb9a37e, 0x8c7656, 0x6e6a5c, 0x5d6672, 0xa58e6a, 0x7a5f45];
const SKIN = 0xc79a76;

export function makePerson(kind, R) {
  const child = kind === 'child', s = child ? .64 : 1;
  const root = new THREE.Group(), upper = new THREE.Group();
  const cloth = CLOTH[(R() * CLOTH.length) | 0], pants = [0x4e4538, 0x5b5142, 0x3f3a33][(R() * 3) | 0];
  const hipY = .86;
  const legs = [-1, 1].map(sd => {
    const g = new THREE.Group(); g.position.set(sd * .09, hipY, 0);
    const l = part(new THREE.CylinderGeometry(.065, .055, .82, 7), pants, 0, -.41, 0); g.add(l);
    g.add(part(new THREE.CylinderGeometry(.06, .06, .22, 7), 0xb5a88a, 0, -.68, 0));
    g.add(part(new THREE.BoxGeometry(.11, .05, .22), 0x7d6a4a, 0, -.82, .04));
    root.add(g); return g;
  });
  upper.position.y = hipY; root.add(upper);
  const long = kind === 'woman';
  const prof = long
    ? [[0, .6], [.17, .58], [.19, .3], [.2, .15], [.25, -.3], [.31, -.78], [0, -.78]]
    : [[0, .6], [.17, .58], [.19, .3], [.19, .15], [.22, -.1], [.25, -.36], [0, -.36]];
  const lathe = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 12);
  upper.add(part(lathe, cloth, 0, 0, 0));
  upper.add(part(new THREE.CylinderGeometry(.2, .2, .07, 12), 0x3b2f24, 0, .14, 0));
  // 깃(交領): 오른쪽 섶이 위로 (右衽)
  const col = part(new THREE.BoxGeometry(.05, .3, .02), 0xe2d6bb, -.04, .45, .175); col.rotation.z = -.6; upper.add(col);
  upper.add(part(new THREE.CylinderGeometry(.05, .06, .08, 8), SKIN, 0, .64, 0));
  const head = part(new THREE.SphereGeometry(.112, 14, 10), SKIN, 0, .76, 0); head.scale.set(1, 1.1, 1); upper.add(head);
  const hairC = kind === 'elder' ? 0xd8c48e : 0x1d1916;
  const cap = part(new THREE.SphereGeometry(.118, 14, 8, 0, 6.283, 0, 1.75), hairC, 0, .785, -.008); upper.add(cap);
  if (kind === 'man' || kind === 'host' || kind === 'farmer') {
    upper.add(part(new THREE.SphereGeometry(.055, 8, 6), hairC, 0, .9, -.01));                         // 상투(髻)
    const wrap = part(new THREE.CylinderGeometry(.06, .065, .05, 10), 0x4a3a2c, 0, .9, -.01); upper.add(wrap); // 머리 싸개(幘)
  }
  if (kind === 'farmer') { const hat = part(new THREE.ConeGeometry(.33, .17, 14), 0xb59c62, 0, .93, 0); upper.add(hat); }   // 삿갓(笠)
  if (kind === 'woman') { upper.add(part(new THREE.SphereGeometry(.075, 10, 8), hairC, 0, .8, -.12)); { const pin = part(new THREE.CylinderGeometry(.008, .008, .22, 4), 0xd9c27a, 0, .8, -.12); pin.rotation.z = 1.4; upper.add(pin); } }
  if (kind === 'elder') { const b = part(new THREE.ConeGeometry(.06, .18, 8), hairC, 0, .63, .08); b.rotation.x = Math.PI; upper.add(b); upper.add(part(new THREE.SphereGeometry(.05, 8, 6), hairC, 0, .89, -.03)); }
  if (child) { for (const sd of [-1, 1]) upper.add(part(new THREE.CylinderGeometry(.03, .02, .2, 6), hairC, sd * .09, .7, -.04)); upper.add(part(new THREE.BoxGeometry(.2, .2, .04), hairC, 0, .72, -.1)); } // 늘어뜨린 머리(垂髫)
  const arms = [-1, 1].map(sd => {
    const g = new THREE.Group(); g.position.set(sd * .23, .52, 0);
    g.add(part(new THREE.CylinderGeometry(.055, .08, .55, 7), cloth, 0, -.27, 0));
    g.add(part(new THREE.SphereGeometry(.045, 8, 6), SKIN, 0, -.57, 0));
    upper.add(g); return g;
  });
  let tool = null;
  if (kind === 'farmer') {           // 괭이
    tool = new THREE.Group();
    tool.add(part(new THREE.CylinderGeometry(.018, .018, 1.3, 5), 0x7a6040, 0, -.1, 0));
    tool.add(part(new THREE.BoxGeometry(.16, .04, .2), 0x4a4a4a, 0, -.72, .08));
    tool.position.set(0, -.58, 0); tool.rotation.x = -1.2;
    arms[1].add(tool);
  }
  root.scale.setScalar(s * (.94 + R() * .1));
  root.userData = { legs, arms, upper, tool, kind, ph: R() * 10 };
  return root;
}

export function pose(p, st, t, sp = 0) {
  const { legs, arms, upper } = p.userData, ph = t * 7 * Math.max(sp, .4) / 1.4 + p.userData.ph;
  let l = 0, a = 0, bend = 0, ay = 0;
  upper.position.y = .86; legs.forEach(g => { g.position.y = .86; g.rotation.x = 0; });
  p.userData.sitOff = 0;
  if (st === 'walk' || st === 'run') { const k = st === 'run' ? .8 : .45; l = Math.sin(ph) * k; a = -Math.sin(ph) * k * .8; upper.position.y = .86 + Math.abs(Math.cos(ph)) * .03; }
  if (st === 'hoe') {
    const c = (t * .9 + p.userData.ph) % 1, up = c < .55 ? c / .55 : 1 - (c - .55) / .45;
    const e = up * up * (3 - 2 * up);
    arms.forEach(g => { g.rotation.x = -.5 - e * 2.2; g.rotation.z = 0; });
    bend = .35 - e * .25; upper.rotation.x = bend; legs.forEach((g, i) => g.rotation.x = i ? -.2 : .15);
    return;
  }
  if (st === 'sit') {           // 꿇어앉기 (진대: 의자 없이 자리에 앉음)
    legs.forEach(g => { g.rotation.x = -1.45; g.position.y = .45; });
    upper.position.y = .5; p.userData.sitOff = 0;
    arms.forEach((g, i) => { g.rotation.x = -.5 - Math.sin(t * 1.3 + i + p.userData.ph) * .08; g.rotation.z = (i ? -1 : 1) * -.15; });
    upper.rotation.x = .05 + Math.sin(t * .8 + p.userData.ph) * .03;
    return;
  }
  if (st === 'startle') { arms.forEach((g, i) => { g.rotation.x = -2.0; g.rotation.z = (i ? 1 : -1) * .4; }); upper.rotation.x = -.15; return; }
  if (st === 'wave') { arms[1].rotation.x = -2.6 + Math.sin(t * 6) * .25; arms[1].rotation.z = .3; arms[0].rotation.x = 0; upper.rotation.x = 0; return; }
  if (st === 'carry') { arms.forEach(g => { g.rotation.x = -.9; g.rotation.z = 0; }); legs[0].rotation.x = l; legs[1].rotation.x = -l; upper.rotation.x = 0; return; }
  legs[0].rotation.x = l; legs[1].rotation.x = -l;
  arms[0].rotation.x = a; arms[1].rotation.x = -a; arms.forEach(g => g.rotation.z = 0);
  upper.rotation.x = st === 'run' ? .18 : bend + Math.sin(t * 1.2 + p.userData.ph) * .015;
  if (st === 'idle') { arms[0].rotation.x = Math.sin(t * .9 + p.userData.ph) * .05; arms[1].rotation.x = -arms[0].rotation.x; }
}

// 닭과 개 (雞犬相聞)
export function makeChicken(R) {
  const g = new THREE.Group(), c = [0x8a4a22, 0xb8935a, 0x5a3a24, 0xe8dcc0][(R() * 4) | 0];
  const body = part(new THREE.SphereGeometry(.16, 10, 8), c, 0, .25, 0); body.scale.set(.85, .85, 1.2); g.add(body);
  const head = new THREE.Group(); head.position.set(0, .4, .14); g.add(head);
  head.add(part(new THREE.SphereGeometry(.07, 8, 6), c));
  head.add(part(new THREE.BoxGeometry(.02, .06, .07), 0xb3201c, 0, .07, 0));
  { const bk = part(new THREE.ConeGeometry(.02, .06, 5), 0xd9a83a, 0, -.01, .08); bk.rotation.x = 1.57; head.add(bk); }
  const tail = part(new THREE.ConeGeometry(.09, .22, 6), R() < .5 ? 0x2a2a20 : c, 0, .34, -.2); tail.rotation.x = -.9; g.add(tail);
  for (const sd of [-1, 1]) g.add(part(new THREE.CylinderGeometry(.012, .012, .16, 4), 0xd9a83a, sd * .05, .08, 0));
  g.userData = { head, ph: R() * 10 };
  return g;
}
export function makeDog(R) {
  const g = new THREE.Group(), c = [0xb08a50, 0x8a6a3e, 0xcfb487][(R() * 3) | 0];
  const body = part(new THREE.CylinderGeometry(.15, .14, .62, 10), c, 0, .45, 0); body.rotation.x = 1.57; g.add(body);
  const head = new THREE.Group(); head.position.set(0, .62, .36); g.add(head);
  head.add(part(new THREE.SphereGeometry(.13, 10, 8), c));
  const snout = part(new THREE.BoxGeometry(.1, .09, .16), c, 0, -.03, .13); head.add(snout);
  head.add(part(new THREE.SphereGeometry(.025, 6, 4), 0x1a1410, 0, -.01, .22));
  for (const sd of [-1, 1]) { const e = part(new THREE.ConeGeometry(.045, .12, 4), c, sd * .07, .12, -.01); head.add(e); }
  const legs = [];
  for (const [x, z] of [[-.08, .22], [.08, .22], [-.08, -.22], [.08, -.22]]) { const l = new THREE.Group(); l.position.set(x, .36, z); l.add(part(new THREE.CylinderGeometry(.035, .03, .36, 6), c, 0, -.18, 0)); g.add(l); legs.push(l); }
  const tail = new THREE.Group(); tail.position.set(0, .52, -.3); tail.add(part(new THREE.ConeGeometry(.03, .28, 5), c, 0, .12, 0)); tail.rotation.x = -.8; g.add(tail);
  g.userData = { head, legs, tail, ph: R() * 10 };
  return g;
}
export { rng };

import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { H, ss, xc, halfW, fbm, rng, clamp, lerp, BASIN, PONDS, FOREST, WATER_Y } from './world.js';
import * as TX from './textures.js';
import { buildTerrain, buildTunnel, buildWater, tunnelSamples } from './terrain.js';
import { peachForest, leafyTrees, MULBERRY, SHRUB, mountainTrees, bamboo, grassField, fallingPetals, floatingPetals, windU } from './flora.js';
import { buildVillage, buildBoat, markCloth } from './village.js';
import { makePerson, pose, makeChicken, makeDog } from './people.js';
import { TEXT } from './text.js';

const V3 = THREE.Vector3, $ = id => document.getElementById(id);
const mobile = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 560;
const Q = new URLSearchParams(location.search);
const TS = +(Q.get('ts') || 1);

// ───── 렌더러 · 하늘 · 빛 ─────
const renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: 'high-performance' });
let DPR = Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.5);
renderer.setPixelRatio(DPR); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .5;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
$('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, .05, 3200);
camera.rotation.order = 'YXZ';
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const sunDir = new V3(.42, .6, .68).normalize();
const sky = new Sky(); sky.scale.setScalar(3000);
const su = sky.material.uniforms;
su.turbidity.value = 3.2; su.rayleigh.value = 1.1; su.cloudCoverage.value = .35; su.cloudDensity.value = .35; su.mieCoefficient.value = .005; su.mieDirectionalG.value = .82;
su.sunPosition.value.copy(sunDir).multiplyScalar(1000);
scene.add(sky);
const FOG = new THREE.Color(0xaebfc6);
scene.fog = new THREE.FogExp2(FOG.getHex(), .0014);
{ const pm = new THREE.PMREMGenerator(renderer), s2 = new THREE.Scene(); const sk = new Sky(); sk.scale.setScalar(1000); Object.assign(sk.material.uniforms, {}); for (const k in su) sk.material.uniforms[k].value = su[k].value; s2.add(sk); scene.environment = pm.fromScene(s2, .04).texture; scene.environmentIntensity = .3; }
const hemi = new THREE.HemisphereLight(0xd6e4f2, 0x5b4f38, .32); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0da, 3.1);
sun.castShadow = true; sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 420 });
sun.shadow.bias = -.0004; sun.shadow.normalBias = .04;
scene.add(sun, sun.target);

// ───── 세계 짓기 ─────
const W = {};
const step = (msg, p) => new Promise(r => { $('lmsg').textContent = msg; $('lbar').style.width = p + '%'; setTimeout(r, 16); });
const segs = [], circles = [];
const tun = tunnelSamples(64);

async function build() {
  const tex = { noise: TX.noiseTex(), blossom: TX.blossomTex(), leaf: TX.leafTex('leaf'), bamboo: TX.leafTex('bamboo'), petal: TX.petalTex(), tile: TX.tileTex(), thatch: TX.thatchTex(), rock: TX.rockTex() };
  await step('땅과 물', 8);
  W.terrain = buildTerrain(tex.noise, mobile); scene.add(W.terrain);
  W.tunnel = buildTunnel(tex.rock, mobile); scene.add(W.tunnel);
  W.water = buildWater(tex.noise, sunDir); W.water.forEach(w => scene.add(w));
  await step('복숭아꽃 숲', 22);
  W.forest = peachForest(tex.blossom, mobile); scene.add(W.forest);
  // 숲 밖의 잡목 (숲 안에는 다른 나무가 없음: 中無雜樹)
  const R = rng(3), shr = [];
  for (let z = 400; z < 760; z += 7) for (const sd of [-1, 1]) for (const r of [11, 19, 30]) { if (R() < .45) continue; const zz = z + (R() - .5) * 5, s = r + (R() - .5) * 5; if (s < halfW(zz) + 2) continue; shr.push([xc(zz) + sd * s, zz, .8 + R() * .5]); }
  W.shrubs = leafyTrees(tex.leaf, shr, SHRUB, 8); scene.add(W.shrubs);
  await step('산', 36);
  await step('뽕나무와 대나무', 48);
  const mul = [];
  for (let x = -170; x <= 170; x += 11 + R() * 4) for (const z of [-152.4, -208.4]) { const zz = z + (R() < .5 ? 1.6 : -1.6); if (Math.hypot(x - BASIN[0], zz - BASIN[1]) < 205 && !PONDS.some(([px, pz, r]) => Math.hypot(x - px, zz - pz) < r + 3)) mul.push([x, zz, .9 + R() * .3]); }
  for (let x = -90; x <= 110; x += 9 + R() * 5) mul.push([x, -263 + (R() - .5) * 2, .9 + R() * .3]);
  for (const x of [-88.4, 18 + 1.6, 54 + 1.6]) for (let z = -110; z > -250; z -= 16) mul.push([x, z, .85 + R() * .3]);
  mul.push([-3, -259, 1.15]);
  W.mul = leafyTrees(tex.leaf, mul, MULBERRY, 9); scene.add(W.mul);
  W.bamboo = bamboo(tex.bamboo, [[0, -385, 120, 12, 900], [-118, -300, 12, 42, 260], [134, -292, 12, 42, 260], [-34, -72, 16, 6, 160], [44, -76, 14, 6, 120]], mobile); scene.add(W.bamboo);
  await step('풀', 60);
  const outN = mobile ? 16000 : 42000, inN = mobile ? 9000 : 24000;
  W.grassOut = grassField(R => {
    const z = R() * 520 - 6, s = 8 + Math.pow(R(), 1.8) * 40, x = xc(z) + (R() < .5 ? -1 : 1) * s;
    if (s < halfW(z) + .8 || H(x, z) > 1.2 || H(x, z) < WATER_Y + .3) return null;
    if (Math.hypot(x - 18, z - 4) < 2.2) return null;
    return [x, z, .9 + R() * .6, .26];
  }, outN, { seed: 5, blades: 8, h: .34, spread: .3 }); scene.add(W.grassOut);
  W.grassIn = grassField(R => {
    const a = R() * 6.28, d = Math.sqrt(R()) * 232, x = BASIN[0] + Math.cos(a) * d, z = BASIN[1] + Math.sin(a) * d;
    const y = H(x, z); if (y > 4 || y < 1.85) return null;
    const gx = ((x + 18) / 36) % 1, gz = ((z + 96) / 28) % 1, px = Math.min(Math.abs(gx), 1 - Math.abs(gx)) * 36, pz = Math.min(Math.abs(gz), 1 - Math.abs(gz)) * 28;
    const inVillage = x > -74 && x < 96 && z > -368 && z < -262;
    const inField = d < 205 && z < -92 && !inVillage;
    if (inField && Math.min(px, pz) > 1.0) return null;
    if (inVillage && R() < .75) return null;
    return [x, z, inField ? .8 : 1 + R() * .4, .25];
  }, inN, { seed: 6, blades: 8, h: .34, spread: .3 }); scene.add(W.grassIn);
  W.reeds = grassField(R => {
    const z = R() * 760 - 6; if (z > FOREST[0] && z < FOREST[1] && R() < .8) return null;
    const s = halfW(z) - .6 + R() * 2.6, x = xc(z) + (R() < .5 ? -1 : 1) * s, y = H(x, z);
    if (y > .4 || y < -1.2) return null;
    return [x, z, 1, .2];
  }, mobile ? 2000 : 5000, { seed: 7, h: 1.5, w: .025, blades: 4 }); scene.add(W.reeds);
  W.fall = fallingPetals(tex.petal, mobile ? 1400 : 3200); scene.add(W.fall);
  W.float = floatingPetals(tex.petal, mobile ? 700 : 1600); scene.add(W.float);
  await step('마을', 76);
  W.village = buildVillage({ tile: tex.tile, thatch: tex.thatch }); scene.add(W.village);
  segs.push(...W.village.userData.segs); circles.push(...W.village.userData.circles);
  W.boat = buildBoat(); scene.add(W.boat);
  // 굴 입구의 어렴풋한 빛 (髣髴若有光)
  { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(.4, 'rgba(255,225,170,.35)'); gr.addColorStop(1, 'rgba(255,220,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    W.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    W.glow.position.set(17.9, 1.35, -1.5); W.glow.scale.set(1.6, 2.1, 1); scene.add(W.glow); }
  // 굴 입구와 출구의 바위
  W.rocks = rocks(tex.rock, [
    [15.6, .2, 3.6, 1.3, 1.2, 1.1, .3], [20.4, .3, 3.5, 1.4, 1.5, 1.2, 1.1], [14.6, .1, 4.6, .8, .6, .8, 3], [21.8, .2, 4.8, 1.0, .7, .9, 4], [12.0, .4, 3.0, 2.0, 2.4, 1.6, 5], [24.5, .4, 3.0, 2.4, 3.0, 1.8, 6],
    [.4, 2.2, -60.5, 1.5, 2.2, 2.4, 7], [5.3, 2.3, -60.2, 1.7, 2.4, 2.4, 8], [2.9, 5.0, -59.8, 3, 1.1, 2, 9], [-2.6, 2, -63, 1.3, 1, 1.2, 10], [8.2, 2, -62.5, 1.6, 1.2, 1.3, 11]
  ]); scene.add(W.rocks);
  circles.push([15.6, 3.6, 1.1], [20.4, 3.5, 1.2], [14.6, 5.0, .7], [21.8, 5.2, .9], [.4, -60.5, 1.4], [5.3, -60.2, 1.6], [-2.6, -63, 1.2], [8.2, -62.5, 1.5]);
  await step('사람과 짐승', 88);
  makeAgents();
  await step('다 지었어요', 100);
}

function rocks(rockT, list) {
  const parts = [];
  for (const [x, y, z, sx, sy, sz, seed] of list) {
    const g = new THREE.IcosahedronGeometry(1, 3), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), n = 1 + (fbm(vx * 1.6 + seed * 7, vz * 1.6 + vy * 1.3, 3) - .5) * .6; p.setXYZ(i, x + vx * sx * n, y + vy * sy * n, z + vz * sz * n); }
    g.computeVertexNormals(); parts.push(g);
  }
  const g = parts.length > 1 ? mergeGeometries(parts) : parts[0];
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: rockT, bumpMap: rockT, bumpScale: 2, color: 0x7a786c, roughness: .95 }));
  m.castShadow = m.receiveShadow = true; return m;
}

// ───── 마을 사람 · 닭 · 개 ─────
const agents = [], fowl = [], dogs = [];
function hostHouse() { return W.village.userData.compounds.find(c => c.host); }
function inHostHouse(x, z) { const h = hostHouse(); return Math.abs(x - h.x) < 5.3 && Math.abs(z - (h.z - 6)) < 3.0; }
function groundY(x, z) { return H(x, z) + (W.village && inHostHouse(x, z) ? .3 : 0); }
function makeAgents() {
  const R = rng(17);
  const add = (kind, x, z, mode, extra = {}) => {
    const p = makePerson(kind === 'farmer' ? 'farmer' : kind, R); p.position.set(x, groundY(x, z), z); scene.add(p);
    const a = { p, kind, mode, home: new V3(x, 0, z), route: [], speed: kind === 'child' ? 2.6 : 1.25, face: R() * 6.28, t0: R() * 10, ...extra };
    p.rotation.y = a.face; agents.push(a); return a;
  };
  [[-34, -136], [8, -160], [58, -132], [-62, -214], [34, -222], [-100, -176], [86, -168]].forEach(([x, z]) => add('farmer', x, z, 'hoe'));
  add('man', 18, -150, 'patrol', { loop: [[18, -100], [18, -262], [54, -262], [54, -124], [18, -124]] });
  add('woman', -18, -262, 'patrol', { loop: [[-18, -262], [-18, -180], [-54, -180], [-54, -262]] });
  add('man', 90, -264, 'patrol', { loop: [[90, -264], [-60, -264]] });
  add('woman', -24, -300, 'idle');
  add('woman', -10, -342, 'idle');
  W.elder = add('elder', -3, -261.2, 'sit', { face: Math.PI * .1 });
  add('child', -3, -258, 'circle', { c: [-3, -260.6], r: 3.2, w: .8 });
  add('child', -3, -263, 'circle', { c: [-3, -260.6], r: 2.4, w: -1.1 });
  W.host = add('host', 6, -102, 'idle', { face: 0 });
  for (let i = 0; i < 16; i++) {
    const c = W.village.userData.compounds[(R() * 12) | 0], ch = makeChicken(R);
    const x = c.x + (R() - .5) * 12, z = c.z + 3 + (R() - .5) * 10; ch.position.set(x, H(x, z), z); scene.add(ch);
    fowl.push({ o: ch, home: new V3(c.x, 0, c.z + 4), tgt: new V3(x, 0, z), wait: R() * 3 });
  }
  for (const [x, z] of [[26, -266], [-16, -268], [70, -300]]) { const d = makeDog(R); d.position.set(x, H(x, z), z); scene.add(d); dogs.push({ o: d, home: new V3(x, 0, z), tgt: new V3(x, 0, z), wait: 0, follow: 0 }); }
}
function routeToHost(a) {
  const h = hostHouse(), p = a.p.position, r = [];
  if (p.z > -262) { r.push([18, clamp(p.z, -262, -97)], [18, -266]); }
  else if (p.x < 12) { r.push([-16, p.z], [-16, -266]); }
  else r.push([40, p.z], [40, -266]);
  r.push([h.x, -267], [h.x, h.z + 12.5], [h.x, h.z - 1], [h.x, h.z - 3.3]);
  return r;
}
function moveAgent(a, dt, t) {
  const p = a.p.position;
  if (a.route.length) {
    const [tx, tz] = a.route[0], dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d < .25) { a.route.shift(); if (!a.route.length && a.onArrive) { const f = a.onArrive; a.onArrive = null; f(a); } }
    else { const sp = Math.min(d, a.speed * dt); p.x += dx / d * sp; p.z += dz / d * sp; a.face = Math.atan2(dx, dz); }
    p.y = groundY(p.x, p.z); a.p.rotation.y = lerpAng(a.p.rotation.y, a.face, .15);
    pose(a.p, a.speed > 2 ? 'run' : 'walk', t, a.speed);
    return true;
  }
  return false;
}
function lerpAng(a, b, k) { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; }
function updateAgents(dt, t) {
  for (const a of agents) {
    if (a.p.position.distanceTo(camera.position) > 260) continue;
    if (moveAgent(a, dt, t)) continue;
    const p = a.p.position;
    if (a.mode === 'patrol') { a.li = ((a.li ?? -1) + 1) % a.loop.length; a.route = [a.loop[a.li]]; continue; }
    if (a.mode === 'circle') { a.th = (a.th || 0) + dt * a.w; p.x = a.c[0] + Math.cos(a.th) * a.r; p.z = a.c[1] + Math.sin(a.th) * a.r; p.y = groundY(p.x, p.z); a.p.rotation.y = Math.atan2(-Math.sin(a.th) * a.w, Math.cos(a.th) * a.w); pose(a.p, 'run', t, 2.4); continue; }
    if (a.mode === 'hoe') { a.p.rotation.y = a.face; pose(a.p, 'hoe', t); a.t0 -= dt; if (a.t0 < 0) { a.t0 = 14 + Math.random() * 14; a.route = [[p.x + (Math.random() - .5) * 6, p.z + (Math.random() - .5) * 3]]; } continue; }
    if (a.mode === 'sit') { a.p.rotation.y = lerpAng(a.p.rotation.y, a.face, .1); pose(a.p, 'sit', t); continue; }
    if (a.mode === 'startle') { pose(a.p, 'startle', t); continue; }
    if (a.mode === 'wave') { a.p.rotation.y = lerpAng(a.p.rotation.y, a.face, .1); pose(a.p, 'wave', t); continue; }
    if (a.mode === 'watch') { const c = camera.position; a.face = Math.atan2(c.x - p.x, c.z - p.z); a.p.rotation.y = lerpAng(a.p.rotation.y, a.face, .08); pose(a.p, 'idle', t); continue; }
    a.p.rotation.y = lerpAng(a.p.rotation.y, a.face, .1); pose(a.p, 'idle', t);
  }
  const cp = camera.position;
  for (const f of fowl) {
    const o = f.o, p = o.position;
    const dP = Math.hypot(p.x - cp.x, p.z - cp.z);
    if (dP > 120) continue;
    if (dP < 3.2) { const k = 1 / dP; f.tgt.set(p.x + (p.x - cp.x) * k * 4, 0, p.z + (p.z - cp.z) * k * 4); f.run = 1; f.wait = 0; }
    const dx = f.tgt.x - p.x, dz = f.tgt.z - p.z, d = Math.hypot(dx, dz);
    if (d > .1 && f.wait <= 0) { const sp = (f.run ? 3.2 : .7) * dt; p.x += dx / d * Math.min(d, sp); p.z += dz / d * Math.min(d, sp); o.rotation.y = Math.atan2(dx, dz); o.userData.head.rotation.x = Math.sin(t * 14) * .15; }
    else { f.run = 0; f.wait -= dt; o.userData.head.rotation.x = Math.max(0, Math.sin(t * 3 + o.userData.ph)) * 1.1; if (f.wait < -2.5 - Math.random()) { f.wait = .5 + Math.random() * 2; f.tgt.set(f.home.x + (Math.random() - .5) * 12, 0, f.home.z + (Math.random() - .5) * 10); } }
    p.y = H(p.x, p.z) + (f.run ? Math.abs(Math.sin(t * 20)) * .04 : 0);
  }
  for (const g of dogs) {
    const o = g.o, p = o.position, dP = Math.hypot(p.x - cp.x, p.z - cp.z);
    if (dP > 150) continue;
    if (dP < 13 && state.mode === 'walk') g.follow = 6;
    g.follow -= dt;
    if (g.follow > 0 && dP > 2.6) g.tgt.set(cp.x, 0, cp.z);
    else if (g.wait <= 0 && Math.hypot(g.tgt.x - p.x, g.tgt.z - p.z) < .3) { g.wait = 2 + Math.random() * 4; g.tgt.set(g.home.x + (Math.random() - .5) * 14, 0, g.home.z + (Math.random() - .5) * 8); }
    g.wait -= dt;
    const dx = g.tgt.x - p.x, dz = g.tgt.z - p.z, d = Math.hypot(dx, dz), moving = d > (g.follow > 0 ? 2.6 : .3) && g.wait <= 0 || (g.follow > 0 && dP > 2.6);
    const sp = (g.follow > 0 ? 3.4 : 1.1) * dt;
    if (moving && d > .01) { p.x += dx / d * Math.min(d, sp); p.z += dz / d * Math.min(d, sp); o.rotation.y = lerpAng(o.rotation.y, Math.atan2(dx, dz), .15); }
    o.userData.legs.forEach((l, i) => l.rotation.x = moving ? Math.sin(t * 11 + (i % 2) * 3.1 + (i > 1 ? 1.5 : 0)) * .5 : 0);
    o.userData.tail.rotation.z = Math.sin(t * (g.follow > 0 ? 14 : 4)) * .5;
    o.userData.head.rotation.x = moving ? 0 : Math.sin(t * .7 + o.userData.ph) * .15;
    p.y = H(p.x, p.z);
  }
}

// ───── 이야기 글 ─────
const queue = []; let cur = null, curT = 0, gap = 0;
const said = new Set();
function say(id, hold = false, cb = null) {
  if (said.has(id)) return; said.add(id);
  if (hold) { const i = queue.findIndex(q => !q.hold); queue.splice(i < 0 ? queue.length : 0, 0, { id, hold, cb }); if (cur && !cur.hold) curT = Math.max(curT, 999); }
  else queue.push({ id, hold, cb });
}
function hideText() { $('txt').classList.remove('on'); $('next').style.display = 'none'; }
function showNext() {
  cur = queue.shift(); curT = 0;
  const t = TEXT[cur.id];
  $('han').textContent = t[0]; $('kor').textContent = t[1];
  $('txt').classList.add('on');
  $('next').style.display = cur.hold ? 'inline-block' : 'none';
  if (!cur.hold && cur.cb) cur.cb();
  chime();
}
function textTick(dt) {
  if (gap > 0) { gap -= dt; return; }
  if (!cur) { if (queue.length) showNext(); return; }
  if (cur.hold) return;
  curT += dt;
  if (curT > 5.5 + TEXT[cur.id][1].length * .085) { hideText(); cur = null; gap = .8; }
}
function advance() { if (cur && cur.hold) { const cb = cur.cb; hideText(); cur = null; gap = .5; cb && cb(); return true; } return false; }

// ───── 상태 ─────
const state = { mode: 'title', phase: 'go', boatZ: 470, boatDir: -1, boatV: 0, yaw: 0, look: 0, pitch: -.03, pos: new V3(), marks: [], fogK: 0, exposure: .5, inTun: false, tunT: 0, search: false };
const keys = {};
const joy = { x: 0, y: 0 };
let act = null;
function setAct(label, fn) { act = fn ? { label, fn } : null; $('act').style.display = fn ? 'block' : 'none'; if (fn) $('act').textContent = label; }
function place(s) { if ($('place').textContent !== s) { $('place').textContent = s; $('place').classList.remove('on'); void $('place').offsetWidth; $('place').classList.add('on'); } }

const bx = z => xc(z) + 7.5 * ss(46, 15, z);
function boatPose(z, t) {
  const x = bx(z), x2 = bx(z + .5 * state.boatDir), dirx = x2 - x, dirz = .5 * state.boatDir;
  const yaw = Math.atan2(-dirx, -dirz);
  W.boat.position.set(x, WATER_Y + .05 + Math.sin(t * 1.3) * .025, z);
  W.boat.rotation.set(Math.sin(t * .9) * .01, yaw, Math.sin(t * 1.1) * .015, 'YXZ');
  return yaw;
}

function nearestTun(x, z) {
  let best = 1e9, out = null;
  for (let i = 0; i < tun.length - 1; i++) {
    const a = tun[i], b = tun[i + 1], abx = b.x - a.x, abz = b.z - a.z, L = abx * abx + abz * abz;
    let t = ((x - a.x) * abx + (z - a.z) * abz) / L; const raw = t; t = clamp(t, 0, 1);
    const px = a.x + abx * t, pz = a.z + abz * t, d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; out = { d, px, pz, floor: lerp(a.floor, b.floor, t), w: lerp(a.w, b.w, t), tt: lerp(a.t, b.t, t), end: (i === 0 && raw < 0) || (i === tun.length - 2 && raw > 1) }; }
  }
  return out;
}
function collide(x, z, r = .32) {
  for (const s of segs) {
    const [x1, z1, x2, z2] = s; if (Math.abs(x - x1) > 30 && Math.abs(x - x2) > 30) continue;
    const ax = x2 - x1, az = z2 - z1, L = ax * ax + az * az; let t = L ? ((x - x1) * ax + (z - z1) * az) / L : 0; t = clamp(t, 0, 1);
    const px = x1 + ax * t, pz = z1 + az * t, dx = x - px, dz = z - pz, d = Math.hypot(dx, dz);
    if (d < r + .26 && d > 1e-5) { const k = (r + .26 - d) / d; x += dx * k; z += dz * k; }
  }
  for (const [cx, cz, cr] of circles) { const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz); if (d < cr + r) { const k = (cr + r - d) / d; x += dx * k; z += dz * k; } }
  return [x, z];
}
function walk(dt) {
  const fw = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + joy.y;
  const st = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + joy.x;
  const turn = (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0);
  state.yaw += turn * dt * 1.8;
  const run = keys.ShiftLeft || keys.ShiftRight || Math.hypot(joy.x, joy.y) > .95;
  const sp = (run ? 6 : 3) * dt;
  const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw), rx = Math.cos(state.yaw), rz = -Math.sin(state.yaw);
  let mx = (fx * fw + rx * st), mz = (fz * fw + rz * st); const m = Math.hypot(mx, mz); if (m > 1) { mx /= m; mz /= m; }
  const p = state.pos;
  const tryTo = (nx, nz) => {
    const n = nearestTun(nx, nz);
    if (n.d < n.w + .3 && !n.end && (state.inTun || H(nx, nz) > n.floor + .6 || n.d < n.w - .1) && (state.inTun || Math.abs(p.y - 1.55 - n.floor) < 1.2)) {
      // 굴 안: 벽 사이로만
      let lx = nx - n.px, lz = nz - n.pz; const d = Math.hypot(lx, lz), lim = Math.max(.12, n.w - .3);
      if (d > lim) { lx *= lim / d; lz *= lim / d; }
      p.x = n.px + lx; p.z = n.pz + lz; state.inTun = true; state.tunT = n.tt; state.floor = n.floor; return true;
    }
    const h0 = groundY(p.x, p.z), h1 = groundY(nx, nz), len = Math.hypot(nx - p.x, nz - p.z) || 1e-6;
    if (h1 - h0 > len * 1.0 + .04 && !state.inTun) return false;
    if (nz > -12 && h1 < WATER_Y + .22) return false;
    if (nz < -70 && h1 < 1.78) return false;
    const [cx, cz] = collide(nx, nz);
    p.x = cx; p.z = cz; state.inTun = false; return true;
  };
  if (m > .001) { const nx = p.x + mx * sp, nz = p.z + mz * sp; if (!tryTo(nx, nz)) { if (!tryTo(nx, p.z)) tryTo(p.x, nz); } }
  const gy = state.inTun ? state.floor : groundY(p.x, p.z);
  const eye = state.inTun ? 1.5 : 1.62;
  const bob = m > .01 ? Math.sin(performance.now() / 1000 * (run ? 11 : 7.5)) * (run ? .035 : .02) : 0;
  p.y = lerp(p.y, gy + eye + bob, Math.min(1, dt * 12));
  camera.position.copy(p);
  camera.rotation.set(state.pitch, state.yaw, 0);
}

function boat(dt, t) {
  const fw = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + joy.y;
  const target = state.boatStop ? 0 : clamp(3.4 + fw * 4, .8, 9);
  state.boatV = lerp(state.boatV, target, Math.min(1, dt * 1.2));
  state.boatZ += state.boatDir * state.boatV * dt;
  const turn = (keys.ArrowLeft || keys.KeyA ? 1 : 0) - (keys.ArrowRight || keys.KeyD ? 1 : 0) + -joy.x;
  state.look += turn * dt * 1.6;
  const yaw = boatPose(state.boatZ, t);
  const seat = new V3(0, 1.05, 1.85).applyEuler(W.boat.rotation).add(W.boat.position);
  camera.position.copy(seat);
  state.yaw = yaw + state.look;
  camera.rotation.set(state.pitch, state.yaw, W.boat.rotation.z * .6);
}

// ───── 이야기 흐름 ─────
function startBoat() {
  state.mode = 'boat'; state.phase = 'go'; state.boatDir = -1; state.boatZ = 470; state.boatStop = false; state.look = 0;
  say('t1');
}
function storyTick(dt, t) {
  const z = state.mode === 'boat' ? state.boatZ : state.pos.z;
  if (state.mode === 'boat' && state.phase === 'go') {
    place(z > FOREST[1] ? '시내 · 溪' : z > 40 ? '복숭아꽃 숲 · 桃花林' : '물이 시작되는 곳 · 水源');
    if (z < 396) say('t2');
    if (z < 330) say('t3');
    if (z < 210) say('t4');
    if (z < 70) say('t5');
    if (z < 16 && !state.boatStop) { state.boatStop = true; setAct('배에서 내리기  舍船', () => { setAct(null); say('t6'); state.mode = 'walk'; state.pos.set(13.6, groundY(13.6, 11) + 1.62, 11); state.yaw = Math.atan2(-(18 - 13.6), -(3 - 11)); state.pitch = 0; }); }
  }
  if (state.mode === 'boat' && state.phase === 'search') {
    place('다시 찾아가는 길 · 尋向所誌');
    state.fogK = ss(400, 60, z);
    if (z < 60) say('t24');
    if (z < 16 && !state.boatStop) { state.boatStop = true; say('t24');
      const iv = setInterval(() => { if (!cur && !queue.length && gap <= 0) { clearInterval(iv); setTimeout(() => say('t25', true, () => end()), 1500); } }, 300); }
  }
  if (state.mode === 'boat' && state.phase === 'back') {
    place('돌아가는 길 · 便扶向路');
    $('marks').textContent = '표시 ' + state.marks.length;
    if (z > 445 && !state.backDone) {
      state.backDone = true; setAct(null); $('marks').style.display = 'none';
      say('t22', true, () => fade(() => {
        state.marks.forEach(m => scene.remove(m)); state.marks = [];
        state.phase = 'search'; state.search = true; state.boatDir = -1; state.boatZ = 470; state.boatStop = false; state.look = 0;
        W.terrain.userData.U.uHole.value = 0; W.tunnel.visible = false; W.glow.visible = false;
        say('t23');
      }, '그 뒤'));
    }
  }
  if (state.mode === 'walk') {
    const p = state.pos;
    if (state.inTun) { place('굴 · 小口'); if (state.tunT > .08) say('t7'); if (state.tunT > .9) say('t8'); }
    else if (p.z < -66) place('도화원 · 桃花源');
    else place('물이 시작되는 곳 · 水源');
    if (p.z < -80) say('t9');
    if (p.z < -122) say('t10');
    for (const a of agents) {
      const d = a.p.position.distanceTo(p);
      if (a.kind === 'farmer' && d < 16) say('t11');
      if ((a.kind === 'elder' || a.kind === 'child') && d < 14) say('t12');
    }
    // 마을 사람과 마주침
    if (state.phase === 'go' && W.host.p.position.distanceTo(p) < 7.5) {
      state.phase = 'met'; W.host.mode = 'startle'; W.host.face = Math.atan2(p.x - W.host.p.position.x, p.z - W.host.p.position.z); W.host.p.rotation.y = W.host.face;
      setTimeout(() => { W.host.mode = 'watch'; say('t13', true, () => say('t14', true, () => {
        state.phase = 'follow'; W.host.route = routeToHost(W.host); W.host.speed = 1.5;
        W.host.onArrive = a => { a.mode = 'sit'; a.p.position.set(hostHouse().x - 1.9, 0, hostHouse().z - 6.4); a.p.position.y = groundY(a.p.position.x, a.p.position.z); a.face = Math.PI * .5; };
        hint('주인을 따라 집으로 가기');
      })); }, 1300);
    }
    if (state.phase === 'follow' && inHostHouse(p.x, p.z) && !W.host.route.length) {
      state.phase = 'feast'; hint('');
      gather();
      say('t15', false);
      setTimeout(() => say('t16', true, () => say('t17', true, () => say('t18', true, () => say('t19', true, () => fade(() => {
        disperse(); say('t20', true, () => { state.phase = 'leave'; hint('왔던 굴로 돌아가기'); });
      }, '며칠 뒤  停數日')))), 9000));
    }
    if (state.phase === 'leave' && p.z > 4.8 && !state.inTun) {
      state.phase = 'out'; hint('');
      say('t21');
      setTimeout(() => setActNearBoat(), 500);
    }
  }
}
function setActNearBoat() {
  state.boatDir = -1; state.boatZ = 15; boatPose(15, 0);
  const iv = setInterval(() => {
    if (state.mode !== 'walk' || state.phase !== 'out') { clearInterval(iv); return; }
    const b = W.boat.position, d = Math.hypot(state.pos.x - b.x, state.pos.z - b.z);
    if (d < 8) { if (!act) setAct('배에 타기', board); } else if (act) setAct(null);
  }, 250);
  function board() {
    clearInterval(iv); setAct(null); state.mode = 'boat'; state.phase = 'back'; state.boatDir = 1; state.boatStop = false; state.look = 0; state.boatV = 0;
    $('marks').style.display = 'block';
    setTimeout(() => setAct('표시하기  誌', markTree), 600);
  }
}
function markTree() {
  const tr = W.forest.userData.trunks, b = W.boat.position; let best = null, bd = 1e9;
  for (const p of tr) { const d = Math.hypot(p.x - b.x, p.z - b.z); if (d < bd && !state.marks.some(m => m.position.distanceTo(p) < .1)) { bd = d; best = p; } }
  if (!best || bd > 40) { hint('여기엔 표시할 나무가 없어요'); setTimeout(() => hint(''), 1500); return; }
  const m = markCloth(); m.position.copy(best); scene.add(m); state.marks.push(m);
  stampSound();
}
function gather() {
  const h = hostHouse(), seats = [[h.x - 1.6, h.z - 5.3, 2.2], [h.x, h.z - 7.4, 0], [h.x + 1.6, h.z - 5.3, Math.PI], [h.x + 1.8, h.z - 6.8, -Math.PI / 2], [h.x - .9, h.z - 7.4, 0]];
  const outside = [[h.x - 1.5, h.z - 1.5], [h.x + 1.5, h.z - 1.4], [h.x - .3, h.z + 1.0], [h.x + 2.6, h.z + .6], [h.x - 2.8, h.z + .4], [h.x + .8, h.z + 3]];
  let si = 0, oi = 0;
  for (const a of agents) {
    if (a === W.host) continue;
    if (a.kind === 'child' && Math.random() < .5) continue;
    a.saved = { mode: a.mode, x: a.p.position.x, z: a.p.position.z, face: a.face, speed: a.speed };
    a.mode = 'idle'; a.speed = 2.2;
    a.route = routeToHost(a);
    if (si < seats.length && a.kind !== 'child') {
      const [sx, sz, f] = seats[si++]; a.route.push([sx, sz]); a.onArrive = b => { b.mode = 'sit'; b.face = f; };
    } else { const [ox, oz] = outside[oi++ % outside.length]; a.route.pop(); a.route.pop(); a.route.push([ox, oz]); a.onArrive = b => { b.mode = 'watch'; }; }
  }
}
function disperse() {
  const h = hostHouse();
  for (const a of agents) {
    a.route = []; a.onArrive = null;
    if (a === W.host) { a.p.position.set(h.x + 1.4, 0, h.z + 14.4); a.mode = 'wave'; a.face = 0; }
    else if (a.saved) { a.p.position.set(a.saved.x, 0, a.saved.z); a.mode = a.saved.mode; a.face = a.saved.face; a.speed = a.saved.speed; a.saved = null; }
    a.p.position.y = groundY(a.p.position.x, a.p.position.z);
  }
  const e = W.elder; e.p.position.set(h.x - 1.6, 0, h.z + 14.7); e.p.position.y = groundY(e.p.position.x, e.p.position.z); e.mode = 'wave'; e.face = 0;
  state.pos.set(h.x, 0, h.z + 20); state.pos.y = groundY(h.x, h.z + 20) + 1.62; state.yaw = 0; state.pitch = 0;
}
function hint(s) { $('hint').textContent = s; $('hint').style.opacity = s ? 1 : 0; }
function fade(mid, label) {
  $('fade').querySelector('span').textContent = label || ''; $('fade').classList.add('on');
  setTimeout(() => { mid(); setTimeout(() => $('fade').classList.remove('on'), 1800); }, 1600);
}
function end() {
  $('end').classList.add('on'); setAct(null); state.mode = 'end';
}

// ───── 입력 ─────
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') { if (!advance() && act) act.fn(); e.preventDefault(); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
{
  const cv = renderer.domElement; let drag = null;
  cv.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && joyId === e.pointerId) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    const k = e.pointerType === 'touch' ? .0055 : .0042;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (state.mode === 'boat') state.look -= dx * k; else state.yaw -= dx * k;
    state.pitch = clamp(state.pitch - dy * k, -1.25, 1.2);
  });
  const up = e => { if (drag && drag.id === e.pointerId) drag = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
}
let joyId = null;
{
  const pad = $('joy'), knob = $('knob');
  const set = e => { const r = pad.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2); const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } joy.x = dx; joy.y = -dy; knob.style.transform = `translate(${dx * 34}px,${dy * 34}px)`; };
  pad.addEventListener('pointerdown', e => { joyId = e.pointerId; pad.setPointerCapture(e.pointerId); set(e); e.stopPropagation(); });
  pad.addEventListener('pointermove', e => { if (e.pointerId === joyId) set(e); });
  const rel = e => { if (e.pointerId !== joyId) return; joyId = null; joy.x = joy.y = 0; knob.style.transform = ''; };
  pad.addEventListener('pointerup', rel); pad.addEventListener('pointercancel', rel);
}
$('act').addEventListener('click', e => { e.stopPropagation(); if (act) act.fn(); });
$('next').addEventListener('click', e => { e.stopPropagation(); advance(); });
$('again').addEventListener('click', () => location.reload());
$('helpbtn').addEventListener('click', () => $('help').classList.toggle('on'));
$('help').addEventListener('click', () => $('help').classList.remove('on'));
if (mobile) document.body.classList.add('touch');

// ───── 소리 (낮고 차분하게, 잡음 없이, 리미터) ─────
let AC = null, A = {}, sound = true;
const Gn = v => { const g = AC.createGain(); g.gain.value = v; return g; };
const Fl = (t, f, q) => { const x = AC.createBiquadFilter(); x.type = t; x.frequency.value = f; if (q) x.Q.value = q; return x; };
function initAudio() {
  if (AC) { AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  const lim = AC.createDynamicsCompressor(); lim.threshold.value = -20; lim.knee.value = 6; lim.ratio.value = 20; lim.attack.value = .003; lim.release.value = .25;
  A.master = Gn(.4); A.out = Gn(sound ? 1 : 0); A.out.connect(lim); lim.connect(A.master); A.master.connect(AC.destination);
  const ir = AC.createBuffer(2, AC.sampleRate * 2.5, AC.sampleRate); for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3) * .5; }
  A.rev = AC.createConvolver(); A.rev.buffer = ir; A.revIn = Gn(.35); A.revIn.connect(A.rev); A.rev.connect(Gn(.25)).connect(A.out);
  A.music = Gn(0); A.mlp = Fl('lowpass', 700, .5); A.mlp.connect(A.music); A.music.connect(A.out); A.music.connect(A.revIn);
  A.pad = [0, 1, 2].map(() => { const o = AC.createOscillator(); o.type = 'sine'; const g = Gn(.025); o.connect(g); g.connect(A.mlp); o.start(); return o; });
  A.chord = -1; A.note = -1; A.t0 = AC.currentTime;
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const PADS = [[38, 45, 50], [36, 43, 48], [41, 48, 53], [38, 45, 53]];
const MEL = [50, null, null, 57, null, null, 55, null, 53, null, null, null, 50, null, null, null, 48, null, 50, null, null, null, null, null];
function pluck(f, amp) {
  if (!AC) return; const t = AC.currentTime, g = AC.createGain(), lp = Fl('lowpass', 900, .3);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + .02); g.gain.exponentialRampToValueAtTime(.0003, t + 4.5);
  [[1, 1], [2, .18]].forEach(([h, v]) => { const o = AC.createOscillator(), og = Gn(v); o.type = 'triangle'; o.frequency.setValueAtTime(f * h * 1.004, t); o.frequency.exponentialRampToValueAtTime(f * h, t + .25); o.connect(og); og.connect(lp); o.start(t); o.stop(t + 4.6); });
  lp.connect(g); g.connect(A.music);
}
function chime() { if (AC && AC.state === 'running') pluck(hz(62), .045); }
function stampSound() { if (!AC) return; const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(70, t + .18); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.3, t + .006); g.gain.exponentialRampToValueAtTime(.0005, t + .3); o.connect(g); g.connect(A.out); o.start(t); o.stop(t + .35); }
function audioTick() {
  if (!AC || AC.state !== 'running') return;
  const ct = AC.currentTime, cave = state.inTun, fog = state.search, basin = state.mode === 'walk' && state.pos.z < -66;
  A.revIn.gain.setTargetAtTime(cave ? .6 : .35, ct, .6);
  A.music.gain.setTargetAtTime(sound ? (fog ? .5 : .9) : 0, ct, 1.5);
  A.mlp.frequency.setTargetAtTime(cave ? 320 : fog ? 380 : basin ? 900 : 650, ct, 1.5);
  const t = ct - A.t0, ci = Math.floor(t / 10) % 4;
  if (ci !== A.chord) { A.chord = ci; const lo = fog ? -12 : 0; PADS[ci].forEach((m, i) => A.pad[i].frequency.setTargetAtTime(hz(m + lo), ct, 2.5)); }
  const ni = Math.floor(t / 1.7) % MEL.length;
  if (ni !== A.note) { A.note = ni; const m = MEL[ni]; if (m !== null && (!cave || ni === 0)) pluck(hz(m - (cave ? 12 : 0)), fog ? .05 : .075); }
}
$('snd').addEventListener('click', e => { e.stopPropagation(); sound = !sound; $('snd').textContent = sound ? '소리 끄기' : '소리 켜기'; initAudio(); A.out && A.out.gain.setTargetAtTime(sound ? 1 : 0, AC.currentTime, .1); });

// ───── 매 프레임 ─────
let last = performance.now(), slow = 0, fast = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000) * TS; last = now;
  const t = now / 1000;
  if (state.mode === 'boat') boat(dt, t);
  else if (state.mode === 'walk') walk(dt);
  else if (state.mode === 'title') { const z = 300 + Math.sin(t * .05) * 20; camera.position.set(xc(z) + 3, 3.2, z); state.yaw = .15 + Math.sin(t * .07) * .2; camera.rotation.set(-.04, state.yaw, 0); boatPose(z - 14, t); }
  if (state.mode !== 'title' && state.mode !== 'end') { storyTick(dt, t); }
  textTick(dt);
  updateAgents(dt, t);
  // 물결 · 바람 · 꽃잎
  windU.uTime.value = t;
  W.water.forEach(w => w.material.uniforms.uT.value = t);
  W.fall.material.uniforms.uT.value = t; W.fall.material.uniforms.uCam.value.copy(camera.position);
  W.float.material.uniforms.uT.value = t; W.float.material.uniforms.uCamZ.value = camera.position.z;
  const amt = state.search ? .25 : 1; W.fall.material.uniforms.uAmt.value = amt; W.float.material.uniforms.uAmt.value = amt;
  W.glow.material.opacity = .45 + Math.sin(t * 1.4) * .12;
  for (const m of state.marks) m.userData.tail.rotation.z = .2 + Math.sin(t * 2 + m.position.x) * .25;
  // 안개: 굴 안은 어둡게, 다시 찾을 땐 짙은 안개 (遂迷)
  const dens = lerp(.0014, .022, state.fogK);
  scene.fog.density = lerp(scene.fog.density, dens, Math.min(1, dt * .8));
  let ex = .5;
  if (state.inTun) ex = lerp(lerp(.5, 1.2, ss(0, .15, state.tunT)), .5, ss(.96, 1, state.tunT));
  state.exposure = lerp(state.exposure, ex, Math.min(1, dt * (ex < state.exposure ? .55 : 1.8)));
  renderer.toneMappingExposure = state.exposure;
  // 해 그림자: 카메라 따라가기
  const c = camera.position; sun.target.position.set(c.x, c.y, c.z); sun.position.copy(c).addScaledVector(sunDir, 200); sun.target.updateMatrixWorld();
  sky.position.copy(c);
  audioTick();
  renderer.render(scene, camera);
  // 느려지면 해상도를 자동으로 낮춤 (끊김 방지)
  if (dt > .034) slow += dt; else slow = Math.max(0, slow - dt * .5);
  if (dt < .02) fast += dt; else fast = 0;
  if (slow > 1.5 && DPR > .75) { DPR = Math.max(.75, DPR - .2); renderer.setPixelRatio(DPR); slow = 0; }
  if (fast > 6 && DPR < Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.5)) { DPR = Math.min(DPR + .1, mobile ? 1.25 : 1.5); renderer.setPixelRatio(DPR); fast = 0; }
}

build().then(() => {
  $('lbar').parentElement.style.display = 'none'; $('lmsg').style.display = 'none'; $('go').style.display = 'inline-block';
  requestAnimationFrame(frame);
  if (Q.has('at')) jump(Q.get('at'));
});
$('go').addEventListener('click', () => {
  initAudio(); $('title').classList.add('off'); setTimeout(() => $('title').remove(), 1200);
  if (state.mode === 'title') startBoat();
});
// 테스트용 바로가기 (?at=forest|cave|basin|village|feast)
function jump(at) {
  $('title').remove();
  if (at === 'forest') { state.mode = 'boat'; state.boatDir = -1; state.boatZ = +(Q.get('z') || 300); state.look = +(Q.get('look') || 0); return; }
  state.mode = 'walk';
  const P = { mouth: [17.4, 16, Math.atan2(-.6, 12)], cave: [16.5, 9, Math.atan2(-1.5, 6)], field: [6, -88, 0], street: [12, -266, Math.PI * .45], tunnel: [12.5, -21, Math.atan2(3.5, 11)], exit: [2.8, -64, 0], basin: [4, -74, 0], village: [22, -255, 0], feast: [26, -289.5, Math.PI] }[at] || [4, -74, 0];
  state.pos.set(P[0], 0, P[1]); state.pos.y = groundY(P[0], P[1]) + 1.62; state.yaw = P[2];
  if (at === 'tunnel') { const n = nearestTun(P[0], P[1]); state.inTun = true; state.floor = n.floor; state.tunT = n.tt; state.pos.x = n.px; state.pos.z = n.pz; state.pos.y = n.floor + 1.5; }
  if (Q.has('yaw')) state.yaw = +Q.get('yaw');
  if (Q.has('pitch')) state.pitch = +Q.get('pitch');
}
window.__S = state; window.__D = { agents, W, nearestTun, groundY, say, advance, keys, joy };

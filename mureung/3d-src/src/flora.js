import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { H, rng, ss, xc, halfW, fbm, BASIN, PONDS, FOREST, WATER_Y } from './world.js';

const V3 = THREE.Vector3;
export const windU = { uTime: { value: 0 } };

function cyl(a, b, r0, r1, seg = 6) {
  const len = a.distanceTo(b), g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), b.clone().sub(a).normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}
function perp(d) { const t = Math.abs(d.y) < .9 ? new V3(0, 1, 0) : new V3(1, 0, 0); return new V3().crossVectors(d, t).normalize(); }

// 가지치기 나무: cfg = {trunk, levels:[[n, len, r, pitch]], up, droop}
function growTree(R, cfg) {
  const wood = [], tips = [];
  function grow(p, dir, li, len, r) {
    const end = p.clone().addScaledVector(dir, len);
    wood.push(cyl(p, end, r, r * .7));
    if (li >= cfg.levels.length) { tips.push(end); return; }
    if (li >= cfg.levels.length - 1) tips.push(p.clone().lerp(end, .6));
    const [n0, l0, , pitch] = cfg.levels[li], n = n0 + (R() < .5 ? 1 : 0);
    const side = perp(dir), side2 = new V3().crossVectors(dir, side);
    const rot = R() * 6.28;
    for (let k = 0; k < n; k++) {
      const a = rot + k / n * 6.283 + (R() - .5) * .7, pt = pitch * (.75 + R() * .5);
      const nd = dir.clone().multiplyScalar(Math.cos(pt)).addScaledVector(side, Math.sin(pt) * Math.cos(a)).addScaledVector(side2, Math.sin(pt) * Math.sin(a));
      nd.y += cfg.up - li * cfg.droop; nd.normalize();
      grow(end, nd, li + 1, l0 * (.8 + R() * .4), r * .62);
    }
  }
  const lean = new V3((R() - .5) * .25, 1, (R() - .5) * .25).normalize();
  grow(new V3(0, -.3, 0), lean, 0, cfg.trunk * (.85 + R() * .3), cfg.r0);
  return { wood: mergeGeometries(wood), tips };
}
// 잎/꽃 카드 묶음 (구형 법선으로 부드럽게 빛 받기)
function cards(R, tips, center, per, rad, size, atlas = true) {
  const P = [], N = [], UV = [], I = [];
  let v = 0;
  for (const tp of tips) for (let k = 0; k < per; k++) {
    const c = tp.clone().add(new V3(R() - .5, R() - .5, R() - .5).multiplyScalar(rad * 2));
    const s = size * (.7 + R() * .6);
    const nrm = new V3(R() - .5, R() - .5, R() - .5).normalize(), u = perp(nrm), w = new V3().crossVectors(nrm, u);
    const out = c.clone().sub(center).normalize();
    const q = atlas ? (R() * 4) | 0 : 0, u0 = atlas ? (q % 2) * .5 : 0, v0 = atlas ? (q >> 1) * .5 : 0, du = atlas ? .5 : 1;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [a, b] of corners) {
      const p = c.clone().addScaledVector(u, a * s / 2).addScaledVector(w, b * s / 2);
      P.push(p.x, p.y, p.z); N.push(out.x, out.y * .6 + .4, out.z);
      UV.push(u0 + (a + 1) / 2 * du, v0 + (b + 1) / 2 * du);
    }
    I.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I);
  return g;
}
function swayMat(m, amp) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = windU.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{ vec4 ip = instanceMatrix[3]; float hh = max(position.y,0.);
  transformed.x += sin(uTime*1.3 + ip.x*.21 + ip.z*.17 + position.y*.6)*${amp.toFixed(3)}*hh;
  transformed.z += cos(uTime*1.1 + ip.x*.13 + position.x)*${(amp * .6).toFixed(3)}*hh; }`);
  };
  return m;
}

function instance(geo, mat, mats, cast = true) {
  const im = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((m, i) => im.setMatrixAt(i, m));
  im.castShadow = cast; im.receiveShadow = true;
  im.computeBoundingSphere();
  return im;
}
function M(x, y, z, ry, s) { return new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), ry), new V3(s, s, s)); }

// ───── 복숭아나무 숲 (夾岸數百步 中無雜樹) ─────
export function peachForest(tex, mobile) {
  const R = rng(21), group = new THREE.Group(), trunks = [];
  const variants = [0, 1, 2].map(v => {
    const t = growTree(R, { trunk: 1.25, r0: .15, up: .25, droop: .12, levels: [[3, 1.55, 0, .75], [2, 1.05, 0, .55], [2, .7, 0, .5]] });
    const center = new V3(0, 2.6, 0);
    return { wood: t.wood, bloom: cards(R, t.tips, center, 9, .42, .78) };
  });
  const rows = mobile ? [10.5, 17, 25] : [10.5, 16.5, 23, 30.5, 38.5];
  const lists = variants.map(() => []);
  for (const side of [-1, 1]) for (const r of rows) for (let z = FOREST[0]; z < FOREST[1]; z += 6.4 + R() * 1.5) {
    const zz = z + (R() - .5) * 2.5, s = r + (R() - .5) * 3.2;
    if (s < halfW(zz) + 2.4) continue;
    const x = xc(zz) + side * s;
    if (Math.hypot(x - 18, zz - 3) < 7) continue;            // 굴 입구는 비움
    const y = H(x, zz); if (y > 3) continue;
    const v = (R() * 3) | 0;
    lists[v].push(M(x, y, zz, R() * 6.28, .85 + R() * .4));
    trunks.push(new V3(x, y, zz));
  }
  const woodMat = swayMat(new THREE.MeshStandardMaterial({ color: 0x3d2c24, roughness: .95 }), .006);
  const bloomMat = swayMat(new THREE.MeshStandardMaterial({ map: tex, alphaTest: .45, side: THREE.DoubleSide, roughness: .8, emissive: 0x3a1820, emissiveIntensity: .35 }), .012);
  variants.forEach((v, i) => { group.add(instance(v.wood, woodMat, lists[i])); group.add(instance(v.bloom, bloomMat, lists[i])); });
  group.userData.trunks = trunks;
  return group;
}

// 잎 나무 (뽕나무 · 숲 밖의 잡목 · 산의 나무)
function leafyVariants(R, n, opt) {
  return Array.from({ length: n }, () => {
    const t = growTree(R, { trunk: opt.trunk, r0: opt.r0, up: opt.up, droop: .1, levels: opt.levels });
    return { wood: t.wood, leaf: cards(R, t.tips, new V3(0, opt.trunk + 1.5, 0), opt.per, opt.rad, opt.size) };
  });
}
export function leafyTrees(tex, places, opt, seed, cast = true) {
  const R = rng(seed), vs = leafyVariants(R, 3, opt), group = new THREE.Group();
  const lists = vs.map(() => []);
  places.forEach(([x, z, s]) => lists[(R() * 3) | 0].push(M(x, H(x, z), z, R() * 6.28, s)));
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x3a3026, roughness: .95 });
  const leafMat = swayMat(new THREE.MeshStandardMaterial({ map: tex, alphaTest: .5, side: THREE.DoubleSide, roughness: .85, color: opt.tint || 0xffffff }), .01);
  vs.forEach((v, i) => { if (!lists[i].length) return; group.add(instance(v.wood, woodMat, lists[i], cast)); group.add(instance(v.leaf, leafMat, lists[i], cast)); });
  return group;
}
export const MULBERRY = { trunk: 1.5, r0: .16, up: .2, levels: [[3, 1.7, 0, .7], [2, 1.2, 0, .55], [2, .8, 0, .5]], per: 7, rad: .55, size: 1.0 };
export const SHRUB = { trunk: 2.2, r0: .2, up: .3, levels: [[3, 2.2, 0, .6], [2, 1.6, 0, .5], [2, 1.0, 0, .45]], per: 7, rad: .8, size: 1.5, tint: 0xb8c8a8 };

// 멀리 산을 덮는 숲 (가벼운 덩어리 나무)
export function mountainTrees(mobile) {
  const R = rng(33), parts = [];
  for (let k = 0; k < 4; k++) {
    const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const n = 1 + (fbm(p.getX(i) * 2 + k, p.getZ(i) * 2, 2) - .5) * .5; p.setXYZ(i, p.getX(i) * n * 2.3, p.getY(i) * n * 2.8 + 2.6 + k * .2, p.getZ(i) * n * 2.3); }
    parts.push(g);
  }
  const mats = [], N = mobile ? 3000 : 6500;
  let tries = 0;
  while (mats.length < N && tries++ < N * 12) {
    const x = (R() - .5) * 1500, z = (R() - .5) * 1700 + 30;
    const y = H(x, z), d = Math.hypot(x - BASIN[0], z - BASIN[1]), s = Math.abs(x - xc(z));
    if (y < 6 || y > 175) continue;
    if (z > -10 && s < 46) continue;
    if (d < 236) continue;
    const e = 1.5, nx = H(x + e, z) - H(x - e, z), nz = H(x, z + e) - H(x, z - e);
    if (Math.hypot(nx, nz) / (2 * e) > 1.3) continue;
    if (fbm(x * .01, z * .01, 2) < .34) continue;
    mats.push(M(x, y - .8, z, R() * 6.28, 1.1 + R() * 1.3));
  }
  const geo = mergeGeometries([parts[0]]);
  const mat = new THREE.MeshStandardMaterial({ color: 0x2c4422, roughness: 1, flatShading: false });
  const im = instance(geo, mat, mats, false);
  const col = new THREE.Color();
  for (let i = 0; i < mats.length; i++) { col.setHSL(.27 + R() * .06, .35 + R() * .15, .14 + R() * .08); im.setColorAt(i, col); }
  return im;
}

// 대나무 숲 (竹)
export function bamboo(tex, places, mobile) {
  const R = rng(44), culm = new THREE.CylinderGeometry(.045, .06, 1, 5, 6, true); culm.translate(0, .5, 0);
  const cc = []; const p = culm.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), node = Math.abs((y * 9) % 1 - .5) < .06 ? .78 : 1; cc.push(.55 * node, .62 * node, .30 * node); }
  culm.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
  const tips = []; for (let i = 0; i < 9; i++) tips.push(new V3((R() - .5) * .5, .55 + i / 9 * .45, (R() - .5) * .5));
  const leaves = cards(R, tips, new V3(0, .8, 0), 6, .09, .32);
  const mc = [], ml = [];
  for (const [x0, z0, rx, rz, n] of places) for (let i = 0; i < (mobile ? n * .6 : n); i++) {
    const a = R() * 6.28, r = Math.sqrt(R());
    const x = x0 + Math.cos(a) * rx * r, z = z0 + Math.sin(a) * rz * r, h = 6 + R() * 5;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((R() - .5) * .12, R() * 6.28, (R() - .5) * .12));
    const m = new THREE.Matrix4().compose(new V3(x, H(x, z) - .1, z), q, new V3(1, h, 1));
    mc.push(m); ml.push(new THREE.Matrix4().compose(new V3(x, H(x, z) - .1, z), q, new V3(h * .55, h, h * .55)));
  }
  const g = new THREE.Group();
  g.add(instance(culm, swayMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .6 }), .02), mc));
  g.add(instance(leaves, swayMat(new THREE.MeshStandardMaterial({ map: tex, alphaTest: .5, side: THREE.DoubleSide, roughness: .8 }), .03), ml));
  return g;
}

// 풀 (芳草鮮美) — 바람에 흔들림
export function grassField(sampler, count, opt = {}) {
  const R = rng(opt.seed || 55), P = [], C = [], I = [];
  const blades = opt.blades || 5; let v = 0;
  for (let b = 0; b < blades; b++) {
    const a = R() * 6.28, r = R() * (opt.spread || .12), h = (opt.h || .45) * (.6 + R() * .7), w = (opt.w || .045);
    const bx = Math.cos(a) * r, bz = Math.sin(a) * r, lean = (R() - .5) * .3, dx = Math.cos(a + 1.57), dz = Math.sin(a + 1.57);
    for (let s = 0; s <= 2; s++) {
      const t = s / 2, ww = w * (1 - t * .85), y = h * t, off = lean * t * t;
      P.push(bx - dx * ww + off, y, bz - dz * ww, bx + dx * ww + off, y, bz + dz * ww);
      const c = .35 + t * .65; C.push(c, c, c, c, c, c);
    }
    for (let s = 0; s < 2; s++) { const o = v + s * 2; I.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    v += 6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(P.length).map((_, i) => i % 3 === 1 ? 1 : 0), 3));
  g.setIndex(I);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: .9 });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = windU.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{ vec4 ip = instanceMatrix[3]; float hh = position.y*position.y;
  float w = sin(uTime*1.7 + ip.x*.35 + ip.z*.25) + .5*sin(uTime*2.9 + ip.x*.9);
  transformed.x += w*.12*hh*3.; transformed.z += cos(uTime*1.3+ip.z*.3)*.06*hh*3.; }`);
  };
  const mats = [], cols = [], col = new THREE.Color();
  let tries = 0;
  while (mats.length < count && tries++ < count * 8) {
    const s = sampler(R); if (!s) continue;
    const [x, z, sc, hue] = s;
    mats.push(M(x, H(x, z) - .02, z, R() * 6.28, sc));
    col.setHSL(hue + (R() - .5) * .03, .55 + R() * .2, .2 + R() * .1); cols.push(col.clone());
  }
  const im = new THREE.InstancedMesh(g, mat, mats.length);
  mats.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, cols[i]); });
  im.receiveShadow = true; im.castShadow = false;
  im.computeBoundingSphere();
  return im;
}

// 흩날리는 꽃잎 (落英繽紛) — 카메라 주변 상자 안에서 셰이더로 움직임
export function fallingPetals(tex, n) {
  const g = new THREE.InstancedBufferGeometry();
  const q = new THREE.PlaneGeometry(.075, .075);
  g.index = q.index; g.attributes.position = q.attributes.position; g.attributes.uv = q.attributes.uv;
  const R = rng(66), off = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) off.set([R() * 70, R() * 22, R() * 70, R() * 100], i * 4);
  g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
  g.instanceCount = n;
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uCam: { value: new V3() }, uMap: { value: null }, uAmt: { value: 1 } }]),
    vertexShader: `attribute vec4 aOff; uniform float uT; uniform vec3 uCam; uniform float uAmt; varying vec2 vUv; varying float vA;
#include <fog_pars_vertex>
float xcz(float z){ return 7.*sin(z/55.)*smoothstep(10.,80.,z); }
void main(){
  vUv = uv; float t = uT + aOff.w;
  vec3 B = vec3(70.,22.,70.);
  vec3 p = aOff.xyz + vec3(t*.55 + sin(t*.7+aOff.w)*1.2, -t*.45, t*.25 + cos(t*.5)*.8);
  vec3 base = uCam - B*.5 + vec3(0.,3.,0.);
  p = mod(p - base, B) + base;
  float s = abs(p.x - xcz(p.z));
  float k = smoothstep(16.,30.,p.z)*smoothstep(400.,380.,p.z)*smoothstep(52.,38.,s)*uAmt;
  float a = t*2.1 + aOff.w*7.;
  vec3 lp = position*k; lp.xy *= vec2(1., .7);
  mat3 r1 = mat3(cos(a),0.,sin(a), 0.,1.,0., -sin(a),0.,cos(a));
  mat3 r2 = mat3(1.,0.,0., 0.,cos(a*.7),-sin(a*.7), 0.,sin(a*.7),cos(a*.7));
  vec4 mvPosition = viewMatrix * vec4(p + r1*r2*lp, 1.);
  vA = k; gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform sampler2D uMap; varying vec2 vUv; varying float vA;
#include <common>
#include <fog_pars_fragment>
void main(){ vec4 c = texture2D(uMap, vUv); if(c.a<.4 || vA<.01) discard; gl_FragColor = vec4(c.rgb*1.02, c.a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`,
  });
  m.uniforms.uMap.value = tex;
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 2;
  return mesh;
}
// 물 위에 떠내려가는 꽃잎
export function floatingPetals(tex, n) {
  const g = new THREE.InstancedBufferGeometry();
  const q = new THREE.PlaneGeometry(.08, .08); q.rotateX(-Math.PI / 2);
  g.index = q.index; g.attributes.position = q.attributes.position; g.attributes.uv = q.attributes.uv;
  const R = rng(77), off = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) off.set([(R() - .5) * 2, R() * 160, R() * 6.28], i * 3);
  g.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 3));
  g.instanceCount = n;
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uCamZ: { value: 0 }, uMap: { value: null }, uAmt: { value: 1 } }]),
    vertexShader: `attribute vec3 aOff; uniform float uT; uniform float uCamZ; uniform float uAmt; varying vec2 vUv; varying float vA;
#include <fog_pars_vertex>
float xcz(float z){ return 7.*sin(z/55.)*smoothstep(10.,80.,z); }
float hw(float z){ return 6.5 + 6.*smoothstep(24.,8.,z); }
void main(){
  vUv = uv; float z = mod(aOff.y + uT*.6 - (uCamZ-80.), 160.) + uCamZ - 80.;
  float x = xcz(z) + aOff.x*(hw(z)-1.5) + sin(uT*.3+aOff.z)*.4;
  float k = smoothstep(14.,30.,z)*smoothstep(440.,400.,z)*uAmt;
  float a = aOff.z + uT*.2;
  vec3 lp = position*k; lp.xz = mat2(cos(a),-sin(a),sin(a),cos(a))*lp.xz;
  vec4 mvPosition = viewMatrix*vec4(vec3(x, ${(WATER_Y + .015).toFixed(3)}, z) + lp, 1.);
  vA = k; gl_Position = projectionMatrix*mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: `uniform sampler2D uMap; varying vec2 vUv; varying float vA;
#include <common>
#include <fog_pars_fragment>
void main(){ vec4 c = texture2D(uMap, vUv); if(c.a<.4 || vA<.01) discard; gl_FragColor = vec4(c.rgb*.95, .95);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`,
  });
  m.uniforms.uMap.value = tex;
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 3;
  return mesh;
}

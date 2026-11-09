import * as THREE from 'three';
import { H, ss, xc, halfW, fbm, BASIN, PONDS, TUN_PTS, tunW, tunH, WATER_Y, POND_Y, lerp } from './world.js';

function axis(min, max, sp) { const a = [min]; while (a[a.length - 1] < max) { const x = a[a.length - 1]; a.push(Math.min(max, x + sp(x))); } return a; }

export function tunnelCurve() {
  const pts = TUN_PTS.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
}
// 굴 중심선 샘플 (걷기 제한·지형 구멍용)
export function tunnelSamples(n = 48) {
  const c = tunnelCurve(), out = [];
  for (let i = 0; i < n; i++) { const t = i / (n - 1), p = c.getPointAt(t); out.push({ x: p.x, z: p.z, floor: p.y, w: tunW(t), h: tunH(t), t }); }
  return out;
}

export function buildTerrain(noiseT, mobile) {
  const k = mobile ? 1.4 : 1;
  const xs = axis(-950, 950, x => { const a = Math.abs(x - 8); return k * (a < 19 ? .5 : a < 60 ? .5 + (a - 19) * .02 : Math.min(22, 1.3 + (a - 60) * .028)); });
  const zs = axis(-1000, 1050, z => k * ((z > -84 && z < 14) ? .5 : (z >= 14 && z < 560) ? 1.9 : (z <= -84 && z > -560) ? 2.3 : Math.min(22, 4 + Math.abs(z > 0 ? z - 560 : z + 560) * .03)));
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const o = (j * nx + i) * 3; pos[o] = xs[i]; pos[o + 1] = H(xs[i], zs[j]); pos[o + 2] = zs[j];
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6); let q = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const nrm = g.attributes.normal.array, col = new Float32Array(nx * nz * 3);
  const C = (r, gg, b) => [r, gg, b];
  const grass = C(.20, .36, .09), grass2 = C(.28, .42, .11), forest = C(.09, .17, .07), rock = C(.27, .26, .23), rock2 = C(.36, .35, .31), bed = C(.33, .30, .23), mud = C(.27, .26, .18);
  for (let v = 0; v < nx * nz; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2], ny = nrm[v * 3 + 1];
    const n = fbm(x * .03, z * .03, 3), n2 = fbm(x * .2, z * .2, 2);
    let c = grass.map((a, i) => lerp(a, grass2[i], n));
    const hi = ss(3, 22, y + n * 8);
    c = c.map((a, i) => lerp(a, forest[i] * (0.85 + n2 * .4), hi));
    const steep = 1 - ss(.45, .72, ny);
    c = c.map((a, i) => lerp(a, lerp(rock[i], rock2[i], n2), steep));
    const peak = ss(120, 190, y);
    c = c.map((a, i) => lerp(a, rock2[i] * 1.05, peak * .6));
    if (z > -10) { const wet = 1 - ss(-0.5, 0.15, y); c = c.map((a, i) => lerp(a, lerp(mud[i], bed[i], n2), wet)); }
    col.set(c, v * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();

  const S = tunnelSamples(48);
  const uTun = S.map(s => new THREE.Vector4(s.x, s.z, s.floor + 1.15, s.w));
  const uTunH = S.map(s => s.h);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0 });
  const U = { uNoise: { value: noiseT }, uTun: { value: uTun }, uTunH: { value: uTunH }, uHole: { value: 1 }, uSearch: { value: 0 } };
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed,1.)).xyz; vN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vW; varying vec3 vN; uniform sampler2D uNoise; uniform vec4 uTun[48]; uniform float uTunH[48]; uniform float uHole; uniform float uSearch;
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float xcz(float z){ return 7.*sin(z/55.)*smoothstep(10.,80.,z); }
float paddyK = 0.;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if(uHole>.5 && vW.x>-3. && vW.x<25. && vW.z>-72. && vW.z<9. && vW.y<9.){
  float best=1e9, bw=1., by=0., bh=1.;
  for(int i=0;i<47;i++){ vec2 a=uTun[i].xy, b=uTun[i+1].xy, ab=b-a; float t=clamp(dot(vW.xz-a,ab)/dot(ab,ab),0.,1.); float d=length(vW.xz-(a+ab*t));
    if(d<best){ best=d; bw=mix(uTun[i].w,uTun[i+1].w,t); by=mix(uTun[i].z,uTun[i+1].z,t); bh=mix(uTunH[i],uTunH[i+1],t);} }
  float ex=best/(bw*.92), ey=(vW.y-by)/(bh*.92);
  if(ex*ex+ey*ey<1.) discard;
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float n1 = texture2D(uNoise, vW.xz*.045).r, n2 = texture2D(uNoise, vW.xz*.31).r, n3 = texture2D(uNoise, vW.xz*1.7).r;
  diffuseColor.rgb *= .78 + .3*n1 + .18*(n2-.5) + .12*(n3-.5);
  // 가파른 바위: 세 방향 투영 + 가로 결 (산수화의 준법처럼)
  vec3 an = abs(normalize(vN)); float steep = 1. - smoothstep(.36,.62,an.y);
  // 산을 덮은 숲 (멀리서 보면 나무 꼭대기들)
  float cm = smoothstep(3.2, 8., vW.y) * smoothstep(-6., -2., -abs(vW.y-2.)+20.) ;
  cm = smoothstep(3.2, 8., vW.y);
  float c1 = texture2D(uNoise, vW.xz*.11).r, c2 = texture2D(uNoise, vW.xz*.021+1.3).r, c3 = texture2D(uNoise, vW.xz*.37).r;
  vec3 can = mix(vec3(.05,.10,.035), vec3(.17,.27,.08), smoothstep(.38,.66,c1)) * (.7+.55*c2) * (.85+.3*c3);
  can = mix(can, vec3(.24,.30,.12), smoothstep(.7,.8,c2)*.4);
  diffuseColor.rgb = mix(diffuseColor.rgb, can, cm*(1.-steep*.85));
  if(steep>0.){
    vec3 bw = an/(an.x+an.y+an.z);
    vec2 px = vW.zy, pz = vW.xy;
    float rk = 0., fine = 0., crack = 0.;
    for(int o=0;o<2;o++){
      vec2 q = o==0 ? px : pz; float wgt = o==0 ? bw.x : bw.z;
      float a1 = texture2D(uNoise, q*vec2(.035,.07)).r, a2 = texture2D(uNoise, q*vec2(.13,.3)+.4).r, a3 = texture2D(uNoise, q*vec2(.5,1.1)+.7).r;
      rk += wgt*(a1*.6+a2*.4); fine += wgt*a3;
      crack += wgt*(1.-smoothstep(.0,.06,abs(a2-.5)))*.8 + wgt*(1.-smoothstep(.0,.04,abs(a1-.52)));
    }
    rk += bw.y*n1; fine += bw.y*n3;
    float strata = .86 + .14*sin(vW.y*1.9 + rk*16.);
    vec3 rc = mix(vec3(.07,.07,.065), vec3(.27,.26,.22), smoothstep(.25,.75,rk)) * strata * (.62+.62*fine);
    rc *= 1. - clamp(crack,0.,1.)*.55;
    float moss = smoothstep(.55,.7, texture2D(uNoise, vW.xz*.07+vW.y*.02).r) * (1.-smoothstep(.2,.5,an.y*0.+steep-.5));
    rc = mix(rc, vec3(.14,.22,.08), moss*.6);
    rc = mix(rc, can, .28*cm);
    diffuseColor.rgb = mix(diffuseColor.rgb, rc, steep);
  }
  // 복숭아숲 바닥: 떨어진 꽃잎 (落英)
  float s = abs(vW.x - xcz(vW.z));
  float forest = smoothstep(16.,26.,vW.z)*smoothstep(398.,384.,vW.z)*smoothstep(8.,11.,s)*smoothstep(48.,40.,s)*(1.-uSearch);
  float pet = smoothstep(.56,.62, texture2D(uNoise, vW.xz*.9+3.1).r) * forest;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.93,.70,.76), pet*.85);
  // 분지: 논밭과 두렁길 (良田 · 阡陌)
  vec2 c = vW.xz - vec2(${BASIN[0].toFixed(1)}, ${BASIN[1].toFixed(1)});
  float dB = length(c);
  float village = smoothstep(4.,0.,max(max(-74.-vW.x, vW.x-96.), max(-368.-vW.z, vW.z+262.)));
  float pond = 0.;
  ${PONDS.map(([x, z, r]) => `pond = max(pond, smoothstep(${(r + 4).toFixed(1)}, ${(r + 1).toFixed(1)}, length(vW.xz-vec2(${x.toFixed(1)},${z.toFixed(1)}))));`).join('\n  ')}
  float fieldM = smoothstep(214.,200.,dB) * (1.-village) * (1.-pond) * smoothstep(-78.,-92.,vW.z) * smoothstep(3.2,2.3,vW.y);
  if(fieldM>0.){
    vec2 cs = vec2(36.,28.);
    vec2 g = (vW.xz - vec2(-18.,-96.)) / cs, f = fract(g), id = floor(g);
    vec2 pd = min(f,1.-f)*cs;
    float big = (mod(id.x,3.)==0. && f.x<.5) || (mod(id.y,3.)==0. && f.y<.5) ? 1.6 : 1.;
    float path = 1. - smoothstep(.6*big, 1.05*big, min(pd.x,pd.y));
    float r = h21(id);
    vec3 crop;
    if(r<.42){ float rows = smoothstep(.3,.48,abs(fract(vW.x*1.7)-.5)); crop = mix(vec3(.20,.25,.24), vec3(.26,.46,.10), rows*(.7+.3*n2)); paddyK = 1.-path; }
    else if(r<.78){ float rows = smoothstep(.18,.42,abs(fract(vW.z*1.3)-.5)); crop = mix(vec3(.33,.25,.15), vec3(.45,.52,.14), rows); }
    else { crop = mix(vec3(.18,.34,.09), vec3(.32,.44,.12), n2); }
    crop *= .85 + .3*n1;
    vec3 pc = mix(vec3(.46,.38,.27), vec3(.30,.42,.14), smoothstep(.3,.7,n3)*.4);
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(crop, pc, path), fieldM);
  }
  // 마을 마당: 다진 흙
  float yard = village * smoothstep(214.,200.,dB) * smoothstep(3.2,2.3,vW.y);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.52,.45,.34)*(.85+.3*n2), yard*.55);
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, .3, paddyK*.8);');
  };
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.userData.U = U;
  return mesh;
}

// 굴 (안쪽에서 보이는 바위 통로)
export function buildTunnel(rockT, mobile) {
  const curve = tunnelCurve(), N = mobile ? 140 : 240, M = 26;
  const pos = [], uv = [], col = [], idx = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = curve.getPointAt(t), T = curve.getTangentAt(t);
    const Nn = new THREE.Vector3().crossVectors(T, up).normalize();
    const w = tunW(t), h = tunH(t), cy = p.y + 1.15;
    const light = Math.max(1 - ss(0, .09, t), ss(.8, 1, t));
    for (let j = 0; j <= M; j++) {
      const a = j / M * Math.PI * 2;
      const n = fbm(t * 34 + Math.cos(a) * 2.2, Math.sin(a) * 2.2 + 5, 4) - .5, n2 = fbm(t * 140 + Math.cos(a) * 6, Math.sin(a) * 6, 2) - .5;
      let ox = Math.cos(a) * w * (1 + n * .55 + n2 * .12), oy = Math.sin(a) * h * (1 + n * .35 + n2 * .1);
      const floorY = -1.15;
      const fl = oy < floorY;
      if (fl) oy = floorY + n2 * .04;
      pos.push(p.x + Nn.x * ox, cy + oy, p.z + Nn.z * ox);
      uv.push(t * 46, j / M * 5);
      const v = (.1 + .9 * light) * (.75 + n * .6);
      if (fl) col.push(v * .62, v * .52, v * .4); else col.push(v, v * .95, v * .88);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * (M + 1) + j, b = a + 1, c = a + M + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ map: rockT, bumpMap: rockT, bumpScale: 3, vertexColors: true, roughness: .92, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true;
  return mesh;
}

// 물 (시내와 못) — 하늘빛 반사, 흐르는 잔물결, 햇빛 반짝임
export function buildWater(noiseT, sunDir) {
  const mk = (w, d, cx, cz, y, flow) => {
    const g = new THREE.PlaneGeometry(w, d, 1, 1); g.rotateX(-Math.PI / 2); g.translate(cx, y, cz);
    const m = new THREE.ShaderMaterial({
      transparent: true, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uN: { value: null }, uSun: { value: sunDir.clone() }, uFlow: { value: flow }, uDeep: { value: new THREE.Color(.05, .13, .12) }, uSky: { value: new THREE.Color(.50, .64, .72) } }]),
      vertexShader: `varying vec3 vW; #include <fog_pars_vertex>
void main(){ vec4 wp = modelMatrix*vec4(position,1.); vW = wp.xyz; vec4 mvPosition = viewMatrix*wp; gl_Position = projectionMatrix*mvPosition; #include <fog_vertex> }`.replace(/#include <(\w+)>/g, '\n#include <$1>\n'),
      fragmentShader: `uniform float uT; uniform sampler2D uN; uniform vec3 uSun; uniform float uFlow; uniform vec3 uDeep; uniform vec3 uSky; varying vec3 vW; #include <common> #include <fog_pars_fragment>
void main(){
  vec2 p = vW.xz;
  float a = texture2D(uN, p*.11 + vec2(0., uT*.035*uFlow)).r, b = texture2D(uN, p*.23 - vec2(uT*.02, -uT*.05*uFlow)).r, c = texture2D(uN, p*.6 + vec2(uT*.03, uT*.09*uFlow)).r;
  vec3 n = normalize(vec3((a-.5)*.9+(c-.5)*.5, 1., (b-.5)*.9+(c-.5)*.4));
  vec3 V = normalize(cameraPosition - vW);
  float fr = .04 + .96*pow(1.-max(dot(n,V),0.),5.);
  vec3 R = reflect(-V,n);
  float sp = pow(max(dot(R, normalize(uSun)),0.), 220.)*3.;
  vec3 col = mix(uDeep*(.9+.3*a), uSky, clamp(fr*1.2+.08,0.,1.)) + vec3(1.,.95,.85)*sp;
  gl_FragColor = vec4(col, .9);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`.replace(/#include <(\w+)>/g, '\n#include <$1>\n'),
    });
    m.uniforms.uN.value = noiseT;
    const me = new THREE.Mesh(g, m); me.renderOrder = 1; return me;
  };
  return [mk(180, 1100, 0, 520, WATER_Y, 1), mk(480, 480, 0, -310, POND_Y, 0)];
}

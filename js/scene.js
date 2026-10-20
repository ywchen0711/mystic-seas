// MYSTIC SEAS — everything you see: island terrain, the sea, trees and huts, people, the boat, and skill effects.
import * as THREE from 'three';
import { ISLANDS } from './data.js';
import { heightAt, SEA_FLOOR } from './world.js';

const tcache = new Map();
function ctex(key, w, h, draw) {
  if (tcache.has(key)) return tcache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; tcache.set(key, t); return t;
}
const GROUND = { grass: ['#e8d8a0', '#5cc048', '#3e9a38', '#8a8a80'], sand: ['#f0dca0', '#e6c27a', '#d8a860', '#b88a58'], snow: ['#e0e4ea', '#f4f8ff', '#e8f0fa', '#a8b4c8'], stone: ['#d8cfa8', '#9aa0a8', '#8a9098', '#6a7078'] };

// ---------------------------------------------------------------- the islands and the sea
export function buildWorld(scene, L) {
  const group = new THREE.Group();
  for (const isl of ISLANDS) {
    const size = isl.r * 2.9, seg = 110, geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3), c = new THREE.Color(), pal = GROUND[isl.ground].map((x) => new THREE.Color(x));
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + isl.c[0], z = pos.getZ(i) + isl.c[1], y = heightAt(x, z); pos.setY(i, y);
      const slope = Math.abs(heightAt(x + 1, z) - y) + Math.abs(heightAt(x, z + 1) - y);
      if (y < 1.4) c.copy(pal[0]); else c.copy(pal[1]).lerp(pal[2], Math.min(1, (y - 1.4) / (isl.h * 0.8)));
      if (slope > 1.4) c.lerp(pal[3], 0.7);
      if (y < 0) c.lerp(new THREE.Color('#c8b888'), 0.6);
      const n = (Math.sin(x * 0.7) * Math.cos(z * 0.6)) * 0.04; c.offsetHSL(0, 0, n);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: false }));
    m.position.set(isl.c[0], 0, isl.c[1]); m.receiveShadow = true; group.add(m);
  }
  // the sea floor and the sea
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: '#2a6a8a', roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = SEA_FLOOR + 0.05; group.add(floor);
  const waves = ctex('waves', 256, 256, (g, w) => { const img = g.createImageData(w, w); for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const v = 128 + 50 * Math.sin(x / w * Math.PI * 8 + Math.sin(y / w * Math.PI * 4) * 2) + 30 * Math.sin(y / w * Math.PI * 10); const i = (y * w + x) * 4; img.data[i] = v; img.data[i + 1] = 128 + 40 * Math.cos(y / w * Math.PI * 6); img.data[i + 2] = 255; img.data[i + 3] = 255; } g.putImageData(img, 0, 0); });
  waves.repeat.set(160, 160); waves.colorSpace = THREE.NoColorSpace;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: '#1e90d8', roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.8, normalMap: waves, normalScale: new THREE.Vector2(0.35, 0.35) }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = 0; group.add(sea);
  // trees: two instanced meshes per kind (trunk, crown)
  const kinds = { palm: [['cyl', 0.25, 0.35, 5, '#8a6a40'], ['fronds', 2.6, '#3caa3c']], jungle: [['cyl', 0.4, 0.55, 5, '#6a4a2a'], ['sphere', 2.6, '#2a8a34']],
    cactus: [['cyl', 0.45, 0.5, 3.6, '#4a9a4a'], ['arms', 1, '#4a9a4a']], pine: [['cyl', 0.3, 0.4, 2, '#5a3a20'], ['cone', 2.2, '#2a6a4a']] };
  for (const [kind, [trunk, crown]] of Object.entries(kinds)) {
    const list = L.trees.filter((t) => t[4] === kind); if (!list.length) continue;
    const tg = new THREE.CylinderGeometry(trunk[1], trunk[2], trunk[3], 7); tg.translate(0, trunk[3] / 2, 0);
    let cg;
    if (crown[0] === 'fronds') { cg = new THREE.ConeGeometry(crown[1], 1.2, 7); cg.translate(0, trunk[3] + 0.2, 0); }
    else if (crown[0] === 'sphere') { cg = new THREE.IcosahedronGeometry(crown[1], 1); cg.scale(1, 0.8, 1); cg.translate(0, trunk[3] + 1.2, 0); }
    else if (crown[0] === 'cone') { cg = new THREE.ConeGeometry(crown[1], 6, 8); cg.translate(0, trunk[3] + 3, 0); }
    else { cg = new THREE.CylinderGeometry(0.3, 0.3, 1.6, 6); cg.rotateZ(Math.PI / 2); cg.translate(0, 2.2, 0); }
    if (kind === 'pine' && list.some(() => true)) { /* snowy tips are part of the colour */ }
    const ti = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ color: trunk[4], roughness: 0.9 }), list.length), ci = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ color: kind === 'pine' ? '#3a7a5a' : crown[2], roughness: 0.8, flatShading: true }), list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    list.forEach(([x, y, z, sc], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), x * 7.1); s.set(sc, sc, sc); p.set(x, y - 0.2, z); m4.compose(p, q, s); ti.setMatrixAt(i, m4); ci.setMatrixAt(i, m4); });
    ti.castShadow = ci.castShadow = true; group.add(ti, ci);
  }
  // rocks
  if (L.rocks.length) {
    const rg = new THREE.DodecahedronGeometry(1, 0), ri = new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({ color: '#8a8a88', roughness: 0.95, flatShading: true }), L.rocks.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    L.rocks.forEach(([x, y, z, sc], i) => { q.setFromEuler(new THREE.Euler(x, z, 0)); s.set(sc, sc * 0.7, sc); p.set(x, y, z); m4.compose(p, q, s); ri.setMatrixAt(i, m4); });
    ri.castShadow = true; group.add(ri);
  }
  // huts, towers and the fortress walls
  const wood = new THREE.MeshStandardMaterial({ color: '#b07a48', roughness: 0.9 }), roofM = new THREE.MeshStandardMaterial({ color: '#c84a3a', roughness: 0.8, flatShading: true }), stone = new THREE.MeshStandardMaterial({ color: '#c8c8c0', roughness: 0.9 });
  for (const [x, y, z, w, d, rot, isl, kind] of L.huts) {
    const g = new THREE.Group();
    if (kind === 'tower') { const t = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.6, 12, 12), stone); t.position.y = 6; const r = new THREE.Mesh(new THREE.ConeGeometry(5, 4, 12), new THREE.MeshStandardMaterial({ color: '#2a4a8a', flatShading: true })); r.position.y = 14; g.add(t, r); }
    else {
      const island = ISLANDS.find((i) => i.id === isl), mat = island.ground === 'snow' ? new THREE.MeshStandardMaterial({ color: '#8a6a50' }) : island.ground === 'sand' ? new THREE.MeshStandardMaterial({ color: '#e0c08a' }) : wood;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, d), mat); b.position.y = 1.6;
      const r = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 2.4, 4), island.ground === 'snow' ? new THREE.MeshStandardMaterial({ color: '#f4f8ff', flatShading: true }) : roofM); r.position.y = 4.4; r.rotation.y = Math.PI / 4;
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2, 0.1), new THREE.MeshStandardMaterial({ color: '#4a2a14' })); door.position.set(0, 1, d / 2 + 0.05);
      g.add(b, r, door);
    }
    g.position.set(x, y, z); g.rotation.y = rot; g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); group.add(g);
  }
  for (const [x, y, z, a] of L.walls) { const w = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 2), stone); w.position.set(x, y + 3, z); w.rotation.y = -a * Math.PI / 180 + Math.PI / 2; w.castShadow = true; group.add(w); }
  // docks: a pier out over the water
  for (const p of L.people.filter((q) => q.role === 'dock')) {
    const isl = ISLANDS.find((i) => i.id === p.island), dx = p.x - isl.c[0], dz = p.z - isl.c[1], d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
    const pier = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 14), wood); pier.position.set(p.x + ux * 6, 0.6, p.z + uz * 6); pier.rotation.y = Math.atan2(ux, uz); pier.receiveShadow = true; group.add(pier);
    for (const s of [-1, 1]) for (const k of [0, 1, 2]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3), wood); post.position.set(p.x + ux * (1 + k * 5) + uz * s * 1.4, -0.6, p.z + uz * (1 + k * 5) - ux * s * 1.4); group.add(post); }
  }
  scene.add(group);
  return { group, sea, waves };
}

// ---------------------------------------------------------------- characters
const HATS = {
  band: (c) => box(0.66, 0.16, 0.66, c || '#c83a3a', 0, 1.88, 0),
  tricorn: () => { const g = new THREE.Group(); g.add(box(0.9, 0.12, 0.9, '#1a1a1a', 0, 1.95, 0), box(0.6, 0.3, 0.6, '#1a1a1a', 0, 2.1, 0)); return g; },
  crown: () => { const g = new THREE.Group(); g.add(box(0.64, 0.22, 0.64, '#ffd040', 0, 2.0, 0)); for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) g.add(box(0.12, 0.2, 0.12, '#ffd040', x, 2.2, z)); return g; },
  turban: () => box(0.72, 0.36, 0.72, '#f0f0e0', 0, 2.0, 0),
  cap: () => { const g = new THREE.Group(); g.add(box(0.66, 0.18, 0.66, '#2a3a6a', 0, 1.95, 0), box(0.66, 0.06, 0.3, '#1a1a2a', 0, 1.88, 0.42)); return g; },
  ears: () => { const g = new THREE.Group(); g.add(box(0.2, 0.25, 0.1, '#c89060', -0.38, 1.75, 0), box(0.2, 0.25, 0.1, '#c89060', 0.38, 1.75, 0)); return g; },
  straw: () => { const g = new THREE.Group(); const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 16), mat('#f0d070')); brim.position.y = 1.92; const top = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.26, 16), mat('#f0d070')); top.position.y = 2.06; const r = new THREE.Mesh(new THREE.CylinderGeometry(0.365, 0.365, 0.08, 16), mat('#d83a3a')); r.position.y = 1.98; g.add(brim, top, r); return g; },
  none: () => new THREE.Group(),
};
const mcache = new Map();
function mat(c) { if (!mcache.has(c)) mcache.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })); return mcache.get(c); }
function box(w, h, d, c, x, y, z) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c)); b.position.set(x, y, z); b.castShadow = true; return b; }
// a blocky figure: [body colour, head colour, hat]; scale
export function makeCharacter(look, size = 1) {
  const [bodyC, headC, hat] = look, g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  inner.add(box(0.62, 0.62, 0.62, headC, 0, 1.62, 0), box(0.9, 0.8, 0.46, bodyC, 0, 0.98, 0));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: ctex('face', 64, 64, (c) => { c.clearRect(0, 0, 64, 64); c.fillStyle = '#1a1a1a'; c.fillRect(17, 20, 8, 11); c.fillRect(39, 20, 8, 11); c.lineWidth = 4; c.strokeStyle = '#1a1a1a'; c.beginPath(); c.arc(32, 36, 11, 0.25, Math.PI - 0.25); c.stroke(); }), transparent: true }));
  face.position.set(0, 1.62, 0.315); inner.add(face);
  const pivot = (x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); inner.add(p); return p; };
  const la = pivot(-0.6, 1.34), ra = pivot(0.6, 1.34), ll = pivot(-0.22, 0.58), rl = pivot(0.22, 0.58);
  la.add(box(0.3, 0.8, 0.4, bodyC, 0, -0.35, 0)); ra.add(box(0.3, 0.8, 0.4, bodyC, 0, -0.35, 0)); ll.add(box(0.4, 0.6, 0.44, '#2a3050', 0, -0.28, 0)); rl.add(box(0.4, 0.6, 0.44, '#2a3050', 0, -0.28, 0));
  inner.add(HATS[hat] ? HATS[hat]() : HATS.none());
  // what the right hand holds (a sword, when drawn)
  const hand = new THREE.Group(); hand.position.set(0, -0.7, 0.15); ra.add(hand);
  inner.scale.setScalar(size);
  g.userData = { la, ra, ll, rl, hand, phase: 0, inner, size };
  return g;
}
export function swordMesh(color) { const g = new THREE.Group(); const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 1.6), new THREE.MeshStandardMaterial({ color: '#e8eef8', metalness: 0.8, roughness: 0.2, emissive: color, emissiveIntensity: 0.25 })); blade.position.z = 0.9; const guard = box(0.4, 0.08, 0.1, '#c8a040', 0, 0, 0.1); g.add(blade, guard); return g; }
// pose: walking, in the air, swimming, swinging (atk 0..1)
export function pose(ch, dt, st) {
  const u = ch.userData;
  if (st.swim) { u.phase += dt * 6; const s = Math.sin(u.phase); u.la.rotation.x = -2.8 + s; u.ra.rotation.x = -2.8 - s; u.ll.rotation.x = s * 0.5; u.rl.rotation.x = -s * 0.5; u.inner.rotation.x = 1.2; return; }
  u.inner.rotation.x = 0;
  if (st.air) { u.la.rotation.x = -2.6; u.ra.rotation.x = -2.6; u.ll.rotation.x = 0.5; u.rl.rotation.x = -0.4; }
  else { u.phase += dt * st.speed * 1.2; const s = Math.sin(u.phase) * Math.min(1, st.speed / 5); u.la.rotation.x = s; u.ra.rotation.x = -s; u.ll.rotation.x = -s; u.rl.rotation.x = s; }
  if (st.atk > 0) { const k = st.atk; u.ra.rotation.x = -2.2 + (1 - k) * 2.6; u.ra.rotation.z = -0.4 * k; } else u.ra.rotation.z = 0;
}
// a floating name and health bar
export function makeTag(text, color, boss) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); sp.scale.set(boss ? 6 : 4, boss ? 1.5 : 1, 1); sp.renderOrder = 10;
  sp.userData = { c, t, text, color, last: -1 };
  return sp;
}
export function drawTag(sp, frac) {
  const u = sp.userData; if (Math.abs(frac - u.last) < 0.005) return; u.last = frac;
  const g = u.c.getContext('2d'); g.clearRect(0, 0, 256, 64);
  g.font = 'bold 22px "Noto Sans TC", sans-serif'; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = '#000'; g.fillStyle = u.color; g.strokeText(u.text, 128, 26); g.fillText(u.text, 128, 26);
  if (frac >= 0) { g.fillStyle = '#000'; g.fillRect(28, 38, 200, 14); g.fillStyle = frac > 0.5 ? '#4adc4a' : frac > 0.25 ? '#f0c030' : '#f04040'; g.fillRect(30, 40, 196 * Math.max(0, frac), 10); }
  u.t.needsUpdate = true;
}
// the boat
export function makeBoat() {
  const g = new THREE.Group(), wood = mat('#9a6a3a');
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 8), wood); hull.position.y = 0.3; const bow = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3, 4), wood); bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.position.set(0, 0.3, 5.4); bow.scale.set(1, 1, 0.45);
  const deck = box(3.2, 0.15, 7.6, '#c89a60', 0, 1.0, 0), mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6), mat('#6a4a2a')); mast.position.set(0, 4, 0.8);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.8), new THREE.MeshStandardMaterial({ color: '#f8f4e8', side: THREE.DoubleSide })); sail.position.set(0, 4.4, 0.85);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.6), new THREE.MeshStandardMaterial({ color: '#d83a3a', side: THREE.DoubleSide })); flag.position.set(0.5, 7, 0.8);
  g.add(hull, bow, deck, mast, sail, flag); g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------------------------------------------------------------- effects
const glowTex = () => ctex('glow', 64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
export function glow(color, size) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.set(size, size, 1); return s; }
export function orb(color, r) { const g = new THREE.Group(); const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.6, 12, 8), new THREE.MeshBasicMaterial({ color })); g.add(core, glow(color, r * 3.2)); return g; }
export function ring(color, r, opacity = 0.8) { const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.82, r, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; return m; }
export function beamMesh(color, len, w) { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, w * 0.5, len), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })); m.position.z = len / 2; const core = new THREE.Mesh(new THREE.BoxGeometry(w * 0.2, w * 0.2, len), new THREE.MeshBasicMaterial({ color: '#ffffff' })); core.position.z = len / 2; g.add(m, core); return g; }
export function slashMesh(color, r) { const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.7, r, 24, 1, -Math.PI * 0.45, Math.PI * 0.9), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); m.rotation.x = -Math.PI / 2; return m; }

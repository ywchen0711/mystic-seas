// MYSTIC SEAS — the geography: island terrain, where trees, huts, camps and people stand, and what you bump into. No DOM.
import { ISLANDS } from './data.js';

export function makeRng(seed) {
  return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
// smooth value noise
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function noise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const SEA_FLOOR = -7, WATER = 0;
// one island's height at (x, z): a hill that slopes to a beach and under the water, with some bumps
function islandHeight(isl, x, z) {
  const dx = x - isl.c[0], dz = z - isl.c[1], d = Math.hypot(dx, dz) / isl.r;
  if (d > 1.35) return SEA_FLOOR;
  // a wobbly shoreline
  const ang = Math.atan2(dz, dx), wob = 1 + 0.12 * Math.sin(ang * 3 + isl.r) + 0.07 * Math.sin(ang * 7 + isl.c[0]);
  const e = d / wob;
  let h;
  if (e < 0.82) { const k = 1 - e / 0.82; h = 1.2 + (isl.h - 1.2) * Math.pow(k, 1.6) + (noise(x * 0.06, z * 0.06) - 0.5) * 3 * k; }
  else if (e < 1) h = 1.2 * (1 - (e - 0.82) / 0.18) + 0.15;                      // the beach
  else h = 0.15 - (e - 1) * 22;                                                   // into the sea
  if (isl.ground === 'stone' && e < 0.8) h = Math.max(h, 3);                       // the fortress sits on a flat deck
  return Math.max(SEA_FLOOR, h);
}
export function heightAt(x, z) { let h = SEA_FLOOR; for (const isl of ISLANDS) h = Math.max(h, islandHeight(isl, x, z)); return h; }
export function islandAt(x, z) {
  for (const isl of ISLANDS) if (Math.hypot(x - isl.c[0], z - isl.c[1]) < isl.r * 1.15) return isl;
  return null;
}
// a point on an island: angle in degrees from its centre, at a fraction of its radius
export const onIsland = (isl, deg, frac) => { const a = deg * Math.PI / 180; return [isl.c[0] + Math.cos(a) * isl.r * frac, isl.c[1] + Math.sin(a) * isl.r * frac]; };

// ---------------------------------------------------------------- what stands on each island
// returns { trees: [[x, y, z, scale, kind]], rocks, huts: [[x, y, z, w, d, rot]], walls, people: [{ role, island, x, z }], camps, colliders: [[x, z, r, top]] }
export function layout(seed = 7) {
  const r = makeRng(seed), out = { trees: [], rocks: [], huts: [], walls: [], people: [], camps: [], colliders: [], fruitSpots: [] };
  const blocked = (x, z, pad) => out.colliders.some(([cx, cz, cr]) => Math.hypot(cx - x, cz - z) < cr + pad) || out.people.some((p) => Math.hypot(p.x - x, p.z - z) < pad + 3) || out.camps.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + pad);
  for (const isl of ISLANDS) {
    // the people: quest giver near the middle, the dock on the shore, dealers on some islands
    const add = (role, deg, frac) => { const [x, z] = onIsland(isl, deg, frac); out.people.push({ role, island: isl.id, x, z, y: heightAt(x, z) }); };
    // the dock: the last dry ground walking out from the middle towards the sea
    let dockF = 0.6; for (let f = 0.6; f < 1.3; f += 0.01) { const [x, z] = onIsland(isl, 160, f); if (heightAt(x, z) >= 0.5) dockF = f; else break; }
    add('quest', 135, 0.18); add('dock', 160, dockF);
    if (isl.id === 'starter') { add('fruit', 100, 0.32); add('sword', 75, 0.3); }
    if (isl.id === 'jungle' || isl.id === 'desert') add('sword', 95, 0.3);
    if (isl.id === 'desert' || isl.id === 'frost') add('fruit', 115, 0.32);
    // camps and the boss's lair
    for (const [id, n, deg, frac] of isl.enemies) { const [x, z] = onIsland(isl, deg, frac); out.camps.push({ island: isl.id, enemy: id, n, x, z, r: 9 }); }
    { const [x, z] = onIsland(isl, isl.bossAt[0], isl.bossAt[1]); out.camps.push({ island: isl.id, enemy: isl.boss, n: 1, x, z, r: 7, boss: true }); }
    // huts (the fortress has walls and towers instead)
    const huts = isl.ground === 'stone' ? 0 : 5;
    for (let i = 0; i < huts * 6 && out.huts.filter((h) => h[6] === isl.id).length < huts; i++) {
      const [x, z] = onIsland(isl, r() * 360, 0.2 + r() * 0.5), y = heightAt(x, z);
      if (y < 1.5 || blocked(x, z, 6)) continue;
      const w = 5 + r() * 3, d = 5 + r() * 2, rot = r() * Math.PI;
      out.huts.push([x, y, z, w, d, rot, isl.id]); out.colliders.push([x, z, Math.max(w, d) * 0.55, y + 4]);
    }
    if (isl.ground === 'stone') {
      for (let k = 0; k < 12; k++) { const a = k * 30, [x, z] = onIsland(isl, a, 0.78), y = heightAt(x, z); if (a > 140 && a < 180) continue; out.walls.push([x, y, z, a]); out.colliders.push([x, z, 4.5, y + 6]); }
      for (const [deg, frac] of [[20, 0.3], [250, 0.3], [180, 0.15]]) { const [x, z] = onIsland(isl, deg, frac), y = heightAt(x, z); out.huts.push([x, y, z, 8, 8, 0, isl.id, 'tower']); out.colliders.push([x, z, 5.5, y + 12]); }
    }
    // trees and rocks
    const nTrees = isl.tree === 'none' ? 0 : Math.round(isl.r * 0.9);
    for (let i = 0; i < nTrees * 4 && out.trees.filter((t) => t[5] === isl.id).length < nTrees; i++) {
      const [x, z] = onIsland(isl, r() * 360, 0.1 + r() * 0.78), y = heightAt(x, z);
      if (y < 1 || blocked(x, z, 2)) continue;
      const s = 0.8 + r() * 0.6; out.trees.push([x, y, z, s, isl.tree, isl.id]); out.colliders.push([x, z, 0.7 * s, y + 6 * s]);
      if (r() < 0.25) out.fruitSpots.push([x + 1.6, z + 1.2, isl.id]);
    }
    for (let i = 0; i < isl.r * 0.4; i++) { const [x, z] = onIsland(isl, r() * 360, 0.15 + r() * 0.85), y = heightAt(x, z); if (y < -1 || blocked(x, z, 1.5)) continue; const s = 0.6 + r() * 1.4; out.rocks.push([x, y, z, s, isl.id]); if (s > 1.2) out.colliders.push([x, z, s * 0.8, y + s]); }
  }
  return out;
}

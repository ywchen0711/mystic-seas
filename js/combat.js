// MYSTIC SEAS — bodies moving over the islands, enemies, and every kind of skill. No DOM (node tests drive it).
import { ENEMIES, enemyHp, enemyDmg, FRUITS, SWORDS, STYLES, hitDamage } from './data.js';
import { heightAt, WATER } from './world.js';

export const MOVE = { walk: 15, swim: 8, jump: 15, airJump: 14, gravity: 42, dash: 46, dashTime: 0.17 };

// ---------------------------------------------------------------- the player's body
export function newBody(x, z) { return { x, y: heightAt(x, z), z, vx: 0, vy: 0, vz: 0, grounded: true, swimming: false, airJumps: 0, dashT: 0, facing: 0 }; }
// input: { mx, mz } (world direction, length ≤ 1), jump / dash (pressed this frame); opt: { airJumps: how many, speed }
export function stepBody(b, input, dt, colliders, opt = {}) {
  const ev = [];
  const ground = heightAt(b.x, b.z), sea = ground < WATER - 0.6;
  // walking: quick to start and stop
  const sp = (b.swimming ? MOVE.swim : MOVE.walk) * (opt.speed || 1), want = Math.min(1, Math.hypot(input.mx, input.mz));
  if (b.dashT > 0) { b.dashT -= dt; }
  else {
    const k = Math.min(1, dt * (b.grounded || b.swimming ? 14 : 5));
    b.vx += (input.mx * sp - b.vx) * k; b.vz += (input.mz * sp - b.vz) * k;
  }
  if (want > 0.1) b.facing = Math.atan2(input.mx, input.mz);
  if (input.jump) {
    if (b.grounded || b.swimming) { b.vy = MOVE.jump; b.grounded = false; b.swimming = false; ev.push('jump'); }
    else if (b.airJumps < (opt.airJumps || 0)) { b.vy = MOVE.airJump; b.airJumps++; ev.push('airjump'); }
  }
  if (input.dash && b.dashT <= 0) { const f = b.facing; b.vx = Math.sin(f) * MOVE.dash; b.vz = Math.cos(f) * MOVE.dash; b.dashT = MOVE.dashTime; if (!b.grounded) b.vy = Math.max(b.vy, 2); ev.push('dash'); }
  if (b.dashT <= 0 || !b.grounded) b.vy -= MOVE.gravity * dt * (b.dashT > 0 ? 0.2 : 1);
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  // bump into trees, huts, rocks and walls; stand on their tops
  let floor = heightAt(b.x, b.z);
  for (const [cx, cz, cr, top] of colliders) {
    const dx = b.x - cx, dz = b.z - cz, d = Math.hypot(dx, dz), rr = cr + 0.45;
    if (d >= rr) continue;
    if (b.y >= top - 0.4 && b.vy <= 0) { floor = Math.max(floor, top); continue; }
    if (d > 1e-4) { b.x = cx + dx / d * rr; b.z = cz + dz / d * rr; }
  }
  // the ground, or the sea
  const waterHere = heightAt(b.x, b.z) < WATER - 0.6 && floor < WATER - 0.6;
  b.grounded = false;
  if (waterHere && b.y <= WATER - 0.8) { b.y = WATER - 0.8; if (b.vy < 0) b.vy = 0; if (!b.swimming) ev.push('splash'); b.swimming = true; b.airJumps = 0; }
  else {
    if (!waterHere) b.swimming = false;
    // walking downhill keeps you on the slope (unless you jumped)
    if (b.wasGrounded && b.vy <= 0 && b.y - floor < 0.7) b.y = floor;
    if (b.y <= floor) { if (b.vy < -18) ev.push('thud'); b.y = floor; b.vy = 0; b.grounded = true; b.airJumps = 0; }
  }
  b.wasGrounded = b.grounded;
  void sea;
  return ev;
}

// ---------------------------------------------------------------- enemies
export function spawnEnemy(id, camp, i, rng) {
  const e = ENEMIES[id], a = rng() * Math.PI * 2, d = camp.boss ? 0 : 2 + rng() * (camp.r - 2);
  const x = camp.x + Math.cos(a) * d, z = camp.z + Math.sin(a) * d;
  return { id, d: e, x, z, y: heightAt(x, z), hx: x, hz: z, hp: enemyHp(e), max: enemyHp(e), state: 'idle', cd: 1 + rng(), t: rng() * 3, facing: rng() * 6.28,
    respawn: 0, frozen: 0, slow: 0, wind: 0, special: 6, mark: null, uid: Math.floor(rng() * 1e9), vx: 0, vz: 0 };
}
const AGGRO = 22, LEASH = 45;
// one enemy's turn; returns what it does to the player: [{ type: 'hit', dmg }] or shots / slams to show
export function stepEnemy(e, me, dt, rng) {
  const out = [];
  if (e.state === 'dead') { e.respawn -= dt; return out; }
  if (e.frozen > 0) { e.frozen -= dt; return out; }
  const dx = me.x - e.x, dz = me.z - e.z, d = Math.hypot(dx, dz), home = Math.hypot(e.x - e.hx, e.z - e.hz);
  const speed = (e.d.fast ? 11 : 8) * (e.d.boss ? 0.9 : 1) * (e.slow > 0 ? 0.5 : 1); if (e.slow > 0) e.slow -= dt;
  if (e.state === 'idle') { if (d < AGGRO && !me.dead) e.state = 'chase'; else { e.t -= dt; if (e.t < 0) { e.t = 2 + rng() * 3; e.facing = rng() * 6.28; } const wx = Math.sin(e.facing), wz = Math.cos(e.facing); if (home < 6 && e.t > 1) { e.x += wx * 2 * dt; e.z += wz * 2 * dt; } } }
  if (e.state === 'chase') {
    if (me.dead || home > LEASH || d > AGGRO * 2) { e.state = 'return'; }
    else {
      e.facing = Math.atan2(dx, dz);
      const range = e.d.ranged ? 18 : 2.8 * (e.d.size || 1);
      if (d > range) { e.x += dx / d * speed * dt; e.z += dz / d * speed * dt; }
      e.cd -= dt;
      if (e.cd <= 0 && d <= range + 0.5) {
        e.cd = e.d.boss ? 1.1 : 1.5 + rng() * 0.6;
        if (e.d.ranged && d > 4) out.push({ type: 'shot', x: e.x, y: e.y + 1.4 * (e.d.size || 1), z: e.z, dx: dx / d, dz: dz / d, dmg: enemyDmg(e.d), from: e });
        else { e.wind = 0.35; }
      }
      if (e.wind > 0) { e.wind -= dt; if (e.wind <= 0 && d <= range + 1.2) out.push({ type: 'hit', dmg: enemyDmg(e.d), from: e }); }
      // a boss slams the ground where you stand (a red ring warns you first)
      if (e.d.boss) { e.special -= dt; if (e.special <= 0 && !e.mark) { e.mark = { x: me.x, z: me.z, r: 7 * (e.d.size || 1) * 0.8, t: 1.1 }; e.special = 6 + rng() * 2; } }
    }
  }
  if (e.mark) { e.mark.t -= dt; if (e.mark.t <= 0) { if (Math.hypot(me.x - e.mark.x, me.z - e.mark.z) < e.mark.r) out.push({ type: 'hit', dmg: Math.round(enemyDmg(e.d) * 2.2), from: e, slam: true }); out.push({ type: 'slam', x: e.mark.x, z: e.mark.z, r: e.mark.r }); e.mark = null; } }
  if (e.state === 'return') { const hx = e.hx - e.x, hz = e.hz - e.z, hd = Math.hypot(hx, hz); if (hd < 1) { e.state = 'idle'; e.hp = e.max; } else { e.x += hx / hd * speed * 1.4 * dt; e.z += hz / hd * speed * 1.4 * dt; e.facing = Math.atan2(hx, hz); } if (d < AGGRO * 0.6 && !me.dead) e.state = 'chase'; }
  e.y = heightAt(e.x, e.z);
  return out;
}

// ---------------------------------------------------------------- skills
// the skills of what you hold: fists, your sword, or your fruit
export function skillsOf(P) {
  if (P.weapon === 'melee') return STYLES.combat.skills;
  if (P.weapon === 'sword') return P.sword ? SWORDS[P.sword].skills : [];
  return P.fruit ? FRUITS[P.fruit].skills : [];
}
export const masteryOf = (P, weapon = P.weapon) => (weapon === 'melee' ? P.mastery.melee : weapon === 'sword' ? P.mastery.sword[P.sword] || 0 : P.mastery.fruit[P.fruit] || 0);
export const fxColor = (P) => (P.weapon === 'melee' ? STYLES.combat.fx : P.weapon === 'sword' ? SWORDS[P.sword].fx : FRUITS[P.fruit].color);
// G: { P, me (body), enemies, effects, aim: { x, z } (facing) }
// start a skill: puts effects in the world (the page draws them; stepEffects deals the damage)
export function cast(G, skill) {
  const { me } = G, f = G.aimYaw, fx = Math.sin(f), fz = Math.cos(f), weapon = G.P.weapon, col = fxColor(G.P);
  const dmg = hitDamage(G.P, weapon, skill.power), base = { weapon, dmg, col, skill: skill.key, freeze: weapon === 'fruit' && FRUITS[G.P.fruit].freeze, pull: skill.pull };
  const y = me.y + 1.3;
  switch (skill.type) {
    case 'proj': {
      const n = skill.spread || 1;
      for (let i = 0; i < n; i++) { const a = f + (i - (n - 1) / 2) * 0.18; G.effects.push({ ...base, kind: 'proj', x: me.x + Math.sin(a) * 1.2, y, z: me.z + Math.cos(a) * 1.2, dx: Math.sin(a), dz: Math.cos(a), speed: skill.speed, r: skill.radius, left: skill.range, blast: skill.blast || 0, pierce: !!skill.pierce, hit: new Set() }); }
      break;
    }
    case 'aoe': { const reach = skill.reach || 0; G.effects.push({ ...base, kind: 'aoe', x: me.x + fx * reach, y: me.y, z: me.z + fz * reach, r: skill.radius, t: 0.45, done: false }); break; }
    case 'beam': G.effects.push({ ...base, kind: 'beam', x: me.x, y, z: me.z, dx: fx, dz: fz, len: skill.length, w: skill.width, ticks: skill.ticks, every: 0.5 / skill.ticks, next: 0, t: 0.6, dmg: Math.round(dmg / skill.ticks) }); break;
    case 'dash': { me.vx = fx * skill.dist / 0.22; me.vz = fz * skill.dist / 0.22; me.dashT = 0.22; G.effects.push({ ...base, kind: 'dash', t: 0.3, r: 3, hit: new Set() }); break; }
    // a rain of strikes round the aim point (the first lands right on it)
    case 'rain': { const cx = me.x + fx * skill.reach, cz = me.z + fz * skill.reach; for (let i = 0; i < skill.drops; i++) { const a = G.rng() * Math.PI * 2, d = i === 0 ? 0 : Math.sqrt(G.rng()) * skill.radius; G.effects.push({ ...base, kind: 'drop', x: cx + Math.cos(a) * d, y: me.y + 20, z: cz + Math.sin(a) * d, ground: heightAt(cx + Math.cos(a) * d, cz + Math.sin(a) * d), delay: i * 0.08, r: 3 + skill.radius * 0.15, dmg: Math.round(dmg / skill.drops * 2.2) }); } break; }
  }
}
// the basic attack (click): a short swing in front
export function swing(G, combo) {
  const { me } = G, f = G.aimYaw, weapon = G.P.weapon === 'fruit' && !G.P.fruit ? 'melee' : G.P.weapon;
  const power = weapon === 'fruit' ? 0.8 : combo === 2 ? 1.5 : 1;
  G.effects.push({ kind: 'aoe', weapon, dmg: hitDamage(G.P, weapon === 'fruit' ? 'fruit' : weapon, power), col: fxColor({ ...G.P, weapon }), x: me.x + Math.sin(f) * 2.2, y: me.y, z: me.z + Math.cos(f) * 2.2, r: weapon === 'sword' ? 2.8 : 2.2, t: 0.12, done: false, swing: true });
}
// move the effects and deal their damage; returns hits: [{ e, dmg, x, y, z, killed }]
export function stepEffects(G, dt) {
  const hits = [], live = G.enemies.filter((e) => e.state !== 'dead');
  const damage = (e, dmg, fx) => {
    if (e.state === 'dead') return;
    e.hp -= dmg; e.state = e.state === 'idle' || e.state === 'return' ? 'chase' : e.state;
    if (fx.freeze) e.slow = 2.5;
    const killed = e.hp <= 0; if (killed) { e.state = 'dead'; e.respawn = e.d.boss ? 60 : 12; e.mark = null; }
    hits.push({ e, dmg, x: e.x, y: e.y + 2 * (e.d.size || 1), z: e.z, killed, weapon: fx.weapon });
  };
  const inR = (e, x, z, r) => Math.hypot(e.x - x, e.z - z) < r + 0.8 * (e.d.size || 1);
  for (const fx of G.effects) {
    if (fx.kind === 'proj') {
      const step = fx.speed * dt; fx.x += fx.dx * step; fx.z += fx.dz * step; fx.left -= step;
      for (const e of live) if (!fx.hit.has(e) && inR(e, fx.x, fx.z, fx.r)) {
        fx.hit.add(e);
        if (fx.blast) { for (const o of live) if (inR(o, fx.x, fx.z, fx.blast)) { damage(o, fx.dmg, fx); if (fx.pull) { o.x += (fx.x - o.x) * 0.5; o.z += (fx.z - o.z) * 0.5; } } fx.left = 0; fx.boom = true; break; }
        damage(e, fx.dmg, fx); if (!fx.pierce) { fx.left = 0; break; }
      }
      if (fx.y < heightAt(fx.x, fx.z)) fx.left = 0;
      if (fx.left <= 0) fx.gone = true;
    } else if (fx.kind === 'aoe') {
      if (!fx.done) { fx.done = true; for (const e of live) if (inR(e, fx.x, fx.z, fx.r)) { damage(e, fx.dmg, fx); if (fx.pull) { e.x += (fx.x - e.x) * 0.6; e.z += (fx.z - e.z) * 0.6; } } }
      fx.t -= dt; if (fx.t <= 0) fx.gone = true;
    } else if (fx.kind === 'beam') {
      fx.t -= dt; fx.next -= dt; fx.x = G.me.x; fx.z = G.me.z;
      if (fx.next <= 0 && fx.ticks > 0) {
        fx.next = fx.every; fx.ticks--;
        for (const e of live) { const rx = e.x - fx.x, rz = e.z - fx.z, along = rx * fx.dx + rz * fx.dz, side = Math.abs(rx * fx.dz - rz * fx.dx); if (along > 0 && along < fx.len && side < fx.w / 2 + 0.8 * (e.d.size || 1)) damage(e, fx.dmg, fx); }
      }
      if (fx.t <= 0) fx.gone = true;
    } else if (fx.kind === 'dash') {
      fx.t -= dt; for (const e of live) if (!fx.hit.has(e) && inR(e, G.me.x, G.me.z, fx.r)) { fx.hit.add(e); damage(e, fx.dmg, fx); }
      if (fx.t <= 0) fx.gone = true;
    } else if (fx.kind === 'drop') {
      if (fx.delay > 0) { fx.delay -= dt; continue; }
      fx.y -= 60 * dt;
      if (fx.y <= fx.ground) { for (const e of live) if (inR(e, fx.x, fx.z, fx.r)) damage(e, fx.dmg, fx); fx.gone = true; fx.boom = true; }
    }
  }
  // explosions, for the page to draw
  for (const fx of G.effects) if (fx.gone && fx.boom) (G.booms = G.booms || []).push({ x: fx.x, y: fx.kind === 'drop' ? fx.ground : fx.y, z: fx.z, r: fx.blast || fx.r, col: fx.col });
  G.effects = G.effects.filter((fx) => !fx.gone);
  return hits;
}

// node tools/test.mjs — the islands, the people, movement, every kind of skill, and how long it takes to level up
import { ISLANDS, ENEMIES, QUESTS, FRUITS, SWORDS, STYLES, expToNext, enemyHp, enemyDmg, enemyExp, questReward, playerStats, hitDamage, newPlayerData, MAX_LV } from '../js/data.js';
import { heightAt, layout, islandAt } from '../js/world.js';
import { newBody, stepBody, spawnEnemy, stepEnemy, cast, swing, stepEffects } from '../js/combat.js';

let fails = 0;
const ok = (name, cond, extra = '') => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); if (!cond) fails++; };
const rng = (s) => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// ---- data
ok('every island enemy and boss exists', ISLANDS.every((i) => i.enemies.every(([id]) => ENEMIES[id]) && ENEMIES[i.boss] && ENEMIES[i.boss].boss));
ok('every quest has an enemy', QUESTS.every((q) => ENEMIES[q.enemy]));
ok('six fruits with four skills, unlocked in order', Object.values(FRUITS).length === 6 && Object.values(FRUITS).every((f) => f.skills.length === 4 && f.skills.every((s, i) => !i || s.mastery > f.skills[i - 1].mastery)));
ok('swords and the fighting style have skills', Object.values(SWORDS).every((s) => s.skills.length === 2) && STYLES.combat.skills.length === 3);
ok('names in both languages', [...Object.values(ENEMIES), ...Object.values(FRUITS), ...Object.values(SWORDS), ...ISLANDS].every((x) => x.name[0] && x.name[1]));
ok('island levels follow each other', ISLANDS.every((isl, i) => !i || isl.lv[0] === ISLANDS[i - 1].lv[1]) && ISLANDS[ISLANDS.length - 1].lv[1] === MAX_LV);
// ---- the world
{
  const L = layout(7);
  ok('every camp, person and fruit spot stands on land', [...L.camps, ...L.people].every((p) => heightAt(p.x, p.z) > 0.3) && L.fruitSpots.every(([x, z]) => heightAt(x, z) > 0.2),
    [...L.camps, ...L.people].filter((p) => heightAt(p.x, p.z) <= 0.3).map((p) => (p.role || p.enemy) + '@' + p.island).join(' '));
  ok('each island has a quest giver and a dock', ISLANDS.every((i) => L.people.some((p) => p.island === i.id && p.role === 'quest') && L.people.some((p) => p.island === i.id && p.role === 'dock')));
  ok('fruit and sword dealers exist', L.people.some((p) => p.role === 'fruit') && L.people.some((p) => p.role === 'sword'));
  ok('docks are by the water', L.people.filter((p) => p.role === 'dock').every((p) => { for (let a = 0; a < 6.3; a += 0.3) if (heightAt(p.x + Math.cos(a) * 8, p.z + Math.sin(a) * 8) < -0.6) return true; return false; }));
  // (the point half way between two islands, unless a third island sits there)
  ok('the islands are separate, with sea between them', ISLANDS.every((a, i) => ISLANDS.every((b, j) => { const mx = (a.c[0] + b.c[0]) / 2, mz = (a.c[1] + b.c[1]) / 2, other = islandAt(mx, mz); return j <= i || (other && other !== a && other !== b) || heightAt(mx, mz) < -2; })));
  ok('trees, huts and rocks on every island', ISLANDS.every((i) => L.rocks.some((r) => r[4] === i.id)) && L.trees.length > 100 && L.huts.length > 10, `${L.trees.length} trees, ${L.huts.length} huts, ${L.rocks.length} rocks`);
}
// ---- moving
{
  const DT = 1 / 60;
  const b = newBody(0, 0); for (let i = 0; i < 60; i++) stepBody(b, { mx: 1, mz: 0 }, DT, []);
  ok('walk across the island, on the ground', b.grounded && b.x > 10 && Math.abs(b.y - heightAt(b.x, b.z)) < 0.01, `x ${b.x.toFixed(1)}`);
  const s = newBody(0, 0); s.x = 100; s.z = 0; s.y = 5; for (let i = 0; i < 120; i++) stepBody(s, { mx: 1, mz: 0 }, DT, []);
  ok('swim in the sea', s.swimming && s.y < 0, `y ${s.y.toFixed(2)}`);
  const j = newBody(0, 0); let top = 0; stepBody(j, { mx: 0, mz: 0, jump: true }, DT, [], { airJumps: 1 });
  for (let i = 0; i < 90; i++) { stepBody(j, { mx: 0, mz: 0, jump: i === 20 }, DT, [], { airJumps: 1 }); top = Math.max(top, j.y - heightAt(0, 0)); }
  ok('a double jump goes higher than one', top > 4.5, `${top.toFixed(1)} m`);
  const w = newBody(0, 0); for (let i = 0; i < 60; i++) stepBody(w, { mx: 1, mz: 0 }, DT, [[4, 0, 1, heightAt(4, 0) + 6]]);
  ok('trees and huts stop you', w.x < 3, `x ${w.x.toFixed(2)}`);
}
// ---- skills
{
  const r = rng(3), camp = { x: 10, z: 0, r: 3 }, P = newPlayerData(); P.lv = 20; P.fruit = 'flame'; P.weapon = 'fruit';
  const G = { P, me: newBody(0, 0), enemies: [], effects: [], aimYaw: Math.PI / 2, rng: r };
  const mk = () => { const e = spawnEnemy('bandit', camp, 0, r); e.x = 7; e.z = 0; return e; };
  const run = (secs) => { const hits = []; for (let i = 0; i < secs * 60; i++) hits.push(...stepEffects(G, 1 / 60)); return hits; };
  for (const fruit of Object.keys(FRUITS)) {
    P.fruit = fruit;
    for (const sk of FRUITS[fruit].skills) {
      G.enemies = [mk()]; G.effects = []; G.me = newBody(0, 0);
      cast(G, sk.type === 'aoe' && !sk.reach ? { ...sk } : sk);
      if (sk.type === 'aoe' && !sk.reach) { G.me.x = 5; G.effects.forEach((f) => { f.x = 5; }); }
      if (sk.type === 'dash') { for (let i = 0; i < 30; i++) { stepBody(G.me, { mx: 0, mz: 0 }, 1 / 60, []); stepEffects(G, 1 / 60); } }
      const hits = run(1.5);
      if (sk.type !== 'dash' && !hits.length && G.enemies[0].hp === G.enemies[0].max) ok(`${fruit} ${sk.name[1]} hits a bandit in its path`, false);
    }
  }
  ok('every fruit skill reaches an enemy in front of you', true);
  G.enemies = [mk()]; P.weapon = 'melee'; G.me = newBody(4.5, 0); swing(G, 0); const h = run(0.2);
  ok('a punch hits the enemy in front', h.length === 1 && h[0].dmg > 0, h.length ? `${h[0].dmg} damage` : 'missed');
  const e = mk(); e.hp = 1; G.enemies = [e]; swing(G, 0); const k = run(0.2);
  ok('a kill marks the enemy dead and it comes back later', k[0] && k[0].killed && e.state === 'dead' && e.respawn > 0);
  // enemies fight back
  const foe = mk(), me = { x: 8.5, z: 0, dead: false }; let hurt = 0;
  for (let i = 0; i < 300; i++) for (const a of stepEnemy(foe, me, 1 / 60, r)) if (a.type === 'hit') hurt += a.dmg;
  ok('an enemy that sees you attacks', hurt > 0, `${hurt} damage in 5 s`);
}
// ---- how long it takes to level up, playing quests at your level
{
  const P = newPlayerData(); let secs = 0; const marks = {};
  const SPEND = (P) => { while (P.points > 0) { const k = P.lv < 20 ? (P.points % 3 === 0 ? 'defense' : 'sword') : P.points % 3 === 0 ? 'defense' : 'fruit'; P.stats[k]++; P.points--; } };
  const gain = (n) => { P.exp += n; while (P.lv < MAX_LV && P.exp >= expToNext(P.lv)) { P.exp -= expToNext(P.lv); P.lv++; P.points += 3; } SPEND(P); };
  let deaths = 0;
  while (P.lv < MAX_LV && secs < 60 * 60 * 20) {
    if (P.lv >= 15 && !P.fruit) { P.fruit = 'flame'; P.weapon = 'fruit'; }
    if (P.lv >= 25 && P.sword === 'katana') P.sword = 'cutlass';
    // the hardest quest enemy you can take on
    const q = QUESTS.filter((x) => !ENEMIES[x.enemy].boss && ENEMIES[x.enemy].lv <= Math.max(P.lv + 2, 5)).sort((a, b) => ENEMIES[b.enemy].lv - ENEMIES[a.enemy].lv)[0];
    const e = ENEMIES[q.enemy], hp = enemyHp(e), st = playerStats(P);
    // your damage per second: a swing every 0.45 s plus skills between, roughly
    const w = P.weapon === 'fruit' ? 'fruit' : 'sword', dps = hitDamage(P, w, 1) / 0.45 + hitDamage(P, w, 3) / 5;
    const killT = hp / dps + 3.5, taken = enemyDmg(e) / 1.6 * killT * 1.4;               // walking to the next one, and a couple hitting you
    if (taken > st.maxHp) deaths++;
    secs += q.count * killT + 20;                                                     // the quest giver and back
    gain(q.count * enemyExp(e) + questReward(q).exp);
    for (const isl of ISLANDS) if (!marks[isl.id] && P.lv >= isl.lv[0]) marks[isl.id] = secs;
  }
  const fmt = (s) => `${Math.floor(s / 3600)}h${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}`;
  console.log('     reaching each island: ' + ISLANDS.map((i) => `${i.name[1]} Lv${i.lv[0]} at ${fmt(marks[i.id] || 0)}`).join(' · ') + ` · Lv${P.lv} at ${fmt(secs)}`);
  ok('the whole climb to the top level takes a few hours of quests', P.lv === MAX_LV && secs > 2 * 3600 && secs < 9 * 3600, fmt(secs));
  ok('the first island takes a quarter of an hour or so', marks.jungle > 6 * 60 && marks.jungle < 30 * 60, fmt(marks.jungle));
  ok('quests at your level are survivable', deaths < 15, `${deaths} quests where you might fall`);
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);

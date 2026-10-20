// MYSTIC SEAS — the data: islands, enemies, quests, bosses, fruits and their skills, swords, fighting style. No DOM.
// Names are [中文, English].

export const MAX_LV = 120;
// experience to go from level L to L+1
export const expToNext = (L) => Math.round(60 + 22 * Math.pow(L, 1.35) + 5.5 * Math.pow(L, 1.85));

// ---------------------------------------------------------------- islands
// c: centre (x, z), r: radius, h: peak height, ground: 'grass' | 'sand' | 'snow' | 'stone', tree: palm | jungle | cactus | pine | none
// enemies: [enemy id, how many at the camp, camp angle (degrees from the centre), camp distance (fraction of r)]
export const ISLANDS = [
  { id: 'starter', name: ['新手島', 'Starter Isle'], c: [0, 0], r: 46, h: 9, ground: 'grass', tree: 'palm', lv: [1, 12], sky: '#8ad0ff',
    enemies: [['bandit', 6, 40, 0.55], ['monkey', 5, 200, 0.55]], boss: 'chief', bossAt: [300, 0.45] },
  { id: 'jungle', name: ['叢林島', 'Jungle Isle'], c: [200, -50], r: 56, h: 14, ground: 'grass', tree: 'jungle', lv: [12, 30],
    enemies: [['gorilla', 6, 100, 0.55], ['jpirate', 6, 250, 0.55]], boss: 'kong', bossAt: [10, 0.4] },
  { id: 'desert', name: ['沙漠島', 'Desert Isle'], c: [80, 230], r: 60, h: 10, ground: 'sand', tree: 'cactus', lv: [30, 60],
    enemies: [['dbandit', 7, 60, 0.55], ['dofficer', 6, 220, 0.6]], boss: 'sandlord', bossAt: [320, 0.4] },
  { id: 'frost', name: ['冰霜島', 'Frost Isle'], c: [-210, 140], r: 56, h: 16, ground: 'snow', tree: 'pine', lv: [60, 90],
    enemies: [['trooper', 7, 30, 0.55], ['yeti', 6, 190, 0.55]], boss: 'queen', bossAt: [280, 0.4] },
  { id: 'fortress', name: ['海軍要塞', 'Marine Fortress'], c: [-140, -230], r: 62, h: 6, ground: 'stone', tree: 'none', lv: [90, 120],
    enemies: [['marine', 8, 70, 0.55], ['captain', 6, 230, 0.55]], boss: 'admiral', bossAt: [330, 0.35] },
];

// ---------------------------------------------------------------- enemies
// lv, look: [body colour, head colour, hat], ranged: shoots instead of punching
const E = (zh, en, lv, look, extra = {}) => ({ name: [zh, en], lv, look, ...extra });
export const ENEMIES = {
  bandit:   E('強盜', 'Bandit', 5, ['#8a5a3a', '#f0c890', 'band']),
  monkey:   E('猴子', 'Monkey', 10, ['#7a5030', '#c89060', 'ears'], { size: 0.85, fast: true }),
  chief:    E('強盜頭目', 'Bandit Chief', 14, ['#5a2a1a', '#f0c890', 'tricorn'], { boss: true }),
  gorilla:  E('大猩猩', 'Gorilla', 18, ['#3a3a40', '#5a5a60', 'none'], { size: 1.2 }),
  jpirate:  E('叢林海賊', 'Jungle Pirate', 24, ['#2a6a3a', '#e0b080', 'band'], { ranged: true }),
  kong:     E('猩猩王', 'Gorilla King', 32, ['#2a2a30', '#4a4a50', 'crown'], { boss: true, size: 1.6 }),
  dbandit:  E('沙漠強盜', 'Desert Bandit', 38, ['#c89a50', '#d8a070', 'turban']),
  dofficer: E('沙漠軍官', 'Desert Officer', 50, ['#8a6a3a', '#d8a070', 'cap'], { ranged: true }),
  sandlord: E('沙暴之主', 'Sandstorm Lord', 62, ['#d0a040', '#c08050', 'turban'], { boss: true, size: 1.5 }),
  trooper:  E('雪地士兵', 'Snow Trooper', 66, ['#e8f0ff', '#f0d0b0', 'cap'], { ranged: true }),
  yeti:     E('雪怪', 'Yeti', 80, ['#f0f4ff', '#c8d8e8', 'none'], { size: 1.4 }),
  queen:    E('冰霜女王', 'Frost Queen', 92, ['#80c0ff', '#f0e0f0', 'crown'], { boss: true, size: 1.3, ranged: true }),
  marine:   E('海軍', 'Marine', 96, ['#f0f0f0', '#f0c8a0', 'cap'], { ranged: true }),
  captain:  E('海軍上校', 'Marine Captain', 110, ['#2a3a6a', '#f0c8a0', 'tricorn']),
  admiral:  E('海軍大將', 'Admiral', 125, ['#f8f8f8', '#f0c8a0', 'tricorn'], { boss: true, size: 1.6, ranged: true }),
};
// (gentle: enemies have a fifth less health and hit about 40% softer than they first did)
export const enemyHp = (e) => Math.round((60 + e.lv * 24 + Math.pow(e.lv, 1.6) * 2) * (e.boss ? 9 : 1) * 0.8);
export const enemyDmg = (e) => Math.round((4 + e.lv * 0.9) * (e.boss ? 1.4 : 1));
export const enemyExp = (e) => Math.round((10 + e.lv * 6 + Math.pow(e.lv, 1.5)) * (e.boss ? 12 : 1));
export const enemyBeli = (e) => Math.round((8 + e.lv * 7) * (e.boss ? 15 : 1));

// quests: defeat some of one enemy (given by each island's quest giver; the one you can do at your level)
export const QUESTS = ISLANDS.flatMap((isl) => isl.enemies.map(([id]) => ({ island: isl.id, enemy: id, count: ENEMIES[id].lv < 20 ? 5 : 7 })))
  .concat(ISLANDS.map((isl) => ({ island: isl.id, enemy: isl.boss, count: 1 })));
export const questReward = (q) => { const e = ENEMIES[q.enemy]; return { exp: Math.round(expToNext(e.lv) * (e.boss ? 1.6 : 0.55)), beli: Math.round((300 + e.lv * 120) * (e.boss ? 3 : 1)) }; };

// ---------------------------------------------------------------- skills
// type: proj (projectile), aoe (around you, or at reach), beam (a line ahead), dash (rush ahead), rain (strikes around the aim point)
// power: damage multiplier, cd: seconds, en: energy, mastery: needed to unlock, fx: colour, plus shape numbers
const K = (key, zh, en, type, power, cd, en_, mastery, o = {}) => ({ key, name: [zh, en], type, power, cd, en: en_, mastery, ...o });
export const STYLES = {
  combat: { name: ['格鬥', 'Combat'], kind: 'melee', fx: '#ffe0a0', skills: [
    K('Z', '重拳', 'Heavy Punch', 'aoe', 2.2, 4, 8, 0, { reach: 2.5, radius: 3 }),
    K('X', '迴旋踢', 'Spin Kick', 'aoe', 2.8, 7, 14, 15, { radius: 5 }),
    K('C', '百裂拳', 'Hundred Fists', 'beam', 4.2, 11, 22, 40, { length: 7, width: 3, ticks: 6 }) ] },
};
export const SWORDS = {
  katana: { name: ['武士刀', 'Katana'], dmg: 14, price: 1000, fx: '#e8f0ff', skills: [
    K('Z', '居合斬', 'Quick Draw', 'dash', 2.4, 5, 10, 0, { dist: 9 }), K('X', '旋風斬', 'Whirlwind', 'aoe', 3.0, 8, 16, 20, { radius: 5.5 }) ] },
  cutlass: { name: ['彎刀', 'Cutlass'], dmg: 22, price: 12000, fx: '#ffd080', skills: [
    K('Z', '海浪斬', 'Wave Slash', 'proj', 2.6, 5, 12, 0, { speed: 38, radius: 1.6, range: 30 }), K('X', '連斬', 'Flurry', 'beam', 3.6, 9, 18, 20, { length: 6, width: 3, ticks: 5 }) ] },
  dual: { name: ['雙刀', 'Dual Katana'], dmg: 34, price: 60000, fx: '#a0e0ff', skills: [
    K('Z', '十字斬', 'Cross Slash', 'proj', 3.0, 5, 14, 0, { speed: 40, radius: 2.2, range: 34 }), K('X', '雙龍斬', 'Twin Dragons', 'dash', 4.2, 9, 22, 25, { dist: 14 }) ] },
  saber: { name: ['海王劍', 'Sea King Saber'], dmg: 52, price: 0, drop: 'kong', fx: '#60ffc0', skills: [
    K('Z', '潮汐斬', 'Tide Cutter', 'proj', 3.4, 5, 15, 0, { speed: 44, radius: 2.4, range: 40, pierce: true }), K('X', '怒濤', 'Raging Sea', 'aoe', 5.0, 10, 26, 30, { radius: 8 }) ] },
  frostblade: { name: ['寒冰劍', 'Frostblade'], dmg: 78, price: 0, drop: 'queen', fx: '#c0f0ff', skills: [
    K('Z', '冰華', 'Ice Bloom', 'aoe', 3.8, 5, 16, 0, { reach: 6, radius: 4.5 }), K('X', '絕對零度', 'Absolute Zero', 'beam', 5.6, 10, 28, 30, { length: 18, width: 4, ticks: 6 }) ] },
};
export const FRUITS = {
  spring: { name: ['彈簧果實', 'Spring Fruit'], price: 15000, rarity: 0, color: '#ff8ad0', skills: [
    K('Z', '彈簧拳', 'Spring Punch', 'proj', 2.4, 3, 10, 0, { speed: 45, radius: 1.4, range: 26 }),
    K('X', '彈射', 'Launch', 'dash', 2.6, 6, 14, 10, { dist: 16 }),
    K('C', '機關槍拳', 'Gatling', 'beam', 4.4, 10, 24, 40, { length: 10, width: 3, ticks: 8 }),
    K('V', '巨人踩', 'Giant Stomp', 'aoe', 7.0, 18, 40, 100, { reach: 8, radius: 9 }) ] },
  flame: { name: ['火焰果實', 'Flame Fruit'], price: 25000, rarity: 0, color: '#ff6a20', skills: [
    K('Z', '火焰彈', 'Fire Bullet', 'proj', 2.6, 3, 10, 0, { speed: 50, radius: 1.5, range: 32, blast: 3 }),
    K('X', '火柱', 'Fire Pillar', 'aoe', 3.4, 7, 16, 10, { reach: 12, radius: 5 }),
    K('C', '火拳', 'Fire Fist', 'proj', 5.2, 11, 26, 40, { speed: 34, radius: 3, range: 40, blast: 6 }),
    K('V', '流星火雨', 'Meteor Rain', 'rain', 6.8, 18, 40, 100, { reach: 14, radius: 9, drops: 10 }) ] },
  ice: { name: ['冰凍果實', 'Ice Fruit'], price: 60000, rarity: 1, color: '#80e0ff', freeze: true, skills: [
    K('Z', '冰槍', 'Ice Spears', 'proj', 2.2, 3, 10, 0, { speed: 48, radius: 1.2, range: 32, spread: 3 }),
    K('X', '冰道', 'Ice Path', 'dash', 3.0, 6, 16, 10, { dist: 16 }),
    K('C', '冰河時代', 'Ice Age', 'aoe', 5.0, 12, 28, 40, { radius: 11 }),
    K('V', '冰川', 'Glacier', 'beam', 7.2, 18, 40, 100, { length: 30, width: 6, ticks: 5 }) ] },
  light: { name: ['閃光果實', 'Light Fruit'], price: 120000, rarity: 2, color: '#fff27a', speed: 1.15, skills: [
    K('Z', '光之箭', 'Light Arrow', 'proj', 2.8, 2.5, 10, 0, { speed: 80, radius: 1.1, range: 45 }),
    K('X', '閃光步', 'Flash Step', 'dash', 3.2, 5, 14, 10, { dist: 24 }),
    K('C', '光束', 'Light Beam', 'beam', 5.6, 11, 28, 40, { length: 40, width: 3, ticks: 6 }),
    K('V', '天之光雨', 'Sky Rain', 'rain', 7.0, 18, 40, 100, { reach: 16, radius: 10, drops: 14 }) ] },
  quake: { name: ['震動果實', 'Quake Fruit'], price: 150000, rarity: 2, color: '#e8e8ff', skills: [
    K('Z', '震波', 'Shockwave', 'beam', 3.0, 3.5, 12, 0, { length: 14, width: 5, ticks: 1 }),
    K('X', '震拳', 'Quake Punch', 'aoe', 3.8, 7, 18, 10, { reach: 3, radius: 6 }),
    K('C', '大地震', 'Tremor', 'aoe', 5.8, 12, 30, 40, { radius: 14 }),
    K('V', '海嘯', 'Seaquake', 'rain', 8.0, 20, 45, 100, { reach: 10, radius: 14, drops: 8 }) ] },
  dark: { name: ['暗黑果實', 'Dark Fruit'], price: 300000, rarity: 3, color: '#7a3aff', lifesteal: 0.08, skills: [
    K('Z', '黑洞彈', 'Black Hole Shot', 'proj', 3.2, 3.5, 12, 0, { speed: 36, radius: 2, range: 34, blast: 5, pull: true }),
    K('X', '暗黑漩渦', 'Dark Vortex', 'aoe', 4.2, 8, 20, 10, { reach: 10, radius: 7, pull: true }),
    K('C', '虛空光束', 'Void Beam', 'beam', 6.2, 12, 30, 40, { length: 32, width: 5, ticks: 6 }),
    K('V', '日蝕', 'Eclipse', 'aoe', 9.0, 22, 50, 100, { radius: 18 }) ] },
};
export const FRUIT_IDS = Object.keys(FRUITS);
export const RARITY = [['普通', 'Common'], ['稀有', 'Uncommon'], ['傳說', 'Rare'], ['神話', 'Mythical']];

// ---------------------------------------------------------------- the player's numbers
// points: melee / defense / sword / fruit; mastery grows with use
export function playerStats(P) {
  const L = P.lv, s = P.stats;
  return {
    maxHp: Math.round(120 + L * 9 + s.defense * 14),
    maxEnergy: Math.round(100 + L * 2 + s.melee * 1.5),
    melee: (base) => base * (1 + s.melee * 0.025) + L * 0.5,
    sword: (base) => base * (1 + s.sword * 0.03) + L * 0.4,
    fruit: (base) => base * (1 + s.fruit * 0.032) + L * 0.6,
  };
}
// what a hit does: the base attack of the active weapon times the skill power
export function hitDamage(P, weapon, power) {
  const st = playerStats(P);
  if (weapon === 'melee') return Math.round(st.melee(12) * power);
  if (weapon === 'sword') return Math.round(st.sword(P.sword ? SWORDS[P.sword].dmg : 8) * power);
  return Math.round(st.fruit(16) * power);
}
export const newPlayerData = () => ({ v: 1, lv: 1, exp: 0, points: 0, stats: { melee: 1, defense: 1, sword: 1, fruit: 1 }, beli: 300, fruit: null, stored: null, sword: 'katana',
  swords: ['katana'], mastery: { melee: 0, sword: {}, fruit: {} }, quest: null, spawn: 'starter', bosses: {}, weapon: 'melee' });

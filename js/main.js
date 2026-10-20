// MYSTIC SEAS — the page: draws the sea and the islands, reads keyboard / mouse / controller / touch, and runs
// quests, levels, shops, mystic fruits, boats and the save.
import * as THREE from 'three';
import { ISLANDS, ENEMIES, QUESTS, FRUITS, FRUIT_IDS, SWORDS, STYLES, RARITY, MAX_LV, expToNext, enemyExp, enemyBeli, questReward, playerStats, newPlayerData } from './data.js?v=2';
import { heightAt, islandAt, layout, makeRng } from './world.js?v=2';
import { MOVE, newBody, stepBody, spawnEnemy, stepEnemy, skillsOf, masteryOf, cast, swing, stepEffects } from './combat.js?v=2';
import { buildWorld, makeCharacter, swordMesh, pose, makeTag, drawTag, makeBoat, glow, orb, ring, beamMesh, slashMesh } from './scene.js?v=2';
import { Sound } from './audio.js?v=2';

const $ = (id) => document.getElementById(id);
// ---------------------------------------------------------------- language
const q = new URLSearchParams(location.search);
let lang = q.get('lang') || (() => { try { return localStorage.getItem('mysticseas.lang'); } catch (e) { return null; } })() || ((navigator.language || '').startsWith('zh') ? 'zh' : 'en');
if (lang !== 'en') lang = 'zh';
const EN = () => lang === 'en';
const L = (zh, en) => (EN() ? en : zh);
const N = (pair) => pair[EN() ? 1 : 0];
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const coin = (n) => `<span class="gold"><i class="coin"></i>${fmt(n)}</span>`;

// ---------------------------------------------------------------- the save
const KEY = 'mysticseas.save';
function loadSave() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) { const P = { ...newPlayerData(), ...s }; P.mastery = { melee: 0, sword: {}, fruit: {}, ...s.mastery }; return P; } } catch (e) { /* none */ } return null; }
let P = loadSave() || newPlayerData();
let hadSave = !!loadSave();
const store = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* private mode */ } };

// ---------------------------------------------------------------- renderer and the world
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace;
// filmic colour: brighter highlights that do not burn out, richer shadows
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1400);
scene.background = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#1f6fd0'); gr.addColorStop(0.45, '#5ab0f0'); gr.addColorStop(0.8, '#b8e2ff'); gr.addColorStop(1, '#f0f8ff'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
scene.fog = new THREE.Fog('#d8eeff', 180, 700);
scene.add(new THREE.HemisphereLight('#cfe8ff', '#6a7a4a', 1.0));
const sun = new THREE.DirectionalLight('#fff0d0', 2.3); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 200 }); sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const sound = new Sound();

const LAY = layout(7);
// the piers are things to stand on
for (const p of LAY.people.filter((x) => x.role === 'dock')) {
  const isl = ISLANDS.find((i) => i.id === p.island), dx = p.x - isl.c[0], dz = p.z - isl.c[1], d = Math.hypot(dx, dz);
  p.ux = dx / d; p.uz = dz / d;
  for (let k = 0; k <= 13; k += 1.5) LAY.colliders.push([p.x + p.ux * k, p.z + p.uz * k, 1.5, 0.8]);
}
const W = buildWorld(scene, LAY);

// ---------------------------------------------------------------- the people
const ROLE = {
  quest: { look: ['#3a7ad8', '#f0c8a0', 'straw'], name: ['任務委託人', 'Quest Giver'], col: '#ffd040' },
  dock: { look: ['#2a5a8a', '#e0b890', 'cap'], name: ['船塢管理員', 'Dockmaster'], col: '#8ad0ff' },
  fruit: { look: ['#a040c0', '#f0c8a0', 'turban'], name: ['果實商人', 'Fruit Dealer'], col: '#ff9ae0' },
  sword: { look: ['#5a5a6a', '#f0c8a0', 'band'], name: ['刀劍商人', 'Sword Dealer'], col: '#e8e8f0' },
};
const people = LAY.people.map((p) => {
  const isl = ISLANDS.find((i) => i.id === p.island), ch = makeCharacter(ROLE[p.role].look);
  ch.position.set(p.x, p.y, p.z); ch.rotation.y = p.role === 'dock' ? Math.atan2(-p.ux, -p.uz) : Math.atan2(isl.c[0] - p.x, isl.c[1] - p.z) + Math.PI;
  const tag = makeTag('', ROLE[p.role].col); tag.position.y = 2.8; ch.add(tag); scene.add(ch);
  return { ...p, isl, ch, tag };
});
function nameTags() {
  for (const p of people) { p.tag.userData.text = (p.role === 'quest' ? '❗ ' : '') + N(ROLE[p.role].name); p.tag.userData.last = -9; drawTag(p.tag, -1); }
  for (const e of enemies) { e.tag.userData.text = `${N(e.d.name)} Lv${e.d.lv}`; e.tag.userData.last = -9; }
}

// ---------------------------------------------------------------- enemies
const enemies = [];
{
  const r = makeRng(99);
  for (const camp of LAY.camps) for (let i = 0; i < camp.n; i++) {
    const e = spawnEnemy(camp.enemy, camp, i, r); e.camp = camp; e.ci = i;
    const size = e.d.size || 1, ch = makeCharacter(e.d.look, size), tag = makeTag('', e.d.boss ? '#ff7a5a' : '#ffffff', e.d.boss);
    tag.position.y = 2.3 * size + 0.6; ch.add(tag); scene.add(ch); e.ch = ch; e.tag = tag;
    enemies.push(e);
  }
}
nameTags();

// ---------------------------------------------------------------- the player
const spawnAt = (id) => { const g = LAY.people.find((p) => p.island === id && p.role === 'quest'); return [g.x + 3, g.z + 2.5]; };
let me = newBody(...spawnAt(P.spawn));
const avatar = makeCharacter(['#3a8ad8', '#f0c8a0', 'straw']); scene.add(avatar);
const G = { P, me, enemies, effects: [], aimYaw: 0, rng: Math.random, booms: [] };
const S = { mode: 'title', hp: 1, en: 1, dead: 0, cds: {}, combo: 0, comboT: 0, atkCd: 0, atkAnim: 0, lastHurt: -99, island: null, boat: null, riding: false,
  fruits: [], fruitT: 45, playT: 0, saveT: 0, panel: null, near: null, drownT: 0, bossSeen: {}, shots: [] };
const ST = () => playerStats(P);
function fullHeal() { S.hp = ST().maxHp; S.en = ST().maxEnergy; }
fullHeal();
// what the right hand holds
function holdWeapon() {
  const h = avatar.userData.hand; while (h.children.length) h.remove(h.children[0]);
  if (P.weapon === 'sword') { h.add(swordMesh(SWORDS[P.sword].fx)); }
  if (P.weapon === 'fruit' && P.fruit) h.add(glow(FRUITS[P.fruit].color, 1.6));
}
holdWeapon();

// ---------------------------------------------------------------- the camera
const cam = { yaw: Math.PI * 0.75, pitch: 0.38, dist: 13, lock: false };
let dragging = false, lastX = 0, lastY = 0, mouseAtk = false;
const turnCam = (dx, dy, k) => { cam.yaw -= dx * k; cam.pitch = Math.max(-0.25, Math.min(1.25, cam.pitch + dy * k)); };
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') return; sound.start();
  if (e.button === 2 || e.button === 1) { dragging = true; lastX = e.clientX; lastY = e.clientY; }
  else if (e.button === 0 && S.mode === 'play') { mouseAtk = true; if (cam.lock && document.pointerLockElement !== canvas && canvas.requestPointerLock) canvas.requestPointerLock(); }
});
addEventListener('pointerup', () => { dragging = false; mouseAtk = false; });
addEventListener('pointermove', (e) => {
  if (cam.lock && document.pointerLockElement === canvas) { turnCam(e.movementX, e.movementY, 0.004); return; }
  if (!dragging) return; turnCam(e.clientX - lastX, e.clientY - lastY, 0.006); lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener('wheel', (e) => { cam.dist = Math.max(5, Math.min(34, cam.dist * (e.deltaY > 0 ? 1.1 : 0.9))); e.preventDefault(); }, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
function toggleLock() {
  cam.lock = !cam.lock;
  if (cam.lock && canvas.requestPointerLock && !PAD.used) canvas.requestPointerLock(); else if (!cam.lock && document.exitPointerLock) document.exitPointerLock();
  toast(cam.lock ? L('視角鎖定：開（滑鼠轉動視角）', 'Shift lock: on (the mouse turns the camera)') : L('視角鎖定：關', 'Shift lock: off'));
}

// ---------------------------------------------------------------- input: one-shot actions and what is held
const keys = new Set(), act = new Set();
const KEYMAP = { Space: 'jump', KeyQ: 'dash', KeyE: 'E', KeyZ: 'Z', KeyX: 'X', KeyC: 'C', KeyV: 'V', Digit1: 'w1', Digit2: 'w2', Digit3: 'w3', Tab: 'menu', KeyM: 'map', ShiftLeft: 'lock', ShiftRight: 'lock', KeyF: 'hit' };
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  keys.add(e.code); sound.start();
  if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.repeat) return;
  if (S.mode === 'title') { if (e.code === 'Enter' || e.code === 'Space') play(false); return; }
  if (S.panel) {
    if (e.code === 'Escape' || (e.code === 'Tab' && S.panel === 'menu') || (e.code === 'KeyM' && S.panel === 'map') || (e.code === 'KeyE' && S.panel === 'npc')) closePanel();
    return;
  }
  if (KEYMAP[e.code]) act.add(KEYMAP[e.code]);
});
addEventListener('keyup', (e) => keys.delete(e.code));
// touch: a stick on the left, drag on the right turns the camera, buttons for the rest
const touch = { id: null, ox: 0, oy: 0, x: 0, y: 0, camId: null, cx: 0, cy: 0, atk: false };
canvas.addEventListener('touchstart', (e) => {
  sound.start();
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth * 0.42 && touch.id === null) { touch.id = t.identifier; touch.ox = t.clientX; touch.oy = t.clientY; touch.x = touch.y = 0; $('stick').style.left = (t.clientX - 60) + 'px'; $('stick').style.top = (t.clientY - 60) + 'px'; $('stick').hidden = false; }
    else if (touch.camId === null) { touch.camId = t.identifier; touch.cx = t.clientX; touch.cy = t.clientY; }
  }
}, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === touch.id) { let dx = t.clientX - touch.ox, dy = t.clientY - touch.oy; const d = Math.hypot(dx, dy); if (d > 55) { dx *= 55 / d; dy *= 55 / d; } touch.x = dx / 55; touch.y = dy / 55; $('knob').style.transform = `translate(${dx}px,${dy}px)`; }
    if (t.identifier === touch.camId) { turnCam(t.clientX - touch.cx, t.clientY - touch.cy, 0.008); touch.cx = t.clientX; touch.cy = t.clientY; }
  }
}, { passive: true });
const endTouch = (e) => { for (const t of e.changedTouches) { if (t.identifier === touch.id) { touch.id = null; touch.x = touch.y = 0; $('stick').hidden = true; $('knob').style.transform = ''; } if (t.identifier === touch.camId) touch.camId = null; } };
canvas.addEventListener('touchend', endTouch); canvas.addEventListener('touchcancel', endTouch);
const tap = (id, fn, up) => { const b = $(id); b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); sound.start(); fn(); }); if (up) { b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up); } };
tap('b-atk', () => { touch.atk = true; }, () => { touch.atk = false; });
tap('b-jump', () => act.add('jump')); tap('b-dash', () => act.add('dash')); tap('b-e', () => act.add('E'));
tap('b-map', () => (S.panel === 'map' ? closePanel() : act.add('map'))); tap('b-menu', () => (S.panel === 'menu' ? closePanel() : act.add('menu')));
tap('b-music', () => { sound.setMusic(!sound.musicOn); $('b-music').classList.toggle('off', !sound.musicOn); });
$('weapons').addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-w]'); if (!b) return; e.preventDefault(); act.add({ melee: 'w1', sword: 'w2', fruit: 'w3' }[b.dataset.w]); });
$('skills').addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; e.preventDefault(); act.add(b.dataset.k); });

// ---------------------------------------------------------------- game controllers (standard mapping, Xbox names)
// left stick move · right stick camera · A jump · B dash · X / RT attack · Y talk · D-pad ↑→↓← skills Z X C V
// LB / RB change weapon · Start menu · View map · R3 shift lock · L3 zoom · in menus: D-pad picks, A presses, B closes
const PAD = { ix: 0, iz: 0, atk: false, prev: [], connected: false, used: false, focus: 0 };
const DEAD = 0.18, dz = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));
addEventListener('gamepadconnected', (e) => { PAD.connected = true; sound.start(); toast(L(`已連接控制器：${e.gamepad.id.split('(')[0].trim()}`, `Controller connected: ${e.gamepad.id.split('(')[0].trim()}`)); staticText(); });
addEventListener('gamepaddisconnected', () => { PAD.connected = [...(navigator.getGamepads ? navigator.getGamepads() : [])].some(Boolean); toast(L('控制器已中斷', 'Controller disconnected')); staticText(); });
function panelButtons() { return [...$('panel').querySelectorAll('button:not([disabled])')]; }
function markFocus() { const bs = panelButtons(); bs.forEach((b, i) => b.classList.toggle('focus', PAD.used && i === PAD.focus)); const f = bs[PAD.focus]; if (f && PAD.used) f.scrollIntoView({ block: 'nearest' }); }
function pollPad(dt) {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  PAD.ix = 0; PAD.iz = 0; PAD.atk = false;
  const gp = pads[0]; if (!gp) return;
  const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed), pressed = (i) => b(i) && !PAD.prev[i];
  if (gp.buttons.some((x) => x.pressed) || gp.axes.some((a) => Math.abs(a) > 0.5)) { if (!PAD.used) { PAD.used = true; markFocus(); } sound.start(); }
  const cx = dz(gp.axes[2] || 0), cy = dz(gp.axes[3] || 0);
  if (S.mode === 'title') { if (pressed(0) || pressed(9)) play(false); }
  else if (S.panel) {
    const bs = panelButtons(), n = bs.length;
    if (n && (pressed(13) || pressed(15))) { PAD.focus = (PAD.focus + 1) % n; markFocus(); }
    if (n && (pressed(12) || pressed(14))) { PAD.focus = (PAD.focus - 1 + n) % n; markFocus(); }
    if (pressed(0) && bs[PAD.focus]) bs[PAD.focus].click();
    if (pressed(1) || (pressed(9) && S.panel === 'menu') || (pressed(8) && S.panel === 'map')) closePanel();
  } else {
    PAD.ix = dz(gp.axes[0] || 0); PAD.iz = -dz(gp.axes[1] || 0);
    turnCam(cx * 2.6 * dt, cy * 1.7 * dt, 1);
    PAD.atk = b(2) || b(7);
    const one = { 0: 'jump', 1: 'dash', 3: 'E', 12: 'Z', 15: 'X', 13: 'C', 14: 'V', 4: 'wprev', 5: 'wnext', 9: 'menu', 8: 'map', 11: 'lock' };
    for (const [i, a] of Object.entries(one)) if (pressed(+i)) act.add(a);
    if (pressed(10)) cam.dist = cam.dist > 20 ? 9 : cam.dist > 12 ? 24 : 16;
  }
  PAD.prev = gp.buttons.map((x) => x.pressed);
}
// where you are trying to go, turned by the camera
function readMove() {
  let ix = PAD.ix, iz = PAD.iz;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1; if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  if (touch.id !== null) { ix += touch.x; iz -= touch.y; }
  const len = Math.hypot(ix, iz); if (len > 1) { ix /= len; iz /= len; }
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  return { mx: fx * iz + rx * ix, mz: fz * iz + rz * ix };
}

// ---------------------------------------------------------------- fighting
const angDiff = (a, b) => ((a - b + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
const lerpAngle = (a, b, k) => a - angDiff(a, b) * k;
// aim at the nearest enemy roughly in front, or straight ahead
function aim() {
  const base = cam.lock ? cam.yaw + Math.PI : me.facing; let best = null, score = 1e9;
  for (const e of enemies) {
    if (e.state === 'dead') continue;
    const dx = e.x - me.x, dzz = e.z - me.z, d = Math.hypot(dx, dzz); if (d > 30) continue;
    const a = Math.atan2(dx, dzz), off = Math.abs(angDiff(a, base)); if (off > 1.1) continue;
    if (d + off * 12 < score) { score = d + off * 12; best = a; }
  }
  G.aimYaw = best ?? base; me.facing = G.aimYaw;
}
const cdId = (key) => `${P.weapon}:${P.weapon === 'sword' ? P.sword : P.weapon === 'fruit' ? P.fruit : ''}:${key}`;
function attack() {
  if (S.atkCd > 0 || S.riding) return;
  S.atkCd = P.weapon === 'fruit' && P.fruit ? 0.4 : 0.3; if (S.comboT <= 0) S.combo = 0;
  aim(); swing(G, S.combo); S.combo = (S.combo + 1) % 3; S.comboT = 0.9; S.atkAnim = 1; sound.play('swing');
}
function useSkill(key) {
  if (S.riding) return;
  const sk = skillsOf(P).find((s) => s.key === key); if (!sk) return;
  if (masteryOf(P) < sk.mastery) { sound.play('deny'); toast(L(`「${N(sk.name)}」需要熟練度 ${sk.mastery}`, `${N(sk.name)} needs mastery ${sk.mastery}`)); return; }
  const id = cdId(key); if ((S.cds[id] || 0) > 0) return;
  if (S.en < sk.en) { sound.play('deny'); toast(L('體力不足', 'Not enough energy')); return; }
  S.en -= sk.en; S.cds[id] = sk.cd; aim(); cast(G, sk); S.atkAnim = 1;
  sound.play({ proj: 'proj', beam: 'beam', aoe: 'aoe', rain: 'aoe', dash: 'dash' }[sk.type]);
}
function setWeapon(w) {
  if (w === 'fruit' && !P.fruit) { sound.play('deny'); toast(L('你還沒吃果實。樹下偶爾會長出果實，也可以向果實商人購買。', 'You have not eaten a fruit. They grow under trees now and then, or buy one from a fruit dealer.')); return; }
  if (P.weapon === w) return;
  P.weapon = w; holdWeapon(); sound.play('click'); hud(true);
}
function addMastery(weapon, amt) {
  const before = masteryOf(P, weapon), M = P.mastery;
  if (weapon === 'melee') M.melee = Math.min(600, M.melee + amt);
  else if (weapon === 'sword') M.sword[P.sword] = Math.min(600, (M.sword[P.sword] || 0) + amt);
  else if (weapon === 'fruit' && P.fruit) M.fruit[P.fruit] = Math.min(600, (M.fruit[P.fruit] || 0) + amt);
  const after = masteryOf(P, weapon);
  const list = weapon === 'melee' ? STYLES.combat.skills : weapon === 'sword' ? SWORDS[P.sword].skills : P.fruit ? FRUITS[P.fruit].skills : [];
  for (const s of list) if (before < s.mastery && after >= s.mastery) { sound.play('quest'); banner(L('學會新招式！', 'New skill!'), `${s.key} · ${N(s.name)}`, '#7ae0ff'); }
}
function gainExp(n) {
  if (P.lv >= MAX_LV) return;
  P.exp += n; let up = 0;
  while (P.lv < MAX_LV && P.exp >= expToNext(P.lv)) { P.exp -= expToNext(P.lv); P.lv++; P.points += 3; up++; }
  if (P.lv >= MAX_LV) P.exp = 0;
  if (up) {
    fullHeal(); sound.play('level');
    banner(L(`升級！Lv ${P.lv}`, `Level up! Lv ${P.lv}`), L(`+${up * 3} 能力點數 · 按 Tab／選單分配`, `+${up * 3} stat points · spend them in the menu (Tab)`), '#ffd040');
    if (P.lv >= 10 && P.lv - up < 10) setTimeout(() => banner(L('學會「月步」！', 'Learned Sky Step!'), L('在空中再按一次跳躍：二段跳', 'Press jump again in the air: a double jump'), '#7ae0ff'), 2300);
  }
}
function onKill(h) {
  const e = h.e, d = e.d, exp = enemyExp(d), gold = enemyBeli(d);
  sound.play('kill'); burst(e.x, e.y + 1, e.z, d.look[0]);
  gainExp(exp); P.beli += gold;
  float(`+${fmt(exp)} EXP`, e.x, e.y + 3.2 * (d.size || 1), e.z, 'xp');
  addMastery(h.weapon, (0.3 + d.lv / 100) * (d.boss ? 6 : 1));
  if (P.quest && P.quest.enemy === e.id) { P.quest.n++; if (P.quest.n >= P.quest.count) completeQuest(); }
  if (d.boss) {
    P.bosses[e.id] = (P.bosses[e.id] || 0) + 1;
    const sw = Object.entries(SWORDS).find(([, s]) => s.drop === e.id);
    if (sw && !P.swords.includes(sw[0]) && (P.bosses[e.id] === 1 || Math.random() < 0.3)) { P.swords.push(sw[0]); setTimeout(() => { sound.play('fruit'); banner(L('首領掉落了寶物！', 'The boss dropped a treasure!'), `${N(SWORDS[sw[0]].name)} · ${L('在選單裝備', 'equip it in the menu')}`, '#ffd040'); }, 1800); }
    if (Math.random() < 0.12) spawnFruit(e.x + 2, e.z);
  }
  store(); hud(true);
}
function completeQuest() {
  const r = questReward(P.quest); P.quest = null;
  sound.play('quest'); banner(L('任務完成！', 'Quest complete!'), `+${fmt(r.exp)} EXP · +${fmt(r.beli)} ${L('金幣', 'gold')}`, '#5ae08a');
  gainExp(r.exp); P.beli += r.beli;
}
function hurt(dmg) {
  if (S.dead > 0 || me.dashT > 0 || S.mode !== 'play' || S.safe) return;
  S.hp -= dmg; S.lastHurt = S.playT; sound.play('hurt'); shake = Math.max(shake, 0.1); avatar.userData.punch = 0.6;
  const d = $('hurt'); d.classList.remove('on'); void d.offsetWidth; d.classList.add('on');
  float(`-${dmg}`, me.x, me.y + 2.4, me.z, 'me');
  if (S.hp <= 0) die();
}
function die() {
  S.hp = 0; S.dead = 3; leaveBoat(false); avatar.visible = false; sound.play('die'); burst(me.x, me.y + 1, me.z, '#3a8ad8');
  banner(L('你倒下了', 'You were defeated'), L(`回到${N(ISLANDS.find((i) => i.id === P.spawn).name)}…`, `Back to ${N(ISLANDS.find((i) => i.id === P.spawn).name)}…`), '#ff6060');
}
function respawn() { me = newBody(...spawnAt(P.spawn)); G.me = me; fullHeal(); avatar.visible = true; S.dead = 0; }

// ---------------------------------------------------------------- boats
const boatMesh = makeBoat(); boatMesh.visible = false; scene.add(boatMesh);
function summonBoat(dock) {
  S.boat = { x: dock.x + dock.ux * 19, z: dock.z + dock.uz * 19, yaw: Math.atan2(dock.ux, dock.uz), v: 0 };
  boatMesh.visible = true; sound.play('horn'); toast(L('船停在碼頭盡頭。走過去按 E 上船。', 'Your boat waits at the end of the pier. Walk over and press E to board.'));
}
function board() { S.riding = true; me.vx = me.vz = me.vy = 0; sound.play('horn'); toast(L('W／搖桿 開船 · 空白鍵 跳下船', 'W / stick to sail · Space to jump off')); }
function leaveBoat(jump) {
  if (!S.riding) return; S.riding = false;
  me.y = 1.2; me.grounded = false; me.swimming = false;
  if (jump) { me.vy = MOVE.jump; me.vx = Math.sin(S.boat.yaw) * 9; me.vz = Math.cos(S.boat.yaw) * 9; sound.play('jump'); }
}
function stepBoat(mv, dt) {
  const b = S.boat, want = Math.min(1, Math.hypot(mv.mx, mv.mz));
  if (want > 0.1) { const ty = Math.atan2(mv.mx, mv.mz); b.yaw = lerpAngle(b.yaw, ty, Math.min(1, dt * 1.5)); b.v += (32 * want * Math.max(0.15, Math.cos(angDiff(ty, b.yaw))) - b.v) * Math.min(1, dt * 0.9); }
  else b.v *= Math.max(0, 1 - dt * 0.9);
  const nx = b.x + Math.sin(b.yaw) * b.v * dt, nz = b.z + Math.cos(b.yaw) * b.v * dt;
  if (heightAt(nx + Math.sin(b.yaw) * 4.5, nz + Math.cos(b.yaw) * 4.5) > -1.2 || heightAt(nx, nz) > -1.2) b.v = 0; else { b.x = nx; b.z = nz; }
  me.x = b.x; me.z = b.z; me.y = 1.15; me.facing = b.yaw; me.grounded = true; me.swimming = false;
}

// ---------------------------------------------------------------- mystic fruits lying in the world
const swirlTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 64); g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 3;
  for (const [cx, cy] of [[20, 20], [60, 40], [100, 18], [40, 56], [90, 54], [120, 40]]) { g.beginPath(); for (let t = 0; t < 12; t += 0.2) { const r = t * 1.1; g.lineTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r); } g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
function fruitMesh(id) {
  const f = FRUITS[id], g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 14), new THREE.MeshStandardMaterial({ color: f.color, map: swirlTex, roughness: 0.35, emissive: f.color, emissiveIntensity: 0.2 }));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.35), new THREE.MeshStandardMaterial({ color: '#4a3a1a' })); stem.position.y = 0.7;
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), new THREE.MeshStandardMaterial({ color: '#3ab040' })); leaf.scale.set(1, 0.3, 0.6); leaf.position.set(0.2, 0.82, 0);
  g.add(body, stem, leaf, glow(f.color, 3.4)); return g;
}
const WEIGHT = [10, 5, 2, 0.8];
function randomFruit(r = Math.random) { const tot = FRUIT_IDS.reduce((s, id) => s + (FRUITS[id].rarity === 0 ? WEIGHT[0] : WEIGHT[FRUITS[id].rarity]), 0); let x = r() * tot; for (const id of FRUIT_IDS) { x -= WEIGHT[FRUITS[id].rarity]; if (x <= 0) return id; } return 'spring'; }
function spawnFruit(x, z, id = randomFruit()) { const m = fruitMesh(id), y = heightAt(x, z) + 0.8; m.position.set(x, y, z); scene.add(m); S.fruits.push({ id, x, y, z, m, t: 0 }); return S.fruits[S.fruits.length - 1]; }
function removeFruit(f) { scene.remove(f.m); S.fruits = S.fruits.filter((x) => x !== f); }
function eatFruit(id) {
  const old = P.fruit; P.fruit = id; P.weapon = 'fruit'; holdWeapon(); sound.play('fruit');
  banner(L(`吃下了${N(FRUITS[id].name)}！`, `You ate the ${N(FRUITS[id].name)}!`), old ? L(`失去了${N(FRUITS[old].name)}的能力`, `The ${N(FRUITS[old].name)} power is gone`) : L('按 3 使用果實能力 · Z 施放第一招', 'Press 3 for your fruit power · Z for its first skill'), FRUITS[id].color);
  store(); hud(true);
}

// ---------------------------------------------------------------- panels: people, the menu, the map
let handlers = [];
const btn = (label, fn, o = {}) => { handlers.push(fn); return `<button data-i="${handlers.length - 1}" class="${o.cls || ''}"${o.off ? ' disabled' : ''}>${label}</button>`; };
function showPanel(kind, title, build) {
  handlers = []; const html = build();
  $('panel').innerHTML = `<div class="pbox ${kind}"><h2><span>${title}</span><button data-i="x" class="x" aria-label="close">✕</button></h2>${html}</div>`;
  if (S.panel !== kind) PAD.focus = 0;
  $('panel').hidden = false; S.panel = kind; const n = panelButtons().length; if (PAD.focus >= n) PAD.focus = Math.max(0, n - 1); markFocus();
  if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
}
function closePanel() { $('panel').hidden = true; $('panel').innerHTML = ''; S.panel = null; mapOpen = null; }
$('panel').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) { if (e.target === $('panel')) closePanel(); return; }
  sound.play('click'); if (b.dataset.i === 'x') closePanel(); else if (handlers[+b.dataset.i]) handlers[+b.dataset.i]();
});
const fruitDot = (id) => `<i class="fdot" style="--c:${FRUITS[id].color}"></i>`;
const rarity = (id) => `<small class="rar r${FRUITS[id].rarity}">${N(RARITY[FRUITS[id].rarity])}</small>`;
const skillList = (list) => `<small class="skl">${list.map((s) => `${s.key} ${N(s.name)}${s.mastery ? ` <em>(${s.mastery})</em>` : ''}`).join(' · ')}</small>`;
// the level a quest needs (an island's first quest is open from the island's own starting level)
const reqLv = (qq) => { const e = ENEMIES[qq.enemy], isl = ISLANDS.find((i) => i.id === qq.island), base = Math.max(1, e.lv - (e.boss ? 4 : 3)); return isl.enemies[0][0] === qq.enemy ? Math.min(base, isl.lv[0]) : base; };
const questText = (qq) => { const e = ENEMIES[qq.enemy]; return L(`打倒${N(e.name)} ${qq.n}/${qq.count}`, `Defeat ${N(e.name)} ${qq.n}/${qq.count}`); };

function questPanel(isl) {
  showPanel('npc', `${N(ROLE.quest.name)} · ${N(isl.name)}`, () => {
    let h = `<p class="say">${L('想變強？去打倒這些傢伙，我會好好答謝你！', 'Want to get stronger? Defeat these folks and I will make it worth your while!')}</p>`;
    if (P.quest) h += `<div class="cur">${L('目前任務', 'Current quest')}${L('：', ': ')}<b>${questText(P.quest)}</b> ${btn(L('放棄', 'Abandon'), () => { P.quest = null; store(); questPanel(isl); hud(true); })}</div>`;
    h += '<div class="list">';
    for (const qq of QUESTS.filter((x) => x.island === isl.id)) {
      const e = ENEMIES[qq.enemy], need = reqLv(qq), r = questReward(qq), ok = P.lv >= need, cur = P.quest && P.quest.enemy === qq.enemy;
      h += `<div class="it ${ok ? '' : 'locked'}"><div><b>${L(`打倒 ${qq.count} 個${N(e.name)}`, `Defeat ${qq.count} × ${N(e.name)}`)}</b> <small>Lv ${e.lv}${e.boss ? ' · ' + L('首領', 'Boss') : ''}</small><br><small>${L('獎勵', 'Reward')} ${fmt(r.exp)} EXP · ${coin(r.beli)}</small></div>`
        + (ok ? btn(cur ? L('進行中', 'Active') : L('接受', 'Accept'), () => { P.quest = { enemy: qq.enemy, count: qq.count, n: 0, island: qq.island }; sound.play('quest'); store(); closePanel(); toast(L(`接受任務：${questText(P.quest)}（跟著金色光柱走）`, `Quest: ${questText(P.quest)} (follow the golden light)`)); hud(true); }, { cls: 'go', off: cur }) : `<span class="need">${L(`需要 Lv ${need}`, `Needs Lv ${need}`)}</span>`) + '</div>';
    }
    return h + '</div>';
  });
}
function dockPanel(p) {
  showPanel('npc', `${N(ROLE.dock.name)} · ${N(p.isl.name)}`, () => {
    let h = `<p class="say">${L('要出海嗎？吃了果實的人一碰到海水就會失去力氣，可別游太遠！', 'Heading out to sea? Fruit eaters lose their strength in seawater, so do not try to swim far!')}</p><div class="list">`;
    h += `<div class="it"><div><b>${L('召喚船', 'Summon a boat')}</b><br><small>${L('免費 · 停在碼頭盡頭', 'Free · it waits at the end of the pier')}</small></div>${btn(L('召喚', 'Summon'), () => { summonBoat(p); closePanel(); }, { cls: 'go' })}</div>`;
    h += `<div class="it"><div><b>${L('設定重生點', 'Set spawn point')}</b><br><small>${L('目前', 'Now')}${L('：', ': ')}${N(ISLANDS.find((i) => i.id === P.spawn).name)}</small></div>${btn(P.spawn === p.island ? L('已設定', 'Set') : L('設在這裡', 'Set here'), () => { P.spawn = p.island; store(); sound.play('coin'); toast(L('重生點已設定', 'Spawn point set')); dockPanel(p); }, { off: P.spawn === p.island })}</div>`;
    h += '</div><p class="hint">' + ISLANDS.map((i) => `${N(i.name)} Lv ${i.lv[0]}–${i.lv[1]}`).join(' · ') + '</p>';
    return h;
  });
}
const STOCK_MS = 30 * 60 * 1000;
function fruitStock() { const r = makeRng(Math.floor(Date.now() / STOCK_MS) * 7 + 3), out = new Set(['spring']); for (let i = 0; i < 30 && out.size < 4; i++) out.add(randomFruit(r)); return [...out]; }
function fruitPanel(p) {
  showPanel('npc', `${N(ROLE.fruit.name)} · ${N(p.isl.name)}`, () => {
    const left = STOCK_MS - Date.now() % STOCK_MS, mm = Math.floor(left / 60000), ss = String(Math.floor(left / 1000) % 60).padStart(2, '0');
    let h = `<p class="say">${L('稀奇的魔果，吃一口就能得到神奇的力量。但一個人只能擁有一種能力喔。', 'Rare mystic fruits: one bite gives you a wondrous power. But only one power per person!')}</p><p class="hint">${L(`${mm}:${ss} 後換貨`, `New stock in ${mm}:${ss}`)} · ${L('你有', 'You have')} ${coin(P.beli)}</p><div class="list">`;
    for (const id of fruitStock()) {
      const f = FRUITS[id];
      h += `<div class="it"><div>${fruitDot(id)}<b>${N(f.name)}</b> ${rarity(id)} ${P.fruit === id ? `<small>(${L('已擁有', 'yours')})</small>` : ''}<br>${skillList(f.skills)}</div>${btn(coin(f.price), () => { if (P.beli < f.price) return; P.beli -= f.price; sound.play('coin'); store(); fruitChoice(id, null); }, { cls: 'go', off: P.beli < f.price })}</div>`;
    }
    return h + '</div>';
  });
}
// a fruit in your hands: eat it, keep it, or leave it
function fruitChoice(id, lying) {
  showPanel('fruit', N(FRUITS[id].name), () => {
    const f = FRUITS[id];
    let h = `<div class="fruitbig">${fruitDot(id)}</div><p class="say">${rarity(id)} ${skillList(f.skills)}</p>`;
    if (P.fruit && P.fruit !== id) h += `<p class="warn">${L(`吃下去會失去現在的${N(FRUITS[P.fruit].name)}。`, `Eating it replaces your ${N(FRUITS[P.fruit].name)}.`)}</p>`;
    h += '<div class="row">';
    h += btn(L('吃下去', 'Eat it'), () => { if (lying) removeFruit(lying); eatFruit(id); closePanel(); }, { cls: 'go' });
    h += btn(P.stored ? L('背包已滿', 'Bag is full') : L('收進背包', 'Keep it'), () => { if (lying) removeFruit(lying); P.stored = id; store(); sound.play('coin'); toast(L('果實收進背包了（選單裡可以吃）', 'Fruit stored (eat it from the menu)')); closePanel(); }, { off: !!P.stored });
    h += btn(lying ? L('留在這裡', 'Leave it') : L('丟掉', 'Throw away'), () => closePanel());
    return h + '</div>';
  });
}
function swordPanel(p) {
  showPanel('npc', `${N(ROLE.sword.name)} · ${N(p.isl.name)}`, () => {
    let h = `<p class="say">${L('好刀配好漢！最強的刀只有打倒首領才拿得到。', 'A fine blade for a fine fighter! The very best can only be won from bosses.')}</p><p class="hint">${L('你有', 'You have')} ${coin(P.beli)}</p><div class="list">`;
    for (const [id, s] of Object.entries(SWORDS)) {
      const own = P.swords.includes(id), from = s.drop ? ENEMIES[s.drop] : null;
      h += `<div class="it"><div><b>${N(s.name)}</b> <small>${L('攻擊', 'Attack')} ${s.dmg}</small><br>${skillList(s.skills)}</div>`
        + (own ? btn(P.sword === id ? L('裝備中', 'Equipped') : L('裝備', 'Equip'), () => { P.sword = id; P.weapon = 'sword'; holdWeapon(); store(); swordPanel(p); hud(true); }, { off: P.sword === id })
          : from ? `<span class="need">${L(`擊敗${N(from.name)}掉落`, `Dropped by ${N(from.name)}`)}</span>`
            : btn(coin(s.price), () => { if (P.beli < s.price) return; P.beli -= s.price; P.swords.push(id); P.sword = id; P.weapon = 'sword'; holdWeapon(); sound.play('coin'); store(); swordPanel(p); hud(true); }, { cls: 'go', off: P.beli < s.price })) + '</div>';
    }
    return h + '</div>';
  });
}
const STAT = { melee: ['格鬥', 'Melee', '拳腳傷害、體力', 'fist damage, energy'], defense: ['防禦', 'Defense', '生命值', 'health'], sword: ['劍術', 'Sword', '刀劍傷害', 'sword damage'], fruit: ['果實', 'Fruit', '果實招式傷害', 'fruit skill damage'] };
function menuPanel() {
  showPanel('menu', L('選單', 'Menu'), () => {
    const st = ST();
    let h = `<div class="cols"><section><h3>${L('能力', 'Stats')} · Lv ${P.lv}</h3><p class="hint">${L('可分配點數', 'Points to spend')}${L('：', ': ')}<b class="pts">${P.points}</b> · ${L('生命', 'HP')} ${st.maxHp} · ${L('體力', 'Energy')} ${st.maxEnergy}</p>`;
    for (const [k, v] of Object.entries(STAT)) {
      const add = (n) => () => { n = Math.min(n, P.points); if (!n) return; const frac = S.hp / ST().maxHp; P.stats[k] += n; P.points -= n; S.hp = Math.round(frac * ST().maxHp); store(); menuPanel(); hud(true); };
      h += `<div class="it stat"><div><b>${EN() ? v[1] : v[0]}</b> <span class="sv">${P.stats[k]}</span><br><small>${EN() ? v[3] : v[2]}</small></div><div class="row">${btn('+1', add(1), { off: !P.points })}${btn('+10', add(10), { off: P.points < 2 })}</div></div>`;
    }
    h += `</section><section><h3>${L('裝備', 'Gear')}</h3><div class="list">`;
    h += `<div class="it"><div><b>${N(STYLES.combat.name)}</b><br><small>${L('熟練度', 'Mastery')} ${Math.floor(P.mastery.melee)}</small></div></div>`;
    h += P.fruit ? `<div class="it"><div>${fruitDot(P.fruit)}<b>${N(FRUITS[P.fruit].name)}</b> ${rarity(P.fruit)}<br><small>${L('熟練度', 'Mastery')} ${Math.floor(P.mastery.fruit[P.fruit] || 0)}</small></div></div>` : `<div class="it"><div><small>${L('還沒有吃果實', 'No fruit eaten yet')}</small></div></div>`;
    if (P.stored) h += `<div class="it"><div>${fruitDot(P.stored)}<b>${N(FRUITS[P.stored].name)}</b> <small>(${L('背包', 'in your bag')})</small></div><div class="row">${btn(L('吃', 'Eat'), () => { const id = P.stored; P.stored = null; fruitChoice(id, null); })}${btn(L('丟掉', 'Drop'), () => { const id = P.stored; P.stored = null; spawnFruit(me.x + Math.sin(me.facing) * 2, me.z + Math.cos(me.facing) * 2, id); store(); menuPanel(); })}</div></div>`;
    for (const id of P.swords) h += `<div class="it"><div><b>${N(SWORDS[id].name)}</b> <small>${L('攻擊', 'Attack')} ${SWORDS[id].dmg} · ${L('熟練度', 'Mastery')} ${Math.floor(P.mastery.sword[id] || 0)}</small></div>${btn(P.sword === id ? L('裝備中', 'Equipped') : L('裝備', 'Equip'), () => { P.sword = id; P.weapon = 'sword'; holdWeapon(); store(); menuPanel(); hud(true); }, { off: P.sword === id })}</div>`;
    const bosses = ISLANDS.map((i) => `${N(ENEMIES[i.boss].name)} ${P.bosses[i.boss] ? '✔' : '—'}`).join(' · ');
    h += `</div><p class="hint">${L('首領', 'Bosses')}${L('：', ': ')}${bosses}</p></section></div>`;
    h += `<p class="help">${helpText()}</p><div class="row">${btn(L('English', '中文'), () => { setLang(EN() ? 'zh' : 'en'); menuPanel(); })}${btn(sound.musicOn ? L('音樂：開', 'Music: on') : L('音樂：關', 'Music: off'), () => { sound.setMusic(!sound.musicOn); menuPanel(); })}${btn(L('重新開始', 'New game'), () => confirmNew())}</div>`;
    return h;
  });
}
function confirmNew() {
  showPanel('menu', L('重新開始？', 'Start over?'), () => `<p class="warn">${L('等級、果實、刀和金幣都會清除。', 'Your level, fruit, swords and gold will all be wiped.')}</p><div class="row">${btn(L('確定重新開始', 'Yes, start over'), () => { newGame(); closePanel(); }, { cls: 'red' })}${btn(L('取消', 'Cancel'), () => menuPanel())}</div>`);
}
let mapOpen = null;
function mapPanel() {
  showPanel('map', L('世界地圖', 'World map'), () => `<canvas id="bigmap" width="660" height="660"></canvas><p class="hint">${L('金色：任務目標 · 白色箭頭：你 · 粉紅：果實（附近才看得到）', 'Gold: quest target · white arrow: you · pink: fruits (seen only nearby)')}</p>`);
  mapOpen = $('bigmap'); drawBigMap();
}

// ---------------------------------------------------------------- talking to people / picking things up
function nearest() {
  if (S.riding) return { kind: 'leave' };
  let best = null, bd = 1e9;
  const consider = (kind, obj, x, z, r) => { const d = Math.hypot(x - me.x, z - me.z); if (d < r && d < bd) { bd = d; best = { kind, obj }; } };
  for (const f of S.fruits) consider('fruit', f, f.x, f.z, 3.5);
  if (S.boat) consider('boat', S.boat, S.boat.x, S.boat.z, 7);
  for (const p of people) consider(p.role === 'fruit' ? 'fruitshop' : p.role, p, p.x, p.z, 5);
  return best;
}
function interact() {
  const n = S.near; if (!n) return;
  if (n.kind === 'leave') return leaveBoat(true);
  if (n.kind === 'fruit') return fruitChoice(n.obj.id, n.obj);
  if (n.kind === 'boat') return board();
  sound.play('click');
  if (n.kind === 'quest') questPanel(n.obj.isl); else if (n.kind === 'dock') dockPanel(n.obj); else if (n.kind === 'fruitshop') fruitPanel(n.obj); else if (n.kind === 'sword') swordPanel(n.obj);
}
const promptText = (n) => {
  if (!n) return '';
  if (n.kind === 'leave') return L('空白鍵 跳下船', 'Space · jump off');
  const k = PAD.used ? 'Y' : matchMedia('(pointer: coarse)').matches ? '' : 'E';
  const what = n.kind === 'fruit' ? L(`撿起${N(FRUITS[n.obj.id].name)}`, `Pick up the ${N(FRUITS[n.obj.id].name)}`) : n.kind === 'boat' ? L('上船', 'Board the boat') : L(`和${N(ROLE[n.kind === 'fruitshop' ? 'fruit' : n.kind].name)}說話`, `Talk to the ${N(ROLE[n.kind === 'fruitshop' ? 'fruit' : n.kind].name)}`);
  return (k ? `<kbd>${k}</kbd> ` : '') + what;
};

// ---------------------------------------------------------------- effects you see
const vis = new Map(), booms = [], bits = [], marks = new Map();
function dispose(o) { o.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material && !c.material.userData.keep) c.material.dispose(); }); }
function fxMesh(fx) {
  if (fx.kind === 'proj') return orb(fx.col, Math.max(0.5, fx.r * 0.7));
  if (fx.kind === 'aoe' && fx.swing) { const g = new THREE.Group(), s = slashMesh(fx.col, fx.r + 0.6); g.add(s); g.position.set(me.x, me.y + 1.1, me.z); g.rotation.y = G.aimYaw - Math.PI / 2; return g; }
  if (fx.kind === 'aoe') { const g = new THREE.Group(), r = ring(fx.col, fx.r, 0.9), gl = glow(fx.col, fx.r * 2.4); r.position.y = 0.2; gl.position.y = 1.4; g.add(r, gl); g.position.set(fx.x, heightAt(fx.x, fx.z) > -0.8 ? heightAt(fx.x, fx.z) : 0, fx.z); return g; }
  if (fx.kind === 'beam') { const g = beamMesh(fx.col, fx.len, fx.w); g.rotation.y = Math.atan2(fx.dx, fx.dz); return g; }
  if (fx.kind === 'dash') return glow(fx.col, 5);
  if (fx.kind === 'drop') { const g = new THREE.Group(), o = orb(fx.col, 1.1), r = ring(fx.col, fx.r, 0.5); r.position.y = 0.15; g.add(o, r); g.userData.o = o; g.position.set(fx.x, fx.ground, fx.z); return g; }
  return new THREE.Group();
}
function fadeTo(o, a) { o.traverse((c) => { if (c.material) { c.material.transparent = true; if (c.material.userData.base === undefined) c.material.userData.base = c.material.opacity; c.material.opacity = c.material.userData.base * a; } }); }
function drawEffects(dt) {
  const seen = new Set();
  for (const fx of G.effects) {
    seen.add(fx); let m = vis.get(fx);
    if (!m) { m = fxMesh(fx); scene.add(m); vis.set(fx, m); fx.age = 0; }
    fx.age += dt;
    if (fx.kind === 'proj') m.position.set(fx.x, fx.y, fx.z);
    else if (fx.kind === 'aoe') { const k = Math.min(1, fx.age / (fx.swing ? 0.08 : 0.2)); m.scale.setScalar(0.4 + 0.6 * k); fadeTo(m, Math.max(0, fx.t / (fx.swing ? 0.12 : 0.45))); }
    else if (fx.kind === 'beam') { m.position.set(me.x, me.y + 1.3, me.z); fadeTo(m, Math.max(0, Math.min(1, fx.t / 0.3))); m.scale.x = m.scale.y = 0.8 + Math.sin(fx.age * 40) * 0.2; }
    else if (fx.kind === 'dash') m.position.set(me.x, me.y + 1.2, me.z);
    else if (fx.kind === 'drop') { m.userData.o.position.y = fx.delay > 0 ? 40 : fx.y - fx.ground; m.userData.o.visible = fx.delay <= 0; }
  }
  for (const [fx, m] of vis) if (!seen.has(fx)) { scene.remove(m); dispose(m); vis.delete(fx); }
  // explosions
  for (const b of G.booms.splice(0)) { const g = new THREE.Group(), r = ring(b.col, b.r, 0.9), gl = glow(b.col, b.r * 3); r.position.y = 0.2; gl.position.y = 1; g.add(r, gl); g.position.set(b.x, Math.max(0, b.y), b.z); scene.add(g); booms.push({ m: g, t: 0 }); sound.play('boom'); }
  for (let i = booms.length - 1; i >= 0; i--) { const b = booms[i]; b.t += dt; b.m.scale.setScalar(0.5 + b.t * 2.2); fadeTo(b.m, Math.max(0, 1 - b.t / 0.5)); if (b.t > 0.5) { scene.remove(b.m); dispose(b.m); booms.splice(i, 1); } }
  // bits flying off a defeated enemy
  for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.v.y -= 25 * dt; b.m.position.addScaledVector(b.v, dt); b.m.rotation.x += dt * 6; b.life -= dt; if (b.life <= 0) { scene.remove(b.m); dispose(b.m); bits.splice(i, 1); } }
}
function burst(x, y, z, col) {
  for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), new THREE.MeshStandardMaterial({ color: i % 2 ? col : '#ffffff' })); m.position.set(x, y, z); scene.add(m); const a = Math.random() * 6.28; bits.push({ m, v: new THREE.Vector3(Math.cos(a) * 6, 6 + Math.random() * 6, Math.sin(a) * 6), life: 0.8 }); }
}
// shots enemies fire at you
function addShot(a) { const m = orb('#ff5a3a', 0.45); m.position.set(a.x, a.y, a.z); scene.add(m); S.shots.push({ ...a, m, t: 0 }); }
function stepShots(dt) {
  for (let i = S.shots.length - 1; i >= 0; i--) {
    const s = S.shots[i]; s.t += dt; s.x += s.dx * 30 * dt; s.z += s.dz * 30 * dt; s.m.position.set(s.x, s.y, s.z);
    let gone = s.t > 1.2 || s.y < heightAt(s.x, s.z);
    if (!gone && Math.hypot(s.x - me.x, s.z - me.z) < 1.3 && Math.abs(s.y - (me.y + 1)) < 2) { hurt(s.dmg); gone = true; }
    if (gone) { scene.remove(s.m); dispose(s.m); S.shots.splice(i, 1); }
  }
}
// damage numbers
const floats = [], pv = new THREE.Vector3();
function float(text, x, y, z, cls = '') {
  if (floats.length > 40) { floats[0].d.remove(); floats.shift(); }
  const d = document.createElement('div'); d.className = 'num ' + cls; d.textContent = text; $('floats').appendChild(d);
  floats.push({ d, x: x + (Math.random() - 0.5), y, z: z + (Math.random() - 0.5), t: 0 });
}
function drawFloats(dt) {
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i]; f.t += dt; f.y += dt * 2.2;
    pv.set(f.x, f.y, f.z).project(camera);
    if (f.t > 0.9 || pv.z > 1) { f.d.remove(); floats.splice(i, 1); continue; }
    f.d.style.transform = `translate(${(pv.x + 1) / 2 * innerWidth}px, ${(1 - pv.y) / 2 * innerHeight}px) translate(-50%, -50%) scale(${f.t < 0.1 ? 0.6 + f.t * 6 : 1})`;
    f.d.style.opacity = f.t > 0.6 ? (0.9 - f.t) / 0.3 : 1;
  }
}

// ---------------------------------------------------------------- maps
const MAPR = 330, mapBase = document.createElement('canvas'); mapBase.width = mapBase.height = MAPR * 2;
{
  const g = mapBase.getContext('2d'), img = g.createImageData(MAPR * 2, MAPR * 2), C = { grass: [88, 176, 72], sand: [228, 196, 116], snow: [238, 244, 250], stone: [160, 164, 172] };
  for (let y = 0; y < MAPR * 2; y++) for (let x = 0; x < MAPR * 2; x++) {
    const wx = x - MAPR, wz = y - MAPR, h = heightAt(wx, wz), i = (y * MAPR * 2 + x) * 4; let c;
    if (h < -3) c = [26, 98, 168]; else if (h < 0) c = [52, 150, 214]; else if (h < 1.4) c = [240, 220, 160];
    else { const isl = islandAt(wx, wz), base = C[isl ? isl.ground : 'grass'], k = 1 - Math.min(0.35, h / 50); c = base.map((v) => v * k); }
    img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
function questCamp() { if (!P.quest) return null; let best = null, bd = 1e9; for (const c of LAY.camps) if (c.enemy === P.quest.enemy) { const d = Math.hypot(c.x - me.x, c.z - me.z); if (d < bd) { bd = d; best = c; } } return best; }
function drawMap(g, size, cx, cz, k, big) {
  const S2 = (x, z) => [(x - cx) * k + size / 2, (z - cz) * k + size / 2];
  g.fillStyle = '#1a62a8'; g.fillRect(0, 0, size, size);
  g.drawImage(mapBase, (-MAPR - cx) * k + size / 2, (-MAPR - cz) * k + size / 2, MAPR * 2 * k, MAPR * 2 * k);
  if (big) {
    g.textAlign = 'center'; g.font = `900 ${Math.round(size / 30)}px "Noto Sans TC", sans-serif`; g.lineWidth = 4; g.strokeStyle = '#0a2a4a';
    for (const i of ISLANDS) { const [x, y] = S2(i.c[0], i.c[1] - i.r * 1.05); g.fillStyle = '#fff'; g.strokeText(N(i.name), x, y); g.fillText(N(i.name), x, y); g.fillStyle = '#ffd040'; g.font = `700 ${Math.round(size / 40)}px "Noto Sans TC", sans-serif`; g.strokeText(`Lv ${i.lv[0]}–${i.lv[1]}`, x, y + size / 32); g.fillText(`Lv ${i.lv[0]}–${i.lv[1]}`, x, y + size / 32); g.font = `900 ${Math.round(size / 30)}px "Noto Sans TC", sans-serif`; }
    for (const p of people) { const [x, y] = S2(p.x, p.z); g.fillStyle = ROLE[p.role].col; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
  }
  for (const f of S.fruits) if (Math.hypot(f.x - me.x, f.z - me.z) < 60) { const [x, y] = S2(f.x, f.z); g.fillStyle = '#ff6ad0'; g.beginPath(); g.arc(x, y, size / 60 + 2, 0, 7); g.fill(); }
  const qc = questCamp(); if (qc) { const [x, y] = S2(qc.x, qc.z); g.strokeStyle = '#ffd040'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, Math.max(6, qc.r * k), 0, 7); g.stroke(); }
  if (S.boat && !S.riding) { const [x, y] = S2(S.boat.x, S.boat.z); g.fillStyle = '#c8a070'; g.fillRect(x - 4, y - 4, 8, 8); }
  const [px, py] = S2(me.x, me.z), f = S.riding ? S.boat.yaw : me.facing;
  g.save(); g.translate(px, py); g.rotate(-f + Math.PI); g.fillStyle = '#fff'; g.strokeStyle = '#0a2a4a'; g.lineWidth = 2; const a = size / 50 + 4;
  g.beginPath(); g.moveTo(0, -a * 1.3); g.lineTo(a * 0.8, a); g.lineTo(0, a * 0.5); g.lineTo(-a * 0.8, a); g.closePath(); g.fill(); g.stroke(); g.restore();
}
const mini = $('mini').getContext('2d');
function drawMini() {
  const s = 300; mini.save(); mini.clearRect(0, 0, s, s); mini.beginPath(); mini.arc(s / 2, s / 2, s / 2 - 4, 0, 7); mini.clip();
  drawMap(mini, s, me.x, me.z, 1.6, false); mini.restore();
  mini.lineWidth = 6; mini.strokeStyle = '#f2c14e'; mini.beginPath(); mini.arc(s / 2, s / 2, s / 2 - 4, 0, 7); mini.stroke();
  mini.font = '900 30px "Lilita One", sans-serif'; mini.textAlign = 'center'; mini.textBaseline = 'middle'; mini.lineWidth = 5; mini.strokeStyle = '#0a2a4a';
  for (const [t, x, y, c] of [['N', s / 2, 22, '#ff5a4a'], ['S', s / 2, s - 22, '#fff'], ['E', s - 22, s / 2, '#fff'], ['W', 22, s / 2, '#fff']]) { mini.fillStyle = c; mini.strokeText(t, x, y); mini.fillText(t, x, y); }
  // where the camera looks
  mini.save(); mini.translate(s / 2, s / 2); mini.rotate(-(cam.yaw + Math.PI) + Math.PI); mini.fillStyle = 'rgba(255,255,255,0.18)'; mini.beginPath(); mini.moveTo(0, 0); mini.arc(0, 0, 90, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); mini.closePath(); mini.fill(); mini.restore();
}
function drawBigMap() { if (!mapOpen) return; const g = mapOpen.getContext('2d'); drawMap(g, 660, 0, 0, 1, true); }

// ---------------------------------------------------------------- HUD
function toast(text) { const d = $('toast'); d.innerHTML = text; d.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => d.classList.remove('on'), 2600); }
function banner(text, sub, col) { const d = $('banner'); d.innerHTML = `<b style="${col ? `color:${col}` : ''}">${text}</b>${sub ? `<small>${sub}</small>` : ''}`; d.classList.remove('on'); void d.offsetWidth; d.classList.add('on'); }
let barKey = '';
function hud(full) {
  if (full) barKey = '';
  const st = ST();
  $('lv').textContent = P.lv;
  $('hpb').style.width = Math.max(0, S.hp / st.maxHp * 100) + '%'; $('hpt').textContent = `${Math.max(0, Math.ceil(S.hp))} / ${st.maxHp}`;
  $('enb').style.width = (S.en / st.maxEnergy * 100) + '%'; $('ent').textContent = `${Math.floor(S.en)} / ${st.maxEnergy}`;
  const need = expToNext(P.lv); $('xpb').style.width = (P.lv >= MAX_LV ? 100 : P.exp / need * 100) + '%'; $('xpt').textContent = P.lv >= MAX_LV ? 'MAX' : `${fmt(P.exp)} / ${fmt(need)}`;
  $('gold').textContent = fmt(P.beli); $('pts').textContent = P.points ? L(`${P.points} 點可分配`, `${P.points} points`) : ''; $('pts').hidden = !P.points;
  // weapons and skills
  const m = masteryOf(P), key = [P.weapon, P.sword, P.fruit, lang, Math.floor(m), Math.floor(masteryOf(P, 'melee')), Math.floor(masteryOf(P, 'sword')), Math.floor(masteryOf(P, 'fruit'))].join();
  if (key !== barKey) {
    barKey = key;
    $('weapons').innerHTML = [['melee', N(STYLES.combat.name)], ['sword', N(SWORDS[P.sword].name)], ['fruit', P.fruit ? N(FRUITS[P.fruit].name) : L('果實', 'Fruit')]]
      .map(([w, n], i) => `<button class="wp${P.weapon === w ? ' on' : ''}${w === 'fruit' && !P.fruit ? ' off' : ''}" data-w="${w}" ${w === 'fruit' && P.fruit ? `style="--c:${FRUITS[P.fruit].color}"` : ''}><b>${i + 1}</b><span>${n}</span><small>${L('熟練', 'Mastery')} ${Math.floor(masteryOf(P, w))}</small></button>`).join('');
    $('skills').innerHTML = skillsOf(P).map((s) => `<button class="sk${m < s.mastery ? ' lock' : ''}" data-k="${s.key}"><b>${PAD.used ? ({ Z: '↑', X: '→', C: '↓', V: '←' })[s.key] : s.key}</b><span>${N(s.name)}</span><small>${m < s.mastery ? `🔒 ${s.mastery}` : `${s.en} ⚡`}</small><i class="cd"></i></button>`).join('');
  }
  for (const b of $('skills').children) { const s = skillsOf(P).find((x) => x.key === b.dataset.k); if (!s) continue; const c = S.cds[cdId(s.key)] || 0; b.querySelector('.cd').style.height = (c > 0 ? c / s.cd * 100 : 0) + '%'; b.classList.toggle('noen', S.en < s.en && m >= s.mastery); }
  // the quest
  if (P.quest) {
    const qc = questCamp(), dx = qc.x - me.x, dzz = qc.z - me.z, d = Math.hypot(dx, dzz);
    const fwd = -(Math.sin(cam.yaw) * dx + Math.cos(cam.yaw) * dzz), right = Math.cos(cam.yaw) * dx - Math.sin(cam.yaw) * dzz;
    const isl = ISLANDS.find((i) => i.id === P.quest.island), r = questReward(P.quest);
    $('tracker').hidden = false;
    $('tracker').innerHTML = `<h4>${L('任務', 'Quest')}</h4><b>${questText(P.quest)}</b><small>${N(isl.name)} · ${fmt(r.exp)} EXP · ${coin(r.beli)}</small><div class="dir"><i style="transform:rotate(${Math.atan2(right, fwd)}rad)">▲</i>${d < 12 ? L('就在這裡', 'Here') : `${Math.round(d)} m`}</div>`;
  } else { $('tracker').hidden = false; $('tracker').innerHTML = `<h4>${L('任務', 'Quest')}</h4><small>${L('找頭上有 ❗ 的任務委託人接任務', 'Find a quest giver (❗) to take a quest')}</small>`; }
  // a boss near you
  let boss = null; for (const e of enemies) if (e.d.boss && e.state === 'chase' && Math.hypot(e.x - me.x, e.z - me.z) < 60) boss = e;
  $('bossbar').hidden = !boss; if (boss) { $('bossname').textContent = `${N(boss.d.name)} · Lv ${boss.d.lv}`; $('bossb').style.width = (boss.hp / boss.max * 100) + '%'; }
  // what E does here
  const pt = promptText(S.near); $('prompt').hidden = !pt; if (pt && $('prompt').innerHTML !== pt) $('prompt').innerHTML = pt;
  $('b-e').classList.toggle('on', !!S.near && S.near.kind !== 'leave');
}
const helpText = () => PAD.used || PAD.connected ? L('控制器：左搖桿 移動 · 右搖桿 視角 · A 跳（Lv10 二段跳）· B 衝刺 · X／RT 攻擊 · 十字鍵 ↑→↓← 招式 · Y 互動 · LB／RB 換武器 · Start 選單 · View 地圖 · R3 鎖定視角 · L3 拉遠拉近',
  'Controller: left stick move · right stick look · A jump (double jump from Lv10) · B dash · X / RT attack · D-pad ↑→↓← skills · Y talk · LB / RB weapon · Start menu · View map · R3 shift lock · L3 zoom')
  : matchMedia('(pointer: coarse)').matches ? L('觸控：左邊拖曳移動 · 右邊拖曳轉視角 · 按鈕攻擊、跳、衝刺 · 點招式欄施放招式', 'Touch: drag on the left to move · drag on the right to look · buttons to attack, jump and dash · tap a skill to use it')
    : L('WASD 移動 · 空白鍵 跳（Lv10 二段跳）· Q 衝刺 · 左鍵 攻擊 · Z X C V 招式 · 1 2 3 換武器 · E 互動 · 右鍵拖曳 視角 · Shift 鎖定視角 · Tab 選單 · M 地圖',
      'WASD move · Space jump (double jump from Lv10) · Q dash · left click attack · Z X C V skills · 1 2 3 weapon · E talk · right-drag look · Shift lock · Tab menu · M map');
function staticText() {
  document.documentElement.lang = EN() ? 'en' : 'zh-Hant';
  $('t-sub').textContent = L('乘風破浪，在五座島嶼間冒險：接任務、打倒首領、尋找樹下的魔果，練成最強的海上霸者。', 'Sail between five islands: take quests, defeat bosses, find mystic fruits under the trees, and become the strongest on the seas.');
  $('t-cont').textContent = hadSave ? L(`繼續冒險（Lv ${P.lv}）`, `Continue (Lv ${P.lv})`) : L('出航！', 'Set sail!');
  $('t-new').textContent = L('新的冒險', 'New game'); $('t-new').hidden = !hadSave;
  $('t-lang').textContent = EN() ? '中文' : 'English';
  $('t-help').textContent = helpText();
  $('b-map').textContent = L('地圖', 'Map'); $('b-menu').textContent = L('選單', 'Menu');
  nameTags(); hud(true);
}
function setLang(l) { lang = l; try { localStorage.setItem('mysticseas.lang', lang); } catch (e) { /* ignore */ } staticText(); }

// ---------------------------------------------------------------- one frame of play
function doActions() {
  if (act.has('menu')) return menuPanel();
  if (act.has('map')) return mapPanel();
  if (act.has('lock')) toggleLock();
  if (act.has('w1')) setWeapon('melee'); if (act.has('w2')) setWeapon('sword'); if (act.has('w3')) setWeapon('fruit');
  const order = ['melee', 'sword', 'fruit'].filter((w) => w !== 'fruit' || P.fruit), i = order.indexOf(P.weapon);
  if (act.has('wnext')) setWeapon(order[(i + 1) % order.length]); if (act.has('wprev')) setWeapon(order[(i - 1 + order.length) % order.length]);
  if (act.has('E')) interact();
  for (const k of ['Z', 'X', 'C', 'V']) if (act.has(k)) useSkill(k);
  if (mouseAtk || touch.atk || PAD.atk || act.has('hit')) attack();
}
function step(dt) {
  S.playT += dt;
  const st = ST();
  if (S.dead > 0) { S.dead -= dt; if (S.dead <= 0) respawn(); }
  else {
    if (!S.panel) doActions();
    const mv = S.panel ? { mx: 0, mz: 0 } : readMove();
    if (S.riding) { stepBoat(mv, dt); if (act.has('jump') && !S.panel) leaveBoat(true); }
    else {
      const ev = stepBody(me, { ...mv, jump: !S.panel && act.has('jump'), dash: !S.panel && act.has('dash') }, dt, LAY.colliders, { airJumps: P.lv >= 10 ? 1 : 0, speed: P.fruit && FRUITS[P.fruit].speed ? FRUITS[P.fruit].speed : 1 });
      for (const e of ev) sound.play(e === 'thud' ? 'land' : e);
    }
    // seawater saps a fruit eater
    if (me.swimming && P.fruit) { S.hp -= st.maxHp * 0.03 * dt; S.lastHurt = S.playT; S.drownT -= dt; if (S.drownT <= 0) { S.drownT = 4; toast(L('吃了果實的人會被海水奪走力氣！快上岸或坐船！', 'Seawater saps a fruit eater\'s strength! Get ashore or take a boat!')); } if (S.hp <= 0) die(); }
    if (S.playT - S.lastHurt > 3) S.hp = Math.min(st.maxHp, S.hp + st.maxHp * 0.06 * dt);
    S.en = Math.min(st.maxEnergy, S.en + (8 + st.maxEnergy * 0.06) * dt);
  }
  for (const k in S.cds) if (S.cds[k] > 0) S.cds[k] -= dt;
  S.atkCd -= dt; S.comboT -= dt; S.atkAnim = Math.max(0, S.atkAnim - dt * 4);
  // enemies
  // near a quest giver is a safe zone: enemies leave you alone there
  S.safe = people.some((p) => p.role === 'quest' && Math.hypot(p.x - me.x, p.z - me.z) < 16);
  const meT = { x: me.x, z: me.z, dead: S.dead > 0 || S.riding || S.safe };
  for (const e of enemies) {
    if (e.state === 'dead') { e.respawn -= dt; e.ch.visible = false; if (e.respawn <= 0) { Object.assign(e, spawnEnemy(e.id, e.camp, e.ci, Math.random)); e.tag.userData.last = -9; } continue; }
    const d = Math.hypot(e.x - me.x, e.z - me.z);
    if (d > 150) { e.ch.visible = false; continue; }
    const px = e.x, pz = e.z;
    for (const a of stepEnemy(e, meT, dt, Math.random)) { if (a.type === 'hit') hurt(a.dmg); else if (a.type === 'shot') addShot(a); else if (a.type === 'slam') G.booms.push({ x: a.x, y: heightAt(a.x, a.z), z: a.z, r: a.r, col: '#ff4a3a' }); }
    if (heightAt(e.x, e.z) < 0.3) { e.x = px; e.z = pz; e.y = heightAt(px, pz); if (e.state === 'chase') e.state = 'return'; }
    if (e.d.boss && e.state === 'chase' && !S.bossSeen[e.uid]) { S.bossSeen[e.uid] = true; sound.play('boss'); banner(N(e.d.name), `Lv ${e.d.lv} · ${L('首領', 'Boss')}`, '#ff7a5a'); }
    if (e.state !== 'chase') S.bossSeen[e.uid] = false;
    e.ch.visible = d < 130; if (!e.ch.visible) continue;
    e.ch.position.set(e.x, e.y, e.z); e.ch.rotation.y = lerpAngle(e.ch.rotation.y, e.facing, Math.min(1, dt * 10));
    pose(e.ch, dt, { speed: Math.hypot(e.x - px, e.z - pz) / Math.max(dt, 1e-3), atk: e.wind > 0 ? e.wind / 0.5 : 0 });
    drawTag(e.tag, e.hp / e.max);
    // the warning ring before a boss slams
    let mk = marks.get(e);
    if (e.mark && !mk) { mk = ring('#ff2a2a', e.mark.r, 0.7); scene.add(mk); marks.set(e, mk); }
    if (mk) { if (!e.mark) { scene.remove(mk); dispose(mk); marks.delete(e); } else { mk.position.set(e.mark.x, Math.max(0.1, heightAt(e.mark.x, e.mark.z) + 0.2), e.mark.z); mk.scale.setScalar(1 + Math.sin(S.playT * 20) * 0.04); } }
  }
  stepShots(dt);
  // your attacks land
  for (const h of stepEffects(G, dt)) {
    // a hit makes the enemy jolt and (unless it is a boss) knocks it back a little; the screen shakes on a kill
    h.e.ch.userData.punch = 1; shake = Math.max(shake, h.killed ? 0.12 : 0.04);
    if (!h.e.d.boss && h.e.state !== 'dead') { const kx = h.e.x - me.x, kz = h.e.z - me.z, kd = Math.hypot(kx, kz) || 1, nx = h.e.x + kx / kd * 0.7, nz = h.e.z + kz / kd * 0.7; if (heightAt(nx, nz) > 0.3) { h.e.x = nx; h.e.z = nz; } }
    float(fmt(h.dmg), h.x, h.y, h.z, h.killed ? 'kill' : h.weapon); sound.play('hit');
    addMastery(h.weapon, 0.02);
    if (h.weapon === 'fruit' && P.fruit && FRUITS[P.fruit].lifesteal) S.hp = Math.min(st.maxHp, S.hp + h.dmg * FRUITS[P.fruit].lifesteal);
    if (h.killed) onKill(h);
  }
  // fruits grow under trees now and then
  S.fruitT -= dt;
  if (S.fruitT <= 0) {
    S.fruitT = 240 + Math.random() * 180;
    if (S.fruits.length < 3) {
      const near = LAY.fruitSpots.filter(([x, z]) => Math.hypot(x - me.x, z - me.z) < 120), pool = near.length && Math.random() < 0.6 ? near : LAY.fruitSpots, [x, z, isl] = pool[Math.floor(Math.random() * pool.length)];
      spawnFruit(x, z); sound.play('fruit'); toast(L(`🍎 ${N(ISLANDS.find((i) => i.id === isl).name)}的某棵樹下長出了一顆魔果！`, `🍎 A mystic fruit has appeared under a tree on ${N(ISLANDS.find((i) => i.id === isl).name)}!`));
    }
  }
  for (const f of [...S.fruits]) { f.t += dt; f.m.position.y = f.y + Math.sin(f.t * 2) * 0.15; f.m.rotation.y += dt; if (f.t > 20 * 60) removeFruit(f); }
  // arriving on an island
  const isl = islandAt(me.x, me.z), id = isl ? isl.id : null;
  if (id !== S.island) { S.island = id; if (isl) { banner(N(isl.name), `Lv ${isl.lv[0]}–${isl.lv[1]}`, '#fff'); } }
  S.near = S.dead > 0 ? null : nearest();
  S.saveT += dt; if (S.saveT > 15) { S.saveT = 0; store(); }
}

// ---------------------------------------------------------------- drawing
// (a tall sprite that always faces you: a column of golden light)
const pillar = (() => { const c = document.createElement('canvas'); c.width = 32; c.height = 128; const g = c.getContext('2d'), h = g.createLinearGradient(0, 0, 32, 0); h.addColorStop(0, 'rgba(255,208,64,0)'); h.addColorStop(0.5, 'rgba(255,220,120,0.9)'); h.addColorStop(1, 'rgba(255,208,64,0)'); g.fillStyle = h; g.fillRect(0, 0, 32, 128);
  const v = g.createLinearGradient(0, 0, 0, 128); v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = v; g.fillRect(0, 0, 32, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.6, fog: false })); sp.scale.set(4, 90, 1); return sp; })();
scene.add(pillar);
let last = performance.now(), hudT = 0, miniT = 0, bigT = 0, titleA = 0;
const BIG = LAY.colliders.filter((c) => c[2] > 2.4 && c[3] > 2);
let camD = 13, camT = null, visY = null, shake = 0;
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  pollPad(dt);
  if (S.mode === 'play') step(dt);
  W.waves.offset.x += dt * 0.012; W.waves.offset.y += dt * 0.008;
  // the sun hangs low over the sea behind the camera's view; clouds drift with the wind
  W.sunDisc.position.set(camera.position.x - 380, 160, camera.position.z - 520);
  for (const c of W.clouds) { c.position.x += dt * 2.5; if (c.position.x > 700) c.position.x -= 1400; }
  // you, and your boat
  const body = S.riding ? S.boat : me;
  // (the body eases over steps and slopes instead of snapping, and turns smoothly)
  visY = visY == null || Math.abs(me.y - visY) > 3 ? me.y : visY + (me.y - visY) * Math.min(1, dt * 18);
  avatar.position.set(me.x, me.grounded ? visY : me.y, me.z); if (!me.grounded) visY = me.y;
  const face = S.riding ? S.boat.yaw : cam.lock && !S.panel ? cam.yaw + Math.PI : me.facing;
  avatar.rotation.y = lerpAngle(avatar.rotation.y, face, Math.min(1, dt * 12));
  pose(avatar, dt, { swim: me.swimming, air: !me.grounded && !me.swimming, speed: S.riding ? 0 : Math.hypot(me.vx, me.vz), atk: S.atkAnim });
  if (S.boat) { boatMesh.position.set(S.boat.x, Math.sin(now / 700) * 0.15, S.boat.z); boatMesh.rotation.set(0, S.boat.yaw, Math.sin(now / 900) * 0.04); }
  for (const p of people) pose(p.ch, dt, { speed: 0 });
  drawEffects(dt);
  // the quest's golden light
  const qc = S.mode === 'play' ? questCamp() : null;
  pillar.visible = !!qc && Math.hypot(qc.x - me.x, qc.z - me.z) > 20; if (qc) pillar.position.set(qc.x, heightAt(qc.x, qc.z) + 45, qc.z);
  // the camera
  if (S.mode === 'title') { titleA += dt * 0.05; const c = ISLANDS[0].c; camera.position.set(c[0] + Math.sin(titleA) * 75, 26, c[1] + Math.cos(titleA) * 75); camera.lookAt(c[0], 4, c[1]); }
  else {
    const dist = S.riding ? Math.max(cam.dist, 20) : cam.dist;
    // (the camera follows smoothly: quickly side to side, more gently up and down, so jumps and slopes do not jolt it)
    const want = new THREE.Vector3(body.x, (S.riding ? 1.2 : me.y) + 1.8, body.z);
    if (!camT || camT.distanceTo(want) > 30) camT = want.clone();
    else { const kx = Math.min(1, dt * 12); camT.x += (want.x - camT.x) * kx; camT.z += (want.z - camT.z) * kx; camT.y += (want.y - camT.y) * Math.min(1, dt * 6); }
    const target = camT.clone(), cp = Math.cos(cam.pitch);
    const dir = new THREE.Vector3(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp);
    // pull in rather than end up inside a hut, a tower or a wall
    let free = dist;
    for (let k = 1.5; k < dist; k += 0.75) { const x = target.x + dir.x * k, y = target.y + dir.y * k, z = target.z + dir.z * k; if (BIG.some(([cx, cz, cr, top]) => y < top && Math.hypot(x - cx, z - cz) < cr)) { free = Math.max(2, k - 0.8); break; } }
    camD += (free - camD) * Math.min(1, dt * (free < camD ? 20 : 4));
    const off = dir.multiplyScalar(camD);
    camera.position.copy(target).add(off);
    if (cam.lock) camera.position.add(new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)).multiplyScalar(1.4));
    camera.position.y = Math.max(camera.position.y, heightAt(camera.position.x, camera.position.z) + 0.8, 0.5);
    camera.lookAt(target);
    if (shake > 0) { shake = Math.max(0, shake - dt); camera.position.x += (Math.random() - 0.5) * shake * 2; camera.position.y += (Math.random() - 0.5) * shake * 2; }
  }
  sun.position.set(camera.position.x + 30, 80, camera.position.z + 20); sun.target.position.set(me.x, me.y, me.z);
  if (S.mode === 'play') {
    drawFloats(dt);
    hudT += dt; if (hudT > 0.1) { hudT = 0; hud(); }
    miniT += dt; if (miniT > 0.12) { miniT = 0; drawMini(); } bigT += dt; if (mapOpen && bigT > 0.5) { bigT = 0; drawBigMap(); }
  }
  if (!S.noRender) renderer.render(scene, camera);
  act.clear();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- start
function newGame() {
  P = newPlayerData(); G.P = P; store(); hadSave = true;
  for (const f of [...S.fruits]) removeFruit(f);
  S.boat = null; S.riding = false; boatMesh.visible = false; S.cds = {}; respawn(); holdWeapon(); hud(true);
}
function play(fresh) {
  sound.start();
  if (fresh) newGame();
  $('title').hidden = true; $('hud').hidden = false; S.mode = 'play';
  cam.yaw = Math.PI * 0.75; staticText(); drawMini();
  if (!hadSave || fresh) { hadSave = true; store(); banner(N(ISLANDS[0].name), L('先找頭上有 ❗ 的任務委託人', 'Find the quest giver with the ❗ first'), '#fff'); }
  S.island = islandAt(me.x, me.z)?.id || null;
}
$('t-cont').onclick = () => play(false);
$('t-new').onclick = () => play(true);
$('t-lang').onclick = () => setLang(EN() ? 'zh' : 'en');
staticText();
requestAnimationFrame(frame);
window.__ms = { S, G, cam, enemies, people, LAY, act, keys, play, frame: (now) => frame(now), get P() { return P; }, get me() { return me; }, spawnFruit, gainExp, menuPanel, mapPanel, questPanel, fruitPanel, swordPanel, dockPanel, summonBoat, board, toggleLock };

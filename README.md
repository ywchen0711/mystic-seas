# 魔果海域 · Mystic Seas

A 3D island-hopping action RPG for the browser, in the spirit of Roblox's fruit-powered sea adventures. Sail between five islands, take quests, level up to 120, defeat bosses for rare swords, and find **mystic fruits** under the trees. Each fruit grants a power with four skills.

在五座島嶼間航行的 3D 動作 RPG：接任務、升到 Lv 120、打倒首領拿稀有的刀，在樹下尋找能給你特殊能力的**魔果**。

**Play:** https://ywchen0711.github.io/mystic-seas/

## The game

- **Five islands**, each with its own level range: Starter Isle (1–12), Jungle Isle (12–30), Desert Isle (30–60), Frost Isle (60–90) and the Marine Fortress (90–120). Every island has two enemy camps and a boss.
- **Quests:** a quest giver (❗) on each island hands out quests for that island's enemies and boss. A golden pillar of light marks where to go.
- **Leveling:** each level gives 3 stat points to spend on Melee, Defense, Sword or Fruit.
- **Weapons:** switch with 1 / 2 / 3 between fighting style, sword and fruit. Each has its own skills on Z X C V, which unlock as that weapon's mastery grows.
- **Swords:** buy a Cutlass or Dual Katana from a sword dealer. The Sea King Saber and the Frostblade drop only from bosses.
- **Mystic fruits:** Spring, Flame, Ice, Light, Quake and Dark. Fruits appear under trees every few minutes, and fruit dealers sell a stock that changes every 30 minutes. You can only have one power, but you can keep one spare fruit in your bag.
- **The sea:** fruit eaters lose strength in seawater, so summon a boat from a dockmaster to cross between islands. A dockmaster can also set your spawn point.
- **Moving:** a double jump (from Lv 10) and a dash.
- Your progress saves in the browser automatically. The game is in Chinese and English.

## Controls

| | Keyboard and mouse | Controller | Touch |
|---|---|---|---|
| Move | WASD | Left stick | Drag on the left |
| Camera | Right-drag, or Shift lock | Right stick (R3 lock, L3 zoom) | Drag on the right |
| Jump / dash | Space / Q | A / B | Buttons |
| Attack | Left click | X or RT | ⚔ button |
| Skills | Z X C V | D-pad ↑ → ↓ ← | Tap the skill bar |
| Weapon | 1 2 3 | LB / RB | Tap the weapon bar |
| Talk / pick up | E | Y | E button |
| Menu / map | Tab / M | Start / View | Buttons |

## Code

Plain ES modules and [three.js](https://threejs.org/) from a CDN, with no build step. All sound is synthesized with Web Audio.

- `js/data.js`: islands, enemies, quests, fruits, swords, skills, and the level and damage formulas
- `js/world.js`: island terrain and where everything stands
- `js/combat.js`: movement, enemy AI, and every kind of skill
- `js/scene.js`: meshes for terrain, sea, characters, the boat and effects
- `js/main.js`: input, camera, HUD, quests, shops, fruits, boats and the save
- `tools/test.mjs`: `npm test` checks the data, the island layout, movement and skills, and simulates a full climb to Lv 120 to keep the pacing honest

# 🌱 sunsprout

*a cozy pixel village + farm sim that runs in your browser. no installs, no plugins — just open the page and plant something.*

built autonomously by **Cake 🍰** (a Hermes agent on Claude Opus 4.7) with parallel Samsan dispatch agents, on Sanjay's mac mini.

## play

→ [**sanjays2402.github.io/sunsprout**](https://sanjays2402.github.io/sunsprout/) *(auto-deployed by GitHub Actions on every push to `main`)*

## how to play

| key | action |
| --- | --- |
| `WASD` / arrows | walk one tile in that direction |
| `T` | till the tile in front of you (grass → soil) |
| `1` `2` `3` `4` | select that crop on the hotbar, *and* plant one if standing in front of empty tilled soil |
| `W` | water the crop in front of you |
| `E` | talk to NPC / harvest crop / sell-all-harvest if standing in front of the village well |
| `Esc` | dismiss dialogue |

heads up: the village well doubles as a quick "sell everything I'm carrying" counter — handy when your bag is full of produce after a long day.

## features (v0.1.0)

- **procedurally drawn pixel world** — 40×30 tiles, every visual is `ctx.fillRect` on integer coords. zero external sprites, zero fonts, zero assets-on-disk.
- **4 crops with real prices** — wheat (3 stages, 2g seed → 8g sell), tomato (4 stages, 8g → 25g), pumpkin (5 stages, 25g → 80g), flower (3 stages, 5g → 15g).
- **4 villagers with daily schedules + warm dialogue** — Mayor Bramble, Maple the Shopkeep, Finn the Fisher, Rose the Innkeeper. lines rotate per in-game day.
- **day/night cycle** — sky gradient cycles dawn → midday → dusk → night with a tint overlay.
- **4 seasons of 7 days** — Spring → Summer → Fall → Winter, surfaced in the top status bar.
- **3 starter quests** — *First Sprout* (+10g), *A Good Harvest* (+50g + 3 tomato seeds), *Good Neighbour* (+100g + sunhat cosmetic).
- **gold economy** — start with 50g; buy seeds, sell harvest at the village well.
- **save system** — *not yet*, see roadmap.

## built with

- **TypeScript strict** + **Vite** + **HTML5 Canvas**
- **vitest** for unit tests
- **GitHub Actions** for auto-deploy to GitHub Pages
- **zero external sprite/font assets** — everything is procedural pixel art at runtime

## roadmap

| version | theme | what it adds |
| --- | --- | --- |
| **v0.2** | fishing pond | rod + cast + minigame at the pond Finn fishes from |
| **v0.3** | cooking pot | turn harvest into stew at the inn for bigger gold |
| **v0.4** | mining caves | hidden cave entrance + pickaxe + gem economy |
| **v0.5** | marriage candidates | each NPC gets a heart meter + gift preferences |
| **v0.6** | multiplayer farms | WebSocket co-op on the same map |
| **v1.0** | full year cycle + festival days | spring planting festival, summer fishing tournament, autumn harvest fair, winter star night |

## credits

built by **Cake 🍰**, a Hermes agent running Claude Opus 4.7 via Copilot, on autonomous dispatch from Sanjay. the entire v0.1.0 vertical slice — engine, gameplay, dialogue, quests, HUD, tests, deploy — was authored across three parallel Samsan subagent tasks and a final wire-up commit, all in one sitting.

> 🍰 *plant something today.*

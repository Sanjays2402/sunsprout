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
- **villager birthdays** — each NPC has one birthday a year; gifts on the day count for 8× hearts, and the dawn toast reminds you the evening before so you don't miss it.
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

## Terms & Disclaimer

By using this project you agree to the following.

- **No warranty.** This software is provided "as is", without warranty of any kind, express or implied, including merchantability, fitness for a particular purpose, and non-infringement.
- **No liability.** To the maximum extent permitted by law, the author and contributors are not liable for any claim, loss, or damage (direct, indirect, incidental, or consequential, including lost data or profits) arising from its use.
- **Your responsibility.** You use it at your own risk and are responsible for complying with the laws that apply to you.
- **Game.** Provided for entertainment. Take breaks; it is not designed for people with photosensitive epilepsy, and flashing effects may occur.
- **Third parties.** Names, logos, APIs, and services of others belong to their owners and are used for identification only; no affiliation or endorsement is implied.
- **Your statutory rights.** Nothing here limits rights that cannot be waived by agreement, including under consumer-protection laws in the USA, Canada (including Quebec), and India (Consumer Protection Act, 2019).
- **License.** Use, copying, and distribution are governed by the [LICENSE](LICENSE) file; if anything here conflicts with it, the license controls.

## Content, Assets & Fair Use

- **Original work.** Unless noted otherwise (including below), the code, text, design, and images in this repository were created by the author.
- **Libraries, fonts, and icons.** Third-party libraries, fonts (for example Google Fonts), and icon sets belong to their creators and are used under their own licenses; see the dependency manifests and each source for terms.
- **Logos, brands, and screenshots.** Third-party names, logos, and screenshots appear only to identify or describe their products (nominative use). They remain the property of their owners and do not imply affiliation or endorsement.
- **Ideas and inspiration.** Where this project is inspired by another product, game, or idea, it is an independent implementation. It borrows only general ideas, mechanics, or styles, which are not anyone's exclusive property, and is meant to contain no third-party code or artwork used without permission.
- **Fair use and fair dealing.** Any third-party material is used in limited ways for purposes such as education, research, review, commentary, or identification, relying on fair use in the USA (17 U.S.C. § 107), fair dealing in Canada (Copyright Act, ss. 29–29.2), and fair dealing in India (Copyright Act, 1957, s. 52), where they apply.
- **Concerns and takedown requests.** If you own rights in something here and believe it is used improperly, [open an issue](https://github.com/Sanjays2402/sunsprout/issues) or contact the author through their GitHub profile with a link to the material and your claim. It will be reviewed promptly and credited, changed, or removed as appropriate. You may also use GitHub's DMCA process.
- **Contributions.** By contributing, you confirm you have the right to submit your contribution and agree it is licensed under this repository's license.
- **Website.** The project site has its own [Terms](https://sanjays2402.github.io/sunsprout/terms.html) and [Fair Use](https://sanjays2402.github.io/sunsprout/fair-use.html) pages.

# Sunsprout autonomous cron — STATE

> You are Cake. Read me FIRST every tick.

## STATUS

**STATUS:** Tick #2 complete. v0.5.x main + 10 autoship features now on `feature/autoship`. Most recent batch shipped the next 5 cozy-life depth items: forage, animal coops, egg/forage recipes, farm dog companion, and the greenhouse. 582/582 tests green; build 106.41 kB / 34.54 kB gz.

Active branch: `feature/autoship`
Default branch: `main` (NEVER push to it from cron)
Cron identity: `Cake (cron) <51058514+Sanjays2402@users.noreply.github.com>`

## OPERATING RULES (do not violate)

1. Work on `feature/autoship` only. No merges to main. No PRs (`gh pr create` BANNED). No tags. No `gh release`.
2. No emoji in any git artifact (commit messages, branch names, file contents touched by cron). Telegram delivery may use emoji.
3. One feature slice = one commit. ~5 commits per tick.
4. Gate ONCE per batch at the end (`npx tsc --noEmit`, `npm run build`, `npm test`). Push only if green.
5. Quality is the floor. If only 3 features are genuinely solid, ship 3 and say so. Never pad.

## ROADMAP (cozy-life essentials + depth)

Each row is a real user-facing capability — logic module + tests + UI/wiring. Pick the next 5 unstarted rows per tick.

- [x] **Save/Load to localStorage** — JSON snapshot of player + world + hearts + time; auto-save on day rollover; manual save with `K`; load on boot if present. (ad5fad6)
- [x] **Sleep + Day Summary overlay** — press `B` near the farmhouse to advance to dawn; modal overlay shows yesterday's gold gain, harvest count, hearts gained. (965f0fc)
- [x] **Weather system (sunny / rain / storm)** — per-day deterministic weather; rain auto-waters every crop at day rollover; rain particles in render; forecast strip in HUD. (6213168)
- [x] **NPC Birthdays + birthday banner** — each NPC has a (season, day) birthday; 8× gift multiplier on the day; banner in HUD when it's somebody's birthday today. (75ba0ec)
- [x] **Sprinkler placeable** — buyable item; place on a tilled tile; auto-waters orthogonal neighbours at day rollover; visible procedural sprite. (1c03c70)
- [x] **Forage spawns** — wild berries / mushrooms / herbs appear on grass each morning, vanish at dusk; pickable for cheap gold + cooking ingredients; deterministic per (season, day). (329d38e)
- [x] **Animal coop (chickens)** — purchase a coop kit (600g) and chickens (200g, cap 4); coop placed on grass with N; daily egg into the coop; collect with E, fill with I. (59d5ed7)
- [x] **Egg + forage recipes** — five new dishes (Farm Omelet, Pumpkin Custard, Mushroom Skillet, Berry Tart, Sage Tea) chained off the coop and forage loops. (be0c711)
- [x] **Farm dog companion** — Maple sells a Farm Dog Ticket (500g); J redeems then pets; pet streak posts a gold tip at the next rollover; soft-chases the player around the farm. (827ae22)
- [x] **Greenhouse** — late-game 3x3 kit (1800g); placed on grass with U; every crop inside is auto-watered and grows an extra stage per day. (f41d16f)
- [ ] **Crop quality tiers** — silver / gold star crops at high water-streak; 1.5x / 2x sell price; visible badge on the sprite.
- [ ] **Tool upgrades (copper / iron / gold)** — upgrade the hoe / watering can at the shop to till / water in a 3-tile line.
- [ ] **Festival days** — Spring Planting Fair / Fall Harvest Festival at fixed calendar dates; village reshuffle + bonus quests.
- [ ] **Mail / letters** — NPCs send letters at heart milestones; mailbox at the farmhouse with unread indicator.
- [ ] **Cellar storage chest** — placeable chest at the farmhouse; deposit / withdraw items; does not bloat hotbar.
- [ ] **Recipe codex panel** — `R` opens a panel listing every recipe, locked-vs-known, with ingredients.
- [ ] **Crop journal panel** — `J` opens a panel listing every crop with stats (growth time, sell price, best season). NOTE: `J` is currently bound to dog-pet; rename to `[` or `;` when this lands.
- [ ] **Achievements / badges** — earned for milestones (first wedding, 10k gold, etc.); panel viewable with `Y`. NOTE: `Y` is currently bound to forage pickup; consider a different binding.
- [ ] **Money log** — last 20 gold deltas with reason; viewable in the HUD pause panel.
- [ ] **Settings panel** — volume + colorblind palette + reset save; viewable with `\\`.

## OPEN BLOCKERS

(none — Y / J / U binding collisions noted on future roadmap rows above so the next batch picks better letters)

## TICK LOG

(append-only; one line per tick)
- 2026-06-19 23:27 PT — 5/5 shipped: persistence (ad5fad6), sleep (965f0fc), weather (6213168), birthdays (75ba0ec), sprinklers (1c03c70). 517/517 tests green. Build 93.69 kB / 30.73 kB gz.
- 2026-06-20 03:40 PT — 5/5 shipped: forage (329d38e), coop (59d5ed7), egg-recipes (be0c711), farm-dog (827ae22), greenhouse (f41d16f). 582/582 tests green (+65). Build 106.41 kB / 34.54 kB gz. New keybinds: Y=forage, N=coop, I=add chicken, J=dog redeem/pet, U=greenhouse.

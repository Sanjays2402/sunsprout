# Sunsprout autonomous cron — STATE

> You are Cake. Read me FIRST every tick.

## STATUS

**STATUS:** v0.5.x main + multiplayer scaffolding shipped. New autoship regime (5-feature batches on a feature branch, no PRs, no merges to main) begins here. First batch target: cozy-life essentials the README still calls out as missing — save/load, sleep, weather, birthdays, sprinklers.

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

- [ ] **Save/Load to localStorage** — JSON snapshot of player + world + hearts + time; auto-save on day rollover; manual save with `K`; load on boot if present.
- [ ] **Sleep + Day Summary overlay** — press `B` near the farmhouse to advance to dawn; modal overlay shows yesterday's gold gain, harvest count, hearts gained.
- [ ] **Weather system (sunny / rain / storm)** — per-day deterministic weather; rain auto-waters every crop at day rollover; rain particles in render; forecast strip in HUD.
- [ ] **NPC Birthdays + birthday banner** — each NPC has a (season, day) birthday; 8× gift multiplier on the day; banner in HUD when it's somebody's birthday today.
- [ ] **Sprinkler placeable** — buyable item; place on a tilled tile; auto-waters orthogonal neighbours at day rollover; visible procedural sprite.
- [ ] **Forage spawns** — wild berries / mushrooms appear on grass each morning, vanish at dusk; pickable for cheap gold + cooking ingredients.
- [ ] **Animal coop (chickens)** — purchase a chicken from Maple; coop building; daily egg into the coop; egg sells / cooks.
- [ ] **Egg + dairy recipes** — new dishes (omelet, custard) that consume eggs + crops.
- [ ] **Farm dog companion** — pet that follows the player; pet-once-per-day for a small mood buff; visible sprite.
- [ ] **Greenhouse** — late-game building that lets the player grow any crop regardless of season.
- [ ] **Crop quality tiers** — silver / gold star crops at high water-streak; 1.5x / 2x sell price; visible badge on the sprite.
- [ ] **Tool upgrades (copper / iron / gold)** — upgrade the hoe / watering can at the shop to till / water in a 3-tile line.
- [ ] **Festival days** — Spring Planting Fair / Fall Harvest Festival at fixed calendar dates; village reshuffle + bonus quests.
- [ ] **Mail / letters** — NPCs send letters at heart milestones; mailbox at the farmhouse with unread indicator.
- [ ] **Cellar storage chest** — placeable chest at the farmhouse; deposit / withdraw items; does not bloat hotbar.
- [ ] **Recipe codex panel** — `R` opens a panel listing every recipe, locked-vs-known, with ingredients.
- [ ] **Crop journal panel** — `J` opens a panel listing every crop with stats (growth time, sell price, best season).
- [ ] **Achievements / badges** — earned for milestones (first wedding, 10k gold, etc.); panel viewable with `Y`.
- [ ] **Money log** — last 20 gold deltas with reason; viewable in the HUD pause panel.
- [ ] **Settings panel** — volume + colorblind palette + reset save; viewable with `\\`.

## OPEN BLOCKERS

(none — multiplayer scaffolding is on main but doesn't block feature work)

## TICK LOG

(append-only; one line per tick)

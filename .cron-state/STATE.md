# Sunsprout autonomous cron — STATE

> You are Cake. Read me FIRST every tick.

## STATUS

**STATUS:** Tick #4 complete. 20 autoship features now on `feature/autoship`. This batch shipped the next 5 cozy-life depth + QoL items: recipe codex, crop journal, achievements, money log, and the settings panel (with night-tint, HUD scale, reduce-motion, autosave toggle, two-step reset-save). 697/697 tests green (+50 this tick); build 142.86 kB / 44.53 kB gz.

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
- [x] **Crop quality tiers** — silver / gold star crops at high water-streak; 1.5x / 2x sell price; per-tier inventory buckets + tiered well sale; harvest toast announces the tier. (dc6da66)
- [x] **Tool upgrades (copper / iron / gold)** — Maple sells upgrades at the shop (150/450/1200g); copper widens till/water to a 3-tile line, iron to 5, gold adds a forward bonus tile; keybinds `,` and `.`. (b100dd2)
- [x] **Festival days** — Spring (s0d7) Planting Fair (half-price seeds) and Fall (s2d7) Harvest Festival (1.5x crop sell); banner under the top bar; well-sell toast names the multiplier. (62eff02)
- [x] **Mail / letters** — NPCs deliver a per-tier letter at heart milestones (2/4/6/8); `[` at the farmhouse reads the next unread letter; mailbox persists. (82d4375)
- [x] **Cellar storage chest** — starter chest at the farmhouse + buyable Chest Kit (300g, X to place); `]` opens deposit/withdraw menu with a tab shortcut for harvest dump. (50443d9)
- [x] **Recipe codex panel** — `R` opens a panel listing every recipe; locked/known/cooked tiers; ingredients + cook count + last-day; cooking marks recipes known + cooked into a persistent history. (5a09261)
- [x] **Crop journal panel** — `;` toggles a per-crop journal with lifetime tally, best season, growth-day forecast, current-tier tally + planted/watered/harvested totals. (78ea1af)
- [x] **Achievements panel** — `V` opens a 15-badge milestone tracker with scroll + persistence; checked every frame so milestones surface immediately. (6707f0f)
- [x] **Money log** — `Q` opens a 20-row gold ledger with reasons + per-row signed deltas + a footer total; persists; every gold change posts an entry. (b712a59)
- [x] **Settings panel** — `\\` opens a panel for autoSave toggle, night-tint cycling (0/30/60/100%), HUD scale (1.0/1.25/1.5x), reduce-motion toggle, and a two-step reset-save. (ba82aa4)
- [ ] **Winter quiet-season pass** — crops refuse to grow outside in winter, greenhouse becomes essential, snow particles, hot-cocoa recipe.
- [ ] **Mining depth tiers** — different gem distributions by depth; pickaxe upgrades unlock the deeper cave layers.
- [ ] **Quest log panel** — current/completed quests with rewards and a teasing next-step hint; opens via a panel toggle.
- [ ] **NPC scheduled events** — when ♥ 4 with an NPC, they invite you to an evening hangout on a specific day; cutscene-lite walk to a shared spot.
- [ ] **Pet-the-cat companion** — Rose adopts you out a kitten for 250g; sits on your roof, gives a comfort buff to the next morning's stamina.
- [ ] **Fishing rod upgrades** — copper/iron/gold rods reduce escape rate + widen catch table; Maple sells from the same upgrade row as hoe/can.
- [ ] **Stamina / energy system** — a daily stamina pool; tilling, mining, fishing each cost; sleep restores; cocoa + tea give morning boost.
- [ ] **Travelling merchant cart** — once per season, a cart parks near the village square selling rare seeds + cosmetic placeables for premium gold.
- [ ] **Auto-restock seed kit** — buyable kit that re-buys the player's last seed pick at dawn from the shop's stock + gold.
- [ ] **Wallpaper / floor cosmetics for the farmhouse** — sold via the merchant cart; redraws the interior tile palette when entering the farmhouse.

## OPEN BLOCKERS

(none — but key bindings are getting tight. Recent additions: `,` `.` `[` `]` `X` `R` `;` `V` `Q` `\\`. Open letter keys: numerics, brackets `{` `}` `'` `` ` ``, F-keys. Future panels should consider sharing a single panel-toggle key cycling through panels.)

## TICK LOG

(append-only; one line per tick)
- 2026-06-19 23:27 PT — 5/5 shipped: persistence (ad5fad6), sleep (965f0fc), weather (6213168), birthdays (75ba0ec), sprinklers (1c03c70). 517/517 tests green. Build 93.69 kB / 30.73 kB gz.
- 2026-06-20 03:40 PT — 5/5 shipped: forage (329d38e), coop (59d5ed7), egg-recipes (be0c711), farm-dog (827ae22), greenhouse (f41d16f). 582/582 tests green (+65). Build 106.41 kB / 34.54 kB gz. New keybinds: Y=forage, N=coop, I=add chicken, J=dog redeem/pet, U=greenhouse.
- 2026-06-20 07:24 PT — 5/5 shipped: crop-quality (dc6da66), tools (b100dd2), festivals (62eff02), mail (82d4375), chest (50443d9). 647/647 tests green (+65). Build 120.37 kB / 38.81 kB gz. New keybinds: ,=hoe upgrade, .=can upgrade, [=read letter, ]=open chest, X=place chest.
- 2026-06-20 15:35 PT — 5/5 shipped: codex (5a09261), journal (78ea1af), achievements (6707f0f), money-log (b712a59), settings (ba82aa4). 697/697 tests green (+50). Build 142.86 kB / 44.53 kB gz. New keybinds: R=recipe codex, ;=crop journal, V=achievements, Q=money log, \\=settings. (Note: tick was a resume — 4 commits had landed locally pre-resume from an earlier interrupted run; this tick finished the settings slice + gate + push.)

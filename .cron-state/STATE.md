# Sunsprout autonomous cron — STATE

> You are Cake. Read me FIRST every tick.

## STATUS

**STATUS:** Tick #7 complete. 35 autoship features now on `feature/autoship`. This batch shipped farmhouse decor (wallpaper + floors at Pip's cart), NPC marriage move-in with daily gifts, a quest-of-the-week notice board south of the well, the seed extractor for crop->seed recycling, and a once-a-season friendship tournament. 910/910 tests green (+75 this tick); build 185.75 kB / 56.90 kB gz.

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
- [x] **Winter quiet-season pass** — outdoor crops refuse to grow in Winter (greenhouse essential); snow particles overlay; Hot Cocoa joins the cookbook. (7589e6d)
- [x] **Pickaxe upgrades + drop bias** — Maple sells copper/iron/gold/diamond upgrades (200/600/1500/3500g, `/` keybind); per-tier gem-weight bias shifts rolls toward rare gems as you climb. (18f6028)
- [x] **Quest log panel** — `'` toggles a centred panel listing active + completed quests with hints, progress bars, and pre-formatted reward lines. (7d376af)
- [x] **NPC scheduled events** — heart-4 candidates post evening hangout invites with a (season, day) date + 18-20h window; walking onto the meeting spot fires +120g + heart points. (9b0e148)
- [x] **Rooftop cat companion** — Maple sells a Kitten Ticket (250g); `-` near the farmhouse redeems then pets; cat perches on the farmhouse roof; pet streak tips morning gold (8g/day, cap 14). (a57147b)
- [x] **Fishing rod upgrades** — Maple sells copper/iron/gold rods (250/700/1800g, `=` keybind at the shop); per-tier bite-window scale + fish-pick bias makes pike & trout meaningful catches. (e36f20d)
- [x] **Stamina / energy system** — daily 100-point pool drains on till/water/mine/cast; refills at dawn + on sleep; Z sips the best available drink (cocoa +35 > tea +20). (1897764)
- [x] **Travelling merchant cart** — Pip parks at the village square on day 3 of every season (09-18h); E opens a premium catalog with rare seeds, ready-to-drink flasks, and a brass lantern cosmetic. (991bbbc)
- [x] **Auto-restock seed kit** — buyable 600g kit re-buys the player's last-planted seed up to 5 every dawn from the shop's gold; spend tagged in the money log. (c3331d4)
- [x] **Wallpaper / floor cosmetics for the farmhouse** — three wallpapers + three floors sold at Pip's cart (260-420g); apply auto-applies; decorPalette() retints the farmhouse renderer only. (78d5e68)
- [x] **NPC marriage move-in** — after the wedding the spouse stands south of the farmhouse door during day + inside at night; dawn gift + per-spouse greeting line for E-press dialogue. (8527af9)
- [x] **Bookshelf / lore panel** — backtick toggles a 5-tab bestiary (fish/gems/forage/crops/folk) that auto-discovers entries as the player encounters them. (2d0a556)
- [x] **Quest-of-the-week board** — village notice board south of the well posts one rotating fetch quest per season; E reads / turns in; nine catalogued tasks. (332b335)
- [x] **Seed extractor** — Maple sells a 350g kit; L consumes one of the largest harvest stack and grants 1-2 seeds of the same crop (deterministic alternating yield). (f0fb391)
- [x] **Friendship tournament** — day 6 of every season the village runs a contest at the well (flower show / fishing derby / harvest weigh-in / cook-off); bronze/silver/gold ribbons + gold prizes; one entry per season. (487425a)
- [ ] **Carpenter's bench** — buyable; opens a craft menu that turns harvested wood + gems into new placeables (lantern variants, scarecrow, fence).
- [ ] **Outdoor scarecrow** — placeable that grants the crops within a 3-tile radius a +1 quality nudge at harvest time.
- [ ] **Animal yield variety** — chickens occasionally lay a "fancy egg" worth 3x; coop quality tier upgrade unlocks it.
- [ ] **Owl post** — bird-courier sells a one-shot "send gift now" service so the player can gift NPCs without crossing the village.

## OPEN BLOCKERS

(none, but two recurring observations:
 1. KEY BINDINGS ARE EXTREMELY TIGHT. New singletons added this tick: `L` (seed extractor). Letter keys still free: most numerics, F-keys, `{` `}` `~` and a few odd chars. Future panels MUST share a single panel-toggle key cycling through panels.
 2. NO SHOP UI EXISTS. SHOP_ITEMS in economy.ts is a catalog the codex can read, but there's no in-game way for the player to spend gold at Maple's beyond the upgrade hotkeys (,/.=/`/`). Every "Buy from Maple" toast currently points at a vaporware purchase path. Worth a dedicated tick to add a shop menu modal — without it, half the buyable items the game references (Coop Kit, Chest Kit, Greenhouse Kit, Auto-Restock Kit, Seed Extractor, Chickens, Bouquets, Dog/Cat tickets) can only be obtained via dev-console tweaks. Recommend Sanjay queue this as the next user-facing priority.)

## TICK LOG

(append-only; one line per tick)
- 2026-06-19 23:27 PT — 5/5 shipped: persistence (ad5fad6), sleep (965f0fc), weather (6213168), birthdays (75ba0ec), sprinklers (1c03c70). 517/517 tests green. Build 93.69 kB / 30.73 kB gz.
- 2026-06-20 03:40 PT — 5/5 shipped: forage (329d38e), coop (59d5ed7), egg-recipes (be0c711), farm-dog (827ae22), greenhouse (f41d16f). 582/582 tests green (+65). Build 106.41 kB / 34.54 kB gz. New keybinds: Y=forage, N=coop, I=add chicken, J=dog redeem/pet, U=greenhouse.
- 2026-06-20 07:24 PT — 5/5 shipped: crop-quality (dc6da66), tools (b100dd2), festivals (62eff02), mail (82d4375), chest (50443d9). 647/647 tests green (+65). Build 120.37 kB / 38.81 kB gz. New keybinds: ,=hoe upgrade, .=can upgrade, [=read letter, ]=open chest, X=place chest.
- 2026-06-20 15:35 PT — 5/5 shipped: codex (5a09261), journal (78ea1af), achievements (6707f0f), money-log (b712a59), settings (ba82aa4). 697/697 tests green (+50). Build 142.86 kB / 44.53 kB gz. New keybinds: R=recipe codex, ;=crop journal, V=achievements, Q=money log, \\=settings. (Note: tick was a resume — 4 commits had landed locally pre-resume from an earlier interrupted run; this tick finished the settings slice + gate + push.)
- 2026-06-20 18:08 PT — 5/5 shipped: winter (7589e6d), pickaxe (18f6028), quest-log (7d376af), hangouts (9b0e148), farm-cat (a57147b). 763/763 tests green (+66). Build 154.80 kB / 47.68 kB gz. New keybinds: /=pickaxe upgrade, '=quest log, -=adopt/pet cat. Also added Hot Cocoa to the cookbook; Recipe Collector achievement now references RECIPE_KEYS.length instead of a hardcoded 10.
- 2026-06-20 21:17 PT — 5/5 shipped: rod-upgrades (e36f20d), stamina (1897764), cart (991bbbc), auto-restock (c3331d4), lore (2d0a556). 835/835 tests green (+72). Build 171.78 kB / 52.10 kB gz. New keybinds: ==rod upgrade at Maple's, Z=sip best drink, `=lore panel. Cart parks at (16,9) on day 3 of every season 09-18h; E opens the menu. Auto-restock kit hooks into the dawn rollover and the plant verb; lore panel reads inventory live (no separate unlock state). Also extended fishing.ts Rod to accept per-cast bite-window + fish-picker overrides, kept fully backward-compatible.
- 2026-06-20 23:48 PT — 5/5 shipped: decor (78d5e68), spouse (8527af9), board (332b335), seed-extractor (f0fb391), tournament (487425a). 910/910 tests green (+75). Build 185.75 kB / 56.90 kB gz. New keybind: L=seed extractor. New world fixtures: notice board sprite at (19,11); decor palette retints farmhouse only; tournament uses well E-press during day-6 14-18h. Spouse overrides NPC schedule and replaces dialogue with a private greeting. Persistence wired for all five (decor/spouse/board/extractor/tournament). Open issue surfaced: SHOP_ITEMS exists but no shop UI -- buyable items only landable via dev console; recommend a shop modal as the next priority tick.

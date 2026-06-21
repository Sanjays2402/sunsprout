# Sunsprout autonomous cron — STATE

> You are Cake. Read me FIRST every tick.

## STATUS

**STATUS:** Tick #9 complete. 45 autoship features now on `main`. This batch shipped the crop ribbon journal (heaviest single-day harvest per crop, surfaced in the ; panel), animal happiness (pet/feed streaks compound into fancy egg odds + dog/cat tips), the seasonal storm (once-per-season, greenhouse-safe), late-night fishing perk (22-04h biases trout/pike), and three new stamina-tea recipes. 1033/1033 tests green (+52 this batch); build 211.38 kB / 63.67 kB gz.

**IMPORTANT WORKFLOW CHANGE:** As of tick #8, the prompt commits DIRECTLY to `main` and pushes to `origin/main`, NOT to `feature/autoship`. The quality gate (`npx tsc --noEmit && npm run build && npm test`) at end of batch is what protects main — never push red code.

Active branch: `main`
Default branch: `main` (push here every tick — contribution graph)
Cron identity: `Cake (cron) <51058514+Sanjays2402@users.noreply.github.com>`

## OPERATING RULES (do not violate)

1. Work on `main`. Commit directly to main and push to origin/main every tick.
2. No PRs (`gh pr create` BANNED). No tags. No `gh release`.
3. No emoji in any git artifact (commit messages, branch names, file contents touched by cron). Telegram delivery may use emoji.
4. One feature slice = one commit. ~5 commits per tick.
5. Gate ONCE per batch at the end (`npx tsc --noEmit`, `npm run build`, `npm test`). Push only if green.
6. Quality is the floor. If only 3 features are genuinely solid, ship 3 and say so. Never pad.

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
- [x] **Maple's Shop menu** — adjacent to the shop, E opens a tabbed (Seeds/Kits/Tickets/Misc) buy menu built from SHOP_ITEMS; singletons drop off the list once owned; closes the dev-console-only-buy gap that blocked half the kits. (0fcb284)
- [x] **Carpenter's bench** — village fixture south-east of the well; E opens a craft menu; scarecrow / brass lantern / stone fence / coop deluxe upgrade recipes turn gold + mid-tier gems into placeables. (70e3e88)
- [x] **Outdoor scarecrow** — crafted at the bench; { keybind plants on a grass tile next to your field; crops within Chebyshev 3 ripen one tier higher at harvest (normal->silver, silver->gold). (48806fb)
- [x] **Animal yield variety (fancy eggs)** — chickens roll for a fancy egg each dawn at 8% basic / 18% deluxe; fancy eggs sell at 3x; `}` applies a Coop Deluxe Upgrade Kit (700g + 2 iron) crafted at the bench. (1c41787)
- [x] **Owl post** — `~` near the farmhouse opens the owl menu; pay 40g to dispatch the village owl with your best gift for the chosen candidate; honors the per-day gift gate and never charges on a failed send. (e93a9b5)
- [x] **Crop ribbon journal** — track the heaviest single-day harvest per crop; surfaced under the streak row in the ; panel with season tag (e.g. "ribbon: 4 in a day - Fall d4"). (11136b6)
- [x] **Animal happiness** — coops carry 0..100 happiness (collect +5 / feed +3, decays 1/day, caps once-per-day); adds up to +6pp to the fancy-egg roll. Dog + cat petStreak gets a compounding flat tip (+1/+2/+3 at 8/12/14). (4e9da70)
- [x] **Seasonal storm event** — once-per-season deterministic storm on a day in [2..6]; outdoor crops lose a streak day, forage clears, greenhouse-protected crops are safe. (278d3b3)
- [x] **Late-night fishing perk** — 22-04h casts apply a per-fish bias on top of rod-tier (minnow x0.4, trout x1.75, pike x2.25); compounds with gold-rod bias. (ccf8dc1)
- [x] **Stamina-tea cookbook** — Berry Tonic / Mushroom Broth / Sunflower Elixir join the cookbook; all three slot into STAMINA_RESTORE so drinkBest tiers them above tea + cocoa. (9807913)

### Next ideas (refilled — pick the next 5 here)

- [ ] **Bath house** — late-game village fixture; small fee for a stamina-cap bonus that decays after a few days.
- [ ] **Fish pond at the farm** — placeable; stocks one fish species; daily yield + per-species quirks.
- [ ] **Weekday market schedule** — village stalls open on specific days with rotating wares (one-off seeds, single-day discounts).
- [ ] **Town board reputation** — each successful board turn-in adds a rep point; cumulative milestones unlock new board quest tiers.
- [ ] **NPC moveable schedules** — NPCs walk between two waypoints across the day; gives the village a heartbeat.
- [ ] **Hatchery** — a fancy egg can be incubated 5 days into a new chicken; consumes the egg.
- [ ] **Mining cart return** — visible cart on the mine entrance counts gems carried home this run; reset on sleep.
- [ ] **Crop dyes** — pumpkin -> orange dye, flower -> red dye at the bench; tints player tunic cosmetic.
- [ ] **Roving merchant rumor** — Pip drops a "new item next season" hint that becomes the next visit's headliner.
- [ ] **Weather forecast accuracy upgrade** — buyable barometer (300g) at Pip's cart that reveals two days ahead instead of one.
- [ ] **Festival cosmetic ribbon** — winning a friendship tournament awards a cosmetic ribbon visible on the player avatar.
- [ ] **Stable + horse mount** — late-game; buy a horse from Pip's cart, faster movement, hitch outside the inn.
- [ ] **Compost bin** — placeable; toss harvested crops in, returns fertilizer that bumps watered-day count.
- [ ] **Stamina training trail** — daily run loop around the village raises max stamina once per week.
- [ ] **Tournament leaderboard** — running totals across seasons; the bestiary or quest log gets a tab.
- [ ] **Dynamic shop discount banner** — Maple's shop posts a "today only" discount on one random item per in-game week.

## OPEN BLOCKERS

(none. Three recurring observations:
 1. KEY BINDINGS ARE EXTREMELY TIGHT. No new singletons this tick — every feature this batch was UI-less or extended an existing flow. Remaining free chars: `0`, `2`, `3`, `4`, `6`, `7`, `8`, `9` (hotbar 1-9 already), `<`, `>`, `?`. Future panels MUST share a single panel-toggle key cycling through panels — every new singleton makes onboarding worse.
 2. PERSISTENCE FANCY EGGS / COOP TIER. PlacedCoop now optionally carries `fancyEggs`, `tier`, `happiness`, `lastCareDay`. The persistence.ts snapshot uses `{ ...c }` spread on coops which preserves every field transparently. Worth a follow-up tick to formalize the CoopSnapshot schema, but functionally complete.
 3. UNUSED IMPORT: src/engine/game.ts still imports `weightedFishPick` from rod-upgrades. Night-fishing now wraps that into `nightAwareFishPick`. Drop the dangling import on the next refactor pass.)

## TICK LOG

(append-only; one line per tick)
- 2026-06-19 23:27 PT — 5/5 shipped: persistence (ad5fad6), sleep (965f0fc), weather (6213168), birthdays (75ba0ec), sprinklers (1c03c70). 517/517 tests green. Build 93.69 kB / 30.73 kB gz.
- 2026-06-20 03:40 PT — 5/5 shipped: forage (329d38e), coop (59d5ed7), egg-recipes (be0c711), farm-dog (827ae22), greenhouse (f41d16f). 582/582 tests green (+65). Build 106.41 kB / 34.54 kB gz. New keybinds: Y=forage, N=coop, I=add chicken, J=dog redeem/pet, U=greenhouse.
- 2026-06-20 07:24 PT — 5/5 shipped: crop-quality (dc6da66), tools (b100dd2), festivals (62eff02), mail (82d4375), chest (50443d9). 647/647 tests green (+65). Build 120.37 kB / 38.81 kB gz. New keybinds: ,=hoe upgrade, .=can upgrade, [=read letter, ]=open chest, X=place chest.
- 2026-06-20 15:35 PT — 5/5 shipped: codex (5a09261), journal (78ea1af), achievements (6707f0f), money-log (b712a59), settings (ba82aa4). 697/697 tests green (+50). Build 142.86 kB / 44.53 kB gz. New keybinds: R=recipe codex, ;=crop journal, V=achievements, Q=money log, \\=settings. (Note: tick was a resume — 4 commits had landed locally pre-resume from an earlier interrupted run; this tick finished the settings slice + gate + push.)
- 2026-06-20 18:08 PT — 5/5 shipped: winter (7589e6d), pickaxe (18f6028), quest-log (7d376af), hangouts (9b0e148), farm-cat (a57147b). 763/763 tests green (+66). Build 154.80 kB / 47.68 kB gz. New keybinds: /=pickaxe upgrade, '=quest log, -=adopt/pet cat. Also added Hot Cocoa to the cookbook; Recipe Collector achievement now references RECIPE_KEYS.length instead of a hardcoded 10.
- 2026-06-20 21:17 PT — 5/5 shipped: rod-upgrades (e36f20d), stamina (1897764), cart (991bbbc), auto-restock (c3331d4), lore (2d0a556). 835/835 tests green (+72). Build 171.78 kB / 52.10 kB gz. New keybinds: ==rod upgrade at Maple's, Z=sip best drink, `=lore panel. Cart parks at (16,9) on day 3 of every season 09-18h; E opens the menu. Auto-restock kit hooks into the dawn rollover and the plant verb; lore panel reads inventory live (no separate unlock state). Also extended fishing.ts Rod to accept per-cast bite-window + fish-picker overrides, kept fully backward-compatible.
- 2026-06-20 23:48 PT — 5/5 shipped: decor (78d5e68), spouse (8527af9), board (332b335), seed-extractor (f0fb391), tournament (487425a). 910/910 tests green (+75). Build 185.75 kB / 56.90 kB gz. New keybind: L=seed extractor. New world fixtures: notice board sprite at (19,11); decor palette retints farmhouse only; tournament uses well E-press during day-6 14-18h. Spouse overrides NPC schedule and replaces dialogue with a private greeting. Persistence wired for all five (decor/spouse/board/extractor/tournament). Open issue surfaced: SHOP_ITEMS exists but no shop UI -- buyable items only landable via dev console; recommend a shop modal as the next priority tick.
- 2026-06-21 03:12 PT — 5/5 shipped: shop (0fcb284), bench (70e3e88), scarecrow (48806fb), fancy-eggs (1c41787), owl-post (e93a9b5). 981/981 tests green (+71). Build 207.24 kB / 62.07 kB gz. WORKFLOW CHANGE: this tick commits directly to `main` (origin/main); previous ticks merged feature/autoship. New world fixtures: carpenter's bench at (22,9). New keybinds: { (scarecrow place), } (coop deluxe apply), ~ (owl post at farmhouse). Maple's shop modal closes the longstanding "buy from Maple" vaporware path -- all SHOP_ITEMS are now reachable in-game. Scarecrow boost runs INSIDE farming.harvest() so it stacks on the streak-derived quality without touching streak math. Fancy egg yield uses a deterministic per-(coop,day,chicken) hash so reload-scumming doesn't work; deluxe upgrade lifts the rate from 8% to 18%. Owl post fee (40g) only deducts on confirmed delivery so wasted presses are harmless.
- 2026-06-21 06:15 PT — 5/5 shipped: crop-ribbon (11136b6), animal-happiness (4e9da70), storm (278d3b3), night-fishing (ccf8dc1), stamina-teas (9807913). 1033/1033 tests green (+52). Build 211.38 kB / 63.67 kB gz. NO NEW KEYBINDS THIS TICK — every feature extended an existing flow. Crop ribbon shipped through the ; panel using the time arg now threaded into recordHarvest(). Animal happiness lives in a new pure module animal-happiness.ts (coop happiness + petTipBonus); coopTick now wraps the tier rate through coopFancyRate. Storm fires AFTER greenhouseTick so the greenhouse is the literal shelter. Night-fishing layer multiplies on top of rod-tier bias so gold rod + 2am cast is the compounded sweet spot. Three new stamina teas slot into both RECIPES + STAMINA_RESTORE without per-recipe wiring (drinkBest already iterates the table).

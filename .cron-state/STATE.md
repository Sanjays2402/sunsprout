# Sunsprout autonomous cron — STATE

> You are Cake 🍰. Read me FIRST.

## STATUS

**STATUS:** v0.1.0 INITIAL BUILD COMPLETE — ready for deploy.

Active dev branch: `main`
Latest tag: *(none yet — tag after first successful gh-pages deploy)*

## ROADMAP

- [~] **v0.1.0 — First Sprout** *(IN PROGRESS — this slice: engine + gameplay + tests + deploy workflow)*
- [ ] **v0.2.0 — Fishing Pond** *(PROPOSED)* — rod + cast + minigame at the pond Finn fishes from
- [ ] **v0.3.0 — Cooking Pot** *(PROPOSED)* — turn harvest into stew at the inn for bigger gold
- [ ] **v0.4.0 — Mining Caves** — hidden cave entrance + pickaxe + gem economy
- [ ] **v0.5.0 — Marriage Candidates** — each NPC gets a heart meter + gift preferences
- [ ] **v0.6.0 — Multiplayer Farms** — WebSocket co-op
- [ ] **v1.0.0 — Full Year + Festivals**

## OPEN BLOCKERS

*(none — first deploy will run from the next push to `main` and may take 1-2 min)*

## DECISIONS LOCKED

1. **No PRs — direct merges to `main`.** Pages workflow deploys every push.
2. **Cron commit author:** `Cake (cron) <51058514+Sanjays2402@users.noreply.github.com>`.
3. **Browser-native + GH Pages deploy.** No server, no backend, no DB.
4. **Zero external assets.** Every visual is procedural `ctx.fillRect`. Every font is system monospace.
5. **15-minute cron ticks** after first deploy is live and green (cron job to be wired by the orchestrator after deploy verification).
6. **No mid-build check-ins** to Telegram. Silent unless hard blocker. Surface screenshots when features ship.

## NEXT TICK (autonomous cron, when wired)

1. Read this file.
2. Pick the next unchecked roadmap item.
3. Spawn a minimal feature on a branch, run tests + build, merge to `main`.
4. On success update STATUS line and mark the roadmap row.
5. Take a fresh screenshot (`scripts/snap.mjs`) and send to Sanjay's Telegram.

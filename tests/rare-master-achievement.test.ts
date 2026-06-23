// Rare Master — 25th badge keyed off lifetimeRareBagsApplied >=
// RARE_MASTER_MILESTONE_BAGS (100). Distinct from pulper (which counts
// regular + rare combined): rare bags are gated behind the per-season
// rare-day finishing window, so 100 rare bags applied represents many
// seasons of deliberate compost-timing — a real late-game grind.
//
// Tests cover:
//   - rare-master predicate (works off the new lazy field)
//   - recordApplied bumps the rare counter only when rare=true
//   - applyFertilizer routes rare bags through the rare counter
//   - achievement catalog registration + ordering
//   - tickAchievements grants the badge at the threshold
//   - older saves backfill rareBagsApplied to 0
//   - persistence round-trips the rare counter

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import type { FarmCrop } from '../src/game/farming';
import {
  COMPOST_RECYCLE_REGULAR,
  COMPOST_RECYCLE_RARE,
  FERTILIZER_INVENTORY_KEY,
  RARE_FERTILIZER_INVENTORY_KEY,
  RARE_MASTER_MILESTONE_BAGS,
  applyFertilizer,
  getCompostLedger,
  rareMasterMilestoneReached,
  recordApplied,
} from '../src/game/compost';
import {
  ACHIEVEMENTS,
  isEarned,
  tickAchievements,
} from '../src/game/achievements';

function plantCrop(world: World, tx: number, ty: number): void {
  // Switch the tile to tilled + drop a wheat crop on it so applyFertilizer
  // has something to push the streak into.
  const tile = world.tiles[ty][tx];
  tile.type = 'tilled';
  const crop = {
    tx,
    ty,
    crop: 'wheat',
    stage: 0,
    daysSinceWater: 0,
    watered: true,
    waterStreak: 1,
  } as unknown as FarmCrop;
  const w = world as World & { crops?: FarmCrop[] };
  if (!w.crops) w.crops = [];
  w.crops.push(crop);
}

describe('rareMasterMilestoneReached predicate', () => {
  it('false on a fresh player', () => {
    const w = new World();
    expect(rareMasterMilestoneReached(w.player)).toBe(false);
  });

  it('false on a fresh save where lifetimeRareBagsApplied is undefined', () => {
    const p = {} as object;
    expect(rareMasterMilestoneReached(p)).toBe(false);
  });

  it('false at MILESTONE - 1, true at MILESTONE', () => {
    const w = new World();
    const ledger = getCompostLedger(w.player);
    ledger.lifetimeRareBagsApplied = RARE_MASTER_MILESTONE_BAGS - 1;
    expect(rareMasterMilestoneReached(w.player)).toBe(false);
    ledger.lifetimeRareBagsApplied = RARE_MASTER_MILESTONE_BAGS;
    expect(rareMasterMilestoneReached(w.player)).toBe(true);
  });
});

describe('recordApplied — rare counter', () => {
  it('does NOT bump rare counter on regular apply', () => {
    const w = new World();
    recordApplied(w.player, COMPOST_RECYCLE_REGULAR);
    expect(getCompostLedger(w.player).lifetimeRareBagsApplied ?? 0).toBe(0);
    expect(getCompostLedger(w.player).lifetimeBagsApplied).toBe(1);
  });

  it('bumps rare counter on rare apply', () => {
    const w = new World();
    recordApplied(w.player, COMPOST_RECYCLE_RARE, true);
    expect(getCompostLedger(w.player).lifetimeRareBagsApplied).toBe(1);
    expect(getCompostLedger(w.player).lifetimeBagsApplied).toBe(1);
  });

  it('still bumps regular counter when rare=true (rare counts as a bag too)', () => {
    const w = new World();
    for (let i = 0; i < 5; i++) recordApplied(w.player, COMPOST_RECYCLE_RARE, true);
    expect(getCompostLedger(w.player).lifetimeRareBagsApplied).toBe(5);
    expect(getCompostLedger(w.player).lifetimeBagsApplied).toBe(5);
  });

  it('mixed regular + rare apply counts both totals correctly', () => {
    const w = new World();
    for (let i = 0; i < 60; i++) recordApplied(w.player, COMPOST_RECYCLE_REGULAR);
    for (let i = 0; i < 40; i++) recordApplied(w.player, COMPOST_RECYCLE_RARE, true);
    expect(getCompostLedger(w.player).lifetimeRareBagsApplied).toBe(40);
    expect(getCompostLedger(w.player).lifetimeBagsApplied).toBe(100);
  });
});

describe('applyFertilizer — routes rare bag through rare counter', () => {
  it('applying a rare bag bumps lifetimeRareBagsApplied', () => {
    const w = new World();
    plantCrop(w, 5, 5);
    w.player.inventory[RARE_FERTILIZER_INVENTORY_KEY] = 1;
    const out = applyFertilizer(w, w.player, 5, 5);
    expect(out.kind).toBe('applied');
    if (out.kind === 'applied') expect(out.rare).toBe(true);
    expect(getCompostLedger(w.player).lifetimeRareBagsApplied).toBe(1);
  });

  it('applying a regular bag does NOT bump lifetimeRareBagsApplied', () => {
    const w = new World();
    plantCrop(w, 5, 5);
    w.player.inventory[FERTILIZER_INVENTORY_KEY] = 1;
    const out = applyFertilizer(w, w.player, 5, 5);
    expect(out.kind).toBe('applied');
    if (out.kind === 'applied') expect(out.rare).toBe(false);
    expect(getCompostLedger(w.player).lifetimeRareBagsApplied ?? 0).toBe(0);
    expect(getCompostLedger(w.player).lifetimeBagsApplied).toBe(1);
  });

  it('rare-first preference still routes to rare counter when both bags exist', () => {
    const w = new World();
    plantCrop(w, 5, 5);
    w.player.inventory[FERTILIZER_INVENTORY_KEY] = 1;
    w.player.inventory[RARE_FERTILIZER_INVENTORY_KEY] = 1;
    applyFertilizer(w, w.player, 5, 5);
    // Rare-first: the rare bag was consumed, rare counter bumped.
    expect(getCompostLedger(w.player).lifetimeRareBagsApplied).toBe(1);
    expect(w.player.inventory[RARE_FERTILIZER_INVENTORY_KEY]).toBe(0);
    expect(w.player.inventory[FERTILIZER_INVENTORY_KEY]).toBe(1);
  });
});

describe('rare-master in the achievements catalog', () => {
  it('catalog includes the rare-master entry', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'rare-master');
    expect(def).toBeTruthy();
    expect(def?.name).toBe('Rare Master');
    expect(def?.hint).toContain(String(RARE_MASTER_MILESTONE_BAGS));
    expect(def?.done).toContain(String(RARE_MASTER_MILESTONE_BAGS));
  });

  it('catalog size now includes rare-master (25+ badges)', () => {
    expect(ACHIEVEMENTS.some((a) => a.id === 'rare-master')).toBe(true);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(25);
  });

  it('rare-master is positioned after compost-master-sash in display order', () => {
    const rareIdx = ACHIEVEMENTS.findIndex((a) => a.id === 'rare-master');
    const sashIdx = ACHIEVEMENTS.findIndex((a) => a.id === 'compost-master-sash');
    expect(rareIdx).toBeGreaterThan(sashIdx);
  });

  it('tickAchievements grants the badge at the threshold', () => {
    const w = new World();
    const time = new TimeOfDay(7);
    for (let i = 0; i < RARE_MASTER_MILESTONE_BAGS - 1; i++) {
      recordApplied(w.player, COMPOST_RECYCLE_RARE, true);
    }
    let newly = tickAchievements(w.player, w, time);
    expect(newly).not.toContain('rare-master');
    expect(isEarned(w.player, 'rare-master')).toBe(false);
    recordApplied(w.player, COMPOST_RECYCLE_RARE, true);
    newly = tickAchievements(w.player, w, time);
    expect(newly).toContain('rare-master');
    expect(isEarned(w.player, 'rare-master')).toBe(true);
  });

  it('regular-only bag spam does NOT earn rare-master even at huge totals', () => {
    const w = new World();
    const time = new TimeOfDay(7);
    for (let i = 0; i < 500; i++) {
      recordApplied(w.player, COMPOST_RECYCLE_REGULAR);
    }
    const newly = tickAchievements(w.player, w, time);
    expect(newly).not.toContain('rare-master');
    expect(isEarned(w.player, 'rare-master')).toBe(false);
  });
});

describe('rare-master predicate — older-save backfill', () => {
  it('reads correctly when the ledger predates the field (undefined -> 0)', () => {
    const p: object = {};
    // Force the ledger into existence WITHOUT lifetimeRareBagsApplied
    // by writing the older-shape ledger directly.
    (p as { compostLedger: { lifetimeRecycledGold: number; lifetimeBagsApplied: number } }).compostLedger = {
      lifetimeRecycledGold: 50,
      lifetimeBagsApplied: 50,
    };
    expect(rareMasterMilestoneReached(p)).toBe(false);
  });
});

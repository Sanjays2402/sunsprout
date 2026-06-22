// Compost lifetime ledger — tracks recycled gold + bags applied across
// the player's career. Bumped from applyFertilizer; surfaces a journal
// line via compostLedgerLine; lights up the new `compost-master`
// achievement at COMPOST_MASTER_MILESTONE_GOLD (100g lifetime).

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  FERTILIZER_INVENTORY_KEY,
  RARE_FERTILIZER_INVENTORY_KEY,
  COMPOST_RECYCLE_REGULAR,
  COMPOST_RECYCLE_RARE,
  COMPOST_MASTER_MILESTONE_GOLD,
  applyFertilizer,
  getCompostLedger,
  recordApplied,
  compostMasterMilestoneReached,
  compostLedgerLine,
} from '../src/game/compost';
import { plant, till, water } from '../src/game/farming';
import { ACHIEVEMENTS, tickAchievements, isEarned } from '../src/game/achievements';
import { TimeOfDay } from '../src/game/time';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

const FREE_TX = 10;
const FREE_TY = 14;

function freshWorld(): World {
  const w = new World();
  w.player.inventory = {};
  w.player.gold = 100;
  return w;
}

function plantWheat(w: World): void {
  till(w, FREE_TX, FREE_TY);
  w.player.inventory['wheat'] = 1;
  plant(w, FREE_TX, FREE_TY, 'wheat', w.player);
  water(w, FREE_TX, FREE_TY);
}

function fakeGame(): Game {
  const w = new World();
  return { world: w, time: new TimeOfDay(6) } as unknown as Game;
}

describe('CompostLedgerState — lazy accessor + recordApplied', () => {
  it('getCompostLedger creates a fresh zero-init state on first read', () => {
    const p = {} as object;
    const l = getCompostLedger(p);
    expect(l.lifetimeRecycledGold).toBe(0);
    expect(l.lifetimeBagsApplied).toBe(0);
    expect(getCompostLedger(p)).toBe(l); // idempotent
  });

  it('recordApplied bumps both counters and returns the new gold total', () => {
    const p = {} as object;
    expect(recordApplied(p, 1)).toBe(1);
    expect(recordApplied(p, 3)).toBe(4);
    const l = getCompostLedger(p);
    expect(l.lifetimeBagsApplied).toBe(2);
    expect(l.lifetimeRecycledGold).toBe(4);
  });
});

describe('applyFertilizer — wires the ledger', () => {
  it('regular bag bumps lifetimeBagsApplied by 1 and gold by COMPOST_RECYCLE_REGULAR', () => {
    const w = freshWorld();
    plantWheat(w);
    w.player.inventory[FERTILIZER_INVENTORY_KEY] = 1;
    applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    const l = getCompostLedger(w.player);
    expect(l.lifetimeBagsApplied).toBe(1);
    expect(l.lifetimeRecycledGold).toBe(COMPOST_RECYCLE_REGULAR);
  });

  it('rare bag bumps lifetimeBagsApplied by 1 and gold by COMPOST_RECYCLE_RARE', () => {
    const w = freshWorld();
    plantWheat(w);
    w.player.inventory[RARE_FERTILIZER_INVENTORY_KEY] = 1;
    applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    const l = getCompostLedger(w.player);
    expect(l.lifetimeBagsApplied).toBe(1);
    expect(l.lifetimeRecycledGold).toBe(COMPOST_RECYCLE_RARE);
  });

  it('does NOT bump the ledger when the apply fails (no crop)', () => {
    const w = freshWorld();
    w.player.inventory[FERTILIZER_INVENTORY_KEY] = 1;
    applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    const l = getCompostLedger(w.player);
    expect(l.lifetimeBagsApplied).toBe(0);
    expect(l.lifetimeRecycledGold).toBe(0);
  });

  it('does NOT bump the ledger when there is no fertilizer to consume', () => {
    const w = freshWorld();
    plantWheat(w);
    applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    const l = getCompostLedger(w.player);
    expect(l.lifetimeBagsApplied).toBe(0);
    expect(l.lifetimeRecycledGold).toBe(0);
  });

  it('stacks across many applies — 5 regular + 3 rare', () => {
    const w = freshWorld();
    plantWheat(w);
    w.player.inventory[FERTILIZER_INVENTORY_KEY] = 5;
    w.player.inventory[RARE_FERTILIZER_INVENTORY_KEY] = 3;
    // Rare bags are consumed first; do 3 rare applies, then 5 regular.
    for (let i = 0; i < 8; i++) {
      // Re-plant after every cycle so the crop is fresh — water resets
      // the streak path but the apply doesn't lose its target.
      applyFertilizer(w, w.player, FREE_TX, FREE_TY);
    }
    const l = getCompostLedger(w.player);
    expect(l.lifetimeBagsApplied).toBe(8);
    expect(l.lifetimeRecycledGold).toBe(
      3 * COMPOST_RECYCLE_RARE + 5 * COMPOST_RECYCLE_REGULAR,
    );
  });
});

describe('compostMasterMilestoneReached + compostLedgerLine', () => {
  it('milestone is reached at exactly COMPOST_MASTER_MILESTONE_GOLD', () => {
    const p = {} as object;
    expect(compostMasterMilestoneReached(p)).toBe(false);
    recordApplied(p, COMPOST_MASTER_MILESTONE_GOLD - 1);
    expect(compostMasterMilestoneReached(p)).toBe(false);
    recordApplied(p, 1);
    expect(compostMasterMilestoneReached(p)).toBe(true);
  });

  it('compostLedgerLine returns the empty string before any apply', () => {
    const p = {} as object;
    expect(compostLedgerLine(p)).toBe('');
  });

  it('compostLedgerLine uses singular form for exactly one bag', () => {
    const p = {} as object;
    recordApplied(p, 3);
    expect(compostLedgerLine(p)).toBe('compost master: 3g recycled across 1 bag.');
  });

  it('compostLedgerLine pluralises bags and locale-formats gold', () => {
    const p = {} as object;
    for (let i = 0; i < 500; i++) recordApplied(p, 3);
    const line = compostLedgerLine(p);
    expect(line).toMatch(/compost master: [\d,]+g recycled across 500 bags\./);
    expect(line).toContain(',');
  });
});

describe('compost-master achievement', () => {
  it('is in the achievement catalog with id "compost-master"', () => {
    expect(ACHIEVEMENTS.some((a) => a.id === 'compost-master')).toBe(true);
  });

  it('check predicate returns false on a fresh player', () => {
    const w = new World();
    const def = ACHIEVEMENTS.find((a) => a.id === 'compost-master')!;
    expect(def.check(w.player, w, new TimeOfDay(6))).toBe(false);
  });

  it('check predicate returns true once lifetime recycled gold crosses milestone', () => {
    const w = new World();
    recordApplied(w.player, COMPOST_MASTER_MILESTONE_GOLD);
    const def = ACHIEVEMENTS.find((a) => a.id === 'compost-master')!;
    expect(def.check(w.player, w, new TimeOfDay(6))).toBe(true);
  });

  it('tickAchievements grants the badge once and is idempotent', () => {
    const w = new World();
    recordApplied(w.player, COMPOST_MASTER_MILESTONE_GOLD);
    const time = new TimeOfDay(6);
    const newly1 = tickAchievements(w.player, w, time);
    expect(newly1).toContain('compost-master');
    expect(isEarned(w.player, 'compost-master')).toBe(true);
    const newly2 = tickAchievements(w.player, w, time);
    expect(newly2).not.toContain('compost-master');
  });
});

describe('compostLedger persistence', () => {
  it('round-trips lifetimeRecycledGold + lifetimeBagsApplied through serialize/apply', () => {
    const g = fakeGame();
    recordApplied(g.world.player, 3);
    recordApplied(g.world.player, 1);
    recordApplied(g.world.player, 3);
    const snap = serializeGame(g);
    expect(snap.player.compostLedger).toEqual({
      lifetimeRecycledGold: 7,
      lifetimeBagsApplied: 3,
    });
    const g2 = fakeGame();
    expect(applySnapshot(g2, snap)).toBe(true);
    const l = getCompostLedger(g2.world.player);
    expect(l.lifetimeRecycledGold).toBe(7);
    expect(l.lifetimeBagsApplied).toBe(3);
  });

  it('snapshot omits compostLedger when the player has never recycled', () => {
    const g = fakeGame();
    const snap = serializeGame(g);
    expect(snap.player.compostLedger).toBeUndefined();
  });
});

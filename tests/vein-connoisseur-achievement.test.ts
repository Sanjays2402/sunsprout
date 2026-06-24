// Vein Connoisseur achievement — career breadth-of-mining badge.
// Lights up when the player has mined VEIN_CONNOISSEUR_PER_GEM (10)
// of EVERY gem type across their career. Reads off the existing
// MineHaulState.lifetimeCounts map populated by recordMined — no new
// persisted state, no engine wiring beyond the catalog row.
//
// Orthogonal to cave-veteran (lifetime total): cave-veteran rewards
// PURE QUANTITY across all gems; vein-connoisseur rewards BREADTH
// (you can't shortcut it with a one-gem grind).

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  VEIN_CONNOISSEUR_PER_GEM,
  LIFETIME_MINING_MILESTONE,
  veinConnoisseurMilestoneReached,
  getMineHaul,
  recordMined,
} from '../src/game/mining-haul';
import { ACHIEVEMENTS, tickAchievements } from '../src/game/achievements';
import { GEM_KEYS } from '../src/game/gems';

describe('VEIN_CONNOISSEUR_PER_GEM constant — tuning sanity', () => {
  it('is at a reasonable per-gem floor — high enough to feel earned, low enough to be reachable', () => {
    expect(VEIN_CONNOISSEUR_PER_GEM).toBeGreaterThanOrEqual(5);
    expect(VEIN_CONNOISSEUR_PER_GEM).toBeLessThan(50);
  });

  it('total threshold (per-gem × gem types) sits comfortably below the cave-veteran lifetime bar', () => {
    // 5 gems * 10 each = 50 — half the 100-gem cave-veteran target so
    // a player can earn the breadth badge while still working toward
    // cave-veteran (without lapping it).
    const breadthTotal = GEM_KEYS.length * VEIN_CONNOISSEUR_PER_GEM;
    expect(breadthTotal).toBeLessThan(LIFETIME_MINING_MILESTONE);
  });
});

describe('veinConnoisseurMilestoneReached — predicate', () => {
  it('returns false on a fresh save (no mining yet)', () => {
    const w = new World();
    expect(veinConnoisseurMilestoneReached(getMineHaul(w.player))).toBe(false);
  });

  it('returns false when only one gem type has been mined to the threshold', () => {
    const w = new World();
    const p = w.player;
    // Pure copper grind — every other gem stays at 0.
    for (let i = 0; i < VEIN_CONNOISSEUR_PER_GEM * 3; i++) recordMined(p, 'copper');
    expect(veinConnoisseurMilestoneReached(getMineHaul(p))).toBe(false);
  });

  it('returns false while EXACTLY ONE gem sits below the threshold', () => {
    const w = new World();
    const p = w.player;
    // Mine the per-gem threshold of every gem EXCEPT ruby.
    for (const k of GEM_KEYS) {
      if (k === 'ruby') continue;
      for (let i = 0; i < VEIN_CONNOISSEUR_PER_GEM; i++) recordMined(p, k);
    }
    // Ruby short of the threshold by one.
    for (let i = 0; i < VEIN_CONNOISSEUR_PER_GEM - 1; i++) recordMined(p, 'ruby');
    expect(veinConnoisseurMilestoneReached(getMineHaul(p))).toBe(false);
  });

  it('fires the moment EVERY gem type reaches the per-gem threshold', () => {
    const w = new World();
    const p = w.player;
    for (const k of GEM_KEYS) {
      for (let i = 0; i < VEIN_CONNOISSEUR_PER_GEM; i++) recordMined(p, k);
    }
    expect(veinConnoisseurMilestoneReached(getMineHaul(p))).toBe(true);
  });

  it('stays true after the breadth threshold is exceeded on any axis', () => {
    const w = new World();
    const p = w.player;
    for (const k of GEM_KEYS) {
      // Mine 3x the per-gem threshold on every gem.
      for (let i = 0; i < VEIN_CONNOISSEUR_PER_GEM * 3; i++) recordMined(p, k);
    }
    expect(veinConnoisseurMilestoneReached(getMineHaul(p))).toBe(true);
  });

  it('handles the boundary exactly at VEIN_CONNOISSEUR_PER_GEM', () => {
    const w = new World();
    const p = w.player;
    // One gem short by one strike on the LAST gem type.
    for (let i = 0; i < GEM_KEYS.length; i++) {
      const k = GEM_KEYS[i];
      const target = i === GEM_KEYS.length - 1
        ? VEIN_CONNOISSEUR_PER_GEM - 1
        : VEIN_CONNOISSEUR_PER_GEM;
      for (let j = 0; j < target; j++) recordMined(p, k);
    }
    expect(veinConnoisseurMilestoneReached(getMineHaul(p))).toBe(false);
    // One more strike on the last gem → fires.
    recordMined(p, GEM_KEYS[GEM_KEYS.length - 1]);
    expect(veinConnoisseurMilestoneReached(getMineHaul(p))).toBe(true);
  });
});

describe('vein-connoisseur achievement — catalog wiring', () => {
  it('catalog includes a vein-connoisseur row', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'vein-connoisseur');
    expect(def).toBeDefined();
    expect(def?.name).toBe('Vein Connoisseur');
  });

  it('catalog has grown to at least 26 badges this tick', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(26);
  });

  it('hint string names the per-gem threshold', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'vein-connoisseur')!;
    expect(def.hint).toContain(String(VEIN_CONNOISSEUR_PER_GEM));
  });

  it('done string lists every gem type so the player knows what counted', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'vein-connoisseur')!;
    // Sanity: every gem key (or its capitalised name) should appear
    // somewhere in the done string so the player gets the full
    // breakdown on the panel.
    for (const k of GEM_KEYS) {
      expect(def.done.toLowerCase()).toContain(k);
    }
  });

  it('tickAchievements grants the badge when every gem type crosses the threshold', () => {
    const w = new World();
    const p = w.player;
    for (const k of GEM_KEYS) {
      for (let i = 0; i < VEIN_CONNOISSEUR_PER_GEM; i++) recordMined(p, k);
    }
    const earned = tickAchievements(p, w, new TimeOfDay(5));
    expect(earned).toContain('vein-connoisseur');
  });

  it('tickAchievements does NOT grant the badge while any gem is short', () => {
    const w = new World();
    const p = w.player;
    for (const k of GEM_KEYS) {
      if (k === 'ruby') continue;
      for (let i = 0; i < VEIN_CONNOISSEUR_PER_GEM; i++) recordMined(p, k);
    }
    // Ruby missing entirely.
    const earned = tickAchievements(p, w, new TimeOfDay(5));
    expect(earned).not.toContain('vein-connoisseur');
  });
});

describe('vein-connoisseur — orthogonal to cave-veteran', () => {
  it('a player can earn cave-veteran (lifetime 100) without earning vein-connoisseur', () => {
    const w = new World();
    const p = w.player;
    // Pure-copper grind — passes lifetime 100, but only one gem type.
    for (let i = 0; i < LIFETIME_MINING_MILESTONE + 1; i++) recordMined(p, 'copper');
    const earned = tickAchievements(p, w, new TimeOfDay(5));
    expect(earned).toContain('cave-veteran');
    expect(earned).not.toContain('vein-connoisseur');
  });

  it('a player can earn vein-connoisseur (breadth) without earning cave-veteran', () => {
    const w = new World();
    const p = w.player;
    // 10 of every gem = 50 total, below the 100-gem cave-veteran bar.
    for (const k of GEM_KEYS) {
      for (let i = 0; i < VEIN_CONNOISSEUR_PER_GEM; i++) recordMined(p, k);
    }
    const earned = tickAchievements(p, w, new TimeOfDay(5));
    expect(earned).toContain('vein-connoisseur');
    expect(earned).not.toContain('cave-veteran');
  });
});

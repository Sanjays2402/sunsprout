// Crop journal — recordSown / recordHarvest / bestStreak / build + UI.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  bestSeasonHint,
  buildJournal,
  getJournal,
  nextFestivals,
  recordHarvest,
  recordSown,
  totalHarvest,
  maxLifetimeHarvest,
  harvestBarSegments,
} from '../src/game/crop-journal';
import { CropJournalPanel } from '../src/ui/crop-journal-panel';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function fakeGame(): Game {
  const w = new World();
  return { world: w, time: new TimeOfDay(6) } as unknown as Game;
}

describe('crop-journal counters', () => {
  it('getJournal lazily returns an empty record', () => {
    const w = new World();
    const j = getJournal(w.player);
    expect(j).toEqual({});
    expect(getJournal(w.player)).toBe(j);
  });

  it('recordSown bumps the sown counter per crop', () => {
    const w = new World();
    recordSown(w.player, 'wheat');
    recordSown(w.player, 'wheat');
    recordSown(w.player, 'tomato');
    const j = getJournal(w.player);
    expect(j.wheat.sown).toBe(2);
    expect(j.tomato.sown).toBe(1);
  });

  it('recordHarvest buckets by quality and tracks best streak', () => {
    const w = new World();
    recordHarvest(w.player, 'wheat', 'normal');
    recordHarvest(w.player, 'wheat', 'silver', 3);
    recordHarvest(w.player, 'wheat', 'gold', 5);
    recordHarvest(w.player, 'wheat', 'gold', 4); // weaker streak shouldn't lower record
    const r = getJournal(w.player).wheat;
    expect(r.normal).toBe(1);
    expect(r.silver).toBe(1);
    expect(r.gold).toBe(2);
    expect(r.bestStreak).toBe(5);
    expect(totalHarvest(r)).toBe(4);
  });

  it('records to unknown crop keys are silently ignored', () => {
    const w = new World();
    recordSown(w.player, 'banana');
    recordHarvest(w.player, 'banana', 'gold', 9);
    expect(getJournal(w.player).banana).toBeUndefined();
  });
});

describe('buildJournal', () => {
  it('returns one row per catalog crop with catalog and tally fields', () => {
    const w = new World();
    recordSown(w.player, 'wheat');
    recordHarvest(w.player, 'wheat', 'gold', 4);
    const rows = buildJournal(w.player);
    expect(rows.length).toBe(4);
    const wheat = rows.find((r) => r.key === 'wheat')!;
    expect(wheat.name).toBe('Wheat');
    expect(wheat.seedPrice).toBe(2);
    expect(wheat.sellPrice).toBe(8);
    expect(wheat.bestSeason).toBe('Spring');
    expect(wheat.sown).toBe(1);
    expect(wheat.gold).toBe(1);
    expect(wheat.bestStreak).toBe(4);
    // Rows for crops the player never touched still appear with zeros.
    const flower = rows.find((r) => r.key === 'flower')!;
    expect(flower.sown).toBe(0);
    expect(flower.normal).toBe(0);
  });

  it('bestSeasonHint covers every catalog crop', () => {
    expect(bestSeasonHint('wheat')).toBe('Spring');
    expect(bestSeasonHint('tomato')).toBe('Summer');
    expect(bestSeasonHint('pumpkin')).toBe('Fall');
    expect(bestSeasonHint('flower')).toBe('any');
    expect(bestSeasonHint('mystery')).toBe('any');
  });
});

describe('nextFestivals', () => {
  it('lists upcoming festivals sorted by days-until', () => {
    const t = new TimeOfDay(6);
    // Default: Spring (season 0), Day 1.
    const out = nextFestivals(t, 2);
    expect(out.length).toBe(2);
    expect(out[0]).toMatch(/Planting/);
  });
});

describe('CropJournalPanel controller', () => {
  it('toggle open/close', () => {
    const j = new CropJournalPanel();
    expect(j.isVisible()).toBe(false);
    j.toggle();
    expect(j.isVisible()).toBe(true);
    j.toggle();
    expect(j.isVisible()).toBe(false);
  });

  it('respects the open-lockout', () => {
    const j = new CropJournalPanel();
    j.open();
    expect(j.canAct()).toBe(false);
    j.update(50);
    expect(j.canAct()).toBe(false);
    j.update(200);
    expect(j.canAct()).toBe(true);
  });
});

describe('crop-journal persistence', () => {
  it('journal counters survive a snapshot round-trip', () => {
    const a = fakeGame();
    recordSown(a.world.player, 'wheat');
    recordHarvest(a.world.player, 'wheat', 'silver', 3);
    recordHarvest(a.world.player, 'pumpkin', 'gold', 6);
    const snap = serializeGame(a);
    const b = fakeGame();
    expect(getJournal(b.world.player).wheat).toBeUndefined();
    applySnapshot(b, snap);
    const j = getJournal(b.world.player);
    expect(j.wheat.sown).toBe(1);
    expect(j.wheat.silver).toBe(1);
    expect(j.wheat.bestStreak).toBe(3);
    expect(j.pumpkin.gold).toBe(1);
    expect(j.pumpkin.bestStreak).toBe(6);
  });
});

describe('crop ribbon journal', () => {
  it('records the heaviest single-day harvest and the day it earned the ribbon', () => {
    const w = new World();
    // Day 1: harvest 2 wheat.
    recordHarvest(w.player, 'wheat', 'normal', 1, { season: 0, day: 1 });
    recordHarvest(w.player, 'wheat', 'normal', 1, { season: 0, day: 1 });
    // Day 2: harvest 3 wheat — should overtake the ribbon.
    recordHarvest(w.player, 'wheat', 'silver', 3, { season: 0, day: 2 });
    recordHarvest(w.player, 'wheat', 'silver', 3, { season: 0, day: 2 });
    recordHarvest(w.player, 'wheat', 'silver', 3, { season: 0, day: 2 });
    // Day 3: harvest only 1.
    recordHarvest(w.player, 'wheat', 'gold', 4, { season: 0, day: 3 });
    const row = getJournal(w.player).wheat;
    expect(row.bestDayHarvest).toBe(3);
    expect(row.ribbonSeason).toBe(0);
    expect(row.ribbonDay).toBe(2);
  });

  it('per-crop ribbons are independent', () => {
    const w = new World();
    recordHarvest(w.player, 'wheat', 'normal', 0, { season: 1, day: 4 });
    recordHarvest(w.player, 'pumpkin', 'gold', 5, { season: 2, day: 7 });
    recordHarvest(w.player, 'pumpkin', 'gold', 5, { season: 2, day: 7 });
    const j = getJournal(w.player);
    expect(j.wheat.bestDayHarvest).toBe(1);
    expect(j.pumpkin.bestDayHarvest).toBe(2);
    expect(j.pumpkin.ribbonDay).toBe(7);
  });

  it('a harvest without a time arg leaves the ribbon untouched', () => {
    const w = new World();
    recordHarvest(w.player, 'wheat', 'normal', 0);
    const row = getJournal(w.player).wheat;
    expect(row.bestDayHarvest).toBeUndefined();
    expect(row.ribbonSeason).toBeUndefined();
  });

  it('buildJournal surfaces ribbonCount + ribbonWhen', () => {
    const w = new World();
    recordHarvest(w.player, 'tomato', 'normal', 1, { season: 1, day: 5 });
    recordHarvest(w.player, 'tomato', 'normal', 1, { season: 1, day: 5 });
    const rows = buildJournal(w.player);
    const tomato = rows.find((r) => r.key === 'tomato')!;
    expect(tomato.ribbonCount).toBe(2);
    expect(tomato.ribbonWhen).toBe('Summer d5');
    const flower = rows.find((r) => r.key === 'flower')!;
    expect(flower.ribbonCount).toBe(0);
    expect(flower.ribbonWhen).toBeUndefined();
  });

  it('the ribbon round-trips through persistence', () => {
    const a = fakeGame();
    recordHarvest(a.world.player, 'wheat', 'gold', 7, { season: 2, day: 4 });
    recordHarvest(a.world.player, 'wheat', 'gold', 7, { season: 2, day: 4 });
    const snap = serializeGame(a);
    const b = fakeGame();
    applySnapshot(b, snap);
    const restored = getJournal(b.world.player).wheat;
    expect(restored.bestDayHarvest).toBe(2);
    expect(restored.ribbonSeason).toBe(2);
    expect(restored.ribbonDay).toBe(4);
  });

  it('a new day resets todayHarvest so the ribbon counts a single day only', () => {
    const w = new World();
    recordHarvest(w.player, 'wheat', 'normal', 0, { season: 0, day: 1 });
    recordHarvest(w.player, 'wheat', 'normal', 0, { season: 0, day: 1 });
    // Tomorrow — only one harvest. Ribbon stays at 2 from yesterday.
    recordHarvest(w.player, 'wheat', 'normal', 0, { season: 0, day: 2 });
    const row = getJournal(w.player).wheat;
    expect(row.bestDayHarvest).toBe(2);
    expect(row.ribbonDay).toBe(1);
    expect(row.todayHarvest).toBe(1);
  });
});

describe('harvest mini-bar', () => {
  // Minimal CropJournalEntry factory — only the harvest tiers matter here.
  const mkEntry = (normal: number, silver: number, gold: number) =>
    ({
      key: 'wheat',
      name: 'Wheat',
      seedPrice: 2,
      sellPrice: 8,
      growthDays: 4,
      bestSeason: 'Spring',
      sown: 0,
      normal,
      silver,
      gold,
      bestStreak: 0,
      ribbonCount: 0,
    });

  it('finds the busiest crop total across the journal', () => {
    const entries = [mkEntry(3, 1, 0), mkEntry(10, 2, 1), mkEntry(0, 0, 0)];
    // Second crop: 10 + 2 + 1 = 13 is the max.
    expect(maxLifetimeHarvest(entries)).toBe(13);
    expect(maxLifetimeHarvest([])).toBe(0);
  });

  it('returns all-zero widths when nothing is harvested or on a fresh save', () => {
    expect(harvestBarSegments(mkEntry(0, 0, 0), 0, 84)).toEqual({ normal: 0, silver: 0, gold: 0, total: 0 });
    expect(harvestBarSegments(mkEntry(5, 0, 0), 0, 84)).toEqual({ normal: 0, silver: 0, gold: 0, total: 0 });
    expect(harvestBarSegments(mkEntry(5, 0, 0), 10, 0)).toEqual({ normal: 0, silver: 0, gold: 0, total: 0 });
  });

  it('fills the whole track for the busiest crop', () => {
    const segs = harvestBarSegments(mkEntry(40, 0, 0), 40, 84);
    expect(segs.total).toBe(84);
    expect(segs.normal).toBe(84);
    expect(segs.silver).toBe(0);
    expect(segs.gold).toBe(0);
  });

  it('scales a smaller crop proportionally on the shared denominator', () => {
    // Half the busiest crop -> about half the track.
    const segs = harvestBarSegments(mkEntry(20, 0, 0), 40, 84);
    expect(segs.total).toBe(42);
    expect(segs.normal).toBe(42);
  });

  it('splits the bar into tiers that always sum to the bar length', () => {
    const segs = harvestBarSegments(mkEntry(6, 3, 1), 10, 80);
    expect(segs.normal + segs.silver + segs.gold).toBe(segs.total);
    // Roughly 60/30/10 of the full 80px track.
    expect(segs.total).toBe(80);
    expect(segs.normal).toBeGreaterThan(segs.silver);
    expect(segs.silver).toBeGreaterThan(segs.gold);
  });

  it('never lets a non-zero tier vanish (lone gold star keeps a pixel)', () => {
    // One gold among a big normal pile — gold must still get >= 1px.
    const segs = harvestBarSegments(mkEntry(200, 0, 1), 201, 84);
    expect(segs.gold).toBeGreaterThanOrEqual(1);
    expect(segs.normal + segs.silver + segs.gold).toBe(segs.total);
  });
});

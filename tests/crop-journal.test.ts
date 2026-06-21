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

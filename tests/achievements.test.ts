// Achievements — catalog gating + earn tracking + panel controller + persistence.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  ACHIEVEMENTS,
  buildAchievements,
  earnedCount,
  getEarned,
  isEarned,
  tickAchievements,
} from '../src/game/achievements';
import { AchievementsPanel } from '../src/ui/achievements-panel';
import { recordSown, recordHarvest } from '../src/game/crop-journal';
import { recordCook } from '../src/game/cooking-history';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function fakeGame(): Game {
  const w = new World();
  return { world: w, time: new TimeOfDay(6) } as unknown as Game;
}

describe('achievements catalog', () => {
  it('every achievement has a name + hint + done copy', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.id).toBeTruthy();
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.hint.length).toBeGreaterThan(0);
      expect(a.done.length).toBeGreaterThan(0);
      expect(typeof a.check).toBe('function');
    }
  });
});

describe('tickAchievements', () => {
  it('grants first-steps after planting one seed', () => {
    const w = new World();
    const t = new TimeOfDay(6);
    let newly = tickAchievements(w.player, w, t);
    expect(newly).toEqual([]);
    recordSown(w.player, 'wheat');
    newly = tickAchievements(w.player, w, t);
    expect(newly).toContain('first-steps');
    expect(isEarned(w.player, 'first-steps')).toBe(true);
  });

  it('does not re-grant the same achievement', () => {
    const w = new World();
    const t = new TimeOfDay(6);
    recordSown(w.player, 'wheat');
    tickAchievements(w.player, w, t);
    const before = earnedCount(w.player);
    const newly = tickAchievements(w.player, w, t);
    expect(newly).toEqual([]);
    expect(earnedCount(w.player)).toBe(before);
  });

  it('grants wealthy at 1000g and rich at 5000g', () => {
    const w = new World();
    const t = new TimeOfDay(6);
    w.player.gold = 999;
    tickAchievements(w.player, w, t);
    expect(isEarned(w.player, 'wealthy')).toBe(false);
    w.player.gold = 1000;
    tickAchievements(w.player, w, t);
    expect(isEarned(w.player, 'wealthy')).toBe(true);
    expect(isEarned(w.player, 'rich')).toBe(false);
    w.player.gold = 5500;
    tickAchievements(w.player, w, t);
    expect(isEarned(w.player, 'rich')).toBe(true);
  });

  it('grants star-grower on the first gold harvest', () => {
    const w = new World();
    const t = new TimeOfDay(6);
    recordHarvest(w.player, 'wheat', 'silver', 3);
    tickAchievements(w.player, w, t);
    expect(isEarned(w.player, 'star-grower')).toBe(false);
    recordHarvest(w.player, 'wheat', 'gold', 4);
    tickAchievements(w.player, w, t);
    expect(isEarned(w.player, 'star-grower')).toBe(true);
  });

  it('grants pantry-cook at 10 dishes', () => {
    const w = new World();
    const t = new TimeOfDay(6);
    for (let i = 0; i < 9; i++) recordCook(w.player, 'hearty-stew');
    tickAchievements(w.player, w, t);
    expect(isEarned(w.player, 'pantry-cook')).toBe(false);
    recordCook(w.player, 'hearty-stew');
    tickAchievements(w.player, w, t);
    expect(isEarned(w.player, 'pantry-cook')).toBe(true);
  });
});

describe('buildAchievements', () => {
  it('returns a row per catalog entry with earn status', () => {
    const w = new World();
    const t = new TimeOfDay(6);
    recordSown(w.player, 'wheat');
    tickAchievements(w.player, w, t);
    const rows = buildAchievements(w.player);
    expect(rows.length).toBe(ACHIEVEMENTS.length);
    const fs = rows.find((r) => r.id === 'first-steps')!;
    expect(fs.earned).toBe(true);
    expect(fs.earnedDay).toBe(t.day);
    const wedding = rows.find((r) => r.id === 'wedding-bells')!;
    expect(wedding.earned).toBe(false);
    expect(wedding.earnedDay).toBeNull();
  });
});

describe('AchievementsPanel controller', () => {
  it('toggles open + close, scrolls', () => {
    const panel = new AchievementsPanel();
    const w = new World();
    expect(panel.isVisible()).toBe(false);
    panel.toggle();
    expect(panel.isVisible()).toBe(true);
    panel.scrollDown(w.player);
    panel.scrollDown(w.player);
    panel.scrollUp();
    panel.toggle();
    expect(panel.isVisible()).toBe(false);
  });

  it('respects lockout before canAct', () => {
    const panel = new AchievementsPanel();
    panel.open();
    expect(panel.canAct()).toBe(false);
    panel.update(200);
    expect(panel.canAct()).toBe(true);
  });
});

describe('achievements persistence', () => {
  it('earned badges survive a snapshot round-trip', () => {
    const a = fakeGame();
    a.world.player.gold = 5500;
    tickAchievements(a.world.player, a.world, a.time);
    expect(isEarned(a.world.player, 'wealthy')).toBe(true);
    const snap = serializeGame(a);
    const b = fakeGame();
    expect(getEarned(b.world.player).length).toBe(0);
    applySnapshot(b, snap);
    expect(isEarned(b.world.player, 'wealthy')).toBe(true);
    expect(isEarned(b.world.player, 'rich')).toBe(true);
  });
});

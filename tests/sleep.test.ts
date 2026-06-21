// Sleep — fast-forward + day summary.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import { startingQuests } from '../src/game/quests';
import { startingHearts, giveGift } from '../src/game/hearts';
import {
  sleep,
  isAtFarmhouse,
  harvestTotal,
  dishesTotal,
  snapshotPreSleep,
  MORNING_CUTOFF_HOUR,
} from '../src/game/sleep';
import { plant, water, advanceDay } from '../src/game/farming';

function freshWorld(): World {
  const w = new World();
  const p = w.player;
  p.inventory = { wheat: 5, tomato: 2, 'watering-can': 1 };
  p.gold = 100;
  p.quests = startingQuests();
  p.hearts = startingHearts();
  return w;
}

/** Move the player onto a tile adjacent to the farmhouse footprint. */
function standAtFarmhouse(w: World): void {
  const fh = w.buildings.find((b) => b.kind === 'farmhouse');
  if (!fh) throw new Error('no farmhouse');
  w.player.x = fh.x - 1;
  w.player.y = fh.y;
}

describe('sleep', () => {
  it('harvestTotal sums every _harvest key', () => {
    const w = freshWorld();
    w.player.inventory.wheat_harvest = 3;
    w.player.inventory.tomato_harvest = 2;
    expect(harvestTotal(w.player)).toBe(5);
  });

  it('dishesTotal sums every dish-* key', () => {
    const w = freshWorld();
    w.player.inventory['dish-hearty-stew'] = 1;
    w.player.inventory['dish-pumpkin-soup'] = 2;
    expect(dishesTotal(w.player)).toBe(3);
  });

  it('isAtFarmhouse is false at spawn, true after standAtFarmhouse', () => {
    const w = freshWorld();
    expect(isAtFarmhouse(w)).toBe(false);
    standAtFarmhouse(w);
    expect(isAtFarmhouse(w)).toBe(true);
  });

  it('sleep refuses when not at the farmhouse', () => {
    const w = freshWorld();
    const t = new TimeOfDay(20);
    const out = sleep(w, t);
    expect(out.kind).toBe('not-at-farmhouse');
  });

  it('sleep refuses when it is already morning', () => {
    const w = freshWorld();
    standAtFarmhouse(w);
    const t = new TimeOfDay(6); // before MORNING_CUTOFF_HOUR (7)
    const out = sleep(w, t);
    expect(out.kind).toBe('too-early');
    if (out.kind === 'too-early') expect(out.until).toBe(MORNING_CUTOFF_HOUR);
  });

  it('sleep advances the clock to DAY_START of the next day', () => {
    const w = freshWorld();
    standAtFarmhouse(w);
    const t = new TimeOfDay(22);
    const beforeDay = t.day;
    const out = sleep(w, t);
    expect(out.kind).toBe('slept');
    expect(t.day).toBe(beforeDay + 1);
    expect(t.hour).toBe(6); // DAY_START
    expect(t.minute).toBe(0);
  });

  it('sleep triggers per-day crop growth exactly once', () => {
    const w = freshWorld();
    expect(plant(w, 19, 22, 'wheat', w.player)).toBe(true);
    water(w, 19, 22);
    const before = (w.crops[0] as unknown as { stage: number }).stage;
    standAtFarmhouse(w);
    const t = new TimeOfDay(20);
    sleep(w, t);
    const after = (w.crops[0] as unknown as { stage: number }).stage;
    expect(after).toBe(before + 1);
  });

  it('summary reports gold + harvest deltas across the slept day', () => {
    const w = freshWorld();
    standAtFarmhouse(w);
    const t = new TimeOfDay(20);
    const goldBefore = w.player.gold;
    const out = sleep(w, t);
    if (out.kind !== 'slept') throw new Error('expected slept');
    expect(out.summary.prevDay).toBe(1);
    expect(out.summary.newDay).toBe(2);
    // Player did nothing → deltas are zero.
    expect(out.summary.goldDelta).toBe(0);
    expect(out.summary.harvestDelta).toBe(0);
    expect(w.player.gold).toBe(goldBefore);
  });

  it('snapshotPreSleep captures every NPC heart row', () => {
    const w = freshWorld();
    const t = new TimeOfDay(20);
    // Give Maple something nice before snapshotting.
    if (w.player.hearts) giveGift(w.player.hearts, 'maple', 'ruby', t.day);
    const snap = snapshotPreSleep(w.player, t);
    expect(Object.keys(snap.hearts).length).toBeGreaterThanOrEqual(4);
    expect(snap.hearts.maple).toBeGreaterThanOrEqual(0);
  });

  it('season rolls forward when sleeping past day 7', () => {
    const w = freshWorld();
    standAtFarmhouse(w);
    const t = new TimeOfDay(20);
    t.day = 7;
    t.season = 0;
    sleep(w, t);
    expect(t.day).toBe(1);
    expect(t.season).toBe(1);
  });

  it('back-to-back sleeps advance the day each time', () => {
    const w = freshWorld();
    standAtFarmhouse(w);
    const t = new TimeOfDay(20);
    sleep(w, t);
    // Advance back to evening so the next sleep is allowed.
    t.hour = 20;
    sleep(w, t);
    expect(t.day).toBe(3);
  });

  it('day-rollover keeps advanceDay alone from double-counting', () => {
    // Watered crops should grow exactly one stage per sleep, not two.
    const w = freshWorld();
    expect(plant(w, 19, 22, 'wheat', w.player)).toBe(true);
    water(w, 19, 22);
    advanceDay(w); // emulate a manual day flip first
    const after1 = (w.crops[0] as unknown as { stage: number }).stage;
    water(w, 19, 22);
    standAtFarmhouse(w);
    const t = new TimeOfDay(20);
    sleep(w, t);
    const after2 = (w.crops[0] as unknown as { stage: number }).stage;
    expect(after2).toBe(after1 + 1);
  });
});

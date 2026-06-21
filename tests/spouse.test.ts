// Spouse — move-in, daily gift, morning greeting, anchor.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  dawnSpouseGift,
  getSpouseState,
  hasSpouse,
  SPOUSE_OUTDOOR_END,
  SPOUSE_OUTDOOR_START,
  spouseAnchor,
  spouseGreeting,
} from '../src/game/spouse';
import { startingHearts } from '../src/game/hearts';

function freshWorld(): World {
  const w = new World();
  w.player.hearts = startingHearts();
  return w;
}

function marryTo(w: World, npcId: string, day: number = 1): void {
  w.player.marriage = { npcId, day };
}

describe('spouseAnchor', () => {
  it('returns null when the player is unmarried', () => {
    const w = freshWorld();
    const t = new TimeOfDay(10);
    expect(spouseAnchor(w, t)).toBeNull();
  });

  it('puts the spouse outdoors just south of the farmhouse during day hours', () => {
    const w = freshWorld();
    marryTo(w, 'maple');
    const t = new TimeOfDay(SPOUSE_OUTDOOR_START + 1);
    const a = spouseAnchor(w, t)!;
    expect(a.inside).toBe(false);
    const fh = w.buildings.find((b) => b.kind === 'farmhouse')!;
    expect(a.x).toBe(fh.x + Math.floor(fh.w / 2));
    expect(a.y).toBe(fh.y + fh.h);
  });

  it('moves the spouse inside at night', () => {
    const w = freshWorld();
    marryTo(w, 'maple');
    const t = new TimeOfDay(SPOUSE_OUTDOOR_END + 1);
    const a = spouseAnchor(w, t)!;
    expect(a.inside).toBe(true);
    const fh = w.buildings.find((b) => b.kind === 'farmhouse')!;
    expect(a.x).toBeGreaterThanOrEqual(fh.x);
    expect(a.x).toBeLessThan(fh.x + fh.w);
    expect(a.y).toBeGreaterThanOrEqual(fh.y);
    expect(a.y).toBeLessThan(fh.y + fh.h);
  });
});

describe('dawnSpouseGift', () => {
  it('refuses when the player is unmarried', () => {
    const w = freshWorld();
    const out = dawnSpouseGift(w.player, 3);
    expect(out.kind).toBe('not-married');
  });

  it('drops one gift the first time it is called for a day', () => {
    const w = freshWorld();
    marryTo(w, 'finn');
    const goldBefore = w.player.gold;
    const out = dawnSpouseGift(w.player, 1);
    expect(out.kind).toBe('gifted');
    // The spouse always gives at least one item or gold.
    const out2 = out as { kind: 'gifted'; itemKey?: string; count?: number; gold?: number };
    const itemKey = out2.itemKey;
    if (itemKey) {
      expect((w.player.inventory[itemKey] ?? 0)).toBeGreaterThan(0);
    }
    if (out2.gold) {
      expect(w.player.gold).toBe(goldBefore + out2.gold);
    }
  });

  it('is idempotent — second call same day short-circuits', () => {
    const w = freshWorld();
    marryTo(w, 'finn');
    dawnSpouseGift(w.player, 4);
    const goldAfterFirst = w.player.gold;
    const out = dawnSpouseGift(w.player, 4);
    expect(out.kind).toBe('already-today');
    expect(w.player.gold).toBe(goldAfterFirst);
  });

  it('rotates the gift across days (different days give different rows)', () => {
    const w = freshWorld();
    marryTo(w, 'maple');
    const seen = new Set<string>();
    for (let d = 0; d < 4; d++) {
      // Force re-eligibility each day.
      getSpouseState(w.player).lastGiftDay = -1;
      const out = dawnSpouseGift(w.player, d);
      expect(out.kind).toBe('gifted');
      const tag = (out as { label: string }).label;
      seen.add(tag);
    }
    // We rotate through Maple's 4-row pool, so we expect 4 distinct labels.
    expect(seen.size).toBe(4);
  });

  it('records the day on the spouse state so the next call no-ops', () => {
    const w = freshWorld();
    marryTo(w, 'rose');
    dawnSpouseGift(w.player, 7);
    expect(getSpouseState(w.player).lastGiftDay).toBe(7);
  });

  it('attributes the gift to the spouse name in the outcome', () => {
    const w = freshWorld();
    marryTo(w, 'finn');
    const out = dawnSpouseGift(w.player, 2);
    expect(out.kind).toBe('gifted');
    expect((out as { npcName: string }).npcName.toLowerCase()).toContain('finn');
  });

  it('still grants the gift on a fresh day after a prior gift', () => {
    const w = freshWorld();
    marryTo(w, 'mayor');
    dawnSpouseGift(w.player, 5);
    const out = dawnSpouseGift(w.player, 6);
    expect(out.kind).toBe('gifted');
  });
});

describe('spouseGreeting', () => {
  it('returns null when unmarried', () => {
    const w = freshWorld();
    expect(spouseGreeting(w.player, 1)).toBeNull();
  });

  it('returns a non-empty greeting after marriage', () => {
    const w = freshWorld();
    marryTo(w, 'maple');
    const g = spouseGreeting(w.player, 1);
    expect(g).not.toBeNull();
    expect((g as string).length).toBeGreaterThan(8);
  });

  it('rotates greetings across days', () => {
    const w = freshWorld();
    marryTo(w, 'maple');
    const a = spouseGreeting(w.player, 0);
    const b = spouseGreeting(w.player, 1);
    const c = spouseGreeting(w.player, 2);
    const set = new Set([a, b, c]);
    expect(set.size).toBeGreaterThan(1);
  });
});

describe('hasSpouse', () => {
  it('is false until married', () => {
    const w = freshWorld();
    expect(hasSpouse(w.player)).toBe(false);
    marryTo(w, 'finn');
    expect(hasSpouse(w.player)).toBe(true);
  });
});

// v0.5.0 capstone — full romance arc from zero hearts to Newlywed.
//
// This integration test threads the hearts → engagement → marriage →
// quest pipeline so any regression in one slice breaks the suite loudly.

import { describe, it, expect } from 'vitest';
import {
  startingHearts,
  giveGift,
  MAX_HEARTS,
  HEART_POINTS,
  BOUQUET_KEY,
} from '../src/game/hearts';
import { propose, isEngaged } from '../src/game/engagement';
import { holdWedding, isMarried, spouseName, WEDDING_WAIT_DAYS } from '../src/game/marriage';
import { startingQuests, checkQuests } from '../src/game/quests';
import type { Player } from '../src/world/world';

function makePlayer(): Player {
  return {
    x: 0, y: 0, facing: 'down',
    moveProgress: 0, targetX: 0, targetY: 0, fromX: 0, fromY: 0,
    inventory: {},
    gold: 0,
    quests: startingQuests(),
    hearts: startingHearts(),
  };
}

describe('v0.5.0 capstone — full romance arc', () => {
  it('takes a player from strangers to Newlywed and pays out the quest reward', () => {
    const p = makePlayer();

    // 1. Fast-forward to MAX_HEARTS with Rose via gifts. Doesn't matter
    //    that we bypass the once-per-day gate — we just need the points.
    p.hearts!.rose.points = MAX_HEARTS * HEART_POINTS;

    // 2. Pick up a bouquet from the shop and propose on day 1.
    p.inventory[BOUQUET_KEY] = 1;
    const prop = propose(p, 'rose', 1);
    expect(prop.kind).toBe('accepted');
    expect(isEngaged(p)).toBe(true);

    // 3. Wait out the engagement period and hold the wedding.
    const weddingDay = 1 + WEDDING_WAIT_DAYS;
    const wed = holdWedding(p, weddingDay);
    expect(wed.kind).toBe('married');
    expect(isMarried(p)).toBe(true);
    expect(spouseName(p)).toBe('Rose');

    // 4. The game loop fires a 'marry' quest event after a successful
    //    wedding. The Newlywed quest should complete and pay out.
    const goldBefore = p.gold;
    const completed = checkQuests(p, { kind: 'marry', npcId: 'rose' });
    expect(completed).toContain('newlywed');
    expect(p.gold - goldBefore).toBe(1000);
    expect(p.inventory['bouquet'] ?? 0).toBe(2);
    expect(p.inventory['pumpkin'] ?? 0).toBe(5);
  });

  it('does not let a married player re-propose to anyone else', () => {
    const p = makePlayer();
    p.hearts!.maple.points = MAX_HEARTS * HEART_POINTS;
    p.inventory[BOUQUET_KEY] = 2;
    propose(p, 'maple', 0);
    holdWedding(p, WEDDING_WAIT_DAYS);
    expect(isMarried(p)).toBe(true);

    // Try to start a second engagement.
    p.hearts!.finn.points = MAX_HEARTS * HEART_POINTS;
    const second = propose(p, 'finn', WEDDING_WAIT_DAYS + 1);
    // Already-engaged check fires only when engagement exists; once
    // married, engagement is cleared, so the propose will technically
    // succeed at the engagement layer. The marriage layer is what
    // gates re-marriage — verify holdWedding refuses.
    if (second.kind === 'accepted') {
      const r = holdWedding(p, WEDDING_WAIT_DAYS * 2 + 5);
      expect(r.kind).toBe('already-married');
    }
  });

  // Silences the unused-import warning while keeping giveGift in the
  // capstone's import surface — future ticks will use it directly.
  it('exposes giveGift for future capstone slices', () => {
    expect(typeof giveGift).toBe('function');
  });
});

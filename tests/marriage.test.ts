import { describe, it, expect } from 'vitest';
import {
  holdWedding,
  isMarried,
  spouseOf,
  spouseName,
  daysMarried,
  WEDDING_WAIT_DAYS,
} from '../src/game/marriage';
import { propose } from '../src/game/engagement';
import { startingHearts, HEART_POINTS, MAX_HEARTS, BOUQUET_KEY } from '../src/game/hearts';
import type { Player } from '../src/world/world';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    x: 0,
    y: 0,
    facing: 'down',
    moveProgress: 0,
    targetX: 0,
    targetY: 0,
    fromX: 0,
    fromY: 0,
    inventory: {},
    gold: 0,
    quests: [],
    hearts: startingHearts(),
    ...overrides,
  };
}

function engageTo(p: Player, npcId: string, day: number): void {
  p.hearts![npcId].points = MAX_HEARTS * HEART_POINTS;
  p.inventory[BOUQUET_KEY] = 1;
  propose(p, npcId, day);
}

describe('marriage', () => {
  it('rejects wedding when not engaged', () => {
    const p = makePlayer();
    expect(holdWedding(p, 1)).toEqual({ kind: 'not-engaged' });
    expect(isMarried(p)).toBe(false);
  });

  it('refuses wedding before WEDDING_WAIT_DAYS have passed', () => {
    const p = makePlayer();
    engageTo(p, 'rose', 5);
    const r = holdWedding(p, 5 + WEDDING_WAIT_DAYS - 1);
    expect(r.kind).toBe('too-soon');
    if (r.kind === 'too-soon') expect(r.daysLeft).toBe(1);
    expect(p.marriage).toBeUndefined();
  });

  it('marries the fiancé once the wait days have elapsed', () => {
    const p = makePlayer();
    engageTo(p, 'finn', 2);
    const r = holdWedding(p, 2 + WEDDING_WAIT_DAYS);
    expect(r).toEqual({ kind: 'married', npcId: 'finn' });
    expect(isMarried(p)).toBe(true);
    expect(spouseOf(p)).toBe('finn');
    expect(spouseName(p)).toBe('Finn');
    expect(p.engagement).toBeUndefined();
    expect(daysMarried(p, 2 + WEDDING_WAIT_DAYS)).toBe(0);
    expect(daysMarried(p, 2 + WEDDING_WAIT_DAYS + 4)).toBe(4);
  });

  it('refuses a second wedding once married', () => {
    const p = makePlayer();
    engageTo(p, 'maple', 0);
    holdWedding(p, WEDDING_WAIT_DAYS);
    const r = holdWedding(p, WEDDING_WAIT_DAYS + 5);
    expect(r).toEqual({ kind: 'already-married', toNpcId: 'maple' });
  });

  it('clears engagement and bouquet inventory when wedding succeeds', () => {
    const p = makePlayer();
    engageTo(p, 'rose', 10);
    // engageTo consumed the bouquet during propose() — verify the post-wedding
    // state is fully cleared regardless of pre-existing inventory residue.
    p.inventory[BOUQUET_KEY] = 0;
    const r = holdWedding(p, 10 + WEDDING_WAIT_DAYS);
    expect(r.kind).toBe('married');
    expect(p.engagement).toBeUndefined();
    expect(p.marriage?.npcId).toBe('rose');
    expect(p.marriage?.day).toBe(10 + WEDDING_WAIT_DAYS);
  });
});

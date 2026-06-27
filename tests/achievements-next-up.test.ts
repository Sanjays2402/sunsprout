// Achievements panel next-up digest — names the next locked badge + tally.

import { describe, it, expect } from 'vitest';
import {
  achievementsNextUp,
  achievementsNextUpLine,
  type AchievementRow,
} from '../src/game/achievements';

/** A synthetic row at a given earn state. */
function rowAt(name: string, earned: boolean): AchievementRow {
  return {
    id: name as AchievementRow['id'],
    name,
    description: earned ? 'done' : 'hint',
    earned,
    earnedDay: earned ? 3 : null,
  };
}

describe('achievementsNextUp', () => {
  it('returns an empty digest for an empty catalog', () => {
    const n = achievementsNextUp([]);
    expect(n).toEqual({ earned: 0, total: 0, remaining: 0, nextName: null });
    expect(achievementsNextUpLine(n)).toBe('');
  });

  it('counts earned + remaining and names the next locked badge', () => {
    const n = achievementsNextUp([
      rowAt('First Steps', true),
      rowAt('Green Thumb', true),
      rowAt('Star Grower', false),
      rowAt('Wealthy', false),
    ]);
    expect(n.earned).toBe(2);
    expect(n.total).toBe(4);
    expect(n.remaining).toBe(2);
    expect(n.nextName).toBe('Star Grower');
  });

  it('picks the FIRST locked badge in display order, not just any', () => {
    // An earned badge sits between two locked ones — the earlier locked
    // one is still the next target.
    const n = achievementsNextUp([
      rowAt('A', false),
      rowAt('B', true),
      rowAt('C', false),
    ]);
    expect(n.nextName).toBe('A');
  });

  it('reports nextName null once every badge is earned', () => {
    const n = achievementsNextUp([rowAt('A', true), rowAt('B', true)]);
    expect(n.nextName).toBeNull();
    expect(n.remaining).toBe(0);
    expect(n.earned).toBe(2);
  });
});

describe('achievementsNextUpLine', () => {
  it('renders the tally + next target', () => {
    const line = achievementsNextUpLine({
      earned: 7,
      total: 26,
      remaining: 19,
      nextName: 'Star Grower',
    });
    expect(line).toBe('7 earned, 19 to go - next: Star Grower');
  });

  it('drops the next clause when everything is earned', () => {
    const line = achievementsNextUpLine({
      earned: 26,
      total: 26,
      remaining: 0,
      nextName: null,
    });
    expect(line).toBe('26 earned - all done!');
  });

  it('stays ASCII (no emoji in app chrome)', () => {
    const line = achievementsNextUpLine({
      earned: 1,
      total: 26,
      remaining: 25,
      nextName: 'Green Thumb',
    });
    expect(/^[\x20-\x7E]*$/.test(line)).toBe(true);
  });
});

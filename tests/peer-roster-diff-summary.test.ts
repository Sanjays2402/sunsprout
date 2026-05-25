import { describe, it, expect } from 'vitest';
import { summarizeRosterDiff } from '../src/game/peer-roster-diff-summary';
import type { RosterDiff } from '../src/game/peer-roster-diff';

const empty: RosterDiff = { arrived: [], departed: [], wentLive: [], wentStale: [] };

describe('summarizeRosterDiff', () => {
  it('returns empty string for empty diff', () => {
    expect(summarizeRosterDiff(empty)).toBe('');
  });

  it('formats arrived only', () => {
    expect(summarizeRosterDiff({ ...empty, arrived: ['a', 'b'] })).toBe('+2 joined');
  });

  it('formats all four buckets in stable order', () => {
    expect(
      summarizeRosterDiff({
        arrived: ['a'],
        wentLive: ['b', 'c'],
        wentStale: ['d'],
        departed: ['e', 'f', 'g'],
      }),
    ).toBe('+1 joined · 2 back · 1 quiet · 3 left');
  });

  it('skips empty buckets', () => {
    expect(
      summarizeRosterDiff({ ...empty, arrived: ['a'], departed: ['b'] }),
    ).toBe('+1 joined · 1 left');
  });
});

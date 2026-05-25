import { describe, it, expect } from 'vitest';
import { rosterDiffToToasts } from '../src/game/peer-roster-diff-toasts';
import type { RosterDiff } from '../src/game/peer-roster-diff';

const lookup = (m: Record<string, string>) => (id: string) => m[id];

describe('peer-roster-diff-toasts', () => {
  it('formats all four kinds in stable order', () => {
    const diff: RosterDiff = {
      arrived: ['a'],
      departed: ['d'],
      wentLive: ['b'],
      wentStale: ['c'],
    };
    const toasts = rosterDiffToToasts(
      diff,
      lookup({ a: 'Ada', b: 'Bea', c: 'Cleo', d: 'Dora' }),
    );
    expect(toasts.map((t) => t.text)).toEqual([
      'Ada joined',
      'Bea is back',
      'Cleo went quiet',
      'Dora left',
    ]);
    expect(toasts.map((t) => t.kind)).toEqual([
      'arrived',
      'wentLive',
      'wentStale',
      'departed',
    ]);
  });

  it('falls back to a short id slice for unknown peers', () => {
    const diff: RosterDiff = {
      arrived: ['abcdef1234'],
      departed: [],
      wentLive: [],
      wentStale: [],
    };
    const toasts = rosterDiffToToasts(diff, () => undefined);
    expect(toasts[0].text).toBe('abcdef joined');
  });

  it('returns empty array for an empty diff', () => {
    const toasts = rosterDiffToToasts(
      { arrived: [], departed: [], wentLive: [], wentStale: [] },
      () => 'x',
    );
    expect(toasts).toEqual([]);
  });
});

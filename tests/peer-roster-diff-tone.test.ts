import { describe, it, expect } from 'vitest';
import { rosterDiffTone } from '../src/game/peer-roster-diff-tone';
import type { RosterDiff } from '../src/game/peer-roster-diff';

const empty: RosterDiff = { arrived: [], departed: [], wentLive: [], wentStale: [] };

describe('rosterDiffTone', () => {
  it('returns none for empty diff', () => {
    expect(rosterDiffTone(empty)).toBe('none');
  });

  it('classifies pure arrivals', () => {
    expect(rosterDiffTone({ ...empty, arrived: ['a'] })).toBe('arrivals');
    expect(rosterDiffTone({ ...empty, wentLive: ['b'] })).toBe('arrivals');
  });

  it('classifies pure departures', () => {
    expect(rosterDiffTone({ ...empty, departed: ['a'] })).toBe('departures');
    expect(rosterDiffTone({ ...empty, wentStale: ['b'] })).toBe('departures');
  });

  it('classifies mixed deltas as churn', () => {
    expect(
      rosterDiffTone({ arrived: ['a'], departed: ['b'], wentLive: [], wentStale: [] }),
    ).toBe('churn');
    expect(
      rosterDiffTone({ arrived: [], departed: [], wentLive: ['a'], wentStale: ['b'] }),
    ).toBe('churn');
  });
});

import { describe, it, expect } from 'vitest';
import {
  summarizeRoster,
  formatRosterSummary,
} from '../src/game/peer-roster-summary';
import type { RosterEntry } from '../src/game/peer-roster';

function entry(over: Partial<RosterEntry>): RosterEntry {
  return {
    id: 'p',
    name: 'Peer',
    color: '#fff',
    distance: 0,
    live: true,
    ...over,
  };
}

describe('peer-roster-summary', () => {
  it('counts live + stale and picks nearest live distance', () => {
    const s = summarizeRoster([
      entry({ id: 'a', distance: 5, live: true }),
      entry({ id: 'b', distance: 2, live: true }),
      entry({ id: 'c', distance: 1, live: false }),
    ]);
    expect(s).toEqual({ liveCount: 2, staleCount: 1, nearestDistance: 2 });
  });

  it('returns null nearest when no live peers', () => {
    const s = summarizeRoster([entry({ distance: 3, live: false })]);
    expect(s.nearestDistance).toBeNull();
    expect(s.liveCount).toBe(0);
    expect(s.staleCount).toBe(1);
  });

  it('handles empty input', () => {
    const s = summarizeRoster([]);
    expect(s).toEqual({ liveCount: 0, staleCount: 0, nearestDistance: null });
    expect(formatRosterSummary(s)).toBe('');
  });

  it('formats a friendly HUD subtitle', () => {
    expect(
      formatRosterSummary({ liveCount: 3, staleCount: 0, nearestDistance: 2 }),
    ).toBe('3 nearby · nearest 2t');
    expect(
      formatRosterSummary({ liveCount: 1, staleCount: 2, nearestDistance: 0 }),
    ).toBe('1 nearby · 2 stale · nearest here');
    expect(
      formatRosterSummary({ liveCount: 0, staleCount: 2, nearestDistance: null }),
    ).toBe('2 stale');
  });
});

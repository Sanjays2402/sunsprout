import { describe, it, expect } from 'vitest';
import { rosterTone } from '../src/game/peer-roster-tone';

describe('peer-roster-tone', () => {
  it('returns solo for empty rooms', () => {
    expect(rosterTone({ liveCount: 0, staleCount: 0, nearestDistance: null })).toBe(
      'solo',
    );
  });

  it('returns stale-only when only ghost peers linger', () => {
    expect(rosterTone({ liveCount: 0, staleCount: 2, nearestDistance: null })).toBe(
      'stale-only',
    );
  });

  it('returns calm for 1-2 live peers', () => {
    expect(rosterTone({ liveCount: 1, staleCount: 0, nearestDistance: 4 })).toBe('calm');
    expect(rosterTone({ liveCount: 2, staleCount: 1, nearestDistance: 1 })).toBe('calm');
  });

  it('returns busy for 3+ live peers', () => {
    expect(rosterTone({ liveCount: 3, staleCount: 0, nearestDistance: 0 })).toBe('busy');
    expect(rosterTone({ liveCount: 7, staleCount: 0, nearestDistance: 2 })).toBe('busy');
  });
});

import { describe, it, expect } from 'vitest';
import { diffRoster, rosterDiffIsEmpty } from '../src/game/peer-roster-diff';
import type { RosterEntry } from '../src/game/peer-roster';

const e = (id: string, live: boolean): RosterEntry => ({
  id,
  name: id,
  color: '#fff',
  distance: 1,
  live,
});

describe('peer-roster-diff', () => {
  it('reports arrivals and departures', () => {
    const prev = [e('a', true), e('b', true)];
    const next = [e('b', true), e('c', true)];
    const d = diffRoster(prev, next);
    expect(d.arrived).toEqual(['c']);
    expect(d.departed).toEqual(['a']);
    expect(d.wentLive).toEqual([]);
    expect(d.wentStale).toEqual([]);
  });

  it('detects liveness flips', () => {
    const prev = [e('a', true), e('b', false)];
    const next = [e('a', false), e('b', true)];
    const d = diffRoster(prev, next);
    expect(d.wentStale).toEqual(['a']);
    expect(d.wentLive).toEqual(['b']);
  });

  it('rosterDiffIsEmpty true for identical snapshots', () => {
    const snap = [e('a', true), e('b', false)];
    expect(rosterDiffIsEmpty(diffRoster(snap, snap))).toBe(true);
  });

  it('returns deterministically sorted ids', () => {
    const prev: RosterEntry[] = [];
    const next = [e('zeta', true), e('alpha', true), e('mu', true)];
    const d = diffRoster(prev, next);
    expect(d.arrived).toEqual(['alpha', 'mu', 'zeta']);
  });
});

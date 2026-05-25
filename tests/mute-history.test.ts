import { describe, it, expect } from 'vitest';
import { MuteHistory } from '../src/game/mute-history';

describe('MuteHistory', () => {
  it('rejects empty / local-only snapshots', () => {
    const h = new MuteHistory();
    expect(h.push([])).toBe(false);
    expect(h.push(['', '  ', 'local'])).toBe(false);
    expect(h.size()).toBe(0);
    expect(h.peek()).toBeNull();
  });

  it('sanitises, dedupes, and sorts pushed ids', () => {
    const h = new MuteHistory();
    expect(h.push(['  bob ', 'alice', 'bob', 'local', ''])).toBe(true);
    expect(h.peek()).toEqual(['alice', 'bob']);
  });

  it('pop removes the snapshot; peek returns a defensive copy', () => {
    const h = new MuteHistory();
    h.push(['alice']);
    h.push(['bob', 'carol']);
    const peeked = h.peek()!;
    peeked.push('mutated');
    expect(h.peek()).toEqual(['bob', 'carol']);
    expect(h.pop()).toEqual(['bob', 'carol']);
    expect(h.pop()).toEqual(['alice']);
    expect(h.pop()).toBeNull();
  });

  it('enforces bounded depth by dropping oldest', () => {
    const h = new MuteHistory(2);
    h.push(['a']);
    h.push(['b']);
    h.push(['c']);
    expect(h.size()).toBe(2);
    expect(h.pop()).toEqual(['c']);
    expect(h.pop()).toEqual(['b']);
    expect(h.pop()).toBeNull();
  });

  it('skips duplicate consecutive snapshots so spam-pushes do not fill the ring', () => {
    const h = new MuteHistory();
    expect(h.push(['alice', 'bob'])).toBe(true);
    // identical contents (even in a different input order) should be rejected
    expect(h.push(['bob', 'alice'])).toBe(false);
    expect(h.push(['  alice ', 'bob'])).toBe(false);
    expect(h.size()).toBe(1);
    // a genuinely different snapshot still pushes
    expect(h.push(['alice'])).toBe(true);
    expect(h.size()).toBe(2);
    // and the prior contents can be pushed again now that the top differs
    expect(h.push(['alice', 'bob'])).toBe(true);
    expect(h.size()).toBe(3);
  });

  it('prune drops a peer id from all snapshots and removes any that empty out', () => {
    const h = new MuteHistory();
    h.push(['alice', 'bob']);
    h.push(['bob']);
    h.push(['carol', 'bob']);
    expect(h.prune('bob')).toBe(3);
    expect(h.size()).toBe(2);
    expect(h.pop()).toEqual(['carol']);
    expect(h.pop()).toEqual(['alice']);
    // ignores blanks / local / unknown ids
    h.push(['dave']);
    expect(h.prune('')).toBe(0);
    expect(h.prune('local')).toBe(0);
    expect(h.prune('ghost')).toBe(0);
    expect(h.size()).toBe(1);
  });

  it('has() reports whether a peer id appears in any stored snapshot', () => {
    const h = new MuteHistory();
    expect(h.has('alice')).toBe(false);
    h.push(['alice', 'bob']);
    h.push(['carol']);
    expect(h.has('alice')).toBe(true);
    expect(h.has('  bob ')).toBe(true);
    expect(h.has('carol')).toBe(true);
    expect(h.has('dave')).toBe(false);
    // blanks / local / non-strings never match
    expect(h.has('')).toBe(false);
    expect(h.has('local')).toBe(false);
    expect(h.has(undefined as unknown as string)).toBe(false);
    // prune removes from has() too
    h.prune('alice');
    expect(h.has('alice')).toBe(false);
    expect(h.has('bob')).toBe(true);
  });

  it('allIds returns the sorted union of every stored snapshot', () => {
    const h = new MuteHistory();
    expect(h.allIds()).toEqual([]);
    h.push(['bob', 'alice']);
    h.push(['carol']);
    h.push(['alice', 'dave']);
    expect(h.allIds()).toEqual(['alice', 'bob', 'carol', 'dave']);
    h.prune('alice');
    expect(h.allIds()).toEqual(['bob', 'carol', 'dave']);
    const a = h.allIds();
    a.push('mutated');
    expect(h.allIds()).toEqual(['bob', 'carol', 'dave']);
  });
});

import { describe, expect, it } from 'vitest';
import { LastChatter } from '../src/game/last-chatter';

describe('LastChatter', () => {
  it('returns null before any notes', () => {
    const lc = new LastChatter();
    expect(lc.get(1000)).toBeNull();
  });

  it('records the most recent peer', () => {
    const lc = new LastChatter();
    expect(lc.note('peer-a', 1000)).toBe(true);
    expect(lc.get(1500)?.id).toBe('peer-a');
    expect(lc.note('peer-b', 2000)).toBe(true);
    expect(lc.get(2100)?.id).toBe('peer-b');
  });

  it('rejects empty, whitespace, and local ids', () => {
    const lc = new LastChatter();
    expect(lc.note('', 1)).toBe(false);
    expect(lc.note('   ', 1)).toBe(false);
    expect(lc.note('local', 1)).toBe(false);
    expect(lc.get(1)).toBeNull();
  });

  it('trims ids before storing', () => {
    const lc = new LastChatter();
    lc.note('  peer-x  ', 1);
    expect(lc.get(1)?.id).toBe('peer-x');
  });

  it('expires entries past the ttl', () => {
    const lc = new LastChatter(500);
    lc.note('peer-a', 1000);
    expect(lc.get(1400)?.id).toBe('peer-a');
    expect(lc.get(1600)).toBeNull();
  });

  it('clear forgets the entry', () => {
    const lc = new LastChatter();
    lc.note('peer-a', 1);
    lc.clear();
    expect(lc.get(2)).toBeNull();
  });

  it('falls back to default ttl when given a non-positive value', () => {
    const lc = new LastChatter(0);
    expect(lc.ttlMs).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import { MuteToasts } from '../src/ui/mute-toast';

describe('MuteToasts', () => {
  it('ignores null-id results', () => {
    const t = new MuteToasts();
    t.push({ id: null, muted: false }, 0);
    t.push({ id: '   ', muted: true }, 0);
    expect(t.size(0)).toBe(0);
  });

  it('queues a muted/unmuted toast with the right text', () => {
    const t = new MuteToasts();
    t.push({ id: 'alice', muted: true }, 100);
    t.push({ id: 'bob', muted: false }, 100);
    expect(t.list(100)).toEqual(['muted alice', 'unmuted bob']);
  });

  it('expires toasts after TTL', () => {
    const t = new MuteToasts();
    t.push({ id: 'alice', muted: true }, 0);
    expect(t.size(0)).toBe(1);
    expect(t.size(5000)).toBe(0);
  });

  it('caps queue at MAX_VISIBLE evicting oldest', () => {
    const t = new MuteToasts();
    t.push({ id: 'a', muted: true }, 0);
    t.push({ id: 'b', muted: true }, 0);
    t.push({ id: 'c', muted: true }, 0);
    t.push({ id: 'd', muted: true }, 0);
    expect(t.list(0)).toEqual(['muted b', 'muted c', 'muted d']);
  });

  it('clear() empties the queue', () => {
    const t = new MuteToasts();
    t.push({ id: 'alice', muted: true }, 0);
    t.clear();
    expect(t.size(0)).toBe(0);
  });
});

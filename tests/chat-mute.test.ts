import { describe, expect, it } from 'vitest';
import { ChatMuteSet } from '../src/game/chat-mute';

describe('ChatMuteSet', () => {
  it('mutes and unmutes a peer id', () => {
    const m = new ChatMuteSet();
    expect(m.isMuted('peer-a')).toBe(false);
    expect(m.mute('peer-a')).toBe(true);
    expect(m.isMuted('peer-a')).toBe(true);
    expect(m.mute('peer-a')).toBe(false); // already muted
    expect(m.unmute('peer-a')).toBe(true);
    expect(m.isMuted('peer-a')).toBe(false);
    expect(m.unmute('peer-a')).toBe(false); // not present
  });

  it('toggle returns the new state', () => {
    const m = new ChatMuteSet();
    expect(m.toggle('p1')).toBe(true);
    expect(m.isMuted('p1')).toBe(true);
    expect(m.toggle('p1')).toBe(false);
    expect(m.isMuted('p1')).toBe(false);
  });

  it('ignores empty, whitespace, and local ids', () => {
    const m = new ChatMuteSet();
    expect(m.mute('')).toBe(false);
    expect(m.mute('   ')).toBe(false);
    expect(m.mute('local')).toBe(false);
    expect(m.isMuted('local')).toBe(false);
    expect(m.toggle('local')).toBe(false);
    expect(m.size()).toBe(0);
  });

  it('trims ids before storing', () => {
    const m = new ChatMuteSet();
    m.mute('  peer-x  ');
    expect(m.isMuted('peer-x')).toBe(true);
    expect(m.list()).toEqual(['peer-x']);
  });

  it('list is sorted and clear empties the set', () => {
    const m = new ChatMuteSet();
    m.mute('b');
    m.mute('a');
    m.mute('c');
    expect(m.list()).toEqual(['a', 'b', 'c']);
    expect(m.size()).toBe(3);
    m.clear();
    expect(m.size()).toBe(0);
    expect(m.list()).toEqual([]);
  });
});

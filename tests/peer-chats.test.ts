import { describe, expect, it } from 'vitest';
import { PeerChats } from '../src/game/peer-chats';

describe('PeerChats', () => {
  it('stores a chat bubble and returns it before TTL', () => {
    const chats = new PeerChats();
    const c = chats.push('p1', 'hello world', 1000);
    expect(c?.text).toBe('hello world');
    expect(chats.activeFor('p1', 2000)?.text).toBe('hello world');
    expect(chats.size(2000)).toBe(1);
  });

  it('returns undefined and prunes after TTL elapses', () => {
    const chats = new PeerChats();
    chats.push('p1', 'hi', 1000);
    expect(chats.activeFor('p1', 100_000)).toBeUndefined();
    expect(chats.size(100_000)).toBe(0);
  });

  it('replaces an existing bubble for the same peer (latest wins)', () => {
    const chats = new PeerChats();
    chats.push('p1', 'first', 1000);
    chats.push('p1', 'second', 1500);
    expect(chats.activeFor('p1', 1600)?.text).toBe('second');
    expect(chats.size(1600)).toBe(1);
  });

  it('sanitises control chars and rejects empty input', () => {
    const chats = new PeerChats();
    expect(chats.push('p1', '   ', 1000)).toBeUndefined();
    expect(chats.push('p1', '\u0000\u0001no\u007Frm', 1000)?.text).toBe('no rm');
  });

  it('forget() drops a single peer', () => {
    const chats = new PeerChats();
    chats.push('p1', 'a', 1000);
    chats.push('p2', 'b', 1000);
    chats.forget('p1');
    expect(chats.activeFor('p1', 1100)).toBeUndefined();
    expect(chats.activeFor('p2', 1100)?.text).toBe('b');
  });
});

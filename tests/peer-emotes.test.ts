import { describe, expect, it } from 'vitest';
import { PeerEmotes, isEmoteKind } from '../src/game/peer-emotes';

describe('PeerEmotes', () => {
  it('stores and returns a peer emote within its TTL', () => {
    const e = new PeerEmotes();
    e.push('p1', 'wave', 1000);
    const active = e.activeFor('p1', 1500);
    expect(active?.kind).toBe('wave');
    expect(active?.peerId).toBe('p1');
  });

  it('expires emotes after the TTL window', () => {
    const e = new PeerEmotes();
    e.push('p1', 'heart', 0);
    expect(e.size(0)).toBe(1);
    expect(e.activeFor('p1', 5000)).toBeUndefined();
    expect(e.size(5000)).toBe(0);
  });

  it('replaces existing emote for the same peer (latest wins)', () => {
    const e = new PeerEmotes();
    e.push('p1', 'wave', 0);
    e.push('p1', 'sprout', 100);
    expect(e.activeFor('p1', 200)?.kind).toBe('sprout');
    expect(e.size(200)).toBe(1);
  });

  it('forget() drops a peer', () => {
    const e = new PeerEmotes();
    e.push('p1', 'note', 0);
    e.forget('p1');
    expect(e.activeFor('p1', 100)).toBeUndefined();
  });

  it('list() returns all live emotes', () => {
    const e = new PeerEmotes();
    e.push('p1', 'wave', 0);
    e.push('p2', 'heart', 50);
    expect(e.list(100)).toHaveLength(2);
  });

  it('ignores invalid emote kinds and empty ids', () => {
    const e = new PeerEmotes();
    // @ts-expect-error testing runtime guard
    e.push('p1', 'garbage', 0);
    e.push('', 'wave', 0);
    expect(e.size(0)).toBe(0);
  });

  it('isEmoteKind recognizes valid kinds', () => {
    expect(isEmoteKind('wave')).toBe(true);
    expect(isEmoteKind('nope')).toBe(false);
    expect(isEmoteKind(42)).toBe(false);
  });
});

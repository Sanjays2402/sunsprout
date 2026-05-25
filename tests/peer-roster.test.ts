import { describe, it, expect } from 'vitest';
import { buildPeerRoster, formatRosterDistance } from '../src/game/peer-roster';
import type { PeerPlayer } from '../src/game/multiplayer';

function peer(over: Partial<PeerPlayer>): PeerPlayer {
  return {
    id: 'p',
    name: 'Peer',
    x: 0,
    y: 0,
    facing: 'down',
    color: '#fff',
    hat: '#000',
    lastSeenAt: 0,
    ...over,
  };
}

describe('peer-roster', () => {
  it('sorts live peers before stale and by distance', () => {
    const now = 10_000;
    const peers: PeerPlayer[] = [
      peer({ id: 'far', name: 'Far', x: 20, y: 0, lastSeenAt: now }),
      peer({ id: 'stale', name: 'Stale', x: 1, y: 0, lastSeenAt: 0 }),
      peer({ id: 'near', name: 'Near', x: 2, y: 1, lastSeenAt: now }),
    ];
    const out = buildPeerRoster(peers, { localX: 0, localY: 0, now });
    expect(out.map((e) => e.id)).toEqual(['near', 'far', 'stale']);
    expect(out[0].distance).toBe(2);
    expect(out[0].live).toBe(true);
    expect(out[2].live).toBe(false);
  });

  it('breaks ties by name and respects limit', () => {
    const now = 10_000;
    const peers: PeerPlayer[] = [
      peer({ id: 'b', name: 'Bea', x: 1, y: 0, lastSeenAt: now }),
      peer({ id: 'a', name: 'Ada', x: 1, y: 0, lastSeenAt: now }),
      peer({ id: 'c', name: 'Cal', x: 1, y: 0, lastSeenAt: now }),
    ];
    const out = buildPeerRoster(peers, { localX: 0, localY: 0, now, limit: 2 });
    expect(out.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('formats distances for HUD', () => {
    expect(formatRosterDistance(0)).toBe('here');
    expect(formatRosterDistance(7)).toBe('7t');
    expect(formatRosterDistance(150)).toBe('>99t');
  });
});

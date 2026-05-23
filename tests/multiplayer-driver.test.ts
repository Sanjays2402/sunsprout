import { describe, expect, it } from 'vitest';
import { LoopbackBus } from '../src/game/multiplayer-transport';
import { MultiplayerSession } from '../src/game/multiplayer-session';
import { PeerView } from '../src/game/peer-view';
import { MultiplayerDriver } from '../src/game/multiplayer-driver';

function makePair() {
  const bus = new LoopbackBus();
  const sessionA = new MultiplayerSession({
    identity: { id: 'a', name: 'A', color: '#ff8855', hat: '#222' },
    transport: bus.connect('a'),
    broadcastIntervalMs: 50,
  });
  const sessionB = new MultiplayerSession({
    identity: { id: 'b', name: 'B', color: '#55b6ff', hat: '#222' },
    transport: bus.connect('b'),
    broadcastIntervalMs: 50,
  });
  return {
    bus,
    a: new MultiplayerDriver({ session: sessionA, view: new PeerView() }),
    b: new MultiplayerDriver({ session: sessionB, view: new PeerView() }),
  };
}

describe('MultiplayerDriver', () => {
  it('broadcasts local state and surfaces peers via view', () => {
    const { a, b } = makePair();
    a.tick({ x: 5, y: 7, facing: 'down' }, 0);
    b.tick({ x: 12, y: 3, facing: 'left' }, 0);
    // Each side now sees the other in its registry.
    const peersFromA = a.peers(50);
    expect(peersFromA.length).toBe(1);
    expect(peersFromA[0].id).toBe('b');
    expect(peersFromA[0].x).toBeCloseTo(12);
    expect(peersFromA[0].y).toBeCloseTo(3);
    expect(a.ticks).toBe(1);
  });

  it('counts ticks and stops after close()', () => {
    const { a } = makePair();
    a.tick({ x: 0, y: 0, facing: 'down' }, 0);
    a.tick({ x: 1, y: 0, facing: 'right' }, 100);
    expect(a.ticks).toBe(2);
    a.close();
    expect(a.closed).toBe(true);
    a.tick({ x: 2, y: 0, facing: 'right' }, 200);
    expect(a.ticks).toBe(2);
    expect(a.peers(300)).toEqual([]);
  });

  it('drains join and leave events around a peer lifecycle', () => {
    const { a, b } = makePair();
    a.tick({ x: 0, y: 0, facing: 'down' }, 0);
    // First tick after b broadcasts → join event surfaces.
    b.tick({ x: 1, y: 1, facing: 'down' }, 0);
    a.tick({ x: 0, y: 0, facing: 'down' }, 50);
    const joins = a.drainEvents();
    expect(joins).toHaveLength(1);
    expect(joins[0].kind).toBe('join');
    expect(joins[0].id).toBe('b');
    expect(joins[0].name).toBe('B');
    // Drain is one-shot.
    expect(a.drainEvents()).toEqual([]);
    // Now b goes silent → eviction should produce a leave event.
    a.tick({ x: 0, y: 0, facing: 'down' }, 10_000);
    const leaves = a.drainEvents();
    expect(leaves).toHaveLength(1);
    expect(leaves[0].kind).toBe('leave');
    expect(leaves[0].id).toBe('b');
  });

  it('evicts stale peers and reports their ids', () => {
    const { a, b } = makePair();
    a.tick({ x: 0, y: 0, facing: 'down' }, 0);
    b.tick({ x: 1, y: 1, facing: 'down' }, 0);
    // 10 seconds later, b has gone silent. a's session has peerTimeoutMs=5000.
    const evicted = a.tick({ x: 0, y: 0, facing: 'down' }, 10_000);
    expect(evicted).toContain('b');
  });
});

import { describe, it, expect } from 'vitest';
import { LoopbackBus } from '../src/game/multiplayer-transport';
import { MultiplayerSession } from '../src/game/multiplayer-session';
import { SnapshotThrottle } from '../src/game/snapshot-throttle';

describe('MultiplayerSession + SnapshotThrottle', () => {
  it('suppresses broadcasts when the local state has not changed', () => {
    const bus = new LoopbackBus();
    const a = new MultiplayerSession({
      identity: { id: 'a', name: 'a', color: '#fff', hat: '#000' },
      transport: bus.connect('a'),
      broadcastIntervalMs: 10,
      peerTimeoutMs: 5000,
      throttle: new SnapshotThrottle({ moveEpsilon: 0.1, heartbeatMs: 10_000, minIntervalMs: 0 }),
    });
    const b = new MultiplayerSession({
      identity: { id: 'b', name: 'b', color: '#fff', hat: '#000' },
      transport: bus.connect('b'),
      broadcastIntervalMs: 10,
      peerTimeoutMs: 5000,
    });

    // First update — should go through (throttle has no prior state).
    a.update({ x: 0, y: 0, facing: 'down' }, 0);
    b.update({ x: 5, y: 5, facing: 'up' }, 0);
    expect(b.peers().length).toBe(1);
    const firstX = b.peers()[0].x;
    expect(firstX).toBe(0);

    // Identical state at later time — throttle suppresses, peer position unchanged.
    a.update({ x: 0, y: 0, facing: 'down' }, 500);
    expect(b.peers()[0].x).toBe(0);

    // Movement above epsilon — throttle allows, peer sees update.
    a.update({ x: 2, y: 0, facing: 'down' }, 1000);
    b.update({ x: 5, y: 5, facing: 'up' }, 1000);
    expect(b.peers()[0].x).toBe(2);
  });

  it('accepts throttle as plain opts and constructs one', () => {
    const bus = new LoopbackBus();
    const s = new MultiplayerSession({
      identity: { id: 'a', name: 'a', color: '#fff', hat: '#000' },
      transport: bus.connect('a'),
      throttle: { moveEpsilon: 0.2, heartbeatMs: 500, minIntervalMs: 10 },
    });
    expect(s.throttle).not.toBeNull();
    expect(s.throttle!.moveEpsilon).toBe(0.2);
    expect(s.throttle!.heartbeatMs).toBe(500);
  });
});

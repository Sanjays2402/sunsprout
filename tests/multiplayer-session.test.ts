import { describe, it, expect } from 'vitest';
import { LoopbackBus } from '../src/game/multiplayer-transport';
import { MultiplayerSession } from '../src/game/multiplayer-session';
import { PeerRegistry } from '../src/game/multiplayer';

function mkSession(bus: LoopbackBus, id: string, opts: Partial<ConstructorParameters<typeof MultiplayerSession>[0]> = {}) {
  return new MultiplayerSession({
    identity: { id, name: id, color: '#ff8855', hat: '#221122' },
    transport: bus.connect(id),
    broadcastIntervalMs: 100,
    peerTimeoutMs: 500,
    ...opts,
  });
}

describe('MultiplayerSession', () => {
  it('broadcasts local snapshots on cadence and remote peer appears in registry', () => {
    const bus = new LoopbackBus();
    const a = mkSession(bus, 'a');
    const b = mkSession(bus, 'b');

    a.update({ x: 3, y: 4, facing: 'right' }, 0);
    b.update({ x: 9, y: 9, facing: 'left' }, 0);

    expect(a.peers().map((p) => p.id)).toEqual(['b']);
    expect(b.peers().map((p) => p.id)).toEqual(['a']);
    expect(a.peers()[0].x).toBe(9);
    expect(b.peers()[0].facing).toBe('right');
  });

  it('skips broadcasts until the interval elapses', () => {
    const bus = new LoopbackBus();
    const a = mkSession(bus, 'a', { broadcastIntervalMs: 200 });
    const b = mkSession(bus, 'b');

    a.update({ x: 1, y: 1, facing: 'down' }, 0);
    expect(b.peers()[0].x).toBe(1);

    // Within interval — local state changes, no broadcast.
    a.update({ x: 5, y: 5, facing: 'down' }, 100);
    expect(b.peers()[0].x).toBe(1);

    // After interval — broadcast lands.
    a.update({ x: 7, y: 7, facing: 'down' }, 250);
    expect(b.peers()[0].x).toBe(7);
  });

  it('evicts stale peers after peerTimeoutMs', () => {
    const bus = new LoopbackBus();
    const a = mkSession(bus, 'a', { peerTimeoutMs: 500 });
    const b = mkSession(bus, 'b');

    a.update({ x: 0, y: 0, facing: 'down' }, 0);
    b.update({ x: 0, y: 0, facing: 'down' }, 0);
    expect(a.peers().length).toBe(1);

    b.close();
    const evicted = a.update({ x: 0, y: 0, facing: 'down' }, 1000);
    expect(evicted).toEqual(['b']);
    expect(a.peers().length).toBe(0);
  });

  it('close() tears down transport and clears registry', () => {
    const bus = new LoopbackBus();
    const reg = new PeerRegistry();
    const a = new MultiplayerSession({
      identity: { id: 'a', name: 'a', color: '#fff', hat: '#000' },
      transport: bus.connect('a'),
      registry: reg,
    });
    const b = mkSession(bus, 'b');

    a.update({ x: 0, y: 0, facing: 'down' }, 0);
    b.update({ x: 0, y: 0, facing: 'down' }, 0);
    expect(reg.size()).toBe(1);

    a.close();
    expect(a.closed).toBe(true);
    expect(reg.size()).toBe(0);
    // Post-close update is a no-op.
    expect(a.update({ x: 0, y: 0, facing: 'down' }, 100)).toEqual([]);
  });
});

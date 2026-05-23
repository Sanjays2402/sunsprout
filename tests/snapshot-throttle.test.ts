import { describe, expect, it } from 'vitest';
import { SnapshotThrottle, stateFromSnapshot } from '../src/game/snapshot-throttle';
import { buildSnapshot } from '../src/game/multiplayer';

describe('SnapshotThrottle', () => {
  it('sends first sample immediately', () => {
    const t = new SnapshotThrottle();
    expect(
      t.shouldSend({ x: 0, y: 0, facing: 'down', name: 'a', color: '#fff', hat: '#000' }, 0),
    ).toBe(true);
  });

  it('skips redundant samples within heartbeat window', () => {
    const t = new SnapshotThrottle({ heartbeatMs: 1000, minIntervalMs: 0 });
    const s = { x: 1, y: 1, facing: 'down', name: 'a', color: '#fff', hat: '#000' };
    expect(t.shouldSend(s, 0)).toBe(true);
    expect(t.shouldSend(s, 100)).toBe(false);
    expect(t.shouldSend(s, 500)).toBe(false);
  });

  it('emits heartbeat after silence', () => {
    const t = new SnapshotThrottle({ heartbeatMs: 1000, minIntervalMs: 0 });
    const s = { x: 1, y: 1, facing: 'down', name: 'a', color: '#fff', hat: '#000' };
    t.shouldSend(s, 0);
    expect(t.shouldSend(s, 1001)).toBe(true);
  });

  it('emits when facing changes', () => {
    const t = new SnapshotThrottle({ minIntervalMs: 0 });
    t.shouldSend({ x: 0, y: 0, facing: 'down', name: 'a', color: '#f', hat: '#0' }, 0);
    expect(
      t.shouldSend({ x: 0, y: 0, facing: 'up', name: 'a', color: '#f', hat: '#0' }, 10),
    ).toBe(true);
  });

  it('respects minIntervalMs hard cap', () => {
    const t = new SnapshotThrottle({ minIntervalMs: 100, moveEpsilon: 0.001 });
    t.shouldSend({ x: 0, y: 0, facing: 'down', name: 'a', color: '#f', hat: '#0' }, 0);
    expect(
      t.shouldSend({ x: 5, y: 5, facing: 'up', name: 'b', color: '#0', hat: '#f' }, 50),
    ).toBe(false);
  });

  it('ignores sub-epsilon movement', () => {
    const t = new SnapshotThrottle({ moveEpsilon: 0.1, heartbeatMs: 10_000, minIntervalMs: 0 });
    t.shouldSend({ x: 0, y: 0, facing: 'down', name: 'a', color: '#f', hat: '#0' }, 0);
    expect(
      t.shouldSend({ x: 0.01, y: 0, facing: 'down', name: 'a', color: '#f', hat: '#0' }, 10),
    ).toBe(false);
  });

  it('stateFromSnapshot round-trips fields', () => {
    const snap = buildSnapshot({
      id: 'x',
      name: 'cake',
      x: 3,
      y: 4,
      facing: 'left',
      color: '#abc',
      hat: '#def',
    });
    const s = stateFromSnapshot(snap);
    expect(s).toEqual({ x: 3, y: 4, facing: 'left', name: 'cake', color: '#abc', hat: '#def' });
  });
});

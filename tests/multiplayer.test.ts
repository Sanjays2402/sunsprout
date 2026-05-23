import { describe, it, expect } from 'vitest';
import {
  PeerRegistry,
  PeerInterpolator,
  serializeSnapshot,
  deserializeSnapshot,
  buildSnapshot,
  PEER_SNAPSHOT_VERSION,
} from '../src/game/multiplayer';

function snap(over: Partial<ReturnType<typeof buildSnapshot>> = {}) {
  return {
    ...buildSnapshot({
      id: 'peer-a',
      name: 'Alex',
      x: 10,
      y: 12,
      facing: 'down' as const,
      color: '#ff8844',
      hat: '#222222',
    }),
    ...over,
  };
}

describe('multiplayer peer registry', () => {
  it('round-trips a snapshot through serialize/deserialize', () => {
    const s = snap();
    const wire = serializeSnapshot(s);
    const back = deserializeSnapshot(wire);
    expect(back).toEqual(s);
    expect(back?.v).toBe(PEER_SNAPSHOT_VERSION);
  });

  it('apply() inserts new peer and reports first-seen', () => {
    const reg = new PeerRegistry();
    const isNew = reg.apply(snap(), 1000);
    expect(isNew).toBe(true);
    expect(reg.size()).toBe(1);
    expect(reg.get('peer-a')?.name).toBe('Alex');
  });

  it('apply() updates existing peer without duplicating', () => {
    const reg = new PeerRegistry();
    reg.apply(snap({ x: 1, y: 1 }), 1000);
    const isNew = reg.apply(snap({ x: 5, y: 7, facing: 'left' }), 2000);
    expect(isNew).toBe(false);
    expect(reg.size()).toBe(1);
    const p = reg.get('peer-a');
    expect(p?.x).toBe(5);
    expect(p?.y).toBe(7);
    expect(p?.facing).toBe('left');
    expect(p?.lastSeenAt).toBe(2000);
  });

  it('rejects malformed payloads', () => {
    expect(deserializeSnapshot('not json')).toBeNull();
    expect(deserializeSnapshot(JSON.stringify({ ...snap(), v: 999 }))).toBeNull();
    expect(deserializeSnapshot(JSON.stringify({ ...snap(), x: 'oops' }))).toBeNull();
    expect(deserializeSnapshot(JSON.stringify({ ...snap(), facing: 'sideways' }))).toBeNull();
    expect(deserializeSnapshot(JSON.stringify({ ...snap(), id: '' }))).toBeNull();
  });

  it('evictStale() removes peers past timeout and keeps fresh ones', () => {
    const reg = new PeerRegistry();
    reg.apply(snap({ id: 'old' }), 1000);
    reg.apply(snap({ id: 'fresh' }), 9000);
    const removed = reg.evictStale(10_000, 5000);
    expect(removed).toEqual(['old']);
    expect(reg.has('old')).toBe(false);
    expect(reg.has('fresh')).toBe(true);
  });

  it('apply() rejects an invalid snapshot without mutating the registry', () => {
    const reg = new PeerRegistry();
    const bad = { ...snap(), v: 42 };
    const isNew = reg.apply(bad, 1000);
    expect(isNew).toBe(false);
    expect(reg.size()).toBe(0);
  });
});

describe('PeerInterpolator', () => {
  it('returns null with no samples and the lone sample once one arrives', () => {
    const lerp = new PeerInterpolator(100);
    expect(lerp.sampleAt(0)).toBeNull();
    lerp.push({ t: 1000, x: 4, y: 5 });
    expect(lerp.sampleAt(1100)).toEqual({ x: 4, y: 5 });
  });

  it('lerps between two samples at the render-delayed time', () => {
    const lerp = new PeerInterpolator(100);
    lerp.push({ t: 1000, x: 0, y: 0 });
    lerp.push({ t: 2000, x: 10, y: 0 });
    // now=1600 -> renderT=1500 -> halfway -> x=5
    const p = lerp.sampleAt(1600);
    expect(p?.x).toBeCloseTo(5, 5);
    expect(p?.y).toBeCloseTo(0, 5);
  });

  it('clamps to newest when render time outruns the buffer', () => {
    const lerp = new PeerInterpolator(100);
    lerp.push({ t: 1000, x: 0, y: 0 });
    lerp.push({ t: 2000, x: 10, y: 2 });
    expect(lerp.sampleAt(5000)).toEqual({ x: 10, y: 2 });
  });

  it('drops out-of-order samples', () => {
    const lerp = new PeerInterpolator(100);
    lerp.push({ t: 2000, x: 10, y: 0 });
    lerp.push({ t: 1000, x: 99, y: 99 }); // stale — ignored
    expect(lerp.size()).toBe(1);
    expect(lerp.sampleAt(3000)).toEqual({ x: 10, y: 0 });
  });

  it('trims samples older than maxAgeMs', () => {
    const lerp = new PeerInterpolator(100, 500);
    lerp.push({ t: 1000, x: 0, y: 0 });
    lerp.push({ t: 1200, x: 1, y: 1 });
    lerp.push({ t: 1400, x: 2, y: 2 });
    lerp.push({ t: 5000, x: 9, y: 9 }); // far future — cutoff = 4500
    expect(lerp.size()).toBe(2);
  });
});

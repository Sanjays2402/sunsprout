import { describe, it, expect } from 'vitest';
import {
  PeerRegistry,
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

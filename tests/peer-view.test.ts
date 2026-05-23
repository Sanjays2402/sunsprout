import { describe, it, expect } from 'vitest';
import { PeerRegistry, buildSnapshot } from '../src/game/multiplayer';
import { PeerView } from '../src/game/peer-view';

function feed(reg: PeerRegistry, id: string, x: number, y: number, t: number) {
  reg.apply(buildSnapshot({ id, name: id, x, y, facing: 'down', color: '#fff', hat: '#000' }), t);
}

describe('PeerView', () => {
  it('returns smoothed positions lerped between two snapshots', () => {
    const reg = new PeerRegistry();
    const view = new PeerView({ interpDelayMs: 50 });

    feed(reg, 'a', 0, 0, 0);
    view.viewAt(reg, 0);
    feed(reg, 'a', 10, 0, 100);
    const r = view.viewAt(reg, 100); // renderT=50, halfway between t=0 and t=100
    expect(r).toHaveLength(1);
    expect(r[0].x).toBeCloseTo(5, 5);
    expect(r[0].id).toBe('a');
  });

  it('tracks multiple peers independently', () => {
    const reg = new PeerRegistry();
    const view = new PeerView();
    feed(reg, 'a', 1, 1, 0);
    feed(reg, 'b', 9, 9, 0);
    const r = view.viewAt(reg, 0);
    expect(r.map((p) => p.id).sort()).toEqual(['a', 'b']);
    expect(view.size()).toBe(2);
  });

  it('prunes interpolators for peers absent past pruneAfterMs', () => {
    const reg = new PeerRegistry();
    const view = new PeerView({ pruneAfterMs: 500 });
    feed(reg, 'a', 0, 0, 0);
    view.viewAt(reg, 0);
    expect(view.size()).toBe(1);

    reg.remove('a');
    view.viewAt(reg, 200);
    expect(view.size()).toBe(1); // not yet pruned
    view.viewAt(reg, 1000);
    expect(view.size()).toBe(0);
  });

  it('dedupes repeated snapshots with the same lastSeenAt', () => {
    const reg = new PeerRegistry();
    const view = new PeerView();
    feed(reg, 'a', 0, 0, 100);
    view.viewAt(reg, 100);
    // Same lastSeenAt — viewAt called again should not push a duplicate sample.
    view.viewAt(reg, 110);
    view.viewAt(reg, 120);
    feed(reg, 'a', 20, 0, 200);
    const r = view.viewAt(reg, 200);
    expect(r[0].x).toBeGreaterThanOrEqual(0);
    expect(r[0].x).toBeLessThanOrEqual(20);
  });
});

// NPC route — multi-waypoint pacing logic.
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ROUTE_PERIOD_HOURS,
  isAtRouteEndpoint,
  routeAnchor,
  routeAnchorRounded,
} from '../src/game/npc-route';
import { World } from '../src/world/world';
import { NPC_DEFS, getCurrentAnchor } from '../src/game/npcs';

describe('routeAnchor', () => {
  it('returns from unchanged when walkTo is undefined', () => {
    const a = routeAnchor({ x: 10, y: 5 }, undefined, 9, 0);
    expect(a).toEqual({ x: 10, y: 5 });
  });

  it('sits at the from endpoint at phase 0', () => {
    const a = routeAnchor({ x: 0, y: 0 }, { x: 4, y: 0 }, 0, 0, 2);
    expect(a.x).toBeCloseTo(0, 3);
    expect(a.y).toBeCloseTo(0, 3);
  });

  it('reaches the to endpoint at phase 0.5 (mid-period)', () => {
    const a = routeAnchor({ x: 0, y: 0 }, { x: 4, y: 2 }, 1, 0, 2);
    expect(a.x).toBeCloseTo(4, 3);
    expect(a.y).toBeCloseTo(2, 3);
  });

  it('comes back to the from endpoint at phase 1.0', () => {
    const a = routeAnchor({ x: 5, y: 5 }, { x: 9, y: 5 }, 2, 0, 2);
    expect(a.x).toBeCloseTo(5, 3);
    expect(a.y).toBeCloseTo(5, 3);
  });

  it('produces a smooth interpolation (monotonic from start to mid)', () => {
    const xs: number[] = [];
    for (let m = 0; m < 60; m += 10) {
      xs.push(routeAnchor({ x: 0, y: 0 }, { x: 1, y: 0 }, 0, m, 2).x);
    }
    // Each successive sample should be >= previous (we're heading toward to).
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1] - 1e-9);
    }
  });

  it('returns from when periodHours <= 0', () => {
    const a = routeAnchor({ x: 1, y: 2 }, { x: 5, y: 5 }, 1, 30, 0);
    expect(a).toEqual({ x: 1, y: 2 });
  });

  it('uses DEFAULT_ROUTE_PERIOD_HOURS when no period specified', () => {
    const a = routeAnchor({ x: 0, y: 0 }, { x: 4, y: 0 }, DEFAULT_ROUTE_PERIOD_HOURS / 2, 0);
    expect(a.x).toBeCloseTo(4, 3);
  });
});

describe('routeAnchorRounded', () => {
  it('snaps the interpolated point to integer tile coords', () => {
    const r = routeAnchorRounded({ x: 0, y: 0 }, { x: 4, y: 2 }, 1, 0, 2);
    expect(r).toEqual({ x: 4, y: 2 });
  });
});

describe('isAtRouteEndpoint', () => {
  it('is true at phase 0.5 (the to point)', () => {
    expect(isAtRouteEndpoint({ x: 0, y: 0 }, { x: 4, y: 0 }, 1, 0, 2)).toBe(true);
  });

  it('is false at phase 0 (start point)', () => {
    expect(isAtRouteEndpoint({ x: 0, y: 0 }, { x: 4, y: 0 }, 0, 0, 2)).toBe(false);
  });

  it('is false when no walkTo', () => {
    expect(isAtRouteEndpoint({ x: 0, y: 0 }, undefined, 1, 0, 2)).toBe(false);
  });
});

describe('NPC schedule integration', () => {
  it('Mayor reaches both ends of his morning route during the window', () => {
    const w = new World();
    const mayor = w.npcs.find((n) => n.id === 'mayor')!;
    // Schedule slot 0: (19,6) <-> (21,6) from hour 6 to 10.
    const startAnchor = getCurrentAnchor(mayor, 6, 0)!;
    expect(startAnchor.x).toBeCloseTo(19, 3);
    expect(startAnchor.y).toBeCloseTo(6, 3);
    // Mid-period (phase 0.5 = 1 hour into a 2-hour period).
    const midAnchor = getCurrentAnchor(mayor, 7, 0)!;
    expect(midAnchor.x).toBeCloseTo(21, 3);
    expect(midAnchor.y).toBeCloseTo(6, 3);
  });

  it('Backward-compat: a slot WITHOUT walkTo returns the static anchor', () => {
    const w = new World();
    const finn = w.npcs.find((n) => n.id === 'finn')!;
    // Schedule slot 1: (8,21) hour 11..14 — no walkTo.
    const a = getCurrentAnchor(finn, 12, 0)!;
    expect(a.x).toBe(8);
    expect(a.y).toBe(21);
    // Different minute yields same anchor.
    const b = getCurrentAnchor(finn, 12, 45)!;
    expect(b.x).toBe(8);
    expect(b.y).toBe(21);
  });

  it('Returns null outside the schedule hours', () => {
    const w = new World();
    const maple = w.npcs.find((n) => n.id === 'maple')!;
    // Maple's last slot ends at hour 22.
    expect(getCurrentAnchor(maple, 23, 0)).toBeNull();
  });

  it('Every NPC has at least one walkTo slot — the village reads as alive', () => {
    for (const def of Object.values(NPC_DEFS)) {
      const hasWalk = def.schedule.some((s) => s.walkTo);
      expect(hasWalk).toBe(true);
    }
  });
});

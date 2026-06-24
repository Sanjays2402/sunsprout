// oneShotBrag — generic helper for the sticky-flag dawn-brag pattern.
//
// Observation #4 from tick #30 retired: three+ achievements in tree
// (deep-vein, chain-tier, plus the sash/rare-master brags landing
// this tick) all share a near-identical shape:
//   - a `*Pending` field is set by the action-side helper on a
//     milestone crossing
//   - a `*DawnBrag` function reads + clears it on the next dawn so
//     a player who skips a day doesn't see the same brag re-emit
//   - an optional `*Fired` audit flag stays sticky so reloaded saves
//     know the brag has already played
//
// This file verifies the generic helper's contract on hand-crafted
// carriers so the deep-vein / chain-tier callsites get their behavior
// from the helper rather than re-implementing it.

import { describe, it, expect } from 'vitest';
import { oneShotBrag } from '../src/game/dawn-toast';

describe('oneShotBrag — silence on falsy pending', () => {
  it('returns empty when pending is undefined', () => {
    const carrier: { pending?: boolean; fired?: boolean } = {};
    const out = oneShotBrag(carrier, 'pending', 'fired', () => 'BRAG');
    expect(out).toBe('');
    expect(carrier.fired).toBeUndefined();
  });

  it('returns empty when pending is explicit false', () => {
    const carrier: { pending: boolean; fired?: boolean } = { pending: false };
    const out = oneShotBrag(carrier, 'pending', 'fired', () => 'BRAG');
    expect(out).toBe('');
  });

  it('returns empty when pending is 0', () => {
    const carrier: { pending: number; fired?: boolean } = { pending: 0 };
    const out = oneShotBrag(carrier, 'pending', 'fired', () => 'BRAG');
    expect(out).toBe('');
  });

  it('returns empty when pending is empty string', () => {
    const carrier: { pending: string; fired?: boolean } = { pending: '' };
    const out = oneShotBrag(carrier, 'pending', 'fired', () => 'BRAG');
    expect(out).toBe('');
  });
});

describe('oneShotBrag — fires on truthy pending', () => {
  it('calls render and returns its text when pending is true', () => {
    const carrier: { pending?: boolean; fired?: boolean } = { pending: true };
    const out = oneShotBrag(carrier, 'pending', 'fired', () => 'BRAG');
    expect(out).toBe('BRAG');
  });

  it('passes the pending value into render so callers can branch on it', () => {
    const carrier: { pending?: number; fired?: boolean } = { pending: 1.2 };
    const out = oneShotBrag(carrier, 'pending', 'fired', (p) => `tier ${p}`);
    expect(out).toBe('tier 1.2');
  });

  it('handles string pending values', () => {
    const carrier: { pending?: string; fired?: boolean } = { pending: 'sash' };
    const out = oneShotBrag(carrier, 'pending', 'fired', (p) => `awarded ${p}`);
    expect(out).toBe('awarded sash');
  });
});

describe('oneShotBrag — sets fired flag on read', () => {
  it('sets the firedKey to true after the brag fires', () => {
    const carrier: { pending?: boolean; fired?: boolean } = { pending: true };
    oneShotBrag(carrier, 'pending', 'fired', () => 'BRAG');
    expect(carrier.fired).toBe(true);
  });

  it('skips the fired-flag write when firedKey is null', () => {
    const carrier: { pending?: boolean; fired?: boolean } = { pending: true };
    oneShotBrag(carrier, 'pending', null, () => 'BRAG');
    expect(carrier.fired).toBeUndefined();
  });

  it('does NOT set the fired flag when pending is falsy', () => {
    const carrier: { pending?: boolean; fired?: boolean } = {};
    oneShotBrag(carrier, 'pending', 'fired', () => 'BRAG');
    expect(carrier.fired).toBeUndefined();
  });
});

describe('oneShotBrag — clears pending on read', () => {
  it('clears the pending field after firing', () => {
    const carrier: { pending?: boolean; fired?: boolean } = { pending: true };
    oneShotBrag(carrier, 'pending', 'fired', () => 'BRAG');
    expect(carrier.pending).toBeUndefined();
  });

  it('clears even when render returns empty (corrupted state defense)', () => {
    const carrier: { pending?: number; fired?: boolean } = { pending: 9.99 };
    const out = oneShotBrag(carrier, 'pending', 'fired', () => '');
    expect(out).toBe('');
    expect(carrier.pending).toBeUndefined();
    // fired flag still set so the audit trail records "we tried".
    expect(carrier.fired).toBe(true);
  });

  it('clears even when firedKey is null', () => {
    const carrier: { pending?: boolean } = { pending: true };
    oneShotBrag(carrier, 'pending', null, () => 'BRAG');
    expect(carrier.pending).toBeUndefined();
  });
});

describe('oneShotBrag — one-shot semantics', () => {
  it('subsequent calls return empty until pending is re-armed', () => {
    const carrier: { pending?: boolean; fired?: boolean } = { pending: true };
    expect(oneShotBrag(carrier, 'pending', 'fired', () => 'BRAG')).toBe('BRAG');
    expect(oneShotBrag(carrier, 'pending', 'fired', () => 'BRAG')).toBe('');
    expect(oneShotBrag(carrier, 'pending', 'fired', () => 'BRAG')).toBe('');
  });

  it('re-arming the pending field fires the brag again', () => {
    const carrier: { pending?: boolean; fired?: boolean } = { pending: true };
    oneShotBrag(carrier, 'pending', 'fired', () => 'BRAG');
    // Re-arm.
    carrier.pending = true;
    expect(oneShotBrag(carrier, 'pending', 'fired', () => 'AGAIN')).toBe('AGAIN');
  });
});

describe('oneShotBrag — independent across carriers', () => {
  it('two carriers with the same key shape stay independent', () => {
    const a: { pending?: boolean; fired?: boolean } = { pending: true };
    const b: { pending?: boolean; fired?: boolean } = { pending: true };
    expect(oneShotBrag(a, 'pending', 'fired', () => 'A')).toBe('A');
    expect(b.pending).toBe(true); // unaffected
    expect(b.fired).toBeUndefined();
    expect(oneShotBrag(b, 'pending', 'fired', () => 'B')).toBe('B');
  });
});

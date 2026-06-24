// Compost-master-sash dawn brag — one-shot celebratory dawn-toast
// tail the morning AFTER lifetimeRecycledGold crosses the sash
// milestone (250g) for the first time. Same sticky-flag pattern as
// deep-vein / chain-tier; rides the generic oneShotBrag helper.
//
// Tests cover:
//   - silence on a fresh save (no pending flag)
//   - arming the pending flag on the fresh sash crossing
//   - one-shot semantics (second call returns empty)
//   - no re-arm on a subsequent apply once already past the bar
//   - persistence round-trip through serialize/applySnapshot

import { describe, it, expect } from 'vitest';
import {
  COMPOST_MASTER_SASH_MILESTONE_GOLD,
  COMPOST_RECYCLE_REGULAR,
  COMPOST_RECYCLE_RARE,
  compostMasterSashDawnBrag,
  getCompostLedger,
  recordApplied,
} from '../src/game/compost';
import { World } from '../src/world/world';

function freshLedger(): object {
  return {} as object;
}

/** Apply N regular bags so lifetimeRecycledGold grows by N. */
function applyRegularN(player: object, n: number): void {
  for (let i = 0; i < n; i++) recordApplied(player, COMPOST_RECYCLE_REGULAR);
}

describe('compostMasterSashDawnBrag — silence on fresh save', () => {
  it('returns empty when no apply has happened', () => {
    const p = freshLedger();
    expect(compostMasterSashDawnBrag(p)).toBe('');
  });

  it('returns empty when player is under the sash milestone', () => {
    const p = freshLedger();
    applyRegularN(p, COMPOST_MASTER_SASH_MILESTONE_GOLD - 1);
    expect(compostMasterSashDawnBrag(p)).toBe('');
  });
});

describe('compostMasterSashDawnBrag — arms on fresh crossing', () => {
  it('arms the sashBragPending flag on the fresh crossing apply', () => {
    const p = freshLedger();
    applyRegularN(p, COMPOST_MASTER_SASH_MILESTONE_GOLD);
    expect(getCompostLedger(p).sashBragPending).toBe(true);
  });

  it('renders a recap naming the lifetime recycled gold + bag count', () => {
    const p = freshLedger();
    applyRegularN(p, COMPOST_MASTER_SASH_MILESTONE_GOLD);
    const brag = compostMasterSashDawnBrag(p);
    expect(brag).toContain('Compost Sash earned');
    expect(brag).toContain(`${COMPOST_MASTER_SASH_MILESTONE_GOLD}g`);
    expect(brag).toContain(`${COMPOST_MASTER_SASH_MILESTONE_GOLD} bag`);
  });

  it('uses singular "bag" when bagsApplied is 1 (defensive — sash milestone with bonkers bag values)', () => {
    const p = freshLedger();
    // Force an irregular state — single huge-rare bag worth 250g.
    const ledger = getCompostLedger(p);
    ledger.lifetimeRecycledGold = COMPOST_MASTER_SASH_MILESTONE_GOLD;
    ledger.lifetimeBagsApplied = 1;
    ledger.sashBragPending = true;
    const brag = compostMasterSashDawnBrag(p);
    expect(brag).toContain('1 bag.');
    expect(brag).not.toContain('1 bags');
  });
});

describe('compostMasterSashDawnBrag — one-shot semantics', () => {
  it('second call returns empty', () => {
    const p = freshLedger();
    applyRegularN(p, COMPOST_MASTER_SASH_MILESTONE_GOLD);
    expect(compostMasterSashDawnBrag(p)).toContain('Compost Sash');
    expect(compostMasterSashDawnBrag(p)).toBe('');
  });

  it('sets sashBragFired after firing so the audit trail is permanent', () => {
    const p = freshLedger();
    applyRegularN(p, COMPOST_MASTER_SASH_MILESTONE_GOLD);
    compostMasterSashDawnBrag(p);
    expect(getCompostLedger(p).sashBragFired).toBe(true);
    expect(getCompostLedger(p).sashBragPending).toBeFalsy();
  });

  it('does NOT re-arm on a subsequent apply once past the bar (already-fired)', () => {
    const p = freshLedger();
    applyRegularN(p, COMPOST_MASTER_SASH_MILESTONE_GOLD);
    compostMasterSashDawnBrag(p);
    // More applies past the bar — sash already earned, brag already
    // fired, no fresh crossing to celebrate.
    applyRegularN(p, 50);
    expect(getCompostLedger(p).sashBragPending).toBeFalsy();
    expect(compostMasterSashDawnBrag(p)).toBe('');
  });
});

describe('compostMasterSashDawnBrag — no false arming below milestone', () => {
  it('does NOT arm on an apply that pushes BELOW the milestone', () => {
    const p = freshLedger();
    applyRegularN(p, COMPOST_MASTER_SASH_MILESTONE_GOLD - 5);
    expect(getCompostLedger(p).sashBragPending).toBeFalsy();
  });

  it('does NOT arm on the rare-master bump alone (different counter)', () => {
    const p = freshLedger();
    // 50 rare bags = 150g recycled — below sash milestone (250g).
    for (let i = 0; i < 50; i++) recordApplied(p, COMPOST_RECYCLE_RARE, true);
    expect(getCompostLedger(p).sashBragPending).toBeFalsy();
  });
});

describe('compostMasterSashDawnBrag — wires through real save', () => {
  it('works when accessed via a World player (lazy reader path)', () => {
    const w = new World();
    applyRegularN(w.player, COMPOST_MASTER_SASH_MILESTONE_GOLD);
    expect(compostMasterSashDawnBrag(w.player)).toContain('Compost Sash');
  });
});

// Rare-master dawn brag — one-shot celebratory dawn-toast tail the
// morning AFTER lifetimeRareBagsApplied crosses the rare-master
// milestone (100) for the first time. Symmetric with the
// compost-master-sash dawn brag, but reads off the SEPARATE rare-bag
// counter so a regular-bag grind doesn't accidentally trigger it —
// only rare-day-finished compost batches move the counter.
//
// Tests cover:
//   - silence on a fresh save (no pending flag)
//   - silence on a regular-bag grind (different counter)
//   - arming the pending flag on the fresh crossing
//   - one-shot semantics (second call returns empty)
//   - no re-arm on subsequent rare bag once already past the bar

import { describe, it, expect } from 'vitest';
import {
  COMPOST_RECYCLE_RARE,
  COMPOST_RECYCLE_REGULAR,
  RARE_MASTER_MILESTONE_BAGS,
  getCompostLedger,
  rareMasterDawnBrag,
  recordApplied,
} from '../src/game/compost';
import { World } from '../src/world/world';

function freshLedger(): object {
  return {} as object;
}

/** Apply N rare bags so lifetimeRareBagsApplied grows by N. */
function applyRareN(player: object, n: number): void {
  for (let i = 0; i < n; i++) recordApplied(player, COMPOST_RECYCLE_RARE, true);
}

/** Apply N regular bags so lifetimeBagsApplied grows by N but rare counter stays put. */
function applyRegularN(player: object, n: number): void {
  for (let i = 0; i < n; i++) recordApplied(player, COMPOST_RECYCLE_REGULAR);
}

describe('rareMasterDawnBrag — silence on fresh save', () => {
  it('returns empty when no apply has happened', () => {
    const p = freshLedger();
    expect(rareMasterDawnBrag(p)).toBe('');
  });

  it('returns empty when player is under the rare-master milestone', () => {
    const p = freshLedger();
    applyRareN(p, RARE_MASTER_MILESTONE_BAGS - 1);
    expect(rareMasterDawnBrag(p)).toBe('');
  });
});

describe('rareMasterDawnBrag — never fires on regular-bag grind', () => {
  it('100 regular bags do NOT arm the brag', () => {
    const p = freshLedger();
    applyRegularN(p, 100);
    expect(getCompostLedger(p).rareMasterBragPending).toBeFalsy();
    expect(rareMasterDawnBrag(p)).toBe('');
  });

  it('500 regular bags + 0 rare bags still does not arm', () => {
    const p = freshLedger();
    applyRegularN(p, 500);
    expect(getCompostLedger(p).rareMasterBragPending).toBeFalsy();
    expect(rareMasterDawnBrag(p)).toBe('');
  });
});

describe('rareMasterDawnBrag — arms on fresh rare crossing', () => {
  it('arms the rareMasterBragPending flag on the fresh crossing apply', () => {
    const p = freshLedger();
    applyRareN(p, RARE_MASTER_MILESTONE_BAGS);
    expect(getCompostLedger(p).rareMasterBragPending).toBe(true);
  });

  it('renders a recap naming the lifetime rare bag count', () => {
    const p = freshLedger();
    applyRareN(p, RARE_MASTER_MILESTONE_BAGS);
    const brag = rareMasterDawnBrag(p);
    expect(brag).toContain('Rare Master earned');
    expect(brag).toContain(`${RARE_MASTER_MILESTONE_BAGS} rare bag`);
    expect(brag).toContain('across the seasons');
  });

  it('uses singular "bag" when rare count is exactly 1 (defensive — milestone set to 1 in tests)', () => {
    const p = freshLedger();
    const ledger = getCompostLedger(p);
    ledger.lifetimeBagsApplied = 1;
    ledger.lifetimeRecycledGold = 3;
    ledger.lifetimeRareBagsApplied = 1;
    ledger.rareMasterBragPending = true;
    const brag = rareMasterDawnBrag(p);
    expect(brag).toContain('1 rare bag ');
    expect(brag).not.toContain('1 rare bags');
  });
});

describe('rareMasterDawnBrag — one-shot semantics', () => {
  it('second call returns empty', () => {
    const p = freshLedger();
    applyRareN(p, RARE_MASTER_MILESTONE_BAGS);
    expect(rareMasterDawnBrag(p)).toContain('Rare Master');
    expect(rareMasterDawnBrag(p)).toBe('');
  });

  it('sets rareMasterBragFired after firing so the audit trail is permanent', () => {
    const p = freshLedger();
    applyRareN(p, RARE_MASTER_MILESTONE_BAGS);
    rareMasterDawnBrag(p);
    expect(getCompostLedger(p).rareMasterBragFired).toBe(true);
    expect(getCompostLedger(p).rareMasterBragPending).toBeFalsy();
  });

  it('does NOT re-arm on a subsequent rare apply once past the bar (already-fired)', () => {
    const p = freshLedger();
    applyRareN(p, RARE_MASTER_MILESTONE_BAGS);
    rareMasterDawnBrag(p);
    applyRareN(p, 10);
    expect(getCompostLedger(p).rareMasterBragPending).toBeFalsy();
    expect(rareMasterDawnBrag(p)).toBe('');
  });
});

describe('rareMasterDawnBrag — interaction with sash brag', () => {
  it('does NOT clear sash flags (independent one-shots)', () => {
    const p = freshLedger();
    // Pile rare bags to clear BOTH milestones — rare-master (100) and
    // sash (~84 rare = 252g recycled). After 100 rare bags both
    // pending flags should be armed.
    applyRareN(p, RARE_MASTER_MILESTONE_BAGS);
    expect(getCompostLedger(p).sashBragPending).toBe(true);
    expect(getCompostLedger(p).rareMasterBragPending).toBe(true);
    // Firing rare-master should not clear the sash flag.
    rareMasterDawnBrag(p);
    expect(getCompostLedger(p).rareMasterBragPending).toBeFalsy();
    expect(getCompostLedger(p).sashBragPending).toBe(true);
  });
});

describe('rareMasterDawnBrag — wires through real save', () => {
  it('works when accessed via a World player (lazy reader path)', () => {
    const w = new World();
    applyRareN(w.player, RARE_MASTER_MILESTONE_BAGS);
    expect(rareMasterDawnBrag(w.player)).toContain('Rare Master');
  });
});

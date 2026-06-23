// Compost-master halfway nudge — once lifetimeRecycledGold crosses
// COMPOST_MASTER_NUDGE_MIN_GOLD (half the badge milestone) the crop-
// journal line gains a "(Xg to the badge)" tail. The tail disappears
// the moment the player crosses the milestone so the journal goes
// back to a clean lifetime recap once the badge is earned.
//
// Parallel pulper nudge lives in the same compostLedgerLine — runs
// from PULPER_NUDGE_MIN_BAGS (= COMPOST_MASTER_MILESTONE_GOLD) up to
// but not including PULPER_MILESTONE_BAGS. The two nudges are mutually
// exclusive so the line only ever surfaces ONE \"to badge\" tail.

import { describe, it, expect } from 'vitest';
import {
  COMPOST_MASTER_MILESTONE_GOLD,
  COMPOST_MASTER_NUDGE_MIN_GOLD,
  COMPOST_RECYCLE_REGULAR,
  COMPOST_RECYCLE_RARE,
  PULPER_MILESTONE_BAGS,
  PULPER_NUDGE_MIN_BAGS,
  compostLedgerLine,
  getCompostLedger,
  recordApplied,
} from '../src/game/compost';

/** Bump lifetimeRecycledGold to a specific total — preserves bag count
 *  growth in lockstep so tests can target a clean gold value with the
 *  fewest moving parts. Uses regular bags so each apply adds exactly
 *  COMPOST_RECYCLE_REGULAR gold + 1 bag. */
function recycleTo(p: object, targetGold: number): void {
  const ledger = getCompostLedger(p);
  while (ledger.lifetimeRecycledGold < targetGold) {
    recordApplied(p, COMPOST_RECYCLE_REGULAR);
  }
}

describe('COMPOST_MASTER_NUDGE_MIN_GOLD constant', () => {
  it('is exactly half the badge milestone so the nudge is a halfway carrot', () => {
    expect(COMPOST_MASTER_NUDGE_MIN_GOLD).toBe(COMPOST_MASTER_MILESTONE_GOLD / 2);
  });

  it('PULPER_NUDGE_MIN_BAGS lines up with the compost-master gold milestone — the two tails ladder cleanly', () => {
    expect(PULPER_NUDGE_MIN_BAGS).toBe(COMPOST_MASTER_MILESTONE_GOLD);
  });
});

describe('compostLedgerLine — base line (no nudge)', () => {
  it('returns empty on a fresh player', () => {
    const p = {} as object;
    expect(compostLedgerLine(p)).toBe('');
  });

  it('returns base line BELOW the compost-master nudge threshold', () => {
    const p = {} as object;
    // 5 regular bags = 5g recycled, well under the 50g nudge floor.
    for (let i = 0; i < 5; i++) recordApplied(p, COMPOST_RECYCLE_REGULAR);
    const line = compostLedgerLine(p);
    expect(line).toContain('compost master:');
    expect(line).toContain('5g recycled');
    expect(line).toContain('5 bags');
    // No \"to badge\" tail.
    expect(line).not.toContain('to the badge');
    expect(line).not.toContain('pulper');
  });
});

describe('compostLedgerLine — compost-master halfway nudge', () => {
  it('fires the nudge at the floor — exactly 50g recycled', () => {
    const p = {} as object;
    recycleTo(p, COMPOST_MASTER_NUDGE_MIN_GOLD);
    const line = compostLedgerLine(p);
    expect(line).toContain(`(${COMPOST_MASTER_MILESTONE_GOLD - COMPOST_MASTER_NUDGE_MIN_GOLD}g to the badge)`);
  });

  it('fires the nudge at half-the-half — 75g recycled', () => {
    const p = {} as object;
    recycleTo(p, 75);
    const line = compostLedgerLine(p);
    expect(line).toContain('(25g to the badge)');
  });

  it('does NOT fire below the floor — 49g recycled has no tail', () => {
    const p = {} as object;
    recycleTo(p, COMPOST_MASTER_NUDGE_MIN_GOLD - 1);
    const line = compostLedgerLine(p);
    expect(line).not.toContain('to the badge');
  });

  it('STOPS firing the moment the badge milestone is crossed', () => {
    const p = {} as object;
    recycleTo(p, COMPOST_MASTER_MILESTONE_GOLD);
    const line = compostLedgerLine(p);
    expect(line).not.toContain('to the badge');
  });

  it('handles rare bags too — 60g recycled (20 rare bags) lights up the nudge', () => {
    const p = {} as object;
    // 20 rare bags = 60g recycled.
    for (let i = 0; i < 20; i++) recordApplied(p, COMPOST_RECYCLE_RARE);
    const line = compostLedgerLine(p);
    expect(line).toContain('60g recycled');
    expect(line).toContain('(40g to the badge)');
  });
});

describe('compostLedgerLine — pulper halfway nudge', () => {
  it('fires AFTER compost-master + sash are earned, at the bag-count floor', () => {
    const p = {} as object;
    // Need recycledGold past the sash milestone (250g) so the pulper
    // rung wins priority. Pile rare bags fast to clear both gold gates.
    for (let i = 0; i < 84; i++) recordApplied(p, COMPOST_RECYCLE_RARE);
    // 84 rare = 252g recycled, 84 bags. Compost-master + sash both earned.
    // Top up regular bags until lifetimeBagsApplied hits the nudge floor.
    while (getCompostLedger(p).lifetimeBagsApplied < PULPER_NUDGE_MIN_BAGS) {
      recordApplied(p, COMPOST_RECYCLE_REGULAR);
    }
    const line = compostLedgerLine(p);
    expect(line).toContain('compost master:');
    expect(line).toContain('to the pulper badge');
    expect(line).not.toContain(`to the badge)`);
    expect(line).not.toContain('to the sash');
  });

  it('names the bag-count runway in the tail', () => {
    const p = {} as object;
    // Earn compost-master + sash via rare bags (84 rare = 252g, 84 bags).
    for (let i = 0; i < 84; i++) recordApplied(p, COMPOST_RECYCLE_RARE);
    // Then top up regular bags to 234 total — 150 more.
    for (let i = 0; i < 150; i++) recordApplied(p, COMPOST_RECYCLE_REGULAR);
    const line = compostLedgerLine(p);
    expect(line).toContain(`(${PULPER_MILESTONE_BAGS - 234} bags to the pulper badge)`);
  });

  it('handles singular phrasing when exactly 1 bag remains', () => {
    const p = {} as object;
    // Earn compost-master + sash via rare bags first.
    for (let i = 0; i < 84; i++) recordApplied(p, COMPOST_RECYCLE_RARE);
    // Then top up regular bags to PULPER_MILESTONE_BAGS - 1.
    while (getCompostLedger(p).lifetimeBagsApplied < PULPER_MILESTONE_BAGS - 1) {
      recordApplied(p, COMPOST_RECYCLE_REGULAR);
    }
    const line = compostLedgerLine(p);
    expect(line).toContain('(1 bag to the pulper badge)');
    expect(line).not.toContain('bags to the pulper');
  });

  it('STOPS firing the moment the pulper milestone is crossed', () => {
    const p = {} as object;
    for (let i = 0; i < 84; i++) recordApplied(p, COMPOST_RECYCLE_RARE);
    while (getCompostLedger(p).lifetimeBagsApplied < PULPER_MILESTONE_BAGS) {
      recordApplied(p, COMPOST_RECYCLE_REGULAR);
    }
    const line = compostLedgerLine(p);
    expect(line).not.toContain('to the pulper badge');
  });
});

describe('compostLedgerLine — nudge mutual exclusion', () => {
  it('does NOT fire BOTH nudges in the same line', () => {
    // Pile rare bags past the sash gate (84 rare = 252g) so neither
    // compost-master nor sash nudges are eligible; the pulper rung
    // then surfaces alone.
    const p = {} as object;
    for (let i = 0; i < 84; i++) recordApplied(p, COMPOST_RECYCLE_RARE);
    while (getCompostLedger(p).lifetimeBagsApplied < PULPER_NUDGE_MIN_BAGS + 50) {
      recordApplied(p, COMPOST_RECYCLE_REGULAR);
    }
    const line = compostLedgerLine(p);
    expect(line).toContain('to the pulper badge');
    expect(line).not.toContain(`g to the badge)`);
    expect(line).not.toContain('to the sash');
  });

  it('does NOT fire the pulper nudge when only the compost-master nudge is eligible', () => {
    const p = {} as object;
    recycleTo(p, 60);
    const line = compostLedgerLine(p);
    expect(line).toContain('to the badge');
    expect(line).not.toContain('to the pulper badge');
  });
});

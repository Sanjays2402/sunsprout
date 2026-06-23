// Compost halfway dawn nudges — one-shot dawn-toast tails the morning
// AFTER the player crosses each badge runway floor. Mirrors the
// passive journal-line tails in compostLedgerLine but carries the
// signal directly into the morning toast for players who never open
// the journal.
//
// The compost-master nudge fires once when lifetimeRecycledGold enters
// [COMPOST_MASTER_NUDGE_MIN_GOLD, COMPOST_MASTER_MILESTONE_GOLD) on a
// fresh dawn. The pulper nudge fires once when compost-master is
// already earned AND lifetimeBagsApplied enters [PULPER_NUDGE_MIN_BAGS,
// PULPER_MILESTONE_BAGS). Both are sticky: once fired the flag stays
// set across reloads via the persisted ledger.

import { describe, it, expect } from 'vitest';
import {
  COMPOST_MASTER_MILESTONE_GOLD,
  COMPOST_MASTER_NUDGE_MIN_GOLD,
  COMPOST_RECYCLE_RARE,
  COMPOST_RECYCLE_REGULAR,
  PULPER_MILESTONE_BAGS,
  PULPER_NUDGE_MIN_BAGS,
  compostHalfwayDawnNudge,
  getCompostLedger,
  recordApplied,
} from '../src/game/compost';

function recycleTo(p: object, targetGold: number): void {
  const ledger = getCompostLedger(p);
  while (ledger.lifetimeRecycledGold < targetGold) {
    recordApplied(p, COMPOST_RECYCLE_REGULAR);
  }
}

describe('compostHalfwayDawnNudge — silence conditions', () => {
  it('returns empty on a fresh player', () => {
    const p = {} as object;
    expect(compostHalfwayDawnNudge(p)).toBe('');
  });

  it('returns empty when recycled gold is below the compost-master nudge floor', () => {
    const p = {} as object;
    recycleTo(p, COMPOST_MASTER_NUDGE_MIN_GOLD - 1);
    expect(compostHalfwayDawnNudge(p)).toBe('');
  });

  it('returns empty when compost-master badge is already earned but pulper nudge is not yet eligible', () => {
    const p = {} as object;
    // 34 rare bags = 102g recycled, 34 bags → master earned, pulper nudge not yet.
    for (let i = 0; i < 34; i++) recordApplied(p, COMPOST_RECYCLE_RARE);
    expect(compostHalfwayDawnNudge(p)).toBe('');
  });

  it('returns empty when pulper milestone is also already crossed (badge earned)', () => {
    const p = {} as object;
    // Earn compost-master via rare, then top up regular bags past the pulper milestone.
    for (let i = 0; i < 34; i++) recordApplied(p, COMPOST_RECYCLE_RARE);
    while (getCompostLedger(p).lifetimeBagsApplied < PULPER_MILESTONE_BAGS) {
      recordApplied(p, COMPOST_RECYCLE_REGULAR);
    }
    expect(compostHalfwayDawnNudge(p)).toBe('');
  });
});

describe('compostHalfwayDawnNudge — compost-master nudge fires', () => {
  it('fires at the nudge floor', () => {
    const p = {} as object;
    recycleTo(p, COMPOST_MASTER_NUDGE_MIN_GOLD);
    const line = compostHalfwayDawnNudge(p);
    expect(line).toContain('Halfway to Compost Master');
    expect(line).toContain(`${COMPOST_MASTER_MILESTONE_GOLD - COMPOST_MASTER_NUDGE_MIN_GOLD}g`);
  });

  it('names the remaining gold in the tail at mid-range', () => {
    const p = {} as object;
    recycleTo(p, 75);
    const line = compostHalfwayDawnNudge(p);
    expect(line).toContain('25g');
  });

  it('is ONE-SHOT — second call returns empty', () => {
    const p = {} as object;
    recycleTo(p, 70);
    expect(compostHalfwayDawnNudge(p)).toContain('Compost Master');
    expect(compostHalfwayDawnNudge(p)).toBe('');
  });

  it('does NOT fire master nudge after the master milestone is crossed even if it never fired', () => {
    const p = {} as object;
    // Use rare bags so we hit the master gold milestone with far fewer
    // bags than PULPER_NUDGE_MIN_BAGS — otherwise hitting the gold
    // milestone via regular bags also crosses the pulper nudge floor.
    // 34 rare bags = 102g recycled, 34 bags. Master earned, pulper not yet eligible.
    for (let i = 0; i < 34; i++) recordApplied(p, COMPOST_RECYCLE_RARE);
    // Even though masterNudgeDawnFired was never set, the eligibility
    // window has already passed for the master nudge.
    const line = compostHalfwayDawnNudge(p);
    expect(line).not.toContain('Compost Master');
  });
});

describe('compostHalfwayDawnNudge — pulper nudge fires', () => {
  it('fires when compost-master is earned AND bags hit the pulper nudge floor', () => {
    const p = {} as object;
    for (let i = 0; i < 34; i++) recordApplied(p, COMPOST_RECYCLE_RARE);
    // Already at 34 bags; top up to PULPER_NUDGE_MIN_BAGS.
    while (getCompostLedger(p).lifetimeBagsApplied < PULPER_NUDGE_MIN_BAGS) {
      recordApplied(p, COMPOST_RECYCLE_REGULAR);
    }
    const line = compostHalfwayDawnNudge(p);
    expect(line).toContain('Halfway to Pulper');
    expect(line).toContain(`${PULPER_MILESTONE_BAGS - PULPER_NUDGE_MIN_BAGS}`);
    expect(line).toContain('bags');
  });

  it('is ONE-SHOT — second call returns empty', () => {
    const p = {} as object;
    for (let i = 0; i < 34; i++) recordApplied(p, COMPOST_RECYCLE_RARE);
    while (getCompostLedger(p).lifetimeBagsApplied < PULPER_NUDGE_MIN_BAGS) {
      recordApplied(p, COMPOST_RECYCLE_REGULAR);
    }
    expect(compostHalfwayDawnNudge(p)).toContain('Pulper');
    expect(compostHalfwayDawnNudge(p)).toBe('');
  });

  it('handles singular phrasing when exactly 1 bag remains', () => {
    const p = {} as object;
    for (let i = 0; i < 34; i++) recordApplied(p, COMPOST_RECYCLE_RARE);
    // Top up to PULPER_MILESTONE_BAGS - 1.
    while (getCompostLedger(p).lifetimeBagsApplied < PULPER_MILESTONE_BAGS - 1) {
      recordApplied(p, COMPOST_RECYCLE_REGULAR);
    }
    const line = compostHalfwayDawnNudge(p);
    expect(line).toContain('Halfway to Pulper - 1 bag to go.');
    expect(line).not.toContain('bags to go');
  });
});

describe('compostHalfwayDawnNudge — nudge priority + isolation', () => {
  it('compost-master nudge fires BEFORE pulper nudge when both could theoretically be eligible', () => {
    // The bag/gold ledger makes this case unreachable in normal play
    // (a player who hits PULPER_NUDGE_MIN_BAGS has already crossed
    // COMPOST_MASTER_MILESTONE_GOLD via the gold reach), but we still
    // want to verify the priority order. We'll force the case by
    // hand-crafting a ledger.
    const p = { compostLedger: {
      lifetimeRecycledGold: COMPOST_MASTER_NUDGE_MIN_GOLD + 5, // master eligible
      lifetimeBagsApplied: PULPER_NUDGE_MIN_BAGS + 5,           // pulper would also be eligible
    }} as object;
    const line = compostHalfwayDawnNudge(p);
    expect(line).toContain('Compost Master');
    expect(line).not.toContain('Pulper');
  });

  it('pulper nudge does NOT fire while compost-master nudge is still on the runway', () => {
    const p = { compostLedger: {
      lifetimeRecycledGold: COMPOST_MASTER_NUDGE_MIN_GOLD + 1, // master eligible
      lifetimeBagsApplied: PULPER_NUDGE_MIN_BAGS + 5,           // bags also eligible
    }} as object;
    // First call: master nudge fires.
    expect(compostHalfwayDawnNudge(p)).toContain('Compost Master');
    // Second call: master nudge already fired; pulper guard checks
    // compost-master is EARNED (recycled >= milestone), which this
    // hand-crafted ledger fails. So nothing fires.
    expect(compostHalfwayDawnNudge(p)).toBe('');
  });
});

describe('compostHalfwayDawnNudge — fired flags', () => {
  it('sets masterNudgeDawnFired=true after the master nudge surfaces', () => {
    const p = {} as object;
    recycleTo(p, 60);
    compostHalfwayDawnNudge(p);
    expect(getCompostLedger(p).masterNudgeDawnFired).toBe(true);
  });

  it('sets pulperNudgeDawnFired=true after the pulper nudge surfaces', () => {
    const p = {} as object;
    for (let i = 0; i < 34; i++) recordApplied(p, COMPOST_RECYCLE_RARE);
    while (getCompostLedger(p).lifetimeBagsApplied < PULPER_NUDGE_MIN_BAGS) {
      recordApplied(p, COMPOST_RECYCLE_REGULAR);
    }
    compostHalfwayDawnNudge(p);
    expect(getCompostLedger(p).pulperNudgeDawnFired).toBe(true);
  });

  it('does NOT touch pulperNudgeDawnFired when only the master nudge fires', () => {
    const p = {} as object;
    recycleTo(p, 60);
    compostHalfwayDawnNudge(p);
    expect(getCompostLedger(p).masterNudgeDawnFired).toBe(true);
    expect(getCompostLedger(p).pulperNudgeDawnFired).toBeFalsy();
  });
});

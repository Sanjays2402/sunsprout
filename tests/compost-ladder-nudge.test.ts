// LadderNudge — generic pure helper that powers both compostLedgerLine
// and compostHalfwayDawnNudge. The helper walks an ordered list of
// rungs, finds the first one whose value sits in [floor, milestone)
// AND whose optional prereq passes, then renders the remaining-gap
// readout. First eligible rung wins; later rungs never compete.
//
// The compost surface uses this helper for the gold-recycled and
// bags-applied nudges; future surfaces (a third rung beyond pulper,
// a separate sash badge ladder) drop in as one-line array pushes.

import { describe, it, expect } from 'vitest';
import {
  COMPOST_MASTER_MILESTONE_GOLD,
  COMPOST_MASTER_NUDGE_MIN_GOLD,
  PULPER_MILESTONE_BAGS,
  PULPER_NUDGE_MIN_BAGS,
  compostHalfwayDawnNudge,
  compostLedgerLine,
  getCompostLedger,
  ladderNudge,
  type LadderNudgeRung,
} from '../src/game/compost';

describe('ladderNudge — generic walker', () => {
  it('returns empty string on an empty rung array', () => {
    expect(ladderNudge([])).toBe('');
  });

  it('returns empty when no rung is eligible (value below floor)', () => {
    const rungs: LadderNudgeRung[] = [
      { value: 10, floor: 50, milestone: 100, readout: () => 'first' },
      { value: 5, floor: 100, milestone: 200, readout: () => 'second' },
    ];
    expect(ladderNudge(rungs)).toBe('');
  });

  it('returns empty when value is at or above milestone (rung extinguished)', () => {
    const rungs: LadderNudgeRung[] = [
      { value: 100, floor: 50, milestone: 100, readout: () => 'first' },
      { value: 200, floor: 100, milestone: 200, readout: () => 'second' },
    ];
    expect(ladderNudge(rungs)).toBe('');
  });

  it('fires the first eligible rung', () => {
    const rungs: LadderNudgeRung[] = [
      {
        value: 75,
        floor: 50,
        milestone: 100,
        readout: (remaining) => `first: ${remaining} to go`,
      },
      {
        value: 200,
        floor: 100,
        milestone: 500,
        readout: (remaining) => `second: ${remaining} to go`,
      },
    ];
    expect(ladderNudge(rungs)).toBe('first: 25 to go');
  });

  it('skips an ineligible first rung and falls through to the second', () => {
    const rungs: LadderNudgeRung[] = [
      {
        value: 200, // already past milestone
        floor: 50,
        milestone: 100,
        readout: () => 'first',
      },
      {
        value: 300,
        floor: 100,
        milestone: 500,
        readout: (remaining) => `second: ${remaining}`,
      },
    ];
    expect(ladderNudge(rungs)).toBe('second: 200');
  });

  it('honors the prereq gate (rung skipped when prereq returns false)', () => {
    const rungs: LadderNudgeRung[] = [
      {
        value: 50,
        floor: 50,
        milestone: 100,
        prereq: () => false,
        readout: () => 'first',
      },
      {
        value: 200,
        floor: 100,
        milestone: 500,
        readout: () => 'second',
      },
    ];
    expect(ladderNudge(rungs)).toBe('second');
  });

  it('rung at exactly floor IS eligible (inclusive)', () => {
    const rungs: LadderNudgeRung[] = [
      {
        value: 50,
        floor: 50,
        milestone: 100,
        readout: (r) => `at: ${r}`,
      },
    ];
    expect(ladderNudge(rungs)).toBe('at: 50');
  });

  it('rung at exactly milestone is NOT eligible (exclusive)', () => {
    const rungs: LadderNudgeRung[] = [
      {
        value: 100,
        floor: 50,
        milestone: 100,
        readout: () => 'should not fire',
      },
    ];
    expect(ladderNudge(rungs)).toBe('');
  });

  it('pure — does NOT mutate input rungs', () => {
    const rungs: LadderNudgeRung[] = [
      { value: 75, floor: 50, milestone: 100, readout: (r) => `${r}` },
    ];
    const snapshot = JSON.parse(JSON.stringify(rungs));
    ladderNudge(rungs);
    expect(JSON.parse(JSON.stringify(rungs))).toEqual(snapshot);
  });
});

describe('compostLedgerLine — refactored via ladderNudge (parity check)', () => {
  function ledgerPlayer(gold: number, bags: number) {
    const p: { compostLedger?: ReturnType<typeof getCompostLedger> } = {};
    const ledger = getCompostLedger(p);
    ledger.lifetimeRecycledGold = gold;
    ledger.lifetimeBagsApplied = bags;
    return p;
  }

  it('returns empty on a save with no bags applied', () => {
    const p = ledgerPlayer(0, 0);
    expect(compostLedgerLine(p)).toBe('');
  });

  it('base recap when below all nudge floors', () => {
    const p = ledgerPlayer(20, 8);
    expect(compostLedgerLine(p)).toBe('compost master: 20g recycled across 8 bags.');
  });

  it('compost-master nudge tail in [50g, 100g)', () => {
    const p = ledgerPlayer(75, 25);
    expect(compostLedgerLine(p)).toContain('(25g to the badge)');
  });

  it('NO master nudge AT the master milestone (100g)', () => {
    const p = ledgerPlayer(COMPOST_MASTER_MILESTONE_GOLD, 200);
    expect(compostLedgerLine(p)).not.toContain('to the badge');
  });

  it('pulper nudge tail after compost-master is earned + bags in [100, 500)', () => {
    const p = ledgerPlayer(120, 234);
    expect(compostLedgerLine(p)).toContain('(266 bags to the pulper badge)');
  });

  it('NO pulper nudge before compost-master is earned (prereq gate)', () => {
    const p = ledgerPlayer(50, 234);
    expect(compostLedgerLine(p)).toContain('(50g to the badge)');
    expect(compostLedgerLine(p)).not.toContain('pulper badge');
  });

  it('NO pulper nudge AT the pulper milestone (500 bags)', () => {
    const p = ledgerPlayer(150, PULPER_MILESTONE_BAGS);
    expect(compostLedgerLine(p)).not.toContain('pulper badge');
  });

  it('compost-master nudge ALWAYS wins over pulper when both eligible', () => {
    // Construct a state where the gold is in the master window AND
    // the bags are in the pulper window simultaneously — impossible
    // in normal play but the ladder must still pick master first.
    const p = ledgerPlayer(75, 300);
    expect(compostLedgerLine(p)).toContain('(25g to the badge)');
    expect(compostLedgerLine(p)).not.toContain('pulper badge');
  });
});

describe('compostHalfwayDawnNudge — refactored via ladderNudge walker', () => {
  function ledgerPlayer(gold: number, bags: number) {
    const p: { compostLedger?: ReturnType<typeof getCompostLedger> } = {};
    const ledger = getCompostLedger(p);
    ledger.lifetimeRecycledGold = gold;
    ledger.lifetimeBagsApplied = bags;
    return p;
  }

  it('returns empty on a fresh save', () => {
    const p = ledgerPlayer(0, 0);
    expect(compostHalfwayDawnNudge(p)).toBe('');
  });

  it('fires the master nudge once + bumps the master fired flag', () => {
    const p = ledgerPlayer(75, 25);
    expect(compostHalfwayDawnNudge(p)).toBe('Halfway to Compost Master - 25g to go.');
    expect(getCompostLedger(p).masterNudgeDawnFired).toBe(true);
  });

  it('does NOT re-fire the master nudge after the flag is set', () => {
    const p = ledgerPlayer(75, 25);
    compostHalfwayDawnNudge(p);
    expect(compostHalfwayDawnNudge(p)).toBe('');
  });

  it('fires the pulper nudge after compost-master is earned + bags in window', () => {
    const p = ledgerPlayer(150, 234);
    const out = compostHalfwayDawnNudge(p);
    expect(out).toBe('Halfway to Pulper - 266 bags to go.');
    expect(getCompostLedger(p).pulperNudgeDawnFired).toBe(true);
    expect(getCompostLedger(p).masterNudgeDawnFired).toBeFalsy();
  });

  it('does NOT re-fire the pulper nudge after the flag is set', () => {
    const p = ledgerPlayer(150, 234);
    compostHalfwayDawnNudge(p);
    expect(compostHalfwayDawnNudge(p)).toBe('');
  });

  it('master nudge wins priority when both rungs are simultaneously eligible', () => {
    // Force a contrived state where master AND pulper would both
    // surface — the priority gate has to pick master first.
    const p = ledgerPlayer(75, 234);
    // Master rung: value 75 in [50, 100), prereq passes (not fired yet).
    // Pulper rung: prereq requires compost-master >= 100g — FALSE here.
    // So pulper is skipped by prereq and master fires.
    expect(compostHalfwayDawnNudge(p)).toBe('Halfway to Compost Master - 25g to go.');
  });

  it('rung floors and milestones match the public constants', () => {
    expect(COMPOST_MASTER_NUDGE_MIN_GOLD).toBe(COMPOST_MASTER_MILESTONE_GOLD / 2);
    expect(PULPER_NUDGE_MIN_BAGS).toBe(COMPOST_MASTER_MILESTONE_GOLD);
  });
});

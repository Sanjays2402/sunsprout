// Rare-master journal-line nudge — a 4th rung in compostLedgerLine
// via the generic ladderNudge helper. Reads the SEPARATE
// lifetimeRareBagsApplied counter (not the regular-bag counter) so
// the rung is orthogonal to the compost-master / sash / pulper rungs.
// Fires in [50, 100) and disappears once the rare-master badge is
// earned.
//
// Validates the ladderNudge refactor a third time (sash rung tick #29,
// rare-master rung now): the helper keeps scaling as a single array
// push rather than another ternary branch in compostLedgerLine. Three
// rungs deep without growing the call site complexity is the whole
// point of the refactor.

import { describe, it, expect } from 'vitest';
import {
  COMPOST_RECYCLE_RARE,
  COMPOST_RECYCLE_REGULAR,
  RARE_MASTER_MILESTONE_BAGS,
  RARE_MASTER_NUDGE_MIN_BAGS,
  compostLedgerLine,
  getCompostLedger,
  recordApplied,
} from '../src/game/compost';

describe('RARE_MASTER_NUDGE_MIN_BAGS constant', () => {
  it('is exactly half the rare-master milestone so the nudge is a halfway carrot', () => {
    expect(RARE_MASTER_NUDGE_MIN_BAGS).toBe(RARE_MASTER_MILESTONE_BAGS / 2);
  });
});

describe('compostLedgerLine — rare-master nudge', () => {
  it('does NOT fire on a fresh player (no rare bags)', () => {
    const p = {} as object;
    expect(compostLedgerLine(p)).toBe('');
  });

  it('does NOT fire below the rare-master nudge floor (49 rare bags)', () => {
    const p = {} as object;
    for (let i = 0; i < RARE_MASTER_NUDGE_MIN_BAGS - 1; i++) {
      recordApplied(p, COMPOST_RECYCLE_RARE, true);
    }
    const line = compostLedgerLine(p);
    expect(line).not.toContain('rare-master');
  });

  it('fires AT the rare-master nudge floor (50 rare bags, gold pinned past sash)', () => {
    // Pin gold past the sash milestone via direct ledger fixture so
    // the master + sash gold rungs are silent and the rare-master
    // rung is the first eligible one. (Real apply paths can't pin
    // gold above 250 with only 50 rare bags — recordApplied bumps
    // gold by 3 per rare = 150g.)
    const p = {} as object;
    const ledger = getCompostLedger(p);
    ledger.lifetimeRecycledGold = 500;
    ledger.lifetimeBagsApplied = 50;
    ledger.lifetimeRareBagsApplied = RARE_MASTER_NUDGE_MIN_BAGS;
    const line = compostLedgerLine(p);
    expect(line).toContain(`(${RARE_MASTER_MILESTONE_BAGS - RARE_MASTER_NUDGE_MIN_BAGS} rare bags to the rare-master badge)`);
  });

  it('fires at half-the-half (75 rare bags) with 25 to go', () => {
    const p = {} as object;
    const ledger = getCompostLedger(p);
    ledger.lifetimeRecycledGold = 500;
    ledger.lifetimeBagsApplied = 75;
    ledger.lifetimeRareBagsApplied = 75;
    expect(compostLedgerLine(p)).toContain('(25 rare bags to the rare-master badge)');
  });

  it('uses singular "rare bag" when exactly 1 remains', () => {
    const p = {} as object;
    const ledger = getCompostLedger(p);
    ledger.lifetimeRecycledGold = 500;
    ledger.lifetimeBagsApplied = 99;
    ledger.lifetimeRareBagsApplied = RARE_MASTER_MILESTONE_BAGS - 1;
    const line = compostLedgerLine(p);
    expect(line).toContain('(1 rare bag to the rare-master badge)');
    expect(line).not.toContain('1 rare bags');
  });

  it('STOPS firing the moment the rare-master milestone is crossed', () => {
    const p = {} as object;
    const ledger = getCompostLedger(p);
    ledger.lifetimeRecycledGold = 500;
    ledger.lifetimeBagsApplied = RARE_MASTER_MILESTONE_BAGS;
    ledger.lifetimeRareBagsApplied = RARE_MASTER_MILESTONE_BAGS;
    expect(compostLedgerLine(p)).not.toContain('rare-master');
  });
});

describe('compostLedgerLine — rare-master rung priority', () => {
  it('rare-master wins over pulper when both eligible (rare rung is earlier in the ladder)', () => {
    const p = {} as object;
    // 60 rare bags (past rare-master nudge floor of 50, under
    // milestone 100) → rare-master rung eligible.
    for (let i = 0; i < 60; i++) recordApplied(p, COMPOST_RECYCLE_RARE, true);
    // Top up regular bags so total >= PULPER_NUDGE_MIN_BAGS (100).
    // Need to clear the sash gate too (250g recycled). 60 rare = 180g.
    // Top up with 70 regular = 70g → 250g recycled total. 60+70 = 130 bags.
    for (let i = 0; i < 70; i++) recordApplied(p, COMPOST_RECYCLE_REGULAR);
    const line = compostLedgerLine(p);
    expect(line).toContain('rare-master badge');
    expect(line).not.toContain('pulper badge');
  });

  it('does NOT fire when compost-master gold rung is still firing (gold rung is earlier in the ladder)', () => {
    const p = {} as object;
    // 60 rare bags = 180g recycled. Past compost-master milestone (100g)
    // AND past sash milestone (?? no — sash is 250g, 180g is in [100,250) =
    // sash window). So sash rung wins priority over rare-master.
    // To get the gold rungs out of the way without crossing rare-master:
    // pile 30 rare = 90g → master nudge eligible at 50g; rare counter = 30
    // (under rare-master nudge floor) → master nudge fires alone.
    for (let i = 0; i < 30; i++) recordApplied(p, COMPOST_RECYCLE_RARE, true);
    const line = compostLedgerLine(p);
    expect(line).toContain('to the badge');
    expect(line).not.toContain('rare-master');
    expect(line).not.toContain('to the sash');
  });

  it('does NOT fire when sash rung is still firing (sash rung is earlier in the ladder)', () => {
    const p = {} as object;
    // Use a ledger fixture to pin gold = 150 (sash window) + rare = 60
    // (rare-master window). Sash should win priority.
    const ledger = getCompostLedger(p);
    ledger.lifetimeRecycledGold = 150;
    ledger.lifetimeBagsApplied = 60;
    ledger.lifetimeRareBagsApplied = 60;
    const line = compostLedgerLine(p);
    expect(line).toContain('to the sash');
    expect(line).not.toContain('rare-master');
  });
});

describe('compostLedgerLine — rare-master rung is orthogonal to gold axis', () => {
  it('fires when player has earned every other badge but rare counter is in [50, 100)', () => {
    const p = {} as object;
    const ledger = getCompostLedger(p);
    // Past compost-master + sash + pulper, but rare counter mid-window.
    ledger.lifetimeRecycledGold = 1000;
    ledger.lifetimeBagsApplied = 600;
    ledger.lifetimeRareBagsApplied = 70;
    const line = compostLedgerLine(p);
    expect(line).toContain('(30 rare bags to the rare-master badge)');
    expect(line).not.toContain('to the sash');
    expect(line).not.toContain('to the badge)');
    expect(line).not.toContain('pulper badge');
  });
});

describe('compostHalfwayDawnNudge — rare-master rung', () => {
  it('fires the rare-master dawn nudge with correct wording', async () => {
    const { compostHalfwayDawnNudge } = await import('../src/game/compost');
    const p = {} as object;
    const ledger = getCompostLedger(p);
    // Pin gold past sash so the master / pulper rungs are silent and
    // the rare-master rung is the only eligible one.
    ledger.lifetimeRecycledGold = 1000;
    ledger.lifetimeBagsApplied = 600;
    ledger.lifetimeRareBagsApplied = 60;
    const tail = compostHalfwayDawnNudge(p);
    expect(tail).toContain('Halfway to Rare Master');
    expect(tail).toContain('40 rare bags to go');
  });

  it('is ONE-SHOT — second call returns empty', async () => {
    const { compostHalfwayDawnNudge } = await import('../src/game/compost');
    const p = {} as object;
    const ledger = getCompostLedger(p);
    ledger.lifetimeRecycledGold = 1000;
    ledger.lifetimeBagsApplied = 600;
    ledger.lifetimeRareBagsApplied = 60;
    expect(compostHalfwayDawnNudge(p)).toContain('Halfway to Rare Master');
    expect(compostHalfwayDawnNudge(p)).toBe('');
  });

  it('sets the rareMasterNudgeDawnFired flag', async () => {
    const { compostHalfwayDawnNudge } = await import('../src/game/compost');
    const p = {} as object;
    const ledger = getCompostLedger(p);
    ledger.lifetimeRecycledGold = 1000;
    ledger.lifetimeBagsApplied = 600;
    ledger.lifetimeRareBagsApplied = 60;
    compostHalfwayDawnNudge(p);
    expect(ledger.rareMasterNudgeDawnFired).toBe(true);
  });

  it('compost-master nudge wins over rare-master nudge when both eligible (earlier rung)', async () => {
    const { compostHalfwayDawnNudge } = await import('../src/game/compost');
    const p = {} as object;
    const ledger = getCompostLedger(p);
    // gold 60 = master rung eligible; rare 60 = rare-master rung
    // eligible. Master is earlier in the ladder so it fires first.
    ledger.lifetimeRecycledGold = 60;
    ledger.lifetimeBagsApplied = 20;
    ledger.lifetimeRareBagsApplied = 60;
    const tail = compostHalfwayDawnNudge(p);
    expect(tail).toContain('Compost Master');
    expect(tail).not.toContain('Rare Master');
  });

  it('rare-master nudge wins over pulper nudge when both eligible (earlier rung)', async () => {
    const { compostHalfwayDawnNudge } = await import('../src/game/compost');
    const p = {} as object;
    const ledger = getCompostLedger(p);
    // gold 300 = past sash so master + sash silent; bags 200 = pulper
    // eligible; rare 60 = rare-master eligible. Rare-master is earlier
    // in the rung array so it wins.
    ledger.lifetimeRecycledGold = 300;
    ledger.lifetimeBagsApplied = 200;
    ledger.lifetimeRareBagsApplied = 60;
    const tail = compostHalfwayDawnNudge(p);
    expect(tail).toContain('Rare Master');
    expect(tail).not.toContain('Pulper');
  });
});

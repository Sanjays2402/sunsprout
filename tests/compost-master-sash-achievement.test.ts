// Compost Master Sash — 24th badge keyed off lifetimeRecycledGold >=
// COMPOST_MASTER_SASH_MILESTONE_GOLD (250). A 3rd compost-tier honor
// above the existing compost-master badge (100g); the journal line
// gains a "(Xg to the sash)" tail in the [100, 250) window via the
// ladderNudge helper added in tick #27.
//
// Tests cover:
//   - sash-only predicate (works on the lazy ledger)
//   - achievement catalog registration + ordering
//   - tickAchievements grants the badge at the right threshold
//   - ladderNudge journal-line tail surfaces correctly between
//     master earned + sash earned
//   - sash priority above pulper when both rungs are eligible

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  COMPOST_MASTER_MILESTONE_GOLD,
  COMPOST_MASTER_SASH_MILESTONE_GOLD,
  COMPOST_MASTER_SASH_NUDGE_MIN_GOLD,
  COMPOST_RECYCLE_REGULAR,
  compostLedgerLine,
  compostMasterSashMilestoneReached,
  getCompostLedger,
  recordApplied,
} from '../src/game/compost';
import {
  ACHIEVEMENTS,
  isEarned,
  tickAchievements,
} from '../src/game/achievements';

describe('compostMasterSashMilestoneReached predicate', () => {
  it('false on a fresh player', () => {
    const w = new World();
    expect(compostMasterSashMilestoneReached(w.player)).toBe(false);
  });

  it('false at MILESTONE - 1, true at MILESTONE', () => {
    const w = new World();
    const ledger = getCompostLedger(w.player);
    ledger.lifetimeRecycledGold = COMPOST_MASTER_SASH_MILESTONE_GOLD - 1;
    expect(compostMasterSashMilestoneReached(w.player)).toBe(false);
    ledger.lifetimeRecycledGold = COMPOST_MASTER_SASH_MILESTONE_GOLD;
    expect(compostMasterSashMilestoneReached(w.player)).toBe(true);
  });

  it('reads off the same lifetimeRecycledGold field as compost-master', () => {
    const w = new World();
    for (let i = 0; i < COMPOST_MASTER_SASH_MILESTONE_GOLD; i++) {
      recordApplied(w.player, COMPOST_RECYCLE_REGULAR);
    }
    expect(getCompostLedger(w.player).lifetimeRecycledGold).toBe(
      COMPOST_MASTER_SASH_MILESTONE_GOLD,
    );
    expect(compostMasterSashMilestoneReached(w.player)).toBe(true);
  });
});

describe('compost-master-sash in the achievements catalog', () => {
  it('catalog includes the compost-master-sash entry', () => {
    const def = ACHIEVEMENTS.find((a) => a.id === 'compost-master-sash');
    expect(def).toBeTruthy();
    expect(def?.name).toBe('Compost Master Sash');
    expect(def?.hint).toContain(String(COMPOST_MASTER_SASH_MILESTONE_GOLD));
    expect(def?.done).toContain(String(COMPOST_MASTER_SASH_MILESTONE_GOLD));
  });

  it('catalog size now includes the sash (24+ badges)', () => {
    expect(ACHIEVEMENTS.some((a) => a.id === 'compost-master-sash')).toBe(true);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(24);
  });

  it('sash is positioned after compost-master in display order', () => {
    const sashIdx = ACHIEVEMENTS.findIndex((a) => a.id === 'compost-master-sash');
    const masterIdx = ACHIEVEMENTS.findIndex((a) => a.id === 'compost-master');
    expect(sashIdx).toBeGreaterThan(masterIdx);
  });

  it('tickAchievements grants the badge once the threshold crosses', () => {
    const w = new World();
    const time = new TimeOfDay(7);
    // Below threshold — not granted.
    const ledger = getCompostLedger(w.player);
    ledger.lifetimeRecycledGold = COMPOST_MASTER_SASH_MILESTONE_GOLD - 1;
    ledger.lifetimeBagsApplied = 200;
    let newly = tickAchievements(w.player, w, time);
    expect(newly).not.toContain('compost-master-sash');
    expect(isEarned(w.player, 'compost-master-sash')).toBe(false);
    // Cross the threshold — badge fires.
    ledger.lifetimeRecycledGold = COMPOST_MASTER_SASH_MILESTONE_GOLD;
    newly = tickAchievements(w.player, w, time);
    expect(newly).toContain('compost-master-sash');
    expect(isEarned(w.player, 'compost-master-sash')).toBe(true);
  });
});

describe('compostLedgerLine — sash nudge tail', () => {
  function ledgerPlayer(gold: number, bags: number) {
    const p: { compostLedger?: ReturnType<typeof getCompostLedger> } = {};
    const ledger = getCompostLedger(p);
    ledger.lifetimeRecycledGold = gold;
    ledger.lifetimeBagsApplied = bags;
    return p;
  }

  it('sash nudge fires in [100g, 250g) after compost-master is earned', () => {
    const p = ledgerPlayer(150, 60);
    expect(compostLedgerLine(p)).toContain('(100g to the sash)');
  });

  it('sash nudge does NOT fire below the compost-master gold milestone (master nudge wins)', () => {
    const p = ledgerPlayer(75, 30);
    expect(compostLedgerLine(p)).toContain('(25g to the badge)');
    expect(compostLedgerLine(p)).not.toContain('to the sash');
  });

  it('sash nudge does NOT fire AT the sash milestone (250g)', () => {
    const p = ledgerPlayer(COMPOST_MASTER_SASH_MILESTONE_GOLD, 100);
    expect(compostLedgerLine(p)).not.toContain('to the sash');
  });

  it('sash nudge does NOT fire ABOVE the sash milestone', () => {
    const p = ledgerPlayer(300, 150);
    expect(compostLedgerLine(p)).not.toContain('to the sash');
  });

  it('sash nudge wins priority over pulper nudge when both eligible', () => {
    // recycledGold in [100, 250) -> sash window
    // bagsApplied in [100, 500) -> pulper window
    // Sash is earlier in the rung array so it wins.
    const p = ledgerPlayer(180, 350);
    expect(compostLedgerLine(p)).toContain('(70g to the sash)');
    expect(compostLedgerLine(p)).not.toContain('pulper badge');
  });

  it('pulper nudge fires after sash is earned (recycledGold >= sash milestone)', () => {
    const p = ledgerPlayer(COMPOST_MASTER_SASH_MILESTONE_GOLD, 350);
    expect(compostLedgerLine(p)).toContain('(150 bags to the pulper badge)');
    expect(compostLedgerLine(p)).not.toContain('to the sash');
  });

  it('nudge floor + milestone constants match the public sash constants', () => {
    expect(COMPOST_MASTER_SASH_NUDGE_MIN_GOLD).toBe(COMPOST_MASTER_MILESTONE_GOLD);
    expect(COMPOST_MASTER_SASH_MILESTONE_GOLD).toBeGreaterThan(COMPOST_MASTER_MILESTONE_GOLD);
  });
});

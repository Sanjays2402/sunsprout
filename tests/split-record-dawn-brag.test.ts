// Mining split-record dawn brag — one-shot celebratory tail the
// morning AFTER the player's bestRun transitions from a same-day
// record (one run holds both leaderboards) into a split-record state
// (countDay !== goldDay, two different runs hold the records).
//
// Pins the contract:
//   - silent on a fresh save (no records yet)
//   - silent on a single-record save (only count or only gold)
//   - silent while records stay merged (countDay === goldDay)
//   - fires exactly once when records first diverge to different days
//   - subsequent dawns stay quiet
//   - a save reloaded mid-pending-state (split happened, never compose)
//     still fires the brag on next dawn
//   - merge-back-then-split-again does NOT re-fire (audit flag holds)

import { describe, it, expect } from 'vitest';
import {
  splitRecordDawnBrag,
  resetMineHaul,
  recordMined,
  getMineHaul,
} from '../src/game/mining-haul';
import type { Player } from '../src/world/world';

function mkPlayer(): Player {
  return {
    x: 0,
    y: 0,
    facing: 'down',
    gold: 0,
    inventory: {},
  } as unknown as Player;
}

describe('splitRecordDawnBrag — silence cases', () => {
  it('returns empty on a fresh save (no record yet)', () => {
    const p = mkPlayer();
    expect(splitRecordDawnBrag(getMineHaul(p))).toBe('');
  });

  it('returns empty on a save with only a count record set (gold record still zero)', () => {
    const p = mkPlayer();
    // A run with only copper — count goes up, gold goes up (copper sells), but
    // both records are set on the same day. Sleeps on day 5.
    recordMined(p, 'copper');
    recordMined(p, 'copper');
    resetMineHaul(p, 5);
    expect(splitRecordDawnBrag(getMineHaul(p))).toBe('');
    // Both records are set + on the same day, not split.
    const best = getMineHaul(p).bestRun!;
    expect(best.countDay).toBe(5);
    expect(best.goldDay).toBe(5);
  });

  it('returns empty while records stay merged across multiple sleep cycles', () => {
    const p = mkPlayer();
    // Day 5: 2 copper run.
    recordMined(p, 'copper');
    recordMined(p, 'copper');
    resetMineHaul(p, 5);
    // Day 7: 4 copper run — beats the count, gold also bumps because
    // it's still pure copper (same day for both records).
    recordMined(p, 'copper');
    recordMined(p, 'copper');
    recordMined(p, 'copper');
    recordMined(p, 'copper');
    resetMineHaul(p, 7);
    const best = getMineHaul(p).bestRun!;
    expect(best.countDay).toBe(7);
    expect(best.goldDay).toBe(7);
    expect(splitRecordDawnBrag(getMineHaul(p))).toBe('');
  });
});

describe('splitRecordDawnBrag — fires exactly once on split transition', () => {
  it('fires on the dawn after countDay and goldDay first diverge', () => {
    const p = mkPlayer();
    // Day 5: 4 copper — count=4, gold=4*8=32 (copper sells at 8).
    for (let i = 0; i < 4; i++) recordMined(p, 'copper');
    resetMineHaul(p, 5);
    // Day 10: 1 ruby — count=1 (doesn't beat 4), gold=80 (beats 32).
    // Now goldDay=10, countDay=5 → SPLIT.
    recordMined(p, 'ruby');
    resetMineHaul(p, 10);
    const brag = splitRecordDawnBrag(getMineHaul(p));
    expect(brag).toContain('Split mining records');
    expect(brag).toContain('day 5');
    expect(brag).toContain('day 10');
  });

  it('arms the pending flag on the day the split first happens', () => {
    const p = mkPlayer();
    for (let i = 0; i < 4; i++) recordMined(p, 'copper');
    resetMineHaul(p, 5);
    expect(getMineHaul(p).splitRecordBragPending).toBeFalsy();
    recordMined(p, 'ruby');
    resetMineHaul(p, 10);
    expect(getMineHaul(p).splitRecordBragPending).toBe(true);
  });

  it('clears the pending flag after the brag fires', () => {
    const p = mkPlayer();
    for (let i = 0; i < 4; i++) recordMined(p, 'copper');
    resetMineHaul(p, 5);
    recordMined(p, 'ruby');
    resetMineHaul(p, 10);
    splitRecordDawnBrag(getMineHaul(p));
    expect(getMineHaul(p).splitRecordBragPending).toBeFalsy();
  });

  it('sets the audit flag after the brag fires', () => {
    const p = mkPlayer();
    for (let i = 0; i < 4; i++) recordMined(p, 'copper');
    resetMineHaul(p, 5);
    recordMined(p, 'ruby');
    resetMineHaul(p, 10);
    expect(getMineHaul(p).splitRecordBragFired).toBeFalsy();
    splitRecordDawnBrag(getMineHaul(p));
    expect(getMineHaul(p).splitRecordBragFired).toBe(true);
  });

  it('a second call on the same dawn returns the empty string', () => {
    const p = mkPlayer();
    for (let i = 0; i < 4; i++) recordMined(p, 'copper');
    resetMineHaul(p, 5);
    recordMined(p, 'ruby');
    resetMineHaul(p, 10);
    expect(splitRecordDawnBrag(getMineHaul(p))).not.toBe('');
    expect(splitRecordDawnBrag(getMineHaul(p))).toBe('');
  });
});

describe('splitRecordDawnBrag — does not re-fire on merge-then-split-again', () => {
  it('after the brag fires once, a merge-back + re-split does NOT re-arm', () => {
    const p = mkPlayer();
    // Set the split-record state and fire the brag.
    for (let i = 0; i < 4; i++) recordMined(p, 'copper');
    resetMineHaul(p, 5);
    recordMined(p, 'ruby');
    resetMineHaul(p, 10);
    splitRecordDawnBrag(getMineHaul(p));
    expect(getMineHaul(p).splitRecordBragFired).toBe(true);
    // Day 20: a fat run that blows past BOTH records — merges them back.
    // 20 rubies = count 20 (vs 4) and gold 1600 (vs 80). Both records
    // now on day 20.
    for (let i = 0; i < 20; i++) recordMined(p, 'ruby');
    resetMineHaul(p, 20);
    const best = getMineHaul(p).bestRun!;
    expect(best.countDay).toBe(20);
    expect(best.goldDay).toBe(20);
    // Day 30: a count-only run (lots of copper, but not enough gold to
    // beat 1600). 21 copper = count 21 (>20), gold 168 (<1600). Splits
    // the records again, but the brag stays silent.
    for (let i = 0; i < 21; i++) recordMined(p, 'copper');
    resetMineHaul(p, 30);
    const after = getMineHaul(p).bestRun!;
    expect(after.countDay).toBe(30);
    expect(after.goldDay).toBe(20);
    expect(getMineHaul(p).splitRecordBragPending).toBeFalsy();
    expect(splitRecordDawnBrag(getMineHaul(p))).toBe('');
  });
});

describe('splitRecordDawnBrag — does not arm on saves already split before the flag landed', () => {
  it('a save that is ALREADY split when resetMineHaul runs (no transition) does NOT arm', () => {
    const p = mkPlayer();
    // Manually set the split state on the ribbon — this simulates an
    // older save that already had split records BEFORE the brag was
    // introduced. The pre-update wasSplit check guards against this.
    const state = getMineHaul(p);
    state.bestRun = { count: 5, countDay: 3, gold: 100, goldDay: 7 };
    // A new sleep with NO mining: the empty-run guard skips the whole
    // record-update block, so no arming.
    resetMineHaul(p, 9);
    expect(getMineHaul(p).splitRecordBragPending).toBeFalsy();
  });

  it('an already-split save with a NON-record-breaking run does NOT re-arm', () => {
    const p = mkPlayer();
    const state = getMineHaul(p);
    state.bestRun = { count: 10, countDay: 3, gold: 200, goldDay: 7 };
    // Small run: 1 copper. count=1 (<10), gold=8 (<200). Neither
    // record moves; ribbon stays the same; still split, no transition.
    recordMined(p, 'copper');
    resetMineHaul(p, 9);
    expect(getMineHaul(p).splitRecordBragPending).toBeFalsy();
  });
});

describe('splitRecordDawnBrag — defensive', () => {
  it('returns the empty string when pending is armed but bestRun is somehow missing', () => {
    const p = mkPlayer();
    const state = getMineHaul(p);
    // Manually arm but leave bestRun undefined — corrupted save state.
    state.splitRecordBragPending = true;
    expect(splitRecordDawnBrag(state)).toBe('');
    // The helper still clears the pending flag so the bad state
    // doesn't haunt subsequent dawns.
    expect(state.splitRecordBragPending).toBeFalsy();
  });
});

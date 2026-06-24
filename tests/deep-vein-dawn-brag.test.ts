// Deep Vein dawn brag — one-shot celebratory tail the morning AFTER
// the player's bestRun crossed either deep-vein threshold for the
// first time.
//
// Captured inside resetMineHaul via a sticky deepVeinBragPending flag
// so the SAME dawn that surfaces haulYesterdayLine + the "best run
// ever!" ribbon also surfaces a dedicated "Deep Vein unlocked" tail
// naming the specific composition that earned the badge. Two flags
// on MineHaulState — bragPending (one-shot trigger), bragFired
// (sticky audit) — both round-trip through persistence.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  DEEP_VEIN_COUNT,
  DEEP_VEIN_GOLD,
  deepVeinDawnBrag,
  getMineHaul,
  recordMined,
  resetMineHaul,
} from '../src/game/mining-haul';
import type { GemKey } from '../src/game/gems';
import { GEMS } from '../src/game/gems';

function priciestGem(): GemKey {
  let priciest: GemKey = 'copper';
  let maxPrice = 0;
  for (const k of Object.keys(GEMS) as GemKey[]) {
    if (GEMS[k].sellPrice > maxPrice) {
      maxPrice = GEMS[k].sellPrice;
      priciest = k;
    }
  }
  return priciest;
}

describe('deepVeinDawnBrag — silence conditions', () => {
  it('returns empty on a fresh save (no bestRun, no flag)', () => {
    const w = new World();
    expect(deepVeinDawnBrag(getMineHaul(w.player))).toBe('');
  });

  it('returns empty when a small run is captured (no threshold crossing)', () => {
    const w = new World();
    for (let i = 0; i < 5; i++) recordMined(w.player, 'copper');
    resetMineHaul(w.player, 3);
    expect(deepVeinDawnBrag(getMineHaul(w.player))).toBe('');
  });

  it('returns empty when the bag was empty at sleep (no record promotion)', () => {
    const w = new World();
    resetMineHaul(w.player, 3);
    expect(deepVeinDawnBrag(getMineHaul(w.player))).toBe('');
  });
});

describe('deepVeinDawnBrag — fires on fresh count crossing', () => {
  it('fires when bestRun.count crosses DEEP_VEIN_COUNT', () => {
    const w = new World();
    for (let i = 0; i < DEEP_VEIN_COUNT; i++) recordMined(w.player, 'copper');
    resetMineHaul(w.player, 4);
    const brag = deepVeinDawnBrag(getMineHaul(w.player));
    expect(brag).toContain('Deep Vein unlocked');
    expect(brag).toContain(String(DEEP_VEIN_COUNT));
    expect(brag).toContain('gem');
  });

  it('mentions the run\'s pulled-out count', () => {
    const w = new World();
    for (let i = 0; i < DEEP_VEIN_COUNT; i++) recordMined(w.player, 'copper');
    resetMineHaul(w.player, 4);
    const brag = deepVeinDawnBrag(getMineHaul(w.player));
    expect(brag).toMatch(new RegExp(`${DEEP_VEIN_COUNT}\\s+gem`));
  });
});

describe('deepVeinDawnBrag — fires on fresh gold crossing', () => {
  it('fires when bestRun.gold crosses DEEP_VEIN_GOLD with few gems', () => {
    const w = new World();
    const priciest = priciestGem();
    const needed = Math.ceil(DEEP_VEIN_GOLD / GEMS[priciest].sellPrice);
    for (let i = 0; i < needed; i++) recordMined(w.player, priciest);
    resetMineHaul(w.player, 7);
    const brag = deepVeinDawnBrag(getMineHaul(w.player));
    expect(brag).toContain('Deep Vein unlocked');
    // When count is below DEEP_VEIN_COUNT, the brag should name the
    // gold figure — not a misleading count-based wording.
    const state = getMineHaul(w.player);
    if (state.bestRun!.count < DEEP_VEIN_COUNT) {
      expect(brag).toContain(`${state.bestRun!.gold}g`);
    }
  });
});

describe('deepVeinDawnBrag — both axes crossed', () => {
  it('mentions both count AND gold when a single run crosses both', () => {
    const w = new World();
    // Pile in 20 copper (count crossing). That alone won't hit
    // DEEP_VEIN_GOLD because copper sells for ~12g — so a 20-copper
    // run is only 240g. Add a few high-tier gems to pump gold past
    // the bar in the SAME run.
    const priciest = priciestGem();
    const needed = Math.ceil(DEEP_VEIN_GOLD / GEMS[priciest].sellPrice);
    for (let i = 0; i < DEEP_VEIN_COUNT; i++) recordMined(w.player, 'copper');
    for (let i = 0; i < needed; i++) recordMined(w.player, priciest);
    resetMineHaul(w.player, 9);
    const brag = deepVeinDawnBrag(getMineHaul(w.player));
    expect(brag).toContain('Deep Vein unlocked');
    expect(brag).toMatch(/\d+\s+gems/);
    expect(brag).toContain('g in one run');
  });
});

describe('deepVeinDawnBrag — one-shot semantics', () => {
  it('is ONE-SHOT: second call returns empty', () => {
    const w = new World();
    for (let i = 0; i < DEEP_VEIN_COUNT; i++) recordMined(w.player, 'copper');
    resetMineHaul(w.player, 4);
    expect(deepVeinDawnBrag(getMineHaul(w.player))).toContain('Deep Vein');
    expect(deepVeinDawnBrag(getMineHaul(w.player))).toBe('');
  });

  it('does not re-fire on a SECOND record-breaking run', () => {
    const w = new World();
    for (let i = 0; i < DEEP_VEIN_COUNT; i++) recordMined(w.player, 'copper');
    resetMineHaul(w.player, 4);
    // Consume the brag.
    deepVeinDawnBrag(getMineHaul(w.player));
    // Beat the record with a much bigger run on another day.
    for (let i = 0; i < DEEP_VEIN_COUNT * 2; i++) recordMined(w.player, 'copper');
    resetMineHaul(w.player, 10);
    // No second brag — the player already saw it the first time.
    expect(deepVeinDawnBrag(getMineHaul(w.player))).toBe('');
  });

  it('does not fire when the player was ALREADY past the deep-vein bar before the run', () => {
    const w = new World();
    // First run: crosses deep-vein.
    for (let i = 0; i < DEEP_VEIN_COUNT; i++) recordMined(w.player, 'copper');
    resetMineHaul(w.player, 4);
    // Brag fires once for that run.
    expect(deepVeinDawnBrag(getMineHaul(w.player))).toContain('Deep Vein');
    // Second run starts well past the deep-vein bar — even a record-
    // breaking promotion should NOT re-fire the brag.
    for (let i = 0; i < DEEP_VEIN_COUNT + 5; i++) recordMined(w.player, 'copper');
    resetMineHaul(w.player, 11);
    expect(deepVeinDawnBrag(getMineHaul(w.player))).toBe('');
  });

  it('sets deepVeinBragFired after firing so the audit trail is permanent', () => {
    const w = new World();
    for (let i = 0; i < DEEP_VEIN_COUNT; i++) recordMined(w.player, 'copper');
    resetMineHaul(w.player, 4);
    deepVeinDawnBrag(getMineHaul(w.player));
    expect(getMineHaul(w.player).deepVeinBragFired).toBe(true);
    // Pending flag is cleared (undefined or false — both falsy are
    // acceptable contracts for a ?: boolean field). Persistence
    // coerces via `=== true` so the in-memory shape doesn't need to
    // be strict-equal-false.
    expect(getMineHaul(w.player).deepVeinBragPending).toBeFalsy();
  });
});

describe('deepVeinDawnBrag — pending-flag mechanics', () => {
  it('sets deepVeinBragPending=true on the fresh-crossing reset', () => {
    const w = new World();
    for (let i = 0; i < DEEP_VEIN_COUNT; i++) recordMined(w.player, 'copper');
    resetMineHaul(w.player, 4);
    expect(getMineHaul(w.player).deepVeinBragPending).toBe(true);
  });

  it('does NOT set deepVeinBragPending on a small (below-threshold) run', () => {
    const w = new World();
    for (let i = 0; i < 3; i++) recordMined(w.player, 'copper');
    resetMineHaul(w.player, 4);
    expect(getMineHaul(w.player).deepVeinBragPending).toBeFalsy();
  });

  it('respects deepVeinBragFired — bragPending stays false on a re-crossing if the brag has already fired', () => {
    const w = new World();
    // Fire the brag.
    for (let i = 0; i < DEEP_VEIN_COUNT; i++) recordMined(w.player, 'copper');
    resetMineHaul(w.player, 4);
    deepVeinDawnBrag(getMineHaul(w.player));
    // Simulate an older-save reload where deepVeinBragFired survives
    // but somehow the bestRun got reset below threshold (test
    // contract: pending should NOT re-arm on re-crossing).
    const s = getMineHaul(w.player);
    s.bestRun = { count: 0, countDay: 0, gold: 0, goldDay: 0 };
    s.deepVeinBragPending = false;
    // Mine + sleep again — this would normally arm a fresh crossing,
    // but because deepVeinBragFired is true the pending flag stays off.
    for (let i = 0; i < DEEP_VEIN_COUNT; i++) recordMined(w.player, 'copper');
    resetMineHaul(w.player, 12);
    expect(getMineHaul(w.player).deepVeinBragPending).toBeFalsy();
  });
});

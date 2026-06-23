// Owl-menu chain-bonus payout chip — surfaces the heart-points
// multiplier the player would lock in if they pressed Enter on this
// row now. Reuses chainBonusMultiplier + previewChainLength so the
// chip stays in lockstep with the actual payout the dispatch awards.

import { describe, it, expect } from 'vitest';
import {
  chainBonusChip,
  dispatchOwl,
  getOwlStamps,
  recordOwlChain,
} from '../src/game/owl-post';
import { CANDIDATES } from '../src/game/hearts';
import { World } from '../src/world/world';

const NPC_A = 'maple';
const NPC_B = Object.keys(CANDIDATES).find((id) => id !== NPC_A)!;

function loadedPlayer(): World {
  const w = new World();
  w.player.gold = 5000;
  w.player.inventory.flower_harvest = 50;
  w.player.inventory.ruby = 50;
  if (!w.player.hearts) w.player.hearts = {};
  for (const id of Object.keys(CANDIDATES)) {
    w.player.hearts[id] = { points: 0, lastGiftDay: -1, lastTalkDay: 0 };
  }
  return w;
}

describe('chainBonusChip — silence floor', () => {
  it('returns empty on a fresh save (preview chain at floor)', () => {
    const w = loadedPlayer();
    expect(chainBonusChip(w.player, NPC_A, 5)).toBe('');
  });

  it('returns empty on the same-day re-preview (no bump)', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    // Same-day re-preview returns the existing length 1 = no bonus.
    expect(chainBonusChip(w.player, NPC_A, 5)).toBe('');
  });

  it('returns empty when switching recipients (chain resets to 1)', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    recordOwlChain(w.player, NPC_A, 6); // chain at 2 on NPC_A
    // Switching to NPC_B previews length 1 = no bonus.
    expect(chainBonusChip(w.player, NPC_B, 7)).toBe('');
  });

  it('returns empty when skipping a day on the active recipient', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    recordOwlChain(w.player, NPC_A, 6); // chain at 2
    // Skip day 7 -> day 8 previews a fresh chain at length 1.
    expect(chainBonusChip(w.player, NPC_A, 8)).toBe('');
  });
});

describe('chainBonusChip — per-tier wording', () => {
  it('returns "+10% hearts" when previewing tier 1 (length 2)', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    expect(chainBonusChip(w.player, NPC_A, 6)).toBe('+10% hearts');
  });

  it('returns "+10% hearts" when previewing length 3 (still tier 1)', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    recordOwlChain(w.player, NPC_A, 6);
    expect(chainBonusChip(w.player, NPC_A, 7)).toBe('+10% hearts');
  });

  it('returns "+20% hearts" when previewing tier 2 (length 4)', () => {
    const w = loadedPlayer();
    for (let d = 5; d <= 7; d++) recordOwlChain(w.player, NPC_A, d);
    expect(chainBonusChip(w.player, NPC_A, 8)).toBe('+20% hearts');
  });

  it('returns "+20% hearts" when previewing length 6 (still tier 2)', () => {
    const w = loadedPlayer();
    for (let d = 5; d <= 9; d++) recordOwlChain(w.player, NPC_A, d);
    expect(chainBonusChip(w.player, NPC_A, 10)).toBe('+20% hearts');
  });

  it('returns "+30% hearts" when previewing tier 3 (length 7)', () => {
    const w = loadedPlayer();
    for (let d = 5; d <= 10; d++) recordOwlChain(w.player, NPC_A, d);
    expect(chainBonusChip(w.player, NPC_A, 11)).toBe('+30% hearts');
  });

  it('stays at "+30% hearts" at the cap (length 10 = top tier)', () => {
    const w = loadedPlayer();
    for (let d = 5; d <= 13; d++) recordOwlChain(w.player, NPC_A, d);
    expect(chainBonusChip(w.player, NPC_A, 14)).toBe('+30% hearts');
  });
});

describe('chainBonusChip — per-NPC isolation', () => {
  it('reads pending chain on the queried npc independent of the active chain target', () => {
    const w = loadedPlayer();
    // Long chain on NPC_A.
    for (let d = 5; d <= 10; d++) recordOwlChain(w.player, NPC_A, d);
    // Chip for NPC_B is empty — the player hasn't started a chain on them.
    expect(chainBonusChip(w.player, NPC_B, 11)).toBe('');
    // Chip for NPC_A still surfaces the active chain bonus.
    expect(chainBonusChip(w.player, NPC_A, 11)).toBe('+30% hearts');
  });
});

describe('chainBonusChip — pure read', () => {
  it('does NOT mutate state', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    const book = getOwlStamps(w.player);
    const snapshot = JSON.stringify({
      chain: book.chain,
      counts: book.counts,
      pendingFlag: book.chainTierBragPending,
    });
    chainBonusChip(w.player, NPC_A, 6);
    chainBonusChip(w.player, NPC_B, 6);
    chainBonusChip(w.player, NPC_A, 100);
    const after = JSON.stringify({
      chain: book.chain,
      counts: book.counts,
      pendingFlag: book.chainTierBragPending,
    });
    expect(after).toEqual(snapshot);
  });
});

describe('chainBonusChip — real dispatchOwl integration', () => {
  it('two consecutive-day dispatches put the chip at "+10% hearts" for the same-day preview', () => {
    const w = loadedPlayer();
    dispatchOwl(w.player, NPC_A, 5);
    dispatchOwl(w.player, NPC_A, 6); // chain length 2 after this send
    // Same-day re-preview returns existing length (still 2 -> +10%).
    expect(chainBonusChip(w.player, NPC_A, 6)).toBe('+10% hearts');
    // Next-day preview bumps to length 3 — still tier 1 (1.1x).
    expect(chainBonusChip(w.player, NPC_A, 7)).toBe('+10% hearts');
  });

  it('four consecutive-day dispatches put the next-day preview at "+20% hearts" (length 5 stays at tier 2)', () => {
    const w = loadedPlayer();
    for (let d = 5; d <= 8; d++) dispatchOwl(w.player, NPC_A, d);
    // Chain length 4 after the day-8 send. Next-day preview = 5 (tier 2).
    expect(chainBonusChip(w.player, NPC_A, 9)).toBe('+20% hearts');
  });
});

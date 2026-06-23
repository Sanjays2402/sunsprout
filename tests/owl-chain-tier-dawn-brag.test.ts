// Owl-post chain-tier dawn brag — one-shot celebratory dawn-toast
// tail the morning AFTER the active chain crossed into a new bonus
// tier (length 2 -> 1.1x, length 4 -> 1.2x, length 7 -> 1.3x).
//
// Sticky flag pattern mirrors deep-vein-dawn-brag: the flag is set
// inside recordOwlChain on a tier crossing, and the composer reads
// + clears it on the next dawn so a player who skips a few days
// doesn't see the same brag re-fire. Survives reload via persistence.

import { describe, it, expect } from 'vitest';
import {
  OWL_CHAIN_TIER_LABEL,
  chainTierDawnBrag,
  dispatchOwl,
  getOwlChain,
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
  // Give Maple-loved + Pip-loved gifts so a chain holds across recipients.
  w.player.inventory.flower_harvest = 50;
  w.player.inventory.ruby = 50;
  if (!w.player.hearts) w.player.hearts = {};
  for (const id of Object.keys(CANDIDATES)) {
    w.player.hearts[id] = { points: 0, lastGiftDay: -1, lastTalkDay: 0 };
  }
  return w;
}

describe('OWL_CHAIN_TIER_LABEL — label table sanity', () => {
  it('has entries for the three bonus-tier multipliers', () => {
    expect(OWL_CHAIN_TIER_LABEL['1.1']).toBeTruthy();
    expect(OWL_CHAIN_TIER_LABEL['1.2']).toBeTruthy();
    expect(OWL_CHAIN_TIER_LABEL['1.3']).toBeTruthy();
  });

  it('labels are short single words (slot into the brag sentence)', () => {
    for (const label of Object.values(OWL_CHAIN_TIER_LABEL)) {
      expect(label.split(' ').length).toBe(1);
    }
  });
});

describe('chainTierDawnBrag — silence conditions', () => {
  it('returns empty on a fresh save (no pending flag)', () => {
    const w = loadedPlayer();
    expect(chainTierDawnBrag(w.player)).toBe('');
  });

  it('returns empty after the floor send (length 1, no tier crossing)', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    expect(chainTierDawnBrag(w.player)).toBe('');
  });

  it('returns empty when the chain is reset to length 1 (recipient swap)', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    recordOwlChain(w.player, NPC_B, 6);
    expect(chainTierDawnBrag(w.player)).toBe('');
  });

  it('returns empty when the chain is reset to length 1 (day skip)', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    // Skip day 6 -> day 7 lands a fresh chain at length 1.
    recordOwlChain(w.player, NPC_A, 7);
    expect(chainTierDawnBrag(w.player)).toBe('');
  });
});

describe('chainTierDawnBrag — fires on tier 1 crossing (length 2 -> 1.1x)', () => {
  it('arms the pending flag on the length-2 bump', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    recordOwlChain(w.player, NPC_A, 6);
    expect(getOwlStamps(w.player).chainTierBragPending).toBe(1.1);
  });

  it('renders the "starting" tier brag with +10%', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    recordOwlChain(w.player, NPC_A, 6);
    const brag = chainTierDawnBrag(w.player);
    expect(brag).toContain('starting');
    expect(brag).toContain('+10%');
  });
});

describe('chainTierDawnBrag — fires on tier 2 crossing (length 4 -> 1.2x)', () => {
  it('arms the pending flag on the length-4 bump', () => {
    const w = loadedPlayer();
    for (let d = 5; d <= 7; d++) recordOwlChain(w.player, NPC_A, d);
    // Consume the length-2 brag.
    chainTierDawnBrag(w.player);
    // Length-4 send.
    recordOwlChain(w.player, NPC_A, 8);
    expect(getOwlStamps(w.player).chainTierBragPending).toBe(1.2);
  });

  it('renders the "regular" tier brag with +20%', () => {
    const w = loadedPlayer();
    for (let d = 5; d <= 7; d++) recordOwlChain(w.player, NPC_A, d);
    chainTierDawnBrag(w.player);
    recordOwlChain(w.player, NPC_A, 8);
    const brag = chainTierDawnBrag(w.player);
    expect(brag).toContain('regular');
    expect(brag).toContain('+20%');
  });
});

describe('chainTierDawnBrag — fires on tier 3 crossing (length 7 -> 1.3x)', () => {
  it('arms the pending flag on the length-7 bump', () => {
    const w = loadedPlayer();
    for (let d = 5; d <= 10; d++) recordOwlChain(w.player, NPC_A, d);
    // Consume any intermediate brags.
    chainTierDawnBrag(w.player);
    chainTierDawnBrag(w.player);
    // Length-7 send.
    recordOwlChain(w.player, NPC_A, 11);
    expect(getOwlStamps(w.player).chainTierBragPending).toBe(1.3);
  });

  it('renders the "favorite" tier brag with +30%', () => {
    const w = loadedPlayer();
    for (let d = 5; d <= 10; d++) recordOwlChain(w.player, NPC_A, d);
    chainTierDawnBrag(w.player);
    chainTierDawnBrag(w.player);
    recordOwlChain(w.player, NPC_A, 11);
    const brag = chainTierDawnBrag(w.player);
    expect(brag).toContain('favorite');
    expect(brag).toContain('+30%');
  });
});

describe('chainTierDawnBrag — one-shot semantics', () => {
  it('returns empty on a second call after firing', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    recordOwlChain(w.player, NPC_A, 6);
    expect(chainTierDawnBrag(w.player)).toContain('starting');
    expect(chainTierDawnBrag(w.player)).toBe('');
  });

  it('does not re-fire when the chain extends WITHIN the same tier', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    recordOwlChain(w.player, NPC_A, 6);
    chainTierDawnBrag(w.player);
    // Length 3 still 1.1x — no crossing.
    recordOwlChain(w.player, NPC_A, 7);
    expect(chainTierDawnBrag(w.player)).toBe('');
  });

  it('re-arms when the chain crosses a DIFFERENT tier later', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    recordOwlChain(w.player, NPC_A, 6);
    chainTierDawnBrag(w.player); // tier 1
    recordOwlChain(w.player, NPC_A, 7);
    recordOwlChain(w.player, NPC_A, 8); // tier 2 (length 4 -> 1.2x)
    expect(getOwlStamps(w.player).chainTierBragPending).toBe(1.2);
  });

  it('chain-reset between crossing and dawn still fires the brag (player-level celebration)', () => {
    const w = loadedPlayer();
    // Land a tier 1 crossing on day 6.
    recordOwlChain(w.player, NPC_A, 5);
    recordOwlChain(w.player, NPC_A, 6);
    // Player skips day 7, lands a fresh chain on day 8 — chain has
    // reset to length 1, but the brag should still fire on dawn.
    recordOwlChain(w.player, NPC_A, 8);
    expect(getOwlChain(w.player).length).toBe(1);
    // Brag still fires — it celebrates the crossing that HAPPENED,
    // not the live chain state.
    expect(chainTierDawnBrag(w.player)).toContain('starting');
  });
});

describe('chainTierDawnBrag wires through dispatchOwl', () => {
  it('a real dispatch on the length-2 bump arms the brag', () => {
    const w = loadedPlayer();
    dispatchOwl(w.player, NPC_A, 5);
    dispatchOwl(w.player, NPC_A, 6);
    expect(getOwlStamps(w.player).chainTierBragPending).toBe(1.1);
  });

  it('a same-day re-dispatch does NOT re-arm the brag', () => {
    const w = loadedPlayer();
    dispatchOwl(w.player, NPC_A, 5);
    dispatchOwl(w.player, NPC_A, 6); // arms 1.1
    // Same-day re-dispatch is rejected by the per-day gate; the chain
    // doesn't bump and the brag flag stays at the value it already
    // held (1.1).
    dispatchOwl(w.player, NPC_A, 6);
    expect(getOwlStamps(w.player).chainTierBragPending).toBe(1.1);
  });
});

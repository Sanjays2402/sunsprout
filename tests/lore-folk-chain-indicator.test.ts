// Lore Folk row owl-post chain indicator — surfaces an active
// consecutive-day owl-post chain with a specific NPC as a tail on
// the Folk row description ("Chain: 4 days."). Surfaces only when
// the active chain is anchored to THIS NPC and has at least 2 links
// (a single-day chain is the floor — no signal worth surfacing).
//
// Reads off the same OwlStampBook.chain field that drove the
// dispatch bonus, so a player who broke the streak by switching
// recipients sees the new chain on the new NPC and the old tail
// disappears the same dawn the chain breaks.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { buildLoreRows } from '../src/game/lore';
import { CANDIDATES } from '../src/game/hearts';
import {
  dispatchOwl,
  recordOwlChain,
} from '../src/game/owl-post';

const NPC_A = 'maple';
const NPC_B = Object.keys(CANDIDATES).find((id) => id !== NPC_A)!;

function seedHearts(world: World): void {
  if (!world.player.hearts) world.player.hearts = {};
  for (const id of Object.keys(CANDIDATES)) {
    world.player.hearts[id] = { points: 5, lastGiftDay: -1, lastTalkDay: 0 };
  }
}

function folkRow(world: World, id: string) {
  return buildLoreRows(world.player).find((r) => r.category === 'Folk' && r.id === id);
}

describe('Folk row chain indicator — surfaces only on length >= 2', () => {
  it('absent on a fresh save (no chain)', () => {
    const w = new World();
    seedHearts(w);
    const row = folkRow(w, NPC_A);
    expect(row).toBeDefined();
    expect(row!.description).not.toMatch(/Chain:/);
  });

  it('absent at length 1 (single-day chain, no signal yet)', () => {
    const w = new World();
    seedHearts(w);
    recordOwlChain(w.player, NPC_A, 5);
    const row = folkRow(w, NPC_A);
    expect(row!.description).not.toMatch(/Chain:/);
  });

  it('appears at length 2 with the day count', () => {
    const w = new World();
    seedHearts(w);
    recordOwlChain(w.player, NPC_A, 5);
    recordOwlChain(w.player, NPC_A, 6);
    const row = folkRow(w, NPC_A);
    expect(row!.description).toMatch(/Chain: 2 days\./);
  });

  it('grows with the chain length', () => {
    const w = new World();
    seedHearts(w);
    for (let d = 5; d <= 11; d++) {
      recordOwlChain(w.player, NPC_A, d);
    }
    const row = folkRow(w, NPC_A);
    expect(row!.description).toMatch(/Chain: 7 days\./);
  });
});

describe('Folk row chain indicator — per-NPC isolation', () => {
  it('only the active recipient surfaces the chain', () => {
    const w = new World();
    seedHearts(w);
    recordOwlChain(w.player, NPC_A, 5);
    recordOwlChain(w.player, NPC_A, 6);
    recordOwlChain(w.player, NPC_A, 7);
    const rowA = folkRow(w, NPC_A);
    const rowB = folkRow(w, NPC_B);
    expect(rowA!.description).toMatch(/Chain: 3 days\./);
    expect(rowB!.description).not.toMatch(/Chain:/);
  });

  it('switching recipients drops the old chain tail', () => {
    const w = new World();
    seedHearts(w);
    recordOwlChain(w.player, NPC_A, 5);
    recordOwlChain(w.player, NPC_A, 6);
    recordOwlChain(w.player, NPC_A, 7);
    // Player switches to NPC_B on day 8 — chain resets there.
    recordOwlChain(w.player, NPC_B, 8);
    const rowA = folkRow(w, NPC_A);
    const rowB = folkRow(w, NPC_B);
    // NPC_A used to have a 3-day chain. After the swap, NPC_A's tail
    // is GONE (chain.npcId is now NPC_B, so activeChainLength on A is
    // 0). NPC_B's chain is length 1 (still below the surface gate).
    expect(rowA!.description).not.toMatch(/Chain:/);
    expect(rowB!.description).not.toMatch(/Chain:/);
  });

  it('breaking the chain via a skipped day drops the tail', () => {
    const w = new World();
    seedHearts(w);
    recordOwlChain(w.player, NPC_A, 5);
    recordOwlChain(w.player, NPC_A, 6);
    recordOwlChain(w.player, NPC_A, 7);
    // Skip day 8, send on day 9 — chain resets to 1.
    recordOwlChain(w.player, NPC_A, 9);
    const row = folkRow(w, NPC_A);
    expect(row!.description).not.toMatch(/Chain:/);
  });
});

describe('Folk row chain indicator — coexists with other Folk tails', () => {
  it('chain tail appears alongside the lifetime owl-stamps tail', () => {
    const w = new World();
    seedHearts(w);
    w.player.gold = 10000;
    w.player.inventory.flower_harvest = 100;
    // Send daily for 3 days so we get both the stamp count and a chain.
    for (let d = 5; d <= 7; d++) {
      const out = dispatchOwl(w.player, NPC_A, d);
      expect(out.kind).toBe('sent');
    }
    const row = folkRow(w, NPC_A);
    // Lifetime stamps tail (count = 3, no tier yet since first tier = 5).
    expect(row!.description).toMatch(/Owl posts: 3\./);
    // Chain tail (length = 3).
    expect(row!.description).toMatch(/Chain: 3 days\./);
    // Both come AFTER the hearts/loves header.
    const idxStamps = row!.description.indexOf('Owl posts:');
    const idxChain = row!.description.indexOf('Chain:');
    expect(idxChain).toBeGreaterThan(idxStamps);
  });

  it('chain tail appears alongside the fluency tier wording at high counts', () => {
    const w = new World();
    seedHearts(w);
    // Get NPC_A to bronze tier (5 lifetime stamps via OWL_FLUENCY_TIERS[0].min)
    // by dispatching daily for 5 days — both the chain (length 5) and
    // the fluency tier (bronze) light up together.
    w.player.gold = 10000;
    w.player.inventory.flower_harvest = 100;
    for (let d = 5; d < 10; d++) {
      const out = dispatchOwl(w.player, NPC_A, d);
      expect(out.kind).toBe('sent');
    }
    const row = folkRow(w, NPC_A);
    expect(row!.description).toMatch(/occasional pen pal/);
    expect(row!.description).toMatch(/Chain: 5 days\./);
  });
});

describe('Non-Folk rows do NOT carry the chain tail', () => {
  it('Fish/Gems/Forage/Crops/Rumors descriptions never include "Chain:"', () => {
    const w = new World();
    seedHearts(w);
    recordOwlChain(w.player, NPC_A, 5);
    recordOwlChain(w.player, NPC_A, 6);
    const rows = buildLoreRows(w.player);
    for (const r of rows) {
      if (r.category === 'Folk') continue;
      expect(r.description).not.toMatch(/Chain:/);
    }
  });
});

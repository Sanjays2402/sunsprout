// Owl post stamp book — lifetime per-NPC tally of owl deliveries
// dispatched from the farmhouse mailbox. Bumped INSIDE dispatchOwl on
// the only path that charges the fee, so failed dispatches don't
// stamp. Surfaced as " Owl posts: N." tail on the lore Folk row
// description; absent when count=0. Persisted through the lazy
// owlStamps field on Player.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  OWL_POST_FEE,
  dispatchOwl,
  getOwlStamps,
  owlStampsFor,
  owlStampLine,
  recordOwlStamp,
  totalOwlStamps,
} from '../src/game/owl-post';
import { CANDIDATES } from '../src/game/hearts';
import { buildLoreRows } from '../src/game/lore';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

/** Pick a known candidate id from the catalog so the dispatch path
 *  always lands on a real CANDIDATES row. */
function pickCandidate(): string {
  const ids = Object.keys(CANDIDATES);
  if (ids.length === 0) throw new Error('no candidates in fixture');
  return ids[0];
}

/** Build a fresh player with enough gold + a single loved gift in
 *  the bag so dispatchOwl can land. */
function ownerWithGiftAndGold(): { player: World['player']; npcId: string } {
  const w = new World();
  const p = w.player;
  p.inventory = {};
  p.gold = OWL_POST_FEE * 10;
  const npcId = pickCandidate();
  const def = CANDIDATES[npcId];
  // Drop one of every loved item in the bag so attemptAutoGift always
  // finds SOMETHING to send.
  for (const key of def.loved) {
    p.inventory[key] = 1;
  }
  // attemptAutoGift returns not-candidate when there's no hearts row,
  // even for a real CANDIDATES id — seed a zero-points row so the
  // dispatch path lands cleanly.
  p.hearts = { [npcId]: { points: 0, lastGiftDay: -1, lastTalkDay: -1 } };
  return { player: p, npcId };
}

describe('OwlStampBook — lazy accessor + recordOwlStamp', () => {
  it('getOwlStamps creates a fresh zero-init state on first read', () => {
    const p = {} as object;
    const b = getOwlStamps(p);
    expect(b.counts).toEqual({});
    expect(getOwlStamps(p)).toBe(b);
  });

  it('recordOwlStamp bumps the per-npc count and returns the new total', () => {
    const p = {} as object;
    expect(recordOwlStamp(p, 'maple')).toBe(1);
    expect(recordOwlStamp(p, 'maple')).toBe(2);
    expect(recordOwlStamp(p, 'pip')).toBe(1);
    expect(getOwlStamps(p).counts).toEqual({ maple: 2, pip: 1 });
  });

  it('owlStampsFor returns 0 on a missing npc', () => {
    const p = {} as object;
    expect(owlStampsFor(p, 'unknown')).toBe(0);
  });

  it('totalOwlStamps sums every npc', () => {
    const p = {} as object;
    recordOwlStamp(p, 'maple');
    recordOwlStamp(p, 'maple');
    recordOwlStamp(p, 'pip');
    expect(totalOwlStamps(p)).toBe(3);
  });
});

describe('owlStampLine — pretty per-row tail', () => {
  it('empty when the npc has 0 owl stamps', () => {
    expect(owlStampLine({}, 'maple')).toBe('');
  });

  it('formatted with the count when nonzero', () => {
    const p = {} as object;
    recordOwlStamp(p, 'maple');
    recordOwlStamp(p, 'maple');
    expect(owlStampLine(p, 'maple')).toBe('Owl posts: 2.');
  });
});

describe('dispatchOwl wires the stamp book', () => {
  it('a successful send bumps the per-npc stamp by 1', () => {
    const { player, npcId } = ownerWithGiftAndGold();
    const before = owlStampsFor(player, npcId);
    const out = dispatchOwl(player, npcId, 5);
    expect(out.kind).toBe('sent');
    expect(owlStampsFor(player, npcId)).toBe(before + 1);
  });

  it('a failed dispatch (not-enough-gold) does NOT stamp', () => {
    const { player, npcId } = ownerWithGiftAndGold();
    player.gold = OWL_POST_FEE - 1;
    const before = owlStampsFor(player, npcId);
    const out = dispatchOwl(player, npcId, 5);
    expect(out.kind).toBe('not-enough-gold');
    expect(owlStampsFor(player, npcId)).toBe(before);
  });

  it('a failed dispatch (no-items) does NOT stamp', () => {
    const w = new World();
    const p = w.player;
    p.inventory = {};
    p.gold = OWL_POST_FEE * 2;
    const npcId = pickCandidate();
    p.hearts = { [npcId]: { points: 0, lastGiftDay: -1, lastTalkDay: -1 } };
    const out = dispatchOwl(p, npcId, 5);
    expect(out.kind).toBe('no-items');
    expect(owlStampsFor(p, npcId)).toBe(0);
  });

  it('a failed dispatch (not-candidate) does NOT stamp', () => {
    const { player } = ownerWithGiftAndGold();
    const out = dispatchOwl(player, 'definitely-not-an-npc', 5);
    expect(out.kind).toBe('not-candidate');
    expect(totalOwlStamps(player)).toBe(0);
  });
});

describe('lore Folk tab description surfaces the owl tail', () => {
  it('Folk row has no owl tail when the player has never sent one', () => {
    const w = new World();
    // Seed at least one hearts row so the Folk row is in the lore output.
    const npcId = pickCandidate();
    w.player.hearts = { [npcId]: { points: 1, lastGiftDay: -1, lastTalkDay: 1 } };
    const rows = buildLoreRows(w.player);
    const folkRow = rows.find((r) => r.category === 'Folk' && r.id === npcId);
    expect(folkRow).toBeTruthy();
    expect(folkRow!.description).not.toContain('Owl posts:');
  });

  it('Folk row gains "Owl posts: N." tail once the player has sent some', () => {
    const w = new World();
    const npcId = pickCandidate();
    w.player.hearts = { [npcId]: { points: 1, lastGiftDay: -1, lastTalkDay: 1 } };
    recordOwlStamp(w.player, npcId);
    recordOwlStamp(w.player, npcId);
    recordOwlStamp(w.player, npcId);
    const rows = buildLoreRows(w.player);
    const folkRow = rows.find((r) => r.category === 'Folk' && r.id === npcId);
    expect(folkRow).toBeTruthy();
    expect(folkRow!.description).toContain('Owl posts: 3.');
  });
});

describe('persistence — owlStamps round-trip', () => {
  it('serializeGame + applySnapshot preserve the stamp book', () => {
    const game = {
      world: new World(),
      time: new TimeOfDay(),
    } as unknown as Game;
    // Stamp the book.
    recordOwlStamp(game.world.player, 'maple');
    recordOwlStamp(game.world.player, 'maple');
    recordOwlStamp(game.world.player, 'pip');
    const snap = serializeGame(game);
    expect(snap.player.owlStamps).toEqual({ counts: { maple: 2, pip: 1 } });
    // Re-apply on a fresh game.
    const game2 = {
      world: new World(),
      time: new TimeOfDay(),
    } as unknown as Game;
    applySnapshot(game2, snap);
    expect(owlStampsFor(game2.world.player, 'maple')).toBe(2);
    expect(owlStampsFor(game2.world.player, 'pip')).toBe(1);
    expect(totalOwlStamps(game2.world.player)).toBe(3);
  });

  it('a save with no owlStamps is safe to load (backfill via lazy reader)', () => {
    const game = {
      world: new World(),
      time: new TimeOfDay(),
    } as unknown as Game;
    const snap = serializeGame(game);
    expect(snap.player.owlStamps).toBeUndefined();
    const game2 = {
      world: new World(),
      time: new TimeOfDay(),
    } as unknown as Game;
    applySnapshot(game2, snap);
    expect(totalOwlStamps(game2.world.player)).toBe(0);
  });
});

// Owl-menu chain target sort — the player's active chain recipient
// floats to the top of the owl-menu rows so they can see which
// friendship they're actively maintaining without scrolling.
//
// Pure-helper layer (owlCandidateIdsForMenu) + menu-snapshot wiring
// (OwlMenu.open(player) snapshots the list so mid-session chain
// changes don't reorder rows under the player's selection).

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  dispatchOwl,
  getOwlStamps,
  owlCandidateIds,
  owlCandidateIdsForMenu,
  recordOwlChain,
} from '../src/game/owl-post';
import { CANDIDATES } from '../src/game/hearts';
import { OwlMenu } from '../src/ui/owl-menu';

const NPC_ALPHABETICAL_FIRST = owlCandidateIds()[0];
// Pick a candidate that is NOT first alphabetically so the sort actually
// has work to do — otherwise hoisting NPC_A to the front leaves the list
// unchanged and we can't tell the sort fired.
const NPC_LATER = owlCandidateIds().find((id) => id !== NPC_ALPHABETICAL_FIRST)!;

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

describe('owlCandidateIdsForMenu — fallback to alphabetical', () => {
  it('returns the same order as owlCandidateIds on a fresh save', () => {
    const w = loadedPlayer();
    expect(owlCandidateIdsForMenu(w.player)).toEqual(owlCandidateIds());
  });

  it('returns the same order when the chain target is null', () => {
    const w = loadedPlayer();
    // Touch the chain reader so the object exists, but don't set npcId.
    expect(owlCandidateIdsForMenu(w.player)).toEqual(owlCandidateIds());
  });

  it('returns the same list length as the alphabetical default', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_LATER, 5);
    const sorted = owlCandidateIdsForMenu(w.player);
    expect(sorted.length).toBe(owlCandidateIds().length);
  });
});

describe('owlCandidateIdsForMenu — chain target hoist', () => {
  it('hoists the chain target to the FIRST slot', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_LATER, 5);
    const sorted = owlCandidateIdsForMenu(w.player);
    expect(sorted[0]).toBe(NPC_LATER);
  });

  it('preserves alphabetical order for non-target rows', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_LATER, 5);
    const sorted = owlCandidateIdsForMenu(w.player);
    const tail = sorted.slice(1);
    const alphabeticalTail = owlCandidateIds().filter((id) => id !== NPC_LATER);
    expect(tail).toEqual(alphabeticalTail);
  });

  it('contains every candidate exactly once (no drops, no dupes)', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_LATER, 5);
    const sorted = owlCandidateIdsForMenu(w.player);
    expect(new Set(sorted)).toEqual(new Set(owlCandidateIds()));
  });

  it('hoist follows the chain target across a swap', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_ALPHABETICAL_FIRST, 5);
    recordOwlChain(w.player, NPC_LATER, 6);
    // Chain switched to NPC_LATER — they're now the hoisted row.
    expect(owlCandidateIdsForMenu(w.player)[0]).toBe(NPC_LATER);
  });

  it('hoist applies even when chain length is 1 (the floor)', () => {
    const w = loadedPlayer();
    // First send of a fresh chain — length 1, no bonus, but still
    // the player's most recent activity worth surfacing.
    recordOwlChain(w.player, NPC_LATER, 5);
    expect(owlCandidateIdsForMenu(w.player)[0]).toBe(NPC_LATER);
  });
});

describe('OwlMenu — snapshot on open', () => {
  it('open(player) snapshots the sorted list at open time', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_LATER, 5);
    const menu = new OwlMenu();
    menu.open(w.player);
    expect(menu.candidateIds()[0]).toBe(NPC_LATER);
  });

  it('open() WITHOUT a player falls back to alphabetical order (backwards compat)', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_LATER, 5);
    const menu = new OwlMenu();
    menu.open();
    expect(menu.candidateIds()).toEqual(owlCandidateIds());
  });

  it('mid-session dispatch does NOT re-order rows under the selection', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_ALPHABETICAL_FIRST, 5);
    const menu = new OwlMenu();
    menu.open(w.player);
    const before = menu.candidateIds();
    expect(before[0]).toBe(NPC_ALPHABETICAL_FIRST);
    // Move chain to a new recipient via a real dispatch — the menu
    // snapshot should NOT change until the next open().
    dispatchOwl(w.player, NPC_LATER, 6);
    expect(menu.candidateIds()).toEqual(before);
    // Re-opening picks up the new chain target at the top.
    menu.close();
    menu.open(w.player);
    expect(menu.candidateIds()[0]).toBe(NPC_LATER);
  });

  it('selectedId() returns the hoisted target on a fresh open with a chain', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_LATER, 5);
    const menu = new OwlMenu();
    menu.open(w.player);
    // index starts at 0 -> selectedId is the hoisted row.
    expect(menu.selectedId()).toBe(NPC_LATER);
  });

  it('selectPrev / selectNext walk the sorted list, not the alphabetical default', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_LATER, 5);
    const menu = new OwlMenu();
    menu.open(w.player);
    // Index 0 = NPC_LATER. Next should be the first alphabetical
    // entry whose id isn't NPC_LATER.
    menu.selectNext();
    const sortedTail = owlCandidateIds().filter((id) => id !== NPC_LATER);
    expect(menu.selectedId()).toBe(sortedTail[0]);
    // Wrap-around prev from index 0 lands on the LAST sorted row.
    menu.selectPrev();
    menu.selectPrev();
    expect(menu.selectedId()).toBe(sortedTail[sortedTail.length - 1]);
  });
});

describe('owlCandidateIdsForMenu — pure read', () => {
  it('does NOT mutate state', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_LATER, 5);
    const book = getOwlStamps(w.player);
    const beforeChain = JSON.stringify(book.chain);
    const beforeCounts = JSON.stringify(book.counts);
    owlCandidateIdsForMenu(w.player);
    owlCandidateIdsForMenu(w.player);
    expect(JSON.stringify(book.chain)).toBe(beforeChain);
    expect(JSON.stringify(book.counts)).toBe(beforeCounts);
  });
});

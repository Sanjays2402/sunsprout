// Owl Post — courier service that delivers gifts at distance.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { startingHearts } from '../src/game/hearts';
import {
  OWL_POST_FEE,
  dispatchOwl,
  owlCandidateIds,
} from '../src/game/owl-post';

function freshPlayer() {
  const w = new World();
  w.player.hearts = startingHearts();
  w.player.gold = 200;
  // Maple loves rubies; give one as the easy auto-gift.
  w.player.inventory = { ruby: 1 };
  return w;
}

describe('owlCandidateIds', () => {
  it('returns every CANDIDATES key, sorted', () => {
    const ids = owlCandidateIds();
    expect(ids.length).toBeGreaterThan(0);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });
});

describe('dispatchOwl success path', () => {
  it('deducts the fee and credits the candidate hearts', () => {
    const w = freshPlayer();
    const before = w.player.gold;
    const out = dispatchOwl(w.player, 'maple', 1);
    expect(out.kind).toBe('sent');
    if (out.kind === 'sent') {
      expect(out.npcId).toBe('maple');
      expect(out.gift.kind).toBe('gifted');
    }
    expect(w.player.gold).toBe(before - OWL_POST_FEE);
    // Ruby was consumed.
    expect(w.player.inventory.ruby ?? 0).toBe(0);
    // Hearts row got points.
    expect(w.player.hearts!.maple.points).toBeGreaterThan(0);
  });
});

describe('dispatchOwl failure paths', () => {
  it('refuses an unknown npc id', () => {
    const w = freshPlayer();
    const before = w.player.gold;
    const out = dispatchOwl(w.player, 'bogus-id', 1);
    expect(out.kind).toBe('not-candidate');
    expect(w.player.gold).toBe(before);
  });

  it('refuses when gold is below the fee — no charge', () => {
    const w = freshPlayer();
    w.player.gold = OWL_POST_FEE - 1;
    const out = dispatchOwl(w.player, 'maple', 1);
    expect(out.kind).toBe('not-enough-gold');
    expect(w.player.gold).toBe(OWL_POST_FEE - 1);
    // Ruby NOT consumed when we never delivered.
    expect(w.player.inventory.ruby ?? 0).toBe(1);
  });

  it('refuses a repeat send to the same candidate on the same day — no charge', () => {
    const w = freshPlayer();
    // Top up inventory so we have a second potential gift round.
    w.player.inventory.ruby = 5;
    const first = dispatchOwl(w.player, 'maple', 1);
    expect(first.kind).toBe('sent');
    const goldAfterFirst = w.player.gold;
    const second = dispatchOwl(w.player, 'maple', 1);
    expect(second.kind).toBe('already-today');
    expect(w.player.gold).toBe(goldAfterFirst);
  });

  it('reports no-items when the player has nothing decent to send — no charge', () => {
    const w = freshPlayer();
    // Maple dislikes 'frog' — pickBestGift skips disliked items so a
    // bag containing only that returns null. Give Maple a frog.
    w.player.inventory = { frog: 1 };
    const before = w.player.gold;
    const out = dispatchOwl(w.player, 'maple', 1);
    expect(out.kind).toBe('no-items');
    expect(w.player.gold).toBe(before);
  });

  it('refuses when the player has no hearts state', () => {
    const w = freshPlayer();
    w.player.hearts = undefined;
    const out = dispatchOwl(w.player, 'maple', 1);
    expect(out.kind).toBe('not-candidate');
  });
});

describe('OWL_POST_FEE', () => {
  it('is a positive integer', () => {
    expect(OWL_POST_FEE).toBeGreaterThan(0);
    expect(Math.floor(OWL_POST_FEE)).toBe(OWL_POST_FEE);
  });
});

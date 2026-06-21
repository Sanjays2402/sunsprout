// NPC barks — proximity gating, slot dedup, cooldown.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  BARK_COOLDOWN_MS,
  BARK_DURATION_MS,
  BARK_LINES,
  BARK_RADIUS,
  activeBarkFor,
  getBarks,
  tickBarks,
} from '../src/game/npc-barks';

function placeNPC(w: World, id: string, x: number, y: number): void {
  const npc = w.npcs.find((n) => n.id === id);
  if (!npc) throw new Error(`npc ${id} not found in default world`);
  npc.x = x;
  npc.y = y;
}

describe('tickBarks proximity', () => {
  it('fires no bark when the player is far away', () => {
    const w = new World();
    placeNPC(w, 'maple', 5, 5);
    const fired = tickBarks(w, 20, 20, 1, 8, 1000, 16);
    expect(fired).toBe(0);
    expect(getBarks(w).active.length).toBe(0);
  });

  it('fires a single bark when the player walks within radius', () => {
    const w = new World();
    placeNPC(w, 'maple', 5, 5);
    // Move the other NPCs far away so they don't fire.
    placeNPC(w, 'mayor', 100, 100);
    placeNPC(w, 'finn', 100, 100);
    placeNPC(w, 'rose', 100, 100);
    const fired = tickBarks(w, 6, 6, 1, 8, 1000, 16);
    expect(fired).toBe(1);
    const active = activeBarkFor(w, 'maple');
    expect(active).toBeDefined();
    expect(active!.text).toBeTruthy();
    expect(BARK_LINES['maple']).toContain(active!.text);
  });
});

describe('per-slot dedup', () => {
  it('does not refire the same (day, hour) slot for the same NPC', () => {
    const w = new World();
    placeNPC(w, 'maple', 5, 5);
    placeNPC(w, 'mayor', 100, 100);
    placeNPC(w, 'finn', 100, 100);
    placeNPC(w, 'rose', 100, 100);
    tickBarks(w, 6, 6, 1, 8, 1000, 16);
    // Walk away to clear active list, then walk back same hour.
    tickBarks(w, 50, 50, 1, 8, 1000 + BARK_DURATION_MS + 100, 16);
    const fired = tickBarks(w, 6, 6, 1, 8, 1000 + BARK_DURATION_MS + 200, 16);
    expect(fired).toBe(0);
  });

  it('fires again when the (day, hour) slot rolls', () => {
    const w = new World();
    placeNPC(w, 'maple', 5, 5);
    placeNPC(w, 'mayor', 100, 100);
    placeNPC(w, 'finn', 100, 100);
    placeNPC(w, 'rose', 100, 100);
    tickBarks(w, 6, 6, 1, 8, 1000, 16);
    // Advance to a future hour past the cooldown.
    const later = 1000 + BARK_COOLDOWN_MS + 1000;
    const fired = tickBarks(w, 6, 6, 1, 9, later, 16);
    expect(fired).toBe(1);
  });
});

describe('cooldown gate', () => {
  it('refuses to refire inside the cooldown window even across slots', () => {
    const w = new World();
    placeNPC(w, 'maple', 5, 5);
    placeNPC(w, 'mayor', 100, 100);
    placeNPC(w, 'finn', 100, 100);
    placeNPC(w, 'rose', 100, 100);
    tickBarks(w, 6, 6, 1, 8, 1000, 16);
    const fired = tickBarks(w, 6, 6, 1, 9, 1000 + 500, 16);
    expect(fired).toBe(0);
  });
});

describe('multi-NPC handling', () => {
  it('fires barks for each NPC within range independently', () => {
    const w = new World();
    placeNPC(w, 'maple', 5, 5);
    placeNPC(w, 'mayor', 6, 6);
    placeNPC(w, 'finn', 100, 100);
    placeNPC(w, 'rose', 100, 100);
    const fired = tickBarks(w, 5, 5, 1, 8, 1000, 16);
    expect(fired).toBe(2);
    expect(getBarks(w).active.length).toBe(2);
  });

  it('keeps only one active bark per NPC at a time', () => {
    const w = new World();
    placeNPC(w, 'maple', 5, 5);
    placeNPC(w, 'mayor', 100, 100);
    placeNPC(w, 'finn', 100, 100);
    placeNPC(w, 'rose', 100, 100);
    tickBarks(w, 6, 6, 1, 8, 1000, 16);
    // Force the cooldown + slot stamps to allow refiring; manually
    // poke state to test the single-active-per-npc invariant.
    const state = getBarks(w);
    state.firedSlot['maple'] = '__none__';
    state.lastBarkAt['maple'] = -Infinity;
    tickBarks(w, 6, 6, 1, 8, 9999, 16);
    const mapleActive = state.active.filter((b) => b.npcId === 'maple');
    expect(mapleActive.length).toBe(1);
  });
});

describe('bark lifecycle', () => {
  it('tick decays remainingMs and drops fully expired barks', () => {
    const w = new World();
    placeNPC(w, 'maple', 5, 5);
    placeNPC(w, 'mayor', 100, 100);
    placeNPC(w, 'finn', 100, 100);
    placeNPC(w, 'rose', 100, 100);
    tickBarks(w, 6, 6, 1, 8, 1000, 16);
    expect(getBarks(w).active.length).toBe(1);
    // Step the player away so we don't fire a new bark each tick.
    tickBarks(w, 50, 50, 1, 8, 1000 + 1000, BARK_DURATION_MS);
    expect(getBarks(w).active.length).toBe(0);
  });
});

describe('BARK_RADIUS', () => {
  it('matches Chebyshev distance — corners count', () => {
    const w = new World();
    placeNPC(w, 'maple', 5, 5);
    placeNPC(w, 'mayor', 100, 100);
    placeNPC(w, 'finn', 100, 100);
    placeNPC(w, 'rose', 100, 100);
    const corner = tickBarks(w, 5 + BARK_RADIUS, 5 + BARK_RADIUS, 1, 8, 1000, 16);
    expect(corner).toBe(1);
  });

  it('refuses just past the radius', () => {
    const w = new World();
    placeNPC(w, 'maple', 5, 5);
    placeNPC(w, 'mayor', 100, 100);
    placeNPC(w, 'finn', 100, 100);
    placeNPC(w, 'rose', 100, 100);
    const fired = tickBarks(w, 5 + BARK_RADIUS + 1, 5, 1, 8, 1000, 16);
    expect(fired).toBe(0);
  });
});

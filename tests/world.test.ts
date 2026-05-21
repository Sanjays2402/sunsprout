// vitest happy-path for the World construction + walkability.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';

describe('World', () => {
  it('has 40x30 tiles', () => {
    const w = new World();
    expect(w.width).toBe(40);
    expect(w.height).toBe(30);
    expect(w.tiles.length).toBe(30);
    expect(w.tiles[0].length).toBe(40);
  });

  it('player starts inside the world bounds', () => {
    const w = new World();
    const p = w.player;
    expect(p).toBeDefined();
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThan(w.width);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThan(w.height);
  });

  it('spawns the cozy village NPC ensemble', () => {
    const w = new World();
    expect(w.npcs.length).toBeGreaterThanOrEqual(3);
    expect(w.npcs.length).toBeLessThanOrEqual(8);
    // Every NPC has a name and tile-space coordinates.
    for (const npc of w.npcs) {
      expect(npc.name).toBeTruthy();
      expect(typeof npc.x).toBe('number');
      expect(typeof npc.y).toBe('number');
    }
  });

  it('places at least one walkable plaza path tile', () => {
    const w = new World();
    // Plaza is around (12..27, 4..11).
    expect(w.isWalkable(19, 6)).toBe(true);
  });
});

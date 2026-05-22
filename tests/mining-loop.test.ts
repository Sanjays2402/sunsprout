// v0.4.0 capstone — full mining loop integration spec.
//
// Walks the slice chain end-to-end as a regression net for the whole
// Mining Caves feature: pickaxe swings → clean strike rolls a gem →
// gem lands in inventory under the `gem-` namespace → sellAllGems
// converts it to gold at catalog price. Mirrors the spirit of the
// cooking and fishing capstones: prove the modules compose, not just
// that each module passes its own unit spec.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { Pickaxe, MINING } from '../src/game/mining';
import { GEMS, gemInventoryKey } from '../src/game/gems';
import { sellAllGems } from '../src/game/economy';

describe('v0.4.0 mining loop (capstone)', () => {
  it('strike → inventory → sellAllGems pays out at catalog price', () => {
    const world = new World();
    const p = world.player;
    p.inventory = {};
    const startingGold = p.gold;

    const pick = new Pickaxe({ seed: 9001 });
    pick.swing();
    pick.tick(MINING.swingMs);
    const gem = pick.strike();
    expect(gem).not.toBeNull();

    const key = gemInventoryKey(gem!);
    p.inventory[key] = (p.inventory[key] ?? 0) + 1;
    expect(p.inventory[key]).toBe(1);

    const earned = sellAllGems(p);
    expect(earned).toBe(GEMS[gem!].sellPrice);
    expect(p.gold).toBe(startingGold + earned);
    expect(p.inventory[key]).toBe(0);
  });
});

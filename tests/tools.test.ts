// Tool upgrades — tier progression, reach, upgrade transactions.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  TIER_OFFSETS,
  TIER_UPGRADE_COST,
  TOOL_TIERS,
  nextTier,
  tierLabel,
  tierOf,
  tilesForTool,
  toolLabel,
  upgradeCost,
  upgradeTool,
} from '../src/game/tools';
import { serializeGame, applySnapshot } from '../src/game/persistence';
import { TimeOfDay } from '../src/game/time';
import type { Game } from '../src/engine/game';

function fakeGame(): Game {
  const world = new World();
  world.player.gold = 5000;
  return { world, time: new TimeOfDay(6) } as unknown as Game;
}

describe('tool upgrades', () => {
  it('every tier has a defined offset list of size 1, 3, 5, 6', () => {
    expect(TIER_OFFSETS.wood.length).toBe(1);
    expect(TIER_OFFSETS.copper.length).toBe(3);
    expect(TIER_OFFSETS.iron.length).toBe(5);
    expect(TIER_OFFSETS.gold.length).toBe(6);
  });

  it('costs ascend monotonically (wood free, gold most expensive)', () => {
    expect(TIER_UPGRADE_COST.wood).toBe(0);
    expect(TIER_UPGRADE_COST.copper).toBeGreaterThan(0);
    expect(TIER_UPGRADE_COST.iron).toBeGreaterThan(TIER_UPGRADE_COST.copper);
    expect(TIER_UPGRADE_COST.gold).toBeGreaterThan(TIER_UPGRADE_COST.iron);
  });

  it('tier ordering: wood -> copper -> iron -> gold -> null', () => {
    expect(TOOL_TIERS).toEqual(['wood', 'copper', 'iron', 'gold']);
    expect(nextTier('wood')).toBe('copper');
    expect(nextTier('copper')).toBe('iron');
    expect(nextTier('iron')).toBe('gold');
    expect(nextTier('gold')).toBeNull();
  });

  it('a fresh player is on wood for every tool', () => {
    const g = fakeGame();
    expect(tierOf(g.world.player, 'hoe')).toBe('wood');
    expect(tierOf(g.world.player, 'watering-can')).toBe('wood');
  });

  it('upgradeTool spends gold, bumps the tier, returns the new tier', () => {
    const g = fakeGame();
    const p = g.world.player;
    const goldBefore = p.gold;
    const out = upgradeTool(p, 'hoe');
    expect(out.kind).toBe('upgraded');
    expect(tierOf(p, 'hoe')).toBe('copper');
    expect(p.gold).toBe(goldBefore - TIER_UPGRADE_COST.copper);
  });

  it('upgradeTool refuses when the player cannot afford it', () => {
    const g = fakeGame();
    const p = g.world.player;
    p.gold = 10;
    const out = upgradeTool(p, 'hoe');
    expect(out.kind).toBe('not-enough-gold');
    expect(tierOf(p, 'hoe')).toBe('wood');
  });

  it('upgradeTool returns max-tier when already gold', () => {
    const g = fakeGame();
    const p = g.world.player;
    upgradeTool(p, 'hoe');
    upgradeTool(p, 'hoe');
    upgradeTool(p, 'hoe');
    expect(tierOf(p, 'hoe')).toBe('gold');
    const out = upgradeTool(p, 'hoe');
    expect(out.kind).toBe('max-tier');
  });

  it('upgradeCost reflects the next tier (or null when maxed)', () => {
    const g = fakeGame();
    expect(upgradeCost(g.world.player, 'hoe')).toBe(TIER_UPGRADE_COST.copper);
    upgradeTool(g.world.player, 'hoe');
    upgradeTool(g.world.player, 'hoe');
    upgradeTool(g.world.player, 'hoe');
    expect(upgradeCost(g.world.player, 'hoe')).toBeNull();
  });

  it('tilesForTool at wood returns just one tile in front', () => {
    const g = fakeGame();
    const p = g.world.player;
    p.x = 10;
    p.y = 10;
    p.facing = 'right';
    const tiles = tilesForTool(p, 'hoe');
    expect(tiles).toEqual([{ tx: 11, ty: 10 }]);
  });

  it('tilesForTool at copper returns a 3-tile line perpendicular to facing', () => {
    const g = fakeGame();
    const p = g.world.player;
    p.x = 10;
    p.y = 10;
    p.facing = 'right';
    upgradeTool(p, 'hoe');
    const tiles = tilesForTool(p, 'hoe');
    expect(tiles.length).toBe(3);
    // All three sit on x=11 (in front), with y in 9..11.
    const ys = tiles.map((t) => t.ty).sort((a, b) => a - b);
    expect(tiles.every((t) => t.tx === 11)).toBe(true);
    expect(ys).toEqual([9, 10, 11]);
  });

  it('tilesForTool rotates with facing', () => {
    const g = fakeGame();
    const p = g.world.player;
    p.x = 10;
    p.y = 10;
    upgradeTool(p, 'hoe');
    p.facing = 'down';
    const tiles = tilesForTool(p, 'hoe');
    // All three sit on y=11 (in front), with x in 9..11.
    expect(tiles.every((t) => t.ty === 11)).toBe(true);
    const xs = tiles.map((t) => t.tx).sort((a, b) => a - b);
    expect(xs).toEqual([9, 10, 11]);
  });

  it('tilesForTool at gold includes a forward bonus tile', () => {
    const g = fakeGame();
    const p = g.world.player;
    p.x = 10;
    p.y = 10;
    p.facing = 'right';
    upgradeTool(p, 'hoe'); // copper
    upgradeTool(p, 'hoe'); // iron
    upgradeTool(p, 'hoe'); // gold
    const tiles = tilesForTool(p, 'hoe');
    expect(tiles.length).toBe(6);
    // The 6th gold tile is two squares ahead — (12, 10) when facing right.
    expect(tiles).toContainEqual({ tx: 12, ty: 10 });
  });

  it('labels are user-friendly', () => {
    expect(tierLabel('copper')).toBe('Copper');
    expect(toolLabel('watering-can', 'gold')).toBe('Gold Watering Can');
  });

  it('tools survive a persistence round-trip', () => {
    const a = fakeGame();
    upgradeTool(a.world.player, 'hoe');
    upgradeTool(a.world.player, 'hoe'); // iron
    upgradeTool(a.world.player, 'watering-can'); // copper
    const snap = serializeGame(a);
    const b = fakeGame();
    applySnapshot(b, snap);
    expect(tierOf(b.world.player, 'hoe')).toBe('iron');
    expect(tierOf(b.world.player, 'watering-can')).toBe('copper');
  });
});

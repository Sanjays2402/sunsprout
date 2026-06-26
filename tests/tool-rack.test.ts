// Tool rack — farmhouse-wall layout from the player's tool tiers.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  toolRackMounts,
  hasToolRack,
  tierForRackTool,
  TIER_METAL,
  RACK_TOOL_ORDER,
  RACK_SPACING,
} from '../src/game/tool-rack';
import { upgradeTool } from '../src/game/tools';
import { upgradePickaxe } from '../src/game/pickaxe-upgrades';
import { upgradeRod } from '../src/game/rod-upgrades';

function freshPlayer() {
  return new World().player;
}

describe('toolRackMounts', () => {
  it('is empty on a fresh farm (every tool still wood) so nothing is drawn', () => {
    const p = freshPlayer();
    expect(toolRackMounts(p)).toEqual([]);
    expect(hasToolRack(p)).toBe(false);
  });

  it('hangs the whole kit the moment any one tool is upgraded', () => {
    const p = freshPlayer();
    p.gold = 10000;
    upgradeTool(p, 'hoe'); // wood -> copper
    const mounts = toolRackMounts(p);
    // All four tools hang once the kit is non-default.
    expect(mounts.length).toBe(RACK_TOOL_ORDER.length);
    expect(mounts.map((m) => m.kind)).toEqual(RACK_TOOL_ORDER);
    expect(hasToolRack(p)).toBe(true);
  });

  it('packs tools left-to-right with even spacing', () => {
    const p = freshPlayer();
    p.gold = 10000;
    upgradeTool(p, 'hoe');
    const mounts = toolRackMounts(p);
    expect(mounts.map((m) => m.dx)).toEqual(
      RACK_TOOL_ORDER.map((_, i) => i * RACK_SPACING),
    );
  });

  it('reflects each tool\u2019s real tier + metal colour', () => {
    const p = freshPlayer();
    p.gold = 100000;
    upgradeTool(p, 'hoe'); // copper
    upgradePickaxe(p); // copper
    upgradePickaxe(p); // iron
    upgradeRod(p); // copper
    const mounts = toolRackMounts(p);
    const byKind = Object.fromEntries(mounts.map((m) => [m.kind, m]));
    expect(byKind.hoe.tier).toBe('copper');
    expect(byKind.pickaxe.tier).toBe('iron');
    expect(byKind.rod.tier).toBe('copper');
    expect(byKind.can.tier).toBe('wood'); // never upgraded
    // Colours track the shared metal palette.
    expect(byKind.pickaxe.body).toBe(TIER_METAL.iron.body);
    expect(byKind.pickaxe.sheen).toBe(TIER_METAL.iron.sheen);
  });

  it('shows the pickaxe\u2019s exclusive diamond tier', () => {
    const p = freshPlayer();
    p.gold = 100000;
    upgradePickaxe(p); // copper
    upgradePickaxe(p); // iron
    upgradePickaxe(p); // gold
    upgradePickaxe(p); // diamond
    const pick = toolRackMounts(p).find((m) => m.kind === 'pickaxe')!;
    expect(pick.tier).toBe('diamond');
    expect(pick.body).toBe(TIER_METAL.diamond.body);
  });
});

describe('tierForRackTool', () => {
  it('maps each rack tool to its tier helper, defaulting to wood', () => {
    const p = freshPlayer();
    for (const kind of RACK_TOOL_ORDER) {
      expect(tierForRackTool(p, kind)).toBe('wood');
    }
    p.gold = 10000;
    upgradeTool(p, 'watering-can');
    expect(tierForRackTool(p, 'can')).toBe('copper');
  });
});

describe('TIER_METAL palette', () => {
  it('every tier carries a valid hex body + sheen pair', () => {
    for (const tier of ['wood', 'copper', 'iron', 'gold', 'diamond'] as const) {
      expect(TIER_METAL[tier].body).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(TIER_METAL[tier].sheen).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

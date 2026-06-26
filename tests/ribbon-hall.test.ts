// Ribbon hall — farmhouse-wall rosette layout from tournament wins.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  ribbonHallMounts,
  ribbonHallCount,
  RIBBON_TIER_COLOR,
  RIBBON_DISPLAY_ORDER,
  RIBBON_MAX_PER_TIER,
  RIBBON_SPACING,
} from '../src/game/ribbon-hall';
import { RIBBONS } from '../src/game/tournament';

function playerWith(counts: { bronze?: number; silver?: number; gold?: number }) {
  const w = new World();
  const p = w.player;
  if (counts.bronze) p.inventory[RIBBONS.bronze] = counts.bronze;
  if (counts.silver) p.inventory[RIBBONS.silver] = counts.silver;
  if (counts.gold) p.inventory[RIBBONS.gold] = counts.gold;
  return p;
}

describe('ribbonHallMounts', () => {
  it('is empty on a fresh farm so nothing is drawn', () => {
    expect(ribbonHallMounts(new World().player)).toEqual([]);
    expect(ribbonHallCount(new World().player)).toBe(0);
  });

  it('mounts one rosette per owned ribbon, best tier first', () => {
    const p = playerWith({ bronze: 1, silver: 1, gold: 1 });
    const mounts = ribbonHallMounts(p);
    expect(mounts.map((m) => m.tier)).toEqual(['gold', 'silver', 'bronze']);
  });

  it('packs rosettes left-to-right with even spacing', () => {
    const p = playerWith({ gold: 2, bronze: 1 });
    const mounts = ribbonHallMounts(p);
    expect(mounts.map((m) => m.dx)).toEqual([0, RIBBON_SPACING, RIBBON_SPACING * 2]);
    // Gold leads (display order), bronze trails.
    expect(mounts[0].tier).toBe('gold');
    expect(mounts[2].tier).toBe('bronze');
  });

  it('caps the rosettes shown per tier so a long run does not paper the wall', () => {
    const p = playerWith({ silver: 99 });
    const mounts = ribbonHallMounts(p);
    expect(mounts.length).toBe(RIBBON_MAX_PER_TIER);
    for (const m of mounts) expect(m.tier).toBe('silver');
  });

  it('carries the tier palette through to each mount', () => {
    const p = playerWith({ gold: 1 });
    const [m] = ribbonHallMounts(p);
    expect(m.body).toBe(RIBBON_TIER_COLOR.gold.body);
    expect(m.sheen).toBe(RIBBON_TIER_COLOR.gold.sheen);
  });

  it('every tier palette is a valid hex pair', () => {
    for (const tier of RIBBON_DISPLAY_ORDER) {
      const c = RIBBON_TIER_COLOR[tier];
      expect(c.body).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(c.sheen).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

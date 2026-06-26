// Ribbon hall — farmhouse-wall rosette layout from tournament wins.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  ribbonHallMounts,
  ribbonHallCount,
  ribbonHallCaption,
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

describe('ribbonHallCaption', () => {
  it('is empty on a fresh farm so the panel draws nothing', () => {
    expect(ribbonHallCaption(new World().player)).toBe('');
  });

  it('uses the singular noun for a single ribbon', () => {
    const p = playerWith({ gold: 1 });
    expect(ribbonHallCaption(p)).toBe('1 ribbon on the wall: 1 gold');
  });

  it('lists every shown tier best-first with the plural noun', () => {
    const p = playerWith({ bronze: 1, silver: 2, gold: 1 });
    expect(ribbonHallCaption(p)).toBe('4 ribbons on the wall: 1 gold, 2 silver, 1 bronze');
  });

  it('counts only the SHOWN rosettes (respects the per-tier cap)', () => {
    const p = playerWith({ silver: 99 });
    const caption = ribbonHallCaption(p);
    expect(caption).toBe(`${RIBBON_MAX_PER_TIER} ribbons on the wall: ${RIBBON_MAX_PER_TIER} silver`);
    // The caption count must match what the wall actually mounts.
    expect(caption.startsWith(`${ribbonHallCount(p)} `)).toBe(true);
  });

  it('omits a tier the player has none of', () => {
    const p = playerWith({ gold: 1, bronze: 1 });
    const caption = ribbonHallCaption(p);
    expect(caption).toContain('1 gold');
    expect(caption).toContain('1 bronze');
    expect(caption).not.toContain('silver');
  });

  it('carries no emoji / non-ASCII (git-safe chrome)', () => {
    const p = playerWith({ gold: 2, silver: 1, bronze: 3 });
    expect(/^[\x20-\x7E]*$/.test(ribbonHallCaption(p))).toBe(true);
  });
});

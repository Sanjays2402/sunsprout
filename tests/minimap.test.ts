// Minimap model — pure projection + landmark helpers for the `9` overlay.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  minimapMarkers,
  minimapTileColors,
  projectTile,
  MINIMAP_TILE_COLORS,
} from '../src/game/minimap';

describe('minimapTileColors', () => {
  it('returns one colour per world tile in row-major order', () => {
    const w = new World();
    const colors = minimapTileColors(w);
    expect(colors.length).toBe(w.width * w.height);
    // Every entry is a hex colour.
    for (const c of colors) {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('reflects the western ambience pond as water-coloured cells', () => {
    const w = new World();
    const colors = minimapTileColors(w);
    // Pond is x in [2,6), y in [18,22) per world generation.
    const idx = 19 * w.width + 3;
    expect(colors[idx]).toBe(MINIMAP_TILE_COLORS.water);
  });

  it('reflects the tilled starter patch', () => {
    const w = new World();
    const colors = minimapTileColors(w);
    // Tilled patch is x in [19,27), y in [22,28).
    const idx = 23 * w.width + 20;
    expect(colors[idx]).toBe(MINIMAP_TILE_COLORS.tilled);
  });
});

describe('minimapMarkers', () => {
  it('includes the four core buildings and the cave', () => {
    const w = new World();
    const markers = minimapMarkers(w);
    const labels = markers.map((m) => m.label);
    expect(labels).toContain('Home');
    expect(labels).toContain("Maple's shop");
    expect(labels).toContain('Inn');
    expect(labels).toContain('Well');
    expect(labels).toContain('Cave');
  });

  it('places the home marker at the farmhouse footprint centre', () => {
    const w = new World();
    const home = minimapMarkers(w).find((m) => m.label === 'Home')!;
    const fh = w.buildings.find((b) => b.kind === 'farmhouse')!;
    expect(home.tx).toBeCloseTo(fh.x + (fh.w - 1) / 2, 5);
    expect(home.ty).toBeCloseTo(fh.y + (fh.h - 1) / 2, 5);
  });

  it('every marker carries a single-character glyph and a colour', () => {
    const w = new World();
    for (const m of minimapMarkers(w)) {
      expect(m.glyph.length).toBe(1);
      expect(m.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(m.label.length).toBeGreaterThan(0);
    }
  });

  it('keeps all landmarks inside the world bounds', () => {
    const w = new World();
    for (const m of minimapMarkers(w)) {
      expect(m.tx).toBeGreaterThanOrEqual(0);
      expect(m.tx).toBeLessThan(w.width);
      expect(m.ty).toBeGreaterThanOrEqual(0);
      expect(m.ty).toBeLessThan(w.height);
    }
  });
});

describe('projectTile', () => {
  it('maps the origin tile to the top-left of the map', () => {
    const p = projectTile(0, 0, 40, 30, 200, 150);
    expect(p.px).toBe(0);
    expect(p.py).toBe(0);
    expect(p.cellW).toBeCloseTo(5, 5);
    expect(p.cellH).toBeCloseTo(5, 5);
  });

  it('maps the far corner tile to the far edge minus one cell', () => {
    const p = projectTile(39, 29, 40, 30, 200, 150);
    expect(p.px).toBeCloseTo(195, 5);
    expect(p.py).toBeCloseTo(145, 5);
  });

  it('scales linearly with the requested map size', () => {
    const small = projectTile(10, 10, 40, 30, 200, 150);
    const big = projectTile(10, 10, 40, 30, 400, 300);
    expect(big.px).toBeCloseTo(small.px * 2, 5);
    expect(big.py).toBeCloseTo(small.py * 2, 5);
  });
});

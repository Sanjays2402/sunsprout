// Minimap model — pure projection + landmark helpers for the `9` overlay.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  minimapMarkers,
  minimapTileColors,
  projectTile,
  playerDotRingAlpha,
  pingRing,
  MINIMAP_TILE_COLORS,
  MINIMAP_PULSE_PERIOD_MS,
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

describe('playerDotRingAlpha — reduce-motion gate', () => {
  it('breathes within a bounded band across a full period with motion on', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let ms = 0; ms <= MINIMAP_PULSE_PERIOD_MS; ms += 13) {
      const a = playerDotRingAlpha(ms, false);
      min = Math.min(min, a);
      max = Math.max(max, a);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
    // The ring actually animates (a non-trivial spread).
    expect(max - min).toBeGreaterThan(0.3);
  });

  it('holds a single steady value under reduceMotion (no animation)', () => {
    const samples = [0, 100, 600, 900, 1200, 5000].map((ms) =>
      playerDotRingAlpha(ms, true),
    );
    for (const s of samples) {
      expect(s).toBe(samples[0]);
    }
    // Steady value is clearly visible (mid-bright).
    expect(samples[0]).toBe(0.55);
  });
});

describe('pingRing — reduce-motion gate', () => {
  it('expands + fades on the phase with motion on', () => {
    const start = pingRing(0, false);
    const mid = pingRing(MINIMAP_PULSE_PERIOD_MS / 2, false);
    expect(start.showRing).toBe(true);
    // Radius grows across the phase.
    expect(mid.radius).toBeGreaterThan(start.radius);
    // Alpha fades across the phase.
    expect(mid.ringAlpha).toBeLessThan(start.ringAlpha);
    // The inner dot stays small while the ring carries the motion.
    expect(start.dotRadius).toBe(2);
  });

  it('drops the expanding ring entirely under reduceMotion', () => {
    const r = pingRing(300, true);
    expect(r.showRing).toBe(false);
    expect(r.radius).toBe(0);
    expect(r.ringAlpha).toBe(0);
    // The solid inner dot grows so the spot is still clearly marked.
    expect(r.dotRadius).toBe(3);
  });

  it('is steady across time under reduceMotion', () => {
    const a = pingRing(0, true);
    const b = pingRing(750, true);
    expect(a).toEqual(b);
  });
});

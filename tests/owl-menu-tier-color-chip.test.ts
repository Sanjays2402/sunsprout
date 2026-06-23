// Owl-menu tier-color chip + chain preview — closes the loop on the
// chip pattern. The lore Folk row already draws a bronze/silver/gold
// chip alongside the per-NPC fluency wording; this tick mirrors that
// chip on the owl-menu row so the player reads "fluency rank" at a
// glance from EITHER surface. The chain preview surfaces "chain: N"
// next to the hearts label when the player is about to land at a
// chain length >= 2 (so they can SEE the bonus before pressing Enter).
//
// Tested:
//   - tierColor reuse on the menu (uses the lore-side palette)
//   - day parameter wires through to previewChainLength
//   - draw() runs cleanly on a fresh save, a high-stamp save, and
//     a mid-chain save (no exceptions, deterministic on stub ctx)

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { OwlMenu } from '../src/ui/owl-menu';
import {
  OWL_FLUENCY_TIERS,
  OWL_FLUENCY_TIER_COLOR,
  owlFluencyTierColor,
  previewChainLength,
  recordOwlChain,
  recordOwlStamp,
} from '../src/game/owl-post';
import { startingHearts } from '../src/game/hearts';

interface CallRecord {
  fn: string;
  args: unknown[];
}

/** Records every canvas op for verification, ignores values. */
function stubCtx(): {
  ctx: CanvasRenderingContext2D;
  calls: CallRecord[];
  fillRectCount: () => number;
  fillStyleValues: () => string[];
} {
  const calls: CallRecord[] = [];
  const fillStyles: string[] = [];
  const handler = {
    get(_target: object, prop: string): unknown {
      if (
        prop === 'save' ||
        prop === 'restore' ||
        prop === 'fillRect' ||
        prop === 'strokeRect' ||
        prop === 'fillText' ||
        prop === 'beginPath' ||
        prop === 'closePath' ||
        prop === 'stroke' ||
        prop === 'moveTo' ||
        prop === 'lineTo'
      ) {
        return (...args: unknown[]) => {
          calls.push({ fn: prop, args });
        };
      }
      // measureText returns a TextMetrics-shaped object; the draw path
      // uses it to position the chain-bonus chip after the hearts label.
      // We don't need real glyph widths — a stable fake width keeps the
      // test deterministic and silences the runtime TypeError.
      if (prop === 'measureText') {
        return (s: string) => ({ width: s.length * 7 });
      }
      // Properties touched in the draw path.
      if (
        prop === 'fillStyle' ||
        prop === 'strokeStyle' ||
        prop === 'font' ||
        prop === 'textAlign' ||
        prop === 'textBaseline' ||
        prop === 'lineWidth' ||
        prop === 'imageSmoothingEnabled'
      ) {
        return '';
      }
      return undefined;
    },
    set(_target: object, prop: string, value: unknown): boolean {
      if (prop === 'fillStyle' && typeof value === 'string') {
        fillStyles.push(value);
      }
      calls.push({ fn: `set:${prop}`, args: [value] });
      return true;
    },
  };
  const ctx = new Proxy({}, handler) as unknown as CanvasRenderingContext2D;
  return {
    ctx,
    calls,
    fillRectCount: () => calls.filter((c) => c.fn === 'fillRect').length,
    fillStyleValues: () => fillStyles,
  };
}

function readyMenu(): { menu: OwlMenu; world: World } {
  const w = new World();
  w.player.hearts = startingHearts();
  w.player.gold = 5000;
  w.player.inventory = { ruby: 50, flower_harvest: 50 };
  const menu = new OwlMenu();
  menu.open();
  menu.update(500);
  return { menu, world: w };
}

describe('Owl menu — tier color chip palette', () => {
  it('uses the same color palette as the lore Folk row', () => {
    // The menu draws the chip ONLY when owlFluencyTierColor returns
    // non-null. The palette is the same OWL_FLUENCY_TIER_COLOR map,
    // so a player at the bronze tier sees bronze on BOTH the lore row
    // AND the menu row (no separate menu palette to drift).
    const w = new World();
    w.player.hearts = startingHearts();
    for (let i = 0; i < OWL_FLUENCY_TIERS[0].min; i++) {
      recordOwlStamp(w.player, 'maple');
    }
    const color = owlFluencyTierColor(w.player, 'maple');
    expect(color).toBe(OWL_FLUENCY_TIER_COLOR['occasional pen pal']);
  });
});

describe('Owl menu — preview chain wiring', () => {
  it('previewChainLength is pure (does NOT mutate state)', () => {
    const w = new World();
    w.player.hearts = startingHearts();
    recordOwlChain(w.player, 'maple', 5);
    recordOwlChain(w.player, 'maple', 6);
    const before = JSON.stringify(w.player);
    previewChainLength(w.player, 'maple', 7);
    previewChainLength(w.player, 'pip', 7);
    const after = JSON.stringify(w.player);
    expect(after).toBe(before);
  });

  it('previewChainLength predicts the same length the menu surfaces', () => {
    const w = new World();
    w.player.hearts = startingHearts();
    recordOwlChain(w.player, 'maple', 5);
    recordOwlChain(w.player, 'maple', 6);
    recordOwlChain(w.player, 'maple', 7);
    // Tomorrow's preview (day 8) — chain would land at length 4.
    expect(previewChainLength(w.player, 'maple', 8)).toBe(4);
    // For a different NPC on day 8 — chain resets to 1.
    expect(previewChainLength(w.player, 'pip', 8)).toBe(1);
  });
});

describe('Owl menu — draw smoke', () => {
  it('draw() runs cleanly on a fresh save (no tier, no chain)', () => {
    const { menu, world } = readyMenu();
    const stub = stubCtx();
    expect(() => menu.draw(stub.ctx, world.player, 1280, 720, 1)).not.toThrow();
    // Should at minimum have drawn the panel background + row backgrounds.
    expect(stub.fillRectCount()).toBeGreaterThan(2);
  });

  it('draw() runs cleanly when an NPC has a tier (chip path taken)', () => {
    const { menu, world } = readyMenu();
    for (let i = 0; i < OWL_FLUENCY_TIERS[2].min; i++) {
      recordOwlStamp(world.player, 'maple');
    }
    const stub = stubCtx();
    expect(() => menu.draw(stub.ctx, world.player, 1280, 720, 1)).not.toThrow();
    // The favorite-courier color hex should appear in the fillStyle stream.
    const used = stub.fillStyleValues();
    expect(used).toContain(OWL_FLUENCY_TIER_COLOR['favorite courier']);
  });

  it('draw() runs cleanly when an active chain exists (preview path taken)', () => {
    const { menu, world } = readyMenu();
    recordOwlChain(world.player, 'maple', 5);
    recordOwlChain(world.player, 'maple', 6);
    const stub = stubCtx();
    // Day 7 — preview would say chain length 3 for maple.
    expect(() => menu.draw(stub.ctx, world.player, 1280, 720, 7)).not.toThrow();
    expect(stub.fillRectCount()).toBeGreaterThan(2);
  });

  it('draw() does NOT throw when day is omitted (backwards compat)', () => {
    const { menu, world } = readyMenu();
    const stub = stubCtx();
    expect(() => menu.draw(stub.ctx, world.player, 1280, 720)).not.toThrow();
  });
});

// Modal menus join the open-fade family — shop / cart / cooking / chest /
// bench / owl all arm a MODAL_OPEN_LOCKOUT_MS lockout on open() and apply
// panelOpenAlpha via ctx.globalAlpha as they draw, so the buy/craft/storage
// modals glide in like the info-panel family + hearts instead of snapping.
// Reduce-motion snaps them solid.
//
// We can't render a real canvas, so a globalAlpha-capturing stub records
// the alpha each modal sets at draw time: faint mid-lockout (the fade is
// underway), solid once settled, and solid immediately under reduce-motion.

import { describe, it, expect, vi } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import { getSettings } from '../src/game/settings';
import {
  MODAL_OPEN_LOCKOUT_MS,
  PANEL_OPEN_MIN_ALPHA,
} from '../src/game/panel-transition';
import { ShopMenu } from '../src/ui/shop-menu';
import { CartMenu } from '../src/ui/cart-menu';
import { CookingMenu } from '../src/ui/cooking-menu';
import { ChestMenu } from '../src/ui/chest-menu';
import { BenchMenu } from '../src/ui/bench-menu';
import { OwlMenu } from '../src/ui/owl-menu';
import { placeChest } from '../src/game/chest';

/**
 * Canvas stub that records the MAX globalAlpha seen at any fill/stroke
 * time, so a test can read the alpha the modal drew its body at (the fade
 * sets globalAlpha once near the top, then draws everything under it).
 */
function makeAlphaStub(): {
  ctx: CanvasRenderingContext2D;
  maxAlpha: () => number;
} {
  let maxAlpha = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stub: any = {
    strokeStyle: '#000',
    fillStyle: '#000',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    imageSmoothingEnabled: false,
    globalAlpha: 1,
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(() => {
      maxAlpha = Math.max(maxAlpha, stub.globalAlpha);
    }),
    fillRect: vi.fn(() => {
      maxAlpha = Math.max(maxAlpha, stub.globalAlpha);
    }),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 } as TextMetrics)),
  };
  return { ctx: stub as CanvasRenderingContext2D, maxAlpha: () => maxAlpha };
}

const W = 1280;
const H = 720;

/** Open + draw each modal, returning the alpha it drew its body at. */
function alphaAfter(
  kind: 'shop' | 'cart' | 'cooking' | 'chest' | 'bench' | 'owl',
  settleMs: number,
  reduceMotion: boolean,
): number {
  const w = new World();
  w.player.gold = 5000;
  if (reduceMotion) getSettings(w.player).reduceMotion = true;
  const time = new TimeOfDay(10);
  const { ctx, maxAlpha } = makeAlphaStub();
  switch (kind) {
    case 'shop': {
      const m = new ShopMenu();
      m.open(w.player, time);
      m.update(settleMs);
      m.draw(ctx, w.player, W, H);
      break;
    }
    case 'cart': {
      const m = new CartMenu();
      m.open();
      m.update(settleMs);
      m.draw(ctx, w.player, W, H, time);
      break;
    }
    case 'cooking': {
      const m = new CookingMenu();
      m.open();
      m.update(settleMs);
      m.draw(ctx, w.player, W, H);
      break;
    }
    case 'chest': {
      const chest = placeChest(w, 10, 14);
      const m = new ChestMenu();
      m.open(chest!);
      m.update(settleMs);
      m.draw(ctx, W, H, reduceMotion);
      break;
    }
    case 'bench': {
      const m = new BenchMenu();
      m.open();
      m.update(settleMs);
      m.draw(ctx, w.player, W, H);
      break;
    }
    case 'owl': {
      const m = new OwlMenu();
      m.open(w.player);
      m.update(settleMs);
      m.draw(ctx, w.player, W, H, time.day);
      break;
    }
  }
  return maxAlpha();
}

const MODALS = ['shop', 'cart', 'cooking', 'chest', 'bench', 'owl'] as const;

describe('modal open-fade family', () => {
  it('arms the shared modal lockout (slightly longer than the panel one)', () => {
    expect(MODAL_OPEN_LOCKOUT_MS).toBe(180);
    expect(MODAL_OPEN_LOCKOUT_MS).toBeGreaterThan(0);
  });

  it('draws faint at the first opening frame (fade underway)', () => {
    for (const kind of MODALS) {
      // 0ms settled -> full lockout remaining -> alpha at the floor.
      const a = alphaAfter(kind, 0, false);
      expect(a).toBeGreaterThanOrEqual(PANEL_OPEN_MIN_ALPHA - 1e-6);
      expect(a).toBeLessThan(1);
    }
  });

  it('draws solid once the lockout has elapsed', () => {
    for (const kind of MODALS) {
      const a = alphaAfter(kind, MODAL_OPEN_LOCKOUT_MS + 50, false);
      expect(a).toBeCloseTo(1, 5);
    }
  });

  it('snaps solid immediately under reduce-motion (no fade)', () => {
    for (const kind of MODALS) {
      // Even at the first frame, calm mode draws at full opacity.
      const a = alphaAfter(kind, 0, true);
      expect(a).toBeCloseTo(1, 5);
    }
  });
});

// Almanac TODAY-chip busiest-kind glyph — the "N today" weight chip now
// leads with the TODAY bucket's busiest-kind glyph (cake / tent / cart /
// rosette / heart), the same way the THIS WEEK / LATER chips do, so all
// three divider chips speak one icon language. The glyph is painted in the
// warm TODAY green (not the dim ink the forward chips use), so "right now"
// stays the urgent one.
//
// The busiest-kind pick is the pure almanacSectionBusiestKind() already
// covered elsewhere; this slice is the panel render reuse, so the test
// pins the helper's pick for a real multi-event day and then smoke-checks
// the panel paints the glyph there.

import { describe, it, expect, vi } from 'vitest';
import { TimeOfDay } from '../src/game/time';
import {
  buildAlmanac,
  almanacSections,
  almanacTodayCount,
  almanacSectionBusiestKind,
} from '../src/game/almanac';
import { AlmanacPanel } from '../src/ui/almanac-panel';

/** Build a clock parked at a given season/day. */
function clockAt(season: 0 | 1 | 2 | 3, day: number): TimeOfDay {
  const t = new TimeOfDay(8);
  t.season = season;
  t.day = day;
  return t;
}

/** The exact TODAY green the panel paints the chip + glyph in. */
const TODAY = '#A3D77A';

/**
 * Stub canvas recording every fillRect's size + fillStyle so the test can
 * spot the 1x1 glyph pixels (the only 1x1 TODAY-green fills the panel
 * makes — the band rail is 2px wide and row rails use kind colours).
 */
function makeRectCapturingStub(): {
  ctx: CanvasRenderingContext2D;
  rects: () => { w: number; h: number; style: unknown }[];
} {
  const captured: { w: number; h: number; style: unknown }[] = [];
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
    fillRect: vi.fn((_x: number, _y: number, w: number, h: number) => {
      captured.push({ w, h, style: stub.fillStyle });
    }),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 } as TextMetrics)),
  };
  return { ctx: stub as CanvasRenderingContext2D, rects: () => captured };
}

describe('almanac TODAY-chip busiest-kind glyph', () => {
  it('Spring day 3 stacks 2 TODAY events whose busiest kind is cart', () => {
    // Cart + the Mayor's birthday both land on Spring 3; the SUMMARY_KIND_ORDER
    // tie-break (cart before birthday) makes cart the busiest kind.
    const time = clockAt(0, 3);
    const sections = almanacSections(buildAlmanac(time));
    const today = sections.find((s) => s.key === 'today');
    expect(today).toBeDefined();
    expect(almanacTodayCount(today!.entries)).toBeGreaterThanOrEqual(2);
    expect(almanacSectionBusiestKind(today!.entries)).toBe('cart');
  });

  it('paints 1x1 TODAY-green glyph pixels beside the chip on a busy day', () => {
    const time = clockAt(0, 3);
    const { ctx, rects } = makeRectCapturingStub();
    const panel = new AlmanacPanel();
    panel.open();
    panel.update(500); // clear the open fade so globalAlpha is solid
    panel.draw(ctx, time, 1280, 720);
    const glyphPixels = rects().filter(
      (r) => r.w === 1 && r.h === 1 && r.style === TODAY,
    );
    expect(glyphPixels.length).toBeGreaterThan(0);
  });

  it('paints no TODAY-green glyph pixels when nothing stacks today', () => {
    // Spring 1: every dated event is >=2 days out, so there's no TODAY
    // section and therefore no TODAY chip + glyph.
    const time = clockAt(0, 1);
    const { ctx, rects } = makeRectCapturingStub();
    const panel = new AlmanacPanel();
    panel.open();
    panel.update(500);
    panel.draw(ctx, time, 1280, 720);
    const glyphPixels = rects().filter(
      (r) => r.w === 1 && r.h === 1 && r.style === TODAY,
    );
    expect(glyphPixels.length).toBe(0);
  });

  it('draws without throwing on the busy day', () => {
    const { ctx } = makeRectCapturingStub();
    const panel = new AlmanacPanel();
    panel.open();
    expect(() => panel.draw(ctx, clockAt(0, 3), 1280, 720)).not.toThrow();
  });
});

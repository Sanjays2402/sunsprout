// Almanac TODAY highlight band — a soft sage wash + warm left rail behind
// the TODAY section's rows so "what's happening right now" pops out of the
// agenda instead of reading like any other countdown row.
//
// Pure-render slice (the TODAY/THIS WEEK/LATER split already exists via
// almanacSections); this verifies the panel paints the band fill when —
// and only when — a today-section is present.

import { describe, it, expect, vi } from 'vitest';
import { TimeOfDay } from '../src/game/time';
import { buildAlmanac, almanacSections } from '../src/game/almanac';
import { AlmanacPanel } from '../src/ui/almanac-panel';

/** Build a clock parked at a given season/day. */
function clockAt(season: 0 | 1 | 2 | 3, day: number): TimeOfDay {
  const t = new TimeOfDay(8);
  t.season = season;
  t.day = day;
  return t;
}

/** The exact band fill the panel uses for the TODAY wash. */
const TODAY_BAND = 'rgba(163, 215, 122, 0.10)';

/**
 * Stub canvas that records every (fillStyle) at fillRect time so the test
 * can assert the TODAY band wash was (or wasn't) painted.
 */
function makeFillCapturingStub(): {
  ctx: CanvasRenderingContext2D;
  fills: () => unknown[];
} {
  const captured: unknown[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stub: any = {
    strokeStyle: '#000',
    fillStyle: '#000',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    imageSmoothingEnabled: false,
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(() => {
      captured.push(stub.fillStyle);
    }),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 } as TextMetrics)),
  };
  return { ctx: stub as CanvasRenderingContext2D, fills: () => captured };
}

describe('almanac TODAY highlight band', () => {
  it('paints the band wash when a today-section is present', () => {
    // Spring 7: the Planting Fair lands today, so a TODAY section exists.
    const time = clockAt(0, 7);
    const sections = almanacSections(buildAlmanac(time));
    expect(sections.some((s) => s.key === 'today')).toBe(true);

    const { ctx, fills } = makeFillCapturingStub();
    const panel = new AlmanacPanel();
    panel.open();
    panel.draw(ctx, time, 1280, 720);
    expect(fills()).toContain(TODAY_BAND);
  });

  it('does not paint the band when nothing lands today', () => {
    // Spring 1: cart/tournament/festival/birthday are all >=2 days out, so
    // there's no TODAY section to highlight.
    const time = clockAt(0, 1);
    const sections = almanacSections(buildAlmanac(time));
    expect(sections.some((s) => s.key === 'today')).toBe(false);

    const { ctx, fills } = makeFillCapturingStub();
    const panel = new AlmanacPanel();
    panel.open();
    panel.draw(ctx, time, 1280, 720);
    expect(fills()).not.toContain(TODAY_BAND);
  });

  it('draws without throwing on a normal agenda', () => {
    const { ctx } = makeFillCapturingStub();
    const panel = new AlmanacPanel();
    panel.open();
    expect(() => panel.draw(ctx, clockAt(0, 7), 1280, 720)).not.toThrow();
  });
});

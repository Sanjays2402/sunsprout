// Settings panel value-preview swatches — the pure descriptor that tells
// the renderer WHAT to preview in each row's value column (a night-tint
// swatch, a HUD-scale glyph, an on/off pip), plus a draw smoke test.

import { describe, it, expect, vi } from 'vitest';
import { World } from '../src/world/world';
import { settingsRowPreview, SettingsPanel } from '../src/ui/settings-panel';
import { getSettings } from '../src/game/settings';

// RowKey isn't exported; the helper accepts the row-key string literals.
type Row = Parameters<typeof settingsRowPreview>[0];

describe('settingsRowPreview', () => {
  it('previews the night-tint row as a tint swatch at the current alpha', () => {
    const w = new World();
    const s = getSettings(w.player);
    s.nightTintScale = 0.6;
    const p = settingsRowPreview('nightTint' as Row, s);
    expect(p.kind).toBe('tint');
    if (p.kind === 'tint') expect(p.alpha).toBe(0.6);
  });

  it('previews the HUD-scale row as a scale glyph at the current scale', () => {
    const w = new World();
    const s = getSettings(w.player);
    s.hudScale = 1.5;
    const p = settingsRowPreview('hudScale' as Row, s);
    expect(p.kind).toBe('scale');
    if (p.kind === 'scale') expect(p.scale).toBe(1.5);
  });

  it('previews the boolean rows as toggle pips reflecting their state', () => {
    const w = new World();
    const s = getSettings(w.player);
    s.autoSave = true;
    s.reduceMotion = false;
    const a = settingsRowPreview('autoSave' as Row, s);
    const m = settingsRowPreview('reduceMotion' as Row, s);
    expect(a).toEqual({ kind: 'toggle', on: true });
    expect(m).toEqual({ kind: 'toggle', on: false });
  });

  it('previews the reset row as a danger glyph, armed-aware', () => {
    const w = new World();
    const s = getSettings(w.player);
    // Idle: a dim danger marker. Armed (second-confirm): the same kind, but
    // flagged so the renderer brightens it to the confirm red.
    expect(settingsRowPreview('reset' as Row, s)).toEqual({ kind: 'danger', armed: false });
    expect(settingsRowPreview('reset' as Row, s, true)).toEqual({ kind: 'danger', armed: true });
  });

  it('the reset preview defaults to un-armed when no flag is passed', () => {
    const w = new World();
    const s = getSettings(w.player);
    const p = settingsRowPreview('reset' as Row, s);
    expect(p).toEqual({ kind: 'danger', armed: false });
  });

  it('has no preview for the close action row', () => {
    const w = new World();
    const s = getSettings(w.player);
    expect(settingsRowPreview('close' as Row, s).kind).toBe('none');
    // The armed flag never resurrects a preview on a non-reset row.
    expect(settingsRowPreview('close' as Row, s, true).kind).toBe('none');
  });

  it('the tint alpha tracks the setting so a darker night reads heavier', () => {
    const w = new World();
    const s = getSettings(w.player);
    s.nightTintScale = 0.0;
    expect(settingsRowPreview('nightTint' as Row, s)).toEqual({ kind: 'tint', alpha: 0.0 });
    s.nightTintScale = 1.0;
    expect(settingsRowPreview('nightTint' as Row, s)).toEqual({ kind: 'tint', alpha: 1.0 });
  });
});

describe('SettingsPanel draw with previews', () => {
  it('draws every row preview without throwing', () => {
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
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      measureText: vi.fn(() => ({ width: 30 } as TextMetrics)),
    };
    const w = new World();
    const panel = new SettingsPanel();
    panel.open();
    expect(() =>
      panel.draw(stub as CanvasRenderingContext2D, w.player, 1280, 720),
    ).not.toThrow();
    // The pip preview path uses arc(); confirm it was exercised.
    expect(stub.arc).toHaveBeenCalled();
  });

  it('draws the armed reset danger glyph without throwing', () => {
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
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      measureText: vi.fn(() => ({ width: 30 } as TextMetrics)),
    };
    const w = new World();
    const panel = new SettingsPanel();
    panel.open();
    panel.update(200);
    // Walk to the reset row and arm it (first confirm), so the danger glyph
    // renders in its brightened armed state.
    for (let i = 0; i < 4; i++) panel.selectNext();
    panel.confirm(w.player, null);
    expect(() =>
      panel.draw(stub as CanvasRenderingContext2D, w.player, 1280, 720),
    ).not.toThrow();
    // The danger triangle is drawn with fillRect cells.
    expect(stub.fillRect).toHaveBeenCalled();
  });
});

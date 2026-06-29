// Settings legend caption — settingsLegendCaption() names the active
// cosmetic DISPLAY values in one line ("tint 60% - HUD 1.0x - calm on") so
// the player reads their current look at a glance, no row scan.

import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import { settingsLegendCaption, settingsLegendParts } from '../src/ui/settings-panel';
import { getSettings } from '../src/game/settings';

describe('settingsLegendCaption', () => {
  it('reads the defaults as tint 100% / HUD 1.00x / calm off', () => {
    const w = new World();
    const s = getSettings(w.player);
    expect(settingsLegendCaption(s)).toBe('tint 100% - HUD 1.00x - calm off');
  });

  it('reflects a dimmer tint, a bigger HUD, and reduce-motion on', () => {
    const w = new World();
    const s = getSettings(w.player);
    s.nightTintScale = 0.6;
    s.hudScale = 1.5;
    s.reduceMotion = true;
    expect(settingsLegendCaption(s)).toBe('tint 60% - HUD 1.50x - calm on');
  });

  it('rounds the tint percent and pins HUD to two decimals', () => {
    const w = new World();
    const s = getSettings(w.player);
    s.nightTintScale = 0.3;
    s.hudScale = 1.25;
    expect(settingsLegendCaption(s)).toBe('tint 30% - HUD 1.25x - calm off');
  });

  it('reads 0% tint as fully off', () => {
    const w = new World();
    const s = getSettings(w.player);
    s.nightTintScale = 0;
    expect(settingsLegendCaption(s).startsWith('tint 0% -')).toBe(true);
  });
});

describe('settingsLegendParts', () => {
  it('maps each segment to the row whose preview glyph echoes it', () => {
    const w = new World();
    const s = getSettings(w.player);
    const parts = settingsLegendParts(s);
    expect(parts.map((p) => p.row)).toEqual(['nightTint', 'hudScale', 'reduceMotion']);
  });

  it('joins to exactly the caption text so the two never drift', () => {
    const w = new World();
    const s = getSettings(w.player);
    s.nightTintScale = 0.6;
    s.hudScale = 1.25;
    s.reduceMotion = true;
    const joined = settingsLegendParts(s).map((p) => p.text).join(' - ');
    expect(joined).toBe(settingsLegendCaption(s));
  });

  it('carries the live values in each segment text', () => {
    const w = new World();
    const s = getSettings(w.player);
    s.nightTintScale = 0.3;
    s.hudScale = 1.5;
    s.reduceMotion = false;
    const parts = settingsLegendParts(s);
    expect(parts[0].text).toBe('tint 30%');
    expect(parts[1].text).toBe('HUD 1.50x');
    expect(parts[2].text).toBe('calm off');
  });
});

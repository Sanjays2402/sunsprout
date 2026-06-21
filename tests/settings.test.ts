// Settings — defaults / setters / cycling / panel / reset.
import { describe, it, expect, vi } from 'vitest';
import { World } from '../src/world/world';
import { TimeOfDay } from '../src/game/time';
import {
  cycleHudScale,
  cycleNightTint,
  defaultSettings,
  getSettings,
  HUD_SCALES,
  NIGHT_TINT_STEPS,
  setHudScale,
  setNightTintScale,
  toggleAutoSave,
  toggleReduceMotion,
} from '../src/game/settings';
import { SettingsPanel } from '../src/ui/settings-panel';
import { serializeGame, applySnapshot, type StorageLike } from '../src/game/persistence';
import type { Game } from '../src/engine/game';

function fakeGame(): Game {
  const w = new World();
  return { world: w, time: new TimeOfDay(6) } as unknown as Game;
}

describe('settings model', () => {
  it('defaults are sensible', () => {
    const d = defaultSettings();
    expect(d.autoSave).toBe(true);
    expect(d.nightTintScale).toBe(1.0);
    expect(d.hudScale).toBe(1.0);
    expect(d.reduceMotion).toBe(false);
  });

  it('getSettings lazy-creates and is idempotent', () => {
    const w = new World();
    const a = getSettings(w.player);
    expect(a).toEqual(defaultSettings());
    expect(getSettings(w.player)).toBe(a);
  });

  it('setNightTintScale clamps to [0,1]', () => {
    const w = new World();
    expect(setNightTintScale(w.player, 2)).toBe(1);
    expect(setNightTintScale(w.player, -3)).toBe(0);
    expect(setNightTintScale(w.player, 0.4)).toBe(0.4);
  });

  it('setHudScale only accepts catalog values', () => {
    const w = new World();
    expect(setHudScale(w.player, 1.25)).toBe(1.25);
    expect(setHudScale(w.player, 9 as unknown as 1.0)).toBe(1.0);
  });

  it('toggleAutoSave + toggleReduceMotion flip the bool', () => {
    const w = new World();
    expect(toggleAutoSave(w.player)).toBe(false);
    expect(toggleAutoSave(w.player)).toBe(true);
    expect(toggleReduceMotion(w.player)).toBe(true);
    expect(toggleReduceMotion(w.player)).toBe(false);
  });

  it('cycleHudScale walks through HUD_SCALES wrapping back', () => {
    const w = new World();
    expect(cycleHudScale(w.player)).toBe(HUD_SCALES[1]);
    expect(cycleHudScale(w.player)).toBe(HUD_SCALES[2]);
    expect(cycleHudScale(w.player)).toBe(HUD_SCALES[0]);
  });

  it('cycleNightTint walks NIGHT_TINT_STEPS wrapping back', () => {
    const w = new World();
    const seen: number[] = [];
    for (let i = 0; i < NIGHT_TINT_STEPS.length + 1; i++) {
      seen.push(cycleNightTint(w.player));
    }
    expect(seen[0]).toBe(NIGHT_TINT_STEPS[1]);
    expect(seen[NIGHT_TINT_STEPS.length]).toBe(NIGHT_TINT_STEPS[1]);
  });
});

describe('SettingsPanel controller', () => {
  function fakeStorage(): StorageLike & { wiped: boolean } {
    const store: Record<string, string> = {};
    return {
      wiped: false,
      getItem(k: string) {
        return k in store ? store[k] : null;
      },
      setItem(k: string, v: string) {
        store[k] = v;
      },
      removeItem(k: string) {
        delete store[k];
        (this as unknown as { wiped: boolean }).wiped = true;
      },
    } as StorageLike & { wiped: boolean };
  }

  it('toggle open / select / confirm cycles a row', () => {
    const w = new World();
    const panel = new SettingsPanel();
    panel.open();
    panel.update(200);
    const out = panel.confirm(w.player, null);
    expect(out.kind).toBe('cycled');
    if (out.kind === 'cycled') {
      expect(out.key).toBe('autoSave');
      expect(out.value).toBe('off');
    }
    expect(getSettings(w.player).autoSave).toBe(false);
  });

  it('navigates rows and cycles each value', () => {
    const w = new World();
    const panel = new SettingsPanel();
    panel.open();
    panel.update(200);
    panel.selectNext(); // nightTint
    const out = panel.confirm(w.player, null);
    expect(out.kind).toBe('cycled');
    if (out.kind === 'cycled') expect(out.key).toBe('nightTint');
  });

  it('reset requires two confirms and wipes storage on the second', () => {
    const w = new World();
    const storage = fakeStorage();
    const panel = new SettingsPanel();
    panel.open();
    panel.update(200);
    // Walk to the reset row.
    for (let i = 0; i < 4; i++) panel.selectNext();
    expect(panel.selectedRow()).toBe('reset');
    const first = panel.confirm(w.player, storage);
    expect(first.kind).toBe('reset-requested');
    expect((storage as { wiped: boolean }).wiped).toBe(false);
    const second = panel.confirm(w.player, storage);
    expect(second.kind).toBe('reset-done');
    expect((storage as { wiped: boolean }).wiped).toBe(true);
  });

  it('moving the selection cancels an armed reset', () => {
    const w = new World();
    const panel = new SettingsPanel();
    panel.open();
    panel.update(200);
    for (let i = 0; i < 4; i++) panel.selectNext();
    panel.confirm(w.player, null);
    panel.selectPrev(); // moves to reduceMotion + disarms
    panel.selectNext(); // back to reset
    expect(panel.selectedRow()).toBe('reset');
    // Disarmed — first confirm asks again.
    const out = panel.confirm(w.player, null);
    expect(out.kind).toBe('reset-requested');
  });

  it('close row hides the panel', () => {
    const w = new World();
    const panel = new SettingsPanel();
    panel.open();
    panel.update(200);
    for (let i = 0; i < 5; i++) panel.selectNext();
    expect(panel.selectedRow()).toBe('close');
    const out = panel.confirm(w.player, null);
    expect(out.kind).toBe('closed');
    expect(panel.isVisible()).toBe(false);
  });
});

describe('settings persistence', () => {
  it('survives a snapshot round-trip', () => {
    const a = fakeGame();
    const s = getSettings(a.world.player);
    s.autoSave = false;
    s.nightTintScale = 0.3;
    s.hudScale = 1.25;
    s.reduceMotion = true;
    const snap = serializeGame(a);
    const b = fakeGame();
    const fresh = getSettings(b.world.player);
    expect(fresh.autoSave).toBe(true); // defaults
    applySnapshot(b, snap);
    const restored = getSettings(b.world.player);
    expect(restored.autoSave).toBe(false);
    expect(restored.nightTintScale).toBe(0.3);
    expect(restored.hudScale).toBe(1.25);
    expect(restored.reduceMotion).toBe(true);
  });

  it('older saves without settings backfill defaults transparently', () => {
    const w = new World();
    // Manually create a settings record missing reduceMotion.
    (w.player as unknown as { settings: Record<string, unknown> }).settings = {
      autoSave: false,
      nightTintScale: 0.5,
      hudScale: 1.5,
      // reduceMotion absent on purpose
    };
    const s = getSettings(w.player);
    expect(s.autoSave).toBe(false);
    expect(s.nightTintScale).toBe(0.5);
    expect(s.hudScale).toBe(1.5);
    expect(s.reduceMotion).toBe(false); // backfilled default
  });
});

// Suppress unused-import vi warning when tests change later.
void vi;

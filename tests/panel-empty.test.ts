// Panel empty-states — shared "nothing here yet" vocabulary + the lore
// Rumors-tab contextual resolver.

import { describe, it, expect } from 'vitest';
import {
  PANEL_EMPTY_STATES,
  loreEmptyState,
} from '../src/game/panel-empty';

describe('PANEL_EMPTY_STATES', () => {
  it('every registered state has a non-empty message and hint', () => {
    for (const key of Object.keys(PANEL_EMPTY_STATES) as (keyof typeof PANEL_EMPTY_STATES)[]) {
      const s = PANEL_EMPTY_STATES[key];
      expect(s.message.trim().length).toBeGreaterThan(0);
      expect(s.hint.trim().length).toBeGreaterThan(0);
    }
  });

  it('carries the money log + quest log states', () => {
    expect(PANEL_EMPTY_STATES.moneyLog.message).toMatch(/coin/i);
    expect(PANEL_EMPTY_STATES.questLog.message).toMatch(/quest/i);
  });

  it('contains no emoji (game chrome stays monochrome)', () => {
    const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const key of Object.keys(PANEL_EMPTY_STATES) as (keyof typeof PANEL_EMPTY_STATES)[]) {
      const s = PANEL_EMPTY_STATES[key];
      expect(emoji.test(s.message)).toBe(false);
      expect(emoji.test(s.hint)).toBe(false);
    }
  });
});

describe('loreEmptyState', () => {
  it('returns null when the list has rows (no empty state needed)', () => {
    expect(loreEmptyState('Rumors', 'all', 3)).toBeNull();
    expect(loreEmptyState('Fish', 'all', 5)).toBeNull();
  });

  it('gives a calm default for a (defensively) empty catalog tab', () => {
    const s = loreEmptyState('Fish', 'all', 0);
    expect(s).not.toBeNull();
    expect(s!.message.length).toBeGreaterThan(0);
  });

  it('wording for an empty Rumors tab depends on the filter', () => {
    const all = loreEmptyState('Rumors', 'all', 0);
    const bought = loreEmptyState('Rumors', 'bought', 0);
    const skipped = loreEmptyState('Rumors', 'skipped', 0);
    expect(all!.message).toMatch(/no rumors/i);
    expect(bought!.message).toMatch(/bought/i);
    expect(skipped!.message).toMatch(/skipped/i);
    // The three are distinct so the player learns WHY it's empty.
    const msgs = new Set([all!.message, bought!.message, skipped!.message]);
    expect(msgs.size).toBe(3);
  });

  it('every Rumors empty state carries a populate hint', () => {
    for (const f of ['all', 'bought', 'skipped'] as const) {
      const s = loreEmptyState('Rumors', f, 0);
      expect(s!.hint.trim().length).toBeGreaterThan(0);
    }
  });
});

// nextFilterHint — the shared "press f for <next>" CTA the filterable
// panels show when a filter empties the list. Verifies it names where the
// NEXT cycle press lands across each panel-family filter's real cycle.

import { describe, it, expect } from 'vitest';
import { nextFilterHint } from '../src/game/panel-empty';
import {
  cycleCodexFilter,
  codexFilterLabel,
  CODEX_FILTERS,
} from '../src/game/cooking-history';
import {
  cycleQuestFilter,
  questFilterLabel,
  QUEST_FILTERS,
} from '../src/game/quest-log';
import {
  cycleMoneyFilter,
  moneyFilterLabel,
  MONEY_FILTERS,
} from '../src/game/money-log';
import {
  cycleAchievementFilter,
  achievementFilterLabel,
  ACHIEVEMENT_FILTERS,
} from '../src/game/achievements';

describe('nextFilterHint', () => {
  it('names the label of the NEXT filter in the cycle', () => {
    // codex: all -> cooked
    expect(nextFilterHint('all', cycleCodexFilter, codexFilterLabel)).toBe('press f for cooked');
    // quest-log: active -> done
    expect(nextFilterHint('active', cycleQuestFilter, questFilterLabel)).toBe('press f for done');
    // money-log: spending -> all (wraps)
    expect(nextFilterHint('spending', cycleMoneyFilter, moneyFilterLabel)).toBe('press f for all');
    // achievements: earned -> locked
    expect(nextFilterHint('earned', cycleAchievementFilter, achievementFilterLabel)).toBe(
      'press f for locked',
    );
  });

  it('always reads "press f for <a real label in the cycle>"', () => {
    const cases: Array<[readonly string[], (f: never) => never, (f: never) => string]> = [
      [CODEX_FILTERS, cycleCodexFilter as never, codexFilterLabel as never],
      [QUEST_FILTERS, cycleQuestFilter as never, questFilterLabel as never],
      [MONEY_FILTERS, cycleMoneyFilter as never, moneyFilterLabel as never],
      [ACHIEVEMENT_FILTERS, cycleAchievementFilter as never, achievementFilterLabel as never],
    ];
    for (const [filters, cycle, label] of cases) {
      const validLabels = new Set(filters.map((f) => label(f as never)));
      for (const f of filters) {
        const hint = nextFilterHint(f as never, cycle, label);
        expect(hint.startsWith('press f for ')).toBe(true);
        const named = hint.slice('press f for '.length);
        expect(validLabels.has(named)).toBe(true);
        // No emoji / non-ASCII in panel chrome.
        expect(/^[\x20-\x7E]+$/.test(hint)).toBe(true);
      }
    }
  });

  it('walking the hint around a full cycle visits every other-than-current label', () => {
    // For a 3-cycle (quest), the next-labels across all starts cover the
    // whole cycle exactly once (it's a rotation).
    const nexts = QUEST_FILTERS.map((f) =>
      nextFilterHint(f, cycleQuestFilter, questFilterLabel).slice('press f for '.length),
    );
    expect(new Set(nexts).size).toBe(QUEST_FILTERS.length);
  });
});

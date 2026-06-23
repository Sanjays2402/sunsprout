// Dawn-toast composer — pure helper that assembles the morning
// headline with any number of optional tail strings, skipping empties
// without painting dangling separators.
//
// Why a dedicated module: the engine's dawn-rollover branch had grown
// a chain of ternary appends (pondOverflow, haulRecap, compostNudge);
// every new tail added one more `if (x) headline = ${headline} · ${x}`
// in game.ts. The chain was inching toward six branches and the
// roadmap observation flagged retiring it before it bloated further.
// assembleDawnToast() reduces the engine to a single call regardless
// of how many tails come and go.

import { describe, it, expect } from 'vitest';
import { assembleDawnToast } from '../src/game/dawn-toast';

describe('assembleDawnToast — basic shapes', () => {
  it('returns just the headline when no tails are passed', () => {
    expect(assembleDawnToast('A new day begins · Day 4', [])).toBe(
      'A new day begins · Day 4',
    );
  });

  it('returns just the headline when every tail is empty', () => {
    expect(
      assembleDawnToast('A new day begins · Day 4', ['', '', '']),
    ).toBe('A new day begins · Day 4');
  });

  it('joins one tail with a middle-dot separator', () => {
    expect(
      assembleDawnToast('Day 4', ['Yesterday\'s mine haul: 3 copper']),
    ).toBe('Day 4 · Yesterday\'s mine haul: 3 copper');
  });

  it('joins multiple tails in the order they were passed', () => {
    expect(
      assembleDawnToast('Day 4', ['first', 'second', 'third']),
    ).toBe('Day 4 · first · second · third');
  });
});

describe('assembleDawnToast — empty-skip behavior', () => {
  it('skips an empty string in the middle of the tail list', () => {
    expect(assembleDawnToast('Day 4', ['first', '', 'third'])).toBe(
      'Day 4 · first · third',
    );
  });

  it('skips null and undefined entries', () => {
    expect(
      assembleDawnToast('Day 4', ['first', null, undefined, 'last']),
    ).toBe('Day 4 · first · last');
  });

  it('treats a leading empty tail as a skip rather than a double separator', () => {
    expect(assembleDawnToast('Day 4', ['', 'first'])).toBe(
      'Day 4 · first',
    );
  });

  it('treats a trailing empty tail as a skip rather than a dangling dot', () => {
    expect(assembleDawnToast('Day 4', ['first', ''])).toBe(
      'Day 4 · first',
    );
  });
});

describe('assembleDawnToast — purity', () => {
  it('does not mutate the tails array', () => {
    const tails = ['first', '', 'third'];
    const before = [...tails];
    assembleDawnToast('Day 4', tails);
    expect(tails).toEqual(before);
  });

  it('handles a tail that itself contains a middle dot without splitting it', () => {
    // The tail might already carry a · (e.g. pondOverflow + haulRecap
    // composed externally). The composer is dumb-join, so the inner
    // dot survives unchanged.
    const composed = assembleDawnToast('Day 4', [
      'tail1 · with embedded dot',
    ]);
    expect(composed).toBe('Day 4 · tail1 · with embedded dot');
  });
});

describe('assembleDawnToast — engine integration shape', () => {
  it('mirrors the actual dawn chain — base + pondOverflow + haulRecap + compostNudge + deepVeinBrag', () => {
    // The engine currently builds the chain in this exact order, and
    // this test pins the contract so a future refactor knows what the
    // composer is replacing in game.ts.
    const headline = 'A new day begins · Day 12 — Spring storm cleared.';
    const pondOverflow = 'Pond is overflowing — collect or lose.';
    const haulRecap = 'Yesterday\'s mine haul: 4 copper, 1 ruby (worth 218g).';
    const compostNudge = 'Halfway to Compost Master - 30g to go.';
    const deepVeinBrag = '';  // not earned today
    const out = assembleDawnToast(headline, [
      pondOverflow,
      haulRecap,
      compostNudge,
      deepVeinBrag,
    ]);
    expect(out).toBe(
      `${headline} · ${pondOverflow} · ${haulRecap} · ${compostNudge}`,
    );
  });

  it('does not paint any separator when ALL tails for the dawn are silent', () => {
    const headline = 'A new day begins · Day 8';
    const out = assembleDawnToast(headline, ['', '', '', '']);
    expect(out).toBe(headline);
  });
});

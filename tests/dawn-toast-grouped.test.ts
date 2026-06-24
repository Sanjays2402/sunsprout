// Dawn-toast grouped composer — pins the contract for the two-bucket
// {system, achievement} call shape that lets the morning brags
// cluster into a single celebration chip rather than a wall of
// equal-weight peer phrases as the brag count climbs past 7.
//
// Why: the flat-array call shape worked through 4-5 tails but at 7
// (pondOverflow + haulRecap + compostNudge + deepVein + chainTier +
// sash + rareMaster) the toast reads as a wall of `·`-separated
// peers — every phrase the same visual weight. Splitting the
// system-vs-achievement intent into two groups lets the composer
// pack the achievement brags as one " • "-joined cluster bracketed
// by a single " · " from the system block, so a morning that lands
// three brags at once reads as ONE celebration burst.

import { describe, it, expect } from 'vitest';
import { assembleDawnToast } from '../src/game/dawn-toast';

describe('assembleDawnToast — grouped form basics', () => {
  it('returns just the headline when both groups are empty', () => {
    expect(
      assembleDawnToast('A new day begins · Day 4', { system: [], achievement: [] }),
    ).toBe('A new day begins · Day 4');
  });

  it('returns just the headline when both groups contain only empties', () => {
    expect(
      assembleDawnToast('A new day begins · Day 4', {
        system: ['', null, undefined],
        achievement: [null, '', undefined],
      }),
    ).toBe('A new day begins · Day 4');
  });

  it('joins system tails with the middle-dot separator', () => {
    expect(
      assembleDawnToast('Day 4', {
        system: ['Yesterday\'s mine haul: 3 copper', 'Halfway to Compost Master - 30g to go.'],
      }),
    ).toBe(
      'Day 4 · Yesterday\'s mine haul: 3 copper · Halfway to Compost Master - 30g to go.',
    );
  });

  it('joins achievement tails with the bullet separator inside one middle-dot chip', () => {
    expect(
      assembleDawnToast('Day 4', {
        achievement: ['Deep Vein unlocked - 22 gems pulled out in one run.', 'Compost Sash earned - 256g recycled across 70 bags.'],
      }),
    ).toBe(
      'Day 4 · Deep Vein unlocked - 22 gems pulled out in one run. • Compost Sash earned - 256g recycled across 70 bags.',
    );
  });
});

describe('assembleDawnToast — grouped form composition', () => {
  it('puts system tails BEFORE the achievement cluster regardless of object key order', () => {
    // Object spread order shouldn't influence the join order — the
    // composer is contract-defined as "system first, then achievements".
    const out = assembleDawnToast('Day 4', {
      achievement: ['brag1', 'brag2'],
      system: ['sys1', 'sys2'],
    });
    expect(out).toBe('Day 4 · sys1 · sys2 · brag1 • brag2');
  });

  it('emits exactly one middle-dot between the system block and the achievement cluster', () => {
    const out = assembleDawnToast('Day 4', {
      system: ['sys1'],
      achievement: ['brag1', 'brag2', 'brag3'],
    });
    // No double-dot, no trailing space, no leading bullet.
    expect(out).toBe('Day 4 · sys1 · brag1 • brag2 • brag3');
    // Sanity: middle dot appears exactly twice (once after headline,
    // once between sys1 and the brag cluster).
    const dots = (out.match(/ · /g) || []).length;
    expect(dots).toBe(2);
  });

  it('skips the leading middle-dot when only the achievement cluster is non-empty', () => {
    const out = assembleDawnToast('Day 4', {
      system: ['', null],
      achievement: ['brag1', 'brag2'],
    });
    // Headline gets its dot-join straight to the brag cluster — no
    // dangling middle-dot from a phantom empty system block.
    expect(out).toBe('Day 4 · brag1 • brag2');
  });

  it('skips the achievement chip entirely when every brag is empty', () => {
    const out = assembleDawnToast('Day 4', {
      system: ['sys1', 'sys2'],
      achievement: ['', null, undefined],
    });
    // No trailing middle-dot from a phantom empty brag cluster.
    expect(out).toBe('Day 4 · sys1 · sys2');
  });

  it('handles a single brag without painting a bullet (no peer to separate from)', () => {
    const out = assembleDawnToast('Day 4', {
      system: ['sys1'],
      achievement: ['brag-alone'],
    });
    // The bullet is a SEPARATOR — with one element it should not appear.
    expect(out).toBe('Day 4 · sys1 · brag-alone');
    expect(out).not.toContain(' • ');
  });

  it('skips empty entries inside each group without painting double separators', () => {
    const out = assembleDawnToast('Day 4', {
      system: ['sys1', '', 'sys2', null, 'sys3'],
      achievement: ['brag1', null, 'brag2', undefined, 'brag3'],
    });
    expect(out).toBe('Day 4 · sys1 · sys2 · sys3 · brag1 • brag2 • brag3');
  });
});

describe('assembleDawnToast — backward compatibility with flat-array form', () => {
  it('flat array still reads with middle-dot separators', () => {
    expect(
      assembleDawnToast('Day 4', ['first', 'second', 'third']),
    ).toBe('Day 4 · first · second · third');
  });

  it('flat array skips empty entries as before', () => {
    expect(
      assembleDawnToast('Day 4', ['first', '', null, 'second']),
    ).toBe('Day 4 · first · second');
  });

  it('flat empty array returns the headline alone', () => {
    expect(assembleDawnToast('Day 4', [])).toBe('Day 4');
  });
});

describe('assembleDawnToast — engine integration shape (grouped)', () => {
  it('mirrors the actual dawn chain: system block + achievement cluster', () => {
    // Reproduces the engine call shape exactly so a future refactor
    // knows what assembleDawnToast is replacing.
    const headline = 'A new day begins · Day 14';
    const pondOverflow = '';
    const haulRecap = 'Yesterday\'s mine haul: 5 copper, 1 iron (worth 80g).';
    const compostNudge = '';
    const deepVeinBrag = 'Deep Vein unlocked - 20 gems pulled out in one run.';
    const chainTierBrag = 'Your owl chain is in the regular tier now (+20%).';
    const sashBrag = '';
    const rareMasterBrag = '';
    const out = assembleDawnToast(headline, {
      system: [pondOverflow, haulRecap, compostNudge],
      achievement: [deepVeinBrag, chainTierBrag, sashBrag, rareMasterBrag],
    });
    expect(out).toBe(
      `${headline} · ${haulRecap} · ${deepVeinBrag} • ${chainTierBrag}`,
    );
  });

  it('reads quiet on a no-event dawn — no separators painted at all', () => {
    const headline = 'A new day begins · Day 7';
    const out = assembleDawnToast(headline, {
      system: ['', '', ''],
      achievement: ['', '', '', ''],
    });
    expect(out).toBe(headline);
  });
});

describe('assembleDawnToast — grouped form purity', () => {
  it('does not mutate the system array', () => {
    const system = ['a', '', 'b'];
    const before = [...system];
    assembleDawnToast('Day 4', { system, achievement: [] });
    expect(system).toEqual(before);
  });

  it('does not mutate the achievement array', () => {
    const achievement = ['x', '', 'y'];
    const before = [...achievement];
    assembleDawnToast('Day 4', { system: [], achievement });
    expect(achievement).toEqual(before);
  });
});

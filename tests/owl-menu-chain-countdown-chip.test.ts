// Active-chain countdown chip — compact "Nd streak" label for the
// owl-menu active-chain-target row. Surfaces the CURRENT chain
// length (not the previewed-next length) so the player reads at a
// glance how many consecutive days of mailing they're already on,
// independent of whether the next send would extend the chain into
// a higher bonus tier.
//
// Pins the contract:
//   - empty when npcId is not the active chain target
//   - empty when no chain is active at all
//   - empty when the chain has been broken (day skip)
//   - non-empty at length 1 (reinforces halo on fresh streaks)
//   - non-empty at every length the active chain holds
//   - on the day after the last dispatch, still surfaces the streak
//     length (the chain hasn't broken yet — it's "still warm")

import { describe, it, expect } from 'vitest';
import {
  activeChainCountdownChip,
  recordOwlChain,
  type OwlStampBook,
} from '../src/game/owl-post';

interface Carrier {
  owlStamps?: OwlStampBook;
}

describe('activeChainCountdownChip — silence cases', () => {
  it('returns empty when no chain has ever been recorded', () => {
    const p: Carrier = {};
    expect(activeChainCountdownChip(p, 'maple', 0)).toBe('');
  });

  it('returns empty when the chain is active for a different recipient', () => {
    const p: Carrier = {};
    recordOwlChain(p, 'maple', 5);
    expect(activeChainCountdownChip(p, 'finn', 5)).toBe('');
  });

  it('returns empty when the chain has been broken by a skipped day', () => {
    const p: Carrier = {};
    recordOwlChain(p, 'maple', 5);
    recordOwlChain(p, 'maple', 6);
    // Two-day chain ending on day 6. Today is day 10 — chain is broken.
    expect(activeChainCountdownChip(p, 'maple', 10)).toBe('');
  });

  it('returns empty when the day is past chain.lastDay + 1', () => {
    const p: Carrier = {};
    recordOwlChain(p, 'maple', 0);
    // Last dispatch was day 0. Day 1 is still in-streak (could send
    // today). Day 2 means the player skipped — chip goes silent.
    expect(activeChainCountdownChip(p, 'maple', 1)).not.toBe('');
    expect(activeChainCountdownChip(p, 'maple', 2)).toBe('');
  });
});

describe('activeChainCountdownChip — emits at every length', () => {
  it('surfaces the chip at length 1 (fresh streak)', () => {
    const p: Carrier = {};
    recordOwlChain(p, 'maple', 0);
    expect(activeChainCountdownChip(p, 'maple', 0)).toBe('1d streak');
    // Day after — still valid (haven't broken yet).
    expect(activeChainCountdownChip(p, 'maple', 1)).toBe('1d streak');
  });

  it('grows the count as the chain extends', () => {
    const p: Carrier = {};
    for (let d = 0; d < 7; d++) {
      recordOwlChain(p, 'maple', d);
    }
    expect(activeChainCountdownChip(p, 'maple', 6)).toBe('7d streak');
    expect(activeChainCountdownChip(p, 'maple', 7)).toBe('7d streak');
  });

  it('keeps surfacing the count for a long-running streak', () => {
    const p: Carrier = {};
    for (let d = 0; d < 30; d++) {
      recordOwlChain(p, 'maple', d);
    }
    expect(activeChainCountdownChip(p, 'maple', 29)).toBe('30d streak');
  });
});

describe('activeChainCountdownChip — chain reset semantics', () => {
  it('drops to length 1 after a recipient swap', () => {
    const p: Carrier = {};
    for (let d = 0; d < 5; d++) {
      recordOwlChain(p, 'maple', d);
    }
    expect(activeChainCountdownChip(p, 'maple', 4)).toBe('5d streak');
    // Player switches to Finn on day 5 — Maple's chain is broken,
    // Finn's chain starts at 1.
    recordOwlChain(p, 'finn', 5);
    expect(activeChainCountdownChip(p, 'maple', 5)).toBe('');
    expect(activeChainCountdownChip(p, 'finn', 5)).toBe('1d streak');
  });

  it('drops to length 1 after a day skip + same recipient', () => {
    const p: Carrier = {};
    for (let d = 0; d < 5; d++) {
      recordOwlChain(p, 'maple', d);
    }
    // Skip days 5 and 6 — day 7 chain resets.
    recordOwlChain(p, 'maple', 7);
    expect(activeChainCountdownChip(p, 'maple', 7)).toBe('1d streak');
  });
});

describe('activeChainCountdownChip — independence from previewChainLength', () => {
  it('reads CURRENT chain length, not the previewed next length', () => {
    const p: Carrier = {};
    // Chain at length 3, last day = 2.
    for (let d = 0; d < 3; d++) {
      recordOwlChain(p, 'maple', d);
    }
    // Calling the chip on day 3 (next-eligible-day) surfaces 3, not 4.
    // The bonus chip would surface the +1 tier (4 → 1.2x); this chip
    // is the "you're currently riding 3 days" reinforcement.
    expect(activeChainCountdownChip(p, 'maple', 3)).toBe('3d streak');
  });
});

describe('activeChainCountdownChip — pure read', () => {
  it('does not mutate the chain on call', () => {
    const p: Carrier = {};
    recordOwlChain(p, 'maple', 5);
    const before = JSON.stringify(p.owlStamps);
    activeChainCountdownChip(p, 'maple', 5);
    activeChainCountdownChip(p, 'maple', 6);
    activeChainCountdownChip(p, 'finn', 5);
    expect(JSON.stringify(p.owlStamps)).toBe(before);
  });
});

// Chain-recipient dawn brag — one-shot celebratory tail the morning
// AFTER the player's active owl-chain reaches
// OWL_CHAIN_RECIPIENT_BRAG_LENGTH (25) consecutive days with ONE
// specific NPC. Per-recipient sticky: each NPC earns the brag once,
// but a separate chain to a DIFFERENT recipient hitting the same
// threshold later fires its own brag.
//
// Pins the contract:
//   - silent below the threshold
//   - fires exactly once on the dawn after crossing
//   - subsequent dawns stay quiet (one-shot semantics)
//   - per-recipient sticky: same NPC twice = brag once, different NPC = brag again
//   - chain reset between crossing day and next dawn STILL fires the
//     brag (it celebrates the crossing that happened, not the live state)

import { describe, it, expect } from 'vitest';
import {
  OWL_CHAIN_RECIPIENT_BRAG_LENGTH,
  chainRecipientDawnBrag,
  getOwlStamps,
  recordOwlChain,
  type OwlStampBook,
} from '../src/game/owl-post';

interface Carrier {
  owlStamps?: OwlStampBook;
}

function mkPlayer(): Carrier {
  return {};
}

describe('OWL_CHAIN_RECIPIENT_BRAG_LENGTH constant', () => {
  it('is tuned at a full month of daily owls', () => {
    expect(OWL_CHAIN_RECIPIENT_BRAG_LENGTH).toBe(25);
  });
});

describe('chainRecipientDawnBrag — silence cases', () => {
  it('returns empty when no chain has ever been recorded', () => {
    const p = mkPlayer();
    expect(chainRecipientDawnBrag(p)).toBe('');
  });

  it('returns empty when the chain hasn\'t reached the threshold yet', () => {
    const p = mkPlayer();
    for (let d = 0; d < OWL_CHAIN_RECIPIENT_BRAG_LENGTH - 1; d++) {
      recordOwlChain(p, 'maple', d);
    }
    expect(chainRecipientDawnBrag(p)).toBe('');
  });

  it('stays silent after the brag has fired and no fresh crossing has occurred', () => {
    const p = mkPlayer();
    for (let d = 0; d < OWL_CHAIN_RECIPIENT_BRAG_LENGTH; d++) {
      recordOwlChain(p, 'maple', d);
    }
    // First dawn fires the brag.
    expect(chainRecipientDawnBrag(p)).not.toBe('');
    // Second dawn (and every subsequent one) is silent.
    expect(chainRecipientDawnBrag(p)).toBe('');
    expect(chainRecipientDawnBrag(p)).toBe('');
  });

  it('returns empty for an armed pending that refers to a non-existent NPC (defensive)', () => {
    const p = mkPlayer();
    // Manually arm with a garbage id — simulates corrupted save.
    const book = getOwlStamps(p);
    book.chainRecipientBragPending = 'not-a-real-npc';
    expect(chainRecipientDawnBrag(p)).toBe('');
    // The pending flag is still cleared even on the defensive return
    // so a bad value doesn't haunt subsequent dawns.
    expect(getOwlStamps(p).chainRecipientBragPending).toBeUndefined();
  });
});

describe('chainRecipientDawnBrag — fires exactly once on threshold crossing', () => {
  it('fires on the dawn after the 25th consecutive day to one recipient', () => {
    const p = mkPlayer();
    for (let d = 0; d < OWL_CHAIN_RECIPIENT_BRAG_LENGTH; d++) {
      recordOwlChain(p, 'maple', d);
    }
    const brag = chainRecipientDawnBrag(p);
    expect(brag).toContain('Maple');
    expect(brag).toContain('25');
    expect(brag.toLowerCase()).toContain('owl-mail companion');
  });

  it('arms the pending flag on the day the threshold is reached', () => {
    const p = mkPlayer();
    for (let d = 0; d < OWL_CHAIN_RECIPIENT_BRAG_LENGTH - 1; d++) {
      recordOwlChain(p, 'maple', d);
    }
    expect(getOwlStamps(p).chainRecipientBragPending).toBeUndefined();
    recordOwlChain(p, 'maple', OWL_CHAIN_RECIPIENT_BRAG_LENGTH - 1);
    expect(getOwlStamps(p).chainRecipientBragPending).toBe('maple');
  });

  it('clears the pending flag after the brag fires', () => {
    const p = mkPlayer();
    for (let d = 0; d < OWL_CHAIN_RECIPIENT_BRAG_LENGTH; d++) {
      recordOwlChain(p, 'maple', d);
    }
    chainRecipientDawnBrag(p);
    expect(getOwlStamps(p).chainRecipientBragPending).toBeUndefined();
  });

  it('sets the per-recipient fired flag after the brag fires', () => {
    const p = mkPlayer();
    for (let d = 0; d < OWL_CHAIN_RECIPIENT_BRAG_LENGTH; d++) {
      recordOwlChain(p, 'maple', d);
    }
    chainRecipientDawnBrag(p);
    expect(getOwlStamps(p).chainRecipientFired?.['maple']).toBe(true);
  });

  it('sets the top-level audit flag on the very first fire', () => {
    const p = mkPlayer();
    for (let d = 0; d < OWL_CHAIN_RECIPIENT_BRAG_LENGTH; d++) {
      recordOwlChain(p, 'maple', d);
    }
    expect(getOwlStamps(p).chainRecipientBragFired).toBeUndefined();
    chainRecipientDawnBrag(p);
    expect(getOwlStamps(p).chainRecipientBragFired).toBe(true);
  });
});

describe('chainRecipientDawnBrag — per-recipient sticky semantics', () => {
  it('a second 25-day chain to the SAME recipient does NOT re-fire the brag', () => {
    const p = mkPlayer();
    // First chain to Maple — fires brag.
    for (let d = 0; d < OWL_CHAIN_RECIPIENT_BRAG_LENGTH; d++) {
      recordOwlChain(p, 'maple', d);
    }
    expect(chainRecipientDawnBrag(p)).not.toBe('');
    // Chain breaks (skip days).
    // Then a fresh 25-day chain to Maple again — starting day 100.
    for (let d = 100; d < 100 + OWL_CHAIN_RECIPIENT_BRAG_LENGTH; d++) {
      recordOwlChain(p, 'maple', d);
    }
    // No new pending arm — the recipient is already celebrated.
    expect(getOwlStamps(p).chainRecipientBragPending).toBeUndefined();
    expect(chainRecipientDawnBrag(p)).toBe('');
  });

  it('a 25-day chain to a DIFFERENT recipient fires its own brag', () => {
    const p = mkPlayer();
    // First chain to Maple — fires brag.
    for (let d = 0; d < OWL_CHAIN_RECIPIENT_BRAG_LENGTH; d++) {
      recordOwlChain(p, 'maple', d);
    }
    chainRecipientDawnBrag(p);
    // Now build a 25-day chain to Finn (starting day 100, well past
    // Maple's chain so there's no carry-over).
    for (let d = 100; d < 100 + OWL_CHAIN_RECIPIENT_BRAG_LENGTH; d++) {
      recordOwlChain(p, 'finn', d);
    }
    const brag = chainRecipientDawnBrag(p);
    expect(brag).toContain('Finn');
    expect(brag.toLowerCase()).toContain('owl-mail companion');
    // Both recipients now have their fired stamp.
    expect(getOwlStamps(p).chainRecipientFired?.['maple']).toBe(true);
    expect(getOwlStamps(p).chainRecipientFired?.['finn']).toBe(true);
  });

  it('handles consecutive chain runs to different recipients across the save', () => {
    const p = mkPlayer();
    const recipients = ['maple', 'finn', 'rose'];
    let day = 0;
    for (const r of recipients) {
      for (let d = 0; d < OWL_CHAIN_RECIPIENT_BRAG_LENGTH; d++) {
        recordOwlChain(p, r, day);
        day += 1;
      }
      const brag = chainRecipientDawnBrag(p);
      expect(brag).not.toBe('');
      // Skip a day to break the chain before starting the next recipient.
      day += 2;
    }
    // All three recipients have their fired stamp.
    for (const r of recipients) {
      expect(getOwlStamps(p).chainRecipientFired?.[r]).toBe(true);
    }
  });
});

describe('chainRecipientDawnBrag — celebrate the crossing not the live state', () => {
  it('still fires after the chain has been reset between crossing day and next dawn', () => {
    const p = mkPlayer();
    for (let d = 0; d < OWL_CHAIN_RECIPIENT_BRAG_LENGTH; d++) {
      recordOwlChain(p, 'maple', d);
    }
    // Chain is armed. Player switches recipients on day 25 (resets
    // the live chain to length 1 with Finn).
    recordOwlChain(p, 'finn', OWL_CHAIN_RECIPIENT_BRAG_LENGTH);
    // The pending flag still names Maple — that's who we celebrate.
    const brag = chainRecipientDawnBrag(p);
    expect(brag).toContain('Maple');
    // The pending field has been cleared.
    expect(getOwlStamps(p).chainRecipientBragPending).toBeUndefined();
  });

  it('still fires after a save-reload where the chain has decayed away', () => {
    const p = mkPlayer();
    for (let d = 0; d < OWL_CHAIN_RECIPIENT_BRAG_LENGTH; d++) {
      recordOwlChain(p, 'maple', d);
    }
    // Simulate a reload that drops the live chain — but the pending
    // flag survives via persistence.
    const book = getOwlStamps(p);
    book.chain = { npcId: null, length: 0, lastDay: -1 };
    expect(book.chainRecipientBragPending).toBe('maple');
    const brag = chainRecipientDawnBrag(p);
    expect(brag).toContain('Maple');
  });
});

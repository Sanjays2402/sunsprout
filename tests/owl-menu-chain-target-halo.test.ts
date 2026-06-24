// Owl-menu chain-target row halo — distinct outline tint on the row
// for the active chain target so the player can visually distinguish
// "this is your active streak" beyond just the row-position sort that
// hoists it to row 0. Halo color matches the chain-bonus chip green
// so the two visual cues read as the same language.
//
// Tests cover:
//   - isActiveChainTarget pure helper across chain states
//   - per-NPC isolation (only one NPC at a time can be the chain target)
//   - length-1 chains still light up the halo (active intent, no bonus)
//   - chain reset (recipient swap / day skip) hands the halo to the
//     new target the moment the chain bumps
//   - menu draw integration via a stub CanvasRenderingContext2D — the
//     row stroke for the chain-target row uses the CHAIN_HALO color

import { describe, it, expect, vi } from 'vitest';
import { World } from '../src/world/world';
import {
  dispatchOwl,
  getOwlChain,
  getOwlStamps,
  isActiveChainTarget,
  recordOwlChain,
} from '../src/game/owl-post';
import { CANDIDATES } from '../src/game/hearts';
import { OwlMenu } from '../src/ui/owl-menu';

const NPC_A = 'maple';
const NPC_B = Object.keys(CANDIDATES).find((id) => id !== NPC_A)!;

function loadedPlayer(): World {
  const w = new World();
  w.player.gold = 5000;
  w.player.inventory.flower_harvest = 50;
  w.player.inventory.ruby = 50;
  if (!w.player.hearts) w.player.hearts = {};
  for (const id of Object.keys(CANDIDATES)) {
    w.player.hearts[id] = { points: 0, lastGiftDay: -1, lastTalkDay: 0 };
  }
  return w;
}

/**
 * Build a stub CanvasRenderingContext2D that records the strokeStyle
 * in effect at each strokeRect call. Returns the captured colors so
 * tests can assert the chain-target row used CHAIN_HALO. Typed as
 * `any` because the stub doesn't implement the full canvas API —
 * just enough for the OwlMenu draw path.
 */
function makeStrokeCapturingStub(): {
  ctx: CanvasRenderingContext2D;
  rowStrokeColors: () => unknown[];
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
    fillRect: vi.fn(),
    strokeRect: vi.fn(function (this: { strokeStyle: unknown }) {
      captured.push(this.strokeStyle);
    }),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 100 } as TextMetrics)),
  };
  // strokeRect callback wants `this`; bind it to the stub.
  stub.strokeRect = vi.fn(() => {
    captured.push(stub.strokeStyle);
  });
  return {
    ctx: stub as CanvasRenderingContext2D,
    rowStrokeColors: () => captured,
  };
}

describe('isActiveChainTarget — fresh save', () => {
  it('returns false for every NPC on a fresh save', () => {
    const w = loadedPlayer();
    for (const id of Object.keys(CANDIDATES)) {
      expect(isActiveChainTarget(w.player, id)).toBe(false);
    }
  });
});

describe('isActiveChainTarget — length-1 chain', () => {
  it('returns true for the chain target at length 1 (active intent, no bonus)', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    expect(getOwlChain(w.player).length).toBe(1);
    expect(isActiveChainTarget(w.player, NPC_A)).toBe(true);
  });

  it('returns false for non-chain-target NPCs even when a chain is active', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    expect(isActiveChainTarget(w.player, NPC_B)).toBe(false);
  });
});

describe('isActiveChainTarget — long chains', () => {
  it('returns true at every chain length tier', () => {
    const w = loadedPlayer();
    for (let d = 5; d <= 11; d++) recordOwlChain(w.player, NPC_A, d);
    expect(getOwlChain(w.player).length).toBe(7);
    expect(isActiveChainTarget(w.player, NPC_A)).toBe(true);
  });
});

describe('isActiveChainTarget — chain reset hands halo to new target', () => {
  it('switching recipient moves the halo', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    expect(isActiveChainTarget(w.player, NPC_A)).toBe(true);
    // Switch — chain resets to NPC_B at length 1.
    recordOwlChain(w.player, NPC_B, 6);
    expect(isActiveChainTarget(w.player, NPC_A)).toBe(false);
    expect(isActiveChainTarget(w.player, NPC_B)).toBe(true);
  });

  it('day skip resets chain to same NPC at length 1 — halo persists on same target', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    recordOwlChain(w.player, NPC_A, 6); // length 2
    // Skip day 7 -> day 8 lands a fresh chain at length 1 on NPC_A.
    recordOwlChain(w.player, NPC_A, 8);
    expect(getOwlChain(w.player).length).toBe(1);
    expect(isActiveChainTarget(w.player, NPC_A)).toBe(true);
  });
});

describe('isActiveChainTarget — pure read', () => {
  it('does NOT mutate state', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    const book = getOwlStamps(w.player);
    const snapshot = JSON.stringify({
      chain: book.chain,
      counts: book.counts,
      pending: book.chainTierBragPending,
    });
    isActiveChainTarget(w.player, NPC_A);
    isActiveChainTarget(w.player, NPC_B);
    isActiveChainTarget(w.player, 'nonexistent-id');
    const after = JSON.stringify({
      chain: book.chain,
      counts: book.counts,
      pending: book.chainTierBragPending,
    });
    expect(after).toBe(snapshot);
  });
});

describe('isActiveChainTarget — wires through real dispatch', () => {
  it('a real dispatch sets the active chain target', () => {
    const w = loadedPlayer();
    dispatchOwl(w.player, NPC_A, 5);
    expect(isActiveChainTarget(w.player, NPC_A)).toBe(true);
  });
});

describe('OwlMenu — halo color applied in draw', () => {
  it('draws the active chain-target row with the CHAIN_HALO color', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    const { ctx, rowStrokeColors } = makeStrokeCapturingStub();
    const menu = new OwlMenu();
    menu.open(w.player);
    menu.draw(ctx, w.player, 800, 600, 5);
    const colors = rowStrokeColors();
    // The chain target (NPC_A) is hoisted to row 0 by
    // owlCandidateIdsForMenu, but the first strokeRect call is the
    // PANEL border, not a row border. So we look for the halo color
    // appearing anywhere in the per-row strokes.
    expect(colors).toContain('rgba(143, 204, 106, 0.6)');
  });

  it('does NOT draw the halo when no chain is active (every row uses BORDER/ROW_BORDER)', () => {
    const w = loadedPlayer();
    // No recordOwlChain call — fresh save, no active target.
    const { ctx, rowStrokeColors } = makeStrokeCapturingStub();
    const menu = new OwlMenu();
    menu.open(w.player);
    menu.draw(ctx, w.player, 800, 600, 5);
    const colors = rowStrokeColors();
    expect(colors).not.toContain('rgba(143, 204, 106, 0.6)');
  });

  it('halo follows the chain target when it switches mid-session (re-open re-snapshots)', () => {
    const w = loadedPlayer();
    recordOwlChain(w.player, NPC_A, 5);
    const { ctx: ctx1, rowStrokeColors: rowsA } = makeStrokeCapturingStub();
    const menu = new OwlMenu();
    menu.open(w.player);
    menu.draw(ctx1, w.player, 800, 600, 5);
    expect(rowsA()).toContain('rgba(143, 204, 106, 0.6)');
    // Switch chain to NPC_B and re-open the menu so the snapshot
    // catches the new order.
    recordOwlChain(w.player, NPC_B, 6);
    const { ctx: ctx2, rowStrokeColors: rowsB } = makeStrokeCapturingStub();
    menu.close();
    menu.open(w.player);
    menu.draw(ctx2, w.player, 800, 600, 6);
    expect(rowsB()).toContain('rgba(143, 204, 106, 0.6)');
  });
});

// Farmhouse decor — buy/apply lifecycle + palette resolution.
import { describe, it, expect } from 'vitest';
import { World } from '../src/world/world';
import {
  DECOR_CATALOG,
  applyDecor,
  buyDecor,
  clearSlot,
  decorOwnedCount,
  decorPalette,
  findPiece,
  getDecor,
  ownsDecor,
} from '../src/game/decor';

function freshPlayer(gold: number = 2000) {
  const w = new World();
  w.player.gold = gold;
  return w.player;
}

describe('decor catalog', () => {
  it('has at least one wallpaper and one floor', () => {
    const wp = DECOR_CATALOG.filter((p) => p.slot === 'wallpaper');
    const fl = DECOR_CATALOG.filter((p) => p.slot === 'floor');
    expect(wp.length).toBeGreaterThan(0);
    expect(fl.length).toBeGreaterThan(0);
  });

  it('each piece has unique stable key', () => {
    const keys = DECOR_CATALOG.map((p) => p.key);
    const dedup = new Set(keys);
    expect(dedup.size).toBe(keys.length);
  });

  it('every wallpaper paints at least the wall + trim', () => {
    for (const p of DECOR_CATALOG.filter((d) => d.slot === 'wallpaper')) {
      expect(p.swap.wall).toBeTruthy();
      expect(p.swap.trim).toBeTruthy();
    }
  });

  it('every floor paints at least the roof', () => {
    for (const p of DECOR_CATALOG.filter((d) => d.slot === 'floor')) {
      expect(p.swap.roof).toBeTruthy();
    }
  });

  it('findPiece returns the matching entry or undefined', () => {
    expect(findPiece(DECOR_CATALOG[0].key)?.key).toBe(DECOR_CATALOG[0].key);
    expect(findPiece('nope-not-a-thing')).toBeUndefined();
  });
});

describe('buyDecor', () => {
  it('charges gold + adds to owned + auto-applies the piece', () => {
    const p = freshPlayer(2000);
    const piece = DECOR_CATALOG.find((d) => d.slot === 'wallpaper')!;
    const before = p.gold;
    const out = buyDecor(p, piece.key);
    expect(out.kind).toBe('bought');
    expect(p.gold).toBe(before - piece.price);
    expect(ownsDecor(p, piece.key)).toBe(true);
    expect(getDecor(p).activeWallpaper).toBe(piece.key);
  });

  it('refuses without enough gold', () => {
    const p = freshPlayer(10);
    const piece = DECOR_CATALOG[0];
    const out = buyDecor(p, piece.key);
    expect(out.kind).toBe('not-enough-gold');
    expect(ownsDecor(p, piece.key)).toBe(false);
  });

  it('refuses unknown keys', () => {
    const p = freshPlayer(9999);
    const out = buyDecor(p, 'wallpaper-nope');
    expect(out.kind).toBe('unknown');
  });

  it('treats a second purchase as already-owned (no double-spend)', () => {
    const p = freshPlayer(9999);
    const piece = DECOR_CATALOG[0];
    buyDecor(p, piece.key);
    const after = p.gold;
    const out = buyDecor(p, piece.key);
    expect(out.kind).toBe('already-owned');
    expect(p.gold).toBe(after);
  });
});

describe('applyDecor / clearSlot', () => {
  it('applyDecor flips the active slot only when owned', () => {
    const p = freshPlayer(5000);
    const wp = DECOR_CATALOG.find((d) => d.slot === 'wallpaper')!;
    expect(applyDecor(p, wp.key).kind).toBe('not-owned');
    buyDecor(p, wp.key);
    expect(applyDecor(p, wp.key).kind).toBe('applied');
    expect(getDecor(p).activeWallpaper).toBe(wp.key);
  });

  it('clearSlot reverts to the default skin', () => {
    const p = freshPlayer(5000);
    const wp = DECOR_CATALOG.find((d) => d.slot === 'wallpaper')!;
    buyDecor(p, wp.key);
    clearSlot(p, 'wallpaper');
    expect(getDecor(p).activeWallpaper).toBeNull();
  });

  it('floor and wallpaper slots are independent', () => {
    const p = freshPlayer(5000);
    const wp = DECOR_CATALOG.find((d) => d.slot === 'wallpaper')!;
    const fl = DECOR_CATALOG.find((d) => d.slot === 'floor')!;
    buyDecor(p, wp.key);
    buyDecor(p, fl.key);
    const state = getDecor(p);
    expect(state.activeWallpaper).toBe(wp.key);
    expect(state.activeFloor).toBe(fl.key);
    clearSlot(p, 'wallpaper');
    expect(state.activeWallpaper).toBeNull();
    expect(state.activeFloor).toBe(fl.key);
  });
});

describe('decorPalette', () => {
  it('is empty before any decor is applied', () => {
    const p = freshPlayer();
    const pal = decorPalette(p);
    expect(Object.keys(pal).length).toBe(0);
  });

  it('returns wall+trim+window after wallpaper applied', () => {
    const p = freshPlayer(5000);
    const wp = DECOR_CATALOG.find((d) => d.slot === 'wallpaper')!;
    buyDecor(p, wp.key);
    const pal = decorPalette(p);
    expect(pal.wall).toBe(wp.swap.wall);
    expect(pal.trim).toBe(wp.swap.trim);
  });

  it('combines wallpaper + floor swaps into one palette', () => {
    const p = freshPlayer(5000);
    const wp = DECOR_CATALOG.find((d) => d.slot === 'wallpaper')!;
    const fl = DECOR_CATALOG.find((d) => d.slot === 'floor')!;
    buyDecor(p, wp.key);
    buyDecor(p, fl.key);
    const pal = decorPalette(p);
    expect(pal.wall).toBe(wp.swap.wall);
    expect(pal.roof).toBe(fl.swap.roof);
  });
});

describe('decorOwnedCount', () => {
  it('starts at 0 then climbs as the player buys pieces', () => {
    const p = freshPlayer(9999);
    expect(decorOwnedCount(p)).toBe(0);
    buyDecor(p, DECOR_CATALOG[0].key);
    buyDecor(p, DECOR_CATALOG[1].key);
    expect(decorOwnedCount(p)).toBe(2);
  });
});

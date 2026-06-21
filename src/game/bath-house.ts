// Bath house — late-game village fixture that boosts max stamina for a
// few in-game days in exchange for gold.
//
// The bath house sits a few tiles east of the cave outcrop / north-east
// of the village square. Pressing E adjacent to it spends BATH_FEE gold
// and bumps the player's stamina pool MAX up by BATH_BONUS for the next
// BATH_DURATION_DAYS days. After the buff expires the max returns to
// MAX_STAMINA so a save loaded mid-buff doesn't lock the bonus in.
//
// Design intent: a gentle late-game money sink. Once the player is
// pulling 1000g+ a day from the well it's natural to spend 200g on a
// soak — and the +30 stamina for a few days lets a long mining run or
// a big till day breathe. Stacking is a no-op: a second visit refreshes
// the timer at full BATH_DURATION_DAYS rather than compounding the cap.
//
// Pure module: no IO, no canvas. The Game places the bath house in
// render(), wires the E-press near it, and ticks expiry at dawn.

import type { Player } from '../world/world';
import type { StaminaState } from './stamina';
import { getStamina, MAX_STAMINA } from './stamina';

/** Tile-space coordinates of the bath house. Sits NE of the plaza. */
export const BATH_X = 30;
export const BATH_Y = 7;
/** Chebyshev approach radius. */
export const BATH_INTERACT_RADIUS = 1;

/** Gold cost of one soak. */
export const BATH_FEE = 200;
/** Extra stamina cap granted while the buff is active. */
export const BATH_BONUS = 30;
/** How many in-game days the buff lasts AFTER the dawn it was bought. */
export const BATH_DURATION_DAYS = 3;

/** Per-player bath-house bookkeeping. */
export interface BathState {
  /** Day index the buff EXPIRES on (>= today means buff is active). */
  expiresOnDay: number;
}

/** Lazy reader on the Player. */
export function getBath(player: Player): BathState {
  const p = player as Player & { bath?: BathState };
  if (!p.bath) p.bath = { expiresOnDay: -1 };
  return p.bath;
}

/** True iff (px,py) is within Chebyshev BATH_INTERACT_RADIUS of the bath house. */
export function nearBath(px: number, py: number): boolean {
  return (
    Math.abs(px - BATH_X) <= BATH_INTERACT_RADIUS &&
    Math.abs(py - BATH_Y) <= BATH_INTERACT_RADIUS
  );
}

/** True if the player still has bath buff active on `day`. */
export function bathActive(player: Player, day: number): boolean {
  return getBath(player).expiresOnDay >= day;
}

/** Days until the buff expires on `day`; -1 when no buff. */
export function bathDaysLeft(player: Player, day: number): number {
  const exp = getBath(player).expiresOnDay;
  if (exp < day) return -1;
  return exp - day + 1;
}

/** Outcome of an attempted soak. */
export type BathOutcome =
  | { kind: 'soaked'; remainingGold: number; daysLeft: number; bonus: number }
  | { kind: 'too-far' }
  | { kind: 'not-enough-gold'; need: number; have: number }
  | { kind: 'already-active'; daysLeft: number };

/**
 * Try to take a soak. Spends BATH_FEE gold, refreshes the buff timer to
 * BATH_DURATION_DAYS, lifts the stamina cap by BATH_BONUS, and tops the
 * current pool by the same amount (so the player feels the boost
 * immediately rather than waiting for tomorrow's dawn refill).
 *
 * Refuses with 'already-active' when the buff is already running —
 * keeps the player from accidentally double-spending on the same day.
 */
export function takeBath(
  player: Player,
  px: number,
  py: number,
  day: number,
): BathOutcome {
  if (!nearBath(px, py)) return { kind: 'too-far' };
  if (bathActive(player, day)) {
    return { kind: 'already-active', daysLeft: bathDaysLeft(player, day) };
  }
  if (player.gold < BATH_FEE) {
    return { kind: 'not-enough-gold', need: BATH_FEE, have: player.gold };
  }
  player.gold -= BATH_FEE;
  // Apply the buff. Expiry sits on (today + duration - 1) so the soak
  // covers today AND the next (duration-1) days. Lift the cap, then
  // top the pool by the same amount so the player feels it now.
  const state = getBath(player);
  state.expiresOnDay = day + BATH_DURATION_DAYS - 1;
  const s = getStamina(player);
  s.max = MAX_STAMINA + BATH_BONUS;
  s.current = Math.min(s.max, s.current + BATH_BONUS);
  return {
    kind: 'soaked',
    remainingGold: player.gold,
    daysLeft: BATH_DURATION_DAYS,
    bonus: BATH_BONUS,
  };
}

/**
 * Day-rollover hook: if the buff has lapsed, drop the stamina cap back
 * to the base MAX_STAMINA. Returns true when the expiry fired this
 * call. The current pool stays as-is (caller's dawn refill will top it
 * back up to the new max anyway).
 */
export function maybeExpireBath(player: Player, day: number): boolean {
  const state = getBath(player);
  if (state.expiresOnDay < 0) return false;
  if (state.expiresOnDay >= day) return false;
  // Buff has expired. Reset the stamina cap to base.
  state.expiresOnDay = -1;
  const s: StaminaState = getStamina(player);
  s.max = MAX_STAMINA;
  if (s.current > s.max) s.current = s.max;
  return true;
}

/** Short HUD line for the toast surfaced after a fresh soak. */
export function bathFlavorLine(out: Extract<BathOutcome, { kind: 'soaked' }>): string {
  const plural = out.daysLeft === 1 ? '' : 's';
  return `Soaked at the bath house. +${out.bonus} stamina cap for ${out.daysLeft} day${plural}.`;
}

// ---------------------------------------------------------------------
// Procedural sprite
// ---------------------------------------------------------------------

function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.max(1, w), Math.max(1, h));
}

/**
 * Draw a small bath house sprite centered at (cx, cy). A chunky wooden
 * frame with a low tiled roof and a wisp of steam rising from the
 * chimney. Steam is rendered as a soft three-puff plume so the
 * fixture reads as warm even in the snowiest Winter render pass.
 */
export function drawBathHouseSprite(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  tileSize: number,
): void {
  const w = tileSize;
  const h = tileSize;
  const x = cx - w / 2;
  const y = cy - h / 2;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + 2, y + h - 2, w - 4, 3);
  // Wall (warm cedar).
  px(ctx, x + 2, y + h * 0.35, w - 4, h * 0.65, '#A87858');
  // Wall shadow stripe.
  px(ctx, x + 2, y + h - 4, w - 4, 3, '#6E4A30');
  // Roof — low pyramidal slate.
  const roofH = Math.floor(h * 0.45);
  for (let i = 0; i < 4; i++) {
    const t = i / 3;
    const inset = Math.floor(t * (w / 2 - 3));
    const stripY = y + h * 0.35 - i * Math.ceil(roofH / 4);
    px(
      ctx,
      x + inset,
      stripY,
      w - inset * 2,
      Math.ceil(roofH / 4),
      i === 3 ? '#3A2D44' : '#5C4870',
    );
  }
  // Door — dark slat with a brass handle.
  px(ctx, x + w / 2 - 3, y + h - 11, 6, 9, '#3A2010');
  px(ctx, x + w / 2 - 4, y + h - 11, 8, 1, '#5C3818');
  px(ctx, x + w / 2 + 2, y + h - 6, 1, 2, '#F0C24A');
  // Two warm-glow windows.
  px(ctx, x + 4, y + h * 0.6, 4, 4, '#FFE4A0');
  px(ctx, x + w - 8, y + h * 0.6, 4, 4, '#FFE4A0');
  // Chimney + steam.
  px(ctx, x + w - 7, y + h * 0.1, 3, 6, '#3A2A22');
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(x + w - 5, y + h * 0.05, 2, 0, Math.PI * 2);
  ctx.arc(x + w - 2, y + h * 0.0 - 2, 2.4, 0, Math.PI * 2);
  ctx.arc(x + w - 7, y + h * 0.0 - 3, 1.6, 0, Math.PI * 2);
  ctx.fill();
  // Tiny sign hung on the wall — single character glyph (no emoji).
  ctx.font = 'bold 7px ui-monospace, monospace';
  ctx.fillStyle = '#F5E9D4';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BATH', x + w / 2, y + h * 0.42);
}

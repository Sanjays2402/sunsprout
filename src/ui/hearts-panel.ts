// Hearts panel — `H` toggles a relationships screen for the four
// candidates.
//
// Originally (slice 4 of v0.5.0) this was a bare name + heart-strip list.
// It now reads as a real relationships screen: each row carries the heart
// pips, a soft next-birthday countdown (so the player can plan the 8x
// gift day), a "loves" hint naming a couple of the candidate's adored
// gifts, and a status chip when the player is engaged or married to them.
// Rows sort by closeness (married/engaged first, then hearts, then the
// soonest birthday) so the people you care about most rise to the top.
//
// The heavy lifting is a pure `relationshipRows(player, time)` builder
// that the panel and unit tests share; the draw method is a thin layer.
// `heartsSummary` is kept untouched for back-compat with its callers/test.

import type { Player } from '../world/world';
import type { TimeOfDay } from '../game/time';
import {
  CANDIDATES,
  MAX_HEARTS,
  getHearts,
  type GiftTaste,
  type HeartsState,
} from '../game/hearts';
import { giftReadiness } from '../game/gifting';
import { daysUntilBirthday } from '../game/birthdays';
import { spouseOf } from '../game/marriage';
import { fianceOf } from '../game/engagement';

const PANEL_BG = 'rgba(26, 20, 38, 0.92)';
const PANEL_BORDER = '#4a3b6e';
const TEXT_COLOR = '#F5E9D4';
const ACCENT = '#F5C9A0';
const HEART_FULL = '#E25C7A';
const HEART_EMPTY = '#3a2a4a';
const BDAY_COLOR = '#9FB0D0';
const BDAY_SOON = '#F0C24A';
const LOVE_HINT = 'rgba(245, 233, 212, 0.5)';
const STATUS_WED = '#E47ACF';
const STATUS_RING = '#A3D77A';
const HINT = 'rgba(245, 233, 212, 0.55)';

/** Pure summary helper — used by older callers and the panel test. */
export interface HeartsRow {
  id: string;
  name: string;
  hearts: number;
  max: number;
}

export function heartsSummary(state: HeartsState | undefined): HeartsRow[] {
  const out: HeartsRow[] = [];
  for (const id of Object.keys(CANDIDATES)) {
    const def = CANDIDATES[id];
    out.push({
      id,
      name: def.name,
      hearts: state ? getHearts(state, id) : 0,
      max: MAX_HEARTS,
    });
  }
  return out;
}

/** Relationship status with a specific candidate. */
export type RelationshipStatus = 'single' | 'engaged' | 'married';

/** A full relationships-screen row: hearts + birthday + taste + status. */
export interface RelationshipRow {
  id: string;
  name: string;
  hearts: number;
  max: number;
  /** Days until this candidate's birthday (0 = today). */
  daysUntilBirthday: number;
  /** Glanceable countdown label, e.g. "birthday today" / "birthday in 5d". */
  birthdayLine: string;
  /** Short "loves ..." hint naming up to two adored gifts. */
  lovedHint: string;
  status: RelationshipStatus;
  /**
   * True when the player is carrying a giftable item for this candidate
   * AND hasn't gifted them today — i.e. a `G` press right now would land.
   * Surfaced as a chip so the player can court without trial-and-error.
   */
  giftReady: boolean;
  /** Taste tier of the gift the `G` press would pick, for the chip tint. */
  giftTaste: GiftTaste | null;
}

/** Prettify a gift inventory key into a short human label. */
export function prettyGiftKey(key: string): string {
  let k = key;
  if (k.endsWith('_harvest')) k = k.slice(0, -'_harvest'.length);
  if (k.startsWith('dish-')) k = k.slice('dish-'.length);
  return k.replace(/[-_]+/g, ' ');
}

/** Format a days-until-birthday count into a calm one-line countdown. */
export function birthdayCountdownLabel(days: number): string {
  if (days <= 0) return 'birthday today';
  if (days === 1) return 'birthday tomorrow';
  return `birthday in ${days}d`;
}

/**
 * Build the rich relationship rows. Pure: reads Player.hearts, the
 * birthday calendar, and the engagement / marriage state, then sorts by
 * closeness so the people the player is investing in lead the list:
 *   married first, then engaged, then by hearts (desc), then by the
 *   soonest birthday, then name for a stable final tie-break.
 */
export function relationshipRows(
  player: Player,
  time: TimeOfDay,
): RelationshipRow[] {
  const spouse = spouseOf(player);
  const fiance = fianceOf(player);
  const rows: RelationshipRow[] = Object.keys(CANDIDATES).map((id) => {
    const def = CANDIDATES[id];
    const status: RelationshipStatus =
      spouse === id ? 'married' : fiance === id ? 'engaged' : 'single';
    const days = daysUntilBirthday(id, time);
    const loved = def.loved.slice(0, 2).map(prettyGiftKey).join(', ');
    const ready = giftReadiness(player, id, time.day);
    return {
      id,
      name: def.name,
      hearts: player.hearts ? getHearts(player.hearts, id) : 0,
      max: MAX_HEARTS,
      daysUntilBirthday: days,
      birthdayLine: birthdayCountdownLabel(days),
      lovedHint: loved ? `loves ${loved}` : '',
      status,
      giftReady: ready.ready,
      giftTaste: ready.taste,
    };
  });
  const rank = (s: RelationshipStatus) =>
    s === 'married' ? 0 : s === 'engaged' ? 1 : 2;
  rows.sort((a, b) => {
    if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
    if (a.hearts !== b.hearts) return b.hearts - a.hearts;
    if (a.daysUntilBirthday !== b.daysUntilBirthday) {
      return a.daysUntilBirthday - b.daysUntilBirthday;
    }
    return a.name.localeCompare(b.name);
  });
  return rows;
}

/** Short status chip label, or '' for a single candidate. */
export function statusChipLabel(status: RelationshipStatus): string {
  if (status === 'married') return 'wed';
  if (status === 'engaged') return 'vow';
  return '';
}

/**
 * Tiny chip text for a gift-ready candidate, tinted by how much they'll
 * love the best item in the player's bag. '' when nothing is ready (the
 * panel then draws no chip). Kept under ~10 chars so it tucks beside the
 * birthday line without crowding the loves hint.
 */
export function giftChipLabel(row: RelationshipRow): string {
  if (!row.giftReady) return '';
  if (row.giftTaste === 'loved') return 'loved gift';
  if (row.giftTaste === 'liked') return 'liked gift';
  return 'gift ready';
}

/** Chip rail colour by taste — loved warmest, neutral coolest. */
const GIFT_CHIP_COLOR: Record<GiftTaste, string> = {
  loved: '#E25C7A',
  liked: '#F0C24A',
  neutral: '#A3D77A',
  disliked: '#9D8FB8',
};

/** Chip rail colour for a row's ready gift, or a neutral fallback. */
export function giftChipColor(taste: GiftTaste | null): string {
  return taste ? GIFT_CHIP_COLOR[taste] : GIFT_CHIP_COLOR.neutral;
}

/** Draw a single pixel heart at (x,y), filled or empty. */
function drawHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  filled: boolean,
): void {
  ctx.fillStyle = filled ? HEART_FULL : HEART_EMPTY;
  // 7x6 chubby heart shape.
  const pixels = [
    [1, 0], [2, 0], [4, 0], [5, 0],
    [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
    [1, 3], [2, 3], [3, 3], [4, 3], [5, 3],
    [2, 4], [3, 4], [4, 4],
    [3, 5],
  ];
  for (const [px, py] of pixels) ctx.fillRect(x + px, y + py, 1, 1);
}

export function drawHeartsPanel(
  ctx: CanvasRenderingContext2D,
  player: Player,
  canvasW: number,
  visible: boolean,
  time: TimeOfDay,
): void {
  if (!visible) return;
  const rows = relationshipRows(player, time);
  if (rows.length === 0) return;

  const w = 264;
  const rowH = 34;
  const h = 32 + rows.length * rowH + 6;
  const x = canvasW - w - 12;
  const y = 40;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PANEL_BORDER;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

  ctx.fillStyle = ACCENT;
  ctx.font = 'bold 12px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('relationships  (H)', x + 8, y + 6);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const ry = y + 26 + i * rowH;

    // Line 1: name (+ status chip) on the left, heart strip on the right.
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillStyle = TEXT_COLOR;
    ctx.textAlign = 'left';
    ctx.fillText(row.name, x + 8, ry);

    const chip = statusChipLabel(row.status);
    if (chip) {
      const nameW = ctx.measureText(row.name).width;
      const chipX = x + 8 + nameW + 6;
      ctx.font = 'bold 8px ui-monospace, monospace';
      const chipColor = row.status === 'married' ? STATUS_WED : STATUS_RING;
      const cw = ctx.measureText(chip).width + 6;
      ctx.fillStyle = 'rgba(40, 30, 60, 0.9)';
      ctx.fillRect(chipX, ry - 1, cw, 11);
      ctx.strokeStyle = chipColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(chipX + 0.5, ry - 0.5, cw - 1, 10);
      ctx.fillStyle = chipColor;
      ctx.fillText(chip, chipX + 3, ry + 1);
    }

    // Heart strip right-aligned: 10 small hearts, ~8px apart.
    const stripX = x + w - 8 - row.max * 8;
    for (let hi = 0; hi < row.max; hi++) {
      drawHeart(ctx, stripX + hi * 8, ry + 1, hi < row.hearts);
    }

    // Line 2: birthday countdown (left, warmer when soon) + loves hint.
    const sy = ry + 16;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = row.daysUntilBirthday <= 1 ? BDAY_SOON : BDAY_COLOR;
    ctx.fillText(row.birthdayLine, x + 8, sy);
    const line2X = x + 8 + ctx.measureText(row.birthdayLine).width + 6;
    // Gift-ready chip — right-aligned on line 2 so the player can see who
    // a `G` press would land on, tinted by how loved the best bag item is.
    const giftChip = giftChipLabel(row);
    if (giftChip) {
      ctx.font = 'bold 8px ui-monospace, monospace';
      const gc = giftChipColor(row.giftTaste);
      const gw = ctx.measureText(giftChip).width + 6;
      const gx = x + w - 8 - gw;
      ctx.fillStyle = 'rgba(40, 30, 60, 0.9)';
      ctx.fillRect(gx, sy - 1, gw, 11);
      ctx.fillStyle = gc;
      ctx.fillRect(gx, sy - 1, 2, 11); // left rail accent
      ctx.fillText(giftChip, gx + 4, sy + 1);
    }
    if (row.lovedHint) {
      // Clip the loves hint short of the gift chip so they never overlap.
      const hintMaxX = giftChip ? x + w - 8 - 64 : x + w - 8;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillStyle = LOVE_HINT;
      ctx.textAlign = 'left';
      ctx.fillText(`· ${row.lovedHint}`, line2X, sy, Math.max(0, hintMaxX - line2X));
    }
  }

  ctx.fillStyle = HINT;
  ctx.font = '10px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('H to close', x + w / 2, y + h - 13);
  ctx.restore();
}

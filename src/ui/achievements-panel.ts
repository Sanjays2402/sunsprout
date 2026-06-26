// Achievements panel — `V` toggles a list of earned + locked badges.
//
// Layout: centred modal-ish panel, not too big — sits on top of the
// world but doesn't block movement. Earned rows are highlighted with a
// gold pip + the "done" copy, locked rows show the teaser hint. A small
// progress meter sits in the top right of the panel.

import type { Player } from '../world/world';
import {
  ACHIEVEMENTS,
  buildAchievements,
  type AchievementRow,
} from '../game/achievements';
import { ribbonHallCaption } from '../game/ribbon-hall';

const PANEL_BG = 'rgba(26, 20, 38, 0.96)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const TEXT_COLOR = '#F5E9D4';
const DIM = 'rgba(245, 233, 212, 0.42)';
const HINT = 'rgba(245, 233, 212, 0.55)';
const EARNED_PIP = '#F0C24A';
const LOCKED_PIP = '#7a6a9a';
const RIBBON_CAPTION = '#E8B23A';

const PANEL_W = 440;
const ROW_H = 30;

export class AchievementsPanel {
  private opened = false;
  private lockoutMs = 0;
  private scroll = 0;

  open(): void {
    this.opened = true;
    this.lockoutMs = 160;
    this.scroll = 0;
  }

  close(): void {
    this.opened = false;
  }

  toggle(): void {
    if (this.opened) this.close();
    else this.open();
  }

  isVisible(): boolean {
    return this.opened;
  }

  canAct(): boolean {
    return this.opened && this.lockoutMs <= 0;
  }

  update(dtMs: number): void {
    if (!this.opened) return;
    if (this.lockoutMs > 0) this.lockoutMs = Math.max(0, this.lockoutMs - dtMs);
  }

  scrollDown(): void {
    if (!this.opened) return;
    this.scroll = Math.min(Math.max(0, ACHIEVEMENTS.length - 8), this.scroll + 1);
  }

  scrollUp(): void {
    if (!this.opened) return;
    this.scroll = Math.max(0, this.scroll - 1);
  }

  /** Render the panel. No-op when closed. */
  draw(ctx: CanvasRenderingContext2D, player: Player, canvasW: number, canvasH: number): void {
    if (!this.opened) return;
    const rows = buildAchievements(player);
    const visibleN = Math.min(8, rows.length);
    const caption = ribbonHallCaption(player);
    const captionH = caption ? 18 : 0;
    const h = 50 + visibleN * ROW_H + 22 + captionH;
    const x = Math.floor((canvasW - PANEL_W) / 2);
    const y = Math.floor((canvasH - h) / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // Soft dim behind so the badges read well.
    ctx.fillStyle = 'rgba(10, 6, 18, 0.32)';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(x, y, PANEL_W, h);
    ctx.strokeStyle = PANEL_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, PANEL_W - 1, h - 1);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = 'bold 14px ui-monospace, monospace';
    ctx.fillText('achievements  (V)', x + 14, y + 12);

    const earned = rows.filter((r) => r.earned).length;
    ctx.fillStyle = DIM;
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${earned}/${rows.length}`, x + PANEL_W - 14, y + 14);

    const start = this.scroll;
    const end = Math.min(rows.length, start + visibleN);
    for (let i = start; i < end; i++) {
      const r: AchievementRow = rows[i];
      const ry = y + 40 + (i - start) * ROW_H;
      // Pip
      ctx.fillStyle = r.earned ? EARNED_PIP : LOCKED_PIP;
      ctx.fillRect(x + 14, ry + 8, 6, 6);

      ctx.fillStyle = r.earned ? TEXT_COLOR : DIM;
      ctx.textAlign = 'left';
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.fillText(r.name, x + 28, ry + 2);

      ctx.fillStyle = HINT;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(r.description, x + 28, ry + 16);

      if (r.earned && r.earnedDay !== null) {
        ctx.fillStyle = EARNED_PIP;
        ctx.textAlign = 'right';
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(`day ${r.earnedDay}`, x + PANEL_W - 14, ry + 6);
      }
    }

    // Scroll indicator if list is taller than visible region.
    if (rows.length > visibleN) {
      ctx.fillStyle = HINT;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      const top = start === 0 ? '' : 'up ';
      const bot = end >= rows.length ? '' : 'down';
      ctx.fillText(`${top}${bot}`.trim(), x + PANEL_W / 2, y + h - 30);
    }

    // Ribbon-hall caption — names the tournament rosettes mounted on the
    // farmhouse wall in plain words, so the tiny pixel medals are legible
    // to a player who can't make them out. Sits on its own line above the
    // scroll indicator + close hint. Only when at least one is shown.
    if (caption) {
      ctx.fillStyle = RIBBON_CAPTION;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(caption, x + PANEL_W / 2, y + h - 46);
    }

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('V / Esc to close - arrows or w/s to scroll', x + PANEL_W / 2, y + h - 14);
    ctx.restore();
  }
}

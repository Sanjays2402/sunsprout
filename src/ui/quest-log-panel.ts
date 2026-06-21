// Quest log panel — `'` toggles a panel listing active + completed quests
// with progress bars, hints, and reward lines. Matches the design language
// of AchievementsPanel and MoneyLogPanel so the cozy panel family stays
// consistent.

import type { Player } from '../world/world';
import { buildQuestLog, questCounts, type QuestLogEntry } from '../game/quest-log';

const PANEL_BG = 'rgba(26, 20, 38, 0.96)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const TEXT_COLOR = '#F5E9D4';
const DIM = 'rgba(245, 233, 212, 0.42)';
const HINT = 'rgba(245, 233, 212, 0.55)';
const ACCENT = '#F0C24A';
const DONE_PIP = '#A3D77A';
const ACTIVE_PIP = '#F0C24A';
const SECTION_LINE = 'rgba(74, 59, 110, 0.6)';

const PANEL_W = 460;
const ROW_H = 46;

export class QuestLogPanel {
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

  scrollDown(player: Player): void {
    if (!this.opened) return;
    const max = Math.max(0, buildQuestLog(player).length - 6);
    this.scroll = Math.min(max, this.scroll + 1);
  }

  scrollUp(): void {
    if (!this.opened) return;
    this.scroll = Math.max(0, this.scroll - 1);
  }

  /** Render the panel. No-op when closed. */
  draw(ctx: CanvasRenderingContext2D, player: Player, canvasW: number, canvasH: number): void {
    if (!this.opened) return;
    const rows = buildQuestLog(player);
    const counts = questCounts(player);
    const visibleN = Math.min(6, Math.max(1, rows.length));
    const h = 70 + visibleN * ROW_H + 22;
    const x = Math.floor((canvasW - PANEL_W) / 2);
    const y = Math.floor((canvasH - h) / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
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
    ctx.fillText("quest log  ( ' )", x + 14, y + 12);

    ctx.fillStyle = DIM;
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${counts.completed}/${counts.total} done`, x + PANEL_W - 14, y + 14);

    // Section divider — keep header tidy.
    ctx.fillStyle = SECTION_LINE;
    ctx.fillRect(x + 14, y + 38, PANEL_W - 28, 1);

    if (rows.length === 0) {
      ctx.fillStyle = DIM;
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No quests on the board.', x + PANEL_W / 2, y + 60);
    } else {
      const start = this.scroll;
      const end = Math.min(rows.length, start + visibleN);
      for (let i = start; i < end; i++) {
        const r: QuestLogEntry = rows[i];
        const ry = y + 50 + (i - start) * ROW_H;
        // Pip color: gold for active, green for done.
        ctx.fillStyle = r.status === 'completed' ? DONE_PIP : ACTIVE_PIP;
        ctx.fillRect(x + 14, ry + 12, 6, 6);
        // Title row
        ctx.fillStyle = r.status === 'completed' ? DIM : TEXT_COLOR;
        ctx.font = 'bold 12px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(r.name, x + 28, ry + 4);
        // Hint / description line
        ctx.fillStyle = HINT;
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(r.hint, x + 28, ry + 18);
        // Reward line — right side
        ctx.fillStyle = r.status === 'completed' ? DONE_PIP : ACCENT;
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(r.rewardLine, x + PANEL_W - 14, ry + 6);
        // Progress bar
        const barW = PANEL_W - 56;
        const barX = x + 28;
        const barY = ry + 30;
        ctx.fillStyle = 'rgba(40, 30, 60, 0.85)';
        ctx.fillRect(barX, barY, barW, 6);
        const filledW = Math.max(0, Math.min(barW, (r.progress / r.goal) * barW));
        ctx.fillStyle = r.status === 'completed' ? DONE_PIP : ACTIVE_PIP;
        ctx.fillRect(barX, barY, filledW, 6);
        ctx.fillStyle = DIM;
        ctx.font = '9px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${r.progress}/${r.goal}`, x + PANEL_W - 14, barY - 1);
      }
    }

    if (rows.length > visibleN) {
      ctx.fillStyle = HINT;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      const top = this.scroll === 0 ? '' : 'up ';
      const bot = this.scroll + visibleN >= rows.length ? '' : 'down';
      ctx.fillText(`${top}${bot}`.trim(), x + PANEL_W / 2, y + h - 30);
    }

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText("' or Esc to close - arrows or w/s to scroll", x + PANEL_W / 2, y + h - 14);
    ctx.restore();
  }
}

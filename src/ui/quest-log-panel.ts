// Quest log panel — `'` toggles a panel listing active + completed quests
// with progress bars, hints, and reward lines. Matches the design language
// of AchievementsPanel and MoneyLogPanel so the cozy panel family stays
// consistent.
//
// Rows are grouped under ACTIVE / DONE section dividers (active first) so
// the log reads as "what I'm working on / what I've finished" instead of
// one flat scroll keyed only by a pip colour. Headers + rows flatten into
// one display-item list scrolled over a fixed pixel budget, so the panel
// height never jumps as a divider scrolls in or out.

import type { Player } from '../world/world';
import {
  buildQuestLog,
  questCounts,
  questLogSections,
  type QuestLogEntry,
} from '../game/quest-log';
import { PANEL_EMPTY_STATES } from '../game/panel-empty';
import { drawEmptyState } from './empty-state';

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
const SECTION_RULE = 'rgba(74, 59, 110, 0.5)';

const PANEL_W = 460;
const ROW_H = 46;
/** Section-divider band height (label + breathing room). */
const SECTION_H = 18;
/** Fixed body budget — holds ~6 quest rows plus both dividers. */
const BODY_H = 6 * ROW_H + 2 * SECTION_H;

/** One drawable line in the scrolled body: a divider or a quest row. */
type DisplayItem =
  | { kind: 'header'; header: string; count: number }
  | { kind: 'row'; row: QuestLogEntry };

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
    const items = this.displayItems(player);
    this.scroll = Math.min(this.maxScroll(items), this.scroll + 1);
  }

  scrollUp(): void {
    if (!this.opened) return;
    this.scroll = Math.max(0, this.scroll - 1);
  }

  /** Flatten the active/done sections into one scrollable line list. */
  private displayItems(player: Player): DisplayItem[] {
    const sections = questLogSections(buildQuestLog(player));
    const items: DisplayItem[] = [];
    for (const s of sections) {
      items.push({ kind: 'header', header: s.header, count: s.rows.length });
      for (const row of s.rows) items.push({ kind: 'row', row });
    }
    return items;
  }

  /** Pixel height of a single display item. */
  private itemHeight(item: DisplayItem): number {
    return item.kind === 'header' ? SECTION_H : ROW_H;
  }

  /** How many items fit in the body budget starting at `start`. */
  private visibleCountFrom(items: DisplayItem[], start: number): number {
    let used = 0;
    let n = 0;
    for (let i = start; i < items.length; i++) {
      const ih = this.itemHeight(items[i]);
      if (used + ih > BODY_H) break;
      used += ih;
      n++;
    }
    return n;
  }

  /** Smallest scroll index that still reaches the last item. */
  private maxScroll(items: DisplayItem[]): number {
    for (let start = 0; start < items.length; start++) {
      if (start + this.visibleCountFrom(items, start) >= items.length) return start;
    }
    return Math.max(0, items.length - 1);
  }

  /** Render the panel. No-op when closed. */
  draw(ctx: CanvasRenderingContext2D, player: Player, canvasW: number, canvasH: number): void {
    if (!this.opened) return;
    const rows = buildQuestLog(player);
    const counts = questCounts(player);
    const items = this.displayItems(player);
    this.scroll = Math.min(this.scroll, this.maxScroll(items));
    const start = this.scroll;
    const visN = this.visibleCountFrom(items, start);
    const end = start + visN;

    // Empty board reserves two body rows for the message + hint; otherwise
    // the fixed body budget keeps the panel height constant.
    const bodyH = rows.length === 0 ? 2 * ROW_H : BODY_H;
    const h = 70 + bodyH + 22;
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

    // Section divider under the header — keeps the title tidy.
    ctx.fillStyle = SECTION_LINE;
    ctx.fillRect(x + 14, y + 38, PANEL_W - 28, 1);

    if (rows.length === 0) {
      drawEmptyState(ctx, PANEL_EMPTY_STATES.questLog, x + PANEL_W / 2, y + 58);
    } else {
      // Walk the visible display items, drawing ACTIVE / DONE dividers +
      // quest rows in one pass so the groups stay legible while scrolling.
      let ry = y + 50;
      for (let i = start; i < end; i++) {
        const item = items[i];
        if (item.kind === 'header') {
          this.drawSectionHeader(ctx, item.header, item.count, x, ry);
        } else {
          this.drawRow(ctx, item.row, x, ry);
        }
        ry += this.itemHeight(item);
      }
    }

    if (start > 0 || end < items.length) {
      ctx.fillStyle = HINT;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      const top = start === 0 ? '' : 'up ';
      const bot = end >= items.length ? '' : 'down';
      ctx.fillText(`${top}${bot}`.trim(), x + PANEL_W / 2, y + h - 30);
    }

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText("' or Esc to close - arrows or w/s to scroll", x + PANEL_W / 2, y + h - 14);
    ctx.restore();
  }

  /** Small section divider, e.g. "ACTIVE  2" + a trailing rule. */
  private drawSectionHeader(
    ctx: CanvasRenderingContext2D,
    header: string,
    count: number,
    x: number,
    ry: number,
  ): void {
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = DIM;
    ctx.font = 'bold 9px ui-monospace, monospace';
    const label = `${header}  ${count}`;
    ctx.fillText(label, x + 14, ry + 5);
    const labelW = ctx.measureText(label).width;
    ctx.fillStyle = SECTION_RULE;
    ctx.fillRect(x + 14 + labelW + 8, ry + 9, PANEL_W - 28 - labelW - 8, 1);
  }

  /** Draw one quest row at top `ry` (height ROW_H). */
  private drawRow(
    ctx: CanvasRenderingContext2D,
    r: QuestLogEntry,
    x: number,
    ry: number,
  ): void {
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

// Sleep summary overlay — modal shown the morning after sleep().
//
// Renders a small, centered panel listing yesterday's deltas: gold,
// harvest, dishes, heart gains, plus a flavour line. The player
// dismisses with any of the usual keys (Space / Enter / Escape) —
// the Game's input loop is responsible for calling close().
//
// Visual language matches the existing dialogue/cooking panels:
// PANEL_BG + PANEL_BORDER + ACCENT title + monospace body, no emoji
// in the panel chrome.

import type { DaySummary } from '../game/sleep';

const PANEL_BG = 'rgba(26, 20, 38, 0.94)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const TEXT_COLOR = '#F5E9D4';
const SUBTLE = '#9D8FB8';
const PLUS_COLOR = '#7CC55C';
const HEART_COLOR = '#E47ACF';

export class SleepSummary {
  private summary: DaySummary | null = null;
  private fadeInMs = 0;

  /** Open the panel with a fresh summary. */
  open(s: DaySummary): void {
    this.summary = s;
    this.fadeInMs = 400; // 400ms ease-in fade
  }

  /** True while the modal is on screen. */
  isVisible(): boolean {
    return this.summary !== null;
  }

  /** Dismiss the modal. */
  close(): void {
    this.summary = null;
    this.fadeInMs = 0;
  }

  /** Per-frame countdown for the fade-in. */
  update(dtMs: number): void {
    if (this.fadeInMs > 0) this.fadeInMs = Math.max(0, this.fadeInMs - dtMs);
  }

  /** Public for the input loop — dismiss after a brief lockout to avoid skip-on-open. */
  canDismiss(): boolean {
    return this.summary !== null && this.fadeInMs <= 0;
  }

  /** Render the panel. No-op when no summary is open. */
  draw(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number): void {
    const s = this.summary;
    if (!s) return;
    // Compute alpha for the fade-in.
    const alpha = 1 - this.fadeInMs / 400;

    ctx.save();
    ctx.globalAlpha = alpha;
    // Dim backdrop.
    ctx.fillStyle = 'rgba(15, 10, 25, 0.55)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const w = 320;
    const lines: string[] = [];
    lines.push(`Gold ${formatDelta(s.goldDelta)}g`);
    lines.push(`Harvest ${formatDelta(s.harvestDelta)}`);
    if (s.dishesDelta !== 0) lines.push(`Dishes ${formatDelta(s.dishesDelta)}`);
    for (const hg of s.heartGains) {
      lines.push(`${hg.name} +${hg.delta} hearts`);
    }
    if (lines.length === 0) lines.push('A quiet day passed.');

    const titleH = 28;
    const lineH = 18;
    const flavorH = 22;
    const pad = 14;
    const h = pad + titleH + lines.length * lineH + flavorH + pad;
    const x = Math.floor((canvasW - w) / 2);
    const y = Math.floor((canvasH - h) / 2);

    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PANEL_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    // Title.
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = 'bold 14px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`Morning of Day ${s.newDay}`, x + w / 2, y + pad);

    // Lines.
    ctx.textAlign = 'left';
    ctx.font = '12px ui-monospace, monospace';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Colour-code the line by its leading word.
      if (line.startsWith('Gold')) ctx.fillStyle = PLUS_COLOR;
      else if (line.includes('hearts')) ctx.fillStyle = HEART_COLOR;
      else ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(line, x + pad + 4, y + pad + titleH + i * lineH);
    }

    // Flavor.
    ctx.fillStyle = SUBTLE;
    ctx.font = 'italic 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(s.flavor, x + w / 2, y + pad + titleH + lines.length * lineH + 2);

    // Footer dismiss hint.
    ctx.fillStyle = SUBTLE;
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillText(this.canDismiss() ? 'press SPACE to wake' : '...', x + w / 2, y + h - 14);

    ctx.restore();
  }
}

function formatDelta(n: number): string {
  if (n >= 0) return `+${n}`;
  return `${n}`;
}

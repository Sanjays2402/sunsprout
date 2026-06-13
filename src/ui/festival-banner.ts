// Festival Banner — a full-screen announcement overlay that appears at the
// start of a festival day and fades out after a few seconds.
//
// Call `open(festival)` when the day rolls over to a festival day, then
// `update(dtMs)` every tick and `draw(ctx, w, h)` after the world render.

import type { Festival } from '../game/festival';

const HOLD_MS = 2800; // fully visible duration
const FADE_IN_MS = 500;
const FADE_OUT_MS = 700;
const TOTAL_MS = FADE_IN_MS + HOLD_MS + FADE_OUT_MS;

export class FestivalBanner {
  private festival: Festival | null = null;
  private elapsed = 0;

  open(festival: Festival): void {
    this.festival = festival;
    this.elapsed = 0;
  }

  isVisible(): boolean {
    return this.festival !== null && this.elapsed < TOTAL_MS;
  }

  update(dtMs: number): void {
    if (!this.isVisible()) return;
    this.elapsed += dtMs;
    if (this.elapsed >= TOTAL_MS) {
      this.festival = null;
    }
  }

  draw(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number): void {
    if (!this.festival) return;
    const f = this.festival;
    const t = this.elapsed;

    // Compute alpha envelope: fade-in → hold → fade-out.
    let alpha: number;
    if (t < FADE_IN_MS) {
      alpha = t / FADE_IN_MS;
    } else if (t < FADE_IN_MS + HOLD_MS) {
      alpha = 1;
    } else {
      alpha = 1 - (t - FADE_IN_MS - HOLD_MS) / FADE_OUT_MS;
    }
    alpha = Math.max(0, Math.min(1, alpha));

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Dim the world behind the banner.
    ctx.globalAlpha = alpha * 0.72;
    ctx.fillStyle = 'rgba(10, 6, 22, 1)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Centred card.
    const cardW = 480;
    const cardH = 140;
    const cx = Math.floor((canvasW - cardW) / 2);
    const cy = Math.floor((canvasH - cardH) / 2);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(26, 20, 38, 0.96)';
    ctx.fillRect(cx, cy, cardW, cardH);
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx + 1, cy + 1, cardW - 2, cardH - 2);

    // Decorative corners in festival colour.
    ctx.fillStyle = f.color;
    ctx.fillRect(cx + 4, cy + 4, 5, 5);
    ctx.fillRect(cx + cardW - 9, cy + 4, 5, 5);
    ctx.fillRect(cx + 4, cy + cardH - 9, 5, 5);
    ctx.fillRect(cx + cardW - 9, cy + cardH - 9, 5, 5);

    // Festival name.
    ctx.fillStyle = f.color;
    ctx.font = 'bold 22px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(f.name, cx + cardW / 2, cy + 20);

    // Divider.
    ctx.globalAlpha = alpha * 0.4;
    ctx.fillStyle = f.color;
    ctx.fillRect(cx + 20, cy + 56, cardW - 40, 1);
    ctx.globalAlpha = alpha;

    // Subtitle.
    ctx.fillStyle = '#F5E9D4';
    ctx.font = '14px ui-monospace, monospace';
    ctx.fillText(f.subtitle, cx + cardW / 2, cy + 68);

    // Small "Festival Day!" label at the bottom.
    ctx.fillStyle = 'rgba(245, 233, 212, 0.5)';
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText('🎉  Festival Day!  🎉', cx + cardW / 2, cy + cardH - 22);

    ctx.restore();
  }
}

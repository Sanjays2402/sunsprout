// Minimap panel — `9` toggles a compact bird's-eye view of the whole
// village so the player can orient without walking the camera around.
// Renders the tile-colour grid from minimap.ts, overlays labelled
// landmark pips (home / shop / inn / well / cave) and a pulsing player
// dot, with a small legend. Same dark-violet panel chrome as the other
// overlays.

import type { World } from '../world/world';
import type { Player } from '../world/world';
import type { TimeOfDay } from '../game/time';
import {
  minimapMarkers,
  minimapTileColors,
  minimapPings,
  projectTile,
  type MinimapMarker,
  type MinimapPing,
} from '../game/minimap';

const PANEL_BG = 'rgba(26, 20, 38, 0.97)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const HINT = 'rgba(245, 233, 212, 0.55)';
const LABEL = 'rgba(245, 233, 212, 0.82)';
const MAP_BORDER = '#2A2038';
const PLAYER_DOT = '#F5E9D4';
const PLAYER_RING = '#F5C9A0';

const MAP_W = 320;
const MAP_H = 240;
const PAD = 16;
const LEGEND_H = 56;

export class MinimapPanel {
  private opened = false;
  private lockoutMs = 0;
  private pulseMs = 0;

  open(): void {
    this.opened = true;
    this.lockoutMs = 160;
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
    this.pulseMs = (this.pulseMs + dtMs) % 1200;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    world: World,
    player: Player,
    time: TimeOfDay,
    canvasW: number,
    canvasH: number,
  ): void {
    if (!this.opened) return;
    const panelW = MAP_W + PAD * 2;
    const panelH = 40 + MAP_H + LEGEND_H + PAD;
    const x = Math.floor((canvasW - panelW) / 2);
    const y = Math.floor((canvasH - panelH) / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(10, 6, 18, 0.42)';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(x, y, panelW, panelH);
    ctx.strokeStyle = PANEL_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, panelW - 1, panelH - 1);

    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = 'bold 14px ui-monospace, monospace';
    ctx.fillText('village map  (9)', x + PAD, y + 12);

    const mapX = x + PAD;
    const mapY = y + 36;
    this.drawMap(ctx, world, player, time, mapX, mapY);

    // Legend below the map.
    this.drawLegend(ctx, world, mapX, mapY + MAP_H + 8);

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('9 or Esc to close', x + panelW / 2, y + panelH - 14);
    ctx.restore();
  }

  private drawMap(
    ctx: CanvasRenderingContext2D,
    world: World,
    player: Player,
    time: TimeOfDay,
    mapX: number,
    mapY: number,
  ): void {
    const colors = minimapTileColors(world);
    const { cellW, cellH } = projectTile(0, 0, world.width, world.height, MAP_W, MAP_H);
    // Tile grid. Cells are < 1px-rounded so we ceil the size to avoid seams.
    const cw = Math.ceil(cellW);
    const ch = Math.ceil(cellH);
    for (let ty = 0; ty < world.height; ty++) {
      for (let tx = 0; tx < world.width; tx++) {
        ctx.fillStyle = colors[ty * world.width + tx];
        ctx.fillRect(
          Math.floor(mapX + tx * cellW),
          Math.floor(mapY + ty * cellH),
          cw,
          ch,
        );
      }
    }
    // Map frame.
    ctx.strokeStyle = MAP_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX - 0.5, mapY - 0.5, MAP_W + 1, MAP_H + 1);

    // Landmark pips.
    const markers = minimapMarkers(world);
    for (const m of markers) {
      this.drawMarker(ctx, m, mapX, mapY, world, cellW, cellH);
    }

    // Action pings — pulsing rings on tiles that need the player right
    // now (quest turn-in, open cart, live tournament). Drawn over the
    // landmark pips but under the player dot.
    const pings = minimapPings(player, time);
    for (const p of pings) {
      this.drawPing(ctx, p, mapX, mapY, cellW, cellH);
    }

    // Player dot — pulsing ring so the eye finds "you are here" fast.
    const p = world.player;
    const dx = mapX + p.x * cellW;
    const dy = mapY + p.y * cellH;
    const pulse = 0.5 + 0.5 * Math.sin((this.pulseMs / 1200) * Math.PI * 2);
    ctx.fillStyle = PLAYER_RING;
    ctx.globalAlpha = 0.35 + 0.4 * pulse;
    ctx.beginPath();
    ctx.arc(dx, dy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = PLAYER_DOT;
    ctx.beginPath();
    ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawMarker(
    ctx: CanvasRenderingContext2D,
    m: MinimapMarker,
    mapX: number,
    mapY: number,
    world: World,
    cellW: number,
    cellH: number,
  ): void {
    void world;
    const cx = mapX + m.tx * cellW + cellW / 2;
    const cy = mapY + m.ty * cellH + cellH / 2;
    // Pip.
    ctx.fillStyle = m.color;
    ctx.fillRect(Math.floor(cx - 4), Math.floor(cy - 4), 8, 8);
    ctx.strokeStyle = '#1A1426';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.floor(cx - 4) + 0.5, Math.floor(cy - 4) + 0.5, 7, 7);
    // Glyph.
    ctx.fillStyle = '#1A1426';
    ctx.font = 'bold 8px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.glyph, Math.floor(cx), Math.floor(cy) + 1);
    ctx.textBaseline = 'top';
  }

  private drawPing(
    ctx: CanvasRenderingContext2D,
    p: MinimapPing,
    mapX: number,
    mapY: number,
    cellW: number,
    cellH: number,
  ): void {
    const cx = mapX + p.tx * cellW + cellW / 2;
    const cy = mapY + p.ty * cellH + cellH / 2;
    // Expanding ring: radius + alpha breathe on the shared pulse clock so
    // the eye is drawn to the spot without a hard flash.
    const phase = (this.pulseMs / 1200) % 1;
    const radius = 4 + phase * 7;
    ctx.save();
    ctx.globalAlpha = 0.75 * (1 - phase);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    // Solid inner dot keeps the marker readable at the trough of the pulse.
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawLegend(ctx: CanvasRenderingContext2D, world: World, lx: number, ly: number): void {
    const markers = minimapMarkers(world);
    ctx.font = '10px ui-monospace, monospace';
    ctx.textBaseline = 'middle';
    // Lay out in two rows of pips with their labels.
    const perRow = Math.ceil(markers.length / 2);
    const colW = MAP_W / perRow;
    for (let i = 0; i < markers.length; i++) {
      const m = markers[i];
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const px = lx + col * colW;
      const py = ly + row * 20 + 8;
      // Pip swatch.
      ctx.fillStyle = m.color;
      ctx.fillRect(px, py - 4, 8, 8);
      ctx.strokeStyle = '#1A1426';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py - 3.5, 7, 7);
      ctx.fillStyle = '#1A1426';
      ctx.font = 'bold 8px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(m.glyph, px + 4, py + 1);
      // Label.
      ctx.fillStyle = LABEL;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(m.label, px + 12, py);
    }
    ctx.textBaseline = 'top';
  }
}

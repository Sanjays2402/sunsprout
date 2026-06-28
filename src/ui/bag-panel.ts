// Inventory / bag panel — `Tab` toggles a single categorized view of
// everything the player owns.
//
// Until now the game had panels for the meta layer (recipes, crops,
// money, lore) but no plain "what's in my bag" screen — produce, fish,
// gems, forage, dishes, eggs, kits and tickets all lived only as opaque
// inventory keys the player never saw listed. This panel walks the pure
// bag model (game/bag.ts), groups stacks into tabs (Seeds / Crops / Fish
// / Gems / Forage / Kitchen / Supplies) drawn through the shared tab
// strip, and renders a scrollable list of label + count (+ unit value)
// rows. Same dark-violet chrome + a/d-tab + w/s-scroll language as the
// lore panel.

import type { Player } from '../world/world';
import {
  BAG_CATEGORIES,
  bagItemsForCategory,
  bagCategoryCounts,
  bagTotalStacks,
  bagTotalValue,
  bagCategoryValue,
  bagItemWorth,
  bagWorthShares,
  bagSellHint,
  bagSortLabel,
  cycleBagSort,
  bagSearchResults,
  bagSearchMatchCount,
  bagSearchCategoryCounts,
  type BagCategory,
  type BagSortMode,
  type BagItem,
} from '../game/bag';
import { tabStripLayout, cycleTabIndex, type TabStripItem } from '../game/panel-tabs';
import { drawTabStrip } from './panel-tab-strip';
import { bagGlyph } from '../game/bag-glyph';
import { drawBagGlyph } from '../render/bag-glyph-sprite';
import { bagEmptyState } from '../game/panel-empty';
import { drawEmptyState } from './empty-state';

const PANEL_BG = 'rgba(26, 20, 38, 0.96)';
const PANEL_BORDER = '#4a3b6e';
const TITLE_COLOR = '#F5C9A0';
const TEXT_COLOR = '#F5E9D4';
const HINT = 'rgba(245, 233, 212, 0.55)';
const GOLD = '#F0C24A';
const SORT_CHIP = 'rgba(200, 182, 232, 0.7)';
const SELL_HINT = 'rgba(159, 205, 122, 0.66)';
const SEARCH_COLOR = '#A3D77A';

/**
 * Per-category tint for the worth share bar — distinct, readable hues in
 * the cozy palette so each slice is identifiable against the legend chip.
 * Seeds / Supplies never carry worth so they're muted neutrals (they
 * won't appear in the bar, but the map is total for type-safety).
 */
const CATEGORY_COLOR: Record<BagCategory, string> = {
  Seeds: '#7a6a9a',
  Crops: '#A3D77A',
  Fish: '#6FB8D8',
  Gems: '#E07AB0',
  Forage: '#D8A24A',
  Kitchen: '#F0C24A',
  Supplies: '#9D8FB8',
};

const PANEL_W = 460;
const ROW_H = 26;
const VISIBLE_ROWS = 7;

export class BagPanel {
  private opened = false;
  private lockoutMs = 0;
  private tabIndex = 0;
  private scroll = 0;
  private sortMode: BagSortMode = 'count';
  /**
   * Cross-tab type-to-filter. `searchActive` arms the input-capturing mode
   * (claimed with `/` so the bag's `f`=sort + a/d/w/s nav stay free); while
   * armed, typed letters/digits build `search` and the list shows matches
   * across ALL tabs. Empty `search` while armed shows a prompt.
   */
  private searchActive = false;
  private search = '';

  open(): void {
    this.opened = true;
    this.lockoutMs = 160;
    this.scroll = 0;
    this.searchActive = false;
    this.search = '';
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

  /** Currently selected category — exposed for tests. */
  currentCategory(): BagCategory {
    return BAG_CATEGORIES[this.tabIndex];
  }

  /** Active within-category sort mode — exposed for tests. */
  currentSort(): BagSortMode {
    return this.sortMode;
  }

  /** Whether the type-to-filter search mode is armed. Exposed for tests. */
  isSearching(): boolean {
    return this.searchActive;
  }

  /** Current search query (lowercased). Exposed for tests. */
  currentSearch(): string {
    return this.search;
  }

  /**
   * Toggle the search mode on/off (the `/` key). Turning it off clears the
   * query + resets scroll so the player drops back to the tabbed view.
   */
  toggleSearch(): void {
    if (!this.opened) return;
    this.searchActive = !this.searchActive;
    this.search = '';
    this.scroll = 0;
  }

  /**
   * Append a typed letter/digit to the search while armed. Only single
   * printable alphanumerics are accepted (mirrors the help-overlay), so
   * modifier names like 'enter' / 'shift' never pollute the query. Resets
   * scroll so new matches start from the top. Returns true when the query
   * changed.
   */
  typeChar(key: string): boolean {
    if (!this.opened || !this.searchActive) return false;
    if (key.length !== 1) return false;
    if (!/[a-z0-9 ]/.test(key)) return false;
    this.search += key;
    this.scroll = 0;
    return true;
  }

  /** Delete the last search character (Backspace). Returns true if changed. */
  backspaceSearch(): boolean {
    if (!this.opened || !this.searchActive || this.search.length === 0) return false;
    this.search = this.search.slice(0, -1);
    this.scroll = 0;
    return true;
  }

  /**
   * Esc handling inside the bag: first clears a non-empty query, then exits
   * search mode, then (handled by the caller) closes the panel. Returns
   * true when it consumed the Esc so the caller doesn't also close.
   */
  clearSearch(): boolean {
    if (!this.opened || !this.searchActive) return false;
    if (this.search.length > 0) {
      this.search = '';
      this.scroll = 0;
      return true;
    }
    this.searchActive = false;
    this.scroll = 0;
    return true;
  }

  /** Cycle the within-category sort (count -> value -> A-Z). Resets scroll. */
  cycleSort(): void {
    if (!this.opened) return;
    this.sortMode = cycleBagSort(this.sortMode);
    this.scroll = 0;
  }

  nextTab(): void {
    if (!this.opened) return;
    this.tabIndex = cycleTabIndex(this.tabIndex, BAG_CATEGORIES.length, 1);
    this.scroll = 0;
  }

  prevTab(): void {
    if (!this.opened) return;
    this.tabIndex = cycleTabIndex(this.tabIndex, BAG_CATEGORIES.length, -1);
    this.scroll = 0;
  }

  /** The rows the body currently shows: search matches, or the active tab. */
  private visibleRows(player: Player): BagItem[] {
    if (this.searchActive) return bagSearchResults(player, this.search, this.sortMode);
    return bagItemsForCategory(player, this.currentCategory(), this.sortMode);
  }

  scrollDown(player: Player): void {
    if (!this.opened) return;
    const total = this.visibleRows(player).length;
    this.scroll = Math.min(Math.max(0, total - VISIBLE_ROWS), this.scroll + 1);
  }

  scrollUp(): void {
    if (!this.opened) return;
    this.scroll = Math.max(0, this.scroll - 1);
  }

  draw(ctx: CanvasRenderingContext2D, player: Player, canvasW: number, canvasH: number): void {
    if (!this.opened) return;
    const searching = this.searchActive;
    // Body rows: cross-tab search matches while armed, else the active tab.
    const rows = this.visibleRows(player);
    const visibleN = Math.min(VISIBLE_ROWS, Math.max(rows.length, 1));
    // Reserve a footer band for the scroll indicator, the where-to-sell
    // hint, and the controls line (three stacked 14-16px rows).
    const h = 88 + visibleN * ROW_H + 36;
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

    // Title + a glanceable total-stacks / total-worth readout.
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillStyle = TITLE_COLOR;
    ctx.font = 'bold 14px ui-monospace, monospace';
    ctx.fillText('bag  (Tab)', x + 14, y + 12);

    // Chip right of the title: while searching it's a live "search: q_  (N)"
    // chip (cross-tab match count) so the query + hits are legible; else the
    // dim sort-mode chip (by count / by value / A-Z) the `f` cycle drives.
    ctx.font = 'bold 14px ui-monospace, monospace';
    const titleW = ctx.measureText('bag  (Tab)').width;
    if (searching) {
      const matches = bagSearchMatchCount(player, this.search);
      ctx.fillStyle = SEARCH_COLOR;
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.fillText(`search: ${this.search}_  (${matches})`, x + 14 + titleW + 8, y + 15);
    } else {
      ctx.fillStyle = SORT_CHIP;
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText(`- ${bagSortLabel(this.sortMode)}`, x + 14 + titleW + 8, y + 16);
    }

    const stacks = bagTotalStacks(player);
    const worth = bagTotalValue(player);
    ctx.fillStyle = HINT;
    ctx.font = '11px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${stacks} stacks  -  ~${worth}g`, x + PANEL_W - 14, y + 14);

    // Worth share bar — a tiny stacked bar in the gap under the title
    // showing each category's SHARE of the whole-bag worth, so "where's
    // my money" reads visually (like the crop-journal harvest mini-bar).
    // The active tab's slice is outlined so the player can locate the
    // current category in the mix. Drawn only when the bag has worth.
    const BAR_FULL_W = PANEL_W - 28;
    const shares = bagWorthShares(player, BAR_FULL_W);
    if (shares.length > 0) {
      const barX = x + 14;
      const barY = y + 30;
      const barH = 4;
      // Faint track behind the segments.
      ctx.fillStyle = 'rgba(74, 59, 110, 0.45)';
      ctx.fillRect(barX, barY, BAR_FULL_W, barH);
      let sx = barX;
      for (const seg of shares) {
        ctx.fillStyle = CATEGORY_COLOR[seg.category];
        ctx.fillRect(sx, barY, seg.width, barH);
        // Outline the active tab's slice so it stands out in the mix. The
        // outline is meaningless while searching (no single active tab), so
        // it's suppressed then.
        if (!searching && seg.category === this.currentCategory()) {
          ctx.strokeStyle = TEXT_COLOR;
          ctx.lineWidth = 1;
          ctx.strokeRect(sx - 0.5, barY - 1.5, seg.width + 1, barH + 3);
        }
        sx += seg.width;
      }
    }

    // Tabs through the shared strip — one per bag category. The sub line
    // normally shows each category's non-zero stack count; while `/` search
    // is active it instead shows how many of the cross-tab MATCHES live in
    // that category, so the player sees the match distribution (e.g. typing
    // "ruby" concentrates the hits under Gems). Tabs stay (dim, non-active)
    // while searching so the player keeps spatial context for the results.
    const counts = bagCategoryCounts(player);
    const matchCounts = searching
      ? bagSearchCategoryCounts(player, this.search)
      : null;
    const tabItems: TabStripItem[] = BAG_CATEGORIES.map((cat) => ({
      label: cat,
      sub: String((matchCounts ?? counts)[cat]),
    }));
    // While searching, pass -1 so no tab reads as active (no current tab).
    const tabRects = tabStripLayout(tabItems, x + 14, y + 38, PANEL_W - 28, searching ? -1 : this.tabIndex);
    drawTabStrip(ctx, tabRects);

    // Per-tab worth caption in the gap between the strip and the rows —
    // "Gems: 412g in this tab" — so the player sees where their money is
    // sitting. Quiet on valueless tabs (Seeds / Supplies sum to 0g), on an
    // empty tab, and while searching (no single active tab).
    const tabWorth = searching ? 0 : bagCategoryValue(player, this.currentCategory());
    if (tabWorth > 0) {
      ctx.fillStyle = GOLD;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(
        `${this.currentCategory()}: ${tabWorth}g in this tab`,
        x + PANEL_W - 14,
        y + 67,
      );
    }

    // Rows, a search prompt/no-match note, or a calm category empty state.
    if (rows.length === 0) {
      if (searching) {
        // Distinguish "type something" from "nothing matched" so the search
        // mode never reads as a broken empty panel.
        ctx.fillStyle = HINT;
        ctx.font = '11px ui-monospace, monospace';
        ctx.textAlign = 'center';
        const msg = this.search.length === 0
          ? 'type to search your whole bag'
          : `no items match "${this.search}"`;
        ctx.fillText(msg, x + PANEL_W / 2, y + 84);
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText('Backspace deletes - Esc clears - / exits search', x + PANEL_W / 2, y + 100);
      } else {
        drawEmptyState(ctx, bagEmptyState(this.currentCategory()), x + PANEL_W / 2, y + 78 + 6);
      }
    } else {
      const start = this.scroll;
      const end = Math.min(rows.length, start + visibleN);
      for (let i = start; i < end; i++) {
        const r = rows[i];
        const ry = y + 78 + (i - start) * ROW_H;
        if (i > start) {
          ctx.fillStyle = 'rgba(74, 59, 110, 0.4)';
          ctx.fillRect(x + 14, ry - 2, PANEL_W - 28, 1);
        }
        // Glyph pip + label on the left. The glyph is a tiny recognisable
        // sprite (crop / fish / gem / egg / dish / crate) so the list scans
        // like the hotbar; it's centred in a ~16px gutter and the label
        // starts to its right.
        drawBagGlyph(ctx, x + 22, ry + 9, bagGlyph(r));
        ctx.fillStyle = TEXT_COLOR;
        ctx.font = '12px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(r.label, x + 34, ry + 3);
        // While searching the list is cross-tab, so tag each row with its
        // category (dim, tinted to the share-bar palette) so the player
        // knows which tab a match lives under.
        if (searching) {
          ctx.fillStyle = CATEGORY_COLOR[r.category];
          ctx.font = '9px ui-monospace, monospace';
          ctx.fillText(r.category, x + 34, ry + 16);
        }

        // Count, then a value figure, on the right. Under the value sort we
        // emphasise each row's TOTAL worth (count * unitValue) — the figure
        // the ordering actually keys on — in bright bold gold, so a player
        // sorting by value can see why the rows landed in that order. Under
        // the other sorts the per-unit "Ng ea" price stays (quieter, dim).
        ctx.fillStyle = TITLE_COLOR;
        ctx.font = 'bold 12px ui-monospace, monospace';
        ctx.textAlign = 'right';
        const countX = x + PANEL_W - 14;
        ctx.fillText(`x${r.count}`, countX, ry + 3);
        if (r.unitValue > 0) {
          if (this.sortMode === 'value') {
            ctx.fillStyle = GOLD;
            ctx.font = 'bold 11px ui-monospace, monospace';
            ctx.fillText(`${bagItemWorth(r)}g`, countX - 44, ry + 3);
          } else {
            ctx.fillStyle = GOLD;
            ctx.font = '10px ui-monospace, monospace';
            ctx.fillText(`${r.unitValue}g ea`, countX - 44, ry + 4);
          }
        }
      }
    }

    // Scroll indicator when the list overflows the visible window.
    if (rows.length > visibleN) {
      ctx.fillStyle = HINT;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      const top = this.scroll === 0 ? '' : 'up ';
      const bot = this.scroll + visibleN >= rows.length ? '' : 'down';
      ctx.fillText(`${top}${bot}`.trim(), x + PANEL_W / 2, y + h - 44);
    }

    // Where-to-sell hint — closes the loop between seeing a stack's worth
    // and realising it. Quiet on tabs that aren't a sell loop (Seeds /
    // Supplies return null), on an empty tab, and while searching (the
    // cross-tab list has no single sell counter).
    const sellHint = !searching && rows.length > 0 ? bagSellHint(this.currentCategory()) : null;
    if (sellHint) {
      ctx.fillStyle = SELL_HINT;
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(sellHint, x + PANEL_W / 2, y + h - 28);
    }

    ctx.fillStyle = HINT;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    const controls = searching
      ? 'type to filter - Backspace deletes - Esc clears - / exits search'
      : 'Tab / Esc to close - a/d tabs - w/s scroll - f sort - / search';
    ctx.fillText(controls, x + PANEL_W / 2, y + h - 14);
    ctx.restore();
  }
}

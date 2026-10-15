/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Extended print: the five HoDoKu print layouts and the booklet page imposition.
 * Pure geometry, kept apart from the UI so it can be tested on its own.
 */

/** The five extended-print layouts, in the original's order. */
export const PRINT_LAYOUTS: readonly string[] = [
  'One puzzle per page (portrait)',
  'Two puzzles per page (portrait)',
  'Four puzzles per page (portrait)',
  'Two puzzles per page (landscape)',
  'Four puzzles per page (landscape)',
];

/** Puzzles on one printed page, indexed by layout. */
export const LAYOUT_PER_PAGE: readonly number[] = [1, 2, 4, 2, 4];

/** Layouts that need a landscape page. */
export const LAYOUT_LANDSCAPE: readonly boolean[] = [false, false, false, true, true];

/** Only the landscape layouts (3 and 4) can be folded into a booklet. */
export function canBooklet(layout: number): boolean {
  return layout === 3 || layout === 4;
}

/**
 * The puzzle index in every visual slot of every printed page; -1 for an empty slot.
 * Slot order is top-left, top-right, bottom-left, bottom-right (portrait 2-per-page uses only
 * top and bottom; landscape 2-per-page uses only left and right).
 * Without `booklet` the puzzles run in order. With `booklet` (landscape layouts only) the pages are
 * imposed so that printing them double-sided and folding in the middle makes a booklet; the puzzle
 * count is padded up to whole sheets.
 */
export function imposePages(count: number, layout: number, booklet: boolean): number[][] {
  const perPage = LAYOUT_PER_PAGE[layout];
  if (booklet && canBooklet(layout)) return bookletPages(count, layout, perPage);
  const pages: number[][] = [];
  for (let p = 0; p * perPage < count; p++) {
    const page: number[] = [];
    for (let k = 0; k < perPage; k++) {
      const i = p * perPage + k;
      page.push(i < count ? i : -1);
    }
    pages.push(page);
  }
  return pages;
}

/**
 * The booklet imposition of the original: one folded sheet holds `perPage * 2` puzzles, the left half
 * is printed in reverse, and odd pages swap left and right so the folded sheet reads in order.
 */
function bookletPages(count: number, layout: number, perPage: number): number[][] {
  const dummy = layout - 2; // puzzles in one half page: 1 for layout 3, 2 for layout 4
  const perSheet = perPage * 2; // 4 (layout 3) or 8 (layout 4)
  const sheets = Math.max(1, Math.ceil(count / perSheet));
  const pages = sheets * 2;
  const firstRight = pages * dummy;
  const clamp = (i: number): number => (i >= 0 && i < count ? i : -1);
  const out: number[][] = [];
  for (let p = 0; p < pages; p++) {
    const left = firstRight - (p + 1) * dummy;
    const right = firstRight + p * dummy;
    if (layout === 3) {
      out.push(p % 2 === 0 ? [clamp(left), clamp(right)] : [clamp(right), clamp(left)]);
    } else {
      out.push(
        p % 2 === 0
          ? [clamp(left), clamp(right), clamp(left + 1), clamp(right + 1)]
          : [clamp(right), clamp(left), clamp(right + 1), clamp(left + 1)],
      );
    }
  }
  return out;
}

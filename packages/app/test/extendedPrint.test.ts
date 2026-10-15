import { describe, expect, it } from 'vitest';
import { LAYOUT_LANDSCAPE, LAYOUT_PER_PAGE, PRINT_LAYOUTS, canBooklet, imposePages } from '../src/extendedPrint';

describe('print layouts', () => {
  it('lists the five layouts in the original order', () => {
    expect(PRINT_LAYOUTS).toHaveLength(5);
    expect(LAYOUT_PER_PAGE).toEqual([1, 2, 4, 2, 4]);
    expect(LAYOUT_LANDSCAPE).toEqual([false, false, false, true, true]);
  });

  it('knows which layouts can be booklets', () => {
    expect([0, 1, 2, 3, 4].map(canBooklet)).toEqual([false, false, false, true, true]);
  });
});

describe('imposePages without a booklet', () => {
  it('is empty when there is nothing to print', () => {
    expect(imposePages(0, 0, false)).toEqual([]);
  });

  it('prints one puzzle per page (layout 0)', () => {
    expect(imposePages(3, 0, false)).toEqual([[0], [1], [2]]);
  });

  it('prints two puzzles per portrait page (layout 1)', () => {
    expect(imposePages(3, 1, false)).toEqual([[0, 1], [2, -1]]);
  });

  it('prints four puzzles per portrait page (layout 2)', () => {
    expect(imposePages(6, 2, false)).toEqual([[0, 1, 2, 3], [4, 5, -1, -1]]);
  });

  it('prints two puzzles per landscape page (layout 3)', () => {
    expect(imposePages(3, 3, false)).toEqual([[0, 1], [2, -1]]);
  });

  it('prints four puzzles per landscape page (layout 4)', () => {
    expect(imposePages(5, 4, false)).toEqual([[0, 1, 2, 3], [4, -1, -1, -1]]);
  });
});

describe('imposePages as a booklet', () => {
  it('imposes two puzzles per landscape page for folding (layout 3)', () => {
    expect(imposePages(4, 3, true)).toEqual([[1, 2], [3, 0]]);
  });

  it('uses one folded sheet per eight puzzles (layout 4)', () => {
    // one sheet = two landscape pages of four; the count is padded up to a whole sheet
    const pages = imposePages(8, 4, true);
    expect(pages).toHaveLength(2);
    expect(pages.flat().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('pads a partial sheet with empty slots (layout 4)', () => {
    expect(imposePages(3, 4, true)).toEqual([[2, -1, -1, -1], [-1, 0, -1, 1]]);
  });

  it('ignores the booklet flag for a portrait layout', () => {
    expect(imposePages(3, 1, true)).toEqual(imposePages(3, 1, false));
  });
});

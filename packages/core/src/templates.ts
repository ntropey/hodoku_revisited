/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE.
 *
 * The 46,656 templates: every way to place one digit once in every row, column and box.
 * The original reads them from a data file; here they are computed on first use (a few
 * milliseconds), so no data of unknown origin is needed.
 */
import { SudokuSet } from './sudokuSet.js';

let cache: SudokuSet[] | null = null;

export function getTemplates(): readonly SudokuSet[] {
  if (cache === null) {
    const out: SudokuSet[] = [];
    const cols = new Array<number>(9).fill(0);
    const place = (row: number, colMask: number, boxMask: number): void => {
      if (row === 9) {
        const set = new SudokuSet();
        for (let r = 0; r < 9; r++) set.add(r * 9 + cols[r]);
        out.push(set);
        return;
      }
      for (let c = 0; c < 9; c++) {
        const box = Math.floor(row / 3) * 3 + Math.floor(c / 3);
        if ((colMask & (1 << c)) !== 0 || (boxMask & (1 << box)) !== 0) continue;
        cols[row] = c;
        place(row + 1, colMask | (1 << c), boxMask | (1 << box));
      }
    };
    place(0, 0, 0);
    cache = out;
  }
  return cache;
}

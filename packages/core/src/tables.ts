/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of the static tables in HoDoKu's Sudoku2 (Java).
 */
import { SudokuSet } from './sudokuSet.js';

/** The number of cells in the sudoku */
export const LENGTH = 81;
/** Number of units in each constraint */
export const UNITS = 9;

/** The internal numbers for unit types. */
export const BLOCK = 0;
export const LINE = 1;
export const COL = 2;
export const CELL = 3;

/** All indices for every line */
export const LINES: readonly (readonly number[])[] = Array.from({ length: 9 }, (_, r) =>
  Array.from({ length: 9 }, (_, c) => r * 9 + c),
);
/** All indices for every column */
export const COLS: readonly (readonly number[])[] = Array.from({ length: 9 }, (_, c) =>
  Array.from({ length: 9 }, (_, r) => r * 9 + c),
);
/** All indices for every block */
export const BLOCKS: readonly (readonly number[])[] = Array.from({ length: 9 }, (_, b) => {
  const r0 = Math.floor(b / 3) * 3;
  const c0 = (b % 3) * 3;
  const cells: number[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push((r0 + r) * 9 + c0 + c);
  return cells;
});
/** All indices for all constraints: first lines, then cols, then blocks */
export const ALL_UNITS: readonly (readonly number[])[] = [...LINES, ...COLS, ...BLOCKS];

export function getLine(index: number): number {
  return Math.floor(index / UNITS);
}
export function getCol(index: number): number {
  return index % UNITS;
}
export function getBlock(index: number): number {
  return Math.floor(getLine(index) / 3) * 3 + Math.floor(getCol(index) / 3);
}
export function getIndex(line: number, col: number): number {
  return line * 9 + col;
}

/** The unit type for every constraint */
export const CONSTRAINT_TYPE_FROM_CONSTRAINT: readonly number[] = ALL_UNITS.map((_, i) =>
  i < 9 ? LINE : i < 18 ? COL : BLOCK,
);
/** The unit number (1-based) for every constraint */
export const CONSTRAINT_NUMBER_FROM_CONSTRAINT: readonly number[] = ALL_UNITS.map((_, i) => (i % 9) + 1);

/** The indices of the constraints for every cell: [line (0-8), col (9-17), block (18-26)] */
export const CONSTRAINTS: readonly (readonly number[])[] = Array.from({ length: LENGTH }, (_, i) => [
  getLine(i),
  9 + getCol(i),
  18 + getBlock(i),
]);

/** Candidate masks for the digits 1 to 9 (index 0 is unused). */
export const MASKS: readonly number[] = [0, 1, 2, 4, 8, 16, 32, 64, 128, 256];
/** Mask for "all digits set" */
export const MAX_MASK = 0x1ff;

/** For each of the 512 possible candidate masks, the candidates (1-9) it contains, ascending. */
export const POSSIBLE_VALUES: readonly (readonly number[])[] = Array.from({ length: 0x200 }, (_, mask) => {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & MASKS[d]) out.push(d);
  return out;
});
/** Number of candidates in each mask. */
export const ANZ_VALUES: readonly number[] = POSSIBLE_VALUES.map((v) => v.length);
/** The candidate represented by the least significant set bit in a mask (0 for the empty mask). */
export const CAND_FROM_MASK: readonly number[] = POSSIBLE_VALUES.map((v) => (v.length ? v[0] : 0));

/** All cells that see the given cell (same line, column or block), excluding the cell itself. */
export const BUDDIES: readonly SudokuSet[] = Array.from({ length: LENGTH }, (_, i) => {
  const s = new SudokuSet();
  for (let j = 0; j < LENGTH; j++) {
    if (i !== j && (getLine(i) === getLine(j) || getCol(i) === getCol(j) || getBlock(i) === getBlock(j))) {
      s.add(j);
    }
  }
  return s;
});

/** One set with all cells for each line, column, block (same order as {@link ALL_UNITS}). */
export const ALL_CONSTRAINTS_TEMPLATES: readonly SudokuSet[] = ALL_UNITS.map((u) => SudokuSet.fromValues(u));

/** One set with all cells of each line. */
export const LINE_TEMPLATES: readonly SudokuSet[] = LINES.map((u) => SudokuSet.fromValues(u));
/** One set with all cells of each column. */
export const COL_TEMPLATES: readonly SudokuSet[] = COLS.map((u) => SudokuSet.fromValues(u));
/** One set with all cells of each block. */
export const BLOCK_TEMPLATES: readonly SudokuSet[] = BLOCKS.map((u) => SudokuSet.fromValues(u));

/**
 * All cells that see every cell of `cells` (the intersection of their buddies).
 * For an empty set that is every cell.
 */
export function getBuddiesOfSet(cells: SudokuSet, out: SudokuSet): void {
  out.setAll();
  for (const c of cells) out.and(BUDDIES[c]);
}

/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's Sudoku2 (Java).
 */
import { type ClipboardMode, formatSudoku, parseSudoku } from './formats.js';
import { SinglesQueue } from './singlesQueue.js';
import {
  ALL_UNITS,
  ANZ_VALUES,
  BUDDIES,
  CAND_FROM_MASK,
  CONSTRAINTS,
  LENGTH,
  MASKS,
  MAX_MASK,
  POSSIBLE_VALUES,
  UNITS,
  getIndex,
} from './tables.js';

/**
 * The state of a sudoku: values, candidates per cell and the bookkeeping
 * (free cells per unit, queues of naked/hidden singles) that makes finding
 * singles cheap.
 *
 * Differences to the Java original (Sudoku2):
 *  - `setSudoku` rejects input with other than 81 cells (the original silently accepts it);
 *    `getSudoku` has no step variants yet (see formats.ts).
 *  - The cached difficulty/status fields used by the Swing UI are omitted.
 */
/** Validity of a puzzle, as far as it is known. */
export type SudokuStatus = 'EMPTY' | 'INVALID' | 'VALID' | 'MULTIPLE_SOLUTIONS';

export class Sudoku2 {
  /** Candidate bitmaps per cell (bit d-1 = digit d). 0 means "cell already set". */
  cells = new Uint16Array(LENGTH);
  /** Candidates set by the user if "show all candidates" is off. */
  userCells = new Uint16Array(LENGTH);
  /** Number of free cells per unit and candidate (candidates go from 1 to 9). */
  free: Uint8Array[] = Array.from({ length: ALL_UNITS.length }, () => new Uint8Array(UNITS + 1));
  /** number of unfilled cells in the grid */
  unsolvedCellsAnz = LENGTH;
  /** Values of the cells (0 = not set) */
  values = new Int32Array(LENGTH);
  /** true if the cell is a given */
  fixed: boolean[] = new Array<boolean>(LENGTH).fill(false);
  /** The correct values of the solution */
  solution = new Int32Array(LENGTH);
  solutionSet = false;
  score = 0;
  /** Difficulty level ordinal (see DifficultyType), or null if not rated. */
  level: number | null = null;
  initialState: string | null = null;
  /** Status of the sudoku. Uniqueness techniques only work on 'VALID' puzzles (exactly one solution). */
  status: SudokuStatus = 'EMPTY';
  /** Status if only the givens are taken into account (needed for Avoidable Rectangles). */
  statusGivens: SudokuStatus = 'EMPTY';
  /** Newly detected Naked Singles */
  nsQueue = new SinglesQueue();
  /** Newly detected Hidden Singles */
  hsQueue = new SinglesQueue();

  constructor() {
    this.clearSudoku();
  }

  /** A deep copy. */
  clone(): Sudoku2 {
    const s = new Sudoku2();
    s.set(this);
    return s;
  }

  /** Copy the state of `src` into this sudoku. */
  set(src: Sudoku2): void {
    this.cells.set(src.cells);
    this.userCells.set(src.userCells);
    this.values.set(src.values);
    this.solution.set(src.solution);
    this.fixed = src.fixed.slice();
    for (let i = 0; i < this.free.length; i++) this.free[i].set(src.free[i]);
    this.unsolvedCellsAnz = src.unsolvedCellsAnz;
    this.solutionSet = src.solutionSet;
    this.score = src.score;
    this.level = src.level;
    this.status = src.status;
    this.statusGivens = src.statusGivens;
    if (src.initialState !== null) this.initialState = src.initialState;
    this.nsQueue.set(src.nsQueue);
    this.hsQueue.set(src.hsQueue);
  }

  /** Empty grid: no values set, every candidate allowed everywhere; queues are cleared. */
  clearSudoku(): void {
    this.cells.fill(MAX_MASK);
    this.userCells.fill(0);
    for (const f of this.free) {
      f.fill(0);
      for (let j = 1; j <= 9; j++) f[j] = 9;
    }
    this.values.fill(0);
    this.solution.fill(0);
    this.fixed.fill(false);
    this.unsolvedCellsAnz = LENGTH;
    this.initialState = null;
    this.solutionSet = false;
    this.status = 'EMPTY';
    this.statusGivens = 'EMPTY';
    this.nsQueue.clear();
    this.hsQueue.clear();
  }

  resetSudoku(): void {
    if (this.initialState !== null) this.setSudoku(this.initialState);
  }

  /**
   * Load a puzzle from a string. See {@link parseSudoku} for the accepted formats
   * (81 characters, grids, PM grids, SimpleSudoku, HoDoKu library format, gsf taxonomy).
   * Throws if the text does not contain exactly 81 cells.
   */
  setSudoku(init: string, saveInitialState = true): void {
    parseSudoku(this, init, saveInitialState);
  }

  /** The current state as text, see {@link ClipboardMode}. */
  getSudoku(mode: ClipboardMode, zeroForDot = false): string {
    return formatSudoku(this, mode, zeroForDot);
  }

  /** Mark every cell that has a digit in the 81 character string `givens` as given, all others as not given. */
  setGivens(givens: string): void {
    for (let i = 0; i < givens.length && i < LENGTH; i++) {
      this.fixed[i] = givens[i] >= '1' && givens[i] <= '9';
    }
  }

  /** The values as 81-character string, '.' for empty cells. */
  getValuesString(): string {
    let s = '';
    for (let i = 0; i < LENGTH; i++) s += this.values[i] === 0 ? '.' : String(this.values[i]);
    return s;
  }

  /** Only the givens as 81-character string, '.' for every other cell. */
  getCluesString(): string {
    let s = '';
    for (let i = 0; i < LENGTH; i++) s += this.fixed[i] && this.values[i] !== 0 ? String(this.values[i]) : '.';
    return s;
  }

  toString(): string {
    return this.getValuesString();
  }

  /** Recompute {@link unsolvedCellsAnz}, {@link free} and rebuild both singles queues. */
  rebuildInternalData(): void {
    this.nsQueue.clear();
    this.hsQueue.clear();
    for (const f of this.free) f.fill(0);
    let anz = 0;
    for (let index = 0; index < LENGTH; index++) {
      if (this.values[index] !== 0) {
        this.cells[index] = 0;
      } else {
        anz++;
        for (const cand of POSSIBLE_VALUES[this.cells[index]]) {
          for (const c of CONSTRAINTS[index]) this.free[c][cand]++;
        }
        if (ANZ_VALUES[this.cells[index]] === 1) {
          this.nsQueue.addSingle(index, CAND_FROM_MASK[this.cells[index]]);
        }
      }
    }
    this.unsolvedCellsAnz = anz;
    for (let i = 0; i < this.free.length; i++) {
      for (let j = 1; j <= 9; j++) {
        if (this.free[i][j] === 1) {
          // the original loops until this succeeds; with consistent data it always does
          this.addHiddenSingle(i, j);
        }
      }
    }
  }

  /** Check that all values/candidates are consistent (and match the solution if set). */
  checkSudoku(): boolean {
    this.rebuildInternalData();
    for (let index = 0; index < LENGTH; index++) {
      if (this.values[index] !== 0) {
        if (!this.isValidValue(index, this.values[index])) return false;
        if (this.solutionSet && this.solution[index] !== this.values[index]) return false;
      } else {
        for (const cand of POSSIBLE_VALUES[this.cells[index]]) {
          if (!this.isValidValue(index, cand)) return false;
        }
        if (this.solutionSet && !this.isCandidate(index, this.solution[index])) return false;
      }
    }
    return true;
  }

  getValue(index: number): number {
    return this.values[index];
  }

  getSolution(index: number): number {
    return this.solutionSet ? this.solution[index] : 0;
  }

  isFixed(index: number): boolean {
    return this.fixed[index];
  }

  /** The candidate bitmap of a cell. */
  getCell(index: number): number {
    return this.cells[index];
  }

  isCandidate(index: number, cand: number, user = false): boolean {
    return ((user ? this.userCells[index] : this.cells[index]) & MASKS[cand]) !== 0;
  }

  getAnzCandidates(index: number): number {
    return ANZ_VALUES[this.cells[index]];
  }

  getAllCandidates(index: number): readonly number[] {
    return POSSIBLE_VALUES[this.cells[index]];
  }

  getCandidateString(index: number): string {
    return POSSIBLE_VALUES[this.cells[index]].join('');
  }

  /** Delete a candidate. Returns false if the puzzle becomes invalid (a cell without candidates). */
  delCandidate(index: number, value: number, user = false): boolean {
    return this.setCandidate(index, value, false, user);
  }

  /**
   * Set or delete a candidate and keep {@link free} and the singles queues up to date.
   * Returns false if the puzzle becomes invalid by deleting a candidate.
   */
  setCandidate(index: number, value: number, set = true, user = false): boolean {
    const ret = this.setCandidateInternal(index, value, set);
    if (user) {
      if (set) this.userCells[index] |= MASKS[value];
      else this.userCells[index] &= ~MASKS[value];
    }
    return ret;
  }

  private setCandidateInternal(index: number, value: number, set: boolean): boolean {
    if (set) {
      if ((this.cells[index] & MASKS[value]) === 0) {
        this.cells[index] |= MASKS[value];
        const newAnz = ANZ_VALUES[this.cells[index]];
        if (newAnz === 1) this.nsQueue.addSingle(index, value);
        else if (newAnz === 2) this.nsQueue.deleteNakedSingle(index);
        for (const c of CONSTRAINTS[index]) {
          const newFree = ++this.free[c][value];
          if (newFree === 1) this.addHiddenSingle(c, value);
          else if (newFree === 2) this.hsQueue.deleteHiddenSingle(c, value);
        }
      }
    } else if ((this.cells[index] & MASKS[value]) !== 0) {
      this.cells[index] &= ~MASKS[value];
      if (this.cells[index] === 0) return false; // puzzle invalid
      if (ANZ_VALUES[this.cells[index]] === 1) {
        this.nsQueue.addSingle(index, CAND_FROM_MASK[this.cells[index]]);
      }
      for (const c of CONSTRAINTS[index]) {
        const newFree = --this.free[c][value];
        if (newFree === 1) {
          this.addHiddenSingle(c, value);
        } else if (newFree === 0) {
          // can happen if the candidate was invalid; invalid candidates produce an
          // entry in the HS queue that has to be deleted again (bug 3515379 in HoDoKu)
          this.hsQueue.deleteHiddenSingle(c, value);
        }
      }
    }
    return true;
  }

  /**
   * Set a value in a cell, or delete it (value 0). Candidates are adapted:
   * setting a value removes it from all buddies; deleting a value makes it a
   * candidate again where it is not invalid.
   * Returns false if the puzzle becomes invalid.
   */
  setCell(index: number, value: number, isFixed = false, user = true): boolean {
    if (this.values[index] === value) return true;
    let valid = true;
    const oldValue = this.values[index];
    this.values[index] = value;
    this.fixed[index] = isFixed;
    if (value !== 0) {
      const cands = POSSIBLE_VALUES[this.cells[index]];
      this.cells[index] = 0;
      if (user) this.userCells[index] = 0;
      this.unsolvedCellsAnz--;
      const buddies = BUDDIES[index].values();
      for (let i = 0; i < buddies.length; i++) {
        const buddyIndex = buddies[i];
        if (!this.setCandidateInternal(buddyIndex, value, false)) valid = false;
        if (user) this.userCells[buddyIndex] &= ~MASKS[value];
      }
      // now check all candidates from the cell itself
      for (const cand of cands) {
        for (const constr of CONSTRAINTS[index]) {
          const newFree = --this.free[constr][cand];
          if (newFree === 1 && value !== cand) this.addHiddenSingle(constr, cand);
          else if (newFree === 0 && cand !== value) valid = false;
        }
      }
    } else {
      // in the cell itself all possible candidates are set (user candidates are unchanged)
      for (let cand = 1; cand <= 9; cand++) {
        if (this.isValidValue(index, cand)) this.setCandidate(index, cand);
      }
      // the deleted value is a candidate in all unset buddies where it is not invalid
      for (const buddyIndex of BUDDIES[index].values()) {
        if (this.values[buddyIndex] === 0 && this.isValidValue(buddyIndex, oldValue)) {
          this.setCandidate(buddyIndex, oldValue);
        }
      }
      // the singles queues are invalid now -> rebuild everything (adjusts unsolvedCellsAnz too)
      this.rebuildInternalData();
    }
    return valid;
  }

  /**
   * A simplified {@link set} for the backtracking solver of the generator: copies only candidates,
   * values, free counts and the number of unsolved cells, and clears the singles queues.
   */
  setBS(src: Sudoku2): void {
    this.cells.set(src.cells);
    this.values.set(src.values);
    for (let i = 0; i < this.free.length; i++) this.free[i].set(src.free[i]);
    this.unsolvedCellsAnz = src.unsolvedCellsAnz;
    this.nsQueue.clear();
    this.hsQueue.clear();
  }

  /**
   * Set a cell without maintaining `free`, the queues and the unsolved counter; call
   * {@link rebuildInternalData} afterwards. Only for building a sudoku from raw values.
   */
  setCellBS(index: number, value: number): void {
    this.values[index] = value;
    this.cells[index] = 0;
    for (const b of BUDDIES[index].values()) this.cells[b] &= ~MASKS[value];
  }

  /** A value is invalid for a cell if one of its buddies already has that value. */
  isValidValue(index: number, value: number): boolean {
    for (const b of BUDDIES[index].values()) {
      if (this.values[b] === value) return false;
    }
    return true;
  }

  isSolved(): boolean {
    return this.unsolvedCellsAnz === 0;
  }

  getSolvedCellsAnz(): number {
    return LENGTH - this.unsolvedCellsAnz;
  }

  getFixedCellsAnz(): number {
    return this.fixed.reduce((n, f) => n + (f ? 1 : 0), 0);
  }

  /** Total number of candidates still set in unsolved cells. */
  getUnsolvedCandidatesAnz(): number {
    let anz = 0;
    for (let i = 0; i < LENGTH; i++) anz += ANZ_VALUES[this.cells[i]];
    return anz;
  }

  /**
   * Add the Hidden Single for candidate `value` in `constraint` to the queue.
   * Returns false if no cell with that candidate could be found.
   */
  private addHiddenSingle(constraint: number, value: number): boolean {
    for (const hsIndex of ALL_UNITS[constraint]) {
      if (this.isCandidate(hsIndex, value)) {
        this.hsQueue.addSingle(hsIndex, value);
        return true;
      }
    }
    return false;
  }
}

export { getIndex };

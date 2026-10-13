/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's SudokuGenerator (Java).
 */
import { Sudoku2 } from '../sudoku2.js';
import { ANZ_VALUES, LENGTH, MASKS, POSSIBLE_VALUES } from '../tables.js';
import { nextInt, type Rng } from './random.js';

/** One level of the backtracking search. */
class RecursionStackEntry {
  sudoku = new Sudoku2();
  index = 0;
  candidates: readonly number[] = [];
  candIndex = 0;
}

export interface GenerateOptions {
  /** Remove clues point-symmetrically (rotation by 180 degrees). Default: true. */
  symmetric?: boolean;
  /** A pattern of cells that have to be the givens (true = given); overrides `symmetric`. */
  pattern?: readonly boolean[];
}

const MAX_PATTERN_TRIES = 1000000;

/**
 * Creates sudokus with exactly one solution and counts solutions of a sudoku. The search is a
 * backtracking solver that always fills exposed singles first and picks the cell with the fewest
 * candidates.
 *
 * To generate a puzzle, a full grid is built by backtracking over the cells in random order; then
 * clues are removed one by one (or in symmetric pairs) in random order as long as the solution stays
 * unique, but never going below 17 clues.
 */
export class SudokuGenerator {
  private readonly emptyGrid = new Sudoku2();
  private solution = new Array<number>(LENGTH).fill(0);
  private solutionCount = 0;
  private readonly stack: RecursionStackEntry[] = Array.from({ length: LENGTH + 1 }, () => new RecursionStackEntry());
  private readonly generateIndices = new Array<number>(LENGTH).fill(0);
  private newFullSudoku = new Array<number>(LENGTH).fill(0);
  private newValidSudoku = new Array<number>(LENGTH).fill(0);

  constructor(private readonly rng: Rng = Math.random) {}

  /** The number of solutions (searching stops at 2). If it is exactly 1, the solution is stored in the sudoku. */
  getNumberOfSolutions(sudoku: Sudoku2): number {
    this.solveSudoku(sudoku);
    if (this.solutionCount === 1) this.storeSolution(sudoku);
    return this.solutionCount;
  }

  /** true if the sudoku has exactly one solution (which is then stored in the sudoku). */
  validSolution(sudoku: Sudoku2): boolean {
    return this.getNumberOfSolutions(sudoku) === 1;
  }

  /** The solution found by the last search (only meaningful if there is at least one). */
  getSolution(): readonly number[] {
    return this.solution;
  }

  getSolutionCount(): number {
    return this.solutionCount;
  }

  /** Count solutions of a puzzle given as 81 characters ('1'-'9' for givens, anything else is empty). */
  solveString(puzzle: string): number {
    const stack0 = this.stack[0];
    stack0.sudoku.set(this.emptyGrid);
    stack0.candidates = [];
    stack0.candIndex = 0;
    for (let i = 0; i < puzzle.length && i < LENGTH; i++) {
      const value = puzzle.charCodeAt(i) - 48;
      if (value >= 1 && value <= 9) {
        stack0.sudoku.setCell(i, value, false, false);
        this.setAllExposedSingles(stack0.sudoku);
      }
    }
    this.solveStack();
    return this.solutionCount;
  }

  /** Count solutions of a puzzle given as cell values (0 = empty). */
  private solveValues(cellValues: readonly number[]): void {
    const stack0 = this.stack[0];
    stack0.sudoku.set(this.emptyGrid);
    stack0.candidates = [];
    stack0.candIndex = 0;
    for (let i = 0; i < cellValues.length; i++) {
      if (cellValues[i] >= 1 && cellValues[i] <= 9) stack0.sudoku.setCellBS(i, cellValues[i]);
    }
    stack0.sudoku.rebuildInternalData();
    this.setAllExposedSingles(stack0.sudoku);
    this.solveStack();
  }

  private solveSudoku(sudoku: Sudoku2): void {
    const stack0 = this.stack[0];
    stack0.sudoku.set(sudoku);
    stack0.index = 0;
    stack0.candidates = [];
    stack0.candIndex = 0;
    this.solveStack();
  }

  private storeSolution(sudoku: Sudoku2): void {
    sudoku.solution.set(this.solution);
    sudoku.solutionSet = true;
  }

  /** The search itself; the start sudoku is in stack[0]. */
  private solveStack(): void {
    const stack = this.stack;
    this.solutionCount = 0;
    if (!this.setAllExposedSingles(stack[0].sudoku)) return; // the puzzle is invalid
    if (stack[0].sudoku.unsolvedCellsAnz === 0) {
      this.solution = Array.from(stack[0].sudoku.values);
      this.solutionCount++;
      return;
    }
    let level = 0;
    while (true) {
      if (stack[level].sudoku.unsolvedCellsAnz === 0) {
        this.solutionCount++;
        if (this.solutionCount === 1) this.solution = Array.from(stack[level].sudoku.values);
        else if (this.solutionCount > 1) return; // more than one solution
      } else {
        // the unsolved cell with the fewest candidates
        let index = -1;
        let anzCand = 9;
        const sudoku = stack[level].sudoku;
        for (let i = 0; i < LENGTH; i++) {
          if (sudoku.getCell(i) !== 0 && ANZ_VALUES[sudoku.getCell(i)] < anzCand) {
            index = i;
            anzCand = ANZ_VALUES[sudoku.getCell(i)];
          }
        }
        level++;
        if (index < 0) {
          // an unsolved cell without candidates: no solution
          this.solutionCount = 0;
          return;
        }
        stack[level].index = index;
        stack[level].candidates = POSSIBLE_VALUES[stack[level - 1].sudoku.getCell(index)];
        stack[level].candIndex = 0;
      }
      // try the next candidate on the current level, backtrack when a level is exhausted
      let done = false;
      while (true) {
        while (stack[level].candIndex >= stack[level].candidates.length) {
          level--;
          if (level <= 0) {
            done = true;
            break;
          }
        }
        if (done) break;
        const nextCand = stack[level].candidates[stack[level].candIndex++];
        stack[level].sudoku.setBS(stack[level - 1].sudoku);
        if (!stack[level].sudoku.setCell(stack[level].index, nextCand, false, false)) continue;
        if (this.setAllExposedSingles(stack[level].sudoku)) break;
      }
      if (done) break;
    }
  }

  /** Create a new puzzle with exactly one solution, or null if a pattern can't be satisfied. */
  generateSudoku(options: GenerateOptions = {}): Sudoku2 | null {
    this.generateFullGrid();
    if (options.pattern === undefined) {
      this.generateInitPos(options.symmetric ?? true);
    } else {
      let ok = false;
      for (let i = 0; i < MAX_PATTERN_TRIES && !ok; i++) {
        if (i > 0) this.generateFullGrid();
        ok = this.generateInitPosPattern(options.pattern);
      }
      if (!ok) return null;
    }
    const sudoku = new Sudoku2();
    for (let i = 0; i < LENGTH; i++) {
      if (this.newValidSudoku[i] !== 0) {
        sudoku.setCell(i, this.newValidSudoku[i]);
        sudoku.fixed[i] = true;
      }
    }
    sudoku.status = 'VALID';
    sudoku.statusGivens = 'VALID';
    return sudoku;
  }

  private generateFullGrid(): void {
    while (!this.doGenerateFullGrid()) {
      // try again with a new random order
    }
  }

  /** Fill an empty grid by backtracking, visiting the cells in random order. Gives up after 100 tries. */
  private doGenerateFullGrid(): boolean {
    const stack = this.stack;
    const max = this.generateIndices.length;
    for (let i = 0; i < max; i++) this.generateIndices[i] = i;
    for (let i = 0; i < max; i++) {
      const index1 = nextInt(this.rng, max);
      let index2 = nextInt(this.rng, max);
      while (index1 === index2) index2 = nextInt(this.rng, max);
      const dummy = this.generateIndices[index1];
      this.generateIndices[index1] = this.generateIndices[index2];
      this.generateIndices[index2] = dummy;
    }
    stack[0].sudoku.set(this.emptyGrid);
    let level = 0;
    stack[0].index = -1;
    let actTries = 0;
    while (true) {
      if (stack[level].sudoku.unsolvedCellsAnz === 0) {
        this.newFullSudoku = Array.from(stack[level].sudoku.values);
        return true;
      }
      // the next unset cell in the random order
      let index = -1;
      const actValues = stack[level].sudoku.values;
      for (let i = 0; i < LENGTH; i++) {
        const actTry = this.generateIndices[i];
        if (actValues[actTry] === 0) {
          index = actTry;
          break;
        }
      }
      level++;
      stack[level].index = index;
      stack[level].candidates = POSSIBLE_VALUES[stack[level - 1].sudoku.getCell(index)];
      stack[level].candIndex = 0;
      actTries++;
      if (actTries > 100) return false;
      let done = false;
      while (true) {
        while (stack[level].candIndex >= stack[level].candidates.length) {
          level--;
          if (level <= 0) {
            done = true;
            break;
          }
        }
        if (done) break;
        const nextCand = stack[level].candidates[stack[level].candIndex++];
        stack[level].sudoku.setBS(stack[level - 1].sudoku);
        if (!stack[level].sudoku.setCell(stack[level].index, nextCand, false, false)) continue;
        if (this.setAllExposedSingles(stack[level].sudoku)) break;
      }
      if (done) break;
    }
    return false;
  }

  /** A pattern says which cells are givens; the puzzle is valid if it has exactly one solution. */
  private generateInitPosPattern(pattern: readonly boolean[]): boolean {
    this.newValidSudoku = this.newFullSudoku.slice();
    for (let i = 0; i < pattern.length; i++) {
      if (!pattern[i]) this.newValidSudoku[i] = 0;
    }
    this.solveValues(this.newValidSudoku);
    return this.solutionCount === 1;
  }

  /** Remove clues in random order while the solution stays unique (never going below 17 clues). */
  private generateInitPos(isSymmetric: boolean): void {
    const maxPosToFill = 17; // no less than 17 givens
    const used = new Array<boolean>(LENGTH).fill(false); // try every cell only once
    let usedCount = LENGTH;
    this.newValidSudoku = this.newFullSudoku.slice();
    const valid = this.newValidSudoku;
    let remainingClues = valid.length;
    while (remainingClues > maxPosToFill && usedCount > 1) {
      // the next cell that wasn't tried yet, starting at a random position
      let i = nextInt(this.rng, LENGTH);
      do {
        i = i < 80 ? i + 1 : 0;
      } while (used[i]);
      used[i] = true;
      usedCount--;
      if (valid[i] === 0) continue; // already deleted (as the symmetric partner of another cell)
      const notCenter = Math.floor(i / 9) !== 4 || i % 9 !== 4;
      const symm = 9 * (8 - Math.floor(i / 9)) + (8 - (i % 9));
      // with symmetry both cells have to be deleted together
      if (isSymmetric && notCenter && valid[symm] === 0) continue;
      valid[i] = 0;
      remainingClues--;
      if (isSymmetric && notCenter) {
        valid[symm] = 0;
        used[symm] = true;
        usedCount--;
        remainingClues--;
      }
      this.solveValues(valid);
      if (this.solutionCount > 1) {
        // not unique any more: put the clue(s) back
        valid[i] = this.newFullSudoku[i];
        remainingClues++;
        if (isSymmetric && notCenter) {
          valid[symm] = this.newFullSudoku[symm];
          remainingClues++;
        }
      }
    }
  }

  /** Fill all naked and hidden singles. Returns false if the sudoku becomes invalid. */
  private setAllExposedSingles(sudoku: Sudoku2): boolean {
    let valid = true;
    const nsQueue = sudoku.nsQueue;
    const hsQueue = sudoku.hsQueue;
    do {
      let singleIndex: number;
      while (valid && (singleIndex = nsQueue.getSingle()) !== -1) {
        const index = nsQueue.getIndex(singleIndex);
        const value = nsQueue.getValue(singleIndex);
        if ((sudoku.getCell(index) & MASKS[value]) !== 0) valid = sudoku.setCell(index, value, false, false);
      }
      while (valid && (singleIndex = hsQueue.getSingle()) !== -1) {
        const index = hsQueue.getIndex(singleIndex);
        const value = hsQueue.getValue(singleIndex);
        if ((sudoku.getCell(index) & MASKS[value]) !== 0) valid = sudoku.setCell(index, value, false, false);
      }
    } while (valid && !(nsQueue.isEmpty() && hsQueue.isEmpty()));
    return valid;
  }
}

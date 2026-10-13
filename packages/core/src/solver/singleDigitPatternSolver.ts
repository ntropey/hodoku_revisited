/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's SingleDigitPatternSolver (Java).
 */
import { SolutionStep } from '../solutionStep.js';
import type { SolutionType } from '../solutionType.js';
import { SudokuSet } from '../sudokuSet.js';
import {
  ALL_UNITS,
  BLOCKS,
  BLOCK_TEMPLATES,
  BUDDIES,
  COLS,
  COL_TEMPLATES,
  LINES,
  LINE_TEMPLATES,
  UNITS,
  getBlock,
  getCol,
  getIndex,
  getLine,
} from '../tables.js';
import { AbstractSolver } from './abstractSolver.js';
import type { SudokuStepFinder } from './stepFinder.js';

/** Empty rectangles: all possible empty cells relative to the first cell of the block. */
const ER_OFFSETS: readonly (readonly number[])[] = [
  [0, 1, 9, 10],
  [0, 2, 9, 11],
  [1, 2, 10, 11],
  [0, 1, 18, 19],
  [0, 2, 18, 20],
  [1, 2, 19, 20],
  [9, 10, 18, 19],
  [9, 11, 18, 20],
  [10, 11, 19, 20],
];
/** Empty rectangles: the ER line relative to the first line of the block (synchronized with ER_OFFSETS). */
const ER_LINE_OFFSETS = [2, 2, 2, 1, 1, 1, 0, 0, 0];
/** Empty rectangles: the ER column relative to the first column of the block. */
const ER_COL_OFFSETS = [2, 1, 0, 2, 1, 0, 2, 1, 0];

/** For every block the sets of cells that have to be empty for each of the nine possible ERs. */
const ER_SETS: SudokuSet[][] = [];
/** The ER line for every block and ER (synchronized with ER_SETS). */
const ER_LINES: number[][] = [];
/** The ER column for every block and ER (synchronized with ER_SETS). */
const ER_COLS: number[][] = [];
{
  let indexOffset = 0;
  let lineOffset = 0;
  let colOffset = 0;
  for (let i = 0; i < BLOCKS.length; i++) {
    ER_SETS[i] = ER_OFFSETS.map((offsets) => SudokuSet.fromValues(offsets.map((o) => o + indexOffset)));
    ER_LINES[i] = ER_LINE_OFFSETS.map((o) => o + lineOffset);
    ER_COLS[i] = ER_COL_OFFSETS.map((o) => o + colOffset);
    // on to the next block
    indexOffset += 3;
    colOffset += 3;
    if (i % 3 === 2) {
      indexOffset += 18;
      lineOffset += 3;
      colOffset = 0;
    }
  }
}

/** Skyscraper, 2-String Kite and Empty Rectangle. */
export class SingleDigitPatternSolver extends AbstractSolver {
  /** The list with all newly found steps (used when searching for all steps). */
  private steps: SolutionStep[] = [];
  private readonly blockCands = new SudokuSet();
  private readonly tmpSet = new SudokuSet();
  /** For all units with exactly two candidates the indices of the two cells. */
  private readonly only2Indices: number[][] = Array.from({ length: 2 * UNITS }, () => [0, 0]);
  private readonly firstUnit = new SudokuSet();

  constructor(finder: SudokuStepFinder) {
    super(finder);
  }

  getStep(type: SolutionType): SolutionStep | null {
    this.sudoku = this.finder.getSudoku();
    switch (type) {
      case 'SKYSCRAPER':
        return this.findSkyscraper(true, true) ?? this.findSkyscraper(false, true);
      case 'TWO_STRING_KITE':
        this.requireNoDuals();
        return this.findTwoStringKite(true);
      case 'EMPTY_RECTANGLE':
        this.requireNoDuals();
        return this.findEmptyRectangles(true);
      default:
        return null;
    }
  }

  doStep(step: SolutionStep): boolean {
    this.sudoku = this.finder.getSudoku();
    switch (step.type) {
      case 'SKYSCRAPER':
      case 'TWO_STRING_KITE':
      case 'DUAL_TWO_STRING_KITE':
      case 'EMPTY_RECTANGLE':
      case 'DUAL_EMPTY_RECTANGLE':
        for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
        return true;
      default:
        return false;
    }
  }

  private requireNoDuals(): void {
    if (this.finder.options.allowDualsAndSiamese) {
      throw new Error('allowDualsAndSiamese is not supported yet');
    }
  }

  /**
   * Empty Rectangle: a block in which a candidate is confined to one line and
   * one column (the "ER"), plus a conjugate pair in another line/column that
   * points into the ER. Candidates are searched in ascending order.
   */
  private findEmptyRectangles(onlyOne = true): SolutionStep | null {
    for (let cand = 1; cand <= 9; cand++) {
      const step = this.findEmptyRectanglesForCandidate(cand, onlyOne);
      if (step !== null && onlyOne) return step;
    }
    return null;
  }

  /** All Empty Rectangles (sorted). */
  findAllEmptyRectangles(): SolutionStep[] {
    return this.collectAll(() => {
      this.findEmptyRectangles(false);
    });
  }

  /** All Skyscrapers (sorted). */
  findAllSkyscrapers(): SolutionStep[] {
    return this.collectAll(() => {
      this.findSkyscraper(true, false);
      this.findSkyscraper(false, false);
    });
  }

  /** All 2-String Kites (sorted). */
  findAllTwoStringKites(): SolutionStep[] {
    return this.collectAll(() => {
      this.findTwoStringKite(false);
    });
  }

  /** Run `search` with an empty step list, return the sorted result and restore the old list. */
  private collectAll(search: () => void): SolutionStep[] {
    this.requireNoDuals();
    this.sudoku = this.finder.getSudoku();
    const old = this.steps;
    this.steps = [];
    search();
    const result = this.steps.sort((a, b) => a.compareTo(b));
    this.steps = old;
    return result;
  }

  /**
   * Try all blocks: for every block check whether all the cells in ER_SETS[block][i]
   * lack the candidate. If so, neither the ER line nor the ER column may be empty
   * (without the crossing point) and at least one of them has to hold at least
   * two candidates. Then look for a conjugate pair that eliminates something.
   */
  private findEmptyRectanglesForCandidate(cand: number, onlyOne: boolean): SolutionStep | null {
    const free = this.sudoku.free;
    const blockCands = this.blockCands;
    const tmpSet = this.tmpSet;
    for (let i = 0; i < BLOCK_TEMPLATES.length; i++) {
      // a block with less than two or more than five candidates cannot hold an ER
      if (free[18 + i][cand] < 2 || free[18 + i][cand] > 5) continue;
      blockCands.set(this.finder.getCandidates()[cand]);
      blockCands.and(BLOCK_TEMPLATES[i]);
      for (let j = 0; j < ER_SETS[i].length; j++) {
        let notEnoughCandidates = true;
        // are the correct cells empty?
        tmpSet.setAnd(blockCands, ER_SETS[i][j]);
        if (!tmpSet.isEmpty()) continue; // definitely not this type of ER
        // the candidates in the line
        tmpSet.setAnd(blockCands, LINE_TEMPLATES[ER_LINES[i][j]]);
        if (tmpSet.size() >= 2) notEnoughCandidates = false;
        tmpSet.andNot(COL_TEMPLATES[ER_COLS[i][j]]);
        if (tmpSet.isEmpty()) continue; // not valid
        const erLine = ER_LINES[i][j];
        // and the candidates in the column
        tmpSet.setAnd(blockCands, COL_TEMPLATES[ER_COLS[i][j]]);
        if (tmpSet.size() >= 2) notEnoughCandidates = false;
        tmpSet.andNot(LINE_TEMPLATES[ER_LINES[i][j]]);
        if (tmpSet.isEmpty()) continue; // not valid
        const erCol = ER_COLS[i][j];
        if (notEnoughCandidates && !this.finder.options.allowErsWithOnlyTwoCandidates) {
          // both line and column hold only one candidate -> invalid
          continue;
        }
        // empty rectangle found: try all cells in the ER line / ER column
        let step = this.checkEmptyRectangle(cand, i, blockCands, LINES[erLine], LINE_TEMPLATES, COL_TEMPLATES, erCol, false, onlyOne);
        if (onlyOne && step !== null) return step;
        step = this.checkEmptyRectangle(cand, i, blockCands, COLS[erCol], COL_TEMPLATES, LINE_TEMPLATES, erLine, true, onlyOne);
        if (onlyOne && step !== null) return step;
      }
    }
    return null;
  }

  /**
   * Possible eliminations for a given ER. The parameter names fit a conjugate
   * pair search in the columns; for lines all line/column parameters are
   * exchanged (`lineColReversed`).
   *
   * Looks for a conjugate pair in a column where one of the candidates is in
   * `indices`. If so, the candidates in the line of the pair's second cell are
   * checked: one that lies in column `firstCol` can be eliminated.
   */
  private checkEmptyRectangle(
    cand: number,
    block: number,
    blockCands: SudokuSet,
    indices: readonly number[],
    lineTemplates: readonly SudokuSet[],
    colTemplates: readonly SudokuSet[],
    firstCol: number,
    lineColReversed: boolean,
    onlyOne: boolean,
  ): SolutionStep | null {
    const tmpSet = this.tmpSet;
    const candidates = this.finder.getCandidates();
    for (const index of indices) {
      if (this.sudoku.getValue(index) !== 0) continue; // cell already set
      if (getBlock(index) === block) continue; // cell is part of the ER
      if (!this.sudoku.isCandidate(index, cand)) continue;
      // possible conjugate pair -> check
      tmpSet.set(candidates[cand]);
      const actCol = lineColReversed ? getLine(index) : getCol(index);
      tmpSet.and(colTemplates[actCol]);
      if (tmpSet.size() !== 2) continue;
      // conjugate pair found
      let index2 = tmpSet.get(0);
      if (index2 === index) index2 = tmpSet.get(1);
      // does a candidate in the line of index2 see the column of the ER?
      const actLine = lineColReversed ? getCol(index2) : getLine(index2);
      tmpSet.set(candidates[cand]);
      tmpSet.and(lineTemplates[actLine]);
      for (let j = 0; j < tmpSet.size(); j++) {
        const indexDel = tmpSet.get(j);
        if (getBlock(indexDel) === block) continue; // cannot eliminate an ER candidate
        const colDel = lineColReversed ? getLine(indexDel) : getCol(indexDel);
        if (colDel === firstCol) {
          // elimination found!
          const step = new SolutionStep('EMPTY_RECTANGLE');
          step.entity = 0; // BLOCK
          step.entityNumber = block + 1;
          step.addValue(cand);
          step.addIndex(index);
          step.addIndex(index2);
          for (const k of blockCands) step.addFin(k, cand);
          step.addCandidateToDelete(indexDel, cand);
          if (onlyOne) return step;
          this.steps.push(step);
          break; // only one elimination per conjugate pair
        }
      }
    }
    return null;
  }

  /**
   * Skyscraper in the lines (`lines`) or the columns. Two calls are needed to
   * get all possible steps: two units with exactly two candidates each,
   * one end of each in the same column (row), the free ends not in the same
   * unit (that would be an X-Wing), and a candidate seen by both free ends.
   */
  private findSkyscraper(lines: boolean, onlyOne: boolean): SolutionStep | null {
    const cStart = lines ? 0 : 9;
    const cEnd = lines ? 9 : 18;
    const free = this.sudoku.free;
    const only2Indices = this.only2Indices;
    for (let cand = 1; cand <= 9; cand++) {
      // all units with only two candidates and the indices of the cells
      let constrCount = 0;
      for (let constr = cStart; constr < cEnd; constr++) {
        if (free[constr][cand] === 2) {
          let candIndex = 0;
          for (const idx of ALL_UNITS[constr]) {
            if (this.sudoku.isCandidate(idx, cand)) {
              only2Indices[constrCount][candIndex++] = idx;
              if (candIndex >= 2) break;
            }
          }
          constrCount++;
        }
      }
      // all combinations of those units
      for (let i = 0; i < constrCount; i++) {
        for (let j = i + 1; j < constrCount; j++) {
          // one end has to be in the same column (line)
          const sameUnit = lines ? getCol : getLine;
          let found = false;
          let otherIndex = 1;
          if (sameUnit(only2Indices[i][0]) === sameUnit(only2Indices[j][0])) {
            found = true;
          }
          if (!found && sameUnit(only2Indices[i][1]) === sameUnit(only2Indices[j][1])) {
            found = true;
            otherIndex = 0;
          }
          if (!found) continue; // invalid combination
          // the "free ends" must not be in the same unit or it would be an X-Wing
          if (sameUnit(only2Indices[i][otherIndex]) === sameUnit(only2Indices[j][otherIndex])) continue;
          // can something be eliminated?
          this.firstUnit.setAnd(this.finder.getCandidates()[cand], BUDDIES[only2Indices[i][otherIndex]]);
          this.firstUnit.and(BUDDIES[only2Indices[j][otherIndex]]);
          if (this.firstUnit.isEmpty()) continue;
          // Skyscraper found!
          const step = new SolutionStep('SKYSCRAPER');
          step.addValue(cand);
          if (otherIndex === 0) {
            step.addIndex(only2Indices[i][0]);
            step.addIndex(only2Indices[j][0]);
            step.addIndex(only2Indices[i][1]);
            step.addIndex(only2Indices[j][1]);
          } else {
            step.addIndex(only2Indices[i][1]);
            step.addIndex(only2Indices[j][1]);
            step.addIndex(only2Indices[i][0]);
            step.addIndex(only2Indices[j][0]);
          }
          for (const k of this.firstUnit) step.addCandidateToDelete(k, cand);
          if (onlyOne) return step;
          this.steps.push(step);
        }
      }
    }
    return null;
  }

  /**
   * 2-String Kite: a strong link in a line and one in a column, connected by a
   * block; a candidate that sees both free ends can be eliminated. The
   * `only2Indices` rows are swapped in place while searching, exactly like in
   * the original (later combinations see the swapped order).
   */
  private findTwoStringKite(onlyOne: boolean): SolutionStep | null {
    const free = this.sudoku.free;
    const only2Indices = this.only2Indices;
    for (let cand = 1; cand <= 9; cand++) {
      // all lines are in only2Indices[0 .. constr1Count - 1], all columns follow
      let constr1Count = 0;
      let constr2Count = 0;
      for (let constr = 0; constr < 18; constr++) {
        if (free[constr][cand] === 2) {
          let candIndex = 0;
          for (const idx of ALL_UNITS[constr]) {
            if (this.sudoku.isCandidate(idx, cand)) {
              only2Indices[constr1Count + constr2Count][candIndex++] = idx;
              if (candIndex >= 2) break;
            }
          }
          if (constr < 9) constr1Count++;
          else constr2Count++;
        }
      }
      for (let i = 0; i < constr1Count; i++) {
        for (let j = constr1Count; j < constr1Count + constr2Count; j++) {
          const a = only2Indices[i];
          const b = only2Indices[j];
          // the cells in the connecting block end up in [0], the free ends in [1]
          if (getBlock(a[0]) === getBlock(b[0])) {
            // everything is as it should be
          } else if (getBlock(a[0]) === getBlock(b[1])) {
            [b[0], b[1]] = [b[1], b[0]];
          } else if (getBlock(a[1]) === getBlock(b[0])) {
            [a[0], a[1]] = [a[1], a[0]];
          } else if (getBlock(a[1]) === getBlock(b[1])) {
            [b[0], b[1]] = [b[1], b[0]];
            [a[0], a[1]] = [a[1], a[0]];
          } else {
            continue; // nothing found
          }
          // the cells within the connecting block could be the same -> not a 2-String Kite
          if (a[0] === b[0] || a[0] === b[1] || a[1] === b[0] || a[1] === b[1]) continue;
          // two strong links connected in a block; can anything be deleted?
          const crossIndex = getIndex(getLine(b[1]), getCol(a[1]));
          if (this.sudoku.isCandidate(crossIndex, cand)) {
            const step = new SolutionStep('TWO_STRING_KITE');
            step.addValue(cand);
            step.addIndex(a[1]);
            step.addIndex(b[1]);
            step.addIndex(a[0]);
            step.addIndex(b[0]);
            step.addCandidateToDelete(crossIndex, cand);
            // the candidates in the connecting block are fins (painted in a different color)
            step.addFin(a[0], cand);
            step.addFin(b[0], cand);
            if (onlyOne) return step;
            this.steps.push(step);
          }
        }
      }
    }
    return null;
  }
}

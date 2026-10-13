/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's UniquenessSolver (Java).
 */
import { SolutionStep } from '../solutionStep.js';
import type { SolutionType } from '../solutionType.js';
import { SudokuSet } from '../sudokuSet.js';
import {
  ALL_UNITS,
  ANZ_VALUES,
  BLOCK,
  BLOCKS,
  BUDDIES,
  CAND_FROM_MASK,
  COL,
  COLS,
  COL_TEMPLATES,
  CONSTRAINTS,
  LENGTH,
  LINE,
  LINES,
  LINE_TEMPLATES,
  MASKS,
  POSSIBLE_VALUES,
  getBlock,
  getCol,
  getIndex,
  getLine,
} from '../tables.js';
import { AbstractSolver } from './abstractSolver.js';
import type { SudokuStepFinder } from './stepFinder.js';

type Units = readonly number[];

/**
 * Uniqueness Tests 1-6, Hidden Rectangle, Avoidable Rectangles 1-2 and BUG+1.
 *
 * Like the original, found-but-unused steps are cached while the sudoku does
 * not change, and already checked rectangles are remembered, so that a search
 * for a later technique type does not repeat the work.
 */
export class UniquenessSolver extends AbstractSolver {
  private readonly bugConstraints = [-1, -1, -1];
  /** All already checked rectangles: one number per rectangle built from the sorted corner indices. */
  private readonly rectangles: number[] = [];
  private static readonly MAX_RECTANGLES = 400;
  /** The indices of the current rectangle */
  private readonly indexe = [0, 0, 0, 0];
  private readonly tmpRect = [0, 0, 0, 0];
  /** The two candidates of the UR (kept between calls like in the original) */
  private cand1 = 0;
  private cand2 = 0;
  private cachedSteps: SolutionStep[] = [];
  /** finder.stepNumber under which the cached steps were found */
  private stepNumber = -1;
  /** cells of the UR that hold only cand1 and/or cand2 */
  private readonly twoCandidates = new SudokuSet();
  /** cells of the UR that hold additional candidates */
  private readonly additionalCandidates = new SudokuSet();
  private readonly tmpSet = new SudokuSet();
  private readonly tmpSet1 = new SudokuSet();
  private lastSearchWasUR = false;
  private lastSearchWasAR = false;

  constructor(finder: SudokuStepFinder) {
    super(finder);
  }

  getStep(type: SolutionType): SolutionStep | null {
    this.sudoku = this.finder.getSudoku();
    // Uniqueness only works for sudokus that are strictly valid
    if (this.sudoku.status !== 'VALID') return null;
    switch (type) {
      case 'UNIQUENESS_1':
      case 'UNIQUENESS_2':
      case 'UNIQUENESS_3':
      case 'UNIQUENESS_4':
      case 'UNIQUENESS_5':
      case 'UNIQUENESS_6':
      case 'HIDDEN_RECTANGLE':
        return this.getUniqueness(type);
      case 'AVOIDABLE_RECTANGLE_1':
      case 'AVOIDABLE_RECTANGLE_2':
        // only if the givens themselves have exactly one solution
        if (this.sudoku.statusGivens !== 'VALID') return null;
        return this.getAvoidableRectangle(type);
      case 'BUG_PLUS_1':
        return this.getBugPlus1();
      default:
        return null;
    }
  }

  doStep(step: SolutionStep): boolean {
    this.sudoku = this.finder.getSudoku();
    switch (step.type) {
      case 'UNIQUENESS_1':
      case 'UNIQUENESS_2':
      case 'UNIQUENESS_3':
      case 'UNIQUENESS_4':
      case 'UNIQUENESS_5':
      case 'UNIQUENESS_6':
      case 'HIDDEN_RECTANGLE':
      case 'AVOIDABLE_RECTANGLE_1':
      case 'AVOIDABLE_RECTANGLE_2':
      case 'BUG_PLUS_1':
        for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
        return true;
      default:
        return false;
    }
  }

  /**
   * Try to get a step of `type` from the cache. If none is available, or the
   * sudoku has changed since the last call, search again. If nothing is found
   * but the sudoku has not changed, the already checked rectangles are not
   * reset (a step in them would have been cached).
   */
  private getUniqueness(type: SolutionType): SolutionStep | null {
    if (this.finder.getStepNumber() === this.stepNumber && this.lastSearchWasUR) {
      const cached = this.cachedSteps.find((s) => s.type === type);
      if (cached) return cached;
    } else {
      this.stepNumber = this.finder.getStepNumber();
      this.cachedSteps = [];
      this.rectangles.length = 0;
    }
    this.lastSearchWasUR = true;
    this.lastSearchWasAR = false;
    return this.getAllUniquenessInternal(type);
  }

  /** Like {@link getUniqueness}, for Avoidable Rectangles. */
  private getAvoidableRectangle(type: SolutionType): SolutionStep | null {
    if (this.finder.getStepNumber() === this.stepNumber && this.lastSearchWasAR) {
      const cached = this.cachedSteps.find((s) => s.type === type);
      if (cached) return cached;
    } else {
      this.stepNumber = this.finder.getStepNumber();
      this.cachedSteps = [];
      this.rectangles.length = 0;
    }
    this.lastSearchWasUR = false;
    this.lastSearchWasAR = true;
    return this.getAllAvoidableRectangles(type);
  }

  /** The first Avoidable Rectangle found, starting from solved cells that are not givens. */
  private getAllAvoidableRectangles(type: SolutionType): SolutionStep | null {
    for (let i = 0; i < LENGTH; i++) {
      if (this.sudoku.getValue(i) === 0 || this.sudoku.isFixed(i)) continue; // not solved, or a given
      this.cand1 = this.sudoku.getValue(i);
      let step = this.findUniquenessForStartCell(i, true, type);
      if (step !== null) return step;
      // the original searches twice with identical parameters; the second search can still
      // find something because cand2 and the checked rectangles have changed in the meantime
      step = this.findUniquenessForStartCell(i, true, type);
      if (step !== null) return step;
    }
    return null;
  }

  /** All bivalue cells are starting points for a search. */
  private getAllUniquenessInternal(type: SolutionType): SolutionStep | null {
    for (let i = 0; i < LENGTH; i++) {
      if (this.sudoku.getAnzCandidates(i) === 2) {
        const cands = this.sudoku.getAllCandidates(i);
        this.cand1 = cands[0];
        this.cand2 = cands[1];
        const step = this.findUniquenessForStartCell(i, false, type);
        if (step !== null) return step;
      }
    }
    return null;
  }

  /**
   * BUG+1: only one cell has three candidates, all others have two. All
   * candidates appear in all units exactly twice, except one of the
   * candidates in the cell with three candidates.
   */
  private getBugPlus1(): SolutionStep | null {
    const sudoku = this.sudoku;
    let index3 = -1;
    for (let i = 0; i < LENGTH; i++) {
      const anz = sudoku.getAnzCandidates(i);
      if (anz > 3) return null; // no BUG+1
      if (anz === 3) {
        if (index3 !== -1) return null; // second cell with three candidates
        index3 = i;
      }
    }
    if (index3 === -1) return null;
    // all cells have two candidates except index3 -> check the units
    let cand3 = -1;
    const bugConstraints = this.bugConstraints;
    bugConstraints[0] = bugConstraints[1] = bugConstraints[2] = -1;
    const free = sudoku.free;
    for (let constr = 0; constr < free.length; constr++) {
      for (let cand = 1; cand <= 9; cand++) {
        const anz = free[constr][cand];
        if (anz > 3) return null;
        if (anz === 3) {
          // must be for the same candidate and only once per type of unit
          if (bugConstraints[Math.floor(constr / 9)] !== -1 || (cand3 !== -1 && cand3 !== cand)) return null;
          cand3 = cand;
          bugConstraints[Math.floor(constr / 9)] = constr;
        }
      }
    }
    if (
      sudoku.isCandidate(index3, cand3) &&
      CONSTRAINTS[index3][0] === bugConstraints[0] &&
      CONSTRAINTS[index3][1] === bugConstraints[1] &&
      CONSTRAINTS[index3][2] === bugConstraints[2]
    ) {
      const step = new SolutionStep('BUG_PLUS_1');
      for (const c of sudoku.getAllCandidates(index3)) {
        if (c !== cand3) step.addCandidateToDelete(index3, c);
      }
      return step;
    }
    return null;
  }

  /**
   * Starting at a cell: find a second cell in the same block (and the same line
   * or column) with the same two candidates, then the opposite two cells in
   * another block. For Avoidable Rectangles `index11`/`index12` are solved cells
   * (not givens) that designate the candidates; the opposite side needs at
   * least one unsolved cell.
   */
  private findUniquenessForStartCell(index11: number, avoidable: boolean, type: SolutionType): SolutionStep | null {
    const sudoku = this.sudoku;
    const allowMissing = this.finder.options.allowUniquenessMissingCandidates;
    const line11 = getLine(index11);
    const col11 = getCol(index11);
    const block11 = getBlock(index11);
    const cell11 = sudoku.getCell(index11);
    // the original reads the allowed sets before cand2 is updated for avoidable rectangles
    const allowedCand1 = this.finder.getCandidatesAllowed()[this.cand1];
    const allowedCand2 = this.finder.getCandidatesAllowed()[this.cand2];
    for (const index12 of BLOCKS[block11]) {
      if (index12 === index11) continue;
      if (line11 !== getLine(index12) && col11 !== getCol(index12)) continue; // cannot become a rectangle
      const cell12 = sudoku.getCell(index12);
      if (
        (!avoidable &&
          sudoku.getValue(index12) === 0 &&
          ((!allowMissing && (cell11 & cell12) === cell11) ||
            (allowMissing && allowedCand1.contains(index12) && allowedCand2.contains(index12)))) ||
        (avoidable && sudoku.getValue(index12) !== 0 && !sudoku.isFixed(index12))
      ) {
        if (avoidable) this.cand2 = sudoku.getValue(index12);
        // possible second endpoint: check for rectangles
        const isLines = line11 === getLine(index12);
        // the units that have to hold the opposite side of the rectangle
        const unit11 = ALL_UNITS[isLines ? getCol(index11) + 9 : getLine(index11)];
        const unit12 = ALL_UNITS[isLines ? getCol(index12) + 9 : getLine(index12)];
        // two adequate cells at the same positions in a different block
        for (let j = 0; j < unit11.length; j++) {
          if (getBlock(unit11[j]) === block11) continue; // must be another block
          const index21 = unit11[j];
          const index22 = unit12[j];
          const cell21 = sudoku.getCell(index21);
          const cell22 = sudoku.getCell(index22);
          const { cand1, cand2 } = this;
          if (
            (!avoidable && !allowMissing && (cell21 & cell11) === cell11 && (cell22 & cell11) === cell11) ||
            (allowMissing &&
              allowedCand1.contains(index21) &&
              allowedCand1.contains(index22) &&
              allowedCand2.contains(index22) &&
              allowedCand2.contains(index22)) ||
            (avoidable &&
              ((sudoku.getValue(index21) === cand2 &&
                !sudoku.isFixed(index21) &&
                sudoku.getValue(index22) === 0 &&
                sudoku.isCandidate(index22, cand1) &&
                sudoku.getAnzCandidates(index22) === 2) ||
                (sudoku.getValue(index22) === cand1 &&
                  !sudoku.isFixed(index22) &&
                  sudoku.getValue(index21) === 0 &&
                  sudoku.isCandidate(index21, cand2) &&
                  sudoku.getAnzCandidates(index21) === 2) ||
                (sudoku.getValue(index21) === 0 &&
                  sudoku.isCandidate(index21, cand2) &&
                  sudoku.getAnzCandidates(index21) === 2 &&
                  sudoku.getValue(index22) === 0 &&
                  sudoku.isCandidate(index22, cand1) &&
                  sudoku.getAnzCandidates(index22) === 2)))
          ) {
            // could be a UR: did we have it already?
            if (this.checkRect(index11, index12, index21, index22)) {
              this.indexe[0] = index11;
              this.indexe[1] = index12;
              this.indexe[2] = index21;
              this.indexe[3] = index22;
              const step = avoidable
                ? this.checkAvoidableRectangle(index21, index22, type)
                : this.checkURForStep(type);
              if (step !== null) return step;
            }
          }
        }
      }
    }
    return null;
  }

  /** Use `step` as result if it is of the searched type, otherwise remember it for later. */
  private offer(step: SolutionStep, searchType: SolutionType): SolutionStep | null {
    if (searchType === step.type) return step;
    this.cachedSteps.push(step);
    return null;
  }

  /**
   * Check the UR in `indexe` for all UR types at once. A step of the searched
   * type is returned immediately; steps of other types are cached.
   */
  private checkURForStep(searchType: SolutionType): SolutionStep | null {
    const sudoku = this.sudoku;
    const { cand1, cand2 } = this;
    const twoCandidates = this.twoCandidates;
    const additionalCandidates = this.additionalCandidates;
    const tmpSet = this.tmpSet;
    const tmpSet1 = this.tmpSet1;
    this.initCheck(this.indexe);

    const twoSize = twoCandidates.size();
    const urMask = MASKS[cand1] | MASKS[cand2];

    // Uniqueness Test 1: 3 cells have only 2 candidates -> delete cand1 and cand2 from the fourth cell
    if (twoSize === 3) {
      const step = this.initStep('UNIQUENESS_1');
      const delIndex = additionalCandidates.get(0);
      if (sudoku.isCandidate(delIndex, cand1)) step.addCandidateToDelete(delIndex, cand1);
      if (sudoku.isCandidate(delIndex, cand2)) step.addCandidateToDelete(delIndex, cand2);
      if (step.candidatesToDelete.length > 0) {
        const result = this.offer(step, searchType);
        if (result !== null) return result;
      }
    }

    // Uniqueness Test 2/5: one or two cells have 2 candidates, the others have exactly one additional
    // candidate that is the same in all cells: it can be deleted from all cells that see all UR cells
    // with that candidate. With only two additional-candidate cells in one line/column it is a UR 2,
    // else a UR 5.
    if (twoSize === 2 || twoSize === 1) {
      let addMask = 0;
      tmpSet.setAll();
      for (let i = 0; i < additionalCandidates.size(); i++) {
        const index3 = additionalCandidates.get(i);
        addMask |= sudoku.getCell(index3) & ~urMask;
        if (ANZ_VALUES[addMask] > 1) break;
        tmpSet.and(BUDDIES[index3]);
      }
      if (ANZ_VALUES[addMask] === 1) {
        const addCand = CAND_FROM_MASK[addMask];
        tmpSet.and(this.finder.getCandidates()[addCand]);
        if (!tmpSet.isEmpty()) {
          let type: SolutionType = 'UNIQUENESS_2';
          const i1 = additionalCandidates.get(0);
          const i2 = additionalCandidates.get(1);
          if (additionalCandidates.size() === 3 || (getLine(i1) !== getLine(i2) && getCol(i1) !== getCol(i2))) {
            type = 'UNIQUENESS_5';
          }
          const step = this.initStep(type);
          for (const c of tmpSet) step.addCandidateToDelete(c, addCand);
          const result = this.offer(step, searchType);
          if (result !== null) return result;
        }
      }
    }

    // Uniqueness Test 3: two UR cells have additional candidates; find in one of their houses
    // (k - 1) more cells so that all cells together contain exactly k candidates (cand1 and
    // cand2 may not appear in these cells). The k candidates can be deleted from all other cells.
    if (twoSize === 2) {
      let u3Cands = 0;
      for (let i = 0; i < additionalCandidates.size(); i++) {
        u3Cands |= this.sudoku.getCell(additionalCandidates.get(i)) & ~urMask;
      }
      const i1 = additionalCandidates.get(0);
      const i2 = additionalCandidates.get(1);
      if (getLine(i1) === getLine(i2)) {
        const step = this.checkUniqueness3(LINE, LINES[getLine(i1)], u3Cands, urMask, searchType);
        if (step !== null) return step;
      }
      if (getCol(i1) === getCol(i2)) {
        const step = this.checkUniqueness3(COL, COLS[getCol(i1)], u3Cands, urMask, searchType);
        if (step !== null) return step;
      }
      if (getBlock(i1) === getBlock(i2)) {
        const step = this.checkUniqueness3(BLOCK, BLOCKS[getBlock(i1)], u3Cands, urMask, searchType);
        if (step !== null) return step;
      }
    }

    // Uniqueness Test 4: two cells with additional candidates (in one line or column); in all cells
    // seen by both cells one of the UR candidates is missing -> the other one can be eliminated
    // from the cells with the additional candidates.
    if (twoSize === 2) {
      const i1 = additionalCandidates.get(0);
      const i2 = additionalCandidates.get(1);
      if (getLine(i1) === getLine(i2) || getCol(i1) === getCol(i2)) {
        tmpSet.setAnd(BUDDIES[i1], BUDDIES[i2]);
        let delCand = -1;
        tmpSet1.setAnd(tmpSet, this.finder.getCandidates()[cand1]);
        if (tmpSet1.isEmpty()) {
          delCand = cand2;
        } else {
          tmpSet1.setAnd(tmpSet, this.finder.getCandidates()[cand2]);
          if (tmpSet1.isEmpty()) delCand = cand1;
        }
        if (delCand !== -1) {
          const step = this.initStep('UNIQUENESS_4');
          if (sudoku.isCandidate(i1, delCand)) step.addCandidateToDelete(i1, delCand);
          if (sudoku.isCandidate(i2, delCand)) step.addCandidateToDelete(i2, delCand);
          if (step.candidatesToDelete.length > 0) {
            const result = this.offer(step, searchType);
            if (result !== null) return result;
          }
        }
      }
    }

    // Uniqueness Test 6: two cells with additional candidates located diagonally; if in both lines
    // and columns none of the other cells contain cand1 -> cand1 can be deleted from the diagonal cells
    if (twoSize === 2) {
      const i1 = additionalCandidates.get(0);
      const i2 = additionalCandidates.get(1);
      if (getLine(i1) !== getLine(i2) && getCol(i1) !== getCol(i2)) {
        // all cells in both lines and columns, without the UR itself
        tmpSet.set(LINE_TEMPLATES[getLine(i1)]);
        tmpSet.or(COL_TEMPLATES[getCol(i1)]);
        tmpSet.or(LINE_TEMPLATES[getLine(i2)]);
        tmpSet.or(COL_TEMPLATES[getCol(i2)]);
        tmpSet.andNot(additionalCandidates);
        tmpSet.andNot(twoCandidates);
        let delCand = -1;
        tmpSet1.setAnd(tmpSet, this.finder.getCandidates()[cand1]);
        if (tmpSet1.isEmpty()) {
          delCand = cand1;
        } else {
          tmpSet1.setAnd(tmpSet, this.finder.getCandidates()[cand2]);
          if (tmpSet1.isEmpty()) delCand = cand2;
        }
        if (delCand !== -1) {
          const step = this.initStep('UNIQUENESS_6');
          if (sudoku.isCandidate(i1, delCand)) step.addCandidateToDelete(i1, delCand);
          if (sudoku.isCandidate(i2, delCand)) step.addCandidateToDelete(i2, delCand);
          if (step.candidatesToDelete.length > 0) {
            const result = this.offer(step, searchType);
            if (result !== null) return result;
          }
        }
      }
    }

    // Hidden Rectangle: one or two cells contain only the two UR candidates (if two they must be
    // diagonal); one of them is the corner. If the line and the column through the other three cells
    // each contain only two occurrences of one UR candidate, the other UR candidate can be deleted.
    if (twoSize === 2 || twoSize === 1) {
      const i1 = twoCandidates.get(0);
      const i2 = twoCandidates.get(1);
      let doCheck = true;
      if (twoSize === 2) {
        // must be diagonal -> not in the same line or column
        if (getLine(i1) === getLine(i2) || getCol(i1) === getCol(i2)) doCheck = false;
      }
      if (doCheck) {
        let step = this.checkHiddenRectangle(i1, searchType);
        if (step !== null) return step;
        if (twoCandidates.size() === 2) {
          step = this.checkHiddenRectangle(i2, searchType);
          if (step !== null) return step;
        }
      }
    }
    return null;
  }

  /**
   * Avoidable Rectangle: if only one of cell21/cell22 is unsolved, cand1/cand2
   * can be deleted from it. If both are unsolved, cell21 must contain cand2,
   * cell22 must contain cand1 and both need the same additional candidate;
   * that candidate can be deleted from all cells that see both.
   */
  private checkAvoidableRectangle(index21: number, index22: number, type: SolutionType): SolutionStep | null {
    const sudoku = this.sudoku;
    const { cand1, cand2 } = this;
    if (sudoku.getValue(index21) !== 0 || sudoku.getValue(index22) !== 0) {
      // first type: cand1/cand2 can be deleted
      const step = this.initStep('AVOIDABLE_RECTANGLE_1');
      if (sudoku.getValue(index21) !== 0) {
        if (sudoku.isCandidate(index22, cand1)) step.addCandidateToDelete(index22, cand1);
      } else if (sudoku.isCandidate(index21, cand2)) {
        step.addCandidateToDelete(index21, cand2);
      }
      if (step.candidatesToDelete.length > 0) {
        if (type === 'AVOIDABLE_RECTANGLE_1') return step;
        this.cachedSteps.push(step);
      }
    } else {
      // the additional candidate in index21 and index22 has to be the same
      const cands = sudoku.getAllCandidates(index21);
      let additionalCand = cands[0];
      if (additionalCand === cand2) additionalCand = cands[1];
      if (!sudoku.isCandidate(index22, additionalCand)) return null; // wrong candidate
      const tmpSet = this.tmpSet;
      tmpSet.set(BUDDIES[index21]);
      tmpSet.and(BUDDIES[index22]);
      tmpSet.and(this.finder.getCandidates()[additionalCand]);
      if (tmpSet.isEmpty()) return null; // no eliminations possible
      const step = this.initStep('AVOIDABLE_RECTANGLE_2');
      for (const c of tmpSet) step.addCandidateToDelete(c, additionalCand);
      step.addEndoFin(index21, additionalCand);
      step.addEndoFin(index22, additionalCand);
      if (type === 'AVOIDABLE_RECTANGLE_2') return step;
      this.cachedSteps.push(step);
    }
    return null;
  }

  private checkHiddenRectangle(cornerIndex: number, type: SolutionType): SolutionStep | null {
    // whether there are one or two cells with two candidates, checking two additional
    // cells is enough to get the line and column that have to be checked
    const lineC = getLine(cornerIndex);
    const colC = getCol(cornerIndex);
    const i1 = this.additionalCandidates.get(0);
    const i2 = this.additionalCandidates.get(1);
    let line1 = getLine(i1);
    if (line1 === lineC) line1 = getLine(i2);
    let col1 = getCol(i1);
    if (col1 === colC) col1 = getCol(i2);
    const { cand1, cand2 } = this;
    return (
      this.checkCandForHiddenRectangle(line1, col1, cand1, cand2, type) ??
      this.checkCandForHiddenRectangle(line1, col1, cand2, cand1, type)
    );
  }

  /**
   * In line `line` and column `col` the candidate `cand1` may appear only in the UR cells.
   * Then `cand2` can be deleted from the cell at the intersection of line and column.
   */
  private checkCandForHiddenRectangle(
    line: number,
    col: number,
    cand1: number,
    cand2: number,
    type: SolutionType,
  ): SolutionStep | null {
    const { tmpSet, tmpSet1 } = this;
    tmpSet1.setOr(this.twoCandidates, this.additionalCandidates);
    tmpSet.set(this.finder.getCandidates()[cand1]);
    tmpSet.and(LINE_TEMPLATES[line]);
    tmpSet.andNot(tmpSet1);
    if (!tmpSet.isEmpty()) return null;
    tmpSet.set(this.finder.getCandidates()[cand1]);
    tmpSet.and(COL_TEMPLATES[col]);
    tmpSet.andNot(tmpSet1);
    if (!tmpSet.isEmpty()) return null;
    // hidden rectangle: delete cand2 from the cell at the intersection
    const delIndex = getIndex(line, col);
    const step = this.initStep('HIDDEN_RECTANGLE');
    if (this.sudoku.isCandidate(delIndex, cand2)) step.addCandidateToDelete(delIndex, cand2);
    if (step.candidatesToDelete.length > 0) return this.offer(step, type);
    return null;
  }

  /** Collect all cells to be checked for UR 3 and call the recursive check. */
  private checkUniqueness3(
    unitType: number,
    unit: Units,
    u3Cands: number,
    urMask: number,
    searchType: SolutionType,
  ): SolutionStep | null {
    const u3Indices = new SudokuSet();
    const tmpSet = this.tmpSet;
    tmpSet.set(this.twoCandidates);
    tmpSet.or(this.additionalCandidates);
    for (const idx of unit) {
      // a cell has to be checked if it is unsolved, not part of the UR and holds neither cand1 nor cand2
      const cell = this.sudoku.getCell(idx);
      if (cell !== 0 && (cell & urMask) === 0 && !tmpSet.contains(idx)) u3Indices.add(idx);
    }
    // the additional cells have to be in the set always
    if (!u3Indices.isEmpty()) {
      return this.checkUniqueness3Recursive(
        unitType,
        unit,
        u3Indices,
        u3Cands,
        new SudokuSet(this.additionalCandidates),
        0,
        searchType,
      );
    }
    return null;
  }

  private checkUniqueness3Recursive(
    type: number,
    unit: Units,
    u3Indices: SudokuSet,
    candsIncluded: number,
    indicesIncluded: SudokuSet,
    startIndex: number,
    searchType: SolutionType,
  ): SolutionStep | null {
    const sudoku = this.sudoku;
    for (let i = startIndex; i < u3Indices.size(); i++) {
      let aktCands = candsIncluded;
      const aktIndices = indicesIncluded.clone();
      aktIndices.add(u3Indices.get(i));
      // collect all additional candidates
      aktCands |= sudoku.getCell(u3Indices.get(i));
      // searching a block: a check is only made if the cells are not all in the same
      // line or column (in that case the step has already been checked)
      if (type !== BLOCK || !this.isSameLineOrCol(aktIndices)) {
        // k candidates in k - 1 + 1 cells -> UR 3: check if candidates can be deleted
        if (ANZ_VALUES[aktCands] === aktIndices.size() - 1) {
          // candidates can be deleted in all cells of the unit that are not in aktIndices
          const step = this.initStep('UNIQUENESS_3');
          for (const u of unit) {
            if (sudoku.getValue(u) === 0 && !aktIndices.contains(u)) {
              const delCands = sudoku.getCell(u) & aktCands;
              if (ANZ_VALUES[delCands] === 0) continue;
              for (const c of POSSIBLE_VALUES[delCands]) step.addCandidateToDelete(u, c);
            }
          }
          if (step.candidatesToDelete.length > 0) {
            // the candidates of the naked subset are written as fins (display only)
            for (const cTmp of POSSIBLE_VALUES[aktCands]) {
              for (let l = 0; l < aktIndices.size(); l++) {
                if (sudoku.isCandidate(aktIndices.get(l), cTmp)) step.addFin(aktIndices.get(l), cTmp);
              }
            }
            if (type === LINE || type === COL) {
              // could be a Locked Subset
              const block = this.getBlockForCheck3(aktIndices);
              if (block !== -1) {
                for (const u of BLOCKS[block]) {
                  if (sudoku.getValue(u) === 0 && !aktIndices.contains(u)) {
                    const delCands = sudoku.getCell(u) & aktCands;
                    if (ANZ_VALUES[delCands] === 0) continue;
                    for (const c of POSSIBLE_VALUES[delCands]) step.addCandidateToDelete(u, c);
                  }
                }
              }
            }
            const result = this.offer(step, searchType);
            if (result !== null) return result;
          }
        }
      }
      // on to the next level
      const step = this.checkUniqueness3Recursive(type, unit, u3Indices, aktCands, aktIndices, i + 1, searchType);
      if (step !== null) return step;
    }
    return null;
  }

  /** If all cells belong to the same block, return that block, otherwise -1. */
  private getBlockForCheck3(aktIndices: SudokuSet): number {
    if (aktIndices.isEmpty()) return -1;
    const block = getBlock(aktIndices.get(0));
    for (let i = 1; i < aktIndices.size(); i++) {
      if (getBlock(aktIndices.get(i)) !== block) return -1;
    }
    return block;
  }

  /** true if all cells are in the same line or the same column. */
  private isSameLineOrCol(aktIndices: SudokuSet): boolean {
    if (aktIndices.isEmpty()) return false;
    let sameLine = true;
    let sameCol = true;
    const line = getLine(aktIndices.get(0));
    const col = getCol(aktIndices.get(0));
    for (let i = 1; i < aktIndices.size(); i++) {
      if (getLine(aktIndices.get(i)) !== line) sameLine = false;
      if (getCol(aktIndices.get(i)) !== col) sameCol = false;
    }
    return sameLine || sameCol;
  }

  /** A new step for the current UR: values are the two UR candidates, indices the four corners. */
  private initStep(type: SolutionType): SolutionStep {
    const step = new SolutionStep(type);
    step.addValue(this.cand1);
    step.addValue(this.cand2);
    for (const idx of this.indexe) step.addIndex(idx);
    return step;
  }

  /** Collect the cells that hold only cand1/cand2 and the cells with additional candidates. */
  private initCheck(indices: readonly number[]): void {
    this.twoCandidates.clear();
    this.additionalCandidates.clear();
    const mask = ~(MASKS[this.cand1] | MASKS[this.cand2]);
    for (const idx of indices) {
      if ((this.sudoku.getCell(idx) & mask) === 0) this.twoCandidates.add(idx);
      else this.additionalCandidates.add(idx);
    }
  }

  /**
   * Is the UR formed by the four indices new? If the buffer for checked
   * rectangles is full, the UR is treated as if it were new.
   */
  private checkRect(i11: number, i12: number, i21: number, i22: number): boolean {
    const tmpRect = this.tmpRect;
    tmpRect[0] = i11;
    tmpRect[1] = i12;
    tmpRect[2] = i21;
    tmpRect[3] = i22;
    tmpRect.sort((a, b) => a - b);
    const rect = (((tmpRect[0] * 10 + tmpRect[1]) * 10 + tmpRect[2]) * 10 + tmpRect[3]);
    if (this.rectangles.includes(rect)) return false; // already checked
    if (this.rectangles.length < UniquenessSolver.MAX_RECTANGLES) this.rectangles.push(rect);
    return true;
  }
}

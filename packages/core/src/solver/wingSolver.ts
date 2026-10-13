/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's WingSolver (Java).
 */
import { SolutionStep } from '../solutionStep.js';
import type { SolutionType } from '../solutionType.js';
import { SudokuSet } from '../sudokuSet.js';
import { ALL_UNITS, ANZ_VALUES, BUDDIES, CAND_FROM_MASK, LENGTH } from '../tables.js';
import { AbstractSolver } from './abstractSolver.js';
import type { SudokuStepFinder } from './stepFinder.js';

/** XY-Wing, XYZ-Wing and W-Wing. */
export class WingSolver extends AbstractSolver {
  private readonly preCalcSet1 = new SudokuSet();
  private readonly preCalcSet2 = new SudokuSet();
  private readonly elimSet = new SudokuSet();
  /** The indices of all bivalue cells (for XY-Wing) */
  private readonly biCells = new Array<number>(LENGTH).fill(0);
  /** The indices of all trivalue cells (for XYZ-Wing) */
  private readonly triCells = new Array<number>(LENGTH).fill(0);
  /** The two cells of the strong link of a W-Wing */
  private wIndex1 = -1;
  private wIndex2 = -1;

  constructor(finder: SudokuStepFinder) {
    super(finder);
  }

  getStep(type: SolutionType): SolutionStep | null {
    this.sudoku = this.finder.getSudoku();
    switch (type) {
      case 'XY_WING':
        return this.getWing(false);
      case 'XYZ_WING':
        return this.getWing(true);
      case 'W_WING':
        return this.getWWing();
      default:
        return null;
    }
  }

  doStep(step: SolutionStep): boolean {
    this.sudoku = this.finder.getSudoku();
    switch (step.type) {
      case 'XY_WING':
      case 'W_WING':
      case 'XYZ_WING':
        for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
        return true;
      default:
        return false;
    }
  }

  /**
   * Try all combinations of three bivalue cells (for XYZ: one trivalue and two
   * bivalue cells). The three cells must have exactly three candidates
   * together; the first cell (pivot) must see both other cells (pincers); the
   * pincers must share exactly one candidate z. z can be eliminated from all
   * cells that see both pincers (for XYZ also the pivot).
   */
  private getWing(xyz: boolean): SolutionStep | null {
    const sudoku = this.sudoku;
    const biCells = this.biCells;
    const triCells = this.triCells;
    let biValueCount = 0;
    let triValueCount = 0;
    for (let i = 0; i < LENGTH; i++) {
      if (sudoku.getAnzCandidates(i) === 2) biCells[biValueCount++] = i;
      if (xyz && sudoku.getAnzCandidates(i) === 3) triCells[triValueCount++] = i;
    }
    // local variables cover XY and XYZ
    const endIndex = xyz ? triValueCount : biValueCount;
    const biTri = xyz ? triCells : biCells;
    for (let i = 0; i < endIndex; i++) {
      for (let j = xyz ? 0 : i + 1; j < biValueCount; j++) {
        // any combination of two cells must give exactly three candidates
        if (ANZ_VALUES[sudoku.getCell(biTri[i]) | sudoku.getCell(biCells[j])] !== 3) continue;
        for (let k = j + 1; k < biValueCount; k++) {
          let index1 = biTri[i];
          let index2 = biCells[j];
          let index3 = biCells[k];
          let cell1 = sudoku.getCell(index1);
          let cell2 = sudoku.getCell(index2);
          let cell3 = sudoku.getCell(index3);
          // all three cells combined must have exactly three candidates
          if (ANZ_VALUES[cell1 | cell2 | cell3] !== 3) continue;
          // none of the cells may be equal
          if (cell1 === cell2 || cell2 === cell3 || cell3 === cell1) continue;
          // XY-Wing: each cell could be the pivot; XYZ-Wing: only the first
          const maxTries = xyz ? 1 : 3;
          for (let tries = 0; tries < maxTries; tries++) {
            // swap cells accordingly
            if (tries === 1) {
              index1 = biCells[j];
              index2 = biTri[i];
              cell1 = sudoku.getCell(index1);
              cell2 = sudoku.getCell(index2);
            } else if (tries === 2) {
              index1 = biCells[k];
              index2 = biCells[j];
              index3 = biTri[i];
              cell1 = sudoku.getCell(index1);
              cell2 = sudoku.getCell(index2);
              cell3 = sudoku.getCell(index3);
            }
            // the pivot must see the pincers
            if (!BUDDIES[index1].contains(index2) || !BUDDIES[index1].contains(index3)) continue;
            // the pincers must share exactly one candidate
            const cell = cell2 & cell3;
            if (ANZ_VALUES[cell] !== 1) continue;
            const candZ = CAND_FROM_MASK[cell];
            // are there candidates that see the pincers?
            this.elimSet.setAnd(BUDDIES[index2], BUDDIES[index3]);
            this.elimSet.and(this.finder.getCandidates()[candZ]);
            if (xyz) this.elimSet.and(BUDDIES[index1]); // the pivot as well
            if (this.elimSet.isEmpty()) continue;
            // wing found!
            const step = new SolutionStep(xyz ? 'XYZ_WING' : 'XY_WING');
            const cands = sudoku.getAllCandidates(index1);
            step.addValue(cands[0]);
            step.addValue(cands[1]);
            step.addValue(xyz ? cands[2] : candZ);
            step.addIndex(index1);
            step.addIndex(index2);
            step.addIndex(index3);
            if (xyz) step.addFin(index1, candZ);
            step.addFin(index2, candZ);
            step.addFin(index3, candZ);
            for (const l of this.elimSet) step.addCandidateToDelete(l, candZ);
            return step;
          }
        }
      }
    }
    return null;
  }

  /**
   * W-Wing: two bivalue cells with the same candidates; if they could
   * eliminate something, a connecting strong link is searched for.
   */
  private getWWing(): SolutionStep | null {
    const sudoku = this.sudoku;
    const candidates = this.finder.getCandidates();
    for (let i = 0; i < LENGTH; i++) {
      if (sudoku.getValue(i) !== 0 || sudoku.getAnzCandidates(i) !== 2) continue;
      // bivalue cell found
      const cell1 = sudoku.getCell(i);
      const cand1 = sudoku.getAllCandidates(i)[0];
      const cand2 = sudoku.getAllCandidates(i)[1];
      // prepare for elimination checks
      this.preCalcSet1.setAnd(BUDDIES[i], candidates[cand1]);
      this.preCalcSet2.setAnd(BUDDIES[i], candidates[cand2]);
      // check all other cells
      for (let j = i + 1; j < LENGTH; j++) {
        if (sudoku.getCell(j) !== cell1) continue;
        // we have a pair; can anything be eliminated?
        this.elimSet.setAnd(this.preCalcSet1, BUDDIES[j]);
        if (!this.elimSet.isEmpty()) {
          const step = this.checkLink(cand1, cand2, i, j);
          if (step !== null) return step;
        }
        this.elimSet.setAnd(this.preCalcSet2, BUDDIES[j]);
        if (!this.elimSet.isEmpty()) {
          const step = this.checkLink(cand2, cand1, i, j);
          if (step !== null) return step;
        }
      }
    }
    return null;
  }

  /**
   * Search for a strong link for candidate `cand2` that connects `index1` and
   * `index2` (each end is seen by one of the bivalue cells).
   */
  private checkLink(cand1: number, cand2: number, index1: number, index2: number): SolutionStep | null {
    const sudoku = this.sudoku;
    const free = sudoku.free;
    for (let constr = 0; constr < free.length; constr++) {
      if (free[constr][cand2] !== 2) continue;
      // strong link; does it fit?
      let sees1 = false;
      let sees2 = false;
      for (const aktIndex of ALL_UNITS[constr]) {
        if (aktIndex !== index1 && aktIndex !== index2 && sudoku.isCandidate(aktIndex, cand2)) {
          // CAUTION: one cell of the strong link that sees both bivalue cells is not allowed
          if (BUDDIES[aktIndex].contains(index1)) {
            sees1 = true;
            this.wIndex1 = aktIndex;
          } else if (BUDDIES[aktIndex].contains(index2)) {
            sees2 = true;
            this.wIndex2 = aktIndex;
          }
        }
        if (sees1 && sees2) break;
      }
      if (sees1 && sees2) {
        // valid W-Wing: cand1 is eliminated, cand2 is the connecting candidate
        const step = new SolutionStep('W_WING');
        step.addValue(cand1);
        step.addValue(cand2);
        step.addIndex(index1);
        step.addIndex(index2);
        step.addFin(index1, cand2);
        step.addFin(index2, cand2);
        step.addFin(this.wIndex1, cand2);
        step.addFin(this.wIndex2, cand2);
        for (const e of this.elimSet) step.addCandidateToDelete(e, cand1);
        return step;
      }
    }
    return null;
  }
}

/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's MiscellaneousSolver (Java).
 */
import { Candidate, SolutionStep } from '../solutionStep.js';
import type { SolutionType } from '../solutionType.js';
import { SudokuSet } from '../sudokuSet.js';
import { ANZ_VALUES, BLOCK_TEMPLATES, COL_TEMPLATES, LINE_TEMPLATES, MAX_MASK, POSSIBLE_VALUES, UNITS } from '../tables.js';
import { AbstractSolver } from './abstractSolver.js';
import type { SudokuStepFinder } from './stepFinder.js';

/** One entry in the recursion stack for the unit search. */
class StackEntry {
  /** The index (into the source set) of the cell that is currently tried */
  aktIndex = 0;
  /** The cells in the current selection */
  indices = new SudokuSet();
  /** The candidates in the current selection */
  candidates = 0;
}

/**
 * Sue de Coq.
 *
 * Original description from the Player's Forum: consider the set of unfilled
 * cells C at the intersection of a box B and a row (or column) R, |C| >= 2, with
 * candidate set V, |V| >= |C| + 2. Find |V| - |C| cells in B and R (at least one in
 * each, outside C) with candidates drawn entirely from V, where the candidate
 * sets of the B cells and the R cells do not overlap. Then C must contain
 * V \ (VB u VR) plus |VB| - |CB| elements of VB and |VR| - |CR| elements of VR.
 * This allows eliminating V \ VR from B \ (C u CB) and V \ VB from R \ (C u CR).
 *
 * HoDoKu extends this: C need not contain all cells of the intersection, and VB/VR may
 * contain extra candidates if there is one extra cell per extra candidate.
 */
export class MiscellaneousSolver extends AbstractSolver {
  /** All unsolved cells in the current row/column */
  private readonly nonBlockSet = new SudokuSet();
  /** All unsolved cells in the current block */
  private readonly blockSet = new SudokuSet();
  /** All unsolved cells in the current intersection */
  private readonly intersectionSet = new SudokuSet();
  private readonly nonBlockSourceSet = new SudokuSet();
  private readonly blockSourceSet = new SudokuSet();
  private readonly stack1: StackEntry[] = Array.from({ length: UNITS }, () => new StackEntry());
  private readonly stack2: StackEntry[] = Array.from({ length: UNITS }, () => new StackEntry());
  /** Cells of the current subset of the intersection */
  private readonly intersectionActSet = new SudokuSet();
  /** Candidates of all cells in {@link intersectionActSet}. */
  private intersectionActCandSet = 0;
  /** The current additional cells in the row/column (references a stack entry, like in the original). */
  private nonBlockActSet = new SudokuSet();
  private nonBlockActCandSet = 0;
  private blockAllowedCandSet = 0;
  /** The current additional cells in the block (references a stack entry). */
  private blockActSet = new SudokuSet();
  private blockActCandSet = 0;
  private readonly tmpSet = new SudokuSet();
  /** The step that is being assembled. */
  private globalStep = new SolutionStep('SUE_DE_COQ');
  /** All steps found by a search for all steps */
  private steps: SolutionStep[] = [];

  constructor(finder: SudokuStepFinder) {
    super(finder);
  }

  getStep(type: SolutionType): SolutionStep | null {
    this.sudoku = this.finder.getSudoku();
    if (type === 'SUE_DE_COQ') {
      return this.getSueDeCoqInt(LINE_TEMPLATES, BLOCK_TEMPLATES, true) ?? this.getSueDeCoqInt(COL_TEMPLATES, BLOCK_TEMPLATES, true);
    }
    return null;
  }

  doStep(step: SolutionStep): boolean {
    this.sudoku = this.finder.getSudoku();
    if (step.type === 'SUE_DE_COQ') {
      for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
      return true;
    }
    return false;
  }

  /** All Sue de Coq steps (not sorted, like in the original). */
  getAllSueDeCoqs(): SolutionStep[] {
    this.sudoku = this.finder.getSudoku();
    const old = this.steps;
    this.steps = [];
    this.getSueDeCoqInt(LINE_TEMPLATES, BLOCK_TEMPLATES, false);
    this.getSueDeCoqInt(COL_TEMPLATES, BLOCK_TEMPLATES, false);
    const result = this.steps;
    this.steps = old;
    return result;
  }

  /** Builds all possible intersections of `blocks` and `nonBlocks` (all lines or all columns) and checks each. */
  private getSueDeCoqInt(nonBlocks: readonly SudokuSet[], blocks: readonly SudokuSet[], onlyOne: boolean): SolutionStep | null {
    const emptyCells = this.finder.getEmptyCells();
    for (const nonBlock of nonBlocks) {
      this.nonBlockSet.setAnd(nonBlock, emptyCells);
      for (const block of blocks) {
        this.blockSet.setAnd(block, emptyCells);
        this.intersectionSet.set(this.nonBlockSet);
        this.intersectionSet.and(this.blockSet);
        if (this.intersectionSet.size() < 2) continue;
        const step = this.checkIntersection(onlyOne);
        if (onlyOne && step !== null) return step;
      }
    }
    return null;
  }

  /**
   * Checks all combinations of two or three cells in the intersection. If a
   * combination holds at least 2 more candidates than cells, a Sue de Coq is possible.
   */
  private checkIntersection(onlyOne: boolean): SolutionStep | null {
    const sudoku = this.sudoku;
    const max = this.intersectionSet.size();
    const actSet = this.intersectionActSet;
    actSet.clear();
    for (let i1 = 0; i1 < max - 1; i1++) {
      const index1 = this.intersectionSet.get(i1);
      actSet.add(index1);
      const cand1 = sudoku.getCell(index1);
      for (let i2 = i1 + 1; i2 < max; i2++) {
        const index2 = this.intersectionSet.get(i2);
        const cand2 = cand1 | sudoku.getCell(index2);
        actSet.add(index2);
        // two cells in the intersection
        let nPlus = ANZ_VALUES[cand2] - 2;
        if (nPlus >= 2) {
          const step = this.checkHousesFirst(nPlus, cand2, onlyOne);
          if (onlyOne && step !== null) return step;
        }
        // and the third cell
        for (let i3 = i2 + 1; i3 < max; i3++) {
          const index3 = this.intersectionSet.get(i3);
          const cand3 = cand2 | sudoku.getCell(index3);
          nPlus = ANZ_VALUES[cand3] - 3;
          if (nPlus >= 2) {
            actSet.add(index3);
            const step = this.checkHousesFirst(nPlus, cand3, onlyOne);
            if (onlyOne && step !== null) return step;
            actSet.remove(index3);
          }
        }
        actSet.remove(index2);
      }
      actSet.remove(index1);
    }
    return null;
  }

  /** All cells of the row/column outside the intersection are valid; delegate to the combination search. */
  private checkHousesFirst(nPlus: number, cand: number, onlyOne: boolean): SolutionStep | null {
    this.intersectionActCandSet = cand;
    this.nonBlockSourceSet.set(this.nonBlockSet);
    this.nonBlockSourceSet.andNot(this.intersectionActSet);
    return this.checkHouses(nPlus, this.nonBlockSourceSet, MAX_MASK, onlyOne, false);
  }

  /**
   * Non-recursive search over all combinations of cells in `sourceSet`.
   *
   * It runs twice. The first run builds sets of cells from the row/column: a set is
   * valid if it contains candidates from the intersection, has at least one cell more
   * than extra candidates (candidates outside the intersection) but leaves candidates of
   * the intersection for the block. Then the second run builds sets of cells for the block;
   * for every combination that meets the criteria, eliminations are looked for.
   */
  private checkHouses(
    nPlus: number,
    sourceSet: SudokuSet,
    allowedCandSet: number,
    onlyOne: boolean,
    secondCheck: boolean,
  ): SolutionStep | null {
    if (sourceSet.isEmpty()) return null;
    const sudoku = this.sudoku;
    const stack = secondCheck ? this.stack2 : this.stack1;
    const max = sourceSet.size();
    // level 0 is only a marker, start with level 1
    let level = 1;
    stack[0].aktIndex = -1;
    stack[0].candidates = 0;
    stack[0].indices.clear();
    stack[1].aktIndex = -1;
    while (true) {
      // fall back all levels where nothing can be done anymore
      while (stack[level].aktIndex >= max - 1) {
        level--;
        if (level <= 0) return null;
      }
      // calculate next try
      stack[level].aktIndex++;
      stack[level].indices.set(stack[level - 1].indices);
      stack[level].indices.add(sourceSet.get(stack[level].aktIndex));
      stack[level].candidates = stack[level - 1].candidates | sudoku.getCell(sourceSet.get(stack[level].aktIndex));

      // the cells must not contain candidates that are not allowed
      if ((stack[level].candidates & ~allowedCandSet) === 0) {
        let tmpCands = stack[level].candidates & this.intersectionActCandSet;
        const anzContained = ANZ_VALUES[tmpCands]; // number of candidates from the intersection
        tmpCands = stack[level].candidates & ~this.intersectionActCandSet;
        const anzExtra = ANZ_VALUES[tmpCands]; // number of candidates not drawn from the intersection

        if (!secondCheck) {
          // level equals the number of current cells in the row/column
          if (anzContained > 0 && level > anzExtra && level - anzExtra < nPlus) {
            // the cells contain candidates of the intersection, have at least one cell more than
            // additional candidates and leave candidates uncovered -> switch over to the block
            this.nonBlockActSet = stack[level].indices;
            this.nonBlockActCandSet = stack[level].candidates;
            this.blockSourceSet.set(this.blockSet);
            this.blockSourceSet.andNot(this.intersectionActSet);
            // exclude all cells that are already used in the row/column
            this.blockSourceSet.andNot(this.nonBlockActSet);
            // candidates from the row/column set are not allowed anymore ...
            this.blockAllowedCandSet = this.nonBlockActCandSet;
            // ... except the extra candidates, which are allowed in both sets
            this.blockAllowedCandSet &= ~tmpCands;
            this.blockAllowedCandSet = ~this.blockAllowedCandSet;
            const step = this.checkHouses(
              nPlus - (this.nonBlockActSet.size() - anzExtra),
              this.blockSourceSet,
              this.blockAllowedCandSet,
              onlyOne,
              true,
            );
            if (onlyOne && step !== null) return step;
          }
        } else if (anzContained > 0 && stack[level].indices.size() - anzExtra === nPlus) {
          // the number of candidates has to be exactly nPlus: it is a Sue de Coq. Can anything be eliminated?
          //  - (intersection + block cands) - nonBlock cands in block \ (blockAct u intersection)
          //  - (intersection + nonBlock cands) - block cands in nonBlock \ (nonBlockAct u intersection)
          // extra candidates in both sets can be eliminated from both houses
          const step = new SolutionStep('SUE_DE_COQ');
          this.globalStep = step;
          this.blockActSet = stack[level].indices;
          this.blockActCandSet = stack[level].candidates;
          const tmpCandSet1 = this.blockActCandSet & this.nonBlockActCandSet;
          const tmpSet = this.tmpSet;
          // all cells in the block that do not belong to the SDC
          tmpSet.set(this.blockSet);
          tmpSet.andNot(this.blockActSet);
          tmpSet.andNot(this.intersectionActSet);
          let tmpCandSet = ((this.intersectionActCandSet | this.blockActCandSet) & ~this.nonBlockActCandSet) | tmpCandSet1;
          this.checkCandidatesToDelete(step, tmpSet, tmpCandSet);
          // now the row/column
          tmpSet.set(this.nonBlockSet);
          tmpSet.andNot(this.nonBlockActSet);
          tmpSet.andNot(this.intersectionActSet);
          tmpCandSet = ((this.intersectionActCandSet | this.nonBlockActCandSet) & ~this.blockActCandSet) | tmpCandSet1;
          this.checkCandidatesToDelete(step, tmpSet, tmpCandSet);
          if (step.candidatesToDelete.length > 0) {
            // the intersection is written into indices and values
            for (const idx of this.intersectionActSet) step.addIndex(idx);
            for (const c of POSSIBLE_VALUES[this.intersectionActCandSet]) step.addValue(c);
            // candidates that occur in the intersection and in the row/column become fins,
            // those in the intersection and the block endo fins (display only)
            this.getSetCandidates(this.nonBlockActSet, this.intersectionActSet, this.nonBlockActCandSet, step.fins);
            this.getSetCandidates(this.blockActSet, this.intersectionActSet, this.blockActCandSet, step.endoFins);
            step.addAls(this.intersectionActSet, this.intersectionActCandSet);
            step.addAls(this.blockActSet, this.blockActCandSet);
            step.addAls(this.nonBlockActSet, this.nonBlockActCandSet);
            if (onlyOne) return step;
            this.steps.push(step);
          }
        }
      }

      // on to the next level (if that is possible)
      if (stack[level].aktIndex < max - 1) {
        level++;
        stack[level].aktIndex = stack[level - 1].aktIndex;
      }
    }
  }

  /** Write all candidates of `candSet` that are in a cell of `srcSet1` or `srcSet2` to `dest` (display only). */
  private getSetCandidates(srcSet1: SudokuSet, srcSet2: SudokuSet, candSet: number, dest: Candidate[]): void {
    this.tmpSet.set(srcSet1);
    this.tmpSet.or(srcSet2);
    for (const index of this.tmpSet) {
      const mask = this.sudoku.getCell(index) & candSet;
      if (mask !== 0) {
        for (const c of POSSIBLE_VALUES[mask]) dest.push(new Candidate(index, c));
      }
    }
  }

  /** The candidates of `tmpCandSet` in the cells of `tmpSet` can be eliminated. */
  private checkCandidatesToDelete(step: SolutionStep, tmpSet: SudokuSet, tmpCandSet: number): void {
    if (tmpSet.size() > 0 && ANZ_VALUES[tmpCandSet] > 0) {
      for (const index of tmpSet) {
        const elimCandMask = this.sudoku.getCell(index) & tmpCandSet;
        if (elimCandMask === 0) continue;
        for (const c of POSSIBLE_VALUES[elimCandMask]) step.addCandidateToDelete(index, c);
      }
    }
  }
}

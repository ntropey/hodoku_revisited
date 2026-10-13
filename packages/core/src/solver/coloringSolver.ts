/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's ColoringSolver (Java).
 */
import { SolutionStep } from '../solutionStep.js';
import type { SolutionType } from '../solutionType.js';
import { SudokuSet } from '../sudokuSet.js';
import { ALL_CONSTRAINTS_TEMPLATES, BUDDIES, CONSTRAINTS } from '../tables.js';
import { AbstractSolver } from './abstractSolver.js';
import type { SudokuStepFinder } from './stepFinder.js';

const C1 = 0;
const C2 = 1;

/** Simple Colors (Color Wrap, Color Trap) and Multi Colors (1 and 2). */
export class ColoringSolver extends AbstractSolver {
  /** sets[cand][pair] = [color 1 cells, color 2 cells]: the colored cells of every color pair per candidate */
  private readonly sets: SudokuSet[][][] = Array.from({ length: 10 }, () => []);
  /** Number of color pairs for each candidate. */
  private readonly anzColorPairs = new Array<number>(10).fill(0);
  /** Step number of the sudoku for which coloring was calculated; -1 means "data invalid". */
  private readonly stepNumbers = new Array<number>(10).fill(-1);
  /** all candidate cells that are part of at least one conjugate pair and not colored yet */
  private readonly startSet = new SudokuSet();
  private readonly tmpSet1 = new SudokuSet();
  /** cells where a candidate can be eliminated */
  private readonly deleteSet = new SudokuSet();
  /** All steps found by a search for all steps */
  private steps: SolutionStep[] = [];

  constructor(finder: SudokuStepFinder) {
    super(finder);
  }

  getStep(type: SolutionType): SolutionStep | null {
    this.sudoku = this.finder.getSudoku();
    switch (type) {
      case 'SIMPLE_COLORS':
      case 'SIMPLE_COLORS_TRAP':
      case 'SIMPLE_COLORS_WRAP':
        return this.findSimpleColorSteps(true);
      case 'MULTI_COLORS':
      case 'MULTI_COLORS_1':
      case 'MULTI_COLORS_2':
        return this.findMultiColorSteps(true);
      default:
        return null;
    }
  }

  doStep(step: SolutionStep): boolean {
    this.sudoku = this.finder.getSudoku();
    switch (step.type) {
      case 'SIMPLE_COLORS':
      case 'SIMPLE_COLORS_TRAP':
      case 'SIMPLE_COLORS_WRAP':
      case 'MULTI_COLORS':
      case 'MULTI_COLORS_1':
      case 'MULTI_COLORS_2':
        for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
        return true;
      default:
        return false;
    }
  }

  /** All Simple Colors steps (Wrap and Trap), sorted. */
  findAllSimpleColors(): SolutionStep[] {
    return this.collectAll(() => this.findSimpleColorSteps(false));
  }

  /** All Multi Colors steps, sorted. */
  findAllMultiColors(): SolutionStep[] {
    return this.collectAll(() => this.findMultiColorSteps(false));
  }

  private collectAll(search: () => void): SolutionStep[] {
    this.sudoku = this.finder.getSudoku();
    const old = this.steps;
    this.steps = [];
    search();
    const result = this.steps.sort((a, b) => a.compareTo(b));
    this.steps = old;
    return result;
  }

  private findSimpleColorSteps(onlyOne: boolean): SolutionStep | null {
    for (let i = 1; i <= 9; i++) {
      const step = this.findSimpleColorStepsForCandidate(i, onlyOne);
      if (onlyOne && step !== null) return step;
    }
    return null;
  }

  private findSimpleColorStepsForCandidate(cand: number, onlyOne: boolean): SolutionStep | null {
    const anzColors = this.doColoring(cand);
    for (let i = 0; i < anzColors; i++) {
      const set1 = this.sets[cand][i][C1];
      const set2 = this.sets[cand][i][C2];

      // first: color wrap - if two cells with the same color see each other,
      // all candidates with that color can be removed
      let step = new SolutionStep('SIMPLE_COLORS_WRAP');
      if (this.checkColorWrap(set1)) for (const c of set1) step.addCandidateToDelete(c, cand);
      if (this.checkColorWrap(set2)) for (const c of set2) step.addCandidateToDelete(c, cand);
      if (step.candidatesToDelete.length > 0) {
        step.addValue(cand);
        step.addColorCandidates(set1, 0);
        step.addColorCandidates(set2, 1);
        if (onlyOne) return step;
        this.steps.push(step);
      }

      // second: color trap - any candidate that sees two cells with opposite colors can be removed
      step = new SolutionStep('SIMPLE_COLORS_TRAP');
      this.checkCandidateToDelete(step, set1, set2, cand);
      if (step.candidatesToDelete.length > 0) {
        step.addValue(cand);
        step.addColorCandidates(set1, 0);
        step.addColorCandidates(set2, 1);
        if (onlyOne) return step;
        this.steps.push(step);
      }
    }
    return null;
  }

  /** true if two cells in `set` see each other (then all candidates of that color can be removed). */
  private checkColorWrap(set: SudokuSet): boolean {
    for (let i = 0; i < set.size() - 1; i++) {
      for (let j = i + 1; j < set.size(); j++) {
        if (BUDDIES[set.get(i)].contains(set.get(j))) return true;
      }
    }
    return false;
  }

  /**
   * All candidates that see a cell in set1 and a cell in set2 can be eliminated.
   * The eliminations are collected in a set first so that none is recorded twice.
   */
  private checkCandidateToDelete(step: SolutionStep, set1: SudokuSet, set2: SudokuSet, cand: number): void {
    const { deleteSet, tmpSet1 } = this;
    deleteSet.clear();
    for (const a of set1) {
      for (const b of set2) {
        tmpSet1.set(BUDDIES[a]);
        tmpSet1.and(BUDDIES[b]);
        tmpSet1.and(this.finder.getCandidates()[cand]);
        deleteSet.or(tmpSet1);
      }
    }
    for (const c of deleteSet) step.addCandidateToDelete(c, cand);
  }

  private findMultiColorSteps(onlyOne: boolean): SolutionStep | null {
    for (let i = 1; i <= 9; i++) {
      const step = this.findMultiColorStepsForCandidate(i, onlyOne);
      if (onlyOne && step !== null) return step;
    }
    return null;
  }

  private findMultiColorStepsForCandidate(cand: number, onlyOne: boolean): SolutionStep | null {
    const anzColors = this.doColoring(cand);
    // NOTE: a->b is not equal b->a, so ALL combinations have to be checked
    for (let i = 0; i < anzColors; i++) {
      for (let j = 0; j < anzColors; j++) {
        if (i === j) continue; // color pairs have to be different
        const set11 = this.sets[cand][i][C1];
        const set12 = this.sets[cand][i][C2];
        const set21 = this.sets[cand][j][C1];
        const set22 = this.sets[cand][j][C2];

        // cells of one color see both colors of another pair: all cells with that color can be eliminated
        let step = new SolutionStep('MULTI_COLORS_2');
        if (this.checkMultiColor1(set11, set21, set22)) for (const c of set11) step.addCandidateToDelete(c, cand);
        if (this.checkMultiColor1(set12, set21, set22)) for (const c of set12) step.addCandidateToDelete(c, cand);
        if (step.candidatesToDelete.length > 0) {
          this.finishMultiStep(step, cand, set11, set12, set21, set22);
          if (onlyOne) return step;
          this.steps.push(step);
        }

        // two cells of different color pairs see each other: all candidates that see cells
        // of the two other colors can be eliminated
        step = new SolutionStep('MULTI_COLORS_1');
        if (this.checkMultiColor2(set11, set21)) this.checkCandidateToDelete(step, set12, set22, cand);
        if (this.checkMultiColor2(set11, set22)) this.checkCandidateToDelete(step, set12, set21, cand);
        if (this.checkMultiColor2(set12, set21)) this.checkCandidateToDelete(step, set11, set22, cand);
        if (this.checkMultiColor2(set12, set22)) this.checkCandidateToDelete(step, set11, set21, cand);
        if (step.candidatesToDelete.length > 0) {
          this.finishMultiStep(step, cand, set11, set12, set21, set22);
          if (onlyOne) return step;
          this.steps.push(step);
        }
      }
    }
    return null;
  }

  private finishMultiStep(
    step: SolutionStep,
    cand: number,
    set11: SudokuSet,
    set12: SudokuSet,
    set21: SudokuSet,
    set22: SudokuSet,
  ): void {
    step.addValue(cand);
    step.addColorCandidates(set11, 0);
    step.addColorCandidates(set12, 1);
    step.addColorCandidates(set21, 2);
    step.addColorCandidates(set22, 3);
  }

  /** Do cells in `set` see cells of both s21 and s22? Then all candidates in `set` can be eliminated. */
  private checkMultiColor1(set: SudokuSet, s21: SudokuSet, s22: SudokuSet): boolean {
    let seeS21 = false;
    let seeS22 = false;
    for (const cell of set) {
      this.tmpSet1.set(BUDDIES[cell]);
      if (!this.tmpSet1.andEmpty(s21)) seeS21 = true;
      if (!this.tmpSet1.andEmpty(s22)) seeS22 = true;
      if (seeS21 && seeS22) return true;
    }
    return false;
  }

  /** Does some cell in set1 see a cell in set2? */
  private checkMultiColor2(set1: SudokuSet, set2: SudokuSet): boolean {
    for (const a of set1) {
      for (const b of set2) {
        if (BUDDIES[a].contains(b)) return true;
      }
    }
    return false;
  }

  /**
   * Colors the grid: every candidate that is part of at least one conjugate
   * pair gets a color (it is added to one of the color sets of a pair).
   * Results are cached per candidate until the sudoku changes.
   */
  private doColoring(cand: number): number {
    if (this.stepNumbers[cand] === this.finder.getStepNumber()) return this.anzColorPairs[cand];
    this.anzColorPairs[cand] = 0;
    this.stepNumbers[cand] = this.finder.getStepNumber();
    // first: remove all candidates that are not part of at least one conjugate pair
    const startSet = this.startSet;
    startSet.set(this.finder.getCandidates()[cand]);
    const values = startSet.values(); // stays valid while the set is changed
    const free = this.sudoku.free;
    for (const index of values) {
      const c = CONSTRAINTS[index];
      if (free[c[0]][cand] !== 2 && free[c[1]][cand] !== 2 && free[c[2]][cand] !== 2) {
        startSet.remove(index); // cannot be part of a conjugate pair
      }
    }
    // now color; startSet is changed during the process, so do not loop over it
    while (!startSet.isEmpty()) {
      const pairs = this.sets[cand];
      if (pairs[this.anzColorPairs[cand]] === undefined) pairs[this.anzColorPairs[cand]] = [new SudokuSet(), new SudokuSet()];
      const actSets = pairs[this.anzColorPairs[cand]];
      actSets[C1].clear();
      actSets[C2].clear();
      this.doColoringForColorRecursive(startSet.get(0), cand, true);
      // a color chain has to consist of at least two cells (one on, one off); single candidates are discarded
      if (actSets[C1].isEmpty() || actSets[C2].isEmpty()) {
        actSets[C1].clear();
        actSets[C2].clear();
      } else {
        this.anzColorPairs[cand]++;
      }
    }
    return this.anzColorPairs[cand];
  }

  /** Color the cell with the current color pair and follow all conjugate pairs. */
  private doColoringForColorRecursive(index: number, cand: number, on: boolean): void {
    if (index === -1 || !this.startSet.contains(index)) return;
    this.sets[cand][this.anzColorPairs[cand]][on ? C1 : C2].add(index);
    this.startSet.remove(index);
    const c = CONSTRAINTS[index];
    this.doColoringForColorRecursive(this.getConjugateIndex(index, cand, c[0]), cand, !on);
    this.doColoringForColorRecursive(this.getConjugateIndex(index, cand, c[1]), cand, !on);
    this.doColoringForColorRecursive(this.getConjugateIndex(index, cand, c[2]), cand, !on);
  }

  /** The other cell of the conjugate pair of `cand` in `constraint` that contains `index`, or -1. */
  private getConjugateIndex(index: number, cand: number, constraint: number): number {
    if (this.sudoku.free[constraint][cand] !== 2) return -1; // no conjugate pair
    this.tmpSet1.set(this.finder.getCandidates()[cand]);
    this.tmpSet1.and(ALL_CONSTRAINTS_TEMPLATES[constraint]);
    let result = this.tmpSet1.get(0);
    if (result === index) result = this.tmpSet1.get(1);
    return result;
  }
}

/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's SudokuStepFinder (Java).
 */
import type { SolutionStep } from '../solutionStep.js';
import type { SolutionType } from '../solutionType.js';
import type { Sudoku2 } from '../sudoku2.js';
import type { AbstractSolver } from './abstractSolver.js';
import { DEFAULT_SOLVER_OPTIONS, type SolverOptions } from '../solverOptions.js';
import { BUDDIES, LENGTH, POSSIBLE_VALUES } from '../tables.js';
import { SudokuSet } from '../sudokuSet.js';
import { SimpleSolver } from './simpleSolver.js';
import { SingleDigitPatternSolver } from './singleDigitPatternSolver.js';
import { UniquenessSolver } from './uniquenessSolver.js';
import { WingSolver } from './wingSolver.js';

/**
 * Entry point for finding and executing steps. Delegates to the specialized
 * solvers; every solver answers for the technique types it knows.
 */
export class SudokuStepFinder {
  private sudoku!: Sudoku2;
  /**
   * Incremented whenever a step is found or the sudoku changes. Solvers use it
   * to know whether data they cached is still valid.
   */
  private stepNumber = 0;
  private readonly solvers: AbstractSolver[];

  // Data used by more than one solver; computed lazily, recomputed after every change.
  private readonly candidates = Array.from({ length: 10 }, () => new SudokuSet());
  private candidatesDirty = true;
  private readonly positions = Array.from({ length: 10 }, () => new SudokuSet());
  private positionsDirty = true;
  private readonly candidatesAllowed = Array.from({ length: 10 }, () => new SudokuSet());
  private readonly emptyCells = new SudokuSet();
  private candidatesAllowedDirty = true;

  constructor(readonly options: SolverOptions = { ...DEFAULT_SOLVER_OPTIONS }) {
    // same order as in the original: the first solver that finds a step wins
    this.solvers = [new SimpleSolver(this), new SingleDigitPatternSolver(this), new UniquenessSolver(this), new WingSolver(this)];
  }

  getSudoku(): Sudoku2 {
    return this.sudoku;
  }

  setSudoku(sudoku: Sudoku2): void {
    this.sudoku = sudoku;
    // even if the reference is the same, the content could have changed
    this.setSudokuDirty();
  }

  getStepNumber(): number {
    return this.stepNumber;
  }

  /** The sudoku has been changed: all precalculated data is invalid. */
  setSudokuDirty(): void {
    this.candidatesDirty = true;
    this.candidatesAllowedDirty = true;
    this.positionsDirty = true;
    this.stepNumber++;
  }

  /** For each digit 1-9 the set of cells in which it is still a candidate (index 0 unused). */
  getCandidates(): readonly SudokuSet[] {
    if (this.candidatesDirty) {
      for (let i = 1; i < 10; i++) this.candidates[i].clear();
      for (let i = 0; i < LENGTH; i++) {
        for (const cand of POSSIBLE_VALUES[this.sudoku.cells[i]]) this.candidates[cand].add(i);
      }
      this.candidatesDirty = false;
    }
    return this.candidates;
  }

  /** For each digit 1-9 the set of cells in which it is set as a value (index 0 unused). */
  getPositions(): readonly SudokuSet[] {
    if (this.positionsDirty) {
      for (let i = 1; i < 10; i++) this.positions[i].clear();
      for (let i = 0; i < LENGTH; i++) {
        const v = this.sudoku.values[i];
        if (v !== 0) this.positions[v].add(i);
      }
      this.positionsDirty = false;
    }
    return this.positions;
  }

  /** For each digit 1-9 the set of empty cells in which it is not excluded by a set value (index 0 unused). */
  getCandidatesAllowed(): readonly SudokuSet[] {
    this.initCandidatesAllowed();
    return this.candidatesAllowed;
  }

  getEmptyCells(): SudokuSet {
    this.initCandidatesAllowed();
    return this.emptyCells;
  }

  private initCandidatesAllowed(): void {
    if (!this.candidatesAllowedDirty) return;
    this.emptyCells.setAll();
    for (let i = 1; i < 10; i++) this.candidatesAllowed[i].setAll();
    for (let i = 0; i < LENGTH; i++) {
      const v = this.sudoku.values[i];
      if (v !== 0) {
        this.candidatesAllowed[v].andNot(BUDDIES[i]);
        this.emptyCells.remove(i);
      }
    }
    for (let i = 1; i < 10; i++) this.candidatesAllowed[i].and(this.emptyCells);
    this.candidatesAllowedDirty = false;
  }

  /** The next step of the given type, or null. */
  getStep(type: SolutionType): SolutionStep | null {
    for (const solver of this.solvers) {
      const result = solver.getStep(type);
      if (result !== null) {
        this.stepNumber++;
        return result;
      }
    }
    return null;
  }

  /** Execute a step on the current sudoku. */
  doStep(step: SolutionStep): void {
    for (const solver of this.solvers) {
      if (solver.doStep(step)) {
        this.setSudokuDirty();
        return;
      }
    }
    throw new Error(`Invalid solution step in doStep() (${step.type})`);
  }
}

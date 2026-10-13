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
import { SimpleSolver } from './simpleSolver.js';

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

  constructor() {
    this.solvers = [new SimpleSolver(this)];
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
    this.stepNumber++;
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

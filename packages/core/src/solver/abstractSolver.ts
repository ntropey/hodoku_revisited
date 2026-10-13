/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's AbstractSolver (Java).
 */
import type { SolutionStep } from '../solutionStep.js';
import type { SolutionType } from '../solutionType.js';
import type { Sudoku2 } from '../sudoku2.js';
import type { SudokuStepFinder } from './stepFinder.js';

/** Base class of the specialized solvers that a {@link SudokuStepFinder} delegates to. */
export abstract class AbstractSolver {
  protected sudoku!: Sudoku2;

  constructor(protected finder: SudokuStepFinder) {}

  /** Find the next instance of a specific technique, or null. */
  abstract getStep(type: SolutionType): SolutionStep | null;

  /** Execute a step. Returns false if this solver does not handle the step's type. */
  abstract doStep(step: SolutionStep): boolean;
}

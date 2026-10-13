/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's BruteForceSolver, GiveUpSolver
 * and IncompleteSolver (Java).
 */
import { SudokuGenerator } from '../generator/sudokuGenerator.js';
import { SolutionStep } from '../solutionStep.js';
import type { SolutionType } from '../solutionType.js';
import { SudokuSet } from '../sudokuSet.js';
import { LENGTH } from '../tables.js';
import { AbstractSolver } from './abstractSolver.js';
import type { SudokuStepFinder } from './stepFinder.js';

/**
 * Sets one cell of the solution, when nothing else works: the middle one of the unsolved cells.
 * Needs a sudoku with exactly one solution.
 */
export class BruteForceSolver extends AbstractSolver {
  private generator: SudokuGenerator | null = null;

  constructor(finder: SudokuStepFinder) {
    super(finder);
  }

  getStep(type: SolutionType): SolutionStep | null {
    this.sudoku = this.finder.getSudoku();
    return type === 'BRUTE_FORCE' ? this.getBruteForce() : null;
  }

  doStep(step: SolutionStep): boolean {
    this.sudoku = this.finder.getSudoku();
    if (step.type !== 'BRUTE_FORCE') return false;
    const value = step.values[0];
    for (const index of step.indices) this.sudoku.setCell(index, value);
    return true;
  }

  private getBruteForce(): SolutionStep | null {
    if (!this.sudoku.solutionSet) {
      this.generator ??= new SudokuGenerator();
      if (!this.generator.validSolution(this.sudoku)) return null; // no or more than one solution
    }
    const unsolved = new SudokuSet();
    for (let i = 0; i < LENGTH; i++) {
      if (this.sudoku.getValue(i) === 0) unsolved.add(i);
    }
    const index = unsolved.get(Math.floor(unsolved.size() / 2));
    const step = new SolutionStep('BRUTE_FORCE');
    step.addIndex(index);
    step.addValue(this.sudoku.getSolution(index));
    return step;
  }
}

/** Gives up: the last step in the search order. Setting it ends the solution as unsolved. */
export class GiveUpSolver extends AbstractSolver {
  constructor(finder: SudokuStepFinder) {
    super(finder);
  }

  getStep(type: SolutionType): SolutionStep | null {
    return type === 'GIVE_UP' ? new SolutionStep('GIVE_UP') : null;
  }

  doStep(step: SolutionStep): boolean {
    return step.type === 'GIVE_UP';
  }
}

/** Handles the INCOMPLETE marker step; it never finds anything itself. */
export class IncompleteSolver extends AbstractSolver {
  constructor(finder: SudokuStepFinder) {
    super(finder);
  }

  getStep(): SolutionStep | null {
    return null;
  }

  doStep(step: SolutionStep): boolean {
    return step.type === 'INCOMPLETE';
  }
}

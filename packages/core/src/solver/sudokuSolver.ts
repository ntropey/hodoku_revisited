/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's SudokuSolver (Java).
 */
import { defaultSolverSteps, getDifficultyLevel, type DifficultyLevel, type StepConfig } from '../options.js';
import type { SolutionStep } from '../solutionStep.js';
import { isSingle } from '../solutionType.js';
import type { Sudoku2 } from '../sudoku2.js';
import { SudokuStepFinder } from './stepFinder.js';

const EXTREME = 5;

export interface SolveOptions {
  /** Abort if the puzzle is harder than this level. Default: EXTREME (no limit). */
  maxLevel?: DifficultyLevel;
  /** Only use Full House, Naked Single and Hidden Single. */
  singlesOnly?: boolean;
  /** The techniques to use, in search order. Default: the HoDoKu defaults. */
  stepConfigs?: StepConfig[];
}

/**
 * Solves a sudoku step by step using the configured techniques and rates its
 * difficulty. At every step the first technique (in configured order) that
 * finds something is applied.
 */
export class SudokuSolver {
  private readonly stepFinder = new SudokuStepFinder();
  private sudoku!: Sudoku2;
  private steps: SolutionStep[] = [];
  private level: DifficultyLevel = getDifficultyLevel(1);
  private maxLevel: DifficultyLevel = getDifficultyLevel(EXTREME);
  private score = 0;
  private readonly defaultSteps = defaultSolverSteps();

  setSudoku(sudoku: Sudoku2): void {
    this.steps = [];
    this.sudoku = sudoku;
    this.stepFinder.setSudoku(sudoku);
  }

  getSudoku(): Sudoku2 {
    return this.sudoku;
  }

  /** The steps of the last {@link solve}. */
  getSteps(): readonly SolutionStep[] {
    return this.steps;
  }

  getScore(): number {
    return this.score;
  }

  getLevel(): DifficultyLevel {
    return this.level;
  }

  /**
   * Solve the sudoku that was set with {@link setSudoku}; the sudoku is modified.
   * Returns true if it is solved completely (and not too hard for `maxLevel`).
   */
  solve(options: SolveOptions = {}): boolean {
    const maxLevel = options.maxLevel ?? getDifficultyLevel(EXTREME);
    const stepConfigs = options.stepConfigs ?? this.defaultSteps;
    const sudoku = this.sudoku;

    // a solution is searched only if at least 10 cells are set
    if (81 - sudoku.unsolvedCellsAnz < 10) return false;

    this.maxLevel = maxLevel;
    this.score = 0;
    this.level = getDifficultyLevel(1);

    let step: SolutionStep | null;
    do {
      step = this.getHint(options.singlesOnly ?? false, stepConfigs);
      if (step !== null) {
        this.steps.push(step);
        this.stepFinder.doStep(step);
        if (step.type === 'GIVE_UP') step = null;
      }
    } while (step !== null);

    // the puzzle is rated higher if the score exceeds the max score of the level
    while (this.score > this.level.maxScore) this.level = getDifficultyLevel(this.level.ordinal + 1);
    if (this.level.ordinal > maxLevel.ordinal) return false; // too hard

    sudoku.score = this.score;
    if (sudoku.isSolved()) {
      sudoku.level = this.level.ordinal;
      return true;
    }
    sudoku.level = EXTREME;
    return false;
  }

  /** The next logical step for `sudoku` (the solver's own sudoku is not changed), or null. */
  getHint(sudoku: Sudoku2, singlesOnly?: boolean): SolutionStep | null;
  getHint(singlesOnly: boolean, stepConfigs: StepConfig[]): SolutionStep | null;
  getHint(a: Sudoku2 | boolean, b?: boolean | StepConfig[]): SolutionStep | null {
    if (typeof a === 'boolean') return this.nextStep(a, b as StepConfig[]);
    const save = this.sudoku;
    const oldMaxLevel = this.maxLevel;
    const oldLevel = this.level;
    this.maxLevel = getDifficultyLevel(EXTREME);
    this.level = getDifficultyLevel(1);
    this.sudoku = a;
    this.stepFinder.setSudoku(a);
    const step = this.nextStep((b as boolean | undefined) ?? false, this.defaultSteps);
    this.maxLevel = oldMaxLevel;
    this.level = oldLevel;
    this.sudoku = save;
    if (save) this.stepFinder.setSudoku(save);
    return step;
  }

  private nextStep(singlesOnly: boolean, stepConfigs: StepConfig[]): SolutionStep | null {
    if (this.sudoku.isSolved()) return null;
    for (const config of stepConfigs) {
      if (!config.enabled) continue; // technique is switched off
      if (singlesOnly && !isSingle(config.type)) continue;
      const hint = this.stepFinder.getStep(config.type);
      if (hint !== null) {
        this.score += config.baseScore;
        const stepLevel = getDifficultyLevel(config.level);
        if (stepLevel.ordinal > this.level.ordinal) this.level = stepLevel;
        // too hard? stop right away
        if (this.level.ordinal > this.maxLevel.ordinal || this.score >= this.maxLevel.maxScore) return null;
        return hint;
      }
    }
    return null;
  }
}

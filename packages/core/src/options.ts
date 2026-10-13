/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of the solver parts of HoDoKu's Options (Java).
 */
import {
  DEFAULT_DIFFICULTY_LEVELS,
  DEFAULT_SOLVER_STEPS,
  type DifficultyType,
  type StepConfig,
} from './generated/defaultSteps.js';

export type { DifficultyType, StepConfig, SolutionCategory } from './generated/defaultSteps.js';
export { DEFAULT_DIFFICULTY_LEVELS, DEFAULT_SOLVER_STEPS } from './generated/defaultSteps.js';

export interface DifficultyLevel {
  type: DifficultyType;
  ordinal: number;
  maxScore: number;
}

export function getDifficultyLevel(ordinal: number): DifficultyLevel {
  return DEFAULT_DIFFICULTY_LEVELS[ordinal];
}

/**
 * The solver steps in search order. INCOMPLETE and GIVE_UP are the first two
 * entries of the defaults and take part in the sort like any other step.
 * The sort is stable and by `index`, as in the original.
 */
export function defaultSolverSteps(): StepConfig[] {
  return DEFAULT_SOLVER_STEPS.map((s) => ({ ...s })).sort((a, b) => a.index - b.index);
}

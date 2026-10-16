import { defaultSolverSteps, SOLUTION_TYPE_INFO } from '@hodoku/core';

/** How hard each technique is (0 singles ... 5 extreme), for "Solve up to". */
export const STEP_LEVEL = new Map<string, number>(defaultSolverSteps().map((c) => [c.type, c.level]));

/** The readable name of a technique, for the training status line and messages. */
export const TECHNIQUE_NAMES = new Map<string, string>(defaultSolverSteps().map((c) => [c.type, SOLUTION_TYPE_INFO[c.type].stepName]));

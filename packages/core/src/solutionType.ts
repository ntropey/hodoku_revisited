/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of the helpers in HoDoKu's SolutionType (Java).
 */
import type { SolutionType } from './generated/solutionType.js';

export type { SolutionType } from './generated/solutionType.js';
export { SOLUTION_TYPE_INFO, SOLUTION_TYPE_NAMES } from './generated/solutionType.js';

export function isSingle(type: SolutionType): boolean {
  return type === 'HIDDEN_SINGLE' || type === 'NAKED_SINGLE' || type === 'FULL_HOUSE';
}

/** Hidden subsets (the singles count as hidden subsets of size 1). */
export function isHiddenSubset(type: SolutionType): boolean {
  return isSingle(type) || type === 'HIDDEN_PAIR' || type === 'HIDDEN_TRIPLE' || type === 'HIDDEN_QUADRUPLE';
}

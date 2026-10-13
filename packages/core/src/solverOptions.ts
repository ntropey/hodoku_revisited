/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of the solver options in HoDoKu's Options (Java).
 */

/** Options that change what the solvers find. The defaults are those of HoDoKu 2.2.0. */
export interface SolverOptions {
  /** Report Dual 2-String Kites, Dual Skyscrapers, Dual Empty Rectangles and Siamese fish. */
  allowDualsAndSiamese: boolean;
  /** Allow Empty Rectangles with only two candidates in the box. */
  allowErsWithOnlyTwoCandidates: boolean;
  /** Allow missing candidates in cells with additional candidates (uniqueness tests). */
  allowUniquenessMissingCandidates: boolean;
  /** Maximal number of fins in fish. */
  maxFins: number;
  maxEndoFins: number;
  /** Only the smallest fish for every elimination. */
  onlyOneFishPerStep: boolean;
  /** Limit the length of X-/XY-chains and nice loops. */
  restrictChainSize: boolean;
  restrictChainLength: number;
  restrictNiceLoopLength: number;
  onlyOneAlsPerStep: boolean;
  allowAlsOverlap: boolean;
}

export const DEFAULT_SOLVER_OPTIONS: Readonly<SolverOptions> = {
  allowDualsAndSiamese: false,
  allowErsWithOnlyTwoCandidates: false,
  allowUniquenessMissingCandidates: true,
  maxFins: 5,
  maxEndoFins: 2,
  onlyOneFishPerStep: true,
  restrictChainSize: true,
  restrictChainLength: 20,
  restrictNiceLoopLength: 10,
  onlyOneAlsPerStep: true,
  allowAlsOverlap: false,
};

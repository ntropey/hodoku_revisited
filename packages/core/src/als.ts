/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's Als (Java).
 */
import { SudokuSet } from './sudokuSet.js';
import { ANZ_VALUES, MASKS, getBuddiesOfSet } from './tables.js';

/** Number of links that an ALS with `candSize` candidates adds to the length of a chain. */
export function getChainPenalty(candSize: number): number {
  if (candSize === 0 || candSize === 1) return 0;
  if (candSize === 2) return candSize - 1;
  return (candSize - 1) * 2;
}

/**
 * An Almost Locked Set: N cells (in one unit) that together hold N+1 candidates.
 * Per candidate the cells where it occurs and all cells that see all of those are precomputed.
 */
export class Als {
  readonly indices: SudokuSet;
  /** candidate mask of all cells */
  readonly candidates: number;
  /** for every candidate (1-9): the cells of the ALS that contain it */
  readonly indicesPerCandidat: SudokuSet[] = new Array<SudokuSet>(10);
  /** for every candidate: cells outside the ALS that see all its cells and still contain the candidate */
  readonly buddiesPerCandidat: SudokuSet[] = new Array<SudokuSet>(10);
  /** the same plus the ALS cells that hold the candidate */
  readonly buddiesAlsPerCandidat: SudokuSet[] = new Array<SudokuSet>(10);
  /** all cells in buddiesPerCandidat */
  buddies = new SudokuSet();
  private chainPenaltyCache = -1;

  constructor(indices: SudokuSet, candidates: number) {
    this.indices = new SudokuSet(indices);
    this.candidates = candidates;
  }

  /** Compute the per-candidate sets. `candidates` are the cells that still hold each candidate. */
  computeFields(candidates: readonly SudokuSet[]): void {
    this.buddies = new SudokuSet();
    for (let i = 1; i <= 9; i++) {
      if ((this.candidates & MASKS[i]) === 0) continue;
      const indicesPerCandidat = new SudokuSet(this.indices);
      indicesPerCandidat.and(candidates[i]);
      this.indicesPerCandidat[i] = indicesPerCandidat;
      const buddiesPerCandidat = new SudokuSet();
      getBuddiesOfSet(indicesPerCandidat, buddiesPerCandidat);
      buddiesPerCandidat.andNot(this.indices);
      buddiesPerCandidat.and(candidates[i]);
      this.buddiesPerCandidat[i] = buddiesPerCandidat;
      const buddiesAls = new SudokuSet(buddiesPerCandidat);
      buddiesAls.or(indicesPerCandidat);
      this.buddiesAlsPerCandidat[i] = buddiesAls;
      this.buddies.or(buddiesPerCandidat);
    }
  }

  get chainPenalty(): number {
    if (this.chainPenaltyCache === -1) this.chainPenaltyCache = getChainPenalty(ANZ_VALUES[this.candidates]);
    return this.chainPenaltyCache;
  }

  /** Two ALS are equal if they contain the same cells. */
  equals(o: Als): boolean {
    return this.indices.equals(o.indices);
  }
}

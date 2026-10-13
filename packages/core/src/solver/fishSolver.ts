/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's FishSolver (Java).
 */
import { SolutionStep } from '../solutionStep.js';
import { getFishSize, isBasicFish, isFrankenFish, isMutantFish, isSashimiFish, type SolutionType } from '../solutionType.js';
import { SudokuSet } from '../sudokuSet.js';
import {
  ALL_CONSTRAINTS_TEMPLATES,
  CONSTRAINT_NUMBER_FROM_CONSTRAINT,
  CONSTRAINT_TYPE_FROM_CONSTRAINT,
  UNITS,
  getBuddiesOfSet,
} from '../tables.js';
import { AbstractSolver } from './abstractSolver.js';
import type { SudokuStepFinder } from './stepFinder.js';

/*
 * The definitions of the Ultimate Fish Guide apply (http://www.sudoku.com/boards/viewtopic.php?t=4993).
 * Additions: a base candidate is a potential elimination if it is contained in at least two cover units.
 *
 * Differences to the original:
 *  - Sets of cells are three int32 words (a0, a1, a2 = cells 0-31, 32-63, 64-80) instead of two longs.
 *  - The template check is not implemented. It only prunes the search for really large fish
 *    (it cannot change which fish are found), so results are the same.
 *  - Kraken Fish and Siamese fish (allowDualsAndSiamese) are not supported yet.
 */

const BASIC_TYPES: SolutionType[] = ['X_WING', 'SWORDFISH', 'JELLYFISH', 'SQUIRMBAG', 'WHALE', 'LEVIATHAN'];
const FINNED_BASIC_TYPES: SolutionType[] = [
  'FINNED_X_WING',
  'FINNED_SWORDFISH',
  'FINNED_JELLYFISH',
  'FINNED_SQUIRMBAG',
  'FINNED_WHALE',
  'FINNED_LEVIATHAN',
];
const SASHIMI_BASIC_TYPES: SolutionType[] = [
  'SASHIMI_X_WING',
  'SASHIMI_SWORDFISH',
  'SASHIMI_JELLYFISH',
  'SASHIMI_SQUIRMBAG',
  'SASHIMI_WHALE',
  'SASHIMI_LEVIATHAN',
];
const FRANKEN_TYPES: SolutionType[] = [
  'FRANKEN_X_WING',
  'FRANKEN_SWORDFISH',
  'FRANKEN_JELLYFISH',
  'FRANKEN_SQUIRMBAG',
  'FRANKEN_WHALE',
  'FRANKEN_LEVIATHAN',
];
const FINNED_FRANKEN_TYPES: SolutionType[] = [
  'FINNED_FRANKEN_X_WING',
  'FINNED_FRANKEN_SWORDFISH',
  'FINNED_FRANKEN_JELLYFISH',
  'FINNED_FRANKEN_SQUIRMBAG',
  'FINNED_FRANKEN_WHALE',
  'FINNED_FRANKEN_LEVIATHAN',
];
const MUTANT_TYPES: SolutionType[] = [
  'MUTANT_X_WING',
  'MUTANT_SWORDFISH',
  'MUTANT_JELLYFISH',
  'MUTANT_SQUIRMBAG',
  'MUTANT_WHALE',
  'MUTANT_LEVIATHAN',
];
const FINNED_MUTANT_TYPES: SolutionType[] = [
  'FINNED_MUTANT_X_WING',
  'FINNED_MUTANT_SWORDFISH',
  'FINNED_MUTANT_JELLYFISH',
  'FINNED_MUTANT_SQUIRMBAG',
  'FINNED_MUTANT_WHALE',
  'FINNED_MUTANT_LEVIATHAN',
];

/** Fish categories */
const UNDEFINED = -1;
const BASIC = 0;
const FRANKEN = 1;
const MUTANT = 2;

/** Masks for determining the fish shape */
const LINE_MASK = 0x1;
const COL_MASK = 0x2;
const BLOCK_MASK = 0x4;
/** Mask per unit type (BLOCK = 0, LINE = 1, COL = 2) */
const UNIT_MASKS = [BLOCK_MASK, LINE_MASK, COL_MASK];

const NUMBER_OF_UNITS = UNITS * 3;

/** One entry in the recursion stack for the base unit search */
class BaseStackEntry {
  /** The index of the base unit that is currently tried */
  aktIndex = 0;
  /** The unit that was set previously */
  lastUnit = 0;
  /** All cells that are in at least one base set and hold the fish candidate */
  c0 = 0;
  c1 = 0;
  c2 = 0;
  /** All cells that are in more than one base set and have to be treated as fins */
  e0 = 0;
  e1 = 0;
  e2 = 0;
}

/** One entry in the recursion stack for the cover unit search */
class CoverStackEntry {
  aktIndex = 0;
  lastUnit = 0;
  /** All cells that are in at least one cover set and hold the fish candidate */
  c0 = 0;
  c1 = 0;
  c2 = 0;
  /** All cells that are in more than one cover set (potential cannibalistic eliminations) */
  k0 = 0;
  k1 = 0;
  k2 = 0;
}

/** number of set bits in a 32 bit value */
function popcount(x: number): number {
  let v = x - ((x >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

function size3(a0: number, a1: number, a2: number): number {
  return popcount(a0) + popcount(a1) + popcount(a2);
}

/** Basic, Finned, Sashimi, Franken and Mutant fish of every size. */
export class FishSolver extends AbstractSolver {
  /** The fish candidate */
  private candidate = 0;
  /** all positions where the fish candidate is still possible */
  private cand0 = 0;
  private cand1 = 0;
  private cand2 = 0;
  private readonly createFishSet = new SudokuSet();
  private readonly getBuddiesSet = new SudokuSet();
  private readonly finSet = new SudokuSet();
  /** true if only finless fish should be found */
  private withoutFins = false;
  /** true if only finned or sashimi fish should be found */
  private withFins = false;
  /** true if finned fish can contain endo fins */
  private withEndoFins = false;
  /** true if only sashimi fish should be found (withFins has to be true as well) */
  private sashimi = false;
  /** the fish category (BASIC, FRANKEN, MUTANT) */
  private fishType = UNDEFINED;
  private minSize = 0;
  private maxSize = 0;
  /** all possible base units (indices of constraints) with, per unit, all cells where the candidate is set */
  private readonly baseUnits = new Array<number>(NUMBER_OF_UNITS).fill(0);
  private readonly baseC0 = new Array<number>(NUMBER_OF_UNITS).fill(0);
  private readonly baseC1 = new Array<number>(NUMBER_OF_UNITS).fill(0);
  private readonly baseC2 = new Array<number>(NUMBER_OF_UNITS).fill(0);
  private numberOfBaseUnits = 0;
  /** all possible cover units */
  private readonly allCoverUnits = new Array<number>(NUMBER_OF_UNITS).fill(0);
  private readonly allCoverC0 = new Array<number>(NUMBER_OF_UNITS).fill(0);
  private readonly allCoverC1 = new Array<number>(NUMBER_OF_UNITS).fill(0);
  private readonly allCoverC2 = new Array<number>(NUMBER_OF_UNITS).fill(0);
  private numberOfAllCoverUnits = 0;
  /** the cover units of the current cover search */
  private readonly coverUnits = new Array<number>(NUMBER_OF_UNITS).fill(0);
  private readonly coverC0 = new Array<number>(NUMBER_OF_UNITS).fill(0);
  private readonly coverC1 = new Array<number>(NUMBER_OF_UNITS).fill(0);
  private readonly coverC2 = new Array<number>(NUMBER_OF_UNITS).fill(0);
  private numberOfCoverUnits = 0;
  /** true for all base units that are currently used */
  private readonly baseUnitsUsed = new Array<boolean>(NUMBER_OF_UNITS).fill(false);
  private readonly baseStack = Array.from({ length: 9 }, () => new BaseStackEntry());
  private baseLevel = 0;
  private readonly coverUnitsUsed = new Array<boolean>(NUMBER_OF_UNITS).fill(false);
  private readonly coverStack = Array.from({ length: 9 }, () => new CoverStackEntry());
  private coverLevel = 0;
  /** true if all fish should be found (not used by the default searches) */
  private searchAll = false;
  /** true if Siamese Fish should be found (not supported) */
  private siamese = false;
  /** all steps found by the last search */
  private steps: SolutionStep[] = [];
  /** steps that were found but cannot be used right now (finned <-> sashimi) */
  private cachedSteps: SolutionStep[] = [];
  /** the finder step number of the last executed step */
  private lastStepNumber = 0;

  constructor(finder: SudokuStepFinder) {
    super(finder);
  }

  getStep(type: SolutionType): SolutionStep | null {
    this.sudoku = this.finder.getSudoku();
    const parts = classify(type);
    if (parts === null) return null;
    const { size, kind } = parts;
    this.searchAll = false;
    switch (kind) {
      case 'BASIC':
        return this.getAnyFish(size, true, false, false, false, BASIC);
      case 'FINNED':
        return this.getAnyFish(size, false, true, false, false, BASIC);
      case 'SASHIMI':
        return this.getAnyFish(size, false, true, true, false, BASIC);
      case 'FRANKEN':
        return this.getAnyFish(size, true, false, false, true, FRANKEN);
      case 'FINNED_FRANKEN':
        return this.getAnyFish(size, false, true, false, true, FRANKEN);
      case 'MUTANT':
        return this.getAnyFish(size, true, false, false, true, MUTANT);
      case 'FINNED_MUTANT':
        return this.getAnyFish(size, false, true, false, true, MUTANT);
    }
  }

  doStep(step: SolutionStep): boolean {
    this.sudoku = this.finder.getSudoku();
    if (classify(step.type) !== null) {
      for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
      return true;
    }
    return false;
  }

  /** Search for a fish of a given size and shape. */
  private getAnyFish(
    size: number,
    withoutFins: boolean,
    withFins: boolean,
    sashimi: boolean,
    withEndoFins: boolean,
    fishType: number,
  ): SolutionStep | null {
    this.searchAll = false;
    if (this.finder.getStepNumber() !== this.lastStepNumber) {
      // the sudoku is dirty -> the cache is useless
      this.cachedSteps = [];
      this.lastStepNumber = this.finder.getStepNumber();
    } else {
      // try the cache first: a step fits if it has the same size, the same category
      // (BASIC, FRANKEN or MUTANT) and the same finned/sashimi status
      for (const step of this.cachedSteps) {
        const type = step.type;
        if (
          getFishSize(type) === size &&
          ((fishType === BASIC && isBasicFish(type)) ||
            (fishType === FRANKEN && isFrankenFish(type)) ||
            (fishType === MUTANT && isMutantFish(type))) &&
          withFins &&
          (step.fins.length > 0 || step.endoFins.length > 0) &&
          sashimi === isSashimiFish(type)
        ) {
          this.cachedSteps = [];
          return step;
        }
      }
    }
    // the hard way...
    this.steps = [];
    if (this.finder.options.allowDualsAndSiamese) throw new Error('allowDualsAndSiamese is not supported yet');
    let step: SolutionStep | null = null;
    for (let cand = 1; cand <= 9; cand++) {
      step = this.getFishesForCandidate(cand, size, size, withoutFins, withFins, sashimi, withEndoFins, fishType);
      if (step !== null) return step;
    }
    return step;
  }

  /**
   * Searches for fish of one candidate. For BASIC and FRANKEN fish lines/columns
   * is tried first, then columns/lines.
   */
  private getFishesForCandidate(
    candidate: number,
    minSize: number,
    maxSize: number,
    withoutFins: boolean,
    withFins: boolean,
    sashimi: boolean,
    withEndoFins: boolean,
    fishType: number,
  ): SolutionStep | null {
    this.siamese = this.finder.options.allowDualsAndSiamese;
    this.fishType = fishType;
    this.candidate = candidate;
    const cands = this.finder.getCandidates()[candidate];
    this.cand0 = cands.m0;
    this.cand1 = cands.m1;
    this.cand2 = cands.m2;
    this.withoutFins = withoutFins;
    this.withFins = withFins;
    this.withEndoFins = withEndoFins;
    this.sashimi = sashimi;
    this.minSize = minSize;
    this.maxSize = maxSize;

    // search in lines first
    const step = this.getFishes(true);
    if (fishType === MUTANT || step !== null) return step;
    // then in columns
    return this.getFishes(false) ?? step;
  }

  /**
   * All fish with size between minSize and maxSize of the current category. Most required data
   * is kept in fields to reduce the overhead of method calls.
   */
  private getFishes(lines: boolean): SolutionStep | null {
    // get all eligible base and cover units
    this.initForCandidate(this.maxSize, this.withFins, lines);

    // try all combinations of base units
    this.baseUnitsUsed.fill(false);
    const baseStack = this.baseStack;
    // start with level one (level zero is a stopper)
    this.baseLevel = 1;
    baseStack[0].c0 = baseStack[0].c1 = baseStack[0].c2 = 0;
    baseStack[0].e0 = baseStack[0].e1 = baseStack[0].e2 = 0;
    baseStack[1].aktIndex = 0;
    baseStack[1].lastUnit = -1;
    const maxEndoFins = this.finder.options.maxEndoFins;
    while (true) {
      // fall back if no unit is available
      while (baseStack[this.baseLevel].aktIndex >= this.numberOfBaseUnits) {
        if (baseStack[this.baseLevel].lastUnit !== -1) {
          this.baseUnitsUsed[baseStack[this.baseLevel].lastUnit] = false;
          baseStack[this.baseLevel].lastUnit = -1;
        }
        this.baseLevel--;
        if (this.baseLevel <= 0) {
          // all combinations tried -> done!
          return this.steps.length > 0 ? this.steps[0] : null;
        }
      }
      const bEntry = baseStack[this.baseLevel];
      const prev = baseStack[this.baseLevel - 1];
      // get the next base set; there must be one left or we would have fallen back
      const aktBaseIndex = bEntry.aktIndex++;
      // if the new unit has common candidates with the current base set, those candidates
      // are treated as fin cells (endo fins)
      const akt0 = prev.c0 & this.baseC0[aktBaseIndex];
      const akt1 = prev.c1 & this.baseC1[aktBaseIndex];
      const akt2 = prev.c2 & this.baseC2[aktBaseIndex];
      if (akt0 !== 0 || akt1 !== 0 || akt2 !== 0) {
        if (!this.withFins || !this.withEndoFins || size3(prev.e0, prev.e1, prev.e2) + size3(akt0, akt1, akt2) > maxEndoFins) {
          continue; // an invalid combination
        }
      }
      // union of the existing sets with the new base unit
      bEntry.c0 = prev.c0 | this.baseC0[aktBaseIndex];
      bEntry.c1 = prev.c1 | this.baseC1[aktBaseIndex];
      bEntry.c2 = prev.c2 | this.baseC2[aktBaseIndex];
      bEntry.e0 = prev.e0 | akt0;
      bEntry.e1 = prev.e1 | akt1;
      bEntry.e2 = prev.e2 | akt2;
      if (bEntry.lastUnit !== -1) this.baseUnitsUsed[bEntry.lastUnit] = false;
      bEntry.lastUnit = this.baseUnits[aktBaseIndex];
      this.baseUnitsUsed[this.baseUnits[aktBaseIndex]] = true;
      // if baseLevel lies between minSize and maxSize -> check the cover units
      if (this.baseLevel >= this.minSize && this.baseLevel <= this.maxSize) {
        const step = this.searchCoverUnits(bEntry.c0, bEntry.c1, bEntry.c2, bEntry.e0, bEntry.e1, bEntry.e2);
        if (step !== null) return step;
      }
      // and on to the next level
      if (this.baseLevel < this.maxSize) {
        this.baseLevel++;
        const next = baseStack[this.baseLevel];
        next.aktIndex = aktBaseIndex + 1;
        next.lastUnit = -1;
      }
    }
  }

  /**
   * The complete cover unit search: all combinations of cover units that are not
   * identical with base units are tried.
   */
  private searchCoverUnits(
    base0: number,
    base1: number,
    base2: number,
    endo0: number,
    endo1: number,
    endo2: number,
  ): SolutionStep | null {
    // all valid cover units for this search
    this.numberOfCoverUnits = 0;
    for (let i = 0; i < this.numberOfAllCoverUnits; i++) {
      if (this.baseUnitsUsed[this.allCoverUnits[i]]) continue; // possible cover unit is a base unit
      if ((base0 & this.allCoverC0[i]) === 0 && (base1 & this.allCoverC1[i]) === 0 && (base2 & this.allCoverC2[i]) === 0) {
        continue; // no common candidates
      }
      this.coverUnits[this.numberOfCoverUnits] = this.allCoverUnits[i];
      this.coverC0[this.numberOfCoverUnits] = this.allCoverC0[i];
      this.coverC1[this.numberOfCoverUnits] = this.allCoverC1[i];
      this.coverC2[this.numberOfCoverUnits++] = this.allCoverC2[i];
    }
    // try all combinations of cover units
    this.coverUnitsUsed.fill(false);
    const coverStack = this.coverStack;
    // start with level one (level zero is a stopper)
    this.coverLevel = 1;
    coverStack[0].c0 = coverStack[0].c1 = coverStack[0].c2 = 0;
    coverStack[0].k0 = coverStack[0].k1 = coverStack[0].k2 = 0;
    coverStack[1].aktIndex = 0;
    coverStack[1].lastUnit = -1;
    const maxFins = this.finder.options.maxFins;
    while (true) {
      // fall back if no unit is available
      while (coverStack[this.coverLevel].aktIndex >= this.numberOfCoverUnits - this.baseLevel + this.coverLevel) {
        if (coverStack[this.coverLevel].lastUnit !== -1) {
          this.coverUnitsUsed[coverStack[this.coverLevel].lastUnit] = false;
          coverStack[this.coverLevel].lastUnit = -1;
        }
        this.coverLevel--;
        if (this.coverLevel <= 0) {
          // all combinations tried -> done!
          return this.steps.length > 0 ? this.steps[0] : null;
        }
      }
      const cEntry = coverStack[this.coverLevel];
      const prev = coverStack[this.coverLevel - 1];
      // get the next cover set; there must be one left or we would have fallen back
      const aktCoverIndex = cEntry.aktIndex++;
      // if the new unit has common candidates with the current cover set, those candidates are
      // potential eliminations (cannibalistic eliminations)
      const can0 = prev.c0 & this.coverC0[aktCoverIndex];
      const can1 = prev.c1 & this.coverC1[aktCoverIndex];
      const can2 = prev.c2 & this.coverC2[aktCoverIndex];
      // union of the existing sets with the new cover unit
      cEntry.c0 = prev.c0 | this.coverC0[aktCoverIndex];
      cEntry.c1 = prev.c1 | this.coverC1[aktCoverIndex];
      cEntry.c2 = prev.c2 | this.coverC2[aktCoverIndex];
      cEntry.k0 = prev.k0 | can0;
      cEntry.k1 = prev.k1 | can1;
      cEntry.k2 = prev.k2 | can2;
      if (cEntry.lastUnit !== -1) this.coverUnitsUsed[cEntry.lastUnit] = false;
      cEntry.lastUnit = this.coverUnits[aktCoverIndex];
      this.coverUnitsUsed[this.coverUnits[aktCoverIndex]] = true;
      if (this.coverLevel === this.baseLevel) {
        // same number of base and cover units -> possible fish (with or without fins)
        // fins: base candidates that are not covered, plus the endo fins
        const m0 = ~cEntry.c0 & base0;
        const m1 = ~cEntry.c1 & base1;
        const m2 = ~cEntry.c2 & base2;
        const isCovered = m0 === 0 && m1 === 0 && m2 === 0;
        const fins0 = m0 | endo0;
        const fins1 = m1 | endo1;
        const fins2 = m2 | endo2;
        let finSize = 0;
        if (isCovered && this.withoutFins && fins0 === 0 && fins1 === 0 && fins2 === 0) {
          // FINLESS FISH: all candidates from the cover set that are not in the base set can be
          // eliminated; a base candidate in more than one cover set can be eliminated as well
          // (cannibalistic elimination)
          const t0 = cEntry.c0 & ~base0;
          const t1 = cEntry.c1 & ~base1;
          const t2 = cEntry.c2 & ~base2;
          if (t0 !== 0 || t1 !== 0 || t2 !== 0 || cEntry.k0 !== 0 || cEntry.k1 !== 0 || cEntry.k2 !== 0) {
            const step = this.createFishStep(
              this.coverLevel,
              false,
              [fins0, fins1, fins2],
              [t0, t1, t2],
              [cEntry.k0, cEntry.k1, cEntry.k2],
              [endo0, endo1, endo2],
              [t0, t1, t2],
            );
            if (step !== null) return step;
          }
        } else if (this.withFins && (finSize = size3(fins0, fins1, fins2)) > 0 && finSize <= maxFins) {
          // POSSIBLE FINNED/SASHIMI FISH. A candidate is a potential elimination if it belongs to the
          // cover set but not to the base set, or belongs to more than one cover set. It becomes an
          // eventual elimination if it sees all fins (including endo fins).
          this.finSet.setWords(fins0, fins1, fins2);
          getBuddiesOfSet(this.finSet, this.getBuddiesSet);
          const fb = this.getBuddiesSet;
          // if no cell sees all fins, eliminations are impossible
          if (!fb.isEmpty()) {
            let t0 = cEntry.c0 & ~base0;
            let t1 = cEntry.c1 & ~base1;
            let t2 = cEntry.c2 & ~base2;
            const pot0 = t0;
            const pot1 = t1;
            const pot2 = t2;
            t0 &= fb.m0;
            t1 &= fb.m1;
            t2 &= fb.m2;
            const k0 = cEntry.k0 & fb.m0;
            const k1 = cEntry.k1 & fb.m1;
            const k2 = cEntry.k2 & fb.m2;
            if (t0 !== 0 || t1 !== 0 || t2 !== 0 || k0 !== 0 || k1 !== 0 || k2 !== 0) {
              const step = this.createFishStep(
                this.coverLevel,
                true,
                [fins0, fins1, fins2],
                [t0, t1, t2],
                [k0, k1, k2],
                [endo0, endo1, endo2],
                [pot0, pot1, pot2],
              );
              if (step !== null) return step;
            }
          }
        }
      }
      // and on to the next level
      if (this.coverLevel < this.maxSize) {
        this.coverLevel++;
        const next = coverStack[this.coverLevel];
        next.aktIndex = aktCoverIndex + 1;
        next.lastUnit = -1;
      }
    }
  }

  /**
   * Create a new fish step. Returns null if the step can't be used right now: a sashimi fish found
   * while searching finned fish (and vice versa) is cached for a later search.
   */
  private createFishStep(
    size: number,
    withFins: boolean,
    fins: [number, number, number],
    del: [number, number, number],
    cannibalistic: [number, number, number],
    endoFins: [number, number, number],
    potentialEliminations: [number, number, number],
  ): SolutionStep | null {
    const candidate = this.candidate;
    // masks for the constraint types included in the base and cover sets
    const baseMask = unitMask(this.baseUnitsUsed);
    const coverMask = unitMask(this.coverUnitsUsed);
    const basicShape =
      (baseMask === LINE_MASK && coverMask === COL_MASK) || (baseMask === COL_MASK && coverMask === LINE_MASK);

    // check for Sashimi (only for basic fish): if a base unit contains a fin and has at most one
    // base candidate left without the fins, it is sashimi
    let isSashimi = false;
    if (basicShape) {
      for (let i = 0; i < this.numberOfBaseUnits; i++) {
        if (this.baseUnitsUsed[this.baseUnits[i]]) {
          const c0 = this.baseC0[i] & ~fins[0];
          const c1 = this.baseC1[i] & ~fins[1];
          const c2 = this.baseC2[i] & ~fins[2];
          if (size3(c0, c1, c2) <= 1) {
            isSashimi = true;
            break;
          }
        }
      }
    }

    // determine the type
    let type: SolutionType;
    if (basicShape) {
      type = isSashimi ? SASHIMI_BASIC_TYPES[size - 2] : withFins ? FINNED_BASIC_TYPES[size - 2] : BASIC_TYPES[size - 2];
    } else if (
      ((baseMask === LINE_MASK || baseMask === (LINE_MASK | BLOCK_MASK)) &&
        (coverMask === COL_MASK || coverMask === (COL_MASK | BLOCK_MASK))) ||
      ((baseMask === COL_MASK || baseMask === (COL_MASK | BLOCK_MASK)) &&
        (coverMask === LINE_MASK || coverMask === (LINE_MASK | BLOCK_MASK)))
    ) {
      type = withFins ? FINNED_FRANKEN_TYPES[size - 2] : FRANKEN_TYPES[size - 2];
    } else {
      type = withFins ? FINNED_MUTANT_TYPES[size - 2] : MUTANT_TYPES[size - 2];
    }

    const step = new SolutionStep(type);
    const set = this.createFishSet;
    step.addValue(candidate);
    // the cells of the fish: base candidates without the fins
    const top = this.baseStack[this.baseLevel];
    set.setWords(top.c0 & ~fins[0], top.c1 & ~fins[1], top.c2 & ~fins[2]);
    for (const idx of set) step.addIndex(idx);
    for (let i = 0; i < this.baseUnitsUsed.length; i++) {
      if (this.baseUnitsUsed[i]) {
        step.baseEntities.push({
          type: CONSTRAINT_TYPE_FROM_CONSTRAINT[i],
          number: CONSTRAINT_NUMBER_FROM_CONSTRAINT[i],
        });
      }
    }
    for (let i = 0; i < this.coverUnitsUsed.length; i++) {
      if (this.coverUnitsUsed[i]) {
        step.coverEntities.push({
          type: CONSTRAINT_TYPE_FROM_CONSTRAINT[i],
          number: CONSTRAINT_NUMBER_FROM_CONSTRAINT[i],
        });
      }
    }
    // candidates to delete
    set.setWords(del[0], del[1], del[2]);
    for (const idx of set) step.addCandidateToDelete(idx, candidate);
    // cannibalistic eliminations
    set.setWords(cannibalistic[0], cannibalistic[1], cannibalistic[2]);
    for (const idx of set) {
      step.addCannibalistic(idx, candidate);
      step.addCandidateToDelete(idx, candidate);
    }
    // fins (without the endo fins)
    set.setWords(fins[0] & ~endoFins[0], fins[1] & ~endoFins[1], fins[2] & ~endoFins[2]);
    for (const idx of set) step.addFin(idx, candidate);
    // endo fins
    set.setWords(endoFins[0], endoFins[1], endoFins[2]);
    for (const idx of set) step.addEndoFin(idx, candidate);
    // potential (cannibalistic) eliminations
    step.potentialEliminations.setWords(potentialEliminations[0], potentialEliminations[1], potentialEliminations[2]);
    step.potentialCannibalisticEliminations.setWords(cannibalistic[0], cannibalistic[1], cannibalistic[2]);

    // differentiate between finned and sashimi: if the type doesn't fit, cache the step
    if (this.fishType === BASIC && this.withFins && this.sashimi !== isSashimi) {
      this.cachedSteps.push(step.clone());
      return null;
    }
    return step;
  }

  /**
   * Calculates all base and cover sets for the current search. Which set is possible depends on
   * the fish category, its size (a base set in a search without fins cannot have more than `size`
   * candidates) and `lines`: if true, the base sets include the lines and the cover sets the columns
   * for basic and Franken fish.
   */
  private initForCandidate(size: number, withFins: boolean, lines: boolean): void {
    this.numberOfBaseUnits = this.numberOfAllCoverUnits = 0;
    for (let i = 0; i < ALL_CONSTRAINTS_TEMPLATES.length; i++) {
      if (i >= 18 && this.fishType === BASIC) continue; // basic fish have no blocks
      const unit = ALL_CONSTRAINTS_TEMPLATES[i];
      const t0 = unit.m0 & this.cand0;
      const t1 = unit.m1 & this.cand1;
      const t2 = unit.m2 & this.cand2;
      if (t0 === 0 && t1 === 0 && t2 === 0) continue; // no candidate in the unit
      const mutant = this.fishType === MUTANT;
      if (i < 9) {
        // the unit is a line
        if (lines || mutant) {
          this.addUnit(i, t0, t1, t2, true, size, withFins);
          if (mutant) this.addUnit(i, t0, t1, t2, false, size, withFins);
        } else {
          this.addUnit(i, t0, t1, t2, false, size, withFins);
        }
      } else if (i < 18) {
        // the unit is a column
        if (lines || mutant) {
          this.addUnit(i, t0, t1, t2, false, size, withFins);
          if (mutant) this.addUnit(i, t0, t1, t2, true, size, withFins);
        } else {
          this.addUnit(i, t0, t1, t2, true, size, withFins);
        }
      } else if (this.fishType !== BASIC) {
        // the unit is a block
        this.addUnit(i, t0, t1, t2, false, size, withFins);
        this.addUnit(i, t0, t1, t2, true, size, withFins);
      }
    }
  }

  /** Add a unit to the base or cover units. Without fins a base unit may have at most `size` candidates. */
  private addUnit(unit: number, s0: number, s1: number, s2: number, base: boolean, size: number, withFins: boolean): void {
    if (base) {
      if (withFins || size3(s0, s1, s2) <= size) {
        this.baseUnits[this.numberOfBaseUnits] = unit;
        this.baseC0[this.numberOfBaseUnits] = s0;
        this.baseC1[this.numberOfBaseUnits] = s1;
        this.baseC2[this.numberOfBaseUnits++] = s2;
      }
    } else {
      this.allCoverUnits[this.numberOfAllCoverUnits] = unit;
      this.allCoverC0[this.numberOfAllCoverUnits] = s0;
      this.allCoverC1[this.numberOfAllCoverUnits] = s1;
      this.allCoverC2[this.numberOfAllCoverUnits++] = s2;
    }
  }
}

/** Mask that contains a bit for every type of unit in `used`. */
function unitMask(used: readonly boolean[]): number {
  let mask = 0;
  for (let i = 0; i < used.length; i++) {
    if (used[i]) mask |= UNIT_MASKS[CONSTRAINT_TYPE_FROM_CONSTRAINT[i]];
  }
  return mask;
}

type FishKind = 'BASIC' | 'FINNED' | 'SASHIMI' | 'FRANKEN' | 'FINNED_FRANKEN' | 'MUTANT' | 'FINNED_MUTANT';

/** The kind and size of a fish type (Kraken fish are not handled), or null if it is no fish type. */
function classify(type: SolutionType): { size: number; kind: FishKind } | null {
  const lists: [FishKind, SolutionType[]][] = [
    ['BASIC', BASIC_TYPES],
    ['FINNED', FINNED_BASIC_TYPES],
    ['SASHIMI', SASHIMI_BASIC_TYPES],
    ['FRANKEN', FRANKEN_TYPES],
    ['FINNED_FRANKEN', FINNED_FRANKEN_TYPES],
    ['MUTANT', MUTANT_TYPES],
    ['FINNED_MUTANT', FINNED_MUTANT_TYPES],
  ];
  for (const [kind, types] of lists) {
    const i = types.indexOf(type);
    if (i !== -1) return { size: i + 2, kind };
  }
  return null;
}

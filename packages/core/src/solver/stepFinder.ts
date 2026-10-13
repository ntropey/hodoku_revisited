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
import { DEFAULT_SOLVER_OPTIONS, type SolverOptions } from '../solverOptions.js';
import { Als } from '../als.js';
import { RestrictedCommon } from '../restrictedCommon.js';
import { ALL_UNITS, ANZ_VALUES, BUDDIES, LENGTH, POSSIBLE_VALUES } from '../tables.js';
import { SudokuSet } from '../sudokuSet.js';
import { AlsSolver } from './alsSolver.js';
import { ChainSolver } from './chainSolver.js';
import { ColoringSolver } from './coloringSolver.js';
import { FishSolver } from './fishSolver.js';
import { BruteForceSolver, GiveUpSolver, IncompleteSolver } from './lastResortSolvers.js';
import { MiscellaneousSolver } from './miscellaneousSolver.js';
import { SimpleSolver } from './simpleSolver.js';
import { SingleDigitPatternSolver } from './singleDigitPatternSolver.js';
import { TablingSolver } from './tablingSolver.js';
import { UniquenessSolver } from './uniquenessSolver.js';
import { WingSolver } from './wingSolver.js';

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
  private readonly simpleSolver: SimpleSolver;

  // Data used by more than one solver; computed lazily, recomputed after every change.
  private readonly candidates = Array.from({ length: 10 }, () => new SudokuSet());
  private candidatesDirty = true;
  private readonly positions = Array.from({ length: 10 }, () => new SudokuSet());
  private positionsDirty = true;
  private readonly candidatesAllowed = Array.from({ length: 10 }, () => new SudokuSet());
  private readonly emptyCells = new SudokuSet();
  private candidatesAllowedDirty = true;

  // ALS and restricted commons cache (valid for one step number)
  private alsesOnlyLargerThanOne: Als[] | null = null;
  private alsesOnlyLargerThanOneStepNumber = -1;
  private alsesWithOne: Als[] | null = null;
  private alsesWithOneStepNumber = -1;
  private restrictedCommons: RestrictedCommon[] = [];
  /** start/end indices into `restrictedCommons` for every ALS */
  private startIndices: number[] = [];
  private endIndices: number[] = [];
  private lastRcAllowOverlap = false;
  private lastRcStepNumber = -1;
  private lastRcAlsList: Als[] | null = null;
  private lastRcOnlyForward = true;
  /** collect RCs for forward search only */
  private rcOnlyForward = true;

  /**
   * @param simpleOnly if true the finder only has a SimpleSolver (used by the tabling solver for nets)
   */
  constructor(
    readonly options: SolverOptions = { ...DEFAULT_SOLVER_OPTIONS },
    simpleOnly = false,
  ) {
    this.simpleSolver = new SimpleSolver(this);
    if (simpleOnly) {
      this.solvers = [this.simpleSolver];
      return;
    }
    // same order as in the original: the first solver that finds a step wins
    this.solvers = [this.simpleSolver, new FishSolver(this), new SingleDigitPatternSolver(this), new UniquenessSolver(this), new WingSolver(this), new ColoringSolver(this), new ChainSolver(this), new AlsSolver(this), new MiscellaneousSolver(this), new TablingSolver(this), new BruteForceSolver(this), new IncompleteSolver(this), new GiveUpSolver(this)];
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
    this.candidatesDirty = true;
    this.candidatesAllowedDirty = true;
    this.positionsDirty = true;
    this.stepNumber++;
  }

  /** For each digit 1-9 the set of cells in which it is still a candidate (index 0 unused). */
  getCandidates(): readonly SudokuSet[] {
    if (this.candidatesDirty) {
      for (let i = 1; i < 10; i++) this.candidates[i].clear();
      for (let i = 0; i < LENGTH; i++) {
        for (const cand of POSSIBLE_VALUES[this.sudoku.cells[i]]) this.candidates[cand].add(i);
      }
      this.candidatesDirty = false;
    }
    return this.candidates;
  }

  /** For each digit 1-9 the set of cells in which it is set as a value (index 0 unused). */
  getPositions(): readonly SudokuSet[] {
    if (this.positionsDirty) {
      for (let i = 1; i < 10; i++) this.positions[i].clear();
      for (let i = 0; i < LENGTH; i++) {
        const v = this.sudoku.values[i];
        if (v !== 0) this.positions[v].add(i);
      }
      this.positionsDirty = false;
    }
    return this.positions;
  }

  /** For each digit 1-9 the set of empty cells in which it is not excluded by a set value (index 0 unused). */
  getCandidatesAllowed(): readonly SudokuSet[] {
    this.initCandidatesAllowed();
    return this.candidatesAllowed;
  }

  getEmptyCells(): SudokuSet {
    this.initCandidatesAllowed();
    return this.emptyCells;
  }

  private initCandidatesAllowed(): void {
    if (!this.candidatesAllowedDirty) return;
    this.emptyCells.setAll();
    for (let i = 1; i < 10; i++) this.candidatesAllowed[i].setAll();
    for (let i = 0; i < LENGTH; i++) {
      const v = this.sudoku.values[i];
      if (v !== 0) {
        this.candidatesAllowed[v].andNot(BUDDIES[i]);
        this.emptyCells.remove(i);
      }
    }
    for (let i = 1; i < 10; i++) this.candidatesAllowed[i].and(this.emptyCells);
    this.candidatesAllowedDirty = false;
  }

  /** All Naked Singles of `sudoku` (without changing it). */
  findAllNakedSingles(sudoku: Sudoku2): SolutionStep[] {
    this.setSudoku(sudoku);
    return this.simpleSolver.findAllNakedSingles();
  }

  /** All Hidden Singles of `sudoku` (without changing it). */
  findAllHiddenSingles(sudoku: Sudoku2): SolutionStep[] {
    this.setSudoku(sudoku);
    return this.simpleSolver.findAllHiddenSingles();
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

  // ---- ALS and restricted commons (cached until the sudoku changes)

  /** All ALS of the current grid. With `onlyLargerThanOne` single cells (bivalue cells) are left out. */
  getAlses(onlyLargerThanOne = false): Als[] {
    if (onlyLargerThanOne) {
      if (this.alsesOnlyLargerThanOneStepNumber !== this.stepNumber || this.alsesOnlyLargerThanOne === null) {
        this.alsesOnlyLargerThanOne = this.doGetAlses(true);
        this.alsesOnlyLargerThanOneStepNumber = this.stepNumber;
      }
      return this.alsesOnlyLargerThanOne;
    }
    if (this.alsesWithOneStepNumber !== this.stepNumber || this.alsesWithOne === null) {
      this.alsesWithOne = this.doGetAlses(false);
      this.alsesWithOneStepNumber = this.stepNumber;
    }
    return this.alsesWithOne;
  }

  private doGetAlses(onlyLargerThanOne: boolean): Als[] {
    const alses: Als[] = [];
    const indexSet = new SudokuSet();
    const candSets = new Array<number>(10).fill(0);
    const check = (anzahl: number, startIndex: number, indexe: readonly number[]): void => {
      anzahl++;
      if (anzahl > indexe.length - 1) return;
      for (let i = startIndex; i < indexe.length; i++) {
        const houseIndex = indexe[i];
        if (this.sudoku.getValue(houseIndex) !== 0) continue;
        indexSet.add(houseIndex);
        candSets[anzahl] = candSets[anzahl - 1] | this.sudoku.getCell(houseIndex);
        if (ANZ_VALUES[candSets[anzahl]] - anzahl === 1) {
          if (!onlyLargerThanOne || indexSet.size() > 1) {
            const newAls = new Als(indexSet, candSets[anzahl]);
            if (!alses.some((a) => a.equals(newAls))) alses.push(newAls);
          }
        }
        check(anzahl, i + 1, indexe);
        indexSet.remove(houseIndex);
      }
    };
    for (const unit of ALL_UNITS) {
      for (let j = 0; j < unit.length; j++) {
        indexSet.clear();
        candSets[0] = 0;
        check(0, j, unit);
      }
    }
    for (const als of alses) als.computeFields(this.getCandidates());
    return alses;
  }

  /** Collect restricted commons for forward references only (the default) or in both directions. */
  setRcOnlyForward(onlyForward: boolean): void {
    this.rcOnlyForward = onlyForward;
  }

  getRestrictedCommons(alses: Als[], allowOverlap: boolean): RestrictedCommon[] {
    if (
      this.lastRcStepNumber !== this.stepNumber ||
      this.lastRcAllowOverlap !== allowOverlap ||
      this.lastRcAlsList !== alses ||
      this.lastRcOnlyForward !== this.rcOnlyForward
    ) {
      this.restrictedCommons = this.doGetRestrictedCommons(alses, allowOverlap);
      this.lastRcStepNumber = this.stepNumber;
      this.lastRcAllowOverlap = allowOverlap;
      this.lastRcOnlyForward = this.rcOnlyForward;
      this.lastRcAlsList = alses;
    }
    return this.restrictedCommons;
  }

  /** The index of the first RC in the RC list for every ALS. */
  getStartIndices(): number[] {
    return this.startIndices;
  }

  /** The index of the last RC + 1 in the RC list for every ALS. */
  getEndIndices(): number[] {
    return this.endIndices;
  }

  private doGetRestrictedCommons(alses: Als[], withOverlap: boolean): RestrictedCommon[] {
    this.startIndices = new Array<number>(alses.length).fill(0);
    this.endIndices = new Array<number>(alses.length).fill(0);
    const rcs: RestrictedCommon[] = [];
    const intersectionSet = new SudokuSet();
    const indexSet = new SudokuSet();
    const buddiesSet = new SudokuSet();
    for (let i = 0; i < alses.length; i++) {
      const als1 = alses[i];
      this.startIndices[i] = rcs.length;
      const start = this.rcOnlyForward ? i + 1 : 0;
      for (let j = start; j < alses.length; j++) {
        if (i === j) continue;
        const als2 = alses[j];
        intersectionSet.set(als1.indices);
        intersectionSet.and(als2.indices);
        if (!withOverlap && !intersectionSet.isEmpty()) continue;
        const possibleRestrictedCommonsSet = als1.candidates & als2.candidates;
        if (possibleRestrictedCommonsSet === 0) continue;
        let rcAnz = 0;
        let newRC: RestrictedCommon | null = null;
        for (const cand of POSSIBLE_VALUES[possibleRestrictedCommonsSet]) {
          indexSet.set(als1.indicesPerCandidat[cand]);
          indexSet.or(als2.indicesPerCandidat[cand]);
          if (!indexSet.andEmpty(intersectionSet)) continue;
          buddiesSet.setAnd(als1.buddiesAlsPerCandidat[cand], als2.buddiesAlsPerCandidat[cand]);
          // all occurrences of the candidate in both ALS see each other
          if (buddiesSet.containsSet(indexSet)) {
            if (rcAnz === 0) {
              newRC = new RestrictedCommon(i, j, cand);
              rcs.push(newRC);
            } else {
              newRC!.cand2 = cand;
            }
            rcAnz++;
          }
        }
      }
      this.endIndices[i] = rcs.length;
    }
    return rcs;
  }
}

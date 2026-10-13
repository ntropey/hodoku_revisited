/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's AlsSolver (Java).
 */
import type { Als } from '../als.js';
import { Chain } from '../chain.js';
import { RestrictedCommon } from '../restrictedCommon.js';
import { SolutionStep } from '../solutionStep.js';
import { compareTypes, type SolutionType } from '../solutionType.js';
import { SudokuSet } from '../sudokuSet.js';
import { LENGTH, MASKS, MAX_MASK, POSSIBLE_VALUES, getCol, getLine, getBuddiesOfSet } from '../tables.js';
import { AbstractSolver } from './abstractSolver.js';
import type { SudokuStepFinder } from './stepFinder.js';

/** Maximum number of RCs in an ALS chain (forward search only) */
const MAX_RC = 50;

/**
 * Restricted commons for Death Blossoms: for one cell (the stem) the ALS that can see the cell,
 * for every candidate. If the candidates with an ALS equal the candidate mask of the cell,
 * the cell is a possible stem cell.
 */
class RCForDeathBlossom {
  /** A mask with every candidate set that has at least one ALS. */
  candMask = 0;
  /** All ALS for every candidate. */
  readonly alsPerCandidate: number[][] = Array.from({ length: 10 }, () => new Array<number>(100).fill(0));
  /** Number of ALS in alsPerCandidate for every candidate. */
  readonly indices = new Array<number>(10).fill(0);

  addAlsForCandidate(als: number, candidate: number): void {
    if (this.indices[candidate] < this.alsPerCandidate[candidate].length) {
      this.alsPerCandidate[candidate][this.indices[candidate]++] = als;
      this.candMask |= MASKS[candidate];
    }
  }
}

/**
 * Sort order of ALS steps (differs from the standard order): number of eliminations (descending),
 * then equivalent steps, sum of the indices of the eliminations, number of ALS (XY-Wing after XY),
 * number of cells in all ALS, and last the type.
 */
function compareAlsSteps(o1: SolutionStep, o2: SolutionStep): number {
  const result = o2.candidatesToDelete.length - o1.candidatesToDelete.length;
  if (result !== 0) return result;
  if (!o1.isEquivalent(o2)) {
    return o1.getIndexSumme() - o2.getIndexSumme();
  }
  const alsDiff = o1.alses.length - o2.alses.length;
  if (alsDiff !== 0) return alsDiff;
  const countDiff = o1.getAlsesIndexCount() - o2.getAlsesIndexCount();
  if (countDiff !== 0) return countDiff;
  return compareTypes(o1.type, o2.type);
}

/** ALS-XZ, ALS-XY-Wing, ALS-Chain and Death Blossom. */
export class AlsSolver extends AbstractSolver {
  private alses: Als[] = [];
  private restrictedCommons: RestrictedCommon[] = [];
  private startIndices: number[] = [];
  private endIndices: number[] = [];
  /** all chains found so far: eliminations -> index of the step in `steps` */
  private readonly deletesMap = new Map<string, number>();
  private steps: SolutionStep[] = [];
  /** The step that is being assembled. */
  private globalStep = new SolutionStep('HIDDEN_SINGLE');
  /** The current ALS chain: consists only of its RCs. */
  private chain: (RestrictedCommon | null)[] = new Array<RestrictedCommon | null>(MAX_RC).fill(null);
  private chainIndex = -1;
  /** The first RC in the current chain */
  private firstRC: RestrictedCommon | null = null;
  /** Chain search: true for every ALS already in the chain. */
  private alsInChain: boolean[] = [];
  private startAls!: Als;
  private readonly restrictedCommonBuddiesSet = new SudokuSet();
  private readonly restrictedCommonIndexSet = new SudokuSet();
  // Death Blossom state
  private rcdb: (RCForDeathBlossom | null)[] = new Array<RCForDeathBlossom | null>(LENGTH).fill(null);
  private aktRcdb!: RCForDeathBlossom;
  private readonly aktDBIndices = new SudokuSet();
  private aktDBCandidates = 0;
  private readonly incDBCand = new Array<number>(10).fill(0);
  private readonly aktDBAls = new Array<number>(10).fill(-1);
  private readonly dbIndicesPerCandidate = new SudokuSet();
  private maxDBCand = 0;
  private stemCellIndex = 0;
  private readonly tmpSet = new SudokuSet();
  private readonly tmpSet1 = new SudokuSet();

  constructor(finder: SudokuStepFinder) {
    super(finder);
  }

  getStep(type: SolutionType): SolutionStep | null {
    this.sudoku = this.finder.getSudoku();
    this.finder.setRcOnlyForward(true);
    switch (type) {
      case 'ALS_XZ':
        return this.getAlsXZ();
      case 'ALS_XY_WING':
        return this.getAlsXYWing();
      case 'ALS_XY_CHAIN':
        if (this.chain.length !== MAX_RC) this.chain = new Array<RestrictedCommon | null>(MAX_RC).fill(null);
        return this.getAlsXYChain();
      case 'DEATH_BLOSSOM':
        return this.getAlsDeathBlossom();
      default:
        return null;
    }
  }

  doStep(step: SolutionStep): boolean {
    this.sudoku = this.finder.getSudoku();
    switch (step.type) {
      case 'ALS_XZ':
      case 'ALS_XY_WING':
      case 'ALS_XY_CHAIN':
      case 'DEATH_BLOSSOM':
        for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
        return true;
      default:
        return false;
    }
  }

  private getAlsDeathBlossom(): SolutionStep | null {
    this.steps = [];
    this.collectAllAlses();
    this.collectAllRCsForDeathBlossom();
    return this.getAlsDeathBlossomInt(true);
  }

  /** All ALS-XZ, ALS-XY-Wing and ALS-Chain steps that were asked for, each group sorted. */
  getAllAlses(doXz: boolean, doXy: boolean, doChain: boolean): SolutionStep[] {
    this.sudoku = this.finder.getSudoku();
    const old = this.steps;
    const result: SolutionStep[] = [];
    const options = this.finder.options;
    this.finder.setRcOnlyForward(options.allStepsAlsChainForwardOnly);
    if (this.chain.length === MAX_RC) {
      this.chain = new Array<RestrictedCommon | null>(options.allStepsAlsChainLength).fill(null);
    }
    this.collectAllAlses();
    this.collectAllRestrictedCommons(options.allowAlsOverlap);
    if (doXz) {
      this.steps = [];
      this.getAlsXZInt(false);
      this.steps.sort(compareAlsSteps);
      result.push(...this.steps);
    }
    if (doXy) {
      this.steps = [];
      this.getAlsXYWingInt(false);
      this.steps.sort(compareAlsSteps);
      result.push(...this.steps);
    }
    if (doChain) {
      this.steps = [];
      this.getAlsXYChainInt();
      this.steps.sort(compareAlsSteps);
      result.push(...this.steps);
    }
    this.steps = old;
    return result;
  }

  /** All Death Blossoms (sorted). */
  getAllDeathBlossoms(): SolutionStep[] {
    this.sudoku = this.finder.getSudoku();
    const old = this.steps;
    this.collectAllAlses();
    this.collectAllRCsForDeathBlossom();
    this.steps = [];
    this.getAlsDeathBlossomInt(false);
    const result = [...this.steps].sort(compareAlsSteps);
    this.steps = old;
    return result;
  }

  private getAlsXYChain(): SolutionStep | null {
    this.steps = [];
    this.collectAllAlses();
    this.collectAllRestrictedCommons(this.finder.options.allowAlsOverlap);
    this.getAlsXYChainInt();
    if (this.steps.length > 0) {
      this.steps.sort(compareAlsSteps);
      return this.steps[0];
    }
    return null;
  }

  private getAlsXYWing(): SolutionStep | null {
    this.steps = [];
    this.collectAllAlses();
    this.collectAllRestrictedCommons(this.finder.options.allowAlsOverlap);
    return this.getAlsXYWingInt(true);
  }

  private getAlsXZ(): SolutionStep | null {
    this.steps = [];
    this.collectAllAlses();
    this.collectAllRestrictedCommons(this.finder.options.allowAlsOverlap);
    return this.getAlsXZInt(true);
  }

  /**
   * Check all restricted commons: for every RC check all candidates common to both ALS but minus the
   * RC candidate(s). If buddies exist outside the ALS they can be eliminated.
   *
   * Doubly linked ALS-XZ: if two ALS are linked by 2 RCs, the rest of each ALS becomes a locked
   * set and eliminates additional candidates; each of the two RCs can be used for "normal" ALS-XZ
   * eliminations as well.
   */
  private getAlsXZInt(onlyOne: boolean): SolutionStep | null {
    for (const rc of this.restrictedCommons) {
      if (rc.als1 > rc.als2) continue;
      const step = new SolutionStep('ALS_XZ');
      this.globalStep = step;
      const als1 = this.alses[rc.als1];
      const als2 = this.alses[rc.als2];
      this.checkCandidatesToDelete(als1, als2, rc.cand1);
      if (rc.cand2 !== 0) {
        this.checkCandidatesToDelete(als1, als2, rc.cand2);
        const d1 = this.checkDoublyLinkedAls(als1, als2, rc.cand1, rc.cand2);
        const d2 = this.checkDoublyLinkedAls(als2, als1, rc.cand1, rc.cand2);
        if (d1 || d2) step.fins = [];
      }
      if (step.candidatesToDelete.length > 0) {
        step.addAls(als1.indices, als1.candidates);
        step.addAls(als2.indices, als2.candidates);
        this.addRestrictedCommonToStep(als1, als2, rc.cand1, false);
        if (rc.cand2 !== 0) this.addRestrictedCommonToStep(als1, als2, rc.cand2, false);
        if (onlyOne) return step;
        this.steps.push(step);
      }
    }
    return null;
  }

  /**
   * Check all combinations of two RCs for an ALS XY-Wing: three different ALS are needed, and if
   * both RCs have only one candidate those candidates must differ. Then ALS C is identified and
   * ALS A and B are checked for eliminations.
   */
  private getAlsXYWingInt(onlyOne: boolean): SolutionStep | null {
    const rcs = this.restrictedCommons;
    for (let i = 0; i < rcs.length; i++) {
      const rc1 = rcs[i];
      for (let j = i + 1; j < rcs.length; j++) {
        const rc2 = rcs[j];
        if (rc1.cand2 === 0 && rc2.cand2 === 0 && rc1.cand1 === rc2.cand1) continue;
        // one ALS must be shared (C), the other two must differ
        if (
          !(
            (rc1.als1 === rc2.als1 && rc1.als2 !== rc2.als2) ||
            (rc1.als2 === rc2.als1 && rc1.als1 !== rc2.als2) ||
            (rc1.als1 === rc2.als2 && rc1.als2 !== rc2.als1) ||
            (rc1.als2 === rc2.als2 && rc1.als1 !== rc2.als1)
          )
        ) {
          continue;
        }
        // like the original, later matches overwrite earlier ones
        let a: Als | null = null;
        let b: Als | null = null;
        let c: Als | null = null;
        if (rc1.als1 === rc2.als1) {
          c = this.alses[rc1.als1];
          a = this.alses[rc1.als2];
          b = this.alses[rc2.als2];
        }
        if (rc1.als1 === rc2.als2) {
          c = this.alses[rc1.als1];
          a = this.alses[rc1.als2];
          b = this.alses[rc2.als1];
        }
        if (rc1.als2 === rc2.als1) {
          c = this.alses[rc1.als2];
          a = this.alses[rc1.als1];
          b = this.alses[rc2.als2];
        }
        if (rc1.als2 === rc2.als2) {
          c = this.alses[rc1.als2];
          a = this.alses[rc1.als1];
          b = this.alses[rc2.als1];
        }
        if (a === null || b === null || c === null) continue;
        if (!this.finder.options.allowAlsOverlap) {
          this.tmpSet.set(a.indices);
          if (!this.tmpSet.andEmpty(b.indices)) continue;
        }
        this.tmpSet.set(a.indices);
        this.tmpSet.or(b.indices);
        if (this.tmpSet.equals(a.indices) || this.tmpSet.equals(b.indices)) continue;
        const step = new SolutionStep('ALS_XY_WING');
        this.globalStep = step;
        this.checkCandidatesToDelete(a, b, rc1.cand1, rc1.cand2, rc2.cand1, rc2.cand2);
        if (step.candidatesToDelete.length > 0) {
          step.addAls(a.indices, a.candidates);
          step.addAls(b.indices, b.candidates);
          step.addAls(c.indices, c.candidates);
          this.addRestrictedCommonToStep(a, c, rc1.cand1, false);
          if (rc1.cand2 !== 0) this.addRestrictedCommonToStep(a, c, rc1.cand2, false);
          this.addRestrictedCommonToStep(b, c, rc2.cand1, false);
          if (rc2.cand2 !== 0) this.addRestrictedCommonToStep(b, c, rc2.cand2, false);
          if (onlyOne) return step;
          this.steps.push(step);
        }
      }
    }
    return null;
  }

  /**
   * ALS chains: all combinations starting with every ALS. Rules: two adjacent ALS may overlap as long
   * as the overlapping area doesn't contain an RC; two non adjacent ALS may overlap without
   * restrictions; a chain must be at least 4 ALS long; start and end ALS must have a common
   * candidate outside the chain which can be eliminated. Adjacent RCs follow the adjacency rules
   * (see RestrictedCommon.checkRC). Loops and whips are not handled.
   */
  private getAlsXYChainInt(): void {
    this.deletesMap.clear();
    for (let i = 0; i < this.alses.length; i++) {
      this.startAls = this.alses[i];
      this.chainIndex = 0;
      if (this.alsInChain.length < this.alses.length) this.alsInChain = new Array<boolean>(this.alses.length).fill(false);
      else this.alsInChain.fill(false);
      this.alsInChain[i] = true;
      this.firstRC = null;
      this.getAlsXYChainRecursive(i, null);
    }
  }

  /**
   * For ALS `alsIndex` check all RCs. If the RC fulfills the adjacency rules and the ALS it points to
   * is not in the chain yet, add it and continue recursively. From chain size 4 on every step is
   * tested for eliminations. If the first RC has two candidates both are tried independently.
   */
  private getAlsXYChainRecursive(alsIndex: number, lastRC: RestrictedCommon | null): void {
    if (this.chainIndex >= this.chain.length) return;
    let firstTry = true;
    for (let i = this.startIndices[alsIndex]; i < this.endIndices[alsIndex]; i++) {
      const rc = this.restrictedCommons[i];
      if (this.chainIndex >= this.chain.length || !rc.checkRC(lastRC, firstTry)) continue;
      if (this.alsInChain[rc.als2]) continue;
      const aktAls = this.alses[rc.als2];
      if (this.chainIndex === 0) this.firstRC = rc;
      this.chain[this.chainIndex++] = rc;
      this.alsInChain[rc.als2] = true;
      if (this.chainIndex >= 3) {
        const firstRC = this.firstRC!;
        const step = new SolutionStep('ALS_XY_CHAIN');
        this.globalStep = step;
        let c1 = firstRC.cand1;
        let c2 = firstRC.cand2;
        let c3 = 0;
        let c4 = 0;
        if (firstRC.actualRC === 1) c2 = 0;
        else if (firstRC.actualRC === 2) c1 = 0;
        if (rc.actualRC === 1) {
          c3 = rc.cand1;
        } else if (rc.actualRC === 2) {
          c3 = rc.cand2;
        } else if (rc.actualRC === 3) {
          c3 = rc.cand1;
          c4 = rc.cand2;
        }
        this.checkCandidatesToDelete(this.startAls, aktAls, c1, c2, c3, c4, null);
        if (step.candidatesToDelete.length > 0) {
          step.addAls(this.startAls.indices, this.startAls.candidates);
          let tmpAls = this.startAls;
          for (let j = 0; j < this.chainIndex; j++) {
            const cj = this.chain[j]!;
            const tmp = this.alses[cj.als2];
            step.addAls(tmp.indices, tmp.candidates);
            step.restrictedCommons.push(cj.clone());
            if (cj.actualRC === 1 || cj.actualRC === 3) this.addRestrictedCommonToStep(tmpAls, tmp, cj.cand1, true);
            if (cj.actualRC === 2 || cj.actualRC === 3) this.addRestrictedCommonToStep(tmpAls, tmp, cj.cand2, true);
            tmpAls = tmp;
          }
          let writeIt = true;
          let replaceIndex = -1;
          let elim: string | null = null;
          if (this.finder.options.onlyOneAlsPerStep) {
            elim = step.getCandidateKey();
            const alreadyThere = this.deletesMap.get(elim);
            if (alreadyThere !== undefined) {
              // keep the step with fewer cells in all ALS
              if (this.steps[alreadyThere].getAlsesIndexCount() > step.getAlsesIndexCount()) {
                replaceIndex = alreadyThere;
              } else {
                writeIt = false;
              }
            }
          }
          if (writeIt) {
            if (replaceIndex !== -1) {
              this.steps[replaceIndex] = step;
            } else {
              this.steps.push(step);
              if (elim !== null) this.deletesMap.set(elim, this.steps.length - 1);
            }
          }
        }
      }
      this.getAlsXYChainRecursive(rc.als2, rc);
      this.alsInChain[rc.als2] = false;
      this.chainIndex--;
      if (lastRC === null) {
        if (rc.cand2 !== 0 && firstTry) {
          firstTry = false;
          i--;
        } else {
          firstTry = true;
        }
      }
    }
  }

  /**
   * Death Blossom: a stem cell with at least one ALS for every candidate. Every combination of
   * (non overlapping) ALS is checked for common candidates that eliminate candidates outside the
   * ALS and the stem cell. The ALS/cell combinations must already be in `rcdb`.
   */
  private getAlsDeathBlossomInt(onlyOne: boolean): SolutionStep | null {
    this.deletesMap.clear();
    this.globalStep = new SolutionStep('DEATH_BLOSSOM');
    for (let i = 0; i < LENGTH; i++) {
      if (this.sudoku.getValue(i) !== 0) continue;
      const entry = this.rcdb[i];
      if (entry === null || this.sudoku.getCell(i) !== entry.candMask) continue;
      this.stemCellIndex = i;
      this.aktRcdb = entry;
      this.maxDBCand = 0;
      for (let j = 1; j <= 9; j++) {
        if (entry.indices[j] > 0) this.maxDBCand = j;
      }
      this.aktDBIndices.clear();
      this.aktDBCandidates = MAX_MASK;
      this.aktDBAls.fill(-1);
      const step = this.checkAlsDeathBlossomRecursive(1, onlyOne);
      if (onlyOne && step !== null) return step;
    }
    return null;
  }

  /** Try all ALS for `cand` in the stem cell; at the last candidate check the eliminations. */
  private checkAlsDeathBlossomRecursive(cand: number, onlyOne: boolean): SolutionStep | null {
    if (cand > this.maxDBCand) return null;
    const aktRcdb = this.aktRcdb;
    if (aktRcdb.indices[cand] > 0) {
      for (let i = 0; i < aktRcdb.indices[cand]; i++) {
        const als = this.alses[aktRcdb.alsPerCandidate[cand][i]];
        if (!this.finder.options.allowAlsOverlap && als.indices.intersects(this.aktDBIndices)) continue;
        if ((this.aktDBCandidates & als.candidates) === 0) continue;
        this.aktDBAls[cand] = aktRcdb.alsPerCandidate[cand][i];
        this.incDBCand[cand] = this.aktDBCandidates & ~als.candidates;
        this.aktDBCandidates &= als.candidates;
        this.aktDBIndices.or(als.indices);
        if (cand < this.maxDBCand) {
          const step = this.checkAlsDeathBlossomRecursive(cand + 1, onlyOne);
          if (onlyOne && step !== null) return step;
        } else {
          let found = false;
          const step = this.globalStep;
          for (const checkCand of POSSIBLE_VALUES[this.aktDBCandidates]) {
            if (this.aktDBAls[checkCand] !== -1) continue;
            let first = true;
            for (let k = 0; k < this.aktDBAls.length; k++) {
              if (this.aktDBAls[k] === -1) continue;
              if (first) {
                this.dbIndicesPerCandidate.set(this.alses[this.aktDBAls[k]].indicesPerCandidat[checkCand]);
                first = false;
              } else {
                this.dbIndicesPerCandidate.or(this.alses[this.aktDBAls[k]].indicesPerCandidat[checkCand]);
              }
            }
            getBuddiesOfSet(this.dbIndicesPerCandidate, this.tmpSet);
            this.tmpSet.andNot(this.aktDBIndices);
            this.tmpSet.remove(this.stemCellIndex);
            this.tmpSet.and(this.finder.getCandidates()[checkCand]);
            if (!this.tmpSet.isEmpty()) {
              found = true;
              for (const k of this.tmpSet) step.addCandidateToDelete(k, checkCand);
            }
          }
          if (found) {
            step.addIndex(this.stemCellIndex);
            for (let k = 1; k <= 9; k++) {
              if (this.aktDBAls[k] === -1) continue;
              const tmpAls = this.alses[this.aktDBAls[k]];
              for (const l of tmpAls.indicesPerCandidat[k]) step.addFin(l, k);
              step.addFin(this.stemCellIndex, k);
              step.addAls(tmpAls.indices, tmpAls.candidates);
              step.restrictedCommons.push(new RestrictedCommon(0, 0, k, 0, 1));
            }
            let writeIt = true;
            let replaceIndex = -1;
            let elim: string | null = null;
            if (this.finder.options.onlyOneAlsPerStep) {
              elim = step.getCandidateKey();
              const alreadyThere = this.deletesMap.get(elim);
              if (alreadyThere !== undefined) {
                // a step for the same eliminations exists: keep the one with fewer cells in all ALS
                if (this.steps[alreadyThere].getAlsesIndexCount() > step.getAlsesIndexCount()) replaceIndex = alreadyThere;
                else writeIt = false;
              }
            }
            if (writeIt) {
              if (replaceIndex !== -1) {
                this.steps[replaceIndex] = step;
              } else {
                if (onlyOne) return step;
                this.steps.push(step);
                if (elim !== null) this.deletesMap.set(elim, this.steps.length - 1);
              }
            }
            this.globalStep = new SolutionStep('DEATH_BLOSSOM');
          }
        }
        this.aktDBCandidates |= this.incDBCand[cand];
        this.aktDBIndices.andNot(als.indices);
      }
    } else {
      this.aktDBAls[cand] = -1;
      const step = this.checkAlsDeathBlossomRecursive(cand + 1, onlyOne);
      if (onlyOne && step !== null) return step;
    }
    return null;
  }

  private checkCandidatesToDelete(
    als1: Als,
    als2: Als,
    restr1: number,
    restr2 = -1,
    restr3 = -1,
    restr4 = -1,
    forbiddenIndices: SudokuSet | null = null,
  ): void {
    const step = this.globalStep;
    let possibleRestrictedCommonsSet = als1.candidates & als2.candidates;
    if (restr1 !== -1 && restr1 !== 0) possibleRestrictedCommonsSet &= ~MASKS[restr1];
    if (restr2 !== -1 && restr2 !== 0) possibleRestrictedCommonsSet &= ~MASKS[restr2];
    if (restr3 !== -1 && restr3 !== 0) possibleRestrictedCommonsSet &= ~MASKS[restr3];
    if (restr4 !== -1 && restr4 !== 0) possibleRestrictedCommonsSet &= ~MASKS[restr4];
    if (possibleRestrictedCommonsSet === 0) return;
    // can the two ALS have common buddies at all?
    this.tmpSet.set(als1.buddies);
    if (this.tmpSet.andEmpty(als2.buddies)) return;
    for (const cand of POSSIBLE_VALUES[possibleRestrictedCommonsSet]) {
      const buddiesSet = this.restrictedCommonBuddiesSet;
      buddiesSet.set(als1.buddiesPerCandidat[cand]);
      buddiesSet.and(als2.buddiesPerCandidat[cand]);
      if (forbiddenIndices !== null) buddiesSet.andNot(forbiddenIndices);
      if (!buddiesSet.isEmpty()) {
        for (const l of buddiesSet) step.addCandidateToDelete(l, cand);
        this.tmpSet1.set(als1.indicesPerCandidat[cand]);
        this.tmpSet1.or(als2.indicesPerCandidat[cand]);
        for (const l of this.tmpSet1) step.addFin(l, cand);
      }
    }
  }

  /**
   * Add all cells that contain `cand` in both ALS as endo fins to the step (display only). With
   * `withChain` a chain is added between the pair of cells in both ALS with the smallest distance.
   */
  private addRestrictedCommonToStep(als1: Als, als2: Als, cand: number, withChain: boolean): void {
    const step = this.globalStep;
    this.tmpSet.set(als1.indicesPerCandidat[cand]);
    this.tmpSet.or(als2.indicesPerCandidat[cand]);
    for (const i of this.tmpSet) step.addEndoFin(i, cand);
    if (withChain) {
      let minDist = Number.MAX_SAFE_INTEGER;
      let minIndex1 = -1;
      let minIndex2 = -1;
      for (const index1 of als1.indicesPerCandidat[cand]) {
        for (const index2 of als2.indicesPerCandidat[cand]) {
          const dx = getLine(index1) - getLine(index2);
          const dy = getCol(index1) - getCol(index2);
          const dist = dx * dx + dy * dy;
          if (dist < minDist) {
            minDist = dist;
            minIndex1 = index1;
            minIndex2 = index2;
          }
        }
      }
      step.addChain(0, 1, [Chain.makeSEntry(minIndex1, cand, false), Chain.makeSEntry(minIndex2, cand, false)]);
    }
  }

  /**
   * als1 and als2 are doubly linked by RCs rc1 and rc2; check whether the locked set
   * {als1 - rc1 - rc2} can eliminate candidates that are not in als2. Has to be called twice
   * with als1 and als2 swapped.
   */
  private checkDoublyLinkedAls(als1: Als, als2: Als, rc1: number, rc2: number): boolean {
    let isDoubly = false;
    const possible = als1.candidates & ~MASKS[rc1] & ~MASKS[rc2];
    if (possible === 0) return false;
    for (const cand of POSSIBLE_VALUES[possible]) {
      this.restrictedCommonIndexSet.set(als1.buddiesPerCandidat[cand]);
      this.restrictedCommonIndexSet.andNot(als2.indices);
      if (!this.restrictedCommonIndexSet.isEmpty()) {
        for (const j of this.restrictedCommonIndexSet) {
          this.globalStep.addCandidateToDelete(j, cand);
          isDoubly = true;
        }
      }
    }
    return isDoubly;
  }

  private collectAllRestrictedCommons(withOverlap: boolean): void {
    this.restrictedCommons = this.finder.getRestrictedCommons(this.alses, withOverlap);
    this.startIndices = this.finder.getStartIndices();
    this.endIndices = this.finder.getEndIndices();
  }

  private collectAllAlses(): void {
    this.alses = this.finder.getAlses();
  }

  /**
   * For every cell that is not yet set an RCForDeathBlossom is created: it collects the ALS that
   * see the cell for every candidate. In getAlsDeathBlossomInt its candidate mask is compared with
   * the real candidate mask of the cell: if equal, a Death Blossom is possible.
   */
  private collectAllRCsForDeathBlossom(): void {
    this.rcdb.fill(null);
    for (let i = 0; i < this.alses.length; i++) {
      const act = this.alses[i];
      for (let j = 1; j <= 9; j++) {
        if ((act.candidates & MASKS[j]) === 0) continue;
        for (const index of act.buddiesPerCandidat[j]) {
          let entry = this.rcdb[index];
          if (entry === null) {
            entry = new RCForDeathBlossom();
            this.rcdb[index] = entry;
          }
          entry.addAlsForCandidate(i, j);
        }
      }
    }
  }
}

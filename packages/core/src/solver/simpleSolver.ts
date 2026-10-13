/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's SimpleSolver (Java).
 */
import { SolutionStep } from '../solutionStep.js';
import { isHiddenSubset, type SolutionType } from '../solutionType.js';
import {
  ALL_UNITS,
  ANZ_VALUES,
  BLOCKS,
  COLS,
  CONSTRAINTS,
  CONSTRAINT_NUMBER_FROM_CONSTRAINT,
  CONSTRAINT_TYPE_FROM_CONSTRAINT,
  LINES,
  MASKS,
  POSSIBLE_VALUES,
  UNITS,
} from '../tables.js';
import { AbstractSolver } from './abstractSolver.js';
import type { SudokuStepFinder } from './stepFinder.js';

type Units = readonly (readonly number[])[];

/**
 * Singles, Locked Candidates, Locked and Naked Subsets, Hidden Subsets.
 *
 * Step order and the caching of Naked/Locked subsets match the original, so
 * that the solver finds the same step first.
 */
export class SimpleSolver extends AbstractSolver {
  /** The list with all newly found steps (used when searching for all steps). */
  private steps: SolutionStep[] = [];
  private sameConstraint: boolean[] = [false, false, false];
  private foundConstraint: boolean[] = [false, false, false];
  private constraint: number[] = [0, 0, 0];
  /** Steps that were found but cannot be used right now. */
  private cachedSteps: SolutionStep[] = [];
  /** finder.stepNumber that was valid when cachedSteps was filled. */
  private cachedStepsNumber = -1;
  private tmpArr1: number[] = new Array<number>(9).fill(0);
  /** Bitmaps for indices per candidate in one unit. */
  private ipcMask: number[] = new Array<number>(10).fill(0);

  constructor(finder: SudokuStepFinder) {
    super(finder);
  }

  getStep(type: SolutionType): SolutionStep | null {
    this.sudoku = this.finder.getSudoku();
    switch (type) {
      case 'FULL_HOUSE':
        return this.findFullHouse();
      case 'HIDDEN_SINGLE':
        return this.findHiddenSingle();
      case 'HIDDEN_PAIR':
        return this.findHiddenXle(2);
      case 'HIDDEN_TRIPLE':
        return this.findHiddenXle(3);
      case 'HIDDEN_QUADRUPLE':
        return this.findHiddenXle(4);
      case 'NAKED_SINGLE':
        return this.findNakedSingle();
      case 'LOCKED_PAIR':
        return this.findNakedXle(2, true);
      case 'NAKED_PAIR':
        return this.findNakedXle(2, false);
      case 'LOCKED_TRIPLE':
        return this.findNakedXle(3, true);
      case 'NAKED_TRIPLE':
        return this.findNakedXle(3, false);
      case 'NAKED_QUADRUPLE':
        return this.findNakedXle(4, false);
      case 'LOCKED_CANDIDATES':
      case 'LOCKED_CANDIDATES_1':
      case 'LOCKED_CANDIDATES_2':
        return this.findLockedCandidates(type);
      default:
        return null;
    }
  }

  doStep(step: SolutionStep): boolean {
    this.sudoku = this.finder.getSudoku();
    switch (step.type) {
      case 'FULL_HOUSE':
      case 'HIDDEN_SINGLE':
      case 'NAKED_SINGLE':
        this.sudoku.setCell(step.indices[0], step.values[0]);
        return true;
      case 'HIDDEN_PAIR':
      case 'HIDDEN_TRIPLE':
      case 'HIDDEN_QUADRUPLE':
      case 'NAKED_PAIR':
      case 'NAKED_TRIPLE':
      case 'NAKED_QUADRUPLE':
      case 'LOCKED_PAIR':
      case 'LOCKED_TRIPLE':
      case 'LOCKED_CANDIDATES':
      case 'LOCKED_CANDIDATES_1':
      case 'LOCKED_CANDIDATES_2':
        for (const cand of step.candidatesToDelete) {
          this.sudoku.delCandidate(cand.index, cand.value);
        }
        return true;
      default:
        return false;
    }
  }

  /**
   * Full House: last unset cell in a unit. A Full House is always also a
   * Naked Single, so the Naked Single queue is traversed and the other
   * candidates in the unit are checked.
   */
  private findFullHouse(): SolutionStep | null {
    const free = this.sudoku.free;
    const nsQueue = this.sudoku.nsQueue;
    let queueIndex = nsQueue.getFirstIndex();
    while (queueIndex !== -1) {
      const index = nsQueue.getIndex(queueIndex);
      const value = nsQueue.getValue(queueIndex);
      if (this.sudoku.getValue(index) === 0) {
        for (const constr of CONSTRAINTS[index]) {
          let valid = true;
          for (let j = 1; j <= 9; j++) {
            // all candidates except value have to be 0
            if (j !== value && free[constr][j] !== 0) {
              valid = false;
              break;
            }
          }
          if (valid) {
            const step = new SolutionStep('FULL_HOUSE');
            step.addValue(value);
            step.addIndex(index);
            return step;
          }
        }
      }
      queueIndex = nsQueue.getNextIndex();
    }
    return null;
  }

  /** All Naked Singles in the queue (the queue is not changed). */
  findAllNakedSingles(): SolutionStep[] {
    this.sudoku = this.finder.getSudoku();
    const result: SolutionStep[] = [];
    const nsQueue = this.sudoku.nsQueue;
    let queueIndex = nsQueue.getFirstIndex();
    while (queueIndex !== -1) {
      const index = nsQueue.getIndex(queueIndex);
      const value = nsQueue.getValue(queueIndex);
      if (this.sudoku.getValue(index) === 0) {
        const step = new SolutionStep('NAKED_SINGLE');
        step.addValue(value);
        step.addIndex(index);
        result.push(step);
      }
      queueIndex = nsQueue.getNextIndex();
    }
    return result.sort((a, b) => a.compareTo(b));
  }

  /**
   * All Hidden Singles in the queue (the queue is not changed). Only one single is recorded
   * per cell.
   */
  findAllHiddenSingles(): SolutionStep[] {
    this.sudoku = this.finder.getSudoku();
    const result: SolutionStep[] = [];
    const singleFound = new Array<boolean>(81).fill(false);
    const free = this.sudoku.free;
    const hsQueue = this.sudoku.hsQueue;
    let queueIndex = hsQueue.getFirstIndex();
    while (queueIndex !== -1) {
      const index = hsQueue.getIndex(queueIndex);
      const value = hsQueue.getValue(queueIndex);
      if (this.sudoku.getValue(index) === 0 && !singleFound[index]) {
        // the cell is still a valid Hidden Single and wasn't found yet; which unit?
        for (let i = 0; i < CONSTRAINTS[index].length; i++) {
          if (free[CONSTRAINTS[index][i]][value] === 1) {
            const step = new SolutionStep('HIDDEN_SINGLE');
            step.addValue(value);
            step.addIndex(index);
            step.entity = i;
            result.push(step);
            singleFound[index] = true;
            break;
          }
        }
      }
      queueIndex = hsQueue.getNextIndex();
    }
    return result.sort((a, b) => a.compareTo(b));
  }

  /** The next Naked Single in the grid (removed from the queue). */
  private findNakedSingle(): SolutionStep | null {
    const nsQueue = this.sudoku.nsQueue;
    let queueIndex: number;
    while ((queueIndex = nsQueue.getSingle()) !== -1) {
      const index = nsQueue.getIndex(queueIndex);
      const value = nsQueue.getValue(queueIndex);
      if (this.sudoku.getValue(index) === 0) {
        const step = new SolutionStep('NAKED_SINGLE');
        step.addValue(value);
        step.addIndex(index);
        return step;
      }
    }
    return null;
  }

  /** The next Hidden Single in the grid (removed from the queue). */
  private findHiddenSingle(): SolutionStep | null {
    const free = this.sudoku.free;
    const hsQueue = this.sudoku.hsQueue;
    let queueIndex: number;
    while ((queueIndex = hsQueue.getSingle()) !== -1) {
      const index = hsQueue.getIndex(queueIndex);
      const value = hsQueue.getValue(queueIndex);
      if (this.sudoku.getValue(index) === 0) {
        // cell is still a valid Hidden Single; which constraint?
        for (const constr of CONSTRAINTS[index]) {
          if (free[constr][value] === 1) {
            const step = new SolutionStep('HIDDEN_SINGLE');
            step.addValue(value);
            step.addIndex(index);
            return step;
          }
        }
        // the original stops at the first queue entry whose cell is unset, found or not
        return null;
      }
    }
    return null;
  }

  /**
   * The next Naked Subset of size `anz`. If `lockedOnly` is true only Locked
   * Subsets are found and Naked Subsets are cached. If the step number has
   * not changed since the last call, the cache is searched first.
   */
  private findNakedXle(anz: number, lockedOnly: boolean): SolutionStep | null {
    this.steps = [];

    if (this.cachedSteps.length > 0 && this.cachedStepsNumber === this.finder.getStepNumber()) {
      let type: SolutionType = 'NAKED_PAIR';
      if (anz === 2 && lockedOnly) type = 'LOCKED_PAIR';
      if (anz === 3 && !lockedOnly) type = 'NAKED_TRIPLE';
      if (anz === 3 && lockedOnly) type = 'LOCKED_TRIPLE';
      if (anz === 4) type = 'NAKED_QUADRUPLE';
      for (const step of this.cachedSteps) {
        if (step.type === type) return step;
      }
    }

    // cache was useless, try to find a step
    this.cachedSteps = [];
    this.cachedStepsNumber = this.finder.getStepNumber();
    // blocks first: guarantees to find all Locked Subsets in one call
    let step = this.findNakedXleInEntity(BLOCKS, anz, lockedOnly, !lockedOnly, true);
    if (step !== null || lockedOnly) return step;
    step = this.findNakedXleInEntity(LINES, anz, lockedOnly, !lockedOnly, true);
    if (step !== null) return step;
    return this.findNakedXleInEntity(COLS, anz, lockedOnly, !lockedOnly, true);
  }

  /**
   * Searches for Naked Subsets in a group of units. Uses nested loops instead
   * of recursion, like the original.
   */
  private findNakedXleInEntity(
    indices: Units,
    anz: number,
    lockedOnly: boolean,
    nakedOnly: boolean,
    onlyOne: boolean,
  ): SolutionStep | null {
    const tmp = this.tmpArr1;
    for (let entity = 0; entity < indices.length; entity++) {
      // cells of the unit that hold no more than anz candidates (set cells have none -> excluded by != 0)
      let maxIndex = 0;
      for (let i = 0; i < indices[entity].length; i++) {
        const tmpAnz = ANZ_VALUES[this.sudoku.getCell(indices[entity][i])];
        if (tmpAnz !== 0 && tmpAnz <= anz) tmp[maxIndex++] = indices[entity][i];
      }
      if (maxIndex < anz) continue; // not enough cells -> no Naked Subset possible

      for (let i1 = 0; i1 < maxIndex - anz + 1; i1++) {
        const cell1 = this.sudoku.getCell(tmp[i1]);
        for (let i2 = i1 + 1; i2 < maxIndex - anz + 2; i2++) {
          const cell2 = cell1 | this.sudoku.getCell(tmp[i2]);
          if (ANZ_VALUES[cell2] > anz) continue;
          if (anz === 2) {
            if (ANZ_VALUES[cell2] === anz) {
              const step = this.createSubsetStep([tmp[i1], tmp[i2]], cell2, 'NAKED_PAIR', lockedOnly, nakedOnly);
              if (step !== null && onlyOne) return step;
            }
          } else {
            for (let i3 = i2 + 1; i3 < maxIndex - anz + 3; i3++) {
              const cell3 = cell2 | this.sudoku.getCell(tmp[i3]);
              if (ANZ_VALUES[cell3] > anz) continue;
              if (anz === 3) {
                if (ANZ_VALUES[cell3] === anz) {
                  const step = this.createSubsetStep(
                    [tmp[i1], tmp[i2], tmp[i3]],
                    cell3,
                    'NAKED_TRIPLE',
                    lockedOnly,
                    nakedOnly,
                  );
                  if (step !== null && onlyOne) return step;
                }
              } else {
                for (let i4 = i3 + 1; i4 < maxIndex; i4++) {
                  const cell4 = cell3 | this.sudoku.getCell(tmp[i4]);
                  if (ANZ_VALUES[cell4] > anz) continue;
                  if (ANZ_VALUES[cell4] === anz) {
                    const step = this.createSubsetStep(
                      [tmp[i1], tmp[i2], tmp[i3], tmp[i4]],
                      cell4,
                      'NAKED_QUADRUPLE',
                      lockedOnly,
                      nakedOnly,
                    );
                    if (step !== null && onlyOne) return step;
                  }
                }
              }
            }
          }
        }
      }
    }
    return null;
  }

  /** The next Hidden Subset with size `anz` (blocks first, then lines, then columns). */
  private findHiddenXle(anz: number): SolutionStep | null {
    this.steps = [];
    return (
      this.findHiddenXleInEntity(2 * UNITS, BLOCKS, anz, true) ??
      this.findHiddenXleInEntity(0, LINES, anz, true) ??
      this.findHiddenXleInEntity(UNITS, COLS, anz, true)
    );
  }

  private findHiddenXleInEntity(
    constraintBase: number,
    indices: Units,
    anz: number,
    onlyOne: boolean,
  ): SolutionStep | null {
    const ipcMask = this.ipcMask;
    for (let entity = 0; entity < indices.length; entity++) {
      // number of cells in the unit that are not yet set
      let maxIndex = 0;
      for (let i = 0; i < indices[entity].length; i++) {
        if (this.sudoku.getCell(indices[entity][i]) !== 0) maxIndex++;
      }
      // for a Hidden Subset there must be more than anz cells
      if (maxIndex <= anz) continue;

      // collect candidates that could be part of a Hidden Subset of size anz and,
      // per candidate, a bitmap of the cells (bit j = j-th cell of the unit)
      let candMask = 0;
      const free = this.sudoku.free;
      for (let i = 1; i <= 9; i++) {
        const actFree = free[constraintBase + entity][i];
        if (actFree !== 0 && actFree <= anz) {
          candMask |= MASKS[i];
          ipcMask[i] = 0;
          for (let j = 0; j < UNITS; j++) {
            if ((this.sudoku.getCell(indices[entity][j]) & MASKS[i]) !== 0) ipcMask[i] |= MASKS[j + 1];
          }
        }
      }
      if (ANZ_VALUES[candMask] < anz) continue;

      const candArr = POSSIBLE_VALUES[candMask];
      const unit = indices[entity];
      for (let i1 = 0; i1 < candArr.length - anz + 1; i1++) {
        const cand1 = MASKS[candArr[i1]];
        const cell1 = ipcMask[candArr[i1]];
        for (let i2 = i1 + 1; i2 < candArr.length - anz + 2; i2++) {
          const cand2 = cand1 | MASKS[candArr[i2]];
          const cell2 = cell1 | ipcMask[candArr[i2]];
          if (anz === 2) {
            if (ANZ_VALUES[cell2] === anz) {
              const t = POSSIBLE_VALUES[cell2];
              const step = this.createSubsetStep(
                [unit[t[0] - 1], unit[t[1] - 1]],
                cand2,
                'HIDDEN_PAIR',
                onlyOne,
                onlyOne,
              );
              if (step !== null && onlyOne) return step;
            }
          } else {
            for (let i3 = i2 + 1; i3 < candArr.length - anz + 3; i3++) {
              const cand3 = cand2 | MASKS[candArr[i3]];
              const cell3 = cell2 | ipcMask[candArr[i3]];
              if (anz === 3) {
                if (ANZ_VALUES[cell3] === anz) {
                  const t = POSSIBLE_VALUES[cell3];
                  const step = this.createSubsetStep(
                    [unit[t[0] - 1], unit[t[1] - 1], unit[t[2] - 1]],
                    cand3,
                    'HIDDEN_TRIPLE',
                    onlyOne,
                    onlyOne,
                  );
                  if (step !== null && onlyOne) return step;
                }
              } else {
                for (let i4 = i3 + 1; i4 < candArr.length; i4++) {
                  const cand4 = cand3 | MASKS[candArr[i4]];
                  const cell4 = cell3 | ipcMask[candArr[i4]];
                  if (ANZ_VALUES[cell4] === anz) {
                    const t = POSSIBLE_VALUES[cell4];
                    const step = this.createSubsetStep(
                      [unit[t[0] - 1], unit[t[1] - 1], unit[t[2] - 1], unit[t[3] - 1]],
                      cand4,
                      'HIDDEN_QUADRUPLE',
                      onlyOne,
                      onlyOne,
                    );
                    if (step !== null && onlyOne) return step;
                  }
                }
              }
            }
          }
        }
      }
    }
    return null;
  }

  /** The next Locked Candidates step. Type 1 (pointing) is searched first. */
  private findLockedCandidates(type: SolutionType): SolutionStep | null {
    this.steps = [];
    if (type === 'LOCKED_CANDIDATES' || type === 'LOCKED_CANDIDATES_1') {
      const step = this.findLockedCandidatesInEntityN(18, BLOCKS);
      if (step !== null) return step;
    }
    if (type === 'LOCKED_CANDIDATES' || type === 'LOCKED_CANDIDATES_2') {
      return this.findLockedCandidatesInEntityN(0, LINES) ?? this.findLockedCandidatesInEntityN(9, COLS);
    }
    return null;
  }

  /**
   * A Locked Candidates move is present if a candidate occurs exactly 2 or 3
   * times in a unit, all instances share another unit and that other unit
   * has additional candidates. With `constraintBase == 18` (search in blocks)
   * Type 1 is possible, otherwise Type 2.
   */
  private findLockedCandidatesInEntityN(constraintBase: number, indices: Units): SolutionStep | null {
    const free = this.sudoku.free;
    const sameConstraint = this.sameConstraint;
    const constraint = this.constraint;
    for (let constr = 0; constr < UNITS; constr++) {
      for (let cand = 1; cand <= 9; cand++) {
        const unitFree = free[constr + constraintBase][cand];
        if (unitFree !== 2 && unitFree !== 3) continue;
        // possible Locked Candidates: check the cells
        let first = true;
        sameConstraint[0] = sameConstraint[1] = sameConstraint[2] = true;
        for (let i = 0; i < indices[constr].length; i++) {
          const index = indices[constr][i];
          if ((this.sudoku.getCell(index) & MASKS[cand]) === 0) continue; // candidate not present
          if (first) {
            constraint[0] = CONSTRAINTS[index][0];
            constraint[1] = CONSTRAINTS[index][1];
            constraint[2] = CONSTRAINTS[index][2];
            first = false;
          } else {
            for (let j = 0; j < 3; j++) {
              if (sameConstraint[j] && constraint[j] !== CONSTRAINTS[index][j]) sameConstraint[j] = false;
            }
          }
        }
        const skipConstraint = constraintBase + constr;
        if (constraintBase === 18) {
          // searching blocks -> Type 1, eliminations in line or column
          let aktConstraint: number;
          if (sameConstraint[0] && free[constraint[0]][cand] > unitFree) aktConstraint = constraint[0];
          else if (sameConstraint[1] && free[constraint[1]][cand] > unitFree) aktConstraint = constraint[1];
          else continue; // no LC1 possible
          return this.createLockedCandidatesStep(
            'LOCKED_CANDIDATES_1',
            cand,
            skipConstraint,
            ALL_UNITS[aktConstraint],
          );
        }
        // searching lines or columns -> Type 2, eliminations in the block only
        if (sameConstraint[2] && free[constraint[2]][cand] > unitFree) {
          return this.createLockedCandidatesStep('LOCKED_CANDIDATES_2', cand, skipConstraint, ALL_UNITS[constraint[2]]);
        }
      }
    }
    return null;
  }

  /**
   * A Locked Candidates step for `cand`. All candidates to delete are in the
   * unit `indices`; cells that belong to `skipConstraint` are part of the
   * pattern itself and are kept.
   */
  private createLockedCandidatesStep(
    type: SolutionType,
    cand: number,
    skipConstraint: number,
    indices: readonly number[],
  ): SolutionStep {
    const step = new SolutionStep(type);
    step.addValue(cand);
    step.entity = CONSTRAINT_TYPE_FROM_CONSTRAINT[skipConstraint];
    step.entityNumber = CONSTRAINT_NUMBER_FROM_CONSTRAINT[skipConstraint];
    for (const index of indices) {
      if ((this.sudoku.getCell(index) & MASKS[cand]) !== 0) {
        const c = CONSTRAINTS[index];
        if (c[0] === skipConstraint || c[1] === skipConstraint || c[2] === skipConstraint) {
          step.addIndex(index); // cell belongs to the LC
        } else {
          step.addCandidateToDelete(index, cand);
        }
      }
    }
    return step;
  }

  /**
   * Check the subset in `indices` for eliminations and, if there are any,
   * create the step. Handles Naked and Hidden subsets (by `type`).
   *
   * For Naked subsets all candidates in `cands` are deleted from the other
   * cells of all common units; for Hidden subsets all candidates except
   * `cands` are deleted from the cells in `indices`.
   *
   * If `lockedOnly` or `nakedHiddenOnly` is set the search is for one step
   * only; a step of the wrong kind (Locked instead of Naked or vice versa)
   * is cached. If neither is set the step is added to `steps`.
   */
  private createSubsetStep(
    indices: number[],
    cands: number,
    type: SolutionType,
    lockedOnly: boolean,
    nakedHiddenOnly: boolean,
  ): SolutionStep | null {
    const step = new SolutionStep(type);
    const sameConstraint = this.sameConstraint;
    const constraint = this.constraint;

    // determine the units to which all cells belong
    sameConstraint[0] = sameConstraint[1] = sameConstraint[2] = true;
    constraint[0] = CONSTRAINTS[indices[0]][0];
    constraint[1] = CONSTRAINTS[indices[0]][1];
    constraint[2] = CONSTRAINTS[indices[0]][2];
    for (let i = 1; i < indices.length; i++) {
      for (let j = 0; j < 3; j++) {
        if (sameConstraint[j] && constraint[j] !== CONSTRAINTS[indices[i]][j]) sameConstraint[j] = false;
      }
    }
    // number of units outside the block in which candidates will be deleted
    let anzFoundConstraints = 0;

    if (isHiddenSubset(type)) {
      // in the cells all candidates except cands can be deleted
      for (const idx of indices) {
        const candsToDelete = this.sudoku.getCell(idx) & ~cands;
        if (candsToDelete === 0) continue;
        for (const c of POSSIBLE_VALUES[candsToDelete]) step.addCandidateToDelete(idx, c);
      }
    } else {
      // candidates are deleted in all other cells of all common units
      const foundConstraint = this.foundConstraint;
      foundConstraint[0] = foundConstraint[1] = foundConstraint[2] = false;
      for (let i = 0; i < sameConstraint.length; i++) {
        if (!sameConstraint[i]) continue;
        const cells = ALL_UNITS[constraint[i]];
        for (const cell of cells) {
          if (indices.includes(cell)) continue; // skip the cells themselves
          const candsToDelete = this.sudoku.getCell(cell) & cands;
          if (candsToDelete === 0) continue;
          for (const c of POSSIBLE_VALUES[candsToDelete]) {
            step.addCandidateToDelete(cell, c);
            if (!foundConstraint[i] && (i === 2 || CONSTRAINTS[cell][2] !== constraint[2])) {
              // in a line or column and the cell is not in the block -> Locked Subset
              // (in the block: counts anyway)
              foundConstraint[i] = true;
              anzFoundConstraints++;
            }
          }
        }
      }
    }
    if (step.getAnzCandidatesToDelete() === 0) return null;

    // check for Locked Subsets
    const isLocked =
      indices.length < 4 &&
      anzFoundConstraints > 1 &&
      !isHiddenSubset(type) &&
      ((sameConstraint[2] && sameConstraint[0]) || (sameConstraint[2] && sameConstraint[1]));
    if (isLocked) {
      if (type === 'NAKED_PAIR') step.type = 'LOCKED_PAIR';
      if (type === 'NAKED_TRIPLE') step.type = 'LOCKED_TRIPLE';
    }
    for (const idx of indices) step.addIndex(idx);
    for (const c of POSSIBLE_VALUES[cands]) step.addValue(c);

    // what should we do with the step?
    let result: SolutionStep | null = step;
    if (lockedOnly && !nakedHiddenOnly) {
      // search for Locked Subsets only
      if (!isLocked) {
        this.cachedSteps.push(step);
        result = null;
      }
    } else if (nakedHiddenOnly && !lockedOnly) {
      if (isLocked) {
        this.cachedSteps.push(step);
        result = null;
      }
    } else if (!lockedOnly && !nakedHiddenOnly) {
      // search for ALL steps
      this.steps.push(step);
    }
    return result;
  }
}

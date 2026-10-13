/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's ChainSolver (Java).
 */
import { Chain } from '../chain.js';
import { SolutionStep } from '../solutionStep.js';
import type { SolutionType } from '../solutionType.js';
import { SudokuSet } from '../sudokuSet.js';
import { ALL_UNITS, ANZ_VALUES, BUDDIES, CONSTRAINTS, LENGTH, POSSIBLE_VALUES, getCol, getLine } from '../tables.js';
import { AbstractSolver } from './abstractSolver.js';
import type { SudokuStepFinder } from './stepFinder.js';

/** A simple chain without overlap cannot have more links than 2 * cells */
const MAX_CHAIN_LENGTH = 2 * LENGTH;

/** Chain types. NICE_LOOP is handled by the TablingSolver in HoDoKu 2.2. */
const enum ChainType {
  X_CHAIN = 0,
  XY_CHAIN = 1,
  REMOTE_PAIR = 2,
  TURBOT_FISH = 4,
}

/** An entry in the recursion stack */
class StackEntry {
  /** The cell index of the current link */
  cellIndex = 0;
  /** The candidate of the current link */
  candidate = 0;
  /** If true, the next link must be strong */
  strongOnly = false;
  /** The current index into `links` */
  aktIndex = 0;
  /** The index of the last link for that cell + 1 */
  endIndex = 0;
}

/**
 * Simple chains: Remote Pairs, Turbot Fish, X-Chains and XY-Chains.
 *
 * All chains of the searched type are collected and sorted (shorter chains with
 * the same eliminations replace longer ones); the best step is returned.
 */
export class ChainSolver extends AbstractSolver {
  private readonly stack: StackEntry[] = Array.from({ length: MAX_CHAIN_LENGTH }, () => new StackEntry());
  private stackLevel = 0;
  /** The maximum length of the chain in number of links */
  private chainMaxLength = 0;
  /** All instances of the start candidate that see the start cell */
  private readonly startCellSet = new SudokuSet();
  /** The same for the second candidate of a Remote Pair */
  private readonly startCellSet2 = new SudokuSet();
  /**
   * All links of all cells and candidates. The links for one cell/candidate combination
   * (index cellIndex * 10 + candidate) start at links[startIndices[..]] and end before links[endIndices[..]].
   */
  private links: number[] = [];
  private readonly startIndices = new Array<number>(810).fill(0);
  private readonly endIndices = new Array<number>(810).fill(0);
  /** The chain that is being built (copied when a chain is found) */
  private readonly chain = new Array<number>(MAX_CHAIN_LENGTH).fill(0);
  /** All cells of `chain` (for loop/lasso check); the last cell can be missing */
  private readonly chainSet = new SudokuSet();
  private startIndex = 0;
  private startCandidate = 0;
  /** The second start candidate for Remote Pairs */
  private startCandidate2 = 0;
  /** The candidates of the start cell of a Remote Pair */
  private rpCell = 0;
  private readonly checkBuddies = new SudokuSet();
  private readonly rpCand1 = new SudokuSet();
  private readonly rpCand2 = new SudokuSet();
  private readonly rpTmp = new SudokuSet();
  private readonly mSet = new SudokuSet();
  /** chains that were already found: eliminations -> chain length */
  private readonly deletesMap = new Map<string, number>();
  private steps: SolutionStep[] = [];
  /** The last finder step number for which links were calculated */
  private lastStepNumber = -1;
  /** true if the last links were calculated for Turbot Fish / X-Chain (they share the same links) */
  private turbotOrXSeen = false;

  constructor(finder: SudokuStepFinder) {
    super(finder);
  }

  getStep(type: SolutionType): SolutionStep | null {
    this.sudoku = this.finder.getSudoku();
    switch (type) {
      case 'X_CHAIN':
        return this.getBest(ChainType.X_CHAIN);
      case 'XY_CHAIN':
        return this.getBest(ChainType.XY_CHAIN);
      case 'REMOTE_PAIR':
        return this.getBest(ChainType.REMOTE_PAIR);
      case 'TURBOT_FISH':
        return this.getBest(ChainType.TURBOT_FISH);
      default:
        return null;
    }
  }

  doStep(step: SolutionStep): boolean {
    this.sudoku = this.finder.getSudoku();
    switch (step.type) {
      case 'X_CHAIN':
      case 'XY_CHAIN':
      case 'REMOTE_PAIR':
      case 'NICE_LOOP':
      case 'TURBOT_FISH':
        for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
        return true;
      default:
        return false;
    }
  }

  /** All chains of the type are found and sorted; the best one is returned. */
  private getBest(type: ChainType): SolutionStep | null {
    this.steps = [];
    this.getChains(type);
    if (this.steps.length > 0) {
      this.steps.sort((a, b) => a.compareTo(b));
      return this.steps[0];
    }
    return null;
  }

  /**
   * Iterates over all candidates in the sudoku and does a complete search for simple chains
   * up to a given maximum length. Collects all links for the type of chain first.
   */
  private getChains(type: ChainType): void {
    const sudoku = this.sudoku;
    this.getAllLinks(type);

    // maximum length of the chain
    this.chainMaxLength = MAX_CHAIN_LENGTH - 1;
    if (this.finder.options.restrictChainSize) this.chainMaxLength = this.finder.options.restrictChainLength;
    if (type === ChainType.TURBOT_FISH) this.chainMaxLength = 3;

    this.deletesMap.clear();
    const candidates = this.finder.getCandidates();
    for (this.startIndex = 0; this.startIndex < LENGTH; this.startIndex++) {
      if (sudoku.getValue(this.startIndex) !== 0) continue; // cell already set -> no chain possible
      const startCandidates = sudoku.getAllCandidates(this.startIndex);
      for (const startCandidate of startCandidates) {
        this.startCandidate = startCandidate;
        const linkStartIndex = this.startIndex * 10 + startCandidate;
        for (let linkIndex = this.startIndices[linkStartIndex]; linkIndex < this.endIndices[linkStartIndex]; linkIndex++) {
          const link = this.links[linkIndex];
          // don't start with a weak link
          if (!Chain.isSStrong(link)) continue;
          // X-Chain/Turbot: the link must be for the same candidate
          if ((type === ChainType.X_CHAIN || type === ChainType.TURBOT_FISH) && Chain.getSCandidate(link) !== startCandidate) {
            continue;
          }
          // XY-Chain/Remote Pair: cell must be bivalue, and the first strong link has to be within the cell
          if (
            (type === ChainType.XY_CHAIN || type === ChainType.REMOTE_PAIR) &&
            sudoku.getAnzCandidates(Chain.getSCellIndex(link)) !== 2
          ) {
            continue;
          }
          if (
            (type === ChainType.XY_CHAIN || type === ChainType.REMOTE_PAIR) &&
            Chain.getSCellIndex(link) !== this.startIndex
          ) {
            continue;
          }
          if (type === ChainType.REMOTE_PAIR) {
            this.rpCell = sudoku.getCell(this.startIndex);
            // the second candidate of the cell (a Remote Pair works for both candidates)
            const cands = sudoku.getAllCandidates(this.startIndex);
            this.startCandidate2 = cands[0] !== startCandidate ? cands[0] : cands[1];
          }
          this.stackLevel = 1;
          this.chain[0] = Chain.makeSEntry(this.startIndex, startCandidate, false);
          this.chain[1] = link;
          const entry = this.stack[this.stackLevel];
          entry.cellIndex = Chain.getSCellIndex(this.chain[1]);
          entry.candidate = Chain.getSCandidate(this.chain[1]);
          entry.strongOnly = !Chain.isSStrong(this.chain[1]);
          entry.aktIndex = this.startIndices[entry.cellIndex * 10 + entry.candidate];
          entry.endIndex = this.endIndices[entry.cellIndex * 10 + entry.candidate];
          this.chainSet.clear();
          this.chainSet.add(this.startIndex);
          // all instances of startCandidate that see the start cell
          this.startCellSet.setAnd(BUDDIES[this.startIndex], candidates[startCandidate]);
          if (type === ChainType.REMOTE_PAIR) {
            this.startCellSet2.setAnd(BUDDIES[this.startIndex], candidates[this.startCandidate2]);
          }
          this.getChain(entry, type);
        }
      }
    }
  }

  /**
   * The search: for every link of the current cell/candidate check whether it can prolong
   * the chain; if so, insert it and repeat. A link is not used if it links back to itself, or
   * to the middle of the chain. A chain is valid if first and last link are strong and
   * something can be eliminated; to check that quickly, all instances of the start candidate
   * that see the start cell are precalculated and ANDed with the buddies of the new last cell.
   */
  private getChain(startEntry: StackEntry, type: ChainType): void {
    const sudoku = this.sudoku;
    const links = this.links;
    let entry = startEntry;
    while (true) {
      // done with this cell: go back one level
      while (entry.aktIndex >= entry.endIndex) {
        this.stackLevel--;
        entry = this.stack[this.stackLevel];
        this.chainSet.remove(entry.cellIndex);
        if (this.stackLevel <= 0) return; // done!
      }
      // get the next link and check it
      let newLink = links[entry.aktIndex++];
      let newLinkIsStrong = Chain.isSStrong(newLink);
      if (entry.strongOnly && !newLinkIsStrong) continue; // link must be strong but isn't
      const newLinkIndex = Chain.getSCellIndex(newLink);
      const newLinkCandidate = Chain.getSCandidate(newLink);
      if (entry.cellIndex === newLinkIndex && entry.candidate === newLinkCandidate) continue; // links to itself
      // additional checks according to type
      if (type === ChainType.REMOTE_PAIR && sudoku.getCell(newLinkIndex) !== this.rpCell) {
        continue; // all cells must contain the same two candidates
      }
      if ((type === ChainType.X_CHAIN || type === ChainType.TURBOT_FISH) && newLinkCandidate !== this.startCandidate) {
        continue; // all links must be for the same candidate
      }
      if ((type === ChainType.XY_CHAIN || type === ChainType.REMOTE_PAIR) && sudoku.getAnzCandidates(newLinkIndex) !== 2) {
        continue; // cell is not bivalue
      }
      if (
        (type === ChainType.XY_CHAIN || type === ChainType.REMOTE_PAIR) &&
        entry.strongOnly &&
        newLinkIndex !== entry.cellIndex
      ) {
        continue; // all strong links must be within a cell
      }
      // the new link must not link back to the middle of the chain
      let isLoop = false;
      if (this.chainSet.contains(newLinkIndex)) {
        if (this.startIndex !== newLinkIndex) continue; // links back to the middle
        isLoop = true;
      }
      // the new link is valid. chainSet contains only the second last cell (a lasso check would
      // not work otherwise: the last cell can be in the chain twice, but never three times)
      this.chainSet.add(entry.cellIndex);
      if (!entry.strongOnly && newLinkIsStrong) {
        // might be a strong link, but only a weak one is needed -> change it
        newLink = Chain.setSStrong(newLink, false);
        newLinkIsStrong = false;
      }
      this.chain[++this.stackLevel] = newLink;

      // could be a valid chain: the last link must be strong, for the start candidate, and
      // something can be eliminated. (RP: a larger RP with more eliminations is found as an
      // extra chain with a different start cell.)
      if (this.stackLevel > 1 && newLinkIsStrong && newLinkCandidate === this.startCandidate) {
        // do the first and the last cell eliminate anything?
        this.mSet.setAnd(this.startCellSet, BUDDIES[newLinkIndex]);
        if (!this.mSet.isEmpty()) {
          switch (type) {
            case ChainType.X_CHAIN:
              this.checkXChain(this.mSet, false);
              break;
            case ChainType.TURBOT_FISH:
              if (this.stackLevel === 3) this.checkXChain(this.mSet, true);
              break;
            case ChainType.XY_CHAIN:
              this.checkXYChain(this.mSet);
              break;
            case ChainType.REMOTE_PAIR:
              if (this.stackLevel >= 7) this.checkRemotePairs(this.mSet, newLinkIndex);
              break;
          }
        }
      }

      // go to the next level
      const oldStrongOnly = entry.strongOnly;
      entry = this.stack[this.stackLevel];
      // chains can be restricted in size: if the chain gets too long, the search stops
      if (this.stackLevel < this.chainMaxLength && !isLoop) {
        entry.cellIndex = newLinkIndex;
        entry.candidate = newLinkCandidate;
        entry.strongOnly = !oldStrongOnly;
        entry.aktIndex = this.startIndices[entry.cellIndex * 10 + entry.candidate];
        entry.endIndex = this.endIndices[entry.cellIndex * 10 + entry.candidate];
      } else {
        // we are in the next level, but it must not be searched anymore
        entry.aktIndex = entry.endIndex;
      }
    }
  }

  /**
   * An X-Chain exists between strong links of the same candidate; any candidate that sees
   * both ends can be eliminated. Called after all the checks (at least three links, first and
   * last link strong for the same candidate, no loop, something to eliminate).
   */
  private checkXChain(elim: SudokuSet, isTurbot: boolean): void {
    const step = new SolutionStep(isTurbot ? 'TURBOT_FISH' : 'X_CHAIN');
    step.addValue(this.startCandidate);
    for (const c of elim) step.addCandidateToDelete(c, this.startCandidate);
    // has a chain with the same eliminations been found already? (not for Turbot Fish)
    if (!isTurbot && !this.registerChain(step)) return;
    if (isTurbot) step.normalizeCandidatesToDelete();
    this.addChainStep(step);
  }

  private checkXYChain(elim: SudokuSet): void {
    const step = new SolutionStep('XY_CHAIN');
    step.addValue(this.startCandidate);
    for (const c of elim) step.addCandidateToDelete(c, this.startCandidate);
    if (!this.registerChain(step)) return;
    this.addChainStep(step);
  }

  /**
   * A Remote Pair has at least 4 cells (chain length >= 7); first and last link are strong and
   * for the same candidate. If the chain is longer than 4 cells, eliminations can occur between all
   * cells with opposite polarity. Longer chains are found with more eliminations than two
   * separate shorter ones.
   */
  private checkRemotePairs(elim: SudokuSet, endIndex: number): void {
    const step = new SolutionStep('REMOTE_PAIR');
    const candidates = this.finder.getCandidates();
    this.rpCand1.clear();
    this.rpCand2.clear();
    if (this.stackLevel > 7) {
      // all combinations of cells with opposite polarity: the first one is 6 links away, all others 4 more
      for (let i = 0; i <= this.stackLevel; i += 2) {
        for (let j = i + 6; j <= this.stackLevel; j += 4) {
          this.rpTmp.set(BUDDIES[Chain.getSCellIndex(this.chain[i])]);
          this.rpTmp.and(BUDDIES[Chain.getSCellIndex(this.chain[j])]);
          this.checkBuddies.set(this.rpTmp);
          this.checkBuddies.and(candidates[this.startCandidate]);
          this.rpCand1.or(this.checkBuddies);
          this.checkBuddies.set(this.rpTmp);
          this.checkBuddies.and(candidates[this.startCandidate2]);
          this.rpCand2.or(this.checkBuddies);
        }
      }
    } else {
      // shortest possible RP: only eliminations for the end cells
      this.rpCand1.set(elim);
      this.rpCand2.setAnd(this.startCellSet2, BUDDIES[endIndex]);
    }
    step.addValue(this.startCandidate);
    step.addValue(this.startCandidate2);
    for (const c of this.rpCand1) step.addCandidateToDelete(c, this.startCandidate);
    for (const c of this.rpCand2) step.addCandidateToDelete(c, this.startCandidate2);
    if (!this.registerChain(step)) return;
    this.addChainStep(step);
  }

  /**
   * Remember the eliminations of a chain. Returns false if a chain with the same eliminations
   * exists already and is not longer than the new one. (Sorts the candidates to delete.)
   */
  private registerChain(step: SolutionStep): boolean {
    const key = step.getCandidateKey();
    const oldLength = this.deletesMap.get(key);
    if (oldLength !== undefined && oldLength <= this.stackLevel) return false;
    this.deletesMap.set(key, this.stackLevel);
    return true;
  }

  /** Copy the current chain into the step and add the step to the result list. */
  private addChainStep(step: SolutionStep): void {
    step.addChain(0, this.stackLevel, this.chain.slice(0, this.stackLevel + 1));
    this.steps.push(step);
  }

  /**
   * Calculates all links for the type of chain:
   *  - REMOTE_PAIR: only links between bivalue cells with the same candidates, and within the cells
   *  - TURBOT_FISH and X_CHAIN: only between candidates with the same value
   *  - XY_CHAIN: only bivalue cells
   * Turbot Fish and X-Chain share exactly the same links; if one is searched right after the
   * other without a change to the sudoku the links are not recalculated.
   */
  private getAllLinks(type: ChainType): void {
    if (
      this.turbotOrXSeen &&
      (type === ChainType.TURBOT_FISH || type === ChainType.X_CHAIN) &&
      this.lastStepNumber === this.finder.getStepNumber()
    ) {
      return;
    }
    this.turbotOrXSeen = type === ChainType.TURBOT_FISH || type === ChainType.X_CHAIN;
    this.lastStepNumber = this.finder.getStepNumber();
    const sudoku = this.sudoku;
    const free = sudoku.free;
    const links: number[] = [];
    for (let cellIndex = 0; cellIndex < LENGTH; cellIndex++) {
      const cell = sudoku.getCell(cellIndex);
      // ignore filled cells (and, for XY-Chain/Remote Pair, cells that are not bivalue)
      if (cell === 0 || ((type === ChainType.REMOTE_PAIR || type === ChainType.XY_CHAIN) && ANZ_VALUES[cell] !== 2)) {
        continue;
      }
      for (let cellCandidate = 1; cellCandidate <= 9; cellCandidate++) {
        const startEndIndex = cellIndex * 10 + cellCandidate;
        if (!sudoku.isCandidate(cellIndex, cellCandidate)) {
          this.startIndices[startEndIndex] = links.length;
          this.endIndices[startEndIndex] = links.length;
          continue;
        }
        this.startIndices[startEndIndex] = links.length;
        // within a cell: if the cell has only two candidates left there is a strong link between
        // them (not for X-Chain and Turbot Fish)
        const cands = POSSIBLE_VALUES[cell];
        if (ANZ_VALUES[cell] === 2 && type !== ChainType.X_CHAIN && type !== ChainType.TURBOT_FISH) {
          let cand = cands[0];
          if (cand === cellCandidate) cand = cands[1];
          links.push(Chain.makeSEntry(cellIndex, cand, true));
        }
        // within the houses: a candidate that exists only twice gives a strong link, else weak links.
        // XY-Chain: only to bivalue cells; Remote Pair: only to bivalue cells with the same two candidates.
        for (let constr = 0; constr < CONSTRAINTS[cellIndex].length; constr++) {
          const strong =
            free[CONSTRAINTS[cellIndex][constr]][cellCandidate] === 2 &&
            (type === ChainType.X_CHAIN || type === ChainType.TURBOT_FISH);
          for (const other of ALL_UNITS[CONSTRAINTS[cellIndex][constr]]) {
            if (other !== cellIndex && sudoku.isCandidate(other, cellCandidate)) {
              const cell2 = sudoku.getCell(other);
              if (type === ChainType.REMOTE_PAIR && cell2 !== cell) continue; // must be the same two values
              if (type === ChainType.XY_CHAIN && ANZ_VALUES[cell2] !== 2) continue; // must be bivalue
              if (constr === 2 && (getLine(cellIndex) === getLine(other) || getCol(cellIndex) === getCol(other))) {
                continue; // link was already recorded in line/column
              }
              links.push(Chain.makeSEntry(other, cellCandidate, strong));
            }
          }
        }
        this.endIndices[startEndIndex] = links.length;
      }
    }
    this.links = links;
  }
}

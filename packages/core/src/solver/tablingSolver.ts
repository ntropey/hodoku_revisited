/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's TablingSolver (Java).
 */
import { Chain, GROUP_NODE, NORMAL_NODE } from '../chain.js';
import { SolutionStep } from '../solutionStep.js';
import type { SolutionType } from '../solutionType.js';
import type { Sudoku2 } from '../sudoku2.js';
import { SudokuSet } from '../sudokuSet.js';
import {
  ALL_CONSTRAINTS_TEMPLATES,
  BLOCK,
  BLOCK_TEMPLATES,
  BUDDIES,
  CELL,
  COL,
  COL_TEMPLATES,
  CONSTRAINTS,
  LENGTH,
  LINE,
  LINE_TEMPLATES,
} from '../tables.js';
import { AbstractSolver } from './abstractSolver.js';
import { GroupNode } from './groupNode.js';
import { SudokuStepFinder } from './stepFinder.js';
import { MAX_TABLE_ENTRY_LENGTH, TableEntry } from './tableEntry.js';

/** Maximum recursion depth when building the tables. */
const MAX_REC_DEPTH = 50;

/*
 * Trebor's Tables for finding Nice Loops, AICs, Forcing Chains and Forcing Nets.
 *
 * For every possible premise ("candidate n is set in / eliminated from cell x") all possible outcomes
 * are logged. For chains only direct outcomes are stored; for nets every outcome triggers new rounds
 * of singles (up to a maximum look-ahead). After the initial round all tables are expanded: for every
 * outcome all outcomes from the other table are added. The result is checked for contradictions or
 * verities.
 *
 * Some tests: one chain: two values set in a cell, the same value twice in a house, all candidates
 * of a cell eliminated, a candidate set and eliminated -> the premise was wrong. Two chains for the
 * same premise (set / eliminated), or for all candidates in a house or cell: both lead to the same
 * value in the on-sets (value can be set) or off-sets (candidate can be eliminated).
 *
 * AIC (added 20081013): for every Nice Loop that starts with a strong inference out of the start cell and
 * ends with a weak inference into the start cell, the AIC (start cell - last strong inference) is checked.
 *
 * Differences to the original: ALS nodes in chains (option allowAlsInTablingChains, off by default)
 * and Kraken Fish support are not ported yet.
 */

/** Order of steps found by tabling (forcing chains / nets). */
function compareTablingSteps(o1: SolutionStep, o2: SolutionStep): number {
  // steps that set cells beat steps that eliminate candidates
  if (o1.indices.length > 0 && o2.indices.length === 0) return -1;
  if (o1.indices.length === 0 && o2.indices.length > 0) return 1;
  if (o1.indices.length > 0) {
    // set cell: number of cells that can be set (descending)
    let result = o2.indices.length - o1.indices.length;
    if (result !== 0) return result;
    // not equivalent: lower cells first
    if (!o1.isEquivalent(o2)) {
      const sum1 = sum(o1.indices);
      const sum2 = sum(o2.indices);
      return sum1 === sum2 ? 1 : sum1 - sum2;
    }
    result = o1.getChainLength() - o2.getChainLength();
    if (result !== 0) return result;
  } else {
    // eliminate candidates: number of candidates to eliminate (descending)
    let result = o2.candidatesToDelete.length - o1.candidatesToDelete.length;
    if (result !== 0) return result;
    if (!o1.isEquivalent(o2)) {
      // not equivalent: lower cells first, lower candidates first
      result = o1.compareCandidatesToDelete(o2);
      if (result !== 0) return result;
    }
    result = o1.getChainLength() - o2.getChainLength();
    if (result !== 0) return result;
  }
  return 0;
}

function sum(list: readonly number[]): number {
  return list.reduce((a, b) => a + b, 0);
}

export class TablingSolver extends AbstractSolver {
  private steps: SolutionStep[] = [];
  /** the step that is being assembled */
  private globalStep = new SolutionStep('HIDDEN_SINGLE');
  /** all chains found so far: eliminations -> index in `steps` */
  private readonly deletesMap = new Map<string, number>();
  /** search only for chains, not for nets */
  private chainsOnly = true;
  /** include group nodes in the search */
  private withGroupNodes = false;
  /** accept steps only if they contain group nodes */
  private onlyGroupedNiceLoops = false;
  /** one table per premise, index cell * 10 + candidate: "candidate set in cell" */
  private onTable: TableEntry[] = [];
  /** "candidate deleted from cell" */
  private offTable: TableEntry[] = [];
  private readonly entryList: TableEntry[] = [];
  private readonly tmpSet = new SudokuSet();
  private readonly tmpSet1 = new SudokuSet();
  private readonly tmpSet2 = new SudokuSet();
  /** for building chains: all cells of the chain */
  private readonly tmpSetC = new SudokuSet();
  private readonly tmpOnSets: SudokuSet[] = Array.from({ length: 10 }, () => new SudokuSet());
  private readonly tmpOffSets: SudokuSet[] = Array.from({ length: 10 }, () => new SudokuSet());
  /** the sudoku in its initial state (for building the tables of nets) */
  private savedSudoku!: Sudoku2;
  private readonly retIndices = [0, 0, 0, 0, 0];
  private groupNodes: GroupNode[] = [];
  private simpleFinder: SudokuStepFinder | null = null;
  private readonly chain = new Array<number>(MAX_TABLE_ENTRY_LENGTH).fill(0);
  private chainIndex = 0;
  /** chains for networks */
  private readonly mins: number[][] = Array.from({ length: 200 }, () => new Array<number>(MAX_TABLE_ENTRY_LENGTH).fill(0));
  private readonly minIndexes = new Array<number>(200).fill(0);
  private actMin = 0;
  private readonly tmpChain = new Array<number>(MAX_TABLE_ENTRY_LENGTH).fill(0);
  private readonly tmpChains: Chain[] = Array.from(
    { length: 9 },
    () => new Chain(0, 0, new Array<number>(MAX_TABLE_ENTRY_LENGTH).fill(0)),
  );
  private tmpChainsIndex = 0;
  /** for addChain: all cells of the chain */
  private readonly lassoSet = new SudokuSet();
  private extendedTable: TableEntry[] = [];
  /** entry -> index in the extended table */
  private readonly extendedTableMap = new Map<number, number>();
  private extendedTableIndex = 0;
  private initialized = false;

  constructor(finder: SudokuStepFinder) {
    super(finder);
  }

  /** Late initialization of the memory intensive tables. */
  private initialize(): void {
    if (this.initialized) return;
    this.onTable = Array.from({ length: 810 }, () => new TableEntry());
    this.offTable = Array.from({ length: 810 }, () => new TableEntry());
    this.extendedTable = [];
    this.extendedTableMap.clear();
    this.extendedTableIndex = 0;
    this.initialized = true;
  }

  private resetTmpChains(): void {
    for (const c of this.tmpChains) {
      c.start = 0;
      c.end = 0;
      c.resetLength();
    }
    this.tmpChainsIndex = 0;
  }

  /** Start a new global step of the given type. */
  private newStep(type: SolutionType): SolutionStep {
    this.globalStep = new SolutionStep(type);
    return this.globalStep;
  }

  private checkAlsOption(): void {
    if (this.finder.options.allowAlsInTablingChains) {
      throw new Error('allowAlsInTablingChains is not supported yet');
    }
  }

  getStep(type: SolutionType): SolutionStep | null {
    this.sudoku = this.finder.getSudoku();
    this.checkAlsOption();
    switch (type) {
      case 'NICE_LOOP':
      case 'CONTINUOUS_NICE_LOOP':
      case 'DISCONTINUOUS_NICE_LOOP':
      case 'AIC':
        this.withGroupNodes = false;
        return this.getNiceLoops();
      case 'GROUPED_NICE_LOOP':
      case 'GROUPED_CONTINUOUS_NICE_LOOP':
      case 'GROUPED_DISCONTINUOUS_NICE_LOOP':
      case 'GROUPED_AIC':
        this.withGroupNodes = true;
        return this.getNiceLoops();
      case 'FORCING_CHAIN':
      case 'FORCING_CHAIN_CONTRADICTION':
      case 'FORCING_CHAIN_VERITY':
        this.steps = [];
        this.withGroupNodes = true;
        this.initialize();
        this.chainsOnly = true;
        this.doGetForcingChains();
        if (this.steps.length > 0) {
          this.steps.sort(compareTablingSteps);
          return this.steps[0];
        }
        return null;
      case 'FORCING_NET':
      case 'FORCING_NET_CONTRADICTION':
      case 'FORCING_NET_VERITY':
        this.steps = [];
        this.withGroupNodes = true;
        this.initialize();
        this.chainsOnly = false;
        this.doGetForcingChains();
        if (this.steps.length > 0) {
          this.steps.sort(compareTablingSteps);
          return this.steps[0];
        }
        return null;
      default:
        return null;
    }
  }

  doStep(step: SolutionStep): boolean {
    this.sudoku = this.finder.getSudoku();
    switch (step.type) {
      case 'NICE_LOOP':
      case 'CONTINUOUS_NICE_LOOP':
      case 'DISCONTINUOUS_NICE_LOOP':
      case 'AIC':
      case 'GROUPED_NICE_LOOP':
      case 'GROUPED_CONTINUOUS_NICE_LOOP':
      case 'GROUPED_DISCONTINUOUS_NICE_LOOP':
      case 'GROUPED_AIC':
        for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
        return true;
      case 'FORCING_CHAIN':
      case 'FORCING_CHAIN_CONTRADICTION':
      case 'FORCING_CHAIN_VERITY':
      case 'FORCING_NET':
      case 'FORCING_NET_CONTRADICTION':
      case 'FORCING_NET_VERITY':
        if (step.values.length > 0) {
          for (let i = 0; i < step.values.length; i++) this.sudoku.setCell(step.indices[i], step.values[i]);
        } else {
          for (const cand of step.candidatesToDelete) this.sudoku.delCandidate(cand.index, cand.value);
        }
        return true;
      default:
        return false;
    }
  }

  /** The shortest Nice Loop / AIC in the grid. */
  private getNiceLoops(): SolutionStep | null {
    this.initialize();
    this.steps = [];
    this.doGetNiceLoops();
    if (this.steps.length > 0) {
      this.steps.sort((a, b) => a.compareTo(b));
      return this.steps[0];
    }
    return null;
  }

  /** The search for all types of Nice Loops and AICs. */
  private doGetNiceLoops(): void {
    this.deletesMap.clear();
    this.chainsOnly = true;
    this.fillTables();
    if (this.withGroupNodes) this.fillTablesWithGroupNodes();
    this.expandTables(this.onTable);
    this.expandTables(this.offTable);
    this.checkNiceLoops(this.onTable);
    this.checkNiceLoops(this.offTable);
    this.checkAics(this.offTable);
  }

  private doGetForcingChains(): void {
    this.deletesMap.clear();
    this.fillTables();
    if (this.withGroupNodes) this.fillTablesWithGroupNodes();
    this.expandTables(this.onTable);
    this.expandTables(this.offTable);
    this.checkForcingChains();
  }

  private checkForcingChains(): void {
    for (let i = 0; i < this.onTable.length; i++) {
      this.checkOneChain(this.onTable[i]);
      this.checkOneChain(this.offTable[i]);
    }
    for (let i = 0; i < this.onTable.length; i++) {
      this.checkTwoChains(this.onTable[i], this.offTable[i]);
    }
    this.checkAllChainsForHouse(null);
    this.checkAllChainsForHouse(LINE_TEMPLATES);
    this.checkAllChainsForHouse(COL_TEMPLATES);
    this.checkAllChainsForHouse(BLOCK_TEMPLATES);
  }

  /**
   * Check all chains for every unsolved cell (all candidates of the cell; `houseSets == null`) or for
   * every candidate in every house.
   */
  private checkAllChainsForHouse(houseSets: readonly SudokuSet[] | null): void {
    const sudoku = this.sudoku;
    if (houseSets === null) {
      for (let i = 0; i < LENGTH; i++) {
        if (sudoku.getValue(i) !== 0) continue;
        this.entryList.length = 0;
        for (const cand of sudoku.getAllCandidates(i)) this.entryList.push(this.onTable[i * 10 + cand]);
        this.checkEntryList(this.entryList);
      }
    } else {
      const candidates = this.finder.getCandidates();
      for (const house of houseSets) {
        for (let j = 1; j < candidates.length; j++) {
          this.tmpSet.set(house);
          this.tmpSet.and(candidates[j]);
          if (!this.tmpSet.isEmpty()) {
            this.entryList.length = 0;
            for (const k of this.tmpSet) this.entryList.push(this.onTable[k * 10 + j]);
            this.checkEntryList(this.entryList);
          }
        }
      }
    }
  }

  /**
   * All chains in the list start at the candidates of one cell, or all places of one candidate in a
   * house: if they all lead to the same value in a cell, or the same elimination, that is a verity.
   */
  private checkEntryList(entryList: TableEntry[]): void {
    for (let i = 0; i < entryList.length; i++) {
      const entry = entryList[i];
      for (let j = 1; j < this.tmpOnSets.length; j++) {
        if (i === 0) {
          this.tmpOnSets[j].set(entry.onSets[j]);
          this.tmpOffSets[j].set(entry.offSets[j]);
        } else {
          this.tmpOnSets[j].and(entry.onSets[j]);
          this.tmpOffSets[j].and(entry.offSets[j]);
        }
      }
    }
    for (let j = 1; j < this.tmpOnSets.length; j++) {
      if (!this.tmpOnSets[j].isEmpty()) {
        for (const cell of [...this.tmpOnSets[j]]) {
          const step = this.newStep('FORCING_CHAIN_VERITY');
          step.addIndex(cell);
          step.addValue(j);
          this.resetTmpChains();
          for (const e of entryList) this.addChain(e, cell, j, true);
          this.replaceOrCopyStep();
        }
      }
      if (!this.tmpOffSets[j].isEmpty()) {
        for (const cell of [...this.tmpOffSets[j]]) {
          const step = this.newStep('FORCING_CHAIN_VERITY');
          step.addCandidateToDelete(cell, j);
          this.resetTmpChains();
          for (const e of entryList) this.addChain(e, cell, j, false);
          this.replaceOrCopyStep();
        }
      }
    }
  }

  /** If a step contains a net, FORCING_CHAIN_x becomes FORCING_NET_x. */
  private adjustType(step: SolutionStep): void {
    if (step.isNet()) {
      if (step.type === 'FORCING_CHAIN_CONTRADICTION') step.type = 'FORCING_NET_CONTRADICTION';
      if (step.type === 'FORCING_CHAIN_VERITY') step.type = 'FORCING_NET_VERITY';
    }
  }

  /**
   * Overwrite the content of `dest` with the content of `src` (both are the same step, but `src`
   * has the shorter chain).
   */
  private replaceStep(src: SolutionStep, dest: SolutionStep): void {
    this.adjustType(src);
    dest.type = src.type;
    if (src.indices.length > 0) {
      for (let i = 0; i < src.indices.length; i++) {
        dest.indices[i] = src.indices[i];
        dest.values[i] = src.values[i];
      }
    } else {
      for (let i = 0; i < src.candidatesToDelete.length; i++) dest.candidatesToDelete[i] = src.candidatesToDelete[i];
    }
    if (src.alses.length > 0) dest.alses = src.alses.map((a) => ({ indices: a.indices.slice(), candidates: a.candidates }));
    dest.endoFins = src.endoFins.slice();
    dest.entity = src.entity;
    dest.entityNumber = src.entityNumber;
    let i = 0;
    for (i = 0; i < src.chains.length; i++) {
      const localTmpChain = src.chains[i];
      const toShort = dest.chains.length > i && dest.chains[i].chain.length < localTmpChain.end + 1;
      if (i >= dest.chains.length || toShort) {
        const tmp = localTmpChain.chain.slice(0, localTmpChain.end + 1);
        if (toShort) {
          const destChain = dest.chains[i];
          destChain.chain = tmp;
          destChain.start = localTmpChain.start;
          destChain.end = localTmpChain.end;
          destChain.resetLength();
        } else {
          dest.addChain(0, localTmpChain.end, tmp);
        }
      } else {
        const destChain = dest.chains[i];
        for (let j = 0; j <= localTmpChain.end; j++) destChain.chain[j] = localTmpChain.chain[j];
        destChain.start = localTmpChain.start;
        destChain.end = localTmpChain.end;
        destChain.resetLength();
      }
    }
    dest.chains.length = Math.min(dest.chains.length, i);
  }

  /**
   * Store `globalStep` in `steps`: if a step for the same eliminations (or cells) exists already it is
   * replaced if the new chain is shorter.
   */
  private replaceOrCopyStep(): void {
    const step = this.globalStep;
    this.adjustType(step);
    if (!this.chainsOnly && (step.type === 'FORCING_CHAIN_CONTRADICTION' || step.type === 'FORCING_CHAIN_VERITY')) {
      return; // chains are not searched when searching for nets
    }
    let del: string | null = null;
    if (this.finder.options.onlyOneChainPerStep) {
      del = step.candidatesToDelete.length > 0 ? step.getCandidateKey(true) : step.getSingleCandidateKey();
      const oldIndex = this.deletesMap.get(del);
      const actStep = oldIndex !== undefined ? this.steps[oldIndex] : null;
      if (actStep) {
        if (actStep.getChainLength() > step.getChainLength()) this.replaceStep(step, actStep);
        return;
      }
    }
    // the step references the temporary chains: copy them
    const chainAnz = step.chains.length;
    step.chains = [];
    for (let i = 0; i < chainAnz; i++) step.chains.push(this.tmpChains[i].clone());
    this.steps.push(step.clone());
    if (del !== null) this.deletesMap.set(del, this.steps.length - 1);
  }

  private checkTwoChains(on: TableEntry, off: TableEntry): void {
    if (on.index === 0 || off.index === 0) return;
    for (let i = 1; i < on.onSets.length; i++) {
      this.tmpSet.set(on.onSets[i]);
      this.tmpSet.and(off.onSets[i]);
      this.tmpSet.remove(on.getCellIndex(0));
      if (!this.tmpSet.isEmpty()) {
        for (const cell of [...this.tmpSet]) {
          const step = this.newStep('FORCING_CHAIN_VERITY');
          step.addIndex(cell);
          step.addValue(i);
          this.resetTmpChains();
          this.addChain(on, cell, i, true);
          this.addChain(off, cell, i, true);
          this.replaceOrCopyStep();
        }
      }
    }
    for (let i = 1; i < on.offSets.length; i++) {
      this.tmpSet.set(on.offSets[i]);
      this.tmpSet.and(off.offSets[i]);
      this.tmpSet.remove(on.getCellIndex(0));
      if (!this.tmpSet.isEmpty()) {
        for (const cell of [...this.tmpSet]) {
          const step = this.newStep('FORCING_CHAIN_VERITY');
          step.addCandidateToDelete(cell, i);
          this.resetTmpChains();
          this.addChain(on, cell, i, false);
          this.addChain(off, cell, i, false);
          this.replaceOrCopyStep();
        }
      }
    }
  }

  /** Start a contradiction step for a premise: the premise is wrong, so do the opposite. */
  private newContradictionStep(entry: TableEntry, entity: number, entityNumber: number): SolutionStep {
    const step = this.newStep('FORCING_CHAIN_CONTRADICTION');
    if (entry.isStrong(0)) {
      step.addCandidateToDelete(entry.getCellIndex(0), entry.getCandidate(0));
    } else {
      step.addIndex(entry.getCellIndex(0));
      step.addValue(entry.getCandidate(0));
    }
    step.entity = entity;
    step.entityNumber = entityNumber;
    return step;
  }

  private checkOneChain(entry: TableEntry): void {
    if (entry.index === 0) return;
    const sudoku = this.sudoku;
    const candidates = this.finder.getCandidates();
    // the premise itself is contradicted by its consequences
    if (
      (entry.isStrong(0) && entry.offSets[entry.getCandidate(0)].contains(entry.getCellIndex(0))) ||
      (!entry.isStrong(0) && entry.onSets[entry.getCandidate(0)].contains(entry.getCellIndex(0)))
    ) {
      this.newContradictionStep(entry, CELL, this.tmpSet.isEmpty() ? 0 : this.tmpSet.get(0));
      this.resetTmpChains();
      this.addChain(entry, entry.getCellIndex(0), entry.getCandidate(0), !entry.isStrong(0));
      this.replaceOrCopyStep();
    }
    // a candidate is set and deleted in the same cell
    for (let i = 0; i < entry.onSets.length; i++) {
      this.tmpSet.set(entry.onSets[i]);
      this.tmpSet.and(entry.offSets[i]);
      if (!this.tmpSet.isEmpty()) {
        this.newContradictionStep(entry, CELL, this.tmpSet.get(0));
        this.resetTmpChains();
        this.addChain(entry, this.tmpSet.get(0), i, false);
        this.addChain(entry, this.tmpSet.get(0), i, true);
        this.replaceOrCopyStep();
      }
    }
    // two different values are set in the same cell
    for (let i = 1; i < entry.onSets.length; i++) {
      for (let j = i + 1; j < entry.onSets.length; j++) {
        this.tmpSet.set(entry.onSets[i]);
        this.tmpSet.and(entry.onSets[j]);
        if (!this.tmpSet.isEmpty()) {
          this.newContradictionStep(entry, CELL, this.tmpSet.get(0));
          this.resetTmpChains();
          this.addChain(entry, this.tmpSet.get(0), i, true);
          this.addChain(entry, this.tmpSet.get(0), j, true);
          this.replaceOrCopyStep();
        }
      }
    }
    // the same value is set twice in a house
    this.checkHouseSet(entry, LINE_TEMPLATES, LINE);
    this.checkHouseSet(entry, COL_TEMPLATES, COL);
    this.checkHouseSet(entry, BLOCK_TEMPLATES, BLOCK);
    // all candidates are deleted from a cell
    this.tmpSet.setAll();
    for (let i = 1; i < entry.offSets.length; i++) {
      this.tmpSet1.set(entry.offSets[i]);
      this.tmpSet1.orNot(candidates[i]);
      this.tmpSet.and(this.tmpSet1);
    }
    for (let i = 0; i < entry.onSets.length; i++) this.tmpSet.andNot(entry.onSets[i]);
    this.tmpSet2.clear();
    const positions = this.finder.getPositions();
    for (let i = 1; i < positions.length; i++) this.tmpSet2.or(positions[i]);
    this.tmpSet.andNot(this.tmpSet2);
    if (!this.tmpSet.isEmpty()) {
      for (const cell of [...this.tmpSet]) {
        this.newContradictionStep(entry, CELL, cell);
        this.resetTmpChains();
        for (const cand of sudoku.getAllCandidates(cell)) this.addChain(entry, cell, cand, false);
        this.replaceOrCopyStep();
      }
    }
    // all places of a candidate in a house are deleted
    this.checkHouseDel(entry, LINE_TEMPLATES, LINE);
    this.checkHouseDel(entry, COL_TEMPLATES, COL);
    this.checkHouseDel(entry, BLOCK_TEMPLATES, BLOCK);
  }

  private checkHouseDel(entry: TableEntry, houseSets: readonly SudokuSet[], entityTyp: number): void {
    const allowed = this.finder.getCandidatesAllowed();
    for (let i = 1; i < entry.offSets.length; i++) {
      for (let j = 0; j < houseSets.length; j++) {
        this.tmpSet.set(houseSets[j]);
        this.tmpSet.and(allowed[i]);
        if (!this.tmpSet.isEmpty() && entry.offSets[i].containsSet(this.tmpSet)) {
          this.newContradictionStep(entry, entityTyp, j);
          this.resetTmpChains();
          for (const k of [...this.tmpSet]) this.addChain(entry, k, i, false);
          this.replaceOrCopyStep();
        }
      }
    }
  }

  private checkHouseSet(entry: TableEntry, houseSets: readonly SudokuSet[], entityTyp: number): void {
    for (let i = 1; i < entry.onSets.length; i++) {
      for (let j = 0; j < houseSets.length; j++) {
        this.tmpSet.setAnd(houseSets[j], entry.onSets[i]);
        if (this.tmpSet.size() > 1) {
          this.newContradictionStep(entry, entityTyp, j);
          this.resetTmpChains();
          for (const k of [...this.tmpSet]) this.addChain(entry, k, i, true);
          this.replaceOrCopyStep();
        }
      }
    }
  }

  /** Loops: an entry in a table that links back to the cell the table starts in. */
  private checkNiceLoops(tables: TableEntry[]): void {
    for (const table of tables) {
      const startIndex = table.getCellIndex(0);
      for (let j = 1; j < table.index; j++) {
        if (table.getNodeType(j) === NORMAL_NODE && table.getCellIndex(j) === startIndex) {
          this.checkNiceLoop(table, j);
        }
      }
    }
  }

  /** AICs: a strong entry whose end points can eliminate something. */
  private checkAics(tables: TableEntry[]): void {
    const candidates = this.finder.getCandidates();
    for (const table of tables) {
      const startIndex = table.getCellIndex(0);
      const startCandidate = table.getCandidate(0);
      const buddies = BUDDIES[startIndex];
      for (let j = 1; j < table.index; j++) {
        if (table.getNodeType(j) !== NORMAL_NODE || !table.isStrong(j) || table.getCellIndex(j) === startIndex) continue;
        if (startCandidate === table.getCandidate(j)) {
          // same candidate at both ends: candidates seeing both ends can be eliminated
          this.tmpSet.set(buddies);
          this.tmpSet.and(BUDDIES[table.getCellIndex(j)]);
          this.tmpSet.and(candidates[startCandidate]);
          if (!this.tmpSet.isEmpty() && this.tmpSet.size() >= 2) this.checkAic(table, j);
        } else {
          // different candidates: they have to see each other's cell
          if (!buddies.contains(table.getCellIndex(j))) continue;
          if (
            this.sudoku.isCandidate(table.getCellIndex(j), startCandidate) &&
            this.sudoku.isCandidate(startIndex, table.getCandidate(j))
          ) {
            this.checkAic(table, j);
          }
        }
      }
    }
  }

  private checkNiceLoop(entry: TableEntry, entryIndex: number): void {
    const sudoku = this.sudoku;
    if (entry.getDistance(entryIndex) <= 2) return;
    const step = this.newStep('DISCONTINUOUS_NICE_LOOP');
    this.resetTmpChains();
    this.addChain(entry, entry.getCellIndex(entryIndex), entry.getCandidate(entryIndex), entry.isStrong(entryIndex), true);
    if (step.chains.length === 0) return;
    const localTmpChain = step.chains[0];
    if (localTmpChain.getCellIndex(0) === localTmpChain.getCellIndex(1)) return;
    const nlChain = localTmpChain.chain;
    const nlChainIndex = localTmpChain.end;
    const nlChainLength = localTmpChain.getLength();
    const firstLinkStrong = entry.isStrong(1);
    const lastLinkStrong = entry.isStrong(entryIndex);
    const startCandidate = entry.getCandidate(0);
    const endCandidate = entry.getCandidate(entryIndex);
    const startIndex = entry.getCellIndex(0);
    if (!firstLinkStrong && !lastLinkStrong && startCandidate === endCandidate) {
      // discontinuous: delete the start candidate in the first cell
      step.addCandidateToDelete(startIndex, startCandidate);
    } else if (firstLinkStrong && lastLinkStrong && startCandidate === endCandidate) {
      // discontinuous: delete all other candidates in the first cell
      for (const c of sudoku.getAllCandidates(startIndex)) {
        if (c !== startCandidate) step.addCandidateToDelete(startIndex, c);
      }
    } else if (firstLinkStrong !== lastLinkStrong && startCandidate !== endCandidate) {
      // discontinuous: delete the candidate of the weak link
      step.addCandidateToDelete(startIndex, !firstLinkStrong ? startCandidate : endCandidate);
    } else if (
      (!firstLinkStrong && !lastLinkStrong && sudoku.getAnzCandidates(startIndex) === 2 && startCandidate !== endCandidate) ||
      (firstLinkStrong && lastLinkStrong && startCandidate !== endCandidate) ||
      (firstLinkStrong !== lastLinkStrong && startCandidate === endCandidate)
    ) {
      // continuous nice loop: check for eliminations
      step.type = 'CONTINUOUS_NICE_LOOP';
      for (let i = 0; i <= nlChainIndex; i++) {
        // a cell with two strong links: delete all other candidates
        if (
          (i === 0 && firstLinkStrong && lastLinkStrong) ||
          (i > 0 &&
            Chain.isSStrong(nlChain[i]) &&
            i <= nlChainIndex - 2 &&
            Chain.getSCellIndex(nlChain[i - 1]) !== Chain.getSCellIndex(nlChain[i]))
        ) {
          if (
            i === 0 ||
            (!Chain.isSStrong(nlChain[i + 1]) &&
              Chain.getSCellIndex(nlChain[i]) === Chain.getSCellIndex(nlChain[i + 1]) &&
              Chain.isSStrong(nlChain[i + 2]) &&
              Chain.getSCellIndex(nlChain[i + 1]) !== Chain.getSCellIndex(nlChain[i + 2]))
          ) {
            let c1 = Chain.getSCandidate(nlChain[i]);
            let c2 = Chain.getSCandidate(nlChain[i + 2]);
            if (i === 0) {
              c1 = startCandidate;
              c2 = endCandidate;
            }
            for (const c of sudoku.getAllCandidates(Chain.getSCellIndex(nlChain[i]))) {
              if (c !== c1 && c !== c2) step.addCandidateToDelete(Chain.getSCellIndex(nlChain[i]), c);
            }
          }
        }
        // a weak link between two cells: delete the candidate in all cells that see both cells
        if (i > 0 && !Chain.isSStrong(nlChain[i]) && Chain.getSCellIndex(nlChain[i - 1]) !== Chain.getSCellIndex(nlChain[i])) {
          const actCand = Chain.getSCandidate(nlChain[i]);
          Chain.getSNodeBuddies(nlChain[i - 1], this.tmpSet);
          Chain.getSNodeBuddies(nlChain[i], this.tmpSet1);
          this.tmpSet.and(this.tmpSet1);
          this.tmpSet.andNot(this.tmpSetC);
          this.tmpSet.remove(startIndex);
          this.tmpSet.and(this.finder.getCandidates()[actCand]);
          if (!this.tmpSet.isEmpty()) {
            for (const j of this.tmpSet) step.addCandidateToDelete(j, actCand);
          }
        }
      }
    }

    if (step.candidatesToDelete.length > 0) {
      let grouped = false;
      let newChain = step.chains[0];
      for (let i = newChain.start; i <= newChain.end; i++) {
        if (Chain.getSNodeType(newChain.chain[i]) !== NORMAL_NODE) {
          grouped = true;
          break;
        }
      }
      if (grouped) {
        if (step.type === 'DISCONTINUOUS_NICE_LOOP') step.type = 'GROUPED_DISCONTINUOUS_NICE_LOOP';
        if (step.type === 'CONTINUOUS_NICE_LOOP') step.type = 'GROUPED_CONTINUOUS_NICE_LOOP';
        if (step.type === 'AIC') step.type = 'GROUPED_AIC';
      }
      if (this.onlyGroupedNiceLoops && !grouped) return;
      // the loop is not redundant: record it unless the same eliminations exist with a shorter chain
      const del = step.getCandidateKey(true);
      const oldIndex = this.deletesMap.get(del);
      if (oldIndex !== undefined && this.steps[oldIndex].getChainLength() <= nlChainLength) return;
      this.deletesMap.set(del, this.steps.length);
      newChain = step.chains[0].clone();
      step.chains = [newChain];
      this.steps.push(step.clone());
    }
  }

  /** AIC between the start of the table and a strong entry. */
  private checkAic(entry: TableEntry, entryIndex: number): void {
    const sudoku = this.sudoku;
    if (entry.getDistance(entryIndex) <= 2) return;
    const step = this.newStep('AIC');
    const startCandidate = entry.getCandidate(0);
    const endCandidate = entry.getCandidate(entryIndex);
    const startIndex = entry.getCellIndex(0);
    const endIndex = entry.getCellIndex(entryIndex);
    if (startCandidate === endCandidate) {
      // all candidates that see both ends can be eliminated
      this.tmpSet.set(BUDDIES[startIndex]);
      this.tmpSet.and(BUDDIES[endIndex]);
      this.tmpSet.and(this.finder.getCandidates()[startCandidate]);
      if (this.tmpSet.size() > 1) {
        for (const c of this.tmpSet) {
          if (c !== startIndex) step.addCandidateToDelete(c, startCandidate);
        }
      }
    } else {
      // different candidates: each can be eliminated in the other cell
      if (sudoku.isCandidate(startIndex, endCandidate)) step.addCandidateToDelete(startIndex, endCandidate);
      if (sudoku.isCandidate(endIndex, startCandidate)) step.addCandidateToDelete(endIndex, startCandidate);
    }
    if (step.getAnzCandidatesToDelete() === 0) return;
    this.resetTmpChains();
    this.addChain(entry, entry.getCellIndex(entryIndex), entry.getCandidate(entryIndex), entry.isStrong(entryIndex), false, true);
    if (step.chains.length === 0) return;
    let grouped = false;
    let newChain = step.chains[0];
    for (let i = newChain.start; i <= newChain.end; i++) {
      if (Chain.getSNodeType(newChain.chain[i]) !== NORMAL_NODE) {
        grouped = true;
        break;
      }
    }
    if (grouped && step.type === 'AIC') step.type = 'GROUPED_AIC';
    if (this.onlyGroupedNiceLoops && !grouped) return;
    const del = step.getCandidateKey(true);
    const oldIndex = this.deletesMap.get(del);
    if (oldIndex !== undefined && this.steps[oldIndex].getChainLength() <= step.chains[0].getLength()) return;
    this.deletesMap.set(del, this.steps.length);
    newChain = step.chains[0].clone();
    step.chains = [newChain];
    this.steps.push(step.clone());
  }

  /**
   * Fill the tables. For chains only the direct consequences of a premise are entered; for nets
   * (`chainsOnly == false`) every premise is played through with singles (look-ahead).
   */
  private fillTables(): void {
    const sudoku = this.sudoku;
    for (let i = 0; i < this.onTable.length; i++) {
      this.onTable[i].reset();
      this.offTable[i].reset();
    }
    this.extendedTableMap.clear();
    this.extendedTableIndex = 0;
    if (this.chainsOnly) {
      const candidates = this.finder.getCandidates();
      for (let i = 0; i < LENGTH; i++) {
        if (sudoku.getValue(i) !== 0) continue;
        for (let cand = 1; cand <= 9; cand++) {
          if (!sudoku.isCandidate(i, cand)) continue;
          // the premise itself
          this.onTable[i * 10 + cand].addEntry(i, cand, true);
          this.offTable[i * 10 + cand].addEntry(i, cand, false);
          // within the cell: setting the candidate deletes all others; deleting it sets the other
          // candidate if the cell is bivalue
          const cands = sudoku.getAllCandidates(i);
          for (const otherCand of cands) {
            if (otherCand === cand) continue;
            this.onTable[i * 10 + cand].addEntry(i, otherCand, false);
            if (cands.length === 2) this.offTable[i * 10 + cand].addEntry(i, otherCand, true);
          }
          // within the houses: setting the candidate deletes it in all other cells of the house; if
          // only two places are left, deleting it sets the other one
          this.tmpSet1.set(candidates[cand]);
          this.tmpSet1.remove(i);
          for (const constr of CONSTRAINTS[i]) {
            const anzCands = sudoku.free[constr][cand];
            if (anzCands < 2) continue;
            this.tmpSet.set(this.tmpSet1);
            this.tmpSet.and(ALL_CONSTRAINTS_TEMPLATES[constr]);
            if (this.tmpSet.isEmpty()) continue;
            for (const k of this.tmpSet) this.onTable[i * 10 + cand].addEntry(k, cand, false);
            if (anzCands === 2) this.offTable[i * 10 + cand].addEntry(this.tmpSet.get(0), cand, true);
          }
        }
      }
    } else {
      this.savedSudoku = sudoku.clone();
      this.simpleFinder = this.simpleFinder ?? new SudokuStepFinder(this.finder.options, true);
      for (let i = 0; i < LENGTH; i++) {
        if (this.savedSudoku.getValue(i) !== 0) continue;
        for (const cand of this.savedSudoku.getAllCandidates(i)) {
          sudoku.set(this.savedSudoku);
          this.getTableEntry(this.onTable[i * 10 + cand], i, cand, true);
          sudoku.set(this.savedSudoku);
          this.getTableEntry(this.offTable[i * 10 + cand], i, cand, false);
        }
      }
      sudoku.set(this.savedSudoku);
    }
  }

  /** Group nodes become entries in the extended table; the normal tables get entries for them too. */
  private fillTablesWithGroupNodes(): void {
    const candidates = this.finder.getCandidates();
    this.groupNodes = GroupNode.getGroupNodes(candidates);
    const groupNodes = this.groupNodes;
    for (let i = 0; i < groupNodes.length; i++) {
      const gn = groupNodes[i];
      // the premises "group node set" and "group node deleted" get their own tables
      const onEntry = this.getNextExtendedTableEntry(this.extendedTableIndex);
      onEntry.addEntryFull(gn.index1, gn.index2, gn.index3, GROUP_NODE, gn.cand, true, 0, 0, 0, 0, 0, 0);
      this.extendedTableMap.set(onEntry.entries[0], this.extendedTableIndex);
      this.extendedTableIndex++;
      const offEntry = this.getNextExtendedTableEntry(this.extendedTableIndex);
      offEntry.addEntryFull(gn.index1, gn.index2, gn.index3, GROUP_NODE, gn.cand, false, 0, 0, 0, 0, 0, 0);
      this.extendedTableMap.set(offEntry.entries[0], this.extendedTableIndex);
      this.extendedTableIndex++;

      // if the group node is set, the candidate is deleted from all cells that see all of its cells
      this.tmpSet.set(candidates[gn.cand]);
      this.tmpSet.and(gn.buddies);
      if (!this.tmpSet.isEmpty()) {
        for (const index of this.tmpSet) {
          onEntry.addEntry(index, gn.cand, false);
          this.onTable[index * 10 + gn.cand].addEntryFull(gn.index1, gn.index2, gn.index3, GROUP_NODE, gn.cand, false, 0, 0, 0, 0, 0, 0);
        }
        // if only one cell is left in the block, deleting the group node sets that cell
        this.tmpSet1.set(this.tmpSet);
        this.tmpSet1.and(BLOCK_TEMPLATES[gn.block]);
        if (!this.tmpSet1.isEmpty() && this.tmpSet1.size() === 1) {
          offEntry.addEntry(this.tmpSet1.get(0), gn.cand, true);
          this.offTable[this.tmpSet1.get(0) * 10 + gn.cand].addEntryFull(gn.index1, gn.index2, gn.index3, GROUP_NODE, gn.cand, true, 0, 0, 0, 0, 0, 0);
        }
        // the same for the line / column
        this.tmpSet1.set(this.tmpSet);
        if (gn.line !== -1) this.tmpSet1.and(LINE_TEMPLATES[gn.line]);
        else this.tmpSet1.and(COL_TEMPLATES[gn.col]);
        if (!this.tmpSet1.isEmpty() && this.tmpSet1.size() === 1) {
          offEntry.addEntry(this.tmpSet1.get(0), gn.cand, true);
          this.offTable[this.tmpSet1.get(0) * 10 + gn.cand].addEntryFull(gn.index1, gn.index2, gn.index3, GROUP_NODE, gn.cand, true, 0, 0, 0, 0, 0, 0);
        }
      }

      // links to other group nodes with the same candidate: in the same line, column or block
      let lineAnz = 0;
      let line1Index = -1;
      let colAnz = 0;
      let col1Index = -1;
      let blockAnz = 0;
      let block1Index = -1;
      for (let j = 0; j < groupNodes.length; j++) {
        const gn2 = groupNodes[j];
        if (j === i) continue;
        if (gn.cand !== gn2.cand) continue;
        this.tmpSet2.set(gn.indices);
        if (!this.tmpSet2.andEmpty(gn2.indices)) continue; // the group nodes overlap
        if (gn.line !== -1 && gn.line === gn2.line) {
          lineAnz++;
          if (lineAnz === 1) line1Index = j;
          onEntry.addEntryFull(gn2.index1, gn2.index2, gn2.index3, GROUP_NODE, gn.cand, false, 0, 0, 0, 0, 0, 0);
        }
        if (gn.col !== -1 && gn.col === gn2.col) {
          colAnz++;
          if (colAnz === 1) col1Index = j;
          onEntry.addEntryFull(gn2.index1, gn2.index2, gn2.index3, GROUP_NODE, gn.cand, false, 0, 0, 0, 0, 0, 0);
        }
        if (gn.block === gn2.block) {
          blockAnz++;
          if (blockAnz === 1) block1Index = j;
          onEntry.addEntryFull(gn2.index1, gn2.index2, gn2.index3, GROUP_NODE, gn.cand, false, 0, 0, 0, 0, 0, 0);
        }
      }
      // exactly one other group node in a house and nothing else left: deleting this one sets the other
      if (lineAnz === 1) {
        const gn2 = groupNodes[line1Index];
        this.tmpSet.set(LINE_TEMPLATES[gn.line]);
        this.tmpSet.and(candidates[gn.cand]);
        this.tmpSet.andNot(gn.indices);
        this.tmpSet.andNot(gn2.indices);
        if (this.tmpSet.isEmpty()) {
          offEntry.addEntryFull(gn2.index1, gn2.index2, gn2.index3, GROUP_NODE, gn.cand, true, 0, 0, 0, 0, 0, 0);
        }
      }
      if (colAnz === 1) {
        const gn2 = groupNodes[col1Index];
        this.tmpSet.set(COL_TEMPLATES[gn.col]);
        this.tmpSet.and(candidates[gn.cand]);
        this.tmpSet.andNot(gn.indices);
        this.tmpSet.andNot(gn2.indices);
        if (this.tmpSet.isEmpty()) {
          offEntry.addEntryFull(gn2.index1, gn2.index2, gn2.index3, GROUP_NODE, gn.cand, true, 0, 0, 0, 0, 0, 0);
        }
      }
      if (blockAnz === 1) {
        const gn2 = groupNodes[block1Index];
        this.tmpSet.set(BLOCK_TEMPLATES[gn.block]);
        this.tmpSet.and(candidates[gn.cand]);
        this.tmpSet.andNot(gn.indices);
        this.tmpSet.andNot(gn2.indices);
        if (this.tmpSet.isEmpty()) {
          offEntry.addEntryFull(gn2.index1, gn2.index2, gn2.index3, GROUP_NODE, gn.cand, true, 0, 0, 0, 0, 0, 0);
        }
      }
    }
  }

  private getNextExtendedTableEntry(tableIndex: number): TableEntry {
    if (tableIndex >= this.extendedTable.length) {
      const entry = new TableEntry();
      this.extendedTable.push(entry);
      return entry;
    }
    const entry = this.extendedTable[tableIndex];
    entry.reset();
    return entry;
  }

  /**
   * Play through a premise (nets): enter the premise, then look ahead for a number of rounds
   * and enter every naked and hidden single as a new conclusion (with the entries that caused it).
   */
  private getTableEntry(entry: TableEntry, cellIndex: number, cand: number, set: boolean): void {
    const sudoku = this.sudoku;
    const simpleFinder = this.simpleFinder!;
    if (set) {
      this.setCellForTable(cellIndex, cand, entry, false, false);
    } else {
      sudoku.delCandidate(cellIndex, cand);
      entry.addEntry(cellIndex, cand, false, 0);
      if (sudoku.getAnzCandidates(cellIndex) === 1) {
        const setCand = sudoku.getAllCandidates(cellIndex)[0];
        this.setCellForTable(cellIndex, setCand, entry, false, true);
      }
    }
    for (let j = 0; j < this.finder.options.anzTableLookAhead; j++) {
      const singleSteps = [...simpleFinder.findAllNakedSingles(sudoku), ...simpleFinder.findAllHiddenSingles(sudoku)];
      for (const step of singleSteps) {
        this.setCellForTable(step.indices[0], step.values[0], entry, true, step.type === 'NAKED_SINGLE');
      }
    }
  }

  /** Set a cell in the sudoku and enter the consequences in the table. */
  private setCellForTable(cellIndex: number, cand: number, entry: TableEntry, getRetIndices: boolean, nakedSingle: boolean): void {
    const sudoku = this.sudoku;
    const retIndices = this.retIndices;
    // candidates that are deleted by setting the cell
    this.tmpSet.set(this.finder.getCandidates()[cand]);
    this.tmpSet.remove(cellIndex);
    this.tmpSet.and(BUDDIES[cellIndex]);
    const cands = sudoku.getAllCandidates(cellIndex);
    // the house with the fewest places for the candidate (a hidden single comes from there)
    let entityType = LINE;
    let entityNumberFree = sudoku.free[CONSTRAINTS[cellIndex][0]][cand];
    let dummy = sudoku.free[CONSTRAINTS[cellIndex][1]][cand];
    if (dummy < entityNumberFree) {
      entityType = COL;
      entityNumberFree = dummy;
    }
    dummy = sudoku.free[CONSTRAINTS[cellIndex][2]][cand];
    if (dummy < entityNumberFree) {
      entityType = BLOCK;
      entityNumberFree = dummy;
    }
    sudoku.setCell(cellIndex, cand);
    const retIndex = entry.index;
    if (getRetIndices) {
      retIndices.fill(0);
      if (nakedSingle) {
        // all other candidates of the cell have to be deleted
        const cellCands = this.savedSudoku.getAllCandidates(cellIndex);
        let ri = 0;
        for (let i = 0; i < cellCands.length && ri < retIndices.length; i++) {
          if (cellCands[i] === cand) continue;
          retIndices[ri++] = entry.getEntryIndexOf(cellIndex, false, cellCands[i]);
        }
      } else if (entityType === LINE) {
        this.getRetIndicesForHouse(cellIndex, cand, LINE_TEMPLATES[Math.floor(cellIndex / 9)], entry);
      } else if (entityType === COL) {
        this.getRetIndicesForHouse(cellIndex, cand, COL_TEMPLATES[cellIndex % 9], entry);
      } else {
        this.getRetIndicesForHouse(cellIndex, cand, BLOCK_TEMPLATES[CONSTRAINTS[cellIndex][2] - 18], entry);
      }
      entry.addEntryFull(cellIndex, -1, -1, NORMAL_NODE, cand, true, retIndices[0], retIndices[1], retIndices[2], retIndices[3], retIndices[4], 0);
    } else {
      entry.addEntry(cellIndex, cand, true);
    }
    // the consequences: the candidate is deleted in all buddies, all other candidates in the cell
    for (const k of this.tmpSet) entry.addEntry(k, cand, false, retIndex);
    for (const c of cands) {
      if (c !== cand) entry.addEntry(cellIndex, c, false, retIndex);
    }
  }

  /** The entries (deletions of the candidate in the other cells of the house) that made a hidden single. */
  private getRetIndicesForHouse(cellIndex: number, cand: number, houseSet: SudokuSet, entry: TableEntry): void {
    this.tmpSet1.set(this.finder.getCandidates()[cand]);
    this.tmpSet1.remove(cellIndex);
    this.tmpSet1.and(houseSet);
    let ri = 0;
    for (let i = 0; i < this.tmpSet1.size() && ri < this.retIndices.length; i++) {
      this.retIndices[ri++] = entry.getEntryIndexOf(this.tmpSet1.get(i), false, cand);
    }
  }

  /**
   * Expand a table: for every outcome all outcomes from the table of that outcome are added
   * (transitive closure), keeping the shortest way to every outcome.
   */
  private expandTables(table: TableEntry[]): void {
    for (let i = 0; i < table.length; i++) {
      if (table[i].index === 0) continue;
      const dest = table[i];
      for (let j = 1; j < dest.entries.length; j++) {
        if (dest.entries[j] === 0) break;
        if (dest.isFull()) break;
        let src: TableEntry;
        let srcTableIndex = dest.getCellIndex(j) * 10 + dest.getCandidate(j);
        let isFromExtendedTable = false;
        let isFromOnTable = false;
        if (Chain.getSNodeType(dest.entries[j]) !== NORMAL_NODE) {
          const tmpSI = this.extendedTableMap.get(dest.entries[j]);
          if (tmpSI === undefined) continue; // table not found
          srcTableIndex = tmpSI;
          src = this.extendedTable[srcTableIndex];
          isFromExtendedTable = true;
        } else {
          if (dest.isStrong(j)) src = this.onTable[srcTableIndex];
          else src = this.offTable[srcTableIndex];
          isFromOnTable = dest.isStrong(j);
        }
        if (src.index === 0) continue; // no entry for the premise
        const srcBaseDistance = dest.getDistance(j);
        for (let k = 1; k < src.index; k++) {
          if (src.isExpanded(k)) continue;
          const srcDistance = src.getDistance(k);
          if (dest.indices.has(src.entries[k])) {
            const orgIndex = dest.getEntryIndex(src.entries[k]);
            if (
              dest.isExpanded(orgIndex) &&
              (dest.getDistance(orgIndex) > srcBaseDistance + srcDistance ||
                (dest.getDistance(orgIndex) === srcBaseDistance + srcDistance && dest.getNodeType(orgIndex) > src.getNodeType(k)))
            ) {
              // the entry exists already, but the new way is shorter
              dest.setRetIndex(orgIndex, srcTableIndex, 0, 0, 0, 0);
              dest.setExpanded(orgIndex);
              if (isFromExtendedTable) dest.setExtendedTable(orgIndex);
              else if (isFromOnTable) dest.setOnTable(orgIndex);
              dest.setDistance(orgIndex, srcBaseDistance + srcDistance);
            }
          } else {
            const srcCand = src.getCandidate(k);
            const srcStrong = src.isStrong(k);
            if (Chain.getSNodeType(src.entries[k]) === NORMAL_NODE) {
              dest.addEntry(src.getCellIndex(k), srcCand, srcStrong, srcTableIndex);
            } else {
              const tmp = src.entries[k];
              dest.addEntryFull(
                Chain.getSCellIndex(tmp),
                Chain.getSCellIndex2(tmp),
                Chain.getSCellIndex3(tmp),
                Chain.getSNodeType(tmp),
                srcCand,
                srcStrong,
                srcTableIndex,
                0,
                0,
                0,
                0,
                0,
              );
            }
            const last = dest.index - 1;
            dest.setExpanded(last);
            if (isFromExtendedTable) dest.setExtendedTable(last);
            else if (isFromOnTable) dest.setOnTable(last);
            dest.setDistance(last, srcBaseDistance + srcDistance);
          }
        }
      }
    }
  }

  /**
   * Build the chain that leads from the premise of `entry` to the conclusion (cell, cand, set) and
   * add it to the global step (as a chain; nets add the other chains behind separators).
   * With `isNiceLoop`/`isAic` the chain is checked for lassos.
   */
  private addChain(entry: TableEntry, cellIndex: number, cand: number, set: boolean, isNiceLoop = false, isAic = false): void {
    this.buildChain(entry, cellIndex, cand, set);
    let j = 0;
    if (isNiceLoop || isAic) {
      this.lassoSet.clear();
      if (isNiceLoop && Chain.getSCellIndex(this.chain[0]) === Chain.getSCellIndex(this.chain[1])) return;
    }
    let lastCellIndex = -1;
    let lastCellEntry = -1;
    const firstCellIndex = Chain.getSCellIndex(this.chain[this.chainIndex - 1]);
    for (let i = this.chainIndex - 1; i >= 0; i--) {
      const oldEntry = this.chain[i];
      const newCellIndex = Chain.getSCellIndex(oldEntry);
      if (isNiceLoop || isAic) {
        if (this.lassoSet.contains(newCellIndex)) return; // a lasso: not a valid chain
        if (lastCellIndex !== -1 && (lastCellIndex !== firstCellIndex || isAic)) {
          this.lassoSet.add(lastCellIndex);
          if (Chain.getSNodeType(lastCellEntry) === GROUP_NODE) {
            let tmp = Chain.getSCellIndex2(lastCellEntry);
            if (tmp !== -1) this.lassoSet.add(tmp);
            tmp = Chain.getSCellIndex3(lastCellEntry);
            if (tmp !== -1) this.lassoSet.add(tmp);
          }
        }
      }
      lastCellIndex = newCellIndex;
      lastCellEntry = oldEntry;
      this.tmpChain[j++] = oldEntry;
      // networks: the other chains that lead to this entry
      for (let k = 0; k < this.actMin; k++) {
        if (this.mins[k][this.minIndexes[k] - 1] === oldEntry) {
          for (let l = this.minIndexes[k] - 2; l >= 0; l--) this.tmpChain[j++] = -this.mins[k][l];
          this.tmpChain[j++] = -2147483648; // Integer.MIN_VALUE: separator
        }
      }
    }
    if (j > 0) {
      const target = this.tmpChains[this.tmpChainsIndex];
      for (let i = 0; i < j; i++) target.chain[i] = this.tmpChain[i];
      target.start = 0;
      target.end = j - 1;
      target.resetLength();
      this.globalStep.addChainObject(target);
      this.tmpChainsIndex++;
    }
  }

  /** Build the main chain and the chains of the other predecessors (nets). */
  private buildChain(entry: TableEntry, cellIndex: number, cand: number, set: boolean): void {
    this.chainIndex = 0;
    const chainEntry = Chain.makeSEntry(cellIndex, cand, set);
    let index = -1;
    for (let i = 0; i < entry.entries.length; i++) {
      if (entry.entries[i] === chainEntry) {
        index = i;
        break;
      }
    }
    if (index === -1) return; // no chain entry
    this.actMin = 0;
    this.minIndexes.fill(0);
    this.tmpSetC.clear();
    this.chainIndex = this.buildChainRecursive(entry, index, this.chain, false, this.tmpSetC);
    let minIndex = 0;
    while (minIndex < this.actMin) {
      this.minIndexes[minIndex] = this.buildChainRecursive(
        entry,
        entry.getEntryIndex(this.mins[minIndex][0]),
        this.mins[minIndex],
        true,
        this.tmpSetC,
      );
      minIndex++;
    }
  }

  /**
   * Follow the predecessors from an entry back to the premise. Expanded entries point into the table
   * they came from. Returns the length of the chain written to `actChain`.
   */
  private buildChainRecursive(
    startEntry: TableEntry,
    entryIndexStart: number,
    actChain: number[],
    isMin: boolean,
    chainSet: SudokuSet,
  ): number {
    let entry = startEntry;
    let entryIndex = entryIndexStart;
    let actChainIndex = 0;
    actChain[actChainIndex++] = entry.entries[entryIndex];
    let firstEntryIndex = entryIndex;
    let expanded = false;
    const orgEntry = entry;
    while (firstEntryIndex !== 0 && actChainIndex < actChain.length) {
      if (entry.isExpanded(firstEntryIndex)) {
        if (entry.isExtendedTable(firstEntryIndex)) entry = this.extendedTable[orgEntry.getRetIndex(firstEntryIndex, 0)];
        else if (entry.isOnTable(firstEntryIndex)) entry = this.onTable[orgEntry.getRetIndex(firstEntryIndex, 0)];
        else entry = this.offTable[orgEntry.getRetIndex(firstEntryIndex, 0)];
        expanded = true;
        firstEntryIndex = entry.getEntryIndex(orgEntry.entries[firstEntryIndex]);
      }
      const tmpEntryIndex = firstEntryIndex;
      for (let i = 0; i < 5; i++) {
        entryIndex = entry.getRetIndex(tmpEntryIndex, i);
        if (i === 0) {
          firstEntryIndex = entryIndex;
          actChain[actChainIndex++] = entry.entries[entryIndex];
          if (!isMin) {
            chainSet.add(entry.getCellIndex(entryIndex));
            if (Chain.getSNodeType(entry.entries[entryIndex]) === GROUP_NODE) {
              let tmp = Chain.getSCellIndex2(entry.entries[entryIndex]);
              if (tmp !== -1) chainSet.add(tmp);
              tmp = Chain.getSCellIndex3(entry.entries[entryIndex]);
              if (tmp !== -1) chainSet.add(tmp);
            }
          } else if (chainSet.contains(entry.getCellIndex(entryIndex))) {
            // the other chain runs into the main chain: stop there
            for (let j = 0; j < this.chainIndex; j++) {
              if (this.chain[j] === entry.entries[entryIndex]) return actChainIndex;
            }
          }
        } else if (entryIndex !== 0 && !isMin) {
          this.mins[this.actMin][0] = entry.entries[entryIndex];
          this.minIndexes[this.actMin++] = 1;
        }
      }
      if (expanded && firstEntryIndex === 0) {
        const retEntry = entry.entries[0];
        entry = orgEntry;
        firstEntryIndex = entry.getEntryIndex(retEntry);
        expanded = false;
      }
    }
    return actChainIndex;
  }
}

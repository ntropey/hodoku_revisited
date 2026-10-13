/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's SolutionStep and Candidate (Java).
 */
import { Chain } from './chain.js';
import type { RestrictedCommon } from './restrictedCommon.js';
import { SudokuSet } from './sudokuSet.js';
import type { SolutionType } from './generated/solutionType.js';
import { compareTypes, isFish, isKrakenFish } from './solutionType.js';

/** A unit: `type` is BLOCK, LINE or COL (see tables), `number` is 1-based. */
export interface Entity {
  type: number;
  number: number;
}

/** A candidate: digit `value` (1-9) in cell `index` (0-80). */
export class Candidate {
  constructor(
    public index: number,
    public value: number,
  ) {}

  equals(o: Candidate): boolean {
    return this.index === o.index && this.value === o.value;
  }

  toString(): string {
    return `${this.index}/${this.value}`;
  }
}

/**
 * One step of a solution: a technique that was applied, the cells/values it
 * involves and the candidates it eliminates.
 *
 * Only the fields needed by the techniques ported so far are present; more
 * (fins, chains, ALS, colors, ...) are added together with their solvers.
 */
export class SolutionStep {
  type: SolutionType;
  /** Digits that are set (singles) or that form the subset/pattern. */
  values: number[] = [];
  /** Cells that are set (singles) or that form the subset/pattern. */
  indices: number[] = [];
  candidatesToDelete: Candidate[] = [];
  /** Fins (finned fish) or, for patterns like Empty Rectangle and 2-String Kite, the cells of the connecting block. */
  fins: Candidate[] = [];
  /** Endo fins (finned fish) or, for Avoidable Rectangles Type 2, the cells with the additional candidate. */
  endoFins: Candidate[] = [];
  /** Coloring steps: the color (0, 1, ...) of every colored cell. */
  colorCandidates = new Map<number, number>();
  /** Almost locked sets that are part of the step (Sue de Coq, ALS techniques): cells and candidate mask. */
  alses: { indices: number[]; candidates: number }[] = [];
  /** Candidates that are eliminated by the fish itself (cannibalistic fish). */
  cannibalistic: Candidate[] = [];
  /** Chains (X-Chain, XY-Chain, Remote Pair, Nice Loop, ...) of the step. */
  chains: Chain[] = [];
  /** Fish that is part of a Kraken Fish step: the type of the fish. */
  subType: SolutionType | null = null;
  isSiamese = false;
  /** ALS techniques: the restricted commons that link the ALS. */
  restrictedCommons: RestrictedCommon[] = [];
  /** Fish: the units of the base set and of the cover set. */
  baseEntities: Entity[] = [];
  coverEntities: Entity[] = [];
  /** Fish: all potential eliminations (cover candidates that are not base candidates), and the cannibalistic ones. */
  potentialEliminations = new SudokuSet();
  potentialCannibalisticEliminations = new SudokuSet();
  /** Unit type (see BLOCK/LINE/COL in tables) for steps that have one, e.g. Locked Candidates. */
  entity = 0;
  /** 1-based number of that unit. */
  entityNumber = 0;

  constructor(type: SolutionType) {
    this.type = type;
  }

  addValue(value: number): void {
    this.values.push(value);
  }

  addIndex(index: number): void {
    this.indices.push(index);
  }

  addCandidateToDelete(index: number, candidate: number): void {
    this.candidatesToDelete.push(new Candidate(index, candidate));
  }

  /** Add an existing chain object (not a copy). */
  addChainObject(chain: Chain): void {
    this.chains.push(chain);
  }

  addChain(start: number, end: number, chain: number[]): void {
    this.chains.push(new Chain(start, end, chain));
  }

  addCannibalistic(index: number, candidate: number): void {
    this.cannibalistic.push(new Candidate(index, candidate));
  }

  addAls(indices: Iterable<number>, candidates: number): void {
    this.alses.push({ indices: [...indices], candidates });
  }

  addColorCandidate(index: number, color: number): void {
    this.colorCandidates.set(index, color);
  }

  addColorCandidates(indices: Iterable<number>, color: number): void {
    for (const index of indices) this.addColorCandidate(index, color);
  }

  addEndoFin(index: number, candidate: number): void {
    this.endoFins.push(new Candidate(index, candidate));
  }

  addFin(index: number, candidate: number): void {
    this.fins.push(new Candidate(index, candidate));
  }

  getAnzCandidatesToDelete(): number {
    return this.candidatesToDelete.length;
  }

  clone(): SolutionStep {
    const s = new SolutionStep(this.type);
    s.values = this.values.slice();
    s.indices = this.indices.slice();
    s.candidatesToDelete = this.candidatesToDelete.map((c) => new Candidate(c.index, c.value));
    s.fins = this.fins.map((c) => new Candidate(c.index, c.value));
    s.endoFins = this.endoFins.map((c) => new Candidate(c.index, c.value));
    s.colorCandidates = new Map(this.colorCandidates);
    s.alses = this.alses.map((a) => ({ indices: a.indices.slice(), candidates: a.candidates }));
    s.cannibalistic = this.cannibalistic.map((c) => new Candidate(c.index, c.value));
    s.chains = this.chains.map((c) => c.clone());
    s.subType = this.subType;
    s.isSiamese = this.isSiamese;
    s.restrictedCommons = this.restrictedCommons.map((r) => r.clone());
    s.baseEntities = this.baseEntities.map((e) => ({ ...e }));
    s.coverEntities = this.coverEntities.map((e) => ({ ...e }));
    s.potentialEliminations = this.potentialEliminations.clone();
    s.potentialCannibalisticEliminations = this.potentialCannibalisticEliminations.clone();
    s.entity = this.entity;
    s.entityNumber = this.entityNumber;
    return s;
  }

  /** A step that sets a cell (note: includes Template Set, unlike the solver's notion of a single). */
  isSingle(): boolean {
    return isSingleType(this.type);
  }

  /**
   * Sort the candidates to delete (by digit, then cell) and remove duplicates.
   * The original does this as a side effect of building the candidate string; chain
   * solvers rely on it, so the order of `candidatesToDelete` in their steps is sorted.
   */
  normalizeCandidatesToDelete(): void {
    const sorted = [...this.candidatesToDelete].sort(compareCandidates);
    this.candidatesToDelete = sorted.filter((c, i) => i === 0 || compareCandidates(sorted[i - 1], c) !== 0);
  }

  /**
   * A key that identifies the set of eliminations (used to detect the same step twice); with
   * `withType` the step type is part of the key. Sorts the candidates to delete.
   */
  getCandidateKey(withType = false): string {
    this.normalizeCandidatesToDelete();
    const key = this.candidatesToDelete.map((c) => `${c.value}:${c.index}`).join(' ');
    return withType ? `${this.type}|${key}` : key;
  }

  /** A key that identifies a step that sets cells: type, cells and value. */
  getSingleCandidateKey(): string {
    const cells = [...new Set(this.indices)].sort((a, b) => a - b).join(',');
    return `${this.type}|${cells}=${this.values[0]}`;
  }

  /** True if a chain of the step contains a net (a negative node). */
  isNet(): boolean {
    for (const chain of this.chains) {
      for (let j = chain.start; j <= chain.end; j++) {
        if (chain.chain[j] < 0) return true;
      }
    }
    return false;
  }

  /** Compare the candidates to delete: more first, then one by one by cell and digit. */
  compareCandidatesToDelete(o: SolutionStep): number {
    const size1 = this.candidatesToDelete.length;
    const size2 = o.candidatesToDelete.length;
    if (size1 !== size2) return size2 - size1; // descending
    for (let i = 0; i < size1; i++) {
      const c1 = this.candidatesToDelete[i];
      const c2 = o.candidatesToDelete[i];
      const result = c1.index * 10 + c1.value - (c2.index * 10 + c2.value);
      if (result !== 0) return result;
    }
    return 0;
  }

  /** Total number of cells in all ALS of the step. */
  getAlsesIndexCount(): number {
    return this.alses.reduce((n, a) => n + a.indices.length, 0);
  }

  /** The weighted sum of the indices of the candidates to delete (sort criterion). */
  getIndexSumme(): number {
    return getIndexSumme(this.candidatesToDelete);
  }

  getChainLength(): number {
    let length = 0;
    const penalties = this.alses.map((a) => ({ chainPenalty: getAlsChainPenalty(a.indices.length) }));
    for (const chain of this.chains) length += chain.getLength(penalties);
    return length;
  }

  /**
   * Two steps are equivalent if they have the same type (all fish count as the same type)
   * and eliminate the same candidates (or set the same cells).
   */
  isEquivalent(s: SolutionStep): boolean {
    if (isFish(this.type) && isFish(s.type)) return true;
    if (isKrakenFish(this.type) && isKrakenFish(s.type)) return true;
    if (this.type !== s.type) return false;
    if (this.candidatesToDelete.length > 0) return isEqualCandidate(this.candidatesToDelete, s.candidatesToDelete);
    return isEqualInteger(this.indices, s.indices);
  }

  /**
   * The sort order of steps: steps that set a cell first, then the steps that eliminate the
   * most candidates, then (for equivalent steps) shorter chains, fewer fins, and so on.
   */
  compareTo(o: SolutionStep): number {
    // steps that set a cell always come first
    if (isSingleType(this.type) && !isSingleType(o.type)) return -1;
    if (!isSingleType(this.type) && isSingleType(o.type)) return 1;

    // most candidates to delete first (descending!)
    const result = o.candidatesToDelete.length - this.candidatesToDelete.length;
    if (result !== 0) return result;

    // not equivalent: by sum of the indices of the candidates to delete
    if (!this.isEquivalent(o)) {
      return getIndexSumme(this.candidatesToDelete) - getIndexSumme(o.candidatesToDelete);
    }

    // fish: sort for fish type, size, cannibalism, number of endo fins, number of fins
    if (isFish(this.type) && isFish(o.type)) {
      let ret = compareTypes(this.type, o.type);
      if (ret !== 0) return ret;
      ret = this.cannibalistic.length - o.cannibalistic.length;
      if (ret !== 0) return ret;
      ret = this.endoFins.length - o.endoFins.length;
      if (ret !== 0) return ret;
      ret = this.fins.length - o.fins.length;
      if (ret !== 0) return ret;
      if (!isEqualInteger(this.values, o.values)) return sum(this.values) - sum(o.values);
      return 0;
    }

    // kraken fish: sort for (fish type, chain length)
    if (isKrakenFish(this.type) && isKrakenFish(o.type)) {
      const ret = compareTypes(this.subType!, o.subType!);
      if (ret !== 0) return ret;
      return this.getChainLength() - o.getChainLength();
    }

    // general steps: by chain length (total)
    const chainDiff = this.getChainLength() - o.getChainLength();
    if (chainDiff !== 0) return chainDiff;

    // then by the candidates involved: if all are the same the steps are the same, else the sum counts
    if (!isEqualInteger(this.values, o.values)) return sum(this.values) - sum(o.values);

    // then by cells: first the number, then the sum (descending)
    if (!isEqualInteger(this.indices, o.indices)) {
      if (this.indices.length !== o.indices.length) return this.indices.length - o.indices.length;
      return sum(o.indices) - sum(this.indices);
    }

    // last by type
    return compareTypes(this.type, o.type);
  }
}

/** Number of links that an ALS with `size` cells adds to the length of a chain. */
export function getAlsChainPenalty(size: number): number {
  if (size === 0 || size === 1) return 0;
  if (size === 2) return size - 1;
  return (size - 1) * 2;
}

function isSingleType(type: SolutionType): boolean {
  return type === 'FULL_HOUSE' || type === 'HIDDEN_SINGLE' || type === 'NAKED_SINGLE' || type === 'TEMPLATE_SET';
}

/** Order of candidates: by digit, then by cell. */
export function compareCandidates(a: Candidate, b: Candidate): number {
  return a.value - b.value || a.index - b.index;
}

function sum(list: readonly number[]): number {
  return list.reduce((a, b) => a + b, 0);
}

/** Same elements, ignoring order (the original only checks that every element of l1 is in l2). */
function isEqualInteger(l1: readonly number[], l2: readonly number[]): boolean {
  if (l1.length !== l2.length) return false;
  return l1.every((v) => l2.includes(v));
}

function isEqualCandidate(l1: readonly Candidate[], l2: readonly Candidate[]): boolean {
  if (l1.length !== l2.length) return false;
  return l1.every((c1) => l2.some((c2) => c1.index === c2.index && c1.value === c2.value));
}

/**
 * The sum of the indices of a list of candidates is used as a sort criterion. The indices
 * are weighted so that two combinations of different indices cannot give the same sum.
 */
function getIndexSumme(list: readonly Candidate[]): number {
  let total = 0;
  let offset = 1;
  for (const c of list) {
    total += c.index * offset + c.value;
    offset += 80;
  }
  return total;
}

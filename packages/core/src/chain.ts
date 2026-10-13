/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's Chain (Java).
 */
import { BUDDIES } from './tables.js';
import type { SudokuSet } from './sudokuSet.js';

/*
 * A chain is an array of int32 entries, one per node. An entry (bits from low to high):
 *   0-3   candidate
 *   4     strong link flag
 *   5-11  cell index (INDEX1)
 *   12-18 second cell index of a group node (INDEX2); for ALS nodes bits 12-25 hold the ALS index
 *   19-25 third cell index of a group node (INDEX3)
 *   26-29 node type (normal, group, ALS)
 * A negative entry marks a node that is part of a net (only used by forcing nets); the
 * accessors take the absolute value.
 */
const CAND_MASK = 0xf;
const STRONG_MASK = 0x10;
const INDEX_MASK = 0x7f;
const INDEX1_OFFSET = 5;
const INDEX2_OFFSET = 12;
const INDEX3_OFFSET = 19;
const ALS_INDEX_MASK = 0x3fff000;
const ALS_INDEX_OFFSET = 12;
const NO_INDEX = 0x7f;
const MODE_MASK = 0x3c000000;
const MODE_OFFSET = 26;
const GROUP_NODE_MASK = 0x4000000;
const ALS_NODE_MASK = 0x8000000;

export const NORMAL_NODE = 0;
export const GROUP_NODE = 1;
export const ALS_NODE = 2;
export const TYPE_NAMES = ['NORMAL_NODE', 'GROUP_NODE', 'ALS_NODE'] as const;

/** Anything that can tell the penalty (extra length) an ALS node adds to a chain. */
export interface AlsPenalty {
  chainPenalty: number;
}

export class Chain {
  /** cached length, -1 = not calculated */
  private length = -1;

  /**
   * @param start index of the first node in `chain`
   * @param end index of the last node in `chain` (inclusive)
   */
  constructor(
    public start: number,
    public end: number,
    public chain: number[],
  ) {}

  clone(): Chain {
    return new Chain(this.start, this.end, this.chain.slice(0, this.end + 1));
  }

  /** The length of the chain. ALS nodes count longer than normal nodes (see the penalty). */
  getLength(alses: readonly AlsPenalty[] | null = null): number {
    if (this.length === -1) this.length = this.calculateLength(alses);
    return this.length;
  }

  resetLength(): void {
    this.length = -1;
  }

  private calculateLength(alses: readonly AlsPenalty[] | null): number {
    let tmpLength = 0;
    for (let i = this.start; i <= this.end; i++) {
      tmpLength++;
      if (Chain.getSNodeType(this.chain[i]) === ALS_NODE) {
        if (alses !== null) {
          const alsIndex = Chain.getSAlsIndex(this.chain[i]);
          tmpLength += alses.length > alsIndex ? alses[alsIndex].chainPenalty : 5;
        } else {
          tmpLength += 2.5;
        }
      }
    }
    return Math.trunc(tmpLength);
  }

  getCellIndex(index: number): number {
    return Chain.getSCellIndex(this.chain[index]);
  }

  getCandidate(index: number): number {
    return Chain.getSCandidate(this.chain[index]);
  }

  isStrong(index: number): boolean {
    return Chain.isSStrong(this.chain[index]);
  }

  getNodeType(index: number): number {
    return Chain.getSNodeType(this.chain[index]);
  }

  /** Create a node entry for a single cell. */
  static makeSEntry(cellIndex: number, candidate: number, isStrong: boolean, nodeType = NORMAL_NODE): number {
    return Chain.makeSEntryFull(cellIndex, 0, 0, candidate, isStrong, nodeType);
  }

  /** Create a node entry for an ALS node (the ALS index is split over the two index fields). */
  static makeSAlsEntry(cellIndex: number, alsIndex: number, candidate: number, isStrong: boolean, nodeType: number): number {
    const higher = (alsIndex >> 7) & INDEX_MASK;
    const lower = alsIndex & INDEX_MASK;
    return Chain.makeSEntryFull(cellIndex, lower, higher, candidate, isStrong, nodeType);
  }

  /** Create a node entry; `cellIndex2`/`cellIndex3` are -1 if unused. */
  static makeSEntryFull(
    cellIndex1: number,
    cellIndex2: number,
    cellIndex3: number,
    candidate: number,
    isStrong: boolean,
    nodeType: number,
  ): number {
    let entry = (cellIndex1 << INDEX1_OFFSET) | candidate;
    if (isStrong) entry |= STRONG_MASK;
    if (nodeType === GROUP_NODE) entry |= GROUP_NODE_MASK;
    else if (nodeType === ALS_NODE) entry |= ALS_NODE_MASK;
    if (cellIndex2 === -1) cellIndex2 = nodeType === NORMAL_NODE ? 0 : NO_INDEX;
    if (cellIndex3 === -1) cellIndex3 = nodeType === NORMAL_NODE ? 0 : NO_INDEX;
    entry |= cellIndex2 << INDEX2_OFFSET;
    entry |= cellIndex3 << INDEX3_OFFSET;
    return entry;
  }

  static getSCellIndex(entry: number): number {
    return ((entry > 0 ? entry : -entry) >> INDEX1_OFFSET) & INDEX_MASK;
  }

  static getSCellIndex2(entry: number): number {
    const result = ((entry > 0 ? entry : -entry) >> INDEX2_OFFSET) & INDEX_MASK;
    return result === INDEX_MASK ? -1 : result;
  }

  static getSCellIndex3(entry: number): number {
    const result = ((entry > 0 ? entry : -entry) >> INDEX3_OFFSET) & INDEX_MASK;
    return result === INDEX_MASK ? -1 : result;
  }

  static getSAlsIndex(entry: number): number {
    const e = entry < 0 ? -entry : entry;
    return (e & ALS_INDEX_MASK) >> ALS_INDEX_OFFSET;
  }

  static replaceSAlsIndex(entry: number, newAlsIndex: number): number {
    let e = entry & ~ALS_INDEX_MASK;
    e |= (newAlsIndex << ALS_INDEX_OFFSET) & ALS_INDEX_MASK;
    return e;
  }

  static getSCandidate(entry: number): number {
    return (entry > 0 ? entry : -entry) & CAND_MASK;
  }

  static isSStrong(entry: number): boolean {
    return ((entry > 0 ? entry : -entry) & STRONG_MASK) !== 0;
  }

  static getSNodeType(entry: number): number {
    return ((entry > 0 ? entry : -entry) & MODE_MASK) >> MODE_OFFSET;
  }

  static setSStrong(entry: number, strong: boolean): number {
    return strong ? entry | STRONG_MASK : entry & ~STRONG_MASK;
  }

  /** All cells that see a node of normal or group type (group: all cells that see every cell of the group). */
  static getSNodeBuddies(entry: number, set: SudokuSet): void {
    const type = Chain.getSNodeType(entry);
    if (type === NORMAL_NODE) {
      set.set(BUDDIES[Chain.getSCellIndex(entry)]);
    } else if (type === GROUP_NODE) {
      set.set(BUDDIES[Chain.getSCellIndex(entry)]);
      set.and(BUDDIES[Chain.getSCellIndex2(entry)]);
      if (Chain.getSCellIndex3(entry) !== -1) set.and(BUDDIES[Chain.getSCellIndex3(entry)]);
    } else {
      throw new Error(`getSNodeBuddies(): node type ${type} needs the ALS list`);
    }
  }

  static entryToString(entry: number): string {
    if (entry === -2147483648) return 'MIN';
    const sign = entry < 0 ? '-' : '';
    const type = Chain.getSNodeType(entry);
    if (type === ALS_NODE) {
      return `${sign}${TYPE_NAMES[type]}/${Chain.getSAlsIndex(entry)}/${Chain.getSCellIndex(entry)}/${Chain.isSStrong(entry)}/${Chain.getSCandidate(entry)}`;
    }
    return `${sign}${TYPE_NAMES[type]}/${Chain.getSCellIndex3(entry)}/${Chain.getSCellIndex2(entry)}/${Chain.getSCellIndex(entry)}/${Chain.isSStrong(entry)}/${Chain.getSCandidate(entry)}`;
  }

  toString(): string {
    const parts: string[] = [];
    for (let i = this.start; i <= this.end; i++) parts.push(Chain.entryToString(this.chain[i]));
    return parts.join(' ');
  }
}

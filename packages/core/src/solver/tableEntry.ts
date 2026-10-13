/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's TableEntry (Java).
 */
import { Chain, NORMAL_NODE } from '../chain.js';
import { SudokuSet } from '../sudokuSet.js';

/*
 * The format of an entry is described in Chain.
 *
 * A TableEntry holds all possible outcomes of one single premise ("candidate is set in / eliminated
 * from a cell"); the premise itself is entry 0. The TablingSolver has two arrays of TableEntries: the
 * index (cell * 10 + candidate) decides cell and candidate, one array is for "candidate eliminated
 * from the cell" (offTable), one for "cell is set to the candidate" (onTable).
 *
 * `entries` holds the conclusions, `retIndices` up to five indices of other entries that have to be
 * true for that conclusion (used to reconstruct the chain; more than one means a net).
 *
 * The original packs a retIndex into one 64 bit long:
 *   bits  0-11  index of the first predecessor (can be longer than 10 bits for extended tables)
 *   bits 12-51  indices 2-5 (10 bits each; nets only)
 *   bits 52-60  distance to the root of the chain
 *   bit  61     expanded (the entry comes from another table)
 *   bit  62     the source table is an on-table
 *   bit  63     the source table is the extended table
 * JavaScript has no cheap 64 bit integers, so the fields are stored in separate typed arrays.
 */

/** Maximum number of entries in one table. */
export const MAX_TABLE_ENTRY_LENGTH = 1000;

export class TableEntry {
  /** Index of the next free entry. */
  index = 0;
  /** The conclusions (Chain entry format). Synchronized with the ret index arrays. */
  readonly entries: Int32Array;
  // the five predecessor indices, the distance and the flags of every entry
  private readonly r1: Int16Array;
  private readonly r2: Int16Array;
  private readonly r3: Int16Array;
  private readonly r4: Int16Array;
  private readonly r5: Int16Array;
  private readonly dist: Int16Array;
  private readonly flags: Uint8Array;
  private static readonly EXPANDED = 1;
  private static readonly ON_TABLE = 2;
  private static readonly EXTENDED_TABLE = 4;
  /** All cells for every candidate that can be set as a result of the premise. */
  readonly onSets: SudokuSet[] = Array.from({ length: 10 }, () => new SudokuSet());
  /** All cells for every candidate that can be eliminated as a result of the premise. */
  readonly offSets: SudokuSet[] = Array.from({ length: 10 }, () => new SudokuSet());
  /** Reverse lookup: the index in `entries` for every entry. */
  readonly indices = new Map<number, number>();

  constructor(length = MAX_TABLE_ENTRY_LENGTH) {
    this.entries = new Int32Array(length);
    this.r1 = new Int16Array(length);
    this.r2 = new Int16Array(length);
    this.r3 = new Int16Array(length);
    this.r4 = new Int16Array(length);
    this.r5 = new Int16Array(length);
    this.dist = new Int16Array(length);
    this.flags = new Uint8Array(length);
  }

  /** Clears the whole table. Unused entries are always zero, so only the used part is cleared. */
  reset(): void {
    const n = this.index;
    this.entries.fill(0, 0, n);
    this.r1.fill(0, 0, n);
    this.r2.fill(0, 0, n);
    this.r3.fill(0, 0, n);
    this.r4.fill(0, 0, n);
    this.r5.fill(0, 0, n);
    this.dist.fill(0, 0, n);
    this.flags.fill(0, 0, n);
    this.index = 0;
    this.indices.clear();
    for (let i = 0; i < this.onSets.length; i++) {
      this.onSets[i].clear();
      this.offSets[i].clear();
    }
  }

  /** Add an entry for a single cell. */
  addEntry(cellIndex: number, cand: number, set: boolean, reverseIndex = 0, penalty = 0): void {
    this.addEntryFull(cellIndex, -1, -1, NORMAL_NODE, cand, set, reverseIndex, 0, 0, 0, 0, penalty);
  }

  addEntryFull(
    cellIndex1: number,
    cellIndex2: number,
    cellIndex3: number,
    nodeType: number,
    cand: number,
    set: boolean,
    ri1: number,
    ri2: number,
    ri3: number,
    ri4: number,
    ri5: number,
    penalty: number,
  ): void {
    if (this.index >= this.entries.length) return; // the table is already full
    if (nodeType === NORMAL_NODE) {
      if ((set && this.onSets[cand].contains(cellIndex1)) || (!set && this.offSets[cand].contains(cellIndex1))) {
        return; // already there
      }
    }
    const entry = Chain.makeSEntryFull(cellIndex1, cellIndex2, cellIndex3, cand, set, nodeType);
    const index = this.index;
    this.entries[index] = entry;
    this.setRetIndex(index, ri1, ri2, ri3, ri4, ri5);
    if (ri1 < this.entries.length) this.setDistance(index, this.getDistance(ri1) + 1);
    if (nodeType === NORMAL_NODE) {
      if (set) this.onSets[cand].add(cellIndex1);
      else this.offSets[cand].add(cellIndex1);
    }
    this.setDistance(index, this.getDistance(index) + penalty);
    this.indices.set(entry, index);
    this.index++;
  }

  getEntryIndexOf(cellIndex: number, set: boolean, cand: number): number {
    return this.indices.get(Chain.makeSEntry(cellIndex, cand, set)) ?? 0;
  }

  getEntryIndex(entry: number): number {
    const ret = this.indices.get(entry);
    if (ret === undefined) throw new Error(`TableEntry: no index for entry ${entry}`);
    return ret;
  }

  isFull(): boolean {
    return this.index === this.entries.length;
  }

  getCellIndex(index: number): number {
    return Chain.getSCellIndex(this.entries[index]);
  }

  isStrong(index: number): boolean {
    return Chain.isSStrong(this.entries[index]);
  }

  getCandidate(index: number): number {
    return Chain.getSCandidate(this.entries[index]);
  }

  getNodeType(index: number): number {
    return Chain.getSNodeType(this.entries[index]);
  }

  /**
   * Set the predecessor indices of an entry (this clears distance and flags, like assigning
   * a freshly built ret index in the original). The largest index always goes first, so that the
   * shortest chain becomes the "main" chain in nets.
   */
  setRetIndex(index: number, i1: number, i2: number, i3: number, i4: number, i5: number): void {
    let t: number;
    if (i1 > 4096) i1 = 0;
    if (i2 > 1023) i2 = 0;
    if (i3 > 1023) i3 = 0;
    if (i4 > 1023) i4 = 0;
    if (i5 > 1023) i5 = 0;
    if (i2 > i1) {
      t = i2;
      i2 = i1;
      i1 = t;
    }
    if (i3 > i1) {
      t = i3;
      i3 = i1;
      i1 = t;
    }
    if (i4 > i1) {
      t = i4;
      i4 = i1;
      i1 = t;
    }
    if (i5 > i1) {
      t = i5;
      i5 = i1;
      i1 = t;
    }
    this.r1[index] = i1;
    this.r2[index] = i2;
    this.r3[index] = i3;
    this.r4[index] = i4;
    this.r5[index] = i5;
    this.dist[index] = 0;
    this.flags[index] = 0;
  }

  /** The `which`-th (0-4) predecessor index of an entry. */
  getRetIndex(index: number, which: number): number {
    switch (which) {
      case 0:
        return this.r1[index];
      case 1:
        return this.r2[index];
      case 2:
        return this.r3[index];
      case 3:
        return this.r4[index];
      default:
        return this.r5[index];
    }
  }

  setDistance(index: number, distance: number): void {
    this.dist[index] = distance & 0x1ff;
  }

  getDistance(index: number): number {
    return this.dist[index];
  }

  isExpanded(index: number): boolean {
    return (this.flags[index] & TableEntry.EXPANDED) !== 0;
  }

  setExpanded(index: number): void {
    this.flags[index] |= TableEntry.EXPANDED;
  }

  isOnTable(index: number): boolean {
    return (this.flags[index] & TableEntry.ON_TABLE) !== 0;
  }

  setOnTable(index: number): void {
    this.flags[index] |= TableEntry.ON_TABLE;
  }

  isExtendedTable(index: number): boolean {
    return (this.flags[index] & TableEntry.EXTENDED_TABLE) !== 0;
  }

  setExtendedTable(index: number): void {
    this.flags[index] |= TableEntry.EXTENDED_TABLE;
  }
}

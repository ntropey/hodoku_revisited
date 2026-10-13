/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 * GPL-3.0-or-later; see LICENSE. Modified version of HoDoKu's SudokuSinglesQueue (Java).
 */
import { CONSTRAINTS, LENGTH } from './tables.js';

/**
 * A queue that can hold possible Singles (naked or hidden). For Hidden Singles
 * the unit is not stored, Full houses are treated as Naked Singles.
 * Since every (Hidden) Single can appear in three houses, the maximum size
 * of the queue is three times the number of cells in the Sudoku.
 *
 * The queue is not a ring buffer: the indices are reset to 0 every time the
 * queue is empty. Singles can be deleted from the queue.
 */
export class SinglesQueue {
  private indices = new Int32Array(LENGTH * 3);
  private values = new Int32Array(LENGTH * 3);
  private putIndex = 0;
  private getIdx = 0;
  private iterateIndex = 0;

  clone(): SinglesQueue {
    const q = new SinglesQueue();
    q.set(this);
    return q;
  }

  set(src: SinglesQueue): void {
    this.indices.set(src.indices);
    this.values.set(src.values);
    this.getIdx = src.getIdx;
    this.putIndex = src.putIndex;
    this.iterateIndex = src.iterateIndex;
  }

  isEmpty(): boolean {
    return this.getIdx >= this.putIndex;
  }

  addSingle(index: number, value: number): void {
    this.indices[this.putIndex] = index;
    this.values[this.putIndex++] = value;
  }

  /**
   * Returns the queue position of the next Single or -1 if the queue is empty.
   * The oldest Single is removed from the queue; its data stays readable via
   * {@link getIndex} / {@link getValue} until the next add.
   */
  getSingle(): number {
    if (this.getIdx >= this.putIndex) return -1;
    const ret = this.getIdx++;
    if (this.getIdx >= this.putIndex) this.getIdx = this.putIndex = 0;
    return ret;
  }

  /** The cell index at queue position `queueIndex`. */
  getIndex(queueIndex: number): number {
    return this.indices[queueIndex];
  }

  /** The cell value at queue position `queueIndex`. */
  getValue(queueIndex: number): number {
    return this.values[queueIndex];
  }

  /** Start iterating without removing elements; returns -1 if empty. */
  getFirstIndex(): number {
    this.iterateIndex = this.getIdx;
    return this.getNextIndex();
  }

  /** Continue iterating without removing elements; returns -1 at the end. */
  getNextIndex(): number {
    if (this.iterateIndex >= this.putIndex) return -1;
    return this.iterateIndex++;
  }

  /** Delete the entry for the cell `index`, if there is one. */
  deleteNakedSingle(index: number): void {
    for (let i = this.getIdx; i < this.putIndex; i++) {
      if (this.indices[i] === index) {
        this.removeAt(i);
        break;
      }
    }
  }

  /** Delete the entry for candidate `value` in a cell of `constraint`, if there is one. */
  deleteHiddenSingle(constraint: number, value: number): void {
    for (let i = this.getIdx; i < this.putIndex; i++) {
      const c = CONSTRAINTS[this.indices[i]];
      if (this.values[i] === value && (c[0] === constraint || c[1] === constraint || c[2] === constraint)) {
        this.removeAt(i);
        break;
      }
    }
  }

  clear(): void {
    this.getIdx = this.putIndex = 0;
  }

  private removeAt(i: number): void {
    for (let j = i + 1; j < this.putIndex; j++) {
      this.indices[j - 1] = this.indices[j];
      this.values[j - 1] = this.values[j];
    }
    this.putIndex--;
  }
}

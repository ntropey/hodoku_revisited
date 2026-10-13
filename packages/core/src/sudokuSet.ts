/*
 * Hodoku Revisited - a TypeScript port of HoDoKu.
 * Copyright (C) 2008-12 Bernhard Hobiger (original HoDoKu)
 * Copyright (C) 2026 Hodoku Revisited contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * Modified version of HoDoKu's SudokuSet/SudokuSetBase (Java).
 */

/** Mask of the 17 valid bits in the third word (cells 64..80). */
const MAX_MASK_2 = 0x1ffff;

/**
 * A set of cell indices 0..80, stored as a bitmap in three 32-bit words
 * (cells 0-31, 32-63, 64-80). Iteration order is always ascending.
 *
 * The original uses two 64-bit longs; JavaScript has no cheap 64-bit
 * integers, so three int32 words are used instead.
 */
export class SudokuSet {
  m0 = 0;
  m1 = 0;
  m2 = 0;
  private cache: number[] | null = null;

  constructor(init?: SudokuSet | boolean) {
    if (init instanceof SudokuSet) {
      this.set(init);
    } else if (init === true) {
      this.setAll();
    }
  }

  static fromValues(values: Iterable<number>): SudokuSet {
    const s = new SudokuSet();
    for (const v of values) s.add(v);
    return s;
  }

  clone(): SudokuSet {
    return new SudokuSet(this);
  }

  isEmpty(): boolean {
    return (this.m0 | this.m1 | this.m2) === 0;
  }

  add(value: number): void {
    if (value >= 64) this.m2 |= 1 << (value - 64);
    else if (value >= 32) this.m1 |= 1 << (value - 32);
    else this.m0 |= 1 << value;
    this.cache = null;
  }

  remove(value: number): void {
    if (value >= 64) this.m2 &= ~(1 << (value - 64));
    else if (value >= 32) this.m1 &= ~(1 << (value - 32));
    else this.m0 &= ~(1 << value);
    this.cache = null;
  }

  contains(value: number): boolean {
    if (value >= 64) return (this.m2 & (1 << (value - 64))) !== 0;
    if (value >= 32) return (this.m1 & (1 << (value - 32))) !== 0;
    return (this.m0 & (1 << value)) !== 0;
  }

  /** true if every element of b is in this set */
  containsSet(b: SudokuSet): boolean {
    return (b.m0 & ~this.m0) === 0 && (b.m1 & ~this.m1) === 0 && (b.m2 & ~this.m2) === 0;
  }

  set(src: SudokuSet): void {
    this.m0 = src.m0;
    this.m1 = src.m1;
    this.m2 = src.m2;
    this.cache = null;
  }

  /** Set all three 32-bit words directly (cells 0-31, 32-63, 64-80). */
  setWords(m0: number, m1: number, m2: number): void {
    this.m0 = m0;
    this.m1 = m1;
    this.m2 = m2;
    this.cache = null;
  }

  clear(): void {
    this.m0 = this.m1 = this.m2 = 0;
    this.cache = null;
  }

  setAll(): void {
    this.m0 = -1;
    this.m1 = -1;
    this.m2 = MAX_MASK_2;
    this.cache = null;
  }

  equals(o: SudokuSet): boolean {
    return this.m0 === o.m0 && this.m1 === o.m1 && this.m2 === o.m2;
  }

  intersects(b: SudokuSet): boolean {
    return (this.m0 & b.m0) !== 0 || (this.m1 & b.m1) !== 0 || (this.m2 & b.m2) !== 0;
  }

  /** (this & b) == 0 */
  andEmpty(b: SudokuSet): boolean {
    return !this.intersects(b);
  }

  or(b: SudokuSet): void {
    this.m0 |= b.m0;
    this.m1 |= b.m1;
    this.m2 |= b.m2;
    this.cache = null;
  }

  and(b: SudokuSet): void {
    this.m0 &= b.m0;
    this.m1 &= b.m1;
    this.m2 &= b.m2;
    this.cache = null;
  }

  andNot(b: SudokuSet): void {
    this.m0 &= ~b.m0;
    this.m1 &= ~b.m1;
    this.m2 &= ~b.m2;
    this.cache = null;
  }

  /** this |= ~b (limited to the 81 cells) */
  orNot(b: SudokuSet): void {
    this.m0 |= ~b.m0;
    this.m1 |= ~b.m1;
    this.m2 = (this.m2 | ~b.m2) & MAX_MASK_2;
    this.cache = null;
  }

  not(): void {
    this.m0 = ~this.m0;
    this.m1 = ~this.m1;
    this.m2 = ~this.m2 & MAX_MASK_2;
    this.cache = null;
  }

  setAnd(a: SudokuSet, b: SudokuSet): void {
    this.m0 = a.m0 & b.m0;
    this.m1 = a.m1 & b.m1;
    this.m2 = a.m2 & b.m2;
    this.cache = null;
  }

  setOr(a: SudokuSet, b: SudokuSet): void {
    this.m0 = a.m0 | b.m0;
    this.m1 = a.m1 | b.m1;
    this.m2 = a.m2 | b.m2;
    this.cache = null;
  }

  /** this |= (a & b) */
  orAndAnd(a: SudokuSet, b: SudokuSet): void {
    this.m0 |= a.m0 & b.m0;
    this.m1 |= a.m1 & b.m1;
    this.m2 |= a.m2 & b.m2;
    this.cache = null;
  }

  size(): number {
    return this.values().length;
  }

  /** The element at position `index` in ascending order. */
  get(index: number): number {
    return this.values()[index];
  }

  /** All elements in ascending order. The returned array must not be modified. */
  values(): readonly number[] {
    if (this.cache === null) {
      const out: number[] = [];
      collect(this.m0, 0, out);
      collect(this.m1, 32, out);
      collect(this.m2, 64, out);
      this.cache = out;
    }
    return this.cache;
  }

  [Symbol.iterator](): Iterator<number> {
    return this.values()[Symbol.iterator]();
  }

  toString(): string {
    return this.isEmpty() ? 'empty!' : this.values().join(' ');
  }
}

function collect(word: number, base: number, out: number[]): void {
  let w = word;
  while (w !== 0) {
    const low = w & -w;
    out.push(base + 31 - Math.clz32(low));
    w ^= low;
  }
}

import { describe, expect, it } from 'vitest';
import { SudokuSet } from '../src/sudokuSet.js';

describe('SudokuSet', () => {
  it('stores elements across all three words and iterates ascending', () => {
    const s = SudokuSet.fromValues([80, 0, 31, 32, 63, 64, 5]);
    expect([...s]).toEqual([0, 5, 31, 32, 63, 64, 80]);
    expect(s.size()).toBe(7);
    expect(s.contains(31)).toBe(true);
    expect(s.contains(30)).toBe(false);
    expect(s.get(3)).toBe(32);
  });

  it('add/remove update the cached values', () => {
    const s = new SudokuSet();
    expect(s.isEmpty()).toBe(true);
    s.add(10);
    expect(s.size()).toBe(1);
    s.add(70);
    expect([...s]).toEqual([10, 70]);
    s.remove(10);
    expect([...s]).toEqual([70]);
    s.clear();
    expect(s.isEmpty()).toBe(true);
    expect(s.toString()).toBe('empty!');
  });

  it('setAll and not() cover exactly cells 0..80', () => {
    const all = new SudokuSet(true);
    expect(all.size()).toBe(81);
    const none = all.clone();
    none.not();
    expect(none.isEmpty()).toBe(true);
    const odd = SudokuSet.fromValues([1, 3, 79]);
    odd.not();
    expect(odd.size()).toBe(78);
    expect(odd.contains(80)).toBe(true);
    expect(odd.contains(81)).toBe(false);
  });

  it('set algebra', () => {
    const a = SudokuSet.fromValues([1, 2, 3, 40, 70]);
    const b = SudokuSet.fromValues([3, 4, 40, 80]);
    expect(a.intersects(b)).toBe(true);
    expect(a.andEmpty(SudokuSet.fromValues([5, 6]))).toBe(true);
    const u = new SudokuSet();
    u.setOr(a, b);
    expect([...u]).toEqual([1, 2, 3, 4, 40, 70, 80]);
    const i = new SudokuSet();
    i.setAnd(a, b);
    expect([...i]).toEqual([3, 40]);
    expect(u.containsSet(i)).toBe(true);
    expect(i.containsSet(u)).toBe(false);
    const d = a.clone();
    d.andNot(b);
    expect([...d]).toEqual([1, 2, 70]);
    expect(d.equals(SudokuSet.fromValues([70, 2, 1]))).toBe(true);
  });
});

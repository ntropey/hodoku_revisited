import { describe, expect, it } from 'vitest';
import { Sudoku2 } from '../src/sudoku2.js';
import { ALL_UNITS, BLOCKS, BUDDIES, CONSTRAINTS, getBlock } from '../src/tables.js';

const PUZZLE = '97....4..2..4718.3........5....5..8.5.1.4.2.9.4..8....8........3.9762..8..5....67';

describe('tables', () => {
  it('has 27 units of 9 distinct cells, each cell in exactly 3 units', () => {
    expect(ALL_UNITS).toHaveLength(27);
    const count = new Array<number>(81).fill(0);
    for (const u of ALL_UNITS) {
      expect(new Set(u).size).toBe(9);
      for (const c of u) count[c]++;
    }
    expect(count.every((n) => n === 3)).toBe(true);
  });

  it('matches the layout of the original (block 4, buddies, constraints)', () => {
    expect(BLOCKS[4]).toEqual([30, 31, 32, 39, 40, 41, 48, 49, 50]);
    expect(getBlock(80)).toBe(8);
    expect(CONSTRAINTS[40]).toEqual([4, 13, 22]);
    expect(BUDDIES[0].size()).toBe(20);
    expect(BUDDIES[0].contains(0)).toBe(false);
    expect(BUDDIES[0].contains(80)).toBe(false);
    expect(BUDDIES[0].contains(20)).toBe(true);
  });
});

describe('Sudoku2', () => {
  it('starts empty with all candidates', () => {
    const s = new Sudoku2();
    expect(s.unsolvedCellsAnz).toBe(81);
    expect(s.getAnzCandidates(0)).toBe(9);
    expect(s.free[0][5]).toBe(9);
  });

  it('loads a puzzle and removes candidates seen by the givens', () => {
    const s = new Sudoku2();
    s.setSudoku(PUZZLE);
    expect(s.getValuesString()).toBe(PUZZLE);
    expect(s.unsolvedCellsAnz).toBe(81 - [...PUZZLE].filter((c) => c !== '.').length);
    expect(s.isFixed(0)).toBe(true);
    // brute force: a digit is a candidate of an empty cell iff no buddy holds it
    for (let i = 0; i < 81; i++) {
      for (let d = 1; d <= 9; d++) {
        const expected = PUZZLE[i] === '.' && ![...BUDDIES[i]].some((b) => PUZZLE[b] === String(d));
        expect(s.isCandidate(i, d), `cell ${i} digit ${d}`).toBe(expected);
      }
    }
  });

  it('accepts a bordered 9-line grid and 0 as empty', () => {
    const grid = PUZZLE.replace(/\./g, '0').match(/.{9}/g)!.join('\n');
    const s = new Sudoku2();
    s.setSudoku(grid);
    expect(s.getValuesString()).toBe(PUZZLE);
  });

  it('rejects input that does not have 81 cells', () => {
    expect(() => new Sudoku2().setSudoku('123')).toThrow(/81/);
  });

  it('setCell / delete value restores consistent internal data', () => {
    const s = new Sudoku2();
    s.setSudoku(PUZZLE);
    const reference = s.clone();
    // 4 is a valid value for cell 2? find any empty cell and a candidate for it
    const idx = [...PUZZLE].findIndex((c) => c === '.');
    const cand = s.getAllCandidates(idx)[0];
    s.setCell(idx, cand);
    expect(s.getValue(idx)).toBe(cand);
    expect(s.getCell(idx)).toBe(0);
    s.setCell(idx, 0);
    expect(s.getValue(idx)).toBe(0);
    for (let i = 0; i < 81; i++) expect(s.getCell(i)).toBe(reference.getCell(i));
    for (let u = 0; u < 27; u++) expect([...s.free[u]]).toEqual([...reference.free[u]]);
    expect(s.unsolvedCellsAnz).toBe(reference.unsolvedCellsAnz);
  });

  it('deleting the last candidate of a cell reports an invalid puzzle', () => {
    const s = new Sudoku2();
    s.setSudoku(PUZZLE);
    const idx = [...PUZZLE].findIndex((c) => c === '.');
    const cands = [...s.getAllCandidates(idx)];
    let ok = true;
    for (const c of cands) ok = s.delCandidate(idx, c) && ok;
    expect(ok).toBe(false);
  });

  it('queues Naked Singles when a cell is reduced to one candidate', () => {
    const s = new Sudoku2();
    s.setSudoku(PUZZLE);
    const idx = [...PUZZLE].findIndex((c) => c === '.');
    const cands = [...s.getAllCandidates(idx)];
    s.nsQueue.clear();
    for (const c of cands.slice(1)) s.delCandidate(idx, c);
    const q = s.nsQueue.getFirstIndex();
    expect(q).not.toBe(-1);
    expect(s.nsQueue.getIndex(q)).toBe(idx);
    expect(s.nsQueue.getValue(q)).toBe(cands[0]);
  });
});

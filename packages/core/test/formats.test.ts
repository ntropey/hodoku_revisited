import { describe, expect, it } from 'vitest';
import { Sudoku2 } from '../src/sudoku2.js';

const PUZZLE = '97....4..2..4718.3........5....5..8.5.1.4.2.9.4..8....8........3.9762..8..5....67';
const LIB =
  ':0110:38:.1.57.4..7+521+4.6..........5.+2...1........+7.2..7562+839.2.+7......569214....4.7.....::319 329 338 378 388 398 819 829 837 838 848 878 888 898::';

function load(text: string): Sudoku2 {
  const s = new Sudoku2();
  s.setSudoku(text);
  return s;
}

describe('input formats', () => {
  it('reads 81 characters with 0 or . and a trailing comment', () => {
    expect(load(PUZZLE.replace(/\./g, '0')).getCluesString()).toBe(PUZZLE);
    expect(load(PUZZLE + ' # some comment 123').getCluesString()).toBe(PUZZLE);
  });

  it('reads a bordered 9-line grid with CRLF', () => {
    const rows = PUZZLE.match(/.{9}/g)!;
    const grid = ['+---+---+---+'];
    rows.forEach((r, i) => {
      grid.push('|' + r.slice(0, 3) + '|' + r.slice(3, 6) + '|' + r.slice(6) + '|');
      if (i % 3 === 2) grid.push('+---+---+---+');
    });
    expect(load(grid.join('\r\n')).getCluesString()).toBe(PUZZLE);
  });

  it('reads the library format with non-given cells and eliminated candidates', () => {
    const s = load(LIB);
    expect(s.values[10]).toBe(5);
    expect(s.fixed[10]).toBe(false); // marked with '+'
    expect(s.fixed[9]).toBe(true);
    const parts = LIB.split(':');
    expect(s.getSudoku('LIBRARY')).toBe(`:0000:x:${parts[3]}:${parts[4]}::`);
  });

  it('round-trips through the library format (initialState uses it)', () => {
    const s = load(PUZZLE);
    s.setCandidate(40, 5, false);
    s.setCell(1, 1, false);
    const lib = s.getSudoku('LIBRARY');
    const t = load(lib);
    expect(t.getSudoku('LIBRARY')).toBe(lib);
    expect(t.getValuesString()).toBe(s.getValuesString());
    expect(t.getCluesString()).toBe(s.getCluesString());
    for (let i = 0; i < 81; i++) expect(t.getCell(i)).toBe(s.getCell(i));
  });

  it('round-trips a PM grid, setting cells that have a single non-shared candidate', () => {
    const s = load(PUZZLE);
    const pm = s.getSudoku('PM_GRID');
    expect(pm.split('\n').filter((l) => l.startsWith('|'))).toHaveLength(9);
    const t = load(pm);
    for (let i = 0; i < 81; i++) {
      expect(t.getCell(i)).toBe(s.getCell(i));
      expect(t.values[i]).toBe(s.values[i]);
    }
    expect(t.getSudoku('PM_GRID')).toBe(pm);
  });

  it('reads gsf taxonomy lines', () => {
    const line = `99480,99408,114,1895,${PUZZLE},Easter,20.00s,0,C21.m/F1`;
    expect(load(line).getCluesString()).toBe(PUZZLE);
  });

  it('reads SimpleSudoku givens + PM grid', () => {
    const s = load(PUZZLE);
    const grid = (str: string) => str.match(/.{9}/g)!.join('\n');
    const text = grid(PUZZLE) + '\n\n' + s.getSudoku('PM_GRID');
    const t = load(text);
    expect(t.getCluesString()).toBe(PUZZLE);
    for (let i = 0; i < 81; i++) expect(t.getCell(i)).toBe(s.getCell(i));
  });

  it('rejects wrong cell counts', () => {
    expect(() => load('123')).toThrow(/81/);
    expect(() => load(PUZZLE + '1')).toThrow(/81/);
  });
});

describe('output formats', () => {
  it('writes clues and values', () => {
    const s = load(PUZZLE);
    s.setCell(2, 5, false);
    expect(s.getSudoku('CLUES_ONLY')).toBe(PUZZLE);
    expect(s.getSudoku('VALUES_ONLY')[2]).toBe('5');
    expect(s.getSudoku('CLUES_ONLY', true)).toBe(PUZZLE.replace(/\./g, '0'));
  });
});

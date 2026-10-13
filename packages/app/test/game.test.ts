import { describe, expect, it } from 'vitest';
import { erase, fillCands, isSolved, newGame, redo, remaining, setValue, toggleCand, undo, wrongCells } from '../src/game';
import { analyze, hint } from '../src/solverApi';

const PUZZLE = '97....4..2..4718.3........5....5..8.5.1.4.2.9.4..8....8........3.9762..8..5....67';
const info = () => analyze(PUZZLE);

describe('analyze', () => {
  it('finds the solution and a rating', () => {
    const i = info();
    expect(i.solution).toHaveLength(81);
    expect(i.solution.every((v) => v >= 1 && v <= 9)).toBe(true);
    expect(i.level).toBeGreaterThanOrEqual(1);
  });
  it('rejects puzzles without a unique solution', () => {
    expect(() => analyze('.'.repeat(81))).toThrow();
    expect(() => analyze('12')).toThrow();
  });
});

describe('game', () => {
  it('places digits, updates candidates, undoes and redoes', () => {
    const i = info();
    let g = newGame(i);
    const cell = g.values.indexOf(0);
    const d = i.solution[cell];
    g = setValue(g, cell, d);
    expect(g.values[cell]).toBe(d);
    expect(g.cands[cell]).toBe(0);
    expect(g.cands[cell === 0 ? 1 : 0] & (1 << d)).toBe(0);
    expect(remaining(g)[d]).toBe(remaining(newGame(i))[d] - 1);
    const placed = g;
    g = undo(g);
    expect(g.values[cell]).toBe(0);
    g = redo(g);
    expect(g.values).toEqual(placed.values);
  });

  it('cannot change givens, flags mistakes, and recalculates on erase', () => {
    const i = info();
    let g = newGame(i);
    expect(setValue(g, 0, 1)).toBe(g);
    const cell = g.values.indexOf(0);
    const wrong = (i.solution[cell] % 9) + 1;
    g = setValue(g, cell, wrong);
    expect(wrongCells(g)).toEqual([cell]);
    g = erase(g, cell);
    expect(g.values[cell]).toBe(0);
    expect(g.cands).toEqual(fillCands(g).cands);
  });

  it('toggles a pencil mark', () => {
    let g = newGame(info());
    const cell = g.values.indexOf(0);
    const d = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((x) => g.cands[cell] & (1 << x))!;
    g = toggleCand(g, cell, d);
    expect(g.cands[cell] & (1 << d)).toBe(0);
  });

  it('is solved when all values match the solution', () => {
    const i = info();
    let g = newGame(i);
    expect(isSolved(g)).toBe(false);
    g.values.forEach((v, c) => {
      if (v === 0) g = setValue(g, c, i.solution[c]);
    });
    expect(isSolved(g)).toBe(true);
  });
});

describe('hint', () => {
  it('suggests a step that is valid for the solution', () => {
    const g = newGame(info());
    const h = hint(g.values, g.cands)!;
    expect(h).not.toBeNull();
    for (const p of h.placements) expect(p.digit).toBe(g.solution[p.cell]);
    for (const e of h.eliminations) expect(e.digit).not.toBe(g.solution[e.cell]);
    expect(h.text.length).toBeGreaterThan(5);
  });
});

describe('puzzle bank', () => {
  it('isomorphs keep the puzzle valid and unique', async () => {
    const { isomorph } = await import('../src/bank/bank');
    const { seededRng } = await import('@hodoku/core');
    const rng = seededRng(7);
    for (let k = 0; k < 5; k++) {
      const iso = isomorph(PUZZLE, rng);
      expect(iso.replace(/\./g, '')).toHaveLength(PUZZLE.replace(/\./g, '').length);
      expect(analyze(iso).solution).toHaveLength(81);
    }
    expect(isomorph(PUZZLE, rng)).not.toBe(PUZZLE);
  });

  it('every bank puzzle has one solution and the level it is filed under', async () => {
    const data = (await import('../src/bank/bank.json')).default as Record<string, string[]>;
    const levels = Object.keys(data);
    expect(levels.sort()).toEqual(['1', '2', '3', '4', '5']);
    for (const l of levels) {
      expect(data[l].length).toBeGreaterThanOrEqual(100);
      // spot check: every 25th puzzle is re-rated
      for (let i = 0; i < data[l].length; i += 25) expect(analyze(data[l][i]).level).toBe(Number(l));
    }
  });
});

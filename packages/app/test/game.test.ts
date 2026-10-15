import { describe, expect, it } from 'vitest';
import { ALL_CANDS, autoFillLastDigit, candColorAt, cellColorAt, clearColors, clearNotes, deviations, fillHiddenSingles, hiddenSingles, isGiven, notesOf, paintCand, paintCell, restart, setGivens, toggleNote, erase, fillCands, removeCands, isSolved, newGame, redo, remaining, setValue, toggleCand, undo, wrongCells, type GameState } from '../src/game';
import { allHints, analyze, hint } from '../src/solverApi';

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

describe('colouring', () => {
  it('paints cells and candidates, keeps them across moves, undoes and clears', () => {
    const i = info();
    const g0 = newGame(i);
    const cell = g0.values.indexOf(0);
    let g = paintCell(g0, cell, 2);
    expect(cellColorAt(g, cell)).toBe(2);
    expect(g.past.length).toBe(1);
    expect(paintCell(g, cell, 2)).toBe(g); // no change, no snapshot
    g = setValue(g, cell, i.solution[cell]);
    expect(cellColorAt(g, cell)).toBe(2); // a move keeps the colour
    g = undo(g);
    expect(g.values[cell]).toBe(0);
    expect(cellColorAt(g, cell)).toBe(2);
    g = undo(g);
    expect(cellColorAt(g, cell)).toBe(0);
    let h = paintCand(g0, cell, 1, 3);
    expect(candColorAt(h, cell, 1)).toBe(3);
    expect(candColorAt(h, cell, 2)).toBe(0);
    h = clearColors(h);
    expect(candColorAt(h, cell, 1)).toBe(0);
    expect(h.cellColors).toBeUndefined();
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

  it('counts only placements that match the solution toward a digit being complete', () => {
    const i = info();
    const g = newGame(i);
    const cell = g.values.indexOf(0);
    const d = i.solution[cell];
    const before = remaining(g)[d];
    expect(remaining(setValue(g, cell, d))[d]).toBe(before - 1);
    const wrongDigit = (d % 9) + 1;
    const afterWrong = setValue(g, cell, wrongDigit);
    expect(wrongCells(afterWrong)).toEqual([cell]);
    expect(remaining(afterWrong)[d]).toBe(before);
  });

  it('uses info.board for the values and candidates when a training board is given', () => {
    const i = info();
    const values = i.solution.slice();
    const cands = new Array<number>(81).fill(0);
    const g = newGame({ ...i, board: { values, cands } });
    expect(g.values).toEqual(values);
    expect(g.cands).toEqual(cands);
    // the puzzle itself stays the givens; the solved cells are the player's own
    expect(g.givens).toBe(i.puzzle);
    expect(g.solution).toEqual(i.solution);
  });
});

describe('hint', () => {
  it('suggests a step that is valid for the solution', () => {
    const g = newGame(info());
    const h = hint(g.values, g.cands)!;
    expect(h).not.toBeNull();
    for (const p of h.marks.place) expect(p.digit).toBe(g.solution[p.cell]);
    for (const e of h.marks.elim) expect(e.digit).not.toBe(g.solution[e.cell]);
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

describe('hint level', () => {
  it('singles only never returns a harder technique', () => {
    const g = newGame(analyze('1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..'));
    for (let k = 0; k < 40; k++) {
      const h = hint(g.values, g.cands, 0);
      if (h === null) break;
      expect(['FULL_HOUSE', 'NAKED_SINGLE', 'HIDDEN_SINGLE']).toContain(h.type);
      break;
    }
  });
  it('a chain hint has notation', async () => {
    const data = (await import('../src/bank/bank.json')).default as Record<string, string[]>;
    for (const puzzle of data['4'].slice(0, 30)) {
      let g = newGame(analyze(puzzle));
      for (let k = 0; k < 150; k++) {
        const h = hint(g.values, g.cands, 5);
        if (h === null) break;
        if (h.marks.chains.length > 0) {
          expect(h.notation[0]).toMatch(/^\d+r\dc\d/);
          expect(h.marks.chains[0].length).toBeGreaterThan(1);
          return;
        }
        const before = g;
        if (h.marks.place.length > 0 && h.marks.elim.length === 0) g = h.marks.place.reduce((acc, p) => setValue(acc, p.cell, p.digit), g);
        else g = removeCands(g, h.marks.elim);
        if (g === before) break;
      }
    }
    throw new Error('no chain hint found');
  }, 120000);
});

describe('all steps', () => {
  it('lists steps of several techniques that never remove a solution digit', () => {
    const g = newGame(analyze(PUZZLE));
    const { results, total } = allHints(g.values, g.cands, 5, 5);
    expect(results.length).toBeGreaterThan(3);
    expect(Object.keys(total).length).toBeGreaterThan(1);
    for (const r of results) {
      for (const p of r.marks.place) expect(p.digit).toBe(g.solution[p.cell]);
      for (const e of r.marks.elim) expect(e.digit).not.toBe(g.solution[e.cell]);
    }
    // the first hint is one of them
    const first = hint(g.values, g.cands, 5)!;
    expect(results.some((r) => r.type === first.type)).toBe(true);
  });
  it('singles only returns no harder technique', () => {
    const g = newGame(analyze(PUZZLE));
    const { results } = allHints(g.values, g.cands, 0, 50);
    for (const r of results) expect(['FULL_HOUSE', 'NAKED_SINGLE', 'HIDDEN_SINGLE']).toContain(r.type);
  });
});

describe('auto-fill last digit', () => {
  const blank = (): GameState => ({
    givens: '.'.repeat(81),
    values: new Array<number>(81).fill(0),
    cands: new Array<number>(81).fill(ALL_CANDS),
    solution: new Array<number>(81).fill(0),
    level: 1,
    score: 0,
    past: [],
    future: [],
  });

  it('fills the last empty cell of a row, column or box, and cascades', () => {
    let g = blank();
    for (let c = 0; c < 8; c++) g = setValue(g, c, c + 1); // row 0: 1..8, cell 8 empty -> 9
    for (let c = 10; c < 18; c++) g = setValue(g, c, c - 9); // row 1: cells 10..17 = 1..8, cell 9 empty -> 9
    const out = autoFillLastDigit(g);
    expect(out.values[8]).toBe(9);
    expect(out.values[9]).toBe(9);
  });

  it('leaves a position alone when nothing is forced', () => {
    const g = blank();
    expect(autoFillLastDigit(g)).toBe(g);
  });

  it('does not fill when a unit has a duplicate, so more than one digit is missing', () => {
    let g = blank();
    for (let c = 0; c < 7; c++) g = setValue(g, c, c + 1); // 1..7 in cells 0..6
    g = setValue(g, 7, 1); // duplicate 1: cells 8,9 are both missing, nothing is forced
    expect(g.values[8]).toBe(0);
    const out = autoFillLastDigit(g);
    expect(out.values[8]).toBe(0);
  });

  it('is a normal, candidate-clearing, undoable move', () => {
    let g = blank();
    for (let c = 0; c < 8; c++) g = setValue(g, c, c + 1);
    const out = autoFillLastDigit(g);
    expect(out.values[8]).toBe(9);
    // placing 9 clears its own candidates and removes 9 from the candidates of peers (cell 26 is in column 8)
    expect(out.cands[8]).toBe(0);
    expect(out.cands[26] & (1 << 9)).toBe(0);
    expect(g.cands[26] & (1 << 9)).not.toBe(0);
    // undo goes back to the board before the automatic move
    expect(undo(out).values[8]).toBe(0);
  });
});

describe('pencil marks', () => {
  it('are kept apart from the solver candidates, undoable, and cleaned up when a value is placed', () => {
    const i = info();
    let g = newGame(i);
    const cell = g.values.indexOf(0);
    const candsBefore = g.cands.slice();
    g = toggleNote(g, cell, 4);
    g = toggleNote(g, cell, 7);
    expect(notesOf(g)[cell]).toBe((1 << 4) | (1 << 7));
    expect(g.cands).toEqual(candsBefore);
    g = toggleNote(g, cell, 4);
    expect(notesOf(g)[cell]).toBe(1 << 7);
    const peer = g.values.findIndex((v, k) => v === 0 && k !== cell && (k % 9 === cell % 9 || Math.floor(k / 9) === Math.floor(cell / 9)));
    g = toggleNote(g, peer, 3);
    g = setValue(g, cell, 3 === i.solution[cell] ? 3 : i.solution[cell]);
    expect(notesOf(g)[cell]).toBe(0);
    g = undo(g);
    expect(notesOf(g)[cell]).toBe(1 << 7);
    g = clearNotes(g);
    expect(notesOf(g).every((n) => n === 0)).toBe(true);
    g = undo(g);
    expect(notesOf(g)[cell]).toBe(1 << 7);
  });
  it('old saved games without notes still work', () => {
    const g = { ...newGame(info()) };
    delete g.notes;
    expect(notesOf(g)).toHaveLength(81);
    expect(toggleNote(g, g.values.indexOf(0), 2).notes).toBeDefined();
  });
});

/** An empty board with every candidate present in every cell. */
const emptyBoard = (): GameState => ({
  givens: '.'.repeat(81),
  values: new Array<number>(81).fill(0),
  cands: new Array<number>(81).fill(ALL_CANDS),
  solution: new Array<number>(81).fill(0),
  level: 1,
  score: 0,
  past: [],
  future: [],
});

describe('restart', () => {
  it('resets values, notes, colours and hints, and drops the undo history', () => {
    const i = info();
    const fresh = newGame(i);
    expect(restart(fresh)).toBe(fresh); // nothing to reset

    const cell = fresh.values.indexOf(0);
    let g = setValue(fresh, cell, i.solution[cell]);
    const noteCell = g.values.indexOf(0);
    g = toggleNote(g, noteCell, 5);
    g = paintCell(g, cell, 2);
    g = { ...g, hints: 3 };

    const r = restart(g);
    expect(r.givens).toBe(g.givens);
    expect(r.solution).toEqual(g.solution);
    expect(r.values).toEqual([...g.givens].map((c) => (c === '.' || c === '0' ? 0 : Number(c))));
    expect(r.values[cell]).toBe(0);
    expect(notesOf(r).every((n) => n === 0)).toBe(true);
    expect(r.cellColors).toBeUndefined();
    expect(r.candColors).toBeUndefined();
    expect(r.hints).toBe(0);
    expect(r.cands).toEqual(fillCands(r).cands);

    const back = restart(r);
    expect(back).toBe(r); // already at the start
    expect(r.past).toEqual([]);
    expect(r.future).toEqual([]);
  });
});

describe('set givens', () => {
  it('freezes every placed digit as a given, and is a no-op when nothing changes', () => {
    const i = info();
    let g = newGame(i);
    const cell = g.values.indexOf(0);
    g = setValue(g, cell, i.solution[cell]);
    const s = setGivens(g);
    expect(s.givens).toHaveLength(81);
    expect(s.givens).toBe(s.values.map((v) => (v === 0 ? '.' : String(v))).join(''));
    expect(s.givens[cell]).toBe(String(i.solution[cell]));
    expect(isGiven(s, cell)).toBe(true);
    const empty = s.values.indexOf(0);
    expect(s.givens[empty]).toBe('.');
    expect(setGivens(s)).toBe(s);
    expect(setGivens(newGame(i)).givens).toBe(i.puzzle);
  });
});

describe('hidden singles', () => {
  it('finds a hidden single and fills it in one undoable move', () => {
    const g0 = emptyBoard();
    const cands = g0.cands.slice();
    for (let c = 1; c < 9; c++) cands[c] &= ~(1 << 1); // digit 1 only in cell 0 of row 0
    const g: GameState = { ...g0, cands };

    expect(hiddenSingles(g.values, g.cands)).toEqual([{ cell: 0, digit: 1 }]);
    // a blocked cell is skipped
    const blocked = new Array<boolean>(81).fill(false);
    blocked[0] = true;
    expect(hiddenSingles(g.values, g.cands, blocked)).toEqual([]);

    const out = fillHiddenSingles(g);
    expect(out.values[0]).toBe(1);
    expect(out.cands[0]).toBe(0);
    expect(out.cands[9] & (1 << 1)).toBe(0); // a peer loses the digit
    expect(g.cands[9] & (1 << 1)).not.toBe(0);
    expect(out.past.length).toBe(1); // one step, not one per cell
    expect(undo(out).values[0]).toBe(0);
    expect(undo(out).cands).toEqual(g.cands);
  });

  it('returns the same game when there is no hidden single', () => {
    const g = emptyBoard();
    expect(hiddenSingles(g.values, g.cands)).toEqual([]);
    expect(fillHiddenSingles(g)).toBe(g);
  });
});

describe('deviations', () => {
  it('reports cells whose candidates differ from what the values allow', () => {
    const g = newGame(info());
    expect(deviations(g)).toEqual([]);
    const cell = g.values.indexOf(0);
    const d = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((x) => (g.cands[cell] & (1 << x)) !== 0)!;
    expect(deviations(removeCands(g, [{ cell, digit: d }]))).toEqual([cell]);
  });
});

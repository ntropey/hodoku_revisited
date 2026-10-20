import { describe, expect, it } from 'vitest';
import { Sudoku2, SOLUTION_TYPE_INFO, parseSudoku, seededRng, type SolutionType } from '@hodoku/core';
import { isSolved, newGame, removeCands, setValue } from '../src/game';
import { allHints, analyze, book, format, hint, path, prove, train } from '../src/solverApi';

// Rater and hint are deterministic, so the same board always yields the same first technique.
const PUZZLE = '97....4..2..4718.3........5....5..8.5.1.4.2.9.4..8....8........3.9762..8..5....67';
const game = newGame(analyze(PUZZLE));

describe('disabled techniques', () => {
  it('keeps the default hint when nothing is disabled', () => {
    const first = hint(game.values, game.cands, 5)!;
    expect(first).not.toBeNull();
    expect(hint(game.values, game.cands, 5, [])!.type).toBe(first.type);
  });

  it('lets a hint skip a technique it would otherwise return', () => {
    const first = hint(game.values, game.cands, 5)!;
    const type = first.type;
    // with the technique allowed it is the hint
    expect(hint(game.values, game.cands, 5, [])!.type).toBe(type);
    // with it disabled the hint is either gone or a different technique
    const without = hint(game.values, game.cands, 5, [type]);
    expect(without === null || without.type !== type).toBe(true);
  });

  it('drops a disabled technique from all steps, including its total', () => {
    const all = allHints(game.values, game.cands, 5);
    const type = all.results[0].type;
    const name = SOLUTION_TYPE_INFO[type as SolutionType].stepName;
    expect(all.results.some((r) => r.type === type)).toBe(true);
    expect(all.total[name]).toBeGreaterThan(0);

    const filtered = allHints(game.values, game.cands, 5, 12, [type]);
    expect(filtered.results.some((r) => r.type === type)).toBe(false);
    expect(filtered.total[name] ?? 0).toBeLessThan(all.total[name]);
    // the other techniques are still there
    expect(filtered.results.length).toBeGreaterThan(0);
  }, 30_000);

  it('does not change all steps when nothing is disabled', () => {
    const all = allHints(game.values, game.cands, 5);
    const same = allHints(game.values, game.cands, 5, 12, []);
    expect(same.results.map((r) => r.type)).toEqual(all.results.map((r) => r.type));
    expect(same.total).toEqual(all.total);
  }, 30_000);
});

describe('AI Coach walkthrough and contradiction prover', () => {
  it('attaches a 4-stage progressive coach walkthrough to hints without spoiling the conclusion on stage 1', () => {
    const steps = path(game.values, game.cands);
    expect(steps.length).toBeGreaterThan(0);
    for (const h of steps) {
      expect(h.coach).toBeDefined();
      expect(h.coach!.length).toBe(4);
      expect(h.coach!.map((c) => c.label)).toEqual(['Where to look', 'The pattern', 'The logic', 'Conclusion']);
      // Stage 1 ("Where to look") must not reveal the placement or elimination on the board
      expect(h.coach![0].marks.place).toEqual([]);
      expect(h.coach![0].marks.elim).toEqual([]);
      // Stage 4 ("Conclusion") reveals the full step marks
      expect(h.coach![3].marks).toEqual(h.marks);
    }
  });

  it('proves a direct peer conflict when the digit is already in the same row, column or box', () => {
    // cell 2 (r1c3) is empty, and cell 0 (r1c1) has given 9
    const p = prove(game.values, game.cands, 2, 9);
    expect(p.verdict).toBe('conflict');
    expect(p.stages).toHaveLength(1);
    expect(p.stages[0].label).toBe('Direct conflict');
    expect(p.stages[0].marks.elim).toEqual([{ cell: 2, digit: 9 }]);
  });

  it('traces forced moves to a contradiction when a wrong candidate is tested, and confirms the true solution digit', () => {
    // Find an empty cell that has at least 2 candidates
    const cell = game.values.findIndex((v, i) => v === 0 && (game.cands[i] & (game.cands[i] - 1)) !== 0);
    expect(cell).toBeGreaterThanOrEqual(0);
    const trueDigit = game.solution[cell];
    const wrongDigit = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => d !== trueDigit && (game.cands[cell] & (1 << d)) !== 0)!;

    const validProof = prove(game.values, game.cands, cell, trueDigit);
    expect(validProof.verdict).toBe('valid');
    expect(validProof.stages[0].marks.place).toEqual([{ cell, digit: trueDigit }]);

    const conflictProof = prove(game.values, game.cands, cell, wrongDigit);
    expect(conflictProof.verdict).toBe('conflict');
    expect(conflictProof.stages.length).toBeGreaterThanOrEqual(2);
    expect(conflictProof.stages[0].label).toBe('Assume');
    expect(conflictProof.stages[conflictProof.stages.length - 1].label).toBe('Contradiction');
    // Every drawn chain segment must connect two cells that share a house (row, column, or box)
    for (const chain of conflictProof.stages[conflictProof.stages.length - 1].marks.chains) {
      for (let i = 0; i + 1 < chain.length; i++) {
        const a = chain[i].cell;
        const b = chain[i + 1].cell;
        const sameHouse =
          Math.floor(a / 9) === Math.floor(b / 9) ||
          a % 9 === b % 9 ||
          (Math.floor(a / 27) === Math.floor(b / 27) && Math.floor((a % 9) / 3) === Math.floor((b % 9) / 3));
        expect(sameHouse).toBe(true);
      }
    }
  });
});

describe('solution path', () => {
  it('walks from the board to the solution one step at a time', () => {
    const steps = path(game.values, game.cands);
    expect(steps.length).toBeGreaterThan(0);
    let g = game;
    for (const h of steps) {
      for (const p of h.marks.place) g = setValue(g, p.cell, p.digit);
      if (h.marks.elim.length > 0) g = removeCands(g, h.marks.elim);
    }
    expect(isSolved(g)).toBe(true);
  });

  it('is empty on a solved board', () => {
    expect(path(game.solution, game.cands)).toEqual([]);
  });
});

describe('format', () => {
  it('writes a formatted grid with the givens', () => {
    const out = format(game.values, game.cands, 'CLUES_ONLY_FORMATTED');
    expect(out.length).toBeGreaterThan(81);
    for (const ch of PUZZLE) {
      if (ch !== '.') expect(out).toContain(ch);
    }
  });

  it('round-trips the values through the PM grid', () => {
    const s = new Sudoku2();
    parseSudoku(s, format(game.values, game.cands, 'PM_GRID'), false);
    expect(Array.from(s.values)).toEqual(game.values);
  });
});

describe('train', () => {
  // the level-1 bank only contains puzzles that use Full House, Naked Single and Hidden Single,
  // so Hidden Single is the technique a level-1 training puzzle can actually be found for
  const TECHNIQUE = 'HIDDEN_SINGLE';

  it('finds a bank puzzle whose solve path uses the technique, and null without one', () => {
    const info = train(1, [TECHNIQUE], false, [], seededRng(1), 400);
    expect(info).not.toBeNull();
    expect(info!.path?.some((p) => p.type === TECHNIQUE)).toBe(true);
    expect(info!.board).toBeUndefined();
    expect(train(1, [], false, [])).toBeNull();
  });

  it('auto-solves the board up to the first step that uses the technique', () => {
    const info = train(1, [TECHNIQUE], true, [], seededRng(1), 400);
    expect(info).not.toBeNull();
    const board = info!.board!;
    expect(board.values).toHaveLength(81);
    expect(board.cands).toHaveLength(81);
    // the board stops right where the trained technique is needed, so it is not solved yet
    expect(board.values.some((v) => v === 0)).toBe(true);
    const step = hint(board.values, board.cands, 5);
    expect(step?.type).toBe(TECHNIQUE);
  });
});

describe('book', () => {
  it('returns the requested puzzles in section order', () => {
    const sections = [{ level: 1, count: 3, mode: 'playing' as const, cands: false }];
    const puzzles = book(sections, [], seededRng(1));
    expect(puzzles).toHaveLength(3);
    for (const p of puzzles) {
      expect(p.givens).toHaveLength(81);
      expect(p.values).toHaveLength(81);
      expect(p.cands).toHaveLength(81);
      expect(p.showCands).toBe(false);
    }
  });

  it('prints the candidates when a section asks for them', () => {
    const sections = [{ level: 1, count: 1, mode: 'practising' as const, cands: true }];
    const [p] = book(sections, [], seededRng(2));
    expect(p.showCands).toBe(true);
    // a real puzzle has empty cells, and those cells still allow candidates
    expect(p.values.some((v) => v === 0)).toBe(true);
    expect(p.cands.some((c) => c !== 0)).toBe(true);
  });

  it('is empty when there are no sections', () => {
    expect(book([], [], seededRng(3))).toEqual([]);
  });

  it('solves a Learning puzzle up to its technique', () => {
    const sections = [{ level: 1, count: 2, mode: 'learning' as const, cands: true }];
    const puzzles = book(sections, ['HIDDEN_SINGLE'], seededRng(4));
    expect(puzzles).toHaveLength(2);
    for (const p of puzzles) {
      expect(p.givens).toHaveLength(81);
      // the board is solved further than the givens, but the technique is still needed somewhere
      const givens = [...p.givens].map((c) => (c === '.' || c === '0' ? 0 : Number(c)));
      expect(p.values).not.toEqual(givens);
      expect(p.values.some((v) => v === 0)).toBe(true);
    }
  });
});

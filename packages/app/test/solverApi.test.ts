import { describe, expect, it } from 'vitest';
import { Sudoku2, SOLUTION_TYPE_INFO, parseSudoku, seededRng, type SolutionType } from '@hodoku/core';
import { isSolved, newGame, removeCands, setValue } from '../src/game';
import { allHints, analyze, format, hint, path, train } from '../src/solverApi';

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
  });

  it('does not change all steps when nothing is disabled', () => {
    const all = allHints(game.values, game.cands, 5);
    const same = allHints(game.values, game.cands, 5, 12, []);
    expect(same.results.map((r) => r.type)).toEqual(all.results.map((r) => r.type));
    expect(same.total).toEqual(all.total);
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

  it('auto-solves the board as far as it goes without the technique', () => {
    const info = train(1, [TECHNIQUE], true, [], seededRng(1), 400);
    expect(info).not.toBeNull();
    const board = info!.board!;
    expect(board.values).toHaveLength(81);
    expect(board.cands).toHaveLength(81);
    // the full solver stops at one of the trained techniques (or the board is already solved)
    const step = hint(board.values, board.cands, 5);
    expect(step === null || step.type === TECHNIQUE).toBe(true);
    // with the technique switched off no step is left: the board is stuck without it
    expect(hint(board.values, board.cands, 5, [TECHNIQUE])).toBeNull();
  });
});

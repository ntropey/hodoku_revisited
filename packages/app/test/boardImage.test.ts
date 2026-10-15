import { describe, expect, it } from 'vitest';
import { boardSvg, type BoardImageOptions } from '../src/boardImage';
import { newGame } from '../src/game';
import { analyze } from '../src/solverApi';
import { PALETTE } from '../src/ui';

const PUZZLE = '97....4..2..4718.3........5....5..8.5.1.4.2.9.4..8....8........3.9762..8..5....67';
const game = newGame(analyze(PUZZLE));

const base = (over: Partial<BoardImageOptions> = {}): BoardImageOptions => ({
  showCands: false,
  colorKu: false,
  colorKuColors: undefined,
  givens: game.givens,
  ...over,
});

const count = (svg: string, needle: string): number => svg.split(needle).length - 1;

describe('boardSvg', () => {
  it('writes a standalone SVG with one glyph per placed value', () => {
    const svg = boardSvg(game.values, game.cands, base());
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    const placed = game.values.filter((v) => v !== 0).length;
    expect(placed).toBeGreaterThan(0);
    expect(count(svg, '<text')).toBe(placed);
  });

  it('draws a candidate digit only when showCands is on', () => {
    const placed = game.values.filter((v) => v !== 0).length;
    const candidates = game.cands.reduce((n, mask, i) => (game.values[i] === 0 ? n + [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => (mask & (1 << d)) !== 0).length : n), 0);
    expect(candidates).toBeGreaterThan(0);

    const off = boardSvg(game.values, game.cands, base({ showCands: false }));
    expect(count(off, '<text')).toBe(placed);

    const on = boardSvg(game.values, game.cands, base({ showCands: true }));
    expect(count(on, '<text')).toBe(placed + candidates);
    expect(on.length).toBeGreaterThan(off.length);
  });

  it('paints a cell and a candidate with their palette colour', () => {
    const cell = game.values.indexOf(0);
    const digit = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => (game.cands[cell] & (1 << d)) !== 0)!;
    const cellColors = new Array<number>(81).fill(0);
    cellColors[cell] = 1;
    const candColors = new Array<number>(81 * 9).fill(0);
    candColors[cell * 9 + (digit - 1)] = 2;

    const svg = boardSvg(game.values, game.cands, base({ showCands: true, cellColors, candColors, palette: PALETTE }));
    expect(svg).toContain(`fill="${PALETTE[0]}"`);
    expect(svg).toContain(`fill="${PALETTE[1]}"`);
  });

  it('draws a coloured ball instead of a digit in ColorKu', () => {
    const digit = game.values.find((v) => v !== 0)!;
    const colors = ['#000001', '#000002', '#000003', '#000004', '#000005', '#000006', '#000007', '#000008', '#000009'];
    const svg = boardSvg(game.values, game.cands, base({ colorKu: true, colorKuColors: colors }));
    const placed = game.values.filter((v) => v !== 0).length;
    expect(svg).toContain('<circle');
    expect(svg).toContain(`fill="${colors[digit - 1]}"`);
    // one ball per placed value, each with its digit in white
    expect(count(svg, '<circle')).toBe(placed);
    expect(count(svg, '<text')).toBe(placed);
  });
});

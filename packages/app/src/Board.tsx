import type { CSSProperties } from 'react';
import { isGiven, notesOf, type GameState } from './game';
import type { HintResult } from './protocol';
import { PEERS } from './solverApi';
import { colorKuColor } from './ui';

interface Props {
  game: GameState;
  selected: number | null;
  showCands: boolean;
  hint: HintResult | null;
  wrong: Set<number>;
  /** cells whose candidate marks differ from what the placed values allow (Show deviations) */
  deviate?: ReadonlySet<number>;
  /** digit whose candidates are tinted (Filter mode), 0 = off */
  filter?: number;
  /** draw digits and candidates as colored balls (ColorKu) */
  colorKu?: boolean;
  /** ColorKu color per digit 1-9 */
  colors?: readonly string[];
  /** the player's own cell colors (palette index per cell, 0 = none) */
  cellColors?: readonly number[];
  /** the player's own candidate colors (palette index per `cell * 9 + digit - 1`) */
  candColors?: readonly number[];
  /** the palette the color indices refer to */
  palette?: readonly string[];
  /** while coloring: what a click paints; null = normal play */
  paintTarget?: 'cell' | 'cand' | null;
  onPaintCell?: (i: number) => void;
  onPaintCand?: (i: number, d: number) => void;
  onSelect: (i: number) => void;
}

const key = (cell: number, digit: number) => cell * 10 + digit;

/** center of a candidate inside the 9x9 unit square of the overlay */
function candPos(cell: number, digit: number): [number, number] {
  return [(cell % 9) + (1 + 2 * ((digit - 1) % 3)) / 6, Math.floor(cell / 9) + (1 + 2 * Math.floor((digit - 1) / 3)) / 6];
}

function candidateLabel(mask: number): string {
  const list = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => (mask & (1 << d)) !== 0);
  return list.length ? `, candidates ${list.join(' ')}` : ', empty';
}

export function Board({ game, selected, showCands, hint, wrong, deviate, filter = 0, colorKu = false, colors, cellColors, candColors, palette, paintTarget = null, onPaintCell, onPaintCand, onSelect }: Props) {
  const notes = notesOf(game);
  const selValue = selected !== null ? game.values[selected] : 0;
  const peers = selected !== null ? new Set(PEERS[selected]) : new Set<number>();
  const m = hint?.marks;
  const keySet = new Set(m?.key.map((x) => key(x.cell, x.digit)));
  const finSet = new Set(m?.fins.map((x) => key(x.cell, x.digit)));
  const elimSet = new Set(m?.elim.map((x) => key(x.cell, x.digit)));
  const placeMap = new Map(m?.place.map((p) => [p.cell, p.digit]));
  const colorMap = new Map(m?.colors.map((c) => [key(c.cell, c.digit), c.color]));
  const tinted = new Map<number, 'a' | 'b'>();
  m?.tint.forEach((t) => t.cells.forEach((c) => tinted.set(c, t.tone)));
  // cells that show candidates even if "show candidates" is off, so the hint can be followed
  const involved = new Set<number>();
  m?.key.forEach((x) => involved.add(x.cell));
  m?.fins.forEach((x) => involved.add(x.cell));
  m?.elim.forEach((x) => involved.add(x.cell));
  m?.colors.forEach((x) => involved.add(x.cell));
  placeMap.forEach((_, c) => involved.add(c));

  return (
    <div className="boardWrap">
      <div className={`board${colorKu ? ' ku' : ''}`} role="grid" aria-label="Sudoku board">
        {Array.from({ length: 9 }, (_, r) => (
          <div key={r} role="row">
            {game.values.slice(r * 9, r * 9 + 9).map((v, c) => {
              const i = r * 9 + c;
              const cls = ['cell'];
              if (i === selected) cls.push('selected');
              else if (peers.has(i)) cls.push('peer');
              if (selValue !== 0 && v === selValue) cls.push('same');
              if (filter !== 0 && (v === filter || (v === 0 && (game.cands[i] & (1 << filter)) !== 0))) cls.push('filtered');
              if (isGiven(game, i)) cls.push('given');
              if (wrong.has(i)) cls.push('wrong');
              if (deviate?.has(i)) cls.push('deviate');
              if (tinted.has(i)) cls.push(`tint-${tinted.get(i)}`);
              if (placeMap.has(i)) cls.push('hint-place');
              const ucIdx = cellColors?.[i] ?? 0;
              const uc = ucIdx > 0 ? palette?.[ucIdx - 1] : undefined;
              if (uc) cls.push('tint-uc');
              if (i % 9 === 2 || i % 9 === 5) cls.push('rb');
              if (Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5) cls.push('bb');
              // what a cell shows: the hint's cells and "show candidates" use the solver's candidates; while filtering only the
              // filtered digit; otherwise the player's own pencil marks
              const full = showCands || involved.has(i);
              const mask = full ? game.cands[i] : filter !== 0 ? game.cands[i] & (1 << filter) : notes[i];
              const showHere = mask !== 0 || full;
              return (
                <button
                  key={i}
                  className={cls.join(' ')}
                  role="gridcell"
                  aria-label={`row ${Math.floor(i / 9) + 1} column ${(i % 9) + 1}${v ? `, ${isGiven(game, i) ? 'given ' : ''}${v}` : showHere ? candidateLabel(mask) : ', empty'}`}
                  style={uc ? ({ '--uc': uc } as CSSProperties) : undefined}
                  onClick={() => (paintTarget === 'cell' ? onPaintCell?.(i) : onSelect(i))}
                >
                  {v !== 0 ? (
                    colorKu ? (
                      <>
                        <span className="ku" style={{ background: colorKuColor(colors, v) }} aria-hidden="true" />
                        <span className="kuval">{v}</span>
                      </>
                    ) : (
                      v
                    )
                  ) : showHere ? (
                    <span className="cands">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
                        const on = (mask & (1 << d)) !== 0;
                        const k = key(i, d);
                        const c: string[] = [];
                        if (elimSet.has(k)) c.push('del');
                        else if (finSet.has(k)) c.push('fin');
                        else if (placeMap.get(i) === d) c.push('keep');
                        else if (keySet.has(k) || colorMap.has(k)) c.push('keyc');
                        if (colorMap.has(k)) c.push(`col-${colorMap.get(k)! % 2}`);
                        if (filter === d) c.push('fd');
                        const ccIdx = candColors?.[i * 9 + (d - 1)] ?? 0;
                        const cc = ccIdx > 0 ? palette?.[ccIdx - 1] : undefined;
                        if (cc) c.push('painted');
                        return (
                          <span
                            key={d}
                            className={c.join(' ')}
                            style={cc ? { background: cc } : undefined}
                            onClick={paintTarget === 'cand' ? (e) => { e.stopPropagation(); onPaintCand?.(i, d); } : undefined}
                          >
                            {on ? colorKu ? <span className="kudot" style={{ background: colorKuColor(colors, d) }} aria-hidden="true" /> : d : ''}
                          </span>
                        );
                      })}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {m && m.chains.length > 0 && (
        <svg className="overlay" viewBox="0 0 9 9" aria-hidden="true">
          {m.chains.map((chain, ci) =>
            chain.slice(0, -1).map((node, i) => {
              const [x1, y1] = candPos(node.cell, node.digit);
              const [x2, y2] = candPos(chain[i + 1].cell, chain[i + 1].digit);
              return (
                <line
                  key={`${ci}-${i}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  className={chain[i + 1].strong ? 'strong' : 'weak'}
                />
              );
            }),
          )}
        </svg>
      )}
    </div>
  );
}

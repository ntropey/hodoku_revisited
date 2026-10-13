import type { HintResult } from './protocol';
import { isGiven, type GameState } from './game';
import { PEERS } from './solverApi';

interface Props {
  game: GameState;
  selected: number | null;
  showCands: boolean;
  hint: HintResult | null;
  wrong: Set<number>;
  onSelect: (i: number) => void;
}

export function Board({ game, selected, showCands, hint, wrong, onSelect }: Props) {
  const selValue = selected !== null ? game.values[selected] : 0;
  const peers = selected !== null ? new Set(PEERS[selected]) : new Set<number>();
  const hintCells = new Set(hint?.cells ?? []);
  const elim = new Map<number, number>();
  hint?.eliminations.forEach((e) => elim.set(e.cell, (elim.get(e.cell) ?? 0) | (1 << e.digit)));
  const place = new Map(hint?.placements.map((p) => [p.cell, p.digit]));

  return (
    <div className="board" role="grid" aria-label="Sudoku board">
      {game.values.map((v, i) => {
        const cls = ['cell'];
        if (i === selected) cls.push('selected');
        else if (peers.has(i)) cls.push('peer');
        if (selValue !== 0 && v === selValue) cls.push('same');
        if (isGiven(game, i)) cls.push('given');
        if (wrong.has(i)) cls.push('wrong');
        if (hintCells.has(i)) cls.push('hint');
        if (place.has(i)) cls.push('hint-place');
        if (i % 9 === 2 || i % 9 === 5) cls.push('rb');
        if (Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5) cls.push('bb');
        return (
          <button
            key={i}
            className={cls.join(' ')}
            role="gridcell"
            aria-label={`row ${Math.floor(i / 9) + 1} column ${(i % 9) + 1}${v ? `, ${v}` : ''}`}
            onClick={() => onSelect(i)}
          >
            {v !== 0 ? (
              v
            ) : showCands || place.has(i) ? (
              <span className="cands">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
                  const on = (game.cands[i] & (1 << d)) !== 0;
                  const del = ((elim.get(i) ?? 0) & (1 << d)) !== 0;
                  const keep = place.get(i) === d;
                  return (
                    <span key={d} className={del ? 'del' : keep ? 'keep' : ''}>
                      {on && (showCands || keep) ? d : ''}
                    </span>
                  );
                })}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

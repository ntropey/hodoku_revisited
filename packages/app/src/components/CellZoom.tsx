import { isGiven, notesOf, type GameState } from '../game';
import { cellName } from '../protocol';
import { colorKuColor } from '../ui';

interface Props {
  game: GameState;
  selected: number | null;
  showCands: boolean;
  colorKu: boolean;
  colors: readonly string[];
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** An enlarged view of the selected cell: its value, or its candidates in a 3 by 3 grid. */
export function CellZoom({ game, selected, showCands, colorKu, colors }: Props) {
  if (selected === null) {
    return (
      <div className="zoom" aria-label="Selected cell">
        <div className="zoomcell placeholder" aria-hidden="true" />
        <div className="zoomtext">
          <strong>No cell selected</strong>
          <span className="dim">Tap a cell to see it here, larger.</span>
        </div>
      </div>
    );
  }
  const v = game.values[selected];
  const given = isGiven(game, selected);
  const mask = v !== 0 ? 0 : (showCands ? game.cands[selected] : notesOf(game)[selected]) ?? 0;
  const list = DIGITS.filter((d) => (mask & (1 << d)) !== 0);
  const label =
    v !== 0 ? (given ? 'given' : 'your value') : showCands ? (list.length ? `candidates ${list.join(' ')}` : 'no candidates') : list.length ? `notes ${list.join(' ')}` : 'no notes';
  return (
    <div className="zoom" aria-label={`Enlarged ${cellName(selected)}: ${v !== 0 ? `value ${v}` : label}`}>
      <div className={`zoomcell${given ? ' given' : ''}`}>
        {v !== 0 ? (
          colorKu ? <span className="ku ku-big" style={{ background: colorKuColor(colors, v) }} aria-hidden="true" /> : <span className="zoomval">{v}</span>
        ) : (
          <span className="zoomcands">
            {DIGITS.map((d) => (
              <span key={d}>{(mask & (1 << d)) !== 0 ? d : ''}</span>
            ))}
          </span>
        )}
      </div>
      <div className="zoomtext">
        <strong>{cellName(selected)}</strong>
        <span className="dim">{label}</span>
      </div>
    </div>
  );
}

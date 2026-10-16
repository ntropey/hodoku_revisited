import { useRef } from 'react';
import type { Mode } from '../ui';
import { colorKuColor } from '../ui';

const MODES: [Mode, string][] = [
  ['value', 'Value'],
  ['notes', 'Notes'],
  ['filter', 'Filter'],
  ['color', 'Color'],
];

interface Props {
  mode: Mode;
  onMode: (m: Mode) => void;
  left: number[];
  filterDigit: number;
  disabled: boolean;
  canErase: boolean;
  /** draw the keys as colored balls (ColorKu) */
  colorKu?: boolean;
  /** ColorKu color per digit 1-9 */
  colors?: readonly string[];
  /** the palette for cell/candidate coloring */
  palette: readonly string[];
  /** the active color while coloring (0 = erase) */
  paintColor: number;
  /** what a click paints while coloring */
  paintTarget: 'cell' | 'cand';
  onPaintColor: (c: number) => void;
  onPaintTarget: (t: 'cell' | 'cand') => void;
  onClearColors: () => void;
  onDigit: (d: number) => void;
  /** long press: filter this digit */
  onFilter: (d: number) => void;
  onErase: () => void;
}

export function DigitPad({ mode, onMode, left, filterDigit, disabled, canErase, colorKu = false, colors, palette, paintColor, paintTarget, onPaintColor, onPaintTarget, onClearColors, onDigit, onFilter, onErase }: Props) {
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const down = (d: number) => {
    longPressed.current = false;
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      onFilter(d);
    }, 500);
  };
  const up = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const coloring = mode === 'color';
  return (
    <div className="padwrap">
      <div className="padbar">
        <div className="segmented" role="group" aria-label="Input mode">
          {MODES.map(([m, label]) => (
            <button key={m} className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => onMode(m)}>
              {label}
            </button>
          ))}
        </div>
        {coloring ? (
          <button onClick={onClearColors}>Clear colors</button>
        ) : (
          <button onClick={onErase} disabled={!canErase}>
            Erase
          </button>
        )}
      </div>
      {coloring ? (
        <div className="colorpad">
          <div className="swatches" role="group" aria-label="Color">
            <button className={`swatch none${paintColor === 0 ? ' on' : ''}`} aria-pressed={paintColor === 0} aria-label="No color" onClick={() => onPaintColor(0)}>
              ×
            </button>
            {palette.map((c, i) => (
              <button
                key={c}
                className={`swatch${paintColor === i + 1 ? ' on' : ''}`}
                style={{ background: c }}
                aria-pressed={paintColor === i + 1}
                aria-label={`Color ${i + 1}`}
                onClick={() => onPaintColor(i + 1)}
              />
            ))}
          </div>
          <div className="segmented" role="group" aria-label="What to color">
            <button className={paintTarget === 'cell' ? 'on' : ''} aria-pressed={paintTarget === 'cell'} onClick={() => onPaintTarget('cell')}>
              Cells
            </button>
            <button className={paintTarget === 'cand' ? 'on' : ''} aria-pressed={paintTarget === 'cand'} onClick={() => onPaintTarget('cand')}>
              Candidates
            </button>
          </div>
        </div>
      ) : (
        <div className="pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
            const done = left[d] === 0;
            return (
              <button
                key={d}
                className={`key${filterDigit === d ? ' filtering' : ''}${done ? ' complete' : ''}`}
                // complete digits still work in Filter mode
                disabled={disabled || (done && mode !== 'filter')}
                aria-label={`digit ${d}${filterDigit === d ? ', filtering' : ''}`}
                aria-pressed={filterDigit === d}
                onPointerDown={() => down(d)}
                onPointerUp={up}
                onPointerLeave={up}
                onClick={() => {
                  if (longPressed.current) return;
                  onDigit(d);
                }}
                onContextMenu={(e) => e.preventDefault()}
              >
                <span className="d">{colorKu ? <span className="kudot keydot" style={{ background: colorKuColor(colors, d) }} aria-hidden="true" /> : d}</span>
                <small>{done ? '✓' : left[d]}</small>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useRef } from 'react';
import type { Mode } from '../ui';
import { colorKuColor } from '../ui';

interface Props {
  mode: Mode;
  onMode: (m: Mode) => void;
  left: number[];
  filterDigit: number;
  disabled: boolean;
  canErase: boolean;
  /** draw the keys as coloured balls (ColorKu) */
  colorKu?: boolean;
  /** ColorKu colour per digit 1-9 */
  colors?: readonly string[];
  onDigit: (d: number) => void;
  /** long press: filter this digit */
  onFilter: (d: number) => void;
  onErase: () => void;
}

export function DigitPad({ mode, onMode, left, filterDigit, disabled, canErase, colorKu = false, colors, onDigit, onFilter, onErase }: Props) {
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
  return (
    <div className="padwrap">
      <div className="padbar">
        <div className="segmented" role="group" aria-label="Input mode">
          {(['value', 'notes', 'filter'] as const).map((m) => (
            <button key={m} className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => onMode(m)}>
              {m === 'value' ? 'Value' : m === 'notes' ? 'Notes' : 'Filter'}
            </button>
          ))}
        </div>
        <button onClick={onErase} disabled={!canErase}>
          Erase
        </button>
      </div>
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
    </div>
  );
}

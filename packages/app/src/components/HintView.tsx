import { cellName } from '@hodoku/core';
import type { HintResult } from '../protocol';

interface Props {
  hint: HintResult | null;
  message: string | null;
  busy: string | null;
  solved: boolean;
  disabled: boolean;
  onHint: () => void;
  onApply: () => void;
  onDismiss: () => void;
}

const cells = (list: { cell: number }[]) => [...new Set(list.map((x) => cellName(x.cell)))].join(', ');

/** The roles of a step, written out (colour is never the only signal). */
function Roles({ hint }: { hint: HintResult }) {
  const m = hint.marks;
  const rows: { cls: string; label: string; where: string; digit: string }[] = [];
  const digits = (list: { digit: number }[]) => [...new Set(list.map((x) => x.digit))].sort().join('');
  if (m.place.length) rows.push({ cls: 'keep', label: 'Place', where: cells(m.place), digit: digits(m.place) });
  if (m.key.length) rows.push({ cls: 'keyc', label: 'Key', where: cells(m.key), digit: digits(m.key) });
  if (m.colors.length && !m.key.length) rows.push({ cls: 'keyc', label: 'Colours', where: cells(m.colors), digit: digits(m.colors) });
  if (m.fins.length) rows.push({ cls: 'fin', label: 'Fin', where: cells(m.fins), digit: digits(m.fins) });
  if (m.elim.length) rows.push({ cls: 'del', label: 'Eliminate', where: cells(m.elim), digit: digits(m.elim) });
  return (
    <ul className="roles">
      {rows.map((r) => (
        <li key={r.label}>
          <span className={`chip ${r.cls}`}>{r.digit.length > 3 ? '·' : r.digit}</span>
          {r.label} · {r.where}
        </li>
      ))}
    </ul>
  );
}

export function HintView({ hint, message, busy, solved, disabled, onHint, onApply, onDismiss }: Props) {
  if (solved) {
    return (
      <div className="hintview" aria-live="polite">
        <h3>Solved</h3>
        <p>Every cell matches the solution. Start a new puzzle from the top bar.</p>
      </div>
    );
  }
  if (!hint) {
    return (
      <div className="hintview" aria-live="polite">
        <h3>Stuck?</h3>
        <p>Get the next logical step. It is highlighted on the board, and Apply carries it out.</p>
        <button className="primary" onClick={onHint} disabled={disabled || !!busy}>
          Get a hint
        </button>
        {(busy || message) && <p className="note">{busy ?? message}</p>}
      </div>
    );
  }
  return (
    <div className="hintview" aria-live="polite">
      <div className="kicker">Hint</div>
      <h3>{hint.name}</h3>
      <p className="what">{hint.text.slice(hint.name.length + 2)}</p>
      {hint.summary && <p className="why">{hint.summary}</p>}
      {hint.notation.map((n, i) => (
        <code key={i} className="notation">
          {n}
        </code>
      ))}
      {hint.slug && (
        <a className="guide" href={`../techniques/${hint.slug}.html`} target="_blank" rel="noreferrer">
          Read the guide for {hint.name} →
        </a>
      )}
      <Roles hint={hint} />
      <div className="row">
        <button className="primary" onClick={onApply}>
          Apply step
        </button>
        <button onClick={onDismiss}>Dismiss</button>
        <button onClick={onHint} disabled={disabled || !!busy}>
          Next hint
        </button>
      </div>
    </div>
  );
}

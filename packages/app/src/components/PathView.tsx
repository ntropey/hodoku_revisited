import { useState } from 'react';
import { HINT_LEVEL_NAMES, type HintLevel, type HintResult } from '../protocol';

interface Props {
  steps: HintResult[] | null;
  /** how many of the steps have already been applied to the board */
  done: number;
  busy: string | null;
  disabled: boolean;
  onNext: () => void;
  onSolveUpTo: (level: HintLevel) => void;
  onRefresh: () => void;
}

/** "Naked Pair: remove 3, 7 from r1c2" -> "remove 3, 7 from r1c2" */
function action(h: HintResult): string {
  const prefix = `${h.name}: `;
  return h.text.startsWith(prefix) ? h.text.slice(prefix.length) : h.text;
}

/** The solver's own path from the current board, one row per step, with Next step / Solve up to. */
export function PathView({ steps, done, busy, disabled, onNext, onSolveUpTo, onRefresh }: Props) {
  const [level, setLevel] = useState<HintLevel>(3);
  if (disabled) return <div className="hintview"><p className="note">Start a puzzle to see its solution path.</p></div>;
  if (steps === null) {
    return (
      <div className="hintview">
        <p className="note">{busy ?? 'No solution path yet.'}</p>
        {!busy && <button onClick={onRefresh}>Find the path</button>}
      </div>
    );
  }
  const remaining = Math.max(0, steps.length - done);
  const done0 = remaining === 0;
  return (
    <div className="pathview">
      <div className="allhead">
        <span>{done0 ? 'No steps left' : `${remaining} step${remaining === 1 ? '' : 's'} to the solution`}</span>
        <span className="count">{done} done</span>
      </div>
      <ol className="pathlist">
        {steps.map((s, i) => (
          <li key={i} className={i < done ? 'done' : i === done ? 'next' : ''}>
            <span className="n">{i + 1}</span>
            <span className="tech">{s.name}</span>
            <span className="what">{action(s)}</span>
          </li>
        ))}
      </ol>
      {done0 && <p className="note">The solver has no further step here; the puzzle may be one it gives up on.</p>}
      <div className="row sticky">
        <button className="primary" onClick={onNext} disabled={done0 || !!busy}>
          Next step
        </button>
        <span className="spacer" />
        <select value={level} onChange={(e) => setLevel(Number(e.target.value) as HintLevel)} aria-label="Difficulty for solve up to">
          {HINT_LEVEL_NAMES.map((n, i) => (
            <option key={n} value={i}>
              {i === 0 ? 'Singles only' : n}
            </option>
          ))}
        </select>
        <button onClick={() => onSolveUpTo(level)} disabled={done0 || !!busy}>
          Solve up to
        </button>
      </div>
      <p className="note">The solver's own path from here, not yours. Every step that is applied counts as a hint.</p>
    </div>
  );
}

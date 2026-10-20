import { cellName } from '@hodoku/core';
import { isGiven, type GameState } from '../game';
import type { HintResult, ProofResult } from '../protocol';

interface Props {
  game: GameState | null;
  selected: number | null;
  hint: HintResult | null;
  coachStep: number | null;
  onCoachStep: (step: number | null) => void;
  proof: ProofResult | null;
  proofStep: number;
  onProofStep: (step: number) => void;
  onDismissProof: () => void;
  onProve: (cell: number, digit: number) => void;
  message: string | null;
  busy: string | null;
  solved: boolean;
  disabled: boolean;
  onHint: (startInCoach?: boolean) => void;
  onApply: () => void;
  onDismiss: () => void;
}

const cells = (list: { cell: number }[]) => [...new Set(list.map((x) => cellName(x.cell)))].join(', ');

/** The roles of a step, written out (color is never the only signal). */
function Roles({ hint }: { hint: HintResult }) {
  const m = hint.marks;
  const rows: { cls: string; label: string; where: string; digit: string }[] = [];
  const digits = (list: { digit: number }[]) => [...new Set(list.map((x) => x.digit))].sort().join('');
  if (m.place.length) rows.push({ cls: 'keep', label: 'Place', where: cells(m.place), digit: digits(m.place) });
  if (m.key.length) rows.push({ cls: 'keyc', label: 'Key', where: cells(m.key), digit: digits(m.key) });
  if (m.colors.length && !m.key.length) rows.push({ cls: 'keyc', label: 'Colors', where: cells(m.colors), digit: digits(m.colors) });
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

/** "Why not?" contradiction prover bar for the currently selected cell. */
function WhyNotBar({
  game,
  selected,
  proof,
  busy,
  onProve,
}: {
  game: GameState | null;
  selected: number | null;
  proof: ProofResult | null;
  busy: string | null;
  onProve: (cell: number, digit: number) => void;
}) {
  if (!game) return null;
  if (selected === null) {
    return (
      <div className="coach-whynot">
        <div className="kicker">AI Coach · Why not?</div>
        <p className="note">Select any cell on the board to ask why a candidate does or does not work there.</p>
      </div>
    );
  }
  const cname = cellName(selected);
  const val = game.values[selected];
  if (val !== 0) {
    if (isGiven(game, selected)) return null;
    return (
      <div className="coach-whynot">
        <div className="kicker">AI Coach · Check {cname}</div>
        <div className="coach-pills">
          <button
            type="button"
            className={`chipbtn${proof?.cell === selected && proof?.digit === val ? ' on' : ''}`}
            disabled={!!busy}
            onClick={() => onProve(selected, val)}
          >
            Test {val} in {cname}
          </button>
        </div>
      </div>
    );
  }
  const mask = game.cands[selected];
  const cands = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => (mask & (1 << d)) !== 0);
  if (cands.length === 0) return null;
  return (
    <div className="coach-whynot">
      <div className="kicker">AI Coach · Ask about {cname}</div>
      <p className="note">Why can&apos;t a candidate go in {cname}? Click one to trace what happens:</p>
      <div className="coach-pills">
        {cands.map((d) => (
          <button
            key={d}
            type="button"
            className={`chipbtn${proof?.cell === selected && proof?.digit === d ? ' on' : ''}`}
            disabled={!!busy}
            onClick={() => onProve(selected, d)}
          >
            Why not {d}?
          </button>
        ))}
      </div>
    </div>
  );
}

export function HintView({
  game,
  selected,
  hint,
  coachStep,
  onCoachStep,
  proof,
  proofStep,
  onProofStep,
  onDismissProof,
  onProve,
  message,
  busy,
  solved,
  disabled,
  onHint,
  onApply,
  onDismiss,
}: Props) {
  if (solved) {
    return (
      <div className="hintview" aria-live="polite">
        <h3>Solved</h3>
        <p>Every cell matches the solution. Start a new puzzle from the top bar.</p>
      </div>
    );
  }

  if (proof) {
    const idx = Math.min(Math.max(0, proofStep), proof.stages.length - 1);
    const stage = proof.stages[idx];
    return (
      <div className="hintview" aria-live="polite">
        <div className="kicker">AI Coach · {proof.verdict === 'conflict' ? 'Contradiction proof' : 'Cell check'}</div>
        <h3>{proof.headline}</h3>
        {proof.stages.length > 1 && (
          <div className="coach-pills" role="group" aria-label="Proof stages">
            {proof.stages.map((s, i) => (
              <button
                key={`${s.label}-${i}`}
                type="button"
                className={`chipbtn${idx === i ? ' on' : ''}`}
                onClick={() => onProofStep(i)}
              >
                {i + 1}. {s.label}
              </button>
            ))}
          </div>
        )}
        {stage && (
          <div className="coach-box">
            <div className="coach-stage">{stage.label}</div>
            <p>{stage.text}</p>
          </div>
        )}
        <div className="row">
          {proof.stages.length > 1 && (
            <>
              <button type="button" onClick={() => onProofStep(idx - 1)} disabled={idx <= 0}>
                ← Previous
              </button>
              <button type="button" className="primary" onClick={() => onProofStep(idx + 1)} disabled={idx >= proof.stages.length - 1}>
                Next step →
              </button>
            </>
          )}
          <button type="button" onClick={onDismissProof}>
            Dismiss
          </button>
        </div>
        <WhyNotBar game={game} selected={selected} proof={proof} busy={busy} onProve={onProve} />
      </div>
    );
  }

  if (!hint) {
    return (
      <div className="hintview" aria-live="polite">
        <h3>Stuck?</h3>
        <p>Get the next logical step right away, or let the AI Coach nudge you toward it one stage at a time.</p>
        <div className="row">
          <button className="primary" onClick={() => onHint(false)} disabled={disabled || !!busy}>
            Get a hint
          </button>
          <button onClick={() => onHint(true)} disabled={disabled || !!busy}>
            Coach me
          </button>
        </div>
        {(busy || message) && <p className="note">{busy ?? message}</p>}
        <WhyNotBar game={game} selected={selected} proof={proof} busy={busy} onProve={onProve} />
      </div>
    );
  }

  const stages = hint.coach ?? [];
  const inCoach = coachStep !== null && stages[coachStep] !== undefined;
  const isNudgeOnly = inCoach && coachStep < stages.length - 1;
  const hideTechniqueName = inCoach && coachStep === 0;

  return (
    <div className="hintview" aria-live="polite">
      <div className="kicker">{inCoach ? `AI Coach · Nudge ${coachStep + 1} of ${stages.length}` : 'Hint'}</div>
      <h3>{hideTechniqueName ? 'Where to look first' : hint.name}</h3>

      {stages.length > 0 && (
        <div className="coach-walk" role="group" aria-label="AI Coach walkthrough">
          <div className="coach-pills">
            {stages.map((s, i) => (
              <button
                key={s.label}
                type="button"
                className={`chipbtn${coachStep === i ? ' on' : ''}`}
                onClick={() => onCoachStep(i)}
              >
                {i + 1}. {s.label}
              </button>
            ))}
            {inCoach && (
              <button type="button" className="chipbtn" onClick={() => onCoachStep(null)}>
                Full hint
              </button>
            )}
          </div>
          {inCoach && (
            <div className="coach-box">
              <div className="coach-stage">{stages[coachStep].label}</div>
              <p>{stages[coachStep].text}</p>
              <div className="row">
                <button type="button" onClick={() => onCoachStep(coachStep - 1)} disabled={coachStep <= 0}>
                  ← Previous
                </button>
                {coachStep < stages.length - 1 ? (
                  <button type="button" className="primary" onClick={() => onCoachStep(coachStep + 1)}>
                    Next nudge →
                  </button>
                ) : (
                  <button type="button" className="primary" onClick={onApply}>
                    Apply step
                  </button>
                )}
                <button type="button" onClick={onDismiss}>
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!isNudgeOnly && (
        <>
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
          {!inCoach && (
            <div className="row">
              <button className="primary" onClick={onApply}>
                Apply step
              </button>
              <button onClick={onDismiss}>Dismiss</button>
              <button onClick={() => onHint(false)} disabled={disabled || !!busy}>
                Next hint
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

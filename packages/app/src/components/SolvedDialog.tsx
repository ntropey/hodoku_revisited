import { LEVEL_NAMES } from '../protocol';
import { formatTime } from '../ui';

interface Props {
  seconds: number;
  level: number;
  score: number;
  hints: number;
  busy: boolean;
  onNew: (level: number) => void;
  onClose: () => void;
}

export function SolvedDialog({ seconds, level, score, hints, busy, onNew, onClose }: Props) {
  const harder = level < 5 ? level + 1 : null;
  return (
    <div className="modal" role="dialog" aria-label="Puzzle solved" aria-modal="true" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="modal-card solved">
        <p className="eyebrow">Solved</p>
        <h2>Well done.</h2>
        <dl className="stats">
          <div>
            <dt>Time</dt>
            <dd>{formatTime(seconds)}</dd>
          </div>
          <div>
            <dt>Level</dt>
            <dd>
              {LEVEL_NAMES[level]} · {score}
            </dd>
          </div>
          <div>
            <dt>Hints used</dt>
            <dd>{hints}</dd>
          </div>
        </dl>
        <div className="row">
          <button onClick={onClose} autoFocus>
            Close
          </button>
          <span className="spacer" />
          {harder && (
            <button onClick={() => onNew(harder)} disabled={busy}>
              Try {LEVEL_NAMES[harder]}
            </button>
          )}
          <button className="primary" onClick={() => onNew(level)} disabled={busy}>
            Another {LEVEL_NAMES[level]}
          </button>
        </div>
      </div>
    </div>
  );
}

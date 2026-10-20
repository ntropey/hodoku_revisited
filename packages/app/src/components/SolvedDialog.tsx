import { useState } from 'react';
import { LEVEL_NAMES } from '../protocol';
import { formatTime } from '../ui';

interface Props {
  givens: string;
  daily?: string;
  seconds: number;
  level: number;
  score: number;
  hints: number;
  busy: boolean;
  onNew: (level: number) => void;
  onClose: () => void;
}

export function SolvedDialog({ givens, daily, seconds, level, score, hints, busy, onNew, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const harder = level < 5 ? level + 1 : null;

  const shareResult = () => {
    const u = new URL(window.location.href);
    u.search = daily ? `daily=${daily}&level=${level}` : `p=${givens}`;
    const title = daily ? `Hodoku Revisited · Daily ${daily}` : `Hodoku Revisited · ${LEVEL_NAMES[level]}`;
    const text = `${title}\n${LEVEL_NAMES[level]} (${score}) · ⏱ ${formatTime(seconds)} · 💡 ${hints} hint${hints === 1 ? '' : 's'}\n${u.toString()}`;
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="modal" role="dialog" aria-label="Puzzle solved" aria-modal="true" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="modal-card solved">
        <p className="eyebrow">{daily ? `Daily ${daily} · Solved` : 'Solved'}</p>
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
          <button type="button" onClick={shareResult}>
            {copied ? 'Result copied!' : 'Share result'}
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

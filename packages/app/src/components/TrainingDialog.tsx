/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * The training dialog: pick the game mode and the techniques to drill (the original's Mode menu).
 */
import { LEVEL_NAMES } from '../protocol';
import { TECHNIQUE_GROUPS } from '../techniqueGroups';
import type { GameMode, Settings } from '../ui';

interface Props {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}

const MODES: [GameMode, string][] = [
  ['playing', 'Playing'],
  ['learning', 'Learning'],
  ['practising', 'Practicing'],
];

const BLURBS: Record<GameMode, string> = {
  playing: 'The normal mode. A new puzzle is a fresh puzzle, and nothing is solved for you.',
  learning: 'A new puzzle always needs one of the techniques you tick below, and it is solved up to the point where that technique applies.',
  practising: 'A new puzzle always needs one of the techniques you tick below, and it is shown in its starting state.',
};

export function TrainingDialog({ settings, onChange, onClose }: Props) {
  const chosen = new Set(settings.trainingTechniques);
  const toggle = (type: string, on: boolean) => {
    const next = new Set(chosen);
    if (on) next.add(type);
    else next.delete(type);
    onChange({ ...settings, trainingTechniques: [...next] });
  };
  const needsTechnique = chosen.size === 0;
  return (
    <div className="modal" role="dialog" aria-label="Training" aria-modal="true">
      <div className="modal-card">
        <h2>Training</h2>
        <div className="segmented" role="group" aria-label="Game mode">
          {MODES.map(([m, label]) => {
            const disabled = m !== 'playing' && needsTechnique;
            return (
              <button
                key={m}
                className={settings.gameMode === m ? 'on' : ''}
                aria-pressed={settings.gameMode === m}
                disabled={disabled}
                onClick={() => onChange({ ...settings, gameMode: m })}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="note">{BLURBS[settings.gameMode]}</p>
        <details className="about techniques" open>
          <summary>Techniques to train</summary>
          <p className={needsTechnique ? 'error' : undefined}>Tick the techniques you want to drill. Learning and Practicing need at least one.</p>
          <div className="techscroll">
            {TECHNIQUE_GROUPS.map(([level, list]) => (
              <div key={level}>
                <h3>{LEVEL_NAMES[level]}</h3>
                {list.map((t) => (
                  <label key={t.type} className="field">
                    <input type="checkbox" checked={chosen.has(t.type)} onChange={(e) => toggle(t.type, e.target.checked)} />
                    {t.name}
                  </label>
                ))}
              </div>
            ))}
          </div>
          <button onClick={() => onChange({ ...settings, trainingTechniques: [] })}>Clear all techniques</button>
        </details>
        <div className="row">
          <span className="spacer" />
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

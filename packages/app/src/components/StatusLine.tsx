import type { GameState } from '../game';
import type { Mode, Settings } from '../ui';

interface Props {
  game: GameState | null;
  selected: number | null;
  busy: string | null;
  message: string | null;
  mode: Mode;
  paintTarget: 'cell' | 'cand';
  settings: Settings;
  /** readable names of the techniques Training drills, for the training modes */
  trainingNames: string;
}

/** The line under the pad: the selected cell and its candidates (or what the app is doing) and the active options. */
export function StatusLine({ game, selected, busy, message, mode, paintTarget, settings, trainingNames }: Props) {
  const cands =
    selected !== null && game && game.values[selected] === 0 ? [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => (game.cands[selected] & (1 << d)) !== 0) : [];
  const left =
    busy ??
    (selected !== null
      ? `r${Math.floor(selected / 9) + 1}c${(selected % 9) + 1}${cands.length ? ` · candidates ${cands.join(' ')}` : ''}`
      : (message ?? 'Select a cell'));
  return (
    <div className="statusline" aria-live="polite">
      <span>{left}</span>
      <span className="dim">
        Mark mistakes {settings.checkMistakes ? 'on' : 'off'} · show candidates {settings.showCands ? 'on' : 'off'}
        {mode === 'notes' ? ' · notes mode' : ''}
        {mode === 'color' ? ` · color mode (${paintTarget === 'cell' ? 'cells' : 'candidates'})` : ''}
        {settings.gameMode !== 'playing' ? ` · ${settings.gameMode} mode${trainingNames ? ` · training: ${trainingNames}` : ''}` : ''} · autosaved
      </span>
    </div>
  );
}

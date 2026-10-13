import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Board } from './Board';
import {
  erase,
  fillCands,
  isGiven,
  isSolved,
  newGame,
  redo,
  remaining,
  removeCands,
  setValue,
  toggleCand,
  undo,
  wrongCells,
  type GameState,
} from './game';
import { LEVEL_NAMES, type HintResult } from './protocol';
import { SolverClient } from './solverClient';

const SAVE_KEY = 'hodoku-revisited:game';
const SETTINGS_KEY = 'hodoku-revisited:settings';

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or full: the game just isn't remembered */
  }
}

interface Settings {
  showCands: boolean;
  checkMistakes: boolean;
  level: number;
}

export function App() {
  const [game, setGame] = useState<GameState | null>(() => load<GameState>(SAVE_KEY));
  const [settings, setSettings] = useState<Settings>(
    () => load<Settings>(SETTINGS_KEY) ?? { showCands: false, checkMistakes: false, level: 1 },
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [hint, setHint] = useState<HintResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const solver = useRef(new SolverClient());

  useEffect(() => {
    if (game) save(SAVE_KEY, game);
  }, [game]);
  useEffect(() => save(SETTINGS_KEY, settings), [settings]);

  const update = useCallback((fn: (g: GameState) => GameState) => {
    setGame((g) => (g ? fn(g) : g));
    setHint(null);
    setMessage(null);
  }, []);

  const startNew = useCallback(
    async (level: number) => {
      solver.current.cancel();
      setBusy(`Creating a ${LEVEL_NAMES[level]} puzzle...`);
      setMessage(null);
      try {
        const info = await solver.current.generate(level);
        setGame(newGame(info));
        setSelected(null);
        setHint(null);
      } catch (e) {
        if ((e as Error).message !== 'cancelled') setMessage((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  useEffect(() => {
    if (!game) void startNew(settings.level);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const input = useCallback(
    (d: number) => {
      if (!game || selected === null) return;
      if (noteMode && game.values[selected] === 0) update((g) => toggleCand(g, selected, d));
      else update((g) => setValue(g, selected, d));
    },
    [game, selected, noteMode, update],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (importing || e.ctrlKey || e.metaKey) return;
      if (e.key >= '1' && e.key <= '9') input(Number(e.key));
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        if (selected !== null) update((g) => erase(g, selected));
      } else if (e.key === 'n') setNoteMode((n) => !n);
      else if (e.key === 'z') update(undo);
      else if (e.key === 'y') update(redo);
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const s = selected ?? 40;
        const r = Math.floor(s / 9) + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0);
        const c = (s % 9) + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0);
        setSelected(Math.min(8, Math.max(0, r)) * 9 + Math.min(8, Math.max(0, c)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [input, selected, update, importing]);

  const wrong = useMemo(
    () => new Set(game && settings.checkMistakes ? wrongCells(game) : []),
    [game, settings.checkMistakes],
  );
  const left = useMemo(() => (game ? remaining(game) : []), [game]);
  const solved = game ? isSolved(game) : false;

  const askHint = async () => {
    if (!game) return;
    setBusy('Looking for a hint...');
    try {
      const h = await solver.current.hint(game.values, game.cands);
      setHint(h);
      setMessage(h ? null : 'No logical hint found.');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const applyHint = () => {
    if (!hint) return;
    update((g) => {
      let next = g;
      for (const p of hint.placements) next = setValue(next, p.cell, p.digit);
      if (hint.eliminations.length > 0) next = removeCands(next, hint.eliminations);
      return next;
    });
  };

  const doImport = async () => {
    setBusy('Checking puzzle...');
    try {
      const info = await solver.current.analyze(importText);
      setGame(newGame(info));
      setSelected(null);
      setImporting(false);
      setImportText('');
      setMessage(null);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const copyPuzzle = async () => {
    if (!game) return;
    try {
      await navigator.clipboard.writeText(game.givens);
      setMessage('Puzzle copied.');
    } catch {
      setMessage(game.givens);
    }
  };

  return (
    <main className="app">
      <header>
        <h1>Hodoku Revisited</h1>
        {game && (
          <span className="badge">
            {LEVEL_NAMES[game.level]} · {game.score}
          </span>
        )}
      </header>

      {game && (
        <Board
          game={game}
          selected={selected}
          showCands={settings.showCands}
          hint={hint}
          wrong={wrong}
          onSelect={setSelected}
        />
      )}

      <div className="status" aria-live="polite">
        {busy ?? (solved ? '🎉 Solved!' : (hint?.text ?? message ?? ''))}
      </div>

      <div className="pad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <button key={d} onClick={() => input(d)} disabled={!game || left[d] === 0} aria-label={`digit ${d}`}>
            {d}
            <small>{left[d] ?? ''}</small>
          </button>
        ))}
      </div>

      <div className="tools">
        <button onClick={() => update(undo)} disabled={!game?.past.length}>
          Undo
        </button>
        <button onClick={() => update(redo)} disabled={!game?.future.length}>
          Redo
        </button>
        <button
          onClick={() => selected !== null && update((g) => erase(g, selected))}
          disabled={selected === null || !game || isGiven(game, selected)}
        >
          Erase
        </button>
        <button className={noteMode ? 'on' : ''} onClick={() => setNoteMode(!noteMode)} aria-pressed={noteMode}>
          Notes
        </button>
        <button onClick={askHint} disabled={!game || solved || !!busy}>
          Hint
        </button>
        <button onClick={applyHint} disabled={!hint}>
          Apply
        </button>
        <button onClick={() => update(fillCands)} disabled={!game}>
          Reset notes
        </button>
      </div>

      <div className="tools">
        <label>
          <input
            type="checkbox"
            checked={settings.showCands}
            onChange={(e) => setSettings({ ...settings, showCands: e.target.checked })}
          />
          Show candidates
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.checkMistakes}
            onChange={(e) => setSettings({ ...settings, checkMistakes: e.target.checked })}
          />
          Mark mistakes
        </label>
      </div>

      <div className="tools">
        <select
          value={settings.level}
          onChange={(e) => setSettings({ ...settings, level: Number(e.target.value) })}
          aria-label="Difficulty"
        >
          {[1, 2, 3, 4].map((l) => (
            <option key={l} value={l}>
              {LEVEL_NAMES[l]}
            </option>
          ))}
        </select>
        <button className="primary" onClick={() => startNew(settings.level)} disabled={!!busy}>
          New puzzle
        </button>
        {busy && (
          <button onClick={() => (solver.current.cancel(), setBusy(null))}>Cancel</button>
        )}
        <button onClick={() => setImporting(true)}>Import</button>
        <button onClick={copyPuzzle} disabled={!game}>
          Copy
        </button>
      </div>

      {importing && (
        <div className="dialog" role="dialog" aria-label="Import puzzle">
          <p>Paste a puzzle: 81 characters, a grid, a PM grid, or a HoDoKu library line.</p>
          <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={6} />
          <div className="tools">
            <button className="primary" onClick={doImport} disabled={!importText.trim() || !!busy}>
              Load
            </button>
            <button onClick={() => (setImporting(false), setMessage(null))}>Close</button>
          </div>
          {message && <p className="error">{message}</p>}
        </div>
      )}

      <footer>
        Based on <a href="https://hodoku.sourceforge.net/">HoDoKu</a> by Bernhard Hobiger. Free software (GPL-3.0-or-later),{' '}
        <a href="https://github.com/ntropey/hodoku_revisited">source</a>. Not affiliated with the original author.
      </footer>
    </main>
  );
}

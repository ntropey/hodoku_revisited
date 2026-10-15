import { useState } from 'react';
import { LEVEL_NAMES } from '../protocol';
import { formatTime } from '../ui';
import type { HistoryEntry, LibraryEntry, SavePoint } from '../store';

type Section = 'library' | 'history' | 'saves';

interface Props {
  library: LibraryEntry[];
  history: HistoryEntry[];
  saves: SavePoint[];
  /** the current game, needed to enable saving */
  hasGame: boolean;
  /** a name offered for a new library entry or save point, e.g. "Easy 612" */
  suggestedName: string;
  onSaveCurrent: (name: string) => void;
  onOpen: (puzzle: string) => void;
  onDeleteLibrary: (id: string) => void;
  onDeleteHistory: (id: string) => void;
  onClearHistory: () => void;
  onCreateSave: (name: string) => void;
  onRestoreSave: (id: string) => void;
  onDeleteSave: (id: string) => void;
  onClose: () => void;
}

const SECTIONS: [Section, string][] = [
  ['library', 'Library'],
  ['history', 'History'],
  ['saves', 'Saves'],
];

/** The saved puzzles, the puzzles played, and the named save points of the current game. */
export function PuzzlesDialog(p: Props) {
  const [section, setSection] = useState<Section>('library');
  const [libraryName, setLibraryName] = useState(p.suggestedName);
  const [saveName, setSaveName] = useState(p.suggestedName);
  const date = (at: number) => new Date(at).toLocaleDateString();

  return (
    <div className="modal" role="dialog" aria-label="Your puzzles" aria-modal="true">
      <div className="modal-card puzzles">
        <h2>Your puzzles</h2>
        <div className="tabs" role="tablist">
          {SECTIONS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={section === id} className={section === id ? 'on' : ''} onClick={() => setSection(id)}>
              {label}
            </button>
          ))}
        </div>

        {section === 'library' && (
          <>
            <div className="row">
              <input
                className="nameinput"
                value={libraryName}
                onChange={(e) => setLibraryName(e.target.value)}
                placeholder="Name"
                aria-label="Name for the saved puzzle"
              />
              <button className="primary" disabled={!p.hasGame || !libraryName.trim()} onClick={() => p.onSaveCurrent(libraryName.trim())}>
                Save current
              </button>
            </div>
            {p.library.length === 0 ? (
              <p className="note">No saved puzzles yet.</p>
            ) : (
              <ul className="puzzlelist">
                {p.library.map((e) => (
                  <li key={e.id}>
                    <span className="puzzleinfo">
                      <strong>{e.name}</strong>
                      <small className="dim">{date(e.at)}</small>
                    </span>
                    <button onClick={() => p.onOpen(e.puzzle)} aria-label={`Open ${e.name}`}>
                      Open
                    </button>
                    <button onClick={() => p.onDeleteLibrary(e.id)} aria-label={`Delete ${e.name}`}>
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {section === 'history' && (
          <>
            <div className="row">
              <span className="spacer" />
              <button disabled={p.history.length === 0} onClick={p.onClearHistory}>
                Clear history
              </button>
            </div>
            {p.history.length === 0 ? (
              <p className="note">No puzzles played yet.</p>
            ) : (
              <ul className="puzzlelist">
                {p.history.map((h) => (
                  <li key={h.id}>
                    <span className="puzzleinfo">
                      <strong>
                        {LEVEL_NAMES[h.level]}
                        {h.solved ? ' ✓' : ''}
                      </strong>
                      <small className="dim">
                        {h.score} · {formatTime(h.seconds)} · {date(h.at)}
                      </small>
                    </span>
                    <button onClick={() => p.onOpen(h.puzzle)} aria-label={`Open the ${LEVEL_NAMES[h.level]} puzzle`}>
                      Open
                    </button>
                    <button onClick={() => p.onDeleteHistory(h.id)} aria-label="Delete history entry">
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {section === 'saves' && (
          <>
            <div className="row">
              <input
                className="nameinput"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Name"
                aria-label="Name for the save point"
              />
              <button className="primary" disabled={!p.hasGame || !saveName.trim()} onClick={() => p.onCreateSave(saveName.trim())}>
                Save current position
              </button>
            </div>
            {p.saves.length === 0 ? (
              <p className="note">No save points yet.</p>
            ) : (
              <ul className="puzzlelist">
                {p.saves.map((s) => (
                  <li key={s.id}>
                    <span className="puzzleinfo">
                      <strong>{s.name}</strong>
                      <small className="dim">{date(s.at)}</small>
                    </span>
                    <button onClick={() => p.onRestoreSave(s.id)} aria-label={`Restore ${s.name}`}>
                      Restore
                    </button>
                    <button onClick={() => p.onDeleteSave(s.id)} aria-label={`Delete ${s.name}`}>
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <div className="row">
          <span className="spacer" />
          <button className="primary" onClick={p.onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

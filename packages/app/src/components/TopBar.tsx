import { useEffect, useRef, useState } from 'react';
import { LEVEL_NAMES } from '../protocol';
import { formatTime, type CopyWhat, type GameMode } from '../ui';

interface Props {
  badge: { level: number; score: number } | null;
  filled: number;
  seconds: number;
  busy: boolean;
  canUndo: boolean;
  canRedo: boolean;
  mode: GameMode;
  onMode: (mode: GameMode) => void;
  onTraining: () => void;
  onNew: (level: number) => void;
  onCancel: () => void;
  onImport: () => void;
  onPuzzles: () => void;
  onCopy: (what: CopyWhat) => void;
  onSave: (what: CopyWhat) => void;
  onPrint: () => void;
  onPrintSolution: () => void;
  onExtendedPrint: () => void;
  onExportPng: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onRestart: () => void;
  canRestart: boolean;
  onSettings: () => void;
  onCommands: () => void;
}

/** A small popup menu that closes on outside click and Escape. */
function Menu({ label, children, className }: { label: React.ReactNode; children: (close: () => void) => React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className={`menu ${className ?? ''}`} ref={ref}>
      <button aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && (
        <div className="menu-list" role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return <img src="icon.svg" alt="" width={size} height={size} className="logo" />;
}

/** The label of the current game mode, from the original's Mode menu. */
const MODE_LABELS: Record<GameMode, string> = {
  playing: 'Playing',
  learning: 'Learning',
  practising: 'Practising',
};

const COPY_ITEMS: [CopyWhat, string][] = [
  ['givens', 'Givens'],
  ['pm', 'Puzzle with candidates'],
  ['library', 'Library line'],
  ['formatted', 'Formatted grid'],
];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="menu-label" role="presentation">
      {children}
    </div>
  );
}

export function TopBar(p: Props) {
  const item = (close: () => void, label: string, run: () => void, disabled = false) => (
    <button key={label} role="menuitem" disabled={disabled} onClick={() => (close(), run())}>
      {label}
    </button>
  );
  /** the Game menu: new puzzle, modes, import and the puzzle collection */
  const gameItems = (close: () => void) => (
    <>
      <Label>Mode</Label>
      {item(close, `Playing${p.mode === 'playing' ? ' ✓' : ''}`, () => p.onMode('playing'))}
      {item(close, `Learning…${p.mode === 'learning' ? ' ✓' : ''}`, p.onTraining)}
      {item(close, `Practising…${p.mode === 'practising' ? ' ✓' : ''}`, p.onTraining)}
      <Label>Puzzle</Label>
      {item(close, 'Import…', p.onImport)}
      {item(close, 'Puzzles (library, history, saves)…', p.onPuzzles)}
      {item(close, 'Restart game', p.onRestart, !p.canRestart)}
    </>
  );
  /** the Share menu: copy, save and print */
  const shareItems = (close: () => void) => (
    <>
      <Label>Copy</Label>
      {COPY_ITEMS.map(([w, l]) => item(close, l, () => p.onCopy(w)))}
      <Label>Save to a file</Label>
      {COPY_ITEMS.map(([w, l]) => item(close, l, () => p.onSave(w)))}
      <Label>Print and export</Label>
      {item(close, 'Print', p.onPrint)}
      {item(close, 'Print solution', p.onPrintSolution)}
      {item(close, 'Extended print…', p.onExtendedPrint)}
      {item(close, 'Export as PNG', p.onExportPng)}
    </>
  );
  const newItems = (close: () => void) => (
    <>
      <Label>New puzzle</Label>
      {[1, 2, 3, 4, 5].map((l) => item(close, LEVEL_NAMES[l], () => p.onNew(l)))}
    </>
  );

  return (
    <header className="topbar">
      <a className="brand" href="../" aria-label="Hodoku Revisited home">
        <Logo />
        <span className="wordmark">
          Hodoku<small>Revisited</small>
        </span>
      </a>

      <div className="actions wide">
        <Menu label="New puzzle ▾" className="primary-menu">
          {newItems}
        </Menu>
        <Menu label="Game ▾">{gameItems}</Menu>
        <Menu label="Share ▾">{shareItems}</Menu>
      </div>

      <div className="spacer" />

      {p.busy && <button onClick={p.onCancel}>Cancel</button>}
      {p.mode !== 'playing' && <span className="chip-mode">{MODE_LABELS[p.mode]}</span>}
      {p.badge && (
        <span className="badge">
          {LEVEL_NAMES[p.badge.level]} <span className="dim">· {p.badge.score}</span>
        </span>
      )}
      <span className="progress wide" title="Cells filled">
        {p.filled}/81
      </span>
      <span className="timer wide" aria-label="Time">
        {formatTime(p.seconds)}
      </span>
      <button className="icon-btn" onClick={p.onUndo} disabled={!p.canUndo} aria-label="Undo" title="Undo (Z)">
        ↶
      </button>
      <button className="icon-btn wide" onClick={p.onRedo} disabled={!p.canRedo} aria-label="Redo" title="Redo (Y)">
        ↷
      </button>
      <button className="search wide" onClick={p.onCommands} aria-label="Search commands" title="Search commands (Ctrl or Cmd + K)">
        Search <kbd>⌘K</kbd>
      </button>
      <button className="wide" onClick={p.onSettings}>
        Settings
      </button>

      <Menu label="≡" className="narrow">
        {(close) => (
          <>
            {newItems(close)}
            {gameItems(close)}
            {shareItems(close)}
            <Label>App</Label>
            {item(close, 'Search commands', p.onCommands)}
            {item(close, 'Settings', p.onSettings)}
          </>
        )}
      </Menu>
    </header>
  );
}

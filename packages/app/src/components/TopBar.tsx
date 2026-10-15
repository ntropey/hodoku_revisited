import { useEffect, useRef, useState } from 'react';
import { LEVEL_NAMES } from '../protocol';
import { formatTime, type CopyWhat } from '../ui';

interface Props {
  badge: { level: number; score: number } | null;
  filled: number;
  seconds: number;
  busy: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onNew: (level: number) => void;
  onCancel: () => void;
  onImport: () => void;
  onPuzzles: () => void;
  onCopy: (what: CopyWhat) => void;
  onPrint: () => void;
  onPrintSolution: () => void;
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

export function TopBar(p: Props) {
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
          {(close) =>
            [1, 2, 3, 4, 5].map((l) => (
              <button
                key={l}
                role="menuitem"
                onClick={() => {
                  close();
                  p.onNew(l);
                }}
              >
                {LEVEL_NAMES[l]}
              </button>
            ))
          }
        </Menu>
        <button onClick={p.onImport}>Import</button>
        <button onClick={p.onPuzzles}>Puzzles</button>
        <Menu label="Copy">
          {(close) => (
            <>
              <button role="menuitem" onClick={() => (close(), p.onCopy('givens'))}>Givens</button>
              <button role="menuitem" onClick={() => (close(), p.onCopy('pm'))}>Puzzle with candidates</button>
              <button role="menuitem" onClick={() => (close(), p.onCopy('library'))}>Library line</button>
              <button role="menuitem" onClick={() => (close(), p.onCopy('formatted'))}>Formatted grid</button>
            </>
          )}
        </Menu>
        <button onClick={p.onPrint}>Print</button>
      </div>

      <div className="spacer" />

      {p.busy && <button onClick={p.onCancel}>Cancel</button>}
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
      <button className="search wide" onClick={p.onCommands} aria-label="Search commands">
        Search commands <kbd>⌘K</kbd>
      </button>
      <button className="wide" onClick={p.onSettings}>
        Settings
      </button>

      <Menu label="≡" className="narrow">
        {(close) => (
          <>
            {[1, 2, 3, 4, 5].map((l) => (
              <button key={l} role="menuitem" onClick={() => (close(), p.onNew(l))}>
                New: {LEVEL_NAMES[l]}
              </button>
            ))}
            <button role="menuitem" onClick={() => (close(), p.onImport())}>Import</button>
            <button role="menuitem" onClick={() => (close(), p.onPuzzles())}>Puzzles</button>
            <button role="menuitem" disabled={!p.canRestart} onClick={() => (close(), p.onRestart())}>Restart game</button>
            <button role="menuitem" onClick={() => (close(), p.onCopy('givens'))}>Copy givens</button>
            <button role="menuitem" onClick={() => (close(), p.onCopy('pm'))}>Copy puzzle with candidates</button>
            <button role="menuitem" onClick={() => (close(), p.onCopy('library'))}>Copy library line</button>
            <button role="menuitem" onClick={() => (close(), p.onCopy('formatted'))}>Copy formatted grid</button>
            <button role="menuitem" onClick={() => (close(), p.onPrint())}>Print</button>
            <button role="menuitem" onClick={() => (close(), p.onPrintSolution())}>Print solution</button>
            <button role="menuitem" onClick={() => (close(), p.onExportPng())}>Export PNG</button>
            <button role="menuitem" onClick={() => (close(), p.onCommands())}>Commands</button>
            <button role="menuitem" onClick={() => (close(), p.onSettings())}>Settings</button>
          </>
        )}
      </Menu>
    </header>
  );
}

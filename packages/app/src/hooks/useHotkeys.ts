import { useEffect, useRef } from 'react';
import type { Mode, Tab } from '../ui';

/** What the keyboard needs from the app. The latest values are read on every key press. */
export interface Hotkeys {
  /** a dialog is open: only Ctrl/Cmd+K still works */
  blocked: boolean;
  tab: Tab;
  selected: number | null;
  hasHint: boolean;
  toggleCommands: () => void;
  input: (digit: number) => void;
  eraseSelected: () => void;
  setMode: (fn: (m: Mode) => Mode) => void;
  toggleFilter: (digit: number) => void;
  clearFilter: () => void;
  dismissHint: () => void;
  askHint: () => void;
  applyHint: () => void;
  applyPathStep: () => void;
  undo: () => void;
  redo: () => void;
  select: (cell: number) => void;
}

/** The global keyboard shortcuts (see the manual's Keyboard shortcuts chapter). */
export function useHotkeys(h: Hotkeys): void {
  const ref = useRef(h);
  ref.current = h;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = ref.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        k.toggleCommands();
        return;
      }
      if (k.blocked || e.ctrlKey || e.metaKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.altKey && e.code.startsWith('Digit') && e.code !== 'Digit0') {
        e.preventDefault();
        k.toggleFilter(Number(e.code.slice(5)));
        return;
      }
      if (e.altKey) return;
      if (e.key >= '1' && e.key <= '9') k.input(Number(e.key));
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') k.eraseSelected();
      else if (e.key === 'n') k.setMode((m) => (m === 'notes' ? 'value' : 'notes'));
      else if (e.key === 'f') k.setMode((m) => (m === 'filter' ? 'value' : 'filter'));
      else if (e.key === 'c') k.setMode((m) => (m === 'color' ? 'value' : 'color'));
      else if (e.key === 'h') k.askHint();
      else if (e.key === 'Enter') {
        if (k.tab === 'path') k.applyPathStep();
        else if (k.hasHint) k.applyHint();
      } else if (e.key === 'Escape') {
        k.dismissHint();
        k.clearFilter();
      } else if (e.key === 'z') k.undo();
      else if (e.key === 'y') k.redo();
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const s = k.selected ?? 40;
        const r = Math.floor(s / 9) + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0);
        const c = (s % 9) + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0);
        k.select(Math.min(8, Math.max(0, r)) * 9 + Math.min(8, Math.max(0, c)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

import { useCallback, useEffect, useState } from 'react';
import type { GameState } from '../game';
import { localStorageStore } from '../storage';
import {
  addCapped,
  loadJson,
  newId,
  removeById,
  saveJson,
  snapshotGame,
  HISTORY_CAP,
  HISTORY_KEY,
  LIBRARY_CAP,
  LIBRARY_KEY,
  SAVEPOINTS_CAP,
  SAVEPOINTS_KEY,
  type HistoryEntry,
  type LibraryEntry,
  type SavePoint,
} from '../store';

/** The puzzle library, the history of played puzzles and the named save points, each kept in localStorage. */
export function useCollections() {
  const [library, setLibrary] = useState<LibraryEntry[]>(() => loadJson(localStorageStore, LIBRARY_KEY, []));
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadJson(localStorageStore, HISTORY_KEY, []));
  const [saves, setSaves] = useState<SavePoint[]>(() => loadJson(localStorageStore, SAVEPOINTS_KEY, []));
  useEffect(() => saveJson(localStorageStore, LIBRARY_KEY, library), [library]);
  useEffect(() => saveJson(localStorageStore, HISTORY_KEY, history), [history]);
  useEffect(() => saveJson(localStorageStore, SAVEPOINTS_KEY, saves), [saves]);

  /** Record a started puzzle; the newest entry is not repeated when the same puzzle is started again. */
  const recordStart = useCallback((g: GameState) => {
    setHistory((h) =>
      h[0]?.puzzle === g.givens
        ? h
        : addCapped(h, { id: newId(), puzzle: g.givens, level: g.level, score: g.score, seconds: 0, solved: false, at: Date.now() }, HISTORY_CAP),
    );
  }, []);

  /** The newest matching history entry is marked solved, with the time it took. */
  const markSolved = useCallback((givens: string | undefined, seconds: number) => {
    setHistory((h) => {
      const i = h.findIndex((e) => e.puzzle === givens);
      if (i === -1 || h[i].solved) return h;
      const next = h.slice();
      next[i] = { ...next[i], solved: true, seconds };
      return next;
    });
  }, []);

  const saveToLibrary = useCallback((game: GameState, name: string) => {
    setLibrary((l) => addCapped(l, { id: newId(), name, puzzle: game.givens, at: Date.now() }, LIBRARY_CAP));
  }, []);

  const createSave = useCallback((game: GameState, seconds: number, name: string) => {
    setSaves((s) => addCapped(s, { id: newId(), name, at: Date.now(), seconds, game: snapshotGame(game) }, SAVEPOINTS_CAP));
  }, []);

  const deleteLibrary = useCallback((id: string) => setLibrary((l) => removeById(l, id)), []);
  const deleteHistory = useCallback((id: string) => setHistory((h) => removeById(h, id)), []);
  const clearHistory = useCallback(() => setHistory([]), []);
  const deleteSave = useCallback((id: string) => setSaves((s) => removeById(s, id)), []);

  return { library, history, saves, recordStart, markSolved, saveToLibrary, createSave, deleteLibrary, deleteHistory, clearHistory, deleteSave };
}

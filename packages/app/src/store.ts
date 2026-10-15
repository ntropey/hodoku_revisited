/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Storage helpers for the puzzle library, the history and the save points.
 * Pure: no React, and localStorage is supplied by the caller, so these helpers can be tested with a stub.
 */

/** The bits of localStorage the app uses; passed in so the helpers can be tested with a stub. */
export interface Store {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export function loadJson<T>(store: Store, key: string, fallback: T): T {
  try {
    const raw = store.get(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(store: Store, key: string, value: unknown): void {
  try {
    store.set(key, JSON.stringify(value));
  } catch {
    /* private mode or full: the data just isn't remembered */
  }
}

/** Newest first, capped; the newest entry is index 0. */
export function addCapped<T extends { at: number }>(list: T[], item: T, cap: number): T[] {
  return [item, ...list].slice(0, cap);
}

export function removeById<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((x) => x.id !== id);
}

export const LIBRARY_KEY = 'hodoku-revisited:library';
export const HISTORY_KEY = 'hodoku-revisited:history';
export const SAVEPOINTS_KEY = 'hodoku-revisited:savepoints';
export const LIBRARY_CAP = 200;
export const HISTORY_CAP = 100;
export const SAVEPOINTS_CAP = 20;

export interface LibraryEntry {
  id: string;
  name: string;
  /** 81 characters */
  puzzle: string;
  at: number;
}

export interface HistoryEntry {
  id: string;
  /** 81 characters */
  puzzle: string;
  level: number;
  score: number;
  seconds: number;
  solved: boolean;
  at: number;
}

/** A game without its undo history, so a save point stays small. */
export interface SavedGame {
  givens: string;
  values: number[];
  cands: number[];
  notes?: number[];
  solution: number[];
  level: number;
  score: number;
  path?: unknown;
  hints?: number;
  cellColors?: number[];
  candColors?: number[];
}

export interface SavePoint {
  id: string;
  name: string;
  at: number;
  seconds: number;
  game: SavedGame;
}

/** A fresh, practically unique id: the time in base 36 plus random digits. */
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** The game as it can be stored in a save point: everything but `past` and `future`. */
export function snapshotGame(game: SavedGame & { past?: unknown; future?: unknown }): SavedGame {
  return {
    givens: game.givens,
    values: game.values.slice(),
    cands: game.cands.slice(),
    notes: game.notes?.slice(),
    solution: game.solution.slice(),
    level: game.level,
    score: game.score,
    path: game.path,
    hints: game.hints,
    cellColors: game.cellColors?.slice(),
    candColors: game.candColors?.slice(),
  };
}

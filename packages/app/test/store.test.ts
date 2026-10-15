import { describe, expect, it } from 'vitest';
import { addCapped, loadJson, newId, removeById, saveJson, snapshotGame, type Store } from '../src/store';

/** An in-memory Store, standing in for localStorage. */
function memoryStore(): Store {
  const map = new Map<string, string>();
  return { get: (key) => map.get(key) ?? null, set: (key, value) => void map.set(key, value) };
}

describe('loadJson', () => {
  it('returns the fallback for a missing key', () => {
    expect(loadJson(memoryStore(), 'missing', { a: 1 })).toEqual({ a: 1 });
  });
  it('returns the fallback for broken JSON', () => {
    const store = memoryStore();
    store.set('k', '{not json');
    expect(loadJson(store, 'k', [] as number[])).toEqual([]);
  });
  it('parses a stored value', () => {
    const store = memoryStore();
    store.set('k', '[1,2]');
    expect(loadJson(store, 'k', [] as number[])).toEqual([1, 2]);
  });
});

describe('saveJson', () => {
  it('round-trips a value', () => {
    const store = memoryStore();
    saveJson(store, 'k', { a: [1] });
    expect(loadJson<{ a: number[] } | null>(store, 'k', null)).toEqual({ a: [1] });
  });
  it('does not throw when the store refuses to write', () => {
    const store: Store = {
      get: () => null,
      set: () => {
        throw new Error('quota');
      },
    };
    expect(() => saveJson(store, 'k', 1)).not.toThrow();
  });
});

describe('addCapped', () => {
  it('puts the newest first and enforces the cap', () => {
    const items = [
      { at: 1, id: 'a' },
      { at: 2, id: 'b' },
      { at: 3, id: 'c' },
    ];
    let list: typeof items = [];
    for (const item of items) list = addCapped(list, item, 2);
    expect(list.map((x) => x.id)).toEqual(['c', 'b']);
  });
});

describe('removeById', () => {
  it('removes exactly one entry', () => {
    const list = [
      { id: 'a', at: 1 },
      { id: 'b', at: 2 },
    ];
    expect(removeById(list, 'a').map((x) => x.id)).toEqual(['b']);
    expect(removeById(list, 'missing')).toHaveLength(2);
  });
});

describe('snapshotGame', () => {
  it('drops past and future, and copies the arrays', () => {
    const game = {
      givens: '9'.repeat(81),
      values: new Array<number>(81).fill(0),
      cands: new Array<number>(81).fill(0),
      solution: new Array<number>(81).fill(1),
      level: 1,
      score: 10,
      past: [{ values: [] }],
      future: [{ values: [] }],
    };
    const snap = snapshotGame(game);
    expect(snap).not.toHaveProperty('past');
    expect(snap).not.toHaveProperty('future');
    expect(snap.givens).toBe(game.givens);
    expect(snap.values).toEqual(game.values);
    expect(snap.values).not.toBe(game.values);
  });
});

describe('newId', () => {
  it('generates distinct ids', () => {
    expect(newId()).not.toBe(newId());
  });
});

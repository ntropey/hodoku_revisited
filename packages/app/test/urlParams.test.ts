import { describe, expect, it } from 'vitest';
import { levelFromSearch, puzzleFromSearch } from '../src/urlParams';

const P = '97....4..2..4718.3........5....5..8.5.1.4.2.9.4..8....8........3.9762..8..5....67';

describe('address parameters', () => {
  it('reads a puzzle of 81 characters and nothing else', () => {
    expect(puzzleFromSearch(`?p=${P}`)).toBe(P);
    expect(puzzleFromSearch(`?p=${P}x`)).toBeNull();
    expect(puzzleFromSearch('?p=123')).toBeNull();
    expect(puzzleFromSearch('')).toBeNull();
  });
  it('reads a level from 1 to 5', () => {
    expect(levelFromSearch('?level=3')).toBe(3);
    expect(levelFromSearch('?level=0')).toBeNull();
    expect(levelFromSearch('?level=6')).toBeNull();
    expect(levelFromSearch('?level=2.5')).toBeNull();
    expect(levelFromSearch('?level=abc')).toBeNull();
    expect(levelFromSearch('')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { coachFromSearch, dailyFromSearch, levelFromSearch, proofFromSearch, puzzleFromSearch } from '../src/urlParams';

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
  it('reads a daily puzzle date or resolves ?daily=1 to today UTC', () => {
    const fixed = new Date('2026-10-20T12:00:00Z');
    expect(dailyFromSearch('?daily=1', fixed)).toBe('2026-10-20');
    expect(dailyFromSearch('?daily=today', fixed)).toBe('2026-10-20');
    expect(dailyFromSearch('?daily=2026-05-01', fixed)).toBe('2026-05-01');
    expect(dailyFromSearch('?daily=not-a-date', fixed)).toBeNull();
    expect(dailyFromSearch('', fixed)).toBeNull();
  });
  it('reads an AI Coach proof target (?prove=rXcY.D or ?prove=cell.D) and coach flag', () => {
    expect(proofFromSearch('?prove=r1c9.4')).toEqual({ cell: 8, digit: 4 });
    expect(proofFromSearch('?prove=8.4')).toEqual({ cell: 8, digit: 4 });
    expect(proofFromSearch('?prove=r9c9-9')).toEqual({ cell: 80, digit: 9 });
    expect(proofFromSearch('?prove=81.4')).toBeNull();
    expect(proofFromSearch('?prove=r1c9.0')).toBeNull();
    expect(proofFromSearch('')).toBeNull();
    expect(coachFromSearch('?coach=1')).toBe(true);
    expect(coachFromSearch('?coach=true')).toBe(true);
    expect(coachFromSearch('?coach=0')).toBe(false);
  });
});

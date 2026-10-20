/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * What the address can ask the app to do on start.
 */

/** Today's UTC date string (YYYY-MM-DD), used to seed the daily puzzle. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** A puzzle given in the address (?p=81 characters), used by the "open in app" links of the guides. */
export function puzzleFromSearch(search: string): string | null {
  const p = new URLSearchParams(search).get('p');
  return p && /^[.0-9]{81}$/.test(p) ? p : null;
}

/** A difficulty in the address (?level=1..5), used by the start page: begins a new puzzle of that level. */
export function levelFromSearch(search: string): number | null {
  const l = Number(new URLSearchParams(search).get('level'));
  return Number.isInteger(l) && l >= 1 && l <= 5 ? l : null;
}

/** A daily puzzle date in the address (?daily=1, ?daily=today, or ?daily=YYYY-MM-DD). */
export function dailyFromSearch(search: string, now: Date = new Date()): string | null {
  const d = new URLSearchParams(search).get('daily');
  if (!d) return null;
  if (d === '1' || d === 'today') return todayIso(now);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/**
 * An AI Coach contradiction proof target in the address (?prove=r1c9.4 or ?prove=8.4).
 * Used by shared proof links to automatically run "Why not D in rXcY?" on start.
 */
export function proofFromSearch(search: string): { cell: number; digit: number } | null {
  const raw = new URLSearchParams(search).get('prove');
  if (!raw) return null;
  const rc = /^r([1-9])c([1-9])[.:-]([1-9])$/i.exec(raw);
  if (rc) {
    const r = Number(rc[1]) - 1;
    const c = Number(rc[2]) - 1;
    return { cell: r * 9 + c, digit: Number(rc[3]) };
  }
  const idx = /^(\d{1,2})[.:-]([1-9])$/.exec(raw);
  if (idx) {
    const cell = Number(idx[1]);
    if (cell >= 0 && cell < 81) return { cell, digit: Number(idx[2]) };
  }
  return null;
}

/** Whether the address asks to open the AI Coach Socratic walkthrough immediately (?coach=1). */
export function coachFromSearch(search: string): boolean {
  const c = new URLSearchParams(search).get('coach');
  return c === '1' || c === 'true';
}

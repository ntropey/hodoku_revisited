/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * What the address can ask the app to do on start.
 */

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

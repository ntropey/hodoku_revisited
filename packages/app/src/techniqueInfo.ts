/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Short explanations of the techniques and the matching guide page on the website.
 * (The long versions are in packages/website/src/techniques.mjs.)
 */
import type { SolutionType } from '@hodoku/core';

interface Info {
  slug: string;
  summary: string;
}

const FISH = 'Fish: a digit confined to the same few lines in several rows (or columns), so it can be removed from the other cells of those lines.';

const BY_SLUG: Record<string, string> = {
  'full-house': 'A unit with only one empty cell left: it takes the missing digit.',
  'naked-single': 'A cell with only one candidate left.',
  'hidden-single': 'A digit that fits in only one cell of a row, column or box.',
  'locked-candidates': 'A digit confined to the overlap of a box and a line, so it can be removed from the rest of the box or line.',
  'naked-subsets': 'N cells in a unit that together hold only N digits: those digits can be removed from the rest of the unit.',
  'hidden-subsets': 'N digits that fit only in the same N cells of a unit: all other candidates can be removed from those cells.',
  'x-wing': 'A digit in two rows confined to the same two columns: it can be removed from the rest of those columns.',
  swordfish: FISH,
  skyscraper: 'Two rows where a digit has two candidates each, lined up on one side: cells seeing both roofs lose the digit.',
  'two-string-kite': 'A row link and a column link joined in one box: cells seeing both ends lose the digit.',
  'empty-rectangle': 'A box with the digit only in one row and one column, combined with a link elsewhere.',
  'xy-wing': 'A pivot {X,Y} with pincers {X,Z} and {Y,Z}: Z is removed from cells seeing both pincers.',
  'xyz-wing': 'A pivot {X,Y,Z} with pincers {X,Z} and {Y,Z}: Z is removed from cells seeing all three.',
  'w-wing': 'Two equal bi-value cells joined by a strong link: the other digit is removed from cells seeing both.',
  'simple-colors': 'Two alternating colors along strong links: one color is true. Wrong colors and trapped cells are removed.',
  'unique-rectangle': 'Avoids a pattern that would give two solutions (valid only for puzzles with one solution).',
  'xy-chain': 'A chain of bi-value cells: the digit at both ends cannot be in cells seeing both ends.',
  'als-xz': 'Two almost locked sets linked by a restricted common digit: a shared digit is removed from cells seeing both.',
  'nice-loops': 'An alternating chain of strong and weak links: cells seeing both ends lose that digit.',
  'forcing-chains': 'Follow the consequences of a candidate: if they lead to a contradiction or all agree, a conclusion is certain.',
};

function slugOf(type: SolutionType): string | null {
  const t: string = type;
  if (t === 'FULL_HOUSE') return 'full-house';
  if (t === 'NAKED_SINGLE') return 'naked-single';
  if (t === 'HIDDEN_SINGLE') return 'hidden-single';
  if (t.startsWith('LOCKED_CANDIDATES')) return 'locked-candidates';
  if (/^(NAKED_|LOCKED_PAIR|LOCKED_TRIPLE)/.test(t)) return 'naked-subsets';
  if (t.startsWith('HIDDEN_RECTANGLE')) return 'unique-rectangle';
  if (t.startsWith('HIDDEN_')) return 'hidden-subsets';
  if (/X_WING$/.test(t) && !t.startsWith('KRAKEN')) return 'x-wing';
  if (/(SWORDFISH|JELLYFISH|SQUIRMBAG|WHALE|LEVIATHAN)$/.test(t)) return 'swordfish';
  if (t === 'SKYSCRAPER') return 'skyscraper';
  if (t.endsWith('TWO_STRING_KITE')) return 'two-string-kite';
  if (t.endsWith('EMPTY_RECTANGLE')) return 'empty-rectangle';
  if (t === 'XY_WING') return 'xy-wing';
  if (t === 'XYZ_WING') return 'xyz-wing';
  if (t === 'W_WING') return 'w-wing';
  if (/COLORS/.test(t)) return 'simple-colors';
  if (/^(UNIQUENESS|BUG_PLUS|AVOIDABLE)/.test(t)) return 'unique-rectangle';
  if (t === 'XY_CHAIN' || t === 'REMOTE_PAIR') return 'xy-chain';
  if (/^(ALS_|SUE_DE_COQ|DEATH_BLOSSOM)/.test(t)) return 'als-xz';
  if (/(NICE_LOOP|AIC|X_CHAIN|TURBOT)/.test(t)) return 'nice-loops';
  if (t.startsWith('FORCING')) return 'forcing-chains';
  return null;
}

export function techniqueInfo(type: SolutionType): Info | null {
  const slug = slugOf(type);
  return slug ? { slug, summary: BY_SLUG[slug] } : null;
}

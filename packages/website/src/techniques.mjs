/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Technique guides. These texts are original (not taken from the HoDoKu manual, which is GFDL).
 * Notation: rXcY is row X, column Y; "box" is a 3x3 block; "digit" and "candidate" are used as in HoDoKu.
 */

export const LEVELS = ['Easy', 'Medium', 'Hard', 'Unfair', 'Extreme'];

/** slug, name, level, summary, body (HTML paragraphs), tip */
export const TECHNIQUES = [
  {
    slug: 'full-house',
    name: 'Full House',
    level: 'Easy',
    summary: 'A row, column or box with only one empty cell left.',
    body: [
      'If eight of the nine cells in a row, column or box are filled, the last cell must hold the digit that is missing. This is the simplest step in sudoku.',
      'Example: row 4 contains 1, 2, 3, 4, 5, 6, 7 and 8, with one empty cell. That cell is a 9.',
    ],
  },
  {
    slug: 'naked-single',
    name: 'Naked Single',
    level: 'Easy',
    summary: 'A cell with only one candidate left.',
    body: [
      'Look at one empty cell and cross out every digit that already appears in its row, column or box. If exactly one digit remains, that digit goes in the cell.',
      'It is called "naked" because the single candidate is visible without looking at any other cell. With pencil marks turned on, these are the cells showing just one small digit.',
    ],
  },
  {
    slug: 'hidden-single',
    name: 'Hidden Single',
    level: 'Easy',
    summary: 'A digit that fits in only one cell of a row, column or box.',
    body: [
      'Pick a unit (row, column or box) and a digit that is not yet placed in it. If only one cell of that unit can still take the digit, it goes there, even if that cell has other candidates too.',
      'Example: in box 5 the digit 7 is blocked in every cell except r5c6 because of 7s in other rows and columns. Then r5c6 is 7.',
    ],
    tip: 'Scan one digit at a time across all boxes. This is the most productive habit for easy and medium puzzles.',
  },
  {
    slug: 'locked-candidates',
    name: 'Locked Candidates',
    level: 'Easy',
    summary: 'A digit confined to the overlap of a box and a line (also called pointing pairs, claiming).',
    body: [
      'Type 1 (pointing): if all candidates for a digit inside a box lie in one row (or column), then that digit must go in that row inside the box. So it can be removed from the rest of that row outside the box.',
      'Type 2 (claiming): if all candidates for a digit inside a row (or column) lie within one box, the digit must go in that box in that row, so it can be removed from the other cells of the box.',
      'Both types are the same fact seen from two sides: the digit is "locked" into the cells where a box and a line meet.',
    ],
  },
  {
    slug: 'naked-subsets',
    name: 'Naked Pair, Triple and Quad',
    level: 'Medium',
    summary: 'N cells in a unit that together hold only N digits.',
    body: [
      'If two cells in a unit both have only the same two candidates, say 3 and 8, then those two digits must fill those two cells, in some order. Remove 3 and 8 from every other cell in that unit. That is a Naked Pair.',
      'The idea extends: three cells whose candidates together are only three digits form a Naked Triple, and four cells with four digits a Naked Quad. The cells do not need to hold every digit of the set: {1,2}, {2,3} and {1,3} work, and so does {1,2,3}, {1,2}, {2,3}.',
    ],
  },
  {
    slug: 'hidden-subsets',
    name: 'Hidden Pair, Triple and Quad',
    level: 'Medium',
    summary: 'N digits that can only go into the same N cells of a unit.',
    body: [
      'If two digits, say 4 and 6, appear as candidates in only two cells of a unit, then those cells must hold 4 and 6. Remove every other candidate from those two cells. That is a Hidden Pair.',
      'Hidden subsets are the mirror image of naked subsets: a hidden pair in a unit corresponds to a naked set formed by the remaining cells. Triples and quads work the same way with three or four digits.',
    ],
  },
  {
    slug: 'x-wing',
    name: 'X-Wing',
    level: 'Hard',
    summary: 'A digit in two rows that is limited to the same two columns.',
    body: [
      'Take a digit. If in two different rows it has exactly two candidate cells each, and they sit in the same two columns, the four cells form a rectangle. The digit must occupy one diagonal of that rectangle, so it will be used once in each of the two columns.',
      'Therefore, remove that digit from all other cells of those two columns. The same logic works with rows and columns swapped.',
    ],
    tip: 'X-Wing is the smallest basic fish. Swordfish and Jellyfish extend it to three and four rows.',
  },
  {
    slug: 'swordfish',
    name: 'Swordfish and Jellyfish',
    level: 'Hard',
    summary: 'The X-Wing idea with three (or four) rows and columns.',
    body: [
      'For a digit, find three rows in which its candidates lie within the same three columns (each row may use two or three of them). Then the digit must be placed once in each of these columns in these rows, so you can remove it from all other cells of the three columns.',
      'A Jellyfish does the same with four rows and four columns. Larger fish exist but are rarely needed, since a smaller pattern from the opposite direction usually exists as well.',
    ],
  },
  {
    slug: 'skyscraper',
    name: 'Skyscraper',
    level: 'Hard',
    summary: 'Two rows (or columns) where a digit has two candidates each and they line up on one side.',
    body: [
      'Take a digit that has exactly two candidates in each of two rows. If one pair of these candidates is in the same column (the base), the other two (the roofs) are in different columns. One of the two roofs must be the digit, no matter how the base resolves.',
      'So any cell that sees both roofs cannot be that digit. Remove the digit from all such cells.',
    ],
  },
  {
    slug: 'two-string-kite',
    name: '2-String Kite',
    level: 'Hard',
    summary: 'A row strong link and a column strong link joined inside one box.',
    body: [
      'For a digit, find a row where it has exactly two candidates and a column where it has exactly two candidates, with one candidate from each in the same box. The other two candidates (the ends) are then connected by the pattern: at least one of them must be true.',
      'Remove the digit from any cell that sees both ends.',
    ],
  },
  {
    slug: 'empty-rectangle',
    name: 'Empty Rectangle',
    level: 'Hard',
    summary: 'A box where a digit lies only in one row and one column, forming a cross, combined with a strong link.',
    body: [
      'In a box, if all candidates of a digit lie in one row r and one column c of that box (a cross shape; the cells of the box outside that row and column are empty of the digit), you have an Empty Rectangle.',
      'Now find a column elsewhere where the digit has exactly two candidates, and one of them lies in row r. Let the other one be in row s. If the first end is the digit, it clears row r in the box, so the box\'s digit must be in column c. If the first end is false, the other end (row s) is the digit. In both cases the digit cannot be at the crossing of row s and column c (if outside the box), so remove it there. Rows and columns can be swapped.',
    ],
  },
  {
    slug: 'xy-wing',
    name: 'XY-Wing',
    level: 'Hard',
    summary: 'A pivot with candidates {X,Y} and two pincers {X,Z} and {Y,Z}.',
    body: [
      'Find a cell with exactly two candidates, X and Y (the pivot). It sees two other bi-value cells: one with X and Z, another with Y and Z (the pincers).',
      'If the pivot is X, the first pincer becomes Z. If the pivot is Y, the second pincer becomes Z. Either way one pincer is Z, so Z can be removed from any cell that sees both pincers.',
    ],
  },
  {
    slug: 'xyz-wing',
    name: 'XYZ-Wing',
    level: 'Hard',
    summary: 'Like an XY-Wing but the pivot has three candidates {X,Y,Z}.',
    body: [
      'The pivot holds {X,Y,Z}, one pincer {X,Z} and the other {Y,Z}, and both pincers see the pivot. Whatever the pivot is (X, Y or Z), at least one of the three cells holds Z.',
      'So Z can be removed from every cell that sees all three cells.',
    ],
  },
  {
    slug: 'w-wing',
    name: 'W-Wing',
    level: 'Hard',
    summary: 'Two identical bi-value cells joined by a strong link on one of their digits.',
    body: [
      'Two cells with the same two candidates {X,Y} that do not see each other, plus a unit where X has exactly two candidates, one seen by each bi-value cell. If one bi-value cell is X, its linked cell in the unit is not X, so the other end of the strong link is X, which makes the second bi-value cell Y. Otherwise the first cell is Y. In both cases at least one of them is Y.',
      'Remove Y from every cell that sees both bi-value cells.',
    ],
  },
  {
    slug: 'simple-colors',
    name: 'Simple Colors',
    level: 'Hard',
    summary: 'Color a chain of strong links for one digit with two alternating colors.',
    body: [
      'For one digit, mark cells connected by strong links (units where the digit has exactly two candidates) and alternate two colors along the chain. Exactly one color holds the digit.',
      'Color wrap: if two cells of the same color see each other, that color is false, so the digit is in all cells of the other color. Color trap: a cell outside the chain that sees both colors cannot be the digit.',
    ],
  },
  {
    slug: 'unique-rectangle',
    name: 'Uniqueness techniques',
    level: 'Hard',
    summary: 'Avoid patterns that would give a puzzle two solutions.',
    body: [
      'A valid puzzle has one solution. If four cells in two rows, two columns and two boxes held only the same two digits, you could swap them to get a second solution. So puzzles cannot contain that deadly pattern.',
      'Unique Rectangle types look for three corners with the two digits plus extra candidates and use the ban to remove one of the two digits from the fourth corner (type 1), or to restrict extra candidates in two corners (types 2 to 6). These steps are only valid when the puzzle is known to have a unique solution.',
    ],
    tip: 'Hodoku Revisited marks uniqueness-based hints so you can tell they rely on that assumption.',
  },
  {
    slug: 'xy-chain',
    name: 'XY-Chain and Remote Pairs',
    level: 'Hard',
    summary: 'A chain of bi-value cells where each shares one digit with the next.',
    body: [
      'Start with a bi-value cell {A,B}. The next cell sees it and holds {B,C}, the next {C,D}, and so on, up to an end cell that contains A. If the start cell is not A, it is B; that makes the second cell C, the third D, and so on, until the end cell must be A. So at least one of the two end cells is A.',
      'Remove A from every cell that sees both ends. A Remote Pair is the special case where every cell of the chain holds the same two digits.',
    ],
  },
  {
    slug: 'als-xz',
    name: 'ALS-XZ',
    level: 'Unfair',
    summary: 'Two almost locked sets linked by a restricted common digit.',
    body: [
      'An Almost Locked Set (ALS) is N cells in one unit with N+1 candidates in total. If you remove one candidate, the rest becomes locked. Take two ALSs, A and B, with a restricted common digit X (every X in A sees every X in B) and a second common digit Z.',
      'If X is in A, then X is not in B, and B loses X, so B holds Z. If X is not in A, then A holds Z. Either way one of the two sets holds Z, so Z can be removed from every cell that sees all Z candidates in both sets.',
    ],
  },
  {
    slug: 'nice-loops',
    name: 'Nice Loops and AICs',
    level: 'Unfair',
    summary: 'Alternating inference chains that mix strong and weak links.',
    body: [
      'A strong link says "if this is false, that is true". A weak link says "if this is true, that is false". An alternating chain that starts with a strong link and ends with one proves that at least one end is true.',
      'Any cell that sees both ends of the chain with the same digit cannot hold that digit. If the chain closes into a loop, additional eliminations along the loop are possible. Turbot fish, skyscrapers, kites, X-chains and XY-chains are all special cases.',
    ],
  },
  {
    slug: 'forcing-chains',
    name: 'Forcing Chains and Nets',
    level: 'Extreme',
    summary: 'Follow the consequences of a candidate being true or false until they agree.',
    body: [
      'Assume a candidate is true and follow every consequence (singles, eliminations). Do the same for the other possible candidates in a cell, or for the other positions of a digit in a unit. If all branches end in the same conclusion (a placement or an elimination), that conclusion is a fact.',
      'Forcing chains follow one chain at a time. Forcing nets may use any number of consequences, including singles, at each step, and are the hardest logical techniques HoDoKu searches for.',
    ],
  },
];

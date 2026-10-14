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
    slug: 'turbot-fish',
    name: 'Turbot Fish',
    level: 'Hard',
    summary: 'Strong link, weak link, strong link on one digit; the two ends cannot both be false.',
    body: [
      'Pick a digit. Find a unit where it has exactly two candidates (a strong link between A and B), another strong link between C and D, and connect them with a weak link: B and C see each other. If A is false then B is true, which makes C false, which makes D true. So at least one of A and D is true.',
      'Any cell that sees both A and D cannot hold the digit. Skyscrapers, 2-String Kites and Empty Rectangles are special shapes of the Turbot Fish, which is why the solver treats them as separate, simpler names.',
    ],
  },
  {
    slug: 'x-chain',
    name: 'X-Chain',
    level: 'Unfair',
    summary: 'A longer Turbot Fish: strong and weak links alternate, all on one digit.',
    body: [
      'Extend the turbot fish: strong link, weak link, strong link, weak link, and so on, always for the same digit, and always starting and ending with a strong link. If the first cell is false, the chain forces the last cell to be true. So at least one of the two ends is true.',
      'Remove the digit from every cell that sees both ends. The chain must not visit the same cell twice.',
    ],
  },
  {
    slug: 'multi-colors',
    name: 'Multi Colors',
    level: 'Hard',
    summary: 'Simple Colors with two or more separate chains for the same digit.',
    body: [
      'Color several chains of strong links for one digit, each with its own two colors. Exactly one color per chain is true. Two rules link the chains:',
      'Type 2: if a cell of one color sees cells of both colors of another chain, that color cannot be true (one of the other chain\'s colors has to be, and the cell would clash with it). Remove the digit from all cells of that color. Type 1: if two cells of different chains see each other, those two colors cannot both be true, so one of the two other colors is. Any cell that sees both of those other colors loses the digit.',
    ],
  },
  {
    slug: 'finned-fish',
    name: 'Finned and Sashimi Fish',
    level: 'Hard',
    summary: 'A fish with one or two extra candidates (fins) next to a corner.',
    body: [
      'A finned fish is a fish (X-Wing, Swordfish, Jellyfish) in which one base line has an extra candidate, the fin, that the cover lines do not cover. If the fin is false, the ordinary fish exists. If the fin is true, it removes the digit from every cell it sees.',
      'So only the cells that the plain fish would eliminate and that also see the fin can lose the digit. Those are usually cells in the fin\'s box. A Sashimi fish is a finned fish where one of the base lines is missing a corner, so only the fin and one other candidate remain in that line.',
    ],
  },
  {
    slug: 'franken-mutant-fish',
    name: 'Franken and Mutant Fish',
    level: 'Unfair',
    summary: 'Fish whose base or cover sets include boxes (Franken) or mix rows, columns and boxes (Mutant).',
    body: [
      'A normal fish uses rows as base lines and columns as cover lines (or the reverse). A Franken fish may use boxes among the base or the cover sets. A Mutant fish mixes rows, columns and boxes on both sides.',
      'The rule stays the same: N base units and N cover units, every candidate of the digit in the base units lies in a cover unit, and the base units do not overlap. Then the digit must sit in exactly one cell of each base unit and therefore be used up by the cover units; all other candidates of the cover units can be removed. Fins and sashimi work as for ordinary fish. Mutant fish are very rare.',
    ],
  },
  {
    slug: 'sue-de-coq',
    name: 'Sue de Coq',
    level: 'Unfair',
    summary: 'The cells where a box meets a line, plus one set of cells in the line and one in the box, form a locked set.',
    body: [
      'Take the two or three cells where a box and a line (row or column) cross. Together they hold at least two more digits than they have cells. Look for a group of cells in the line (outside the box) and a group in the box (outside the line) whose digits come from the crossing cells, with the two groups using different digits, so that the digits of all three groups number exactly as many as their cells.',
      'Then these cells are a locked set. Remove from the rest of the line every digit of the three groups that does not appear in the box group, and from the rest of the box every digit that does not appear in the line group.',
    ],
    tip: 'A Sue de Coq is a pair of almost locked sets with a special shape. If you know ALS-XZ it helps to read the diagram as three almost locked sets.',
  },
  {
    slug: 'als-xy-wing',
    name: 'ALS-XY-Wing',
    level: 'Unfair',
    summary: 'Three almost locked sets: C is linked to A and to B by two different restricted commons.',
    body: [
      'Take three almost locked sets A, B and C. C is linked to A by a restricted common digit X and to B by a different restricted common digit Y. A and B share a third digit Z.',
      'If X is not in A, then A holds Z. If X is in A, then C loses X and holds Y, so B loses Y and holds Z. So one of A and B contains Z. Any cell that sees all Z candidates of both A and B cannot be Z.',
    ],
  },
  {
    slug: 'als-chain',
    name: 'ALS-Chain',
    level: 'Unfair',
    summary: 'A chain of almost locked sets linked by restricted commons.',
    body: [
      'Link almost locked sets in a row, each pair connected by a restricted common digit, and consecutive links using different digits. At the two ends of the chain, look for a digit Z that both end sets contain and that is not used in the links.',
      'If the first set does not contain Z, the chain forces the last set to hold it. So at least one end set contains Z, and every cell that sees all Z candidates of both ends cannot be Z. ALS-XZ and ALS-XY-Wing are the chains of two and three sets.',
    ],
  },
  {
    slug: 'death-blossom',
    name: 'Death Blossom',
    level: 'Unfair',
    summary: 'A cell whose every candidate has its own almost locked set.',
    body: [
      'Take a cell (the stem) with candidates a, b, c. For each of them find an almost locked set that contains that digit, where every candidate of the digit in the set sees the stem cell. Whatever digit the stem takes, the matching set loses that digit and becomes locked.',
      'Now look for a digit Z (not one of the stem\'s digits) that every one of the sets contains. Whichever set is locked holds Z, so any cell that sees all Z candidates in all the sets cannot be Z.',
    ],
  },
  {
    slug: 'rectangles-bug',
    name: 'Hidden and Avoidable Rectangles, BUG+1',
    level: 'Hard',
    summary: 'More uniqueness techniques: the puzzle has only one solution, so some patterns cannot occur.',
    body: [
      'A Hidden Rectangle is a Unique Rectangle in which one corner holds only the two rectangle digits. If one of the digits appears only inside the rectangle in the row and column of the opposite corner, the other digit can be removed from that opposite corner.',
      'An Avoidable Rectangle uses solved cells instead of cells with two candidates. A cell you solved yourself (not a given) could be swapped, so a rectangle of two such cells with the matching digits cannot be completed to a deadly pattern. Type 1: three corners fit, and the fourth cannot take the digit that would complete the pattern.',
      'BUG+1 (bivalue universal grave plus one): if every unsolved cell had two candidates and every digit appeared exactly twice in each unit, the puzzle would have several solutions. If all unsolved cells have two candidates except one with three, the digit that appears three times in its row, column and box has to go in that cell, so its other two candidates can be removed.',
    ],
    tip: 'All of these only work when the puzzle has exactly one solution. The app marks such hints, and puzzles you import are checked for a unique solution first.',
  },
  {
    slug: 'kraken-fish',
    name: 'Kraken Fish',
    level: 'Extreme',
    summary: 'A finned fish where chains, not the fin geometry, prove the elimination.',
    body: [
      'In a finned fish either the plain fish exists, or one of the fins is true. A Kraken fish uses chains to deal with the fins. Type 1: a candidate of the digit that the plain fish would eliminate, but which does not see the fins. If a chain from every fin leads to that candidate being false, it can be removed in every case.',
      'Type 2: for a cover unit, find chains from all the base candidates in it (and from every fin) that lead to one and the same candidate being false. In an ordinary fish exactly one of those base candidates is true, so that candidate is false whichever it is. Type 2 may eliminate any digit, not only the fish digit. The search is slow, and Kraken fish are among the hardest techniques HoDoKu looks for.',
    ],
  },
  {
    slug: 'templates',
    name: 'Templates (for computers)',
    level: 'Extreme',
    summary: 'All ways to place one digit in the whole grid, checked against what is known.',
    body: [
      'A template is one way to place a digit once in every row, column and box: there are 46,656 of them. For each digit, discard the templates that use a cell where the digit is not allowed or that miss a cell where it is already placed. If every remaining template of a digit contains a cell, the digit goes there (Template Set). If no remaining template contains a cell, the digit can be removed from it (Template Delete).',
      'The solver can also drop templates that overlap a cell which another digit needs for all its templates, and repeat. This is a computer-sized technique that people rarely use by hand. In HoDoKu it is a last resort before trial and error, and it is switched off by default.',
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

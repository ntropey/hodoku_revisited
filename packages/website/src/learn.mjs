/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Learn pages: plain-language sudoku help that leads into the technique guides and the solver.
 * Original text. `body` is a function of the technique list (so the level page cannot drift from the guides) and
 * returns trusted HTML; links to guides are written relative to /learn/.
 */

const g = (slug, name) => `<a href="../techniques/${slug}.html">${name}</a>`;

export const LEARN = [
  {
    slug: 'how-to-solve-sudoku',
    title: 'How to solve sudoku',
    summary: 'A step-by-step method for beginners, from scanning to the first advanced techniques.',
    body: () => `
<p>A sudoku is a 9 by 9 grid split into nine 3 by 3 boxes. Fill it so that every row, every column and every box contains the digits 1 to 9 exactly once. A well-made puzzle has one solution, and you can always reach it by logic. You never need to guess.</p>
<h2>1. Scan for the easy cells</h2>
<p>Start with the digit that already appears most often. Take a 5, for example. Every 5 already on the grid rules out the rest of its row, column and box. Look at a box that has no 5 yet: if the 5s elsewhere block all but one of its empty cells, the 5 goes there. This is the ${g('hidden-single', 'hidden single')}, found by scanning. Repeat with every digit, and go round again whenever you place something, because each new digit blocks more cells.</p>
<p>Also look for rows, columns and boxes with only one empty cell left. The missing digit is forced: that is a ${g('full-house', 'full house')}.</p>
<h2>2. Write the candidates</h2>
<p>When scanning stops giving results, write down, in each empty cell, the digits that could still go there. These are the <em>candidates</em> or <em>pencil marks</em>. The app can show them for you. A cell with only one candidate left must take it: a ${g('naked-single', 'naked single')}. Cross out the digit you place from the candidates of every cell in its row, column and box, and look again.</p>
<h2>3. Pairs and locked candidates</h2>
<p>Now look at what the candidates tell you together. If two cells in a row hold only the same two candidates, those two digits belong to those cells, and nowhere else in that row can have them: a ${g('naked-subsets', 'naked pair')}. If a digit can only go in two cells of a unit, and another digit too, and no other digits fit there, you have a ${g('hidden-subsets', 'hidden pair')}. If, inside a box, a digit can only go in one row, then it cannot appear anywhere else in that row: ${g('locked-candidates', 'locked candidates')}. These steps remove candidates, and the removals often unlock new singles.</p>
<h2>4. Patterns across the grid</h2>
<p>Harder puzzles need a pattern that connects cells far apart. Learn them in this order, since each builds on the one before:</p>
<ul>
<li>${g('x-wing', 'X-Wing')} and ${g('swordfish', 'Swordfish')}: a digit confined to the same columns in two or three rows.</li>
<li>${g('skyscraper', 'Skyscraper')}, ${g('two-string-kite', 'Two-String Kite')} and ${g('empty-rectangle', 'Empty Rectangle')}: single-digit patterns made of two strong links.</li>
<li>${g('xy-wing', 'XY-Wing')}, ${g('xyz-wing', 'XYZ-Wing')} and ${g('w-wing', 'W-Wing')}: cells with two or three candidates that force a digit between them.</li>
<li>${g('simple-colors', 'Simple Colors')} and ${g('x-chain', 'X-Chains')}: following the links of a single digit.</li>
</ul>
<p>The <a href="../techniques/">technique index</a> lists all of them, with an example board for each.</p>
<h2>If you are stuck</h2>
<p>A puzzle that seems to offer nothing usually has a step you have not looked for yet, not a guess waiting to be made. Open the <a href="../play/">solver</a> and ask for a hint: it names the technique and shows the cells involved, and the guide for that technique explains why it works. Then try the next one yourself before asking again.</p>`,
  },
  {
    slug: 'sudoku-difficulty-levels',
    title: 'Sudoku difficulty levels',
    summary: 'What Easy, Medium, Hard, Unfair and Extreme mean, and what the number next to them is.',
    body: (techniques) => {
      const blurb = {
        Easy: 'Only singles are needed: a cell that is the last empty one in its unit, a cell with one candidate, or a digit with only one place in a unit.',
        Medium: 'Singles are not enough. You need to remove candidates with locked candidates and with naked and hidden pairs and triples.',
        Hard: 'Patterns that span the grid: fish, single-digit patterns, wings, coloring, uniqueness arguments and short chains.',
        Unfair: 'Long chains and loops, almost locked sets, and fish with fins. Some of these are laborious to find by eye.',
        Extreme: 'Techniques that try an assumption and follow its consequences: forcing chains and nets, Kraken fish and templates. Only a computer finds these comfortably.',
      };
      const lists = ['Easy', 'Medium', 'Hard', 'Unfair', 'Extreme']
        .map((lv) => {
          const names = techniques.filter((t) => t.level === lv);
          return `<h2>${lv}</h2><p>${blurb[lv]}</p><p class="note">Techniques at this level: ${names.map((t) => g(t.slug, t.name)).join(', ')}.</p>`;
        })
        .join('\n');
      return `
<p>Hodoku Revisited rates every puzzle the way the original HoDoKu does: it solves the puzzle with the easiest technique available at each step and records which techniques it had to use. The <strong>level</strong> reflects the hardest techniques the puzzle needs, so an Easy puzzle never requires anything beyond singles, while an Extreme one cannot be finished without a forcing technique.</p>
${lists}
<h2>The number next to the level</h2>
<p>Each technique carries a score, and the puzzle's <strong>score</strong> adds up the scores of all the steps on its solution path. Two puzzles of the same level can therefore differ: a long Hard puzzle can have a higher score than a short one. In the app the rating appears at the top as, for example, <em>Hard · 612</em>. A higher number means more or harder work.</p>
<h2>Choosing a level</h2>
<p>If you are new, start at Easy and move up when you finish a puzzle without hints. If you want practice on a particular technique, use the Learning and Practicing modes, which build puzzles around the techniques you pick. The hint setting <em>Hints use</em> caps how hard a hint may be, which is handy when you only want to be reminded of the simpler tricks.</p>
<p><a class="btn" href="../play/?level=1">Try an Easy puzzle</a> <a class="btn alt" href="../play/?level=3">Try a Hard one</a></p>`;
    },
  },
  {
    slug: 'sudoku-glossary',
    title: 'Sudoku glossary',
    summary: 'The words you meet in sudoku guides: unit, peer, candidate, strong link, fish and more.',
    body: () => `
<dl class="glossary">
<dt>Cell</dt><dd>One of the 81 squares of the grid.</dd>
<dt>Row, column, box</dt><dd>The three kinds of group that must each hold 1 to 9 once.</dd>
<dt>Unit</dt><dd>Any row, column or box.</dd>
<dt>Peers</dt><dd>The 20 other cells that share a row, column or box with a given cell. A digit placed in a cell is removed from all its peers.</dd>
<dt>Given (clue)</dt><dd>A digit printed in the puzzle at the start.</dd>
<dt>Candidate (pencil mark)</dt><dd>A digit that could still go in an empty cell.</dd>
<dt>Single</dt><dd>A digit that is forced in a cell. A <em>naked single</em> is the only candidate of its cell (${g('naked-single', 'guide')}); a <em>hidden single</em> is the only place for its digit in a unit (${g('hidden-single', 'guide')}).</dd>
<dt>Pair, triple, quad (subset)</dt><dd>Two, three or four cells in a unit that between them hold exactly that many candidates (${g('naked-subsets', 'naked')}), or digits that fit only that many cells (${g('hidden-subsets', 'hidden')}).</dd>
<dt>Locked candidates</dt><dd>A digit that, within a box, can only go in one line, or the reverse, so it can be removed from the rest of that line or box (${g('locked-candidates', 'guide')}).</dd>
<dt>Elimination</dt><dd>Removing a candidate because logic shows it cannot be right.</dd>
<dt>Strong link</dt><dd>Two places for a digit in a unit where it must go in one of them: exactly two candidates, so if one is false the other is true.</dd>
<dt>Weak link</dt><dd>Two places for a digit that see each other: they cannot both be true, but both can be false.</dd>
<dt>Fish</dt><dd>A family of patterns where a digit's candidates in a few rows line up in the same few columns (${g('x-wing', 'X-Wing')}, ${g('swordfish', 'Swordfish')}, and larger ones).</dd>
<dt>Fin</dt><dd>An extra candidate that spoils an otherwise perfect fish; a finned fish still allows eliminations (${g('finned-fish', 'guide')}).</dd>
<dt>Wing</dt><dd>A pattern of two or three cells with few candidates that force a common digit (${g('xy-wing', 'XY-Wing')}, ${g('xyz-wing', 'XYZ-Wing')}, ${g('w-wing', 'W-Wing')}).</dd>
<dt>Chain, loop</dt><dd>A sequence of strong and weak links that carries a conclusion from one candidate to another (${g('xy-chain', 'XY-Chain')}, ${g('x-chain', 'X-Chain')}, ${g('nice-loops', 'nice loops')}).</dd>
<dt>Almost locked set (ALS)</dt><dd>N cells in a unit with N+1 candidates between them; useful because removing one candidate turns it into a locked set (${g('als-xz', 'ALS-XZ')}).</dd>
<dt>Uniqueness</dt><dd>The rule that a proper puzzle has exactly one solution, used to rule out patterns that would give two (${g('unique-rectangle', 'Unique Rectangle')}).</dd>
<dt>Forcing chain, forcing net</dt><dd>Assume a candidate is true (or false), follow what must follow, and see what holds in every case (${g('forcing-chains', 'guide')}).</dd>
<dt>Backdoor</dt><dd>A small set of cells that, once solved, lets the puzzle finish with only singles.</dd>
</dl>
<p>How the app writes cells and steps is explained on the <a href="sudoku-notation.html">notation page</a>.</p>`,
  },
  {
    slug: 'sudoku-notation',
    title: 'Sudoku notation',
    summary: 'How cells, boxes, eliminations and pencil marks are written in guides and in the solver.',
    body: () => `
<h2>Cells and boxes</h2>
<p>Guides and the solver write a cell as <code>rXcY</code>: row X, column Y, both counted from 1. So <code>r1c6</code> is the first row, sixth column. A box is written <code>bN</code> (<code>b3</code> is the top right box). Rows are numbered top to bottom, columns left to right, boxes in the same reading order.</p>
<h2>Placing and removing digits</h2>
<p>Placing a digit is written with an equals sign: <code>r5c5=3</code>, a 3 in the center cell. Removing a candidate uses <code>&lt;&gt;</code>: <code>r1c6&lt;&gt;4</code> says that 4 is not a candidate of that cell. Several cells in a row of the notation (<code>r1c6, r2c6&lt;&gt;4</code>) mean the same removal in each. A hint in the solver reads, for example, <em>Locked Candidates Type 1 (Pointing): 4 in b3 ⇒ r1c6&lt;&gt;4</em>.</p>
<h2>Chains</h2>
<p>In chain notation, a strong link is shown with <code>=</code> and a weak link with <code>-</code>, so <code>4r1c1 = 4r1c7 - 5r1c7</code> reads: in row 1 the 4 goes in c1 or c7, and in cell r1c7 a 4 rules out a 5. The solver draws strong links as solid lines and weak links as dashed lines.</p>
<h2>Pencil marks</h2>
<p>On paper, candidates are written small in the cell. Writing every candidate in every cell is called <em>full notation</em>; it is thorough and cluttered. <em>Snyder notation</em> (the name varies by author) writes a digit in a box only where it fits in exactly two cells of that box: a short list that already shows where pairs and locked candidates are hiding.</p>
<p>In the app, <em>Notes</em> mode lets you write your own marks, in whatever style you like, and <em>Settings → Show candidates</em> shows all the candidates the solver keeps. Your marks and the solver's candidates are separate, so you can compare them.</p>
<h2>Writing a puzzle as text</h2>
<p>A puzzle is commonly written as 81 characters, row by row, with a dot or a zero for each empty cell. The app copies and opens that format, and several others; see the <a href="../manual/import-export-formats.html">manual</a>.</p>`,
  },
];

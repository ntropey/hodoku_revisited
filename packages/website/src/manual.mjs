/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * The manual: original text, written for this app (not taken from the HoDoKu manual, which is GFDL).
 * Keep it in step with the app: each chapter describes what the controls really do.
 * `body` is trusted HTML.
 */

export const MANUAL = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    summary: 'The screen, the first puzzle, and installing the app.',
    body: `
<p>Open <a href="../play/">the solver</a>. The first time, it deals you an Easy puzzle. Your game is saved in the browser after every move, so you can close the tab and continue later.</p>
<h2>The screen</h2>
<ul>
<li><strong>Top bar:</strong> <em>New puzzle</em> (pick a difficulty), <em>Import</em>, <em>Copy</em>, <em>Print</em>, the puzzle's difficulty and score, how many cells are filled, a timer, undo and redo, the command search, and <em>Settings</em>.</li>
<li><strong>Board:</strong> Givens are set in the serif face. Your own digits are blue. With <em>ColorKu</em> on (see <em>Settings</em>), digits and candidates are shown as coloured balls instead. <em>Cell zoom</em> (also under <em>Settings</em>) adds an enlarged view of the selected cell under the board.</li>
<li><strong>Digit pad</strong> below the board, with <em>Value</em>, <em>Notes</em>, <em>Filter</em> and <em>Colour</em> modes. The small number on each key is how many of that digit are still missing.</li>
<li><strong>Side panel</strong> with <em>Hint</em>, <em>All steps</em> and <em>Summary</em> tabs. On a phone this is a sheet at the bottom that you drag up and down.</li>
</ul>
<h2>Your first moves</h2>
<ol>
<li>Tap a cell, then a digit on the pad (or press 1 to 9 on a keyboard).</li>
<li>Stuck? Choose <em>Get a hint</em> (or press <kbd>H</kbd>). The panel names the next step and the board shows the cells involved. <em>Apply step</em> carries it out.</li>
<li>Use <em>Undo</em> (<kbd>Z</kbd>) if you change your mind.</li>
</ol>
<h2>Install and offline use</h2>
<p>Use your browser's <em>Install</em> or <em>Add to Home Screen</em> command. After the first visit the app works without a network connection.</p>`,
  },
  {
    slug: 'entering-puzzles',
    title: 'Entering puzzles',
    summary: 'Import a puzzle from a newspaper, a website or a file.',
    body: `
<p>Choose <em>Import</em> and paste the puzzle as text. The app works out the format by itself. It accepts:</p>
<ul>
<li>81 characters in one line, with <code>.</code> or <code>0</code> for an empty cell. A trailing <code># comment</code> is ignored.</li>
<li>Nine lines of nine characters, with or without grid borders (<code>|</code>, <code>-</code>, <code>+</code>).</li>
<li>A candidate grid (the digits that are still possible in each cell).</li>
<li>Exports of SimpleSudoku.</li>
<li>HoDoKu's library lines (<code>:0000:x:...</code>), and the puzzle field of the q2 taxonomy lines.</li>
</ul>
<p>Anything with fewer or more than 81 cells is rejected with a message. The puzzle also has to have exactly one solution; if it has none or several, the app says so and does not load it.</p>
<h2>Sharing a puzzle</h2>
<p><em>Copy</em> puts the 81-character line of the givens on the clipboard. Paste it anywhere, or into <em>Import</em> on another device. A link of the form <code>/play/?p=&lt;81 characters&gt;</code> opens that puzzle directly. The technique guides use this for their <em>Open in app</em> buttons.</p>
<h2>Printing</h2>
<p><em>Print</em> prints the board with the givens only, without candidates or the side panel.</p>`,
  },
  {
    slug: 'candidates-and-filters',
    title: 'Candidates and filters',
    summary: 'Notes, automatic candidates and the digit filter.',
    body: `
<h2>Notes (pencil marks)</h2>
<p>Switch the pad to <em>Notes</em> (or press <kbd>N</kbd>), select a cell and tap digits to write small pencil marks in it. Tap a digit again to remove it. <em>Erase</em> clears the marks of that cell. The marks are yours: type as many or as few as you like, for example only the digits of a Snyder notation. They stay visible without turning anything else on, and they are saved with the game and covered by undo.</p>
<p>Marks are drawn in a fixed 3 by 3 pattern, so a digit always sits in the same place within the cell. When you place a value, that digit is removed from the pencil marks of its row, column and box.</p>
<p><em>Settings → Clear pencil marks</em> wipes all your marks, so you can start a fresh set.</p>
<h2>Show candidates</h2>
<p><em>Settings → Show candidates</em> displays the candidates the solver keeps for every empty cell: all digits that no peer in the row, column or box already has. This replaces your pencil marks on screen while it is on, and Notes mode then edits those candidates instead, so you can remove the ones you have ruled out. <em>Settings → Reset candidates</em> restores them to everything the placed values allow. Hints work from these candidates, not from your pencil marks.</p>
<h2>The digit filter</h2>
<p>With the pad in <em>Filter</em> mode (<kbd>F</kbd>), tapping a digit highlights every cell that holds it or still has it as a candidate, and shows only that digit in those cells. Switching back to Value or Notes turns the filter off. It is the fastest way to see where a digit can go in each row, column and box. Tap the same digit again to clear the filter.</p>
<p>Shortcuts: <kbd>Alt</kbd>+<kbd>1</kbd> to <kbd>9</kbd> toggles the filter from the keyboard; on a touch screen, press and hold a digit key for half a second.</p>
<h2>Mark mistakes</h2>
<p>With <em>Settings → Mark mistakes</em> on, a value that disagrees with the puzzle's solution is shown in red. It is off by default, because finding the error is often part of the puzzle.</p>`,
  },
  {
    slug: 'colour',
    title: 'Colour on the board',
    summary: 'Paint cells and candidates with your own palette.',
    body: `
<p>The pad has a fourth mode, <em>Colour</em> (<kbd>C</kbd>). It is for marking the board up yourself, to keep track of a chain or a pattern you are working on by hand. It is separate from the colours a hint draws, which you cannot change.</p>
<h2>Painting</h2>
<ul>
<li>Pick a colour from the palette, then choose whether you are painting <em>Cells</em> or <em>Candidates</em>.</li>
<li>With <em>Cells</em>, tap a cell to give it the colour. Choose the <em>×</em> swatch (no colour) to clear a cell, or select it and press <kbd>0</kbd> or <kbd>Backspace</kbd>.</li>
<li>With <em>Candidates</em>, the candidates are shown in every empty cell; tap one to colour that candidate only.</li>
<li>The digit keys <kbd>1</kbd> to <kbd>6</kbd> pick a palette colour from the keyboard, and <kbd>0</kbd> selects the eraser.</li>
</ul>
<p>Your colours are saved with the game and covered by undo, and <em>Clear colours</em> wipes them all in one step.</p>`,
  },
  {
    slug: 'your-puzzles',
    title: 'Your puzzles',
    summary: 'The library, the history, and named save points.',
    body: `
<p>The <em>Puzzles</em> button in the top bar opens three lists of your own puzzles. All of them live in this browser only; nothing is sent anywhere.</p>
<h2>Library</h2>
<p>Type a name and choose <em>Save current</em> to keep the puzzle you are playing. Each entry shows its name and the date you saved it, with <em>Open</em> to load it again and <em>Delete</em> to remove it. Only the puzzle itself is stored: opening it rates it again and starts a fresh game, so the timer and your notes start empty.</p>
<h2>History</h2>
<p>Every puzzle you start is listed here, newest first, with its difficulty, score and the time you spent on it. A tick marks the puzzles you finished. <em>Open</em> plays one again and <em>Delete</em> removes a single entry; <em>Clear history</em> empties the list. The list is capped, so the oldest entries drop off by themselves.</p>
<h2>Save points</h2>
<p>A save point is a named snapshot of the game <em>as it is now</em>: the values, your pencil marks and your colours at the moment you saved it. Choose <em>Save current position</em> to make one, then <em>Restore</em> to return to it later. Restoring does not cross the undo history, so <em>Undo</em> stays on the restored position. Unlike the autosave, which always follows your latest move, a save point stays where you left it.</p>`,
  },
  {
    slug: 'hints',
    title: 'Hints',
    summary: 'What a hint shows, and how much it may give away.',
    body: `
<p>A hint is always a real technique, found the way the original HoDoKu finds it: the solver tries the techniques from easiest to hardest and reports the first step it finds.</p>
<h2>Reading a hint</h2>
<ul>
<li>The <strong>name</strong> and a one-line explanation of the technique, with a link to its guide.</li>
<li>A <strong>summary</strong> of the step, for example <code>1 goes in r1c2</code>. Cells are written <code>rXcY</code>: row X, column Y.</li>
<li>On the board, a legend in the panel explains the colours: <em>key</em> candidates (the pattern), <em>cover</em> candidates, <em>fins</em>, candidates that are <em>removed</em> (red, struck through) and values that are <em>placed</em> (green).</li>
<li>For chains and loops, lines join the candidates: solid for strong links, dashed for weak links.</li>
</ul>
<p><em>Apply step</em> (<kbd>Enter</kbd>) places the value or removes the candidates. <em>Dismiss</em> (<kbd>Esc</kbd>) hides the hint. <em>Next hint</em> asks for another step from the current position.</p>
<h2>Hints use</h2>
<p>This setting limits how hard a hint may be: <em>Singles only</em>, <em>Up to Easy</em>, Medium, Hard, Unfair, or <em>Everything</em>. A puzzle that needs more than the limit allows gets the answer that no such step exists, which is a useful result in itself.</p>
<p>Individual techniques can be switched off as well, under <em>Settings → Techniques a hint may use</em>. The level is the upper cap; unticking a technique narrows it further, so a hint never uses a technique you would rather spot yourself. With every technique ticked (the default) nothing changes.</p>
<h2>All steps</h2>
<p>The <em>All steps</em> tab lists every step available right now, grouped by technique with counts. Select the steps you want and choose <em>Apply selected</em>, or <em>Refresh</em> after you have changed the board. The <em>Path</em> tab goes further and walks the solver's whole route from here (see <a href="solution-path.html">Solution path</a>).</p>`,
  },
  {
    slug: 'analyzer',
    title: 'Analyzer',
    summary: 'The difficulty rating and which techniques a puzzle needs.',
    body: `
<p>Every puzzle you load, generate or import is solved once by the same engine, with the techniques ranked as in HoDoKu. The result is shown in the top bar (for example <em>Hard · 612</em>) and in the <em>Summary</em> tab.</p>
<h2>Level and score</h2>
<p>The <strong>level</strong> is the hardest class of technique the puzzle needs: Easy, Medium, Hard, Unfair or Extreme. The <strong>score</strong> adds up a points value for every step of the solution path, so two puzzles on the same level can still differ in how long and how awkward the path is.</p>
<h2>Techniques used</h2>
<p>The Summary tab lists the techniques on the solution path, with how often each one is used, hardest first. Each name links to its guide. The hardest technique is tagged.</p>
<p>Paste any puzzle into <em>Import</em> to see its rating before you start. Nothing is sent anywhere: the analysis runs in your browser.</p>`,
  },
  {
    slug: 'solution-path',
    title: 'Solution path',
    summary: "Walk the solver's own way through the puzzle, one step at a time.",
    body: `
<p>The <em>Path</em> tab lists the steps the solver would take from where you are now to the solution, in order, one row per step: the technique, what it does and how hard it is.</p>
<h2>Stepping through</h2>
<ul>
<li><em>Next step</em> applies the first remaining step to the board, and counts as a hint. The board shows the step (its cells and candidates) before you apply it.</li>
<li><em>Solve up to</em> applies every step up to a chosen difficulty in one go — pick <em>Up to Medium</em>, for example, and it stops before the first step that is harder.</li>
</ul>
<p>The path uses every technique the solver knows, so it is the solver's route and not the one you might take. That makes it useful both for watching how a hard puzzle falls and for practising: solve up to a level and finish the harder part yourself.</p>`,
  },
  {
    slug: 'generator-and-levels',
    title: 'Generator and levels',
    summary: 'Where new puzzles come from and what the levels mean.',
    body: `
<p><em>New puzzle</em> offers five levels. Each puzzle has exactly one solution and is rated by the analyzer, so its level is the real level of the hardest step it needs.</p>
<table>
<thead><tr><th>Level</th><th>What you need</th></tr></thead>
<tbody>
<tr><td>Easy</td><td>Full house, naked and hidden singles</td></tr>
<tr><td>Medium</td><td>Locked candidates and subsets</td></tr>
<tr><td>Hard</td><td>Basic fish, single-digit patterns, wings, coloring, uniqueness, simple chains</td></tr>
<tr><td>Unfair</td><td>Longer chains and loops, almost locked sets, finned and complex fish</td></tr>
<tr><td>Extreme</td><td>Forcing chains and nets, Kraken fish, templates</td></tr>
</tbody>
</table>
<p>Puzzles come from a library that was generated and verified ahead of time, so a new puzzle appears instantly even on a slow phone. The app remembers which ones you have played and avoids repeats until the level is used up. Each puzzle in the library is checked for a unique solution and filed under the level the engine rates it.</p>
<p>The default level for <em>New puzzle</em> can be set in <em>Settings</em>.</p>`,
  },
  {
    slug: 'import-export-formats',
    title: 'Import and export formats',
    summary: 'The text formats the app reads and writes.',
    body: `
<p>The app's engine understands the text formats of the original HoDoKu. <em>Copy</em> always writes the one-line form. All of these can be pasted into <em>Import</em>.</p>
<table>
<thead><tr><th>Format</th><th>Example</th></tr></thead>
<tbody>
<tr><td>One line, 81 characters</td><td><code>..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..</code></td></tr>
<tr><td>Nine lines</td><td><code>..3|.2.|6..</code> and so on, with or without borders</td></tr>
<tr><td>Candidate grid</td><td>The remaining digits of every cell, in a grid</td></tr>
<tr><td>HoDoKu library</td><td><code>:0000:x:givens:...</code></td></tr>
</tbody>
</table>
<p>Digits stand for givens; <code>.</code> and <code>0</code> are empty. Whitespace and the usual border characters are ignored.</p>`,
  },
  {
    slug: 'keyboard-shortcuts',
    title: 'Keyboard shortcuts',
    summary: 'Everything you can do without the mouse.',
    body: `
<p>Open the command search with <kbd>Ctrl</kbd>+<kbd>K</kbd> (<kbd>⌘</kbd>+<kbd>K</kbd> on a Mac) to find any action by typing its name.</p>
<table>
<thead><tr><th>Keys</th><th>Action</th></tr></thead>
<tbody>
<tr><td><kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd></td><td>Move the selection</td></tr>
<tr><td><kbd>1</kbd> to <kbd>9</kbd></td><td>Enter a digit (or toggle a note in Notes mode)</td></tr>
<tr><td><kbd>Backspace</kbd>, <kbd>Delete</kbd>, <kbd>0</kbd></td><td>Erase the selected cell</td></tr>
<tr><td><kbd>N</kbd></td><td>Switch between Value and Notes</td></tr>
<tr><td><kbd>F</kbd></td><td>Switch between Value and Filter</td></tr>
<tr><td><kbd>C</kbd></td><td>Switch between Value and Colour</td></tr>
<tr><td><kbd>Alt</kbd>+<kbd>1</kbd> to <kbd>9</kbd></td><td>Filter on that digit (again to clear)</td></tr>
<tr><td><kbd>H</kbd></td><td>Get a hint</td></tr>
<tr><td><kbd>Enter</kbd></td><td>Apply the hint that is showing</td></tr>
<tr><td><kbd>Esc</kbd></td><td>Dismiss the hint, close a dialog</td></tr>
<tr><td><kbd>Z</kbd></td><td>Undo</td></tr>
<tr><td><kbd>Y</kbd></td><td>Redo</td></tr>
<tr><td><kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd></td><td>Command search</td></tr>
</tbody>
</table>`,
  },
  {
    slug: 'settings',
    title: 'Settings',
    summary: 'Every option and what it does.',
    body: `
<p>Choose <em>Settings</em> in the top bar. Changes take effect at once and are remembered in this browser.</p>
<dl>
<dt>Show candidates</dt><dd>Display the computed candidates in every empty cell.</dd>
<dt>Mark mistakes</dt><dd>Show values that disagree with the solution in red.</dd>
<dt>ColorKu</dt><dd>Draw placed digits and candidates as coloured balls instead of numerals, as in the original. The nine colours can be changed, and the default set restored, in the same dialog.</dd>
<dt>Cell zoom</dt><dd>Show an enlarged view of the selected cell under the board, with its value or its candidates; handy on small screens.</dd>
<dt>Auto-fill last digit</dt><dd>Off by default. When a row, column or box is down to one empty cell, that cell is filled in for you after your move. It counts as a normal, undoable move, not as a hint.</dd>
<dt>Hints use</dt><dd>The hardest class of technique a hint may use. Also available in the side panel.</dd>
<dt>Techniques a hint may use</dt><dd>The individual techniques a hint is allowed to use, grouped by difficulty. Untick any you would rather solve yourself; the choice is remembered. <em>Hints use</em> still caps them from above, and <em>Enable all techniques</em> puts everything back.</dd>
<dt>New puzzle level</dt><dd>The difficulty used by the plain <em>New puzzle</em> button.</dd>
<dt>Theme</dt><dd>Follow the system, or force light or dark.</dd>
<dt>Clear pencil marks</dt><dd>Remove all the notes you wrote.</dd>\n<dt>Reset candidates</dt><dd>Restore the solver's candidates to everything the placed values allow.</dd>
<dt>About and license</dt><dd>Where the project comes from, and the GPL text.</dd>
</dl>
<p>All data stays on your device. See <a href="../privacy.html">Privacy</a>.</p>`,
  },
];

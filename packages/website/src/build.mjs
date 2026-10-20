/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Static site generator: no dependencies. Run `pnpm --filter @hodoku/app build` first to include the app under /play/.
 * Set SITE_URL (e.g. https://example.org/) to also write sitemap.xml and robots.txt.
 * Set SITE_PASSWORD to put a temporary password gate on every page (see gate.mjs); no sitemap is written then.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADSENSE_CLIENT, applyConsent } from './consent.mjs';
import { caption, diagram, legend } from './diagram.mjs';
import { applyGate } from './gate.mjs';
import { LEARN } from './learn.mjs';
import { MANUAL } from './manual.mjs';
import { TECHNIQUES } from './techniques.mjs';

const examples = existsSync(new URL('./examples.json', import.meta.url))
  ? JSON.parse(readFileSync(new URL('./examples.json', import.meta.url), 'utf8'))
  : [];

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'dist');
const appDist = join(here, '..', '..', 'app', 'dist');
const siteUrl = (process.env.SITE_URL ?? '').replace(/\/?$/, '/');
const REPO = 'https://github.com/ntropey/hodoku_revisited';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const GROUPS = [
  ['Singles', ['full-house', 'naked-single', 'hidden-single']],
  ['Intersections', ['locked-candidates']],
  ['Subsets', ['naked-subsets', 'hidden-subsets']],
  ['Basic Fish', ['x-wing', 'swordfish']],
  ['Single Digit Patterns', ['skyscraper', 'two-string-kite', 'empty-rectangle', 'turbot-fish']],
  ['Uniqueness', ['unique-rectangle', 'rectangles-bug']],
  ['Wings', ['xy-wing', 'xyz-wing', 'w-wing']],
  ['Coloring', ['simple-colors', 'multi-colors']],
  ['Chains and Loops', ['xy-chain', 'x-chain', 'nice-loops', 'forcing-chains']],
  ['Almost Locked Sets', ['als-xz', 'als-xy-wing', 'als-chain', 'death-blossom']],
  ['Finned & Complex Fish', ['finned-fish', 'franken-mutant-fish', 'kraken-fish']],
  ['Miscellaneous', ['sue-de-coq']],
  ['Last Resort', ['templates']],
].map(([name, slugs], i) => ({ name, num: String(i + 1).padStart(2, '0'), items: slugs.map((s) => TECHNIQUES.find((t) => t.slug === s)) }));
for (const g of GROUPS) for (const t of g.items) if (!t) throw new Error('unknown technique in group ' + g.name);
const ORDERED = GROUPS.flatMap((g) => g.items);
if (ORDERED.length !== TECHNIQUES.length) throw new Error('every technique needs a group');
const groupOf = (t) => GROUPS.find((g) => g.items.includes(t));

const LOGO = (root) => `<a class="brand" href="${root}"><img src="${root}icon.svg" alt="" width="32" height="32"><span class="wordmark">Hodoku<small>Revisited</small></span></a>`;

/** `root` is the path back to the site root from the page, e.g. '../' */
function page({ title, description, root, body, path, wide, jsonld }) {
  const canonical = siteUrl && path ? `<link rel="canonical" href="${siteUrl}${path}">` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Hodoku Revisited">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${siteUrl ? `<meta property="og:url" content="${siteUrl}${path ?? ''}">\n<meta property="og:image" content="${siteUrl}icon-512.png">` : ''}
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#F5F2EA" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#15171B" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${root}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${root}apple-touch-icon.png">
<link rel="preload" href="${root}fonts/newsreader-latin-500-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${root}site.css">
${canonical}
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<header class="top">
  ${LOGO(root)}
  <nav aria-label="Main">
    <a href="${root}learn/">Learn</a>
    <a href="${root}techniques/">Techniques</a>
    <a href="${root}manual/">Manual</a>
    <a href="${root}about.html">About</a>
    <a href="${REPO}">GitHub</a>
    <a class="btn small" href="${root}play/">Open solver</a>
  </nav>
</header>
<main${wide ? ' class="wide"' : ''}>
${body}
</main>
<footer>
  <p>Free sudoku solver, based on HoDoKu by Bernhard Hobiger. Free software under the GPL (GPL-3.0-or-later), with no warranty.</p>
  <p><a href="${REPO}">GitHub</a> · <a href="${REPO}/commits/main">Changelog</a> · <a href="https://hodoku.sourceforge.net/">Original site</a> · <a href="${root}about.html">About and license</a> · <a href="${root}privacy.html">Privacy</a></p>
</footer>
</body>
</html>
`;
}

/** index rail for the technique pages; the group of the current page is open. On small screens it is a select. */
function rail(root, current) {
  const cur = current && groupOf(current);
  return `<aside class="rail">
<label class="railselect"><span>Technique</span><select onchange="location.href=this.value" aria-label="Jump to a technique">
<option value="${root}techniques/">All techniques</option>
${GROUPS.map((g) => `<optgroup label="${esc(g.name)}">${g.items.map((t) => `<option value="${root}techniques/${t.slug}.html"${t === current ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</optgroup>`).join('\n')}
</select></label>
<nav class="railnav" aria-label="Techniques"><h2><a href="${root}techniques/">Techniques</a></h2>
${GROUPS.map(
  (g) => `<details${g === cur ? ' open' : ''}><summary>${esc(g.name)} <span>${g.num}</span></summary>
<ul>${g.items.map((t) => `<li><a href="${root}techniques/${t.slug}.html"${t === current ? ' aria-current="page"' : ''}>${esc(t.name)}</a></li>`).join('')}</ul></details>`,
).join('\n')}
</nav>
</aside>`;
}

const puzzleOf = (e) => e.values.map((v) => (v ? String(v) : '.')).join('');

const pages = []; // [path, content]
const add = (path, content) => pages.push([path, content]);

// ---- home
const homeEx = examples.find((e) => e.slug === 'locked-candidates');
const coachPuzzle = '.....1.......3597.7..4...23..7.1..6....57...8.28...7..9........6.2....91.4...738.';
const coachCands = new Array(81).fill(0);
coachCands[0] = (1 << 2) | (1 << 3) | (1 << 4) | (1 << 5) | (1 << 8);
coachCands[7] = (1 << 4) | (1 << 5);
coachCands[8] = (1 << 4) | (1 << 5) | (1 << 6);
coachCands[17] = (1 << 4) | (1 << 6);
coachCands[58] = (1 << 2) | (1 << 4) | (1 << 5) | (1 << 6) | (1 << 8);
coachCands[59] = (1 << 2) | (1 << 3) | (1 << 4) | (1 << 6) | (1 << 8);
coachCands[64] = (1 << 3) | (1 << 5) | (1 << 7) | (1 << 8);
coachCands[66] = (1 << 3) | (1 << 8);
coachCands[68] = (1 << 3) | (1 << 4) | (1 << 8);
const coachEx = {
  name: 'AI Coach · Why not 4 in r1c9?',
  type: 'CONTRADICTION_PROOF',
  values: [...coachPuzzle].map((c) => (c === '.' ? 0 : Number(c))),
  cands: coachCands,
  place: [],
  key: [
    { cell: 8, digit: 4 },
    { cell: 7, digit: 5 },
    { cell: 17, digit: 6 },
    { cell: 0, digit: 2 },
    { cell: 58, digit: 2 },
    { cell: 59, digit: 3 },
  ],
  fins: [],
  colors: [],
  elim: [
    { cell: 64, digit: 3 },
    { cell: 66, digit: 3 },
    { cell: 68, digit: 3 },
  ],
  tint: [
    { cells: [8], tone: 'a' },
    { cells: [63, 64, 65, 66, 67, 68, 69, 70, 71], tone: 'b' },
  ],
  chains: [
    [
      { cell: 8, digit: 4, strong: false },
      { cell: 7, digit: 5, strong: true },
    ],
    [
      { cell: 8, digit: 4, strong: false },
      { cell: 17, digit: 6, strong: true },
    ],
    [
      { cell: 58, digit: 2, strong: false },
      { cell: 59, digit: 3, strong: true },
      { cell: 68, digit: 3, strong: false },
    ],
    [
      { cell: 59, digit: 3, strong: true },
      { cell: 66, digit: 3, strong: false },
    ],
  ],
};
add(
  'index.html',
  page({
    title: 'Hodoku Revisited: the sudoku solver that explains every step',
    description: 'Free sudoku solver and trainer in your browser, now with an AI Super Solver & Coach: progressive Socratic nudges, step-by-step walkthroughs, contradiction proofs, analyzer and technique library.',
    root: '',
    path: '',
    wide: true,
    jsonld: siteUrl
      ? {
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'Hodoku Revisited',
          alternateName: 'Hodoku Revisited sudoku solver',
          url: siteUrl,
          applicationCategory: 'GameApplication',
          operatingSystem: 'Any (web browser)',
          description: 'Free sudoku solver and trainer with AI Coach step-by-step logical hints, contradiction proofs, difficulty rating and technique guides.',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        }
      : undefined,
    body: `<section class="hero">
  <div>
    <p class="eyebrow">The HoDoKu sudoku solver, now with AI Super Solver &amp; Coach</p>
    <h1>Every sudoku step,<br>explained.</h1>
    <p class="lead">A free sudoku solver and trainer: the hint engine, analyzer and technique library from HoDoKu, rebuilt in TypeScript with an interactive AI Coach. No Java and no install. Get progressive nudges, step through every deduction on the board, or ask why any candidate fails.</p>
    <p><a class="btn" href="play/">Open the solver</a> <a class="btn alt" href="techniques/">Browse techniques</a></p>
    <p class="gen"><span>Generate:</span> ${['Easy', 'Medium', 'Hard', 'Unfair', 'Extreme'].map((l, i) => `<a class="chip" href="play/?level=${i + 1}">${l}</a>`).join(' ')}</p>
  </div>
  ${homeEx ? `<figure class="example hero-board">${diagram(homeEx)}<figcaption><span class="mono">${esc(homeEx.name)}</span> · ${esc(caption(homeEx).replace(/^[^:]*: /, ''))}</figcaption></figure>` : ''}
</section>
<section class="spotlight">
  <div>
    <p class="eyebrow">New · AI Super Solver &amp; Coach</p>
    <h2>Ask “Why not?” on any cell—and watch the proof unfold.</h2>
    <p class="lead">Stuck between two candidates? Select any cell and ask the AI Coach <strong>“Why not 4?”</strong> It tests your hypothesis, traces the forced singles that ripple across the board, and highlights the exact contradiction.</p>
    <div class="coach-quote">
      <div class="mono"><strong>1. Assume</strong> → <strong>2. Forced moves</strong> → <strong>3. Contradiction</strong></div>
      <p>“Suppose we place 4 in r1c9. That forces 5 into r1c8 and 6 into r2c9… leaving Row 8 with no valid cell where digit 3 can go. Therefore, r1c9 cannot be 4.”</p>
    </div>
    <p>Prefer not to spoil a hint? Click <strong>Coach me</strong> for progressive four-stage Socratic nudges—starting with <em>where to look</em> before revealing the pattern or the move.</p>
    <p><a class="btn" href="play/?p=${coachPuzzle}">Try the AI Coach on this board →</a></p>
  </div>
  <figure class="example hero-board">
    ${diagram(coachEx)}
    <figcaption><span class="mono">AI Coach · Contradiction proof</span> · Assuming 4 in r1c9 eliminates every 3 in Row 8 (r8c2, r8c4, r8c6).</figcaption>
  </figure>
</section>
<section class="cards">
  <article><p class="eyebrow">AI Super Solver</p><h2>Nudges, walkthroughs &amp; “Why not?”</h2><p>Let the AI Coach guide you in four stages—from where to look to the final move—or tap any cell candidate to watch the chain of forced moves that proves a contradiction.</p></article>
  <article><p class="eyebrow">Hints</p><h2>Vague, concrete or the full step</h2><p>You choose how much a sudoku hint gives away. Start with a Socratic nudge, name the technique, or highlight every candidate involved.</p></article>
  <article><p class="eyebrow">Analyzer</p><h2>See the whole solution path</h2><p>Get the techniques the solver would use and the hardest one required, plus a difficulty rating for any sudoku puzzle you paste in.</p></article>
  <article><p class="eyebrow">Library</p><h2>From singles to last resort</h2><p>${TECHNIQUES.length} technique guides, written new. Every example is a board you can step through and open in the app.</p></article>
</section>
<section class="learnhome"><p class="eyebrow">New to sudoku?</p><p>Read <a href="learn/how-to-solve-sudoku.html">how to solve sudoku</a> step by step, see <a href="learn/sudoku-difficulty-levels.html">what the difficulty levels mean</a>, or look up a word in the <a href="learn/sudoku-glossary.html">glossary</a>.</p></section>
<section class="trust">
  <p>This sudoku solver finds the same steps as HoDoKu 2.2.0 (we compare them step by step), so a hint is always a real technique, never a guess. It runs entirely in your browser and works offline once installed.</p>
</section>`,
  }),
);

// ---- technique index
add(
  'techniques/index.html',
  page({
    title: 'Sudoku solving techniques explained | Hodoku Revisited',
    description: 'Guides to the sudoku techniques the solver uses, from Naked Singles to X-Wings, chains and forcing nets.',
    root: '../',
    path: 'techniques/',
    wide: true,
    body: `<div class="with-rail">
${rail('../', null)}
<div class="content">
<h1>Techniques</h1>
<p class="lead">Each guide explains one technique in plain words. Cells are written rXcY: row X, column Y. The in-app hint tells you which technique it used, so you can come here to read about it.</p>
${GROUPS.map(
  (g) => `<section class="group"><h2><span class="num">${g.num}</span> ${esc(g.name)}</h2>
<div class="tgrid">
${g.items.map((t) => `<a class="tcard" href="${t.slug}.html"><span class="band lv-${t.level.toLowerCase()}">${t.level}</span><strong>${esc(t.name)}</strong><span>${esc(t.summary)}</span></a>`).join('\n')}
</div></section>`,
).join('\n')}
</div></div>`,
  }),
);

// ---- technique pages
const STEP_SCRIPT = `<script>document.querySelectorAll('figure.example').forEach(function(f){var b=f.querySelectorAll('.steps button');b.forEach(function(x){x.addEventListener('click',function(){f.setAttribute('data-step',x.dataset.step);b.forEach(function(y){y.setAttribute('aria-pressed',String(y===x))})})})})</script>`;
ORDERED.forEach((t, i) => {
  const prev = ORDERED[i - 1];
  const next = ORDERED[i + 1];
  const g = groupOf(t);
  const exs = examples.filter((e) => e.slug === t.slug);
  add(
    `techniques/${t.slug}.html`,
    page({
      title: `${t.name}: sudoku technique | Hodoku Revisited`,
      description: `${t.name} sudoku technique: ${t.summary}`,
      root: '../',
      path: `techniques/${t.slug}.html`,
      wide: true,
      body: `<div class="with-rail">
${rail('../', t)}
<article class="content guide">
<p class="crumbs"><a href="./">Techniques</a> / ${esc(g.name)}</p>
<h1>${esc(t.name)}</h1>
<p class="meta"><span class="band lv-${t.level.toLowerCase()}">${t.level}</span></p>
<p class="lead">${esc(t.summary)}</p>
<div class="guide-cols">
<div class="prose">
${t.body.map((p) => `<p>${esc(p)}</p>`).join('\n')}
${t.tip ? `<p class="tip"><strong>Tip:</strong> ${esc(t.tip)}</p>` : ''}
${exs[0] ? `<h2>Notation</h2><p class="notation mono">${esc(exs[0].name)}: ${esc(caption(exs[0]).replace(/^[^:]*: /, ''))}</p>` : ''}
</div>
<div class="examples${exs.length === 1 ? ' sticky' : ''}">
${exs
  .map(
    (e) => `<figure class="example" data-step="before">
<div class="steps" role="group" aria-label="Show the board"><button type="button" data-step="before" aria-pressed="true">← Before</button><button type="button" data-step="after" aria-pressed="false">After →</button></div>
${diagram(e)}
<figcaption>${esc(caption(e))}${legend(e)}<a class="btn small" href="../play/?p=${puzzleOf(e)}">Open in app</a></figcaption>
</figure>`,
  )
  .join('\n')}
${exs.length ? '' : `<p><a class="btn" href="../play/">Practice in the app</a></p>`}
</div>
</div>
<nav class="pager">
${prev ? `<a href="${prev.slug}.html"><small>Previous</small>← ${esc(prev.name)}</a>` : '<span></span>'}
${next ? `<a href="${next.slug}.html"><small>Next</small>${esc(next.name)} →</a>` : '<span></span>'}
</nav>
</article></div>
${exs.length ? STEP_SCRIPT : ''}`,
    }),
  );
});

// ---- learn
const learnRail = (current) => `<aside class="rail"><label class="railselect"><span>Page</span><select onchange="location.href=this.value" aria-label="Jump to a page">${LEARN.map((c) => `<option value="${c.slug}.html"${c === current ? ' selected' : ''}>${esc(c.title)}</option>`).join('')}</select></label>
<nav class="railnav" aria-label="Learn"><h2><a href="./">Learn</a></h2><ul class="flat">${LEARN.map((c) => `<li><a href="${c.slug}.html"${c === current ? ' aria-current="page"' : ''}>${esc(c.title)}</a></li>`).join('')}</ul></nav></aside>`;
add(
  'learn/index.html',
  page({
    title: 'Learn sudoku: how to solve, difficulty levels, glossary and notation',
    description: 'Learn how to solve sudoku step by step, what the difficulty levels mean, and the words and notation used in sudoku guides.',
    root: '../',
    path: 'learn/',
    wide: true,
    body: `<div class="with-rail">${learnRail(null)}<div class="content"><h1>Learn sudoku</h1>
<p class="lead">Start here if you are new, or if a guide uses a word you do not know.</p>
<div class="tgrid">${LEARN.map((c, i) => `<a class="tcard" href="${c.slug}.html"><span class="band">${String(i + 1).padStart(2, '0')}</span><strong>${esc(c.title)}</strong><span>${esc(c.summary)}</span></a>`).join('\n')}</div>
<p>When you are ready for the techniques themselves, see the <a href="../techniques/">technique guides</a>, or <a href="../play/">open the solver</a> and ask it for a hint.</p></div></div>`,
  }),
);
LEARN.forEach((c, i) => {
  const prev = LEARN[i - 1];
  const next = LEARN[i + 1];
  add(
    `learn/${c.slug}.html`,
    page({
      title: `${c.title}: sudoku help | Hodoku Revisited`,
      description: c.summary,
      root: '../',
      path: `learn/${c.slug}.html`,
      wide: true,
      body: `<div class="with-rail">${learnRail(c)}<article class="content guide"><p class="crumbs"><a href="./">Learn</a></p><h1>${esc(c.title)}</h1><p class="lead">${esc(c.summary)}</p><div class="prose">${c.body(TECHNIQUES)}</div>
<nav class="pager">${prev ? `<a href="${prev.slug}.html"><small>Previous</small>← ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a href="${next.slug}.html"><small>Next</small>${esc(next.title)} →</a>` : '<span></span>'}</nav></article></div>`,
    }),
  );
});

// ---- manual
const manualRail = (current) => `<aside class="rail"><label class="railselect"><span>Chapter</span><select onchange="location.href=this.value" aria-label="Jump to a chapter">${MANUAL.map((c) => `<option value="${c.slug}.html"${c === current ? ' selected' : ''}>${esc(c.title)}</option>`).join('')}</select></label>
<nav class="railnav" aria-label="Manual"><h2><a href="./">Manual</a></h2><ul class="flat">${MANUAL.map((c) => `<li><a href="${c.slug}.html"${c === current ? ' aria-current="page"' : ''}>${esc(c.title)}</a></li>`).join('')}</ul></nav></aside>`;
add(
  'manual/index.html',
  page({
    title: 'Manual: how to use the sudoku solver | Hodoku Revisited',
    description: 'How to use the Hodoku Revisited sudoku solver: hints, candidates, filters, importing puzzles, shortcuts and settings.',
    root: '../',
    path: 'manual/',
    wide: true,
    body: `<div class="with-rail">${manualRail(null)}<div class="content"><h1>Manual</h1>
<p class="lead">How to use the solver, one chapter at a time.</p>
<div class="tgrid">${MANUAL.map((c, i) => `<a class="tcard" href="${c.slug}.html"><span class="band">${String(i + 1).padStart(2, '0')}</span><strong>${esc(c.title)}</strong><span>${esc(c.summary)}</span></a>`).join('\n')}</div></div></div>`,
  }),
);
MANUAL.forEach((c, i) => {
  const prev = MANUAL[i - 1];
  const next = MANUAL[i + 1];
  add(
    `manual/${c.slug}.html`,
    page({
      title: `${c.title} | Sudoku solver manual | Hodoku Revisited`,
      description: `${c.summary} Part of the Hodoku Revisited sudoku solver manual.`,
      root: '../',
      path: `manual/${c.slug}.html`,
      wide: true,
      body: `<div class="with-rail">${manualRail(c)}<article class="content guide"><p class="crumbs"><a href="./">Manual</a></p><h1>${esc(c.title)}</h1><p class="lead">${esc(c.summary)}</p><div class="prose">${c.body}</div>
<nav class="pager">${prev ? `<a href="${prev.slug}.html"><small>Previous</small>← ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a href="${next.slug}.html"><small>Next</small>${esc(next.title)} →</a>` : '<span></span>'}</nav></article></div>`,
    }),
  );
});

// ---- about / license
add(
  'about.html',
  page({
    title: 'About Hodoku Revisited, a free sudoku solver | License',
    description: 'Hodoku Revisited is a free, open source sudoku solver and trainer based on HoDoKu. Where it comes from, how it is licensed, and how to get the source.',
    root: '',
    path: 'about.html',
    body: `<h1>About</h1>
<p>Hodoku Revisited is a free sudoku solver and trainer. It is a TypeScript port of <a href="https://hodoku.sourceforge.net/">HoDoKu</a>, the Sudoku generator, solver and trainer by Bernhard Hobiger (2008-2012). HoDoKu has not been updated since 2013 and runs only as a Java desktop program. This project brings its solving engine to the web and mobile with a new interface.</p>
<h2>Accuracy</h2>
<p>The solver was ported technique by technique. Its output is tested against the original program: hundreds of puzzles are solved with HoDoKu 2.2.0, and the new engine must find exactly the same steps, in the same order, with the same score and difficulty rating.</p>
<h2>License</h2>
<p>Hodoku Revisited comes with ABSOLUTELY NO WARRANTY. The code is free software under the GNU General Public License, version 3 or later, as the original. You may use, study, change and share it under those terms. The complete source code is at <a href="${REPO}">${REPO}</a>. Changes to the original code are marked in the file headers.</p>
<p>Hodoku Revisited is not affiliated with or endorsed by the original author. The technique guides and the user interface are new texts and designs and are not taken from the HoDoKu manual.</p>
<p>The puzzle generator follows the approach of HoDoKu; thanks to Michael Fowler's generator ideas credited there.</p>`,
  }),
);

// ---- privacy
add(
  'privacy.html',
  page({
    title: 'Privacy | Hodoku Revisited',
    description: 'What data Hodoku Revisited stores and what it does not.',
    root: '',
    path: 'privacy.html',
    body: `<h1>Privacy</h1>
<p>The app runs entirely in your browser. Puzzles are generated and solved on your device. Your current game and settings are saved in your browser's local storage so you can continue later; they are never sent to a server.</p>
<h2>Advertising</h2>
<p>This site shows ads served by Google AdSense. On your first visit a consent banner asks whether you accept these ads. The advertising script, and the cookies Google and its partners use to select and measure ads (including personalised ads), load only after you accept; if you reject, no advertising script is loaded and no ads are shown. Your choice, with a version, is stored in your browser's local storage under <code>hodoku-consent</code> and is never sent to a server. You can change or withdraw it at any time with the "Cookie settings" button in the footer, which reopens the banner.</p>
<p>You can also manage or turn off personalized ads in <a href="https://adssettings.google.com/">Google's ad settings</a>, and learn how Google uses data at <a href="https://policies.google.com/technologies/partner-sites">policies.google.com/technologies/partner-sites</a>.</p>
<p>The solver app under <a href="play/">/play/</a> does not load ads or any third-party scripts and shows no consent banner. Your games and settings stay in your browser.</p>
<p>This site has no accounts and uses no analytics of its own.</p>
<p>Questions: open an issue at <a href="${REPO}/issues">${REPO}/issues</a>.</p>`,
  }),
);

// ---- 404
add(
  '404.html',
  page({
    title: 'Page not found | Hodoku Revisited',
    description: 'Page not found.',
    root: '/',
    body: `<h1>Page not found</h1><p><a href="/">Back to the start page</a></p>`,
  }),
);

const FONTS = [
  ['newsreader', 'Newsreader', 400], ['newsreader', 'Newsreader', 500],
  ['ibm-plex-sans', 'IBM Plex Sans', 400], ['ibm-plex-sans', 'IBM Plex Sans', 500], ['ibm-plex-sans', 'IBM Plex Sans', 600],
  ['ibm-plex-mono', 'IBM Plex Mono', 400], ['ibm-plex-mono', 'IBM Plex Mono', 600],
];
const fontFaces = FONTS.map(([id, family, w]) => `@font-face{font-family:'${family}';font-weight:${w};font-style:normal;font-display:swap;src:url(fonts/${id}-latin-${w}-normal.woff2) format('woff2')}`).join('\n');

// Tokens are the same as the app (packages/app/src/styles.css), so guides and board look alike.
const css = `${fontFaces}
:root{--bg:#F5F2EA;--card:#FFFDF8;--fg:#1C1B18;--muted:#55524A;--line:#D9D3C5;--thick:#1C1B18;--accent:#2B4EA2;--surface-2:#EAE5D8;--accent-soft:#E3E8F5;
--tint-a:#EEF2FB;--tint-b:#FBF3E2;--key:#2B4EA2;--c0:#C9D6F4;--c1:#F3E3C0;--fin:#6B3FA0;--elim:#A8321F;--elim-bg:#F6D3CA;--place:#2E7D4F;--place-bg:#D5EBDC;
--font-display:'Newsreader',Georgia,serif;--font-ui:'IBM Plex Sans',system-ui,sans-serif;--font-mono:'IBM Plex Mono',ui-monospace,monospace}
@media(prefers-color-scheme:dark){:root{--bg:#15171B;--card:#1D2026;--fg:#ECE8DF;--muted:#A9A498;--line:#3A3E47;--thick:#ECE8DF;--accent:#9DB4F5;--surface-2:#252932;--accent-soft:#22384F;
--tint-a:#232A3A;--tint-b:#2E2A1E;--key:#9DB4F5;--c0:#2C3D66;--c1:#4A3A1C;--fin:#C9A6F0;--elim:#FF9A85;--elim-bg:#5A2A22;--place:#7FD39B;--place-bg:#22402C}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:400 16px/1.6 var(--font-ui)}
h1,h2,h3{font-family:var(--font-display);font-weight:500;line-height:1.15;margin:1.4em 0 .4em}
h1{font-size:clamp(2rem,4vw,3rem);margin-top:.6em}h2{font-size:1.6rem}h3{font-size:1.25rem}
a{color:var(--accent)}
code,kbd,.mono{font-family:var(--font-mono);font-size:.88em}
kbd{padding:1px 6px;border:1px solid var(--line);border-radius:3px;background:var(--card)}
code{background:var(--surface-2);padding:1px 5px;border-radius:3px;overflow-wrap:anywhere}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 24px;padding:12px max(16px,calc((100vw - 1200px)/2));border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:10px;color:var(--fg);text-decoration:none}
.wordmark{font:500 1.5rem/1 var(--font-display);display:flex;flex-direction:column}.wordmark small{font:400 .6rem/1.4 var(--font-mono);letter-spacing:.3em;text-transform:uppercase;color:var(--muted)}
.top nav{display:flex;flex-wrap:wrap;align-items:center;gap:4px 20px}.top nav a:not(.btn){color:var(--fg);text-decoration:none}.top nav a:not(.btn):hover{text-decoration:underline}
main{max-width:760px;margin:0 auto;padding:16px}main.wide{max-width:1200px}
.eyebrow{font:600 .75rem/1.4 var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin:0 0 .5em}
.lead{font-size:1.15rem;color:var(--muted)}
.btn{display:inline-block;padding:10px 20px;border-radius:6px;background:var(--accent);color:var(--card);text-decoration:none;font-weight:500;margin:4px 8px 4px 0;border:1px solid var(--accent)}
.btn:hover{filter:brightness(1.1)}.btn.alt{background:transparent;color:var(--accent)}.btn.small{padding:6px 14px;font-size:.9rem;margin:4px 0 4px 0}
.top .btn.small{color:var(--card)}
.hero{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:48px;align-items:center;padding:48px 0 32px}
.hero h1{font-size:clamp(2.2rem,4.6vw,3.6rem);margin:.1em 0 .3em}
.gen{color:var(--muted)}.chip{display:inline-block;padding:2px 12px;border:1px solid var(--line);border-radius:99px;background:var(--card);color:var(--fg);text-decoration:none;font-size:.9rem}.chip:hover{background:var(--surface-2)}
.hero-board{margin:0}
.spotlight{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:40px;align-items:center;margin:16px 0 32px;padding:28px 32px;background:var(--card);border:1px solid var(--line);border-radius:12px}
.spotlight h2{font-size:clamp(1.6rem,3vw,2.2rem);margin:.15em 0 .4em}
.coach-quote{margin:16px 0;padding:12px 16px;background:var(--surface-2);border-left:4px solid var(--accent);border-radius:4px 8px 8px 4px}
.coach-quote .mono{font-size:.82rem;color:var(--accent);text-transform:uppercase;letter-spacing:.04em}
.coach-quote p{margin:6px 0 0;font-size:.98rem}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin:24px 0}
.cards article{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:20px 24px}.cards h2{font-size:1.35rem;margin:.2em 0 .4em}
.trust{border-top:1px solid var(--line);margin-top:32px;color:var(--muted)}
.learnhome{margin:32px 0 0;padding:20px 24px;background:var(--card);border:1px solid var(--line);border-radius:10px}.learnhome p{margin:.2em 0}
.glossary dt{font-weight:600;margin-top:14px}.glossary dd{margin:2px 0 0}
.note{color:var(--muted);font-size:.95rem}
.band{display:inline-block;font:600 .7rem/1 var(--font-mono);letter-spacing:.08em;text-transform:uppercase;padding:4px 8px;border-radius:3px;background:var(--surface-2);color:var(--muted)}
.lv-medium{background:var(--tint-b)}.lv-hard{background:var(--c1)}.lv-unfair{background:var(--elim-bg);color:var(--elim)}.lv-extreme{background:var(--fg);color:var(--bg)}.lv-easy{background:var(--place-bg);color:var(--place)}
.with-rail{display:grid;grid-template-columns:240px minmax(0,1fr);gap:48px;align-items:start}
.rail{position:sticky;top:16px;padding-top:8px;font-size:.95rem}
.railselect{display:none}.railnav h2{font:600 .75rem/1.4 var(--font-mono);letter-spacing:.1em;text-transform:uppercase;margin:0 0 8px}.railnav h2 a{color:var(--muted);text-decoration:none}
.railnav details{border-top:1px solid var(--line)}.railnav summary{cursor:pointer;padding:8px 0;list-style:none;display:flex;justify-content:space-between}.railnav summary::-webkit-details-marker{display:none}
.railnav summary span{font:400 .75rem/1.9 var(--font-mono);color:var(--muted)}
.railnav ul{list-style:none;margin:0 0 8px;padding:0 0 0 12px;border-left:2px solid var(--line)}.railnav li a{display:block;padding:3px 8px;color:var(--fg);text-decoration:none}
.railnav a[aria-current]{color:var(--accent);font-weight:600}.railnav li a:hover{text-decoration:underline}.railnav ul.flat{padding:0;border:0}
.crumbs{color:var(--muted);font-size:.9rem;margin:8px 0 0}.crumbs a{color:var(--muted)}
.meta{margin:.5em 0}
.group h2{font-size:1.4rem;border-top:1px solid var(--line);padding-top:24px}.num{font:400 .8rem var(--font-mono);color:var(--muted);margin-right:8px}
.tgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin-bottom:16px}
.tcard{display:flex;flex-direction:column;gap:6px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;color:var(--fg);text-decoration:none}
.tcard:hover{border-color:var(--accent)}.tcard strong{font:500 1.15rem var(--font-display)}.tcard span:last-child{color:var(--muted);font-size:.9rem;line-height:1.4}
.guide-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,430px);gap:40px;align-items:start}
.sticky{position:sticky;top:16px}
.prose{max-width:62ch}.prose table{border-collapse:collapse;width:100%;font-size:.95rem}.prose th,.prose td{border-bottom:1px solid var(--line);padding:8px 10px 8px 0;text-align:left;vertical-align:top}.prose dt{font-weight:600;margin-top:12px}.prose dd{margin:0}
.tip{background:var(--card);border-left:4px solid var(--accent);padding:8px 14px}
.notation{background:var(--card);border:1px solid var(--line);border-radius:6px;padding:10px 14px}
.example{margin:0 0 24px}
.steps{display:inline-flex;margin-bottom:8px;border:1px solid var(--line);border-radius:6px;overflow:hidden}
.steps button{font:inherit;padding:6px 14px;border:0;background:var(--card);color:var(--fg);cursor:pointer}.steps button+button{border-left:1px solid var(--line)}.steps button[aria-pressed=true]{background:var(--accent);color:var(--card)}
.dg{width:100%;max-width:450px;height:auto;display:block;border:2px solid var(--thick);border-radius:2px}
.dg .bg{fill:var(--card)}.dg .tint-a{fill:var(--tint-a)}.dg .tint-b{fill:var(--tint-b)}
.dg .thin{stroke:var(--line);stroke-width:1}.dg .thick{stroke:var(--thick);stroke-width:2}
.dg text{text-anchor:middle;dominant-baseline:central;fill:var(--fg)}
.dg .val{font-family:var(--font-display);font-size:32px;font-weight:500}.dg .val.placed{fill:var(--place);font-family:var(--font-ui);font-weight:600}
.dg .cand{font-family:var(--font-mono);font-size:11px;fill:var(--muted)}.dg .cand.faded{opacity:.3}
.dg .cand.key{fill:var(--key);font-weight:600;font-size:13px;text-decoration:underline}.dg .cand.fin{fill:var(--fin);font-weight:600;font-size:13px;font-style:italic}
.dg .placebg{fill:var(--place-bg);stroke:var(--place);stroke-width:2}
.dg .cand.elim{fill:var(--elim);font-weight:600;font-size:13px}.dg .strike{stroke:var(--elim);stroke-width:1.5}
.dg .col-0{fill:var(--c0)}.dg .col-1{fill:var(--c1)}
.dg .link{stroke:var(--key);stroke-width:1.5;opacity:.7}.dg .link.weak{stroke-dasharray:4 3}
.example[data-step=before] .val.placed,.example[data-step=before] .placebg{display:none}.example[data-step=before] .cand.faded{opacity:1}
.example[data-step=after] .cand.elim,.example[data-step=after] .strike{display:none}
figcaption{font-size:.9rem;color:var(--muted);margin-top:8px}
.legend{margin:4px 0}.lg{display:inline-block;margin-right:12px;font:600 .8rem var(--font-mono)}
.lg.place{color:var(--place)}.lg.key{color:var(--key)}.lg.fin{color:var(--fin)}.lg.elim{color:var(--elim)}.lg.link{color:var(--muted);font-weight:400}
.pager{display:flex;justify-content:space-between;gap:12px;margin:40px 0 24px;border-top:1px solid var(--line);padding-top:16px}.pager a{display:flex;flex-direction:column;text-decoration:none}.pager small{color:var(--muted);font:400 .75rem var(--font-mono);text-transform:uppercase}
footer{max-width:1200px;margin:48px auto 0;padding:24px 16px;color:var(--muted);font-size:.85rem;border-top:1px solid var(--line)}footer p{margin:.2em 0}
@media(max-width:959px){
.hero,.spotlight{grid-template-columns:1fr;gap:24px;padding-top:24px}
.with-rail{grid-template-columns:1fr;gap:8px}.rail{position:static}.railnav{display:none}
.railselect{display:flex;flex-direction:column;gap:4px;color:var(--muted);font-size:.85rem}.railselect select{font:inherit;min-height:44px;padding:0 12px;background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:6px}
.guide-cols{grid-template-columns:1fr;gap:16px}.sticky{position:static}
}
@media(max-width:599px){.top nav{gap:4px 14px;font-size:.95rem}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
@media print{.top,footer,.rail,.steps,.pager,.btn{display:none}body{background:#fff;color:#000}}
`;

// ---- write
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const [path, content] of pages) {
  const file = join(out, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}
writeFileSync(join(out, 'site.css'), css);

// Consent banner + consent-gated AdSense on the generated marketing pages only (never /play/, which is copied below).
console.log(`consent banner added to ${applyConsent(out)} pages`);

for (const f of ['icon.svg', 'favicon.svg', 'apple-touch-icon.png', 'icon-512.png']) cpSync(join(here, '..', '..', 'app', 'public', f), join(out, f));
const fontSrc = join(here, '..', '..', 'app', 'node_modules', '@fontsource');
mkdirSync(join(out, 'fonts'), { recursive: true });
for (const [id, , w] of FONTS) cpSync(join(fontSrc, id, 'files', `${id}-latin-${w}-normal.woff2`), join(out, 'fonts', `${id}-latin-${w}-normal.woff2`));
if (existsSync(appDist)) cpSync(appDist, join(out, 'play'), { recursive: true });
else console.warn('packages/app/dist not found: the site is built without /play/');

// a custom domain (anything but github.io) gets a CNAME file so Pages keeps serving it
if (siteUrl && siteUrl !== '/' && !new URL(siteUrl).hostname.endsWith('github.io')) writeFileSync(join(out, 'CNAME'), new URL(siteUrl).hostname + '\n');

writeFileSync(join(out, 'ads.txt'), `google.com, pub-${ADSENSE_CLIENT.replace('ca-pub-', '')}, DIRECT, f08c47fec0942fa0\n`);

const gated = Boolean(process.env.SITE_PASSWORD);
if (!gated && siteUrl !== '/') {
  const urls = pages.map(([p]) => p).filter((p) => p !== '404.html').map((p) => siteUrl + p.replace(/index\.html$/, ''));
  if (existsSync(appDist)) urls.push(siteUrl + 'play/');
  writeFileSync(
    join(out, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`,
  );
  writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap.xml\n`);
}
if (gated) console.log(`password gate added to ${applyGate(out, process.env.SITE_PASSWORD)} pages`);
console.log(`wrote ${pages.length} pages to ${out}`);

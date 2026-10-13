/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Static site generator: no dependencies. Run `pnpm --filter @hodoku/app build` first to include the app under /play/.
 * Set SITE_URL (e.g. https://example.org/) to also write sitemap.xml and robots.txt.
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS, TECHNIQUES } from './techniques.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'dist');
const appDist = join(here, '..', '..', 'app', 'dist');
const siteUrl = (process.env.SITE_URL ?? '').replace(/\/?$/, '/');
const REPO = 'https://github.com/ntropey/hodoku_revisited';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** `root` is the path back to the site root from the page, e.g. '../' */
function page({ title, description, root, body, path }) {
  const canonical = siteUrl && path ? `<link rel="canonical" href="${siteUrl}${path}">` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#2b5fb3">
<link rel="icon" href="${root}icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${root}site.css">
${canonical}
</head>
<body>
<header class="top">
  <a class="brand" href="${root}"><img src="${root}icon.svg" alt="" width="28" height="28"> Hodoku Revisited</a>
  <nav>
    <a href="${root}play/">Play</a>
    <a href="${root}techniques/">Techniques</a>
    <a href="${root}about.html">About</a>
  </nav>
</header>
<main>
${body}
</main>
<footer>
  <p>Hodoku Revisited is free software (GPL-3.0-or-later), based on
  <a href="https://hodoku.sourceforge.net/">HoDoKu</a> by Bernhard Hobiger. Not affiliated with or endorsed by the original author.
  <a href="${REPO}">Source code</a> · <a href="${root}privacy.html">Privacy</a> · <a href="${root}about.html">License</a></p>
</footer>
</body>
</html>
`;
}

const pages = []; // [path, content]
const add = (path, content) => pages.push([path, content]);

// ---- home
add(
  'index.html',
  page({
    title: 'Hodoku Revisited: free sudoku trainer with logical hints',
    description: 'Play sudoku in your browser or install it as an app. Get logical hints that name the technique, practice by difficulty, import puzzles. Free and open source.',
    root: '',
    path: '',
    body: `<section class="hero">
  <h1>Sudoku with hints that teach you why.</h1>
  <p>A free, open source sudoku trainer based on HoDoKu. It finds the next logical step, names the technique and shows you the cells involved, from a simple Hidden Single up to chains and forcing nets.</p>
  <p><a class="btn" href="play/">Play now</a> <a class="btn alt" href="techniques/">Learn the techniques</a></p>
</section>
<section class="cards">
  <article><h2>Works everywhere</h2><p>Runs in any modern browser on phones and computers. Install it from the browser menu, and it works offline.</p></article>
  <article><h2>Real logical hints</h2><p>The solver finds the same steps as HoDoKu 2.2.0 (we compare them step by step), so a hint is always a real technique, never a guess.</p></article>
  <article><h2>Puzzles by difficulty</h2><p>Generate Easy to Unfair puzzles or import your own in many text formats. Ratings use HoDoKu's scoring.</p></article>
  <article><h2>Free software</h2><p>GPL-3.0-or-later. Read, change and share the <a href="${REPO}">source code</a>.</p></article>
</section>`,
  }),
);

// ---- technique index
const byLevel = LEVELS.map((level) => ({ level, items: TECHNIQUES.filter((t) => t.level === level) })).filter((g) => g.items.length);
add(
  'techniques/index.html',
  page({
    title: 'Sudoku solving techniques explained | Hodoku Revisited',
    description: 'Guides to the sudoku techniques the solver uses, from Naked Singles to X-Wings, chains and forcing nets.',
    root: '../',
    path: 'techniques/',
    body: `<h1>Sudoku techniques</h1>
<p>Each guide explains one technique in plain words. Cells are written as rXcY: row X, column Y. The in-app hint tells you which technique it used, so you can come here to read about it.</p>
${byLevel
  .map(
    (g) => `<h2>${g.level}</h2>
<ul class="list">
${g.items.map((t) => `<li><a href="${t.slug}.html">${esc(t.name)}</a> <span>${esc(t.summary)}</span></li>`).join('\n')}
</ul>`,
  )
  .join('\n')}`,
  }),
);

// ---- technique pages
TECHNIQUES.forEach((t, i) => {
  const prev = TECHNIQUES[i - 1];
  const next = TECHNIQUES[i + 1];
  add(
    `techniques/${t.slug}.html`,
    page({
      title: `${t.name}: sudoku technique | Hodoku Revisited`,
      description: `${t.name}: ${t.summary}`,
      root: '../',
      path: `techniques/${t.slug}.html`,
      body: `<p class="crumbs"><a href="./">Techniques</a> › ${esc(t.level)}</p>
<h1>${esc(t.name)}</h1>
<p class="lead">${esc(t.summary)}</p>
${t.body.map((p) => `<p>${esc(p)}</p>`).join('\n')}
${t.tip ? `<p class="tip"><strong>Tip:</strong> ${esc(t.tip)}</p>` : ''}
<p><a class="btn" href="../play/">Practice in the app</a></p>
<nav class="pager">
${prev ? `<a href="${prev.slug}.html">← ${esc(prev.name)}</a>` : '<span></span>'}
${next ? `<a href="${next.slug}.html">${esc(next.name)} →</a>` : '<span></span>'}
</nav>`,
    }),
  );
});

// ---- about / license
add(
  'about.html',
  page({
    title: 'About and license | Hodoku Revisited',
    description: 'Where Hodoku Revisited comes from, how it is licensed, and how to get the source.',
    root: '',
    path: 'about.html',
    body: `<h1>About</h1>
<p>Hodoku Revisited is a TypeScript port of <a href="https://hodoku.sourceforge.net/">HoDoKu</a>, the Sudoku generator, solver and trainer by Bernhard Hobiger (2008-2012). HoDoKu has not been updated since 2013 and runs only as a Java desktop program. This project brings its solving engine to the web and mobile with a new interface.</p>
<h2>Accuracy</h2>
<p>The solver was ported technique by technique. Its output is tested against the original program: hundreds of puzzles are solved with HoDoKu 2.2.0, and the new engine must find exactly the same steps, in the same order, with the same score and difficulty rating.</p>
<h2>License</h2>
<p>The code is free software under the GNU General Public License, version 3 or later, as the original. You may use, study, change and share it under those terms. The complete source code is at <a href="${REPO}">${REPO}</a>. Changes to the original code are marked in the file headers.</p>
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
<p>This site does not use cookies, accounts or analytics at this time. If advertising or analytics are added in the future, this page will be updated first, and visitors from the EU and the UK will be asked for consent before any tracking starts.</p>
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

const css = `:root{--bg:#f5f6fa;--fg:#1d2330;--card:#fff;--line:#d5d9e5;--accent:#2b5fb3;--muted:#586079}
@media(prefers-color-scheme:dark){:root{--bg:#12151c;--fg:#e8ebf3;--card:#1b2030;--line:#343b52;--accent:#6ea0f2;--muted:#a3abc2}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:1rem/1.6 system-ui,sans-serif}
.top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;padding:12px 16px;border-bottom:1px solid var(--line);background:var(--card)}
.brand{display:flex;align-items:center;gap:8px;font-weight:700;color:var(--fg);text-decoration:none}
.top nav{display:flex;gap:16px}
a{color:var(--accent)}
main,footer{max-width:760px;margin:0 auto;padding:16px}
h1{line-height:1.2;margin:.8em 0 .4em}
.hero{padding:24px 0}.hero h1{font-size:2rem}
.lead{font-size:1.15rem;color:var(--muted)}
.btn{display:inline-block;padding:10px 18px;border-radius:8px;background:var(--accent);color:#fff;text-decoration:none;margin:4px 8px 4px 0}
.btn.alt{background:transparent;color:var(--accent);border:1px solid var(--accent)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.cards article{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:4px 16px 12px}
.list{padding:0;list-style:none}.list li{padding:8px 0;border-bottom:1px solid var(--line)}
.list span{display:block;color:var(--muted);font-size:.9rem}
.tip{background:var(--card);border-left:4px solid var(--accent);padding:8px 12px}
.crumbs{color:var(--muted);font-size:.9rem;margin-bottom:0}
.pager{display:flex;justify-content:space-between;gap:12px;margin-top:24px}
footer{color:var(--muted);font-size:.85rem;border-top:1px solid var(--line);margin-top:24px}
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
cpSync(join(here, '..', '..', 'app', 'public', 'icon.svg'), join(out, 'icon.svg'));
if (existsSync(appDist)) cpSync(appDist, join(out, 'play'), { recursive: true });
else console.warn('packages/app/dist not found: the site is built without /play/');

if (siteUrl !== '/') {
  const urls = pages.map(([p]) => p).filter((p) => p !== '404.html').map((p) => siteUrl + p.replace(/index\.html$/, ''));
  if (existsSync(appDist)) urls.push(siteUrl + 'play/');
  writeFileSync(
    join(out, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`,
  );
  writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap.xml\n`);
}
console.log(`wrote ${pages.length} pages to ${out}`);

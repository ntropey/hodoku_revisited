import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execFileSync('node', ['src/build.mjs'], { cwd: root, env: { ...process.env, SITE_URL: 'https://example.org/' } });
const dist = join(root, 'dist');
const { TECHNIQUES } = await import(pathToFileURL(join(root, 'src/techniques.mjs')).href);

test('every technique has a page, listed on the index', () => {
  const index = readFileSync(join(dist, 'techniques/index.html'), 'utf8');
  for (const t of TECHNIQUES) {
    assert.ok(existsSync(join(dist, `techniques/${t.slug}.html`)), t.slug);
    assert.ok(index.includes(`href="${t.slug}"`), t.slug);
  }
});

test('internal links resolve', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'play' ? [] : walk(join(d, e.name))) : [join(d, e.name)]));
  for (const file of walk(dist).filter((f) => f.endsWith('.html') && !f.endsWith('404.html'))) {
    const html = readFileSync(file, 'utf8');
    for (const m of html.matchAll(/(?:href|src)="([^"#:]+)"/g)) {
      const target = join(dirname(file), m[1]);
      if (m[1].startsWith('play/') || m[1].startsWith('../play/')) continue;
      assert.ok(!m[1].endsWith('.html'), `${file} links to .html: ${m[1]}`);
      assert.ok(existsSync(target) || existsSync(`${target}.html`) || existsSync(join(target, 'index.html')), `${file} -> ${m[1]}`);
    }
  }
});

test('every page (including /play/) has the consent-aware AdSense loader and never loads AdSense statically', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.html') ? [join(d, e.name)] : []));
  const files = walk(dist);
  assert.ok(files.length > TECHNIQUES.length, 'found the marketing pages');
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    assert.match(html, /hodoku-consent/, `${file}: storage key / banner`);
    assert.match(html, /role="dialog"/, `${file}: dialog markup`);
    assert.match(html, /aria-modal="true"/, `${file}: aria-modal`);
    assert.ok(!/<script[^>]*\bsrc="[^"]*adsbygoogle\.js/.test(html), `${file}: no static AdSense <script> tag`);
    assert.match(html, /adsbygoogle\.js\?client=/, `${file}: consent-gated AdSense loader`);
  }
});

test('the consent script gates AdSense, remembers accept/reject, and can be reopened', () => {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  assert.match(html, /localStorage/, 'stores the choice in localStorage');
  assert.match(html, /'granted'/, 'accept is stored');
  assert.match(html, /'denied'/, 'reject is stored too (no re-prompt)');
  assert.match(html, /ad_user_data/, 'Google Consent Mode v2 parameters are initialized and updated');
  assert.match(html, /ad_personalization/, 'Google Consent Mode v2 ad_personalization signal');
  assert.match(html, /googlefc/, 'hooks Google Funding Choices / AdSense CMP');
  assert.match(html, /Cookie settings/, 'footer control to withdraw consent');
  // The AdSense URL is built into a script element at runtime, never a static tag.
  assert.ok(!/<script[^>]*src="https:\/\/pagead2\.googlesyndication\.com/.test(html));
  assert.match(html, /v:V/, 'the stored choice carries a version');
});

test('privacy page explains the consent banner and the locally stored choice', () => {
  const html = readFileSync(join(dist, 'privacy.html'), 'utf8');
  assert.match(html, /consent banner/i);
  assert.match(html, /local storage/i);
  assert.match(html, /hodoku-consent/);
  assert.match(html, /Cookie settings/);
  assert.match(html, /adssettings\.google\.com/, 'keeps the Google ad settings link');
  assert.match(html, /play\//, 'keeps the statement about /play/');
});

test('sitemap and robots are written when SITE_URL is set', () => {
  const sitemap = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/example\.org\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/example\.org\/techniques\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/example\.org\/techniques\/x-wing<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/example\.org\/about<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/example\.org\/privacy<\/loc>/);
  assert.ok(!sitemap.includes('.html'), 'sitemap URLs never end in .html');
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'play' ? [] : walk(join(d, e.name))) : [join(d, e.name)]));
  for (const file of walk(dist).filter((f) => f.endsWith('.html') && !f.endsWith('404.html'))) {
    const html = readFileSync(file, 'utf8');
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
    const ogUrl = html.match(/<meta property="og:url" content="([^"]+)"/);
    assert.ok(canonical && !canonical[1].endsWith('.html'), `${file}: canonical never ends in .html`);
    assert.ok(ogUrl && !ogUrl[1].endsWith('.html'), `${file}: og:url never ends in .html`);
    assert.ok(!/"(?:url|item)":"[^"]*\.html"/.test(html), `${file}: JSON-LD URLs never end in .html`);
  }
  assert.match(readFileSync(join(dist, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/example\.org\/sitemap\.xml/);
});

test('technique pages with a worked example contain a diagram', () => {
  const withExample = ['x-wing', 'xy-wing', 'hidden-single', 'als-xz', 'nice-loops', 'forcing-chains', 'skyscraper'];
  for (const slug of withExample) {
    const html = readFileSync(join(dist, `techniques/${slug}.html`), 'utf8');
    assert.match(html, /<svg class="dg"/, slug);
  }
});

test('SITE_PASSWORD adds a gate without leaking the password, and blocks indexing', () => {
  execFileSync('node', ['src/build.mjs'], { cwd: root, env: { ...process.env, SITE_PASSWORD: 'correct horse battery' } });
  for (const f of ['index.html', 'techniques/x-wing.html', 'play/index.html']) {
    const p = join(dist, f);
    if (!existsSync(p)) continue;
    const html = readFileSync(p, 'utf8');
    assert.match(html, /hodoku-gate/, f);
    assert.match(html, /noindex/, f);
    assert.ok(!html.includes('correct horse battery'), f);
  }
  assert.match(readFileSync(join(dist, 'robots.txt'), 'utf8'), /Disallow: \//);
  assert.ok(!existsSync(join(dist, 'sitemap.xml')));
  // restore the normal build for other tests
  execFileSync('node', ['src/build.mjs'], { cwd: root, env: { ...process.env, SITE_PASSWORD: '', SITE_URL: 'https://example.org/' } });
});

test('manual chapters exist and every guide has an Open in app link with a valid puzzle', async () => {
  const { readdirSync, readFileSync, existsSync } = await import('node:fs');
  const dist = new URL('../dist/', import.meta.url);
  assert.ok(existsSync(new URL('manual/hints.html', dist)));
  assert.ok(existsSync(new URL('manual/keyboard-shortcuts.html', dist)));
  const home = readFileSync(new URL('index.html', dist), 'utf8');
  assert.match(home, /AI Super Solver/);
  assert.match(home, /AI Coach/);
  assert.match(home, /play\/\?daily=1/);
  assert.match(home, /prove=r1c9\.4/);
  assert.match(home, /"FAQPage"/);
  const hintsManual = readFileSync(new URL('manual/hints.html', dist), 'utf8');
  assert.match(hintsManual, /AI Coach walkthrough/);
  assert.match(hintsManual, /contradiction prover/);
  const guide = readFileSync(new URL('techniques/x-wing.html', dist), 'utf8');
  assert.match(guide, /play\/\?p=[.0-9]{81}"/);
  assert.match(guide, /"TechArticle"/);
  assert.match(guide, /"BreadcrumbList"/);
  assert.ok(readdirSync(new URL('fonts/', dist)).length >= 7);
});

test('learn pages exist and the level page lists every technique under its level', () => {
  const dist = new URL('../dist/', import.meta.url);
  for (const f of ['learn/index.html', 'learn/how-to-solve-sudoku.html', 'learn/sudoku-glossary.html', 'learn/sudoku-notation.html']) {
    assert.ok(existsSync(new URL(f, dist)), f);
  }
  const levels = readFileSync(new URL('learn/sudoku-difficulty-levels.html', dist), 'utf8');
  for (const t of TECHNIQUES) assert.ok(levels.includes(`techniques/${t.slug}"`), `${t.slug} on the level page`);
});

test('user-facing text and docs use American spelling', async () => {
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const repo = new URL('../../../', import.meta.url);
  const roots = ['packages/app/src', 'packages/website/src', 'docs', 'README.md', 'AGENTS.md'];
  const skip = /node_modules|\/dist\/|docs\/design|hodoku_legacy_captures|examples\.json|bank\.json/;
  const British = /colour|practis(e|ing)|behaviour|\bcentre\b|labelled|honour|\bgrey\b|organis(e|ation)|recognis(e|ing)/i;
  const walk = (p) => (statSync(p).isDirectory() ? readdirSync(p).flatMap((n) => walk(`${p}/${n}`)) : [p]);
  const bad = [];
  for (const r of roots) {
    for (const f of walk(fileURLToPath(new URL(r, repo))).map((p) => p.replaceAll('\\', '/'))) {
      if (skip.test(f) || !/\.(ts|tsx|mjs|md|css)$/.test(f)) continue;
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        // the game mode identifier 'practising' is a stored value, kept as it is
        if (British.test(line.replace(/'practising'|practising:/g, ''))) bad.push(`${f.replace(repo.pathname, '')}:${i + 1}`);
      });
    }
  }
  assert.deepEqual(bad, [], 'British spellings found');
});

test('every page has a skip link that lands on the main landmark', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'play' ? [] : walk(join(d, e.name))) : [join(d, e.name)]));
  for (const file of walk(dist).filter((f) => f.endsWith('.html') && !f.endsWith('404.html'))) {
    const html = readFileSync(file, 'utf8');
    assert.ok(html.includes('<a class="skip" href="#main">'), `${file} has a skip link`);
    assert.ok(/<main id="main"/.test(html), `${file} main is the skip target`);
  }
});

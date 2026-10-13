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
    assert.ok(index.includes(`href="${t.slug}.html"`), t.slug);
  }
});

test('internal links resolve', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'play' ? [] : walk(join(d, e.name))) : [join(d, e.name)]));
  for (const file of walk(dist).filter((f) => f.endsWith('.html') && !f.endsWith('404.html'))) {
    const html = readFileSync(file, 'utf8');
    for (const m of html.matchAll(/(?:href|src)="([^"#:]+)"/g)) {
      const target = join(dirname(file), m[1]);
      if (m[1].startsWith('play/') || m[1].startsWith('../play/')) continue;
      assert.ok(existsSync(target) || existsSync(join(target, 'index.html')), `${file} -> ${m[1]}`);
    }
  }
});

test('sitemap and robots are written when SITE_URL is set', () => {
  assert.match(readFileSync(join(dist, 'sitemap.xml'), 'utf8'), /https:\/\/example\.org\/techniques\/x-wing\.html/);
  assert.match(readFileSync(join(dist, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/example\.org\/sitemap\.xml/);
});

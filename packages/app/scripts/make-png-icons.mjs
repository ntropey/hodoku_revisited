// Renders public/icon.svg to the PNG sizes the manifest and iOS need. Needs playwright (not a project dependency).
//   node scripts/make-png-icons.mjs <path to playwright/index.mjs>
import { readFileSync, writeFileSync } from 'node:fs';
const { chromium } = await import(process.argv[2]);
const svg = readFileSync('public/icon.svg', 'utf8');
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium' });
for (const [file, size, bg] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180, '#F5F2EA'], ['icon-maskable-512.png', 512, '#F5F2EA']]) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  // the maskable and apple icons are full squares: the platform rounds them
  const inner = bg ? svg.replace(/rx="96"/, 'rx="0"') : svg;
  await p.setContent(`<body style="margin:0;background:${bg ?? 'transparent'}">${inner.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  writeFileSync(`public/${file}`, await p.screenshot({ omitBackground: !bg }));
}
await b.close();

import { describe, expect, it } from 'vitest';
import { buildShareUrl, PUBLIC_APP_URL } from '../src/platform';

const P = '97....4..2..4718.3........5....5..8.5.1.4.2.9.4..8....8........3.9762..8..5....67';

describe('share addresses', () => {
  it('uses the public app page in the native shell, never capacitor://localhost', () => {
    expect(buildShareUrl(true, 'capacitor://localhost/', { p: P, coach: '1' })).toBe(`${PUBLIC_APP_URL}?p=${P}&coach=1`);
    expect(buildShareUrl(true, 'https://localhost/?daily=2026-01-01', { level: '3' })).toBe(`${PUBLIC_APP_URL}?level=3`);
  });

  it('keeps the current page on the website and replaces its query', () => {
    expect(buildShareUrl(false, 'https://hodokurevisited.com/play/?daily=2026-01-01', { p: P })).toBe(
      `https://hodokurevisited.com/play/?p=${P}`,
    );
  });
});

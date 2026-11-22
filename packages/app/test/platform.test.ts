import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildShareUrl, isAppShell, isIosNativeApp, isNativeApp, PUBLIC_APP_URL } from '../src/platform';

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

describe('isAppShell', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false when window and document are undefined (SSR/node)', () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);
    expect(isAppShell()).toBe(false);
    expect(isNativeApp()).toBe(false);
    expect(isIosNativeApp()).toBe(false);
  });

  it('returns false in a regular browser tab, even without matchMedia', () => {
    vi.stubGlobal('window', { location: { protocol: 'https:' }, navigator: {} });
    vi.stubGlobal('document', { referrer: 'https://hodokurevisited.com/' });
    expect(isAppShell()).toBe(false);
    expect(isNativeApp()).toBe(false);
    expect(isIosNativeApp()).toBe(false);
  });

  it('returns true for standalone display-mode PWA without marking as native', () => {
    vi.stubGlobal('window', {
      location: { protocol: 'https:' },
      navigator: {},
      matchMedia: (q: string) => ({ matches: q === '(display-mode: standalone)' }),
    });
    vi.stubGlobal('document', { referrer: '' });
    expect(isAppShell()).toBe(true);
    expect(isNativeApp()).toBe(false);
  });

  it('returns true for fullscreen display-mode PWA without marking as native', () => {
    vi.stubGlobal('window', {
      location: { protocol: 'https:' },
      navigator: {},
      matchMedia: (q: string) => ({ matches: q === '(display-mode: fullscreen)' }),
    });
    vi.stubGlobal('document', { referrer: '' });
    expect(isAppShell()).toBe(true);
    expect(isNativeApp()).toBe(false);
  });

  it('returns true for iOS standalone PWA (navigator.standalone)', () => {
    vi.stubGlobal('window', {
      location: { protocol: 'https:' },
      navigator: { standalone: true },
    });
    vi.stubGlobal('document', { referrer: '' });
    expect(isAppShell()).toBe(true);
    expect(isNativeApp()).toBe(false);
  });

  it('returns true for Android TWA referrer (android-app://)', () => {
    vi.stubGlobal('window', {
      location: { protocol: 'https:' },
      navigator: {},
      matchMedia: () => ({ matches: false }),
    });
    vi.stubGlobal('document', { referrer: 'android-app://com.revisitedlabs.hodoku' });
    expect(isAppShell()).toBe(true);
    expect(isNativeApp()).toBe(false);
  });

  it('returns true for Capacitor native shell and detects iOS native shell', () => {
    vi.stubGlobal('window', {
      location: { protocol: 'capacitor:' },
      navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_3 like Mac OS X)' },
    });
    vi.stubGlobal('document', { referrer: '' });
    expect(isNativeApp()).toBe(true);
    expect(isAppShell()).toBe(true);
    expect(isIosNativeApp()).toBe(true);
  });
});

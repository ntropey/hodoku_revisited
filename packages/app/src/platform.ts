/*
 * Hodoku Revisited. GPL-3.0-or-later; see LICENSE.
 * Where the app is running. The same bundle is the website/PWA and the Capacitor shell; the shell
 * must not use relative links or window.location for addresses that leave it.
 */
import { Capacitor } from '@capacitor/core';

/** The public address of the web app. Share links from the native shell must use it. */
export const PUBLIC_APP_URL = 'https://hodokurevisited.com/play/';

/**
 * Shown wherever a print action cannot work. WKWebView does not present the JavaScript print
 * dialog, so the shell hides those actions instead of pretending to print.
 */
export const PRINTING_NATIVE_MESSAGE = 'Printing is available on the web/desktop.';

/** True inside the Capacitor iOS/Android shell, false on the website and the PWA. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform() || (typeof window !== 'undefined' && window.location.protocol === 'capacitor:');
}

/**
 * A shareable address for `params`: the public app page in the native shell, where window.location
 * is capacitor://localhost, otherwise the current page. `native` and `href` are explicit so this
 * stays a pure function.
 */
export function buildShareUrl(native: boolean, href: string, params: Record<string, string>): string {
  const u = new URL(native ? PUBLIC_APP_URL : href);
  u.search = new URLSearchParams(params).toString();
  return u.toString();
}

/** The shareable address of the current game, safe to paste into another app. */
export function shareUrl(params: Record<string, string>): string {
  return buildShareUrl(isNativeApp(), window.location.href, params);
}

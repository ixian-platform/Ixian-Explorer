'use client';

import { useSyncExternalStore } from 'react';

/**
 * Light and dark theme. The saved choice lives in localStorage ('ixs-theme')
 * and on <html data-theme>; with nothing saved the system setting decides.
 * The inline script in app/layout.tsx applies the saved choice before paint.
 */
export type Theme = 'light' | 'dark';
const KEY = 'ixs-theme';
const EVENT = 'ixs-theme';

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function resolvedTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  const t = document.documentElement.getAttribute('data-theme');
  return t === 'light' || t === 'dark' ? t : systemTheme();
}

export function setTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
  try {
    // choosing the system's own theme clears the override, so the site follows the system again
    if (t === systemTheme()) {
      localStorage.removeItem(KEY);
      document.documentElement.removeAttribute('data-theme');
    } else localStorage.setItem(KEY, t);
  } catch {
    /* storage blocked: the choice lasts for this page view */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeTheme(cb: () => void) {
  const mq = window.matchMedia?.('(prefers-color-scheme: light)');
  window.addEventListener(EVENT, cb);
  mq?.addEventListener?.('change', cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    if (e.newValue === 'light' || e.newValue === 'dark') document.documentElement.setAttribute('data-theme', e.newValue);
    else document.documentElement.removeAttribute('data-theme');
    cb();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    mq?.removeEventListener?.('change', cb);
    window.removeEventListener('storage', onStorage);
  };
}

/** The theme in effect. Renders 'dark' on the server and the first client pass. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeTheme, resolvedTheme, () => 'dark');
}

/** Read a CSS custom property from :root (after hydration only). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { source } from '@/data/source';
import type { LiveEvent, NetworkStatus } from '@/data/types';

export type QueryState<T> =
  | { status: 'loading'; data: T | null; error: null }
  | { status: 'ok'; data: T; error: null }
  | { status: 'notfound'; data: null; error: null }
  | { status: 'error'; data: T | null; error: Error };

/**
 * Load data once per `key`. `null` from the loader means "not found".
 * While a new key loads, the previous data is kept (so refetches never flash).
 */
export function useQuery<T>(key: string | null, load: () => Promise<T | null>) {
  const [state, setState] = useState<QueryState<T>>({ status: 'loading', data: null, error: null });
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    if (key == null) return;
    let alive = true;
    setState((s) => ({ status: 'loading', data: s.data, error: null }));
    loadRef
      .current()
      .then((d) => {
        if (!alive) return;
        setState(d == null ? { status: 'notfound', data: null, error: null } : { status: 'ok', data: d, error: null });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setState((s) => ({ status: 'error', data: s.data, error: e instanceof Error ? e : new Error(String(e)) }));
      });
    return () => {
      alive = false;
    };
  }, [key, nonce]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

// true once the app has hydrated: later mounts can read the clock on their first render
let hydrated = false;

/** Unix seconds, ticking. null during server render and the first paint (hydration-safe). */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(() => (hydrated ? Date.now() / 1000 : null));
  useEffect(() => {
    hydrated = true;
    setNow(Date.now() / 1000);
    const id = window.setInterval(() => setNow(Date.now() / 1000), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Subscribe to new blocks and transactions. */
export function useLive(listener: (e: LiveEvent) => void, enabled = true) {
  const ref = useRef(listener);
  ref.current = listener;
  useEffect(() => {
    if (!enabled) return;
    return source.subscribe((e) => ref.current(e));
  }, [enabled]);
}

/* ---- shared network status: one fetch, refreshed on every new block ---- */
let statusState: { data: NetworkStatus | null; error: Error | null } = { data: null, error: null };
const statusSubs = new Set<() => void>();
let statusUnsub: (() => void) | null = null;
let statusInflight = false;

function fetchStatus() {
  if (statusInflight) return;
  statusInflight = true;
  source
    .getStatus()
    .then((d) => {
      statusState = { data: d, error: null };
    })
    .catch((e: unknown) => {
      statusState = { data: statusState.data, error: e instanceof Error ? e : new Error(String(e)) };
    })
    .finally(() => {
      statusInflight = false;
      statusSubs.forEach((f) => f());
    });
}

function subscribeStatus(cb: () => void) {
  statusSubs.add(cb);
  if (!statusUnsub) {
    fetchStatus();
    statusUnsub = source.subscribe((e) => {
      if (e.type === 'block') fetchStatus();
    });
  }
  return () => {
    statusSubs.delete(cb);
    if (statusSubs.size === 0 && statusUnsub) {
      statusUnsub();
      statusUnsub = null;
    }
  };
}
const EMPTY_STATUS = { data: null, error: null };
export function useStatus() {
  return useSyncExternalStore(
    subscribeStatus,
    () => statusState,
    () => EMPTY_STATUS
  );
}

/* ---- media preferences ---- */
export function useMedia(query: string, serverValue = false) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => serverValue
  );
}
export const useReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)');

/** True on Apple platforms (for the ⌘ glyph). False on the server. */
export function useIsMac() {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);
  return mac;
}

/* ---- tiny safe localStorage ---- */
export function readStore<T>(key: string, fallback: T): T {
  try {
    const v = window.localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeStore(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage can be unavailable (private mode); nothing depends on it */
  }
}

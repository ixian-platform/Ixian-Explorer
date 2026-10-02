/** Formatting helpers. English number format everywhere; times in UTC with a relative form. */
import type { Amount } from '@/data/types';

const nf = new Intl.NumberFormat('en');
export const int = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? '' : nf.format(Math.round(n)));

export function dec(n: number, digits = 2) {
  return new Intl.NumberFormat('en', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

export function compact(n: number, digits = 1) {
  const a = Math.abs(n);
  const units: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [v, u] of units) {
    if (a >= v) {
      const x = n / v;
      return `${x.toFixed(x >= 100 ? 0 : digits).replace(/\.0+$/, '')}${u}`;
    }
  }
  return int(n);
}

/** Hashrate in h/s with SI prefix. */
export function hashrate(n: number) {
  const units: [number, string][] = [
    [1e12, 'TH/s'],
    [1e9, 'GH/s'],
    [1e6, 'MH/s'],
    [1e3, 'kH/s'],
  ];
  for (const [v, u] of units) if (n >= v) return `${(n / v).toFixed(2)} ${u}`;
  return `${int(n)} H/s`;
}

/**
 * An IXI amount split for display: integer part with separators, and the
 * fraction with its significant digits and its trailing zeros apart (so the
 * UI can dim them). Always exact: works on the decimal string.
 */
export function splitAmount(a: Amount, maxDecimals = 8) {
  const neg = a.startsWith('-');
  const [w, f = ''] = (neg ? a.slice(1) : a).split('.');
  const frac = (f + '00000000').slice(0, 8).slice(0, maxDecimals);
  const sig = frac.replace(/0+$/, '');
  return {
    sign: neg ? '-' : '',
    whole: w.replace(/\B(?=(\d{3})+(?!\d))/g, ','),
    frac: sig,
    zeros: frac.slice(sig.length),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-09-24 21:04:11 UTC" */
export function utc(ts: number) {
  const d = new Date(ts * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function shortDate(ts: number) {
  const d = new Date(ts * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
export function shortDateTime(ts: number) {
  const d = new Date(ts * 1000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
export function hhmm(ts: number) {
  const d = new Date(ts * 1000);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "12 s ago", "4 min ago", "3 h ago", "2 days ago" */
export function ago(ts: number, nowSec: number) {
  const s = Math.max(0, Math.round(nowSec - ts));
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 60) return `${d} day${d === 1 ? '' : 's'} ago`;
  const mo = Math.floor(d / 30.44);
  if (mo < 24) return `${mo} months ago`;
  return `${Math.floor(d / 365.25)} years ago`;
}

/** "3 d 4 h", "5 h 12 min", "42 s" */
export function duration(sec: number) {
  const s = Math.max(0, Math.round(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

export const TX_TYPE_LABEL: Record<number, string> = {
  0: 'Transfer',
  1: 'Proof-of-work (legacy)',
  2: 'Signing reward',
  3: 'Genesis',
  4: 'Multisig',
  5: 'Multisig change',
  6: 'Multisig signature',
};

export const TX_TYPE_LONG: Record<number, string> = TX_TYPE_LABEL;

/** Middle-truncate a hash for compact display. */
export function middle(s: string, head = 8, tail = 6) {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

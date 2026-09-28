/** Where a search goes, and the local list of recent searches. */
import { classify, type QueryKind } from './address';
import { readStore, writeStore } from './hooks';
import { middle } from './format';

export interface Recent {
  q: string;
  kind: 'height' | 'blockHash' | 'txid' | 'address';
  label: string;
  at: number;
}

const KEY = 'ixiscope.recent';
const MAX = 8;

export function routeFor(k: QueryKind): string | null {
  switch (k.kind) {
    case 'height':
      return `/block?h=${k.height}`;
    case 'blockHash':
      return `/block?hash=${k.hash}`;
    case 'txid':
      return `/tx?id=${encodeURIComponent(k.id)}`;
    case 'address':
      return `/address?a=${encodeURIComponent(k.address)}`;
    default:
      return null;
  }
}

export function describe(k: QueryKind): string {
  switch (k.kind) {
    case 'height':
      return `Block ${k.height.toLocaleString('en')}`;
    case 'blockHash':
      return `Block ${middle(k.hash, 8, 6)}`;
    case 'txid':
      return `Transaction ${middle(k.id, 10, 6)}`;
    case 'address':
      return `Address ${middle(k.address, 8, 6)}`;
    default:
      return '';
  }
}

export function recentList(): Recent[] {
  const v = readStore<Recent[]>(KEY, []);
  return Array.isArray(v) ? v.filter((x) => x && typeof x.q === 'string').slice(0, MAX) : [];
}

export function remember(q: string) {
  const k = classify(q);
  if (k.kind !== 'height' && k.kind !== 'blockHash' && k.kind !== 'txid' && k.kind !== 'address') return;
  const value = k.kind === 'height' ? String(k.height) : k.kind === 'blockHash' ? k.hash : k.kind === 'txid' ? k.id : k.address;
  const list = recentList().filter((x) => x.q !== value);
  list.unshift({ q: value, kind: k.kind, label: describe(k), at: Date.now() });
  writeStore(KEY, list.slice(0, MAX));
}

export function forgetAll() {
  writeStore(KEY, []);
}

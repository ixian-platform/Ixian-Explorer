/** Reading a URL that leads nowhere: old explorer links, chain values in the path, near-miss page names. */
import { classify, type QueryKind } from './address';
import { routeFor } from './search';

/** The old explorer's `index.php?p=…&id=…` links, mapped to the new pages. */
export function legacyTarget(search: string): string | null {
  const q = new URLSearchParams(search);
  const p = q.get('p');
  if (!p) return null;
  const id = q.get('id') ?? '';
  const map: Record<string, string> = {
    block: `/block?h=${encodeURIComponent(id)}`,
    transaction: `/tx?id=${encodeURIComponent(id)}`,
    address: `/address?a=${encodeURIComponent(id.split('_')[0])}`,
    search: `/search?q=${encodeURIComponent(q.get('q') ?? '')}`,
    nodes: '/network',
    network: '/stats',
    top: '/ixi#top',
    emissions: '/ixi',
    devblocks: '/blocks?view=detailed',
    home: '/',
  };
  return map[p] ?? null;
}

/** The pages, with the words people type for them. */
export const PAGES = [
  { href: '/', label: 'Home', names: ['home', 'index', 'explorer', 'ixiscope'] },
  { href: '/blocks', label: 'Blocks', names: ['blocks', 'block', 'chain', 'latest', 'devblocks'] },
  { href: '/network', label: 'Network', names: ['network', 'nodes', 'node', 'globe', 'map', 'peers', 'relays'] },
  { href: '/stats', label: 'Statistics', names: ['stats', 'statistics', 'stat', 'charts', 'tps'] },
  { href: '/ixi', label: 'IXI', names: ['ixi', 'supply', 'emissions', 'emission', 'top', 'richlist', 'rich'] },
  { href: '/search', label: 'Search', names: ['search', 'find', 'lookup'] },
] as const;

function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** The page whose name is closest to the first path segment, if it is close enough to be a typo. */
export function nearestPage(path: string) {
  const seg = (path.split('/').filter(Boolean)[0] ?? '').toLowerCase().replace(/\.(php|html?)$/, '');
  if (!seg) return null;
  let best: { page: (typeof PAGES)[number]; d: number } | null = null;
  for (const page of PAGES)
    for (const n of page.names) {
      const d = distance(seg, n);
      if (!best || d < best.d) best = { page, d };
    }
  return best && best.d <= Math.max(1, Math.floor(best.page.names[0].length / 3)) ? best.page : null;
}

/** The last path segment read as a search: the old explorer opened `/<value>` as a block. */
export function readSegment(path: string, latest: number | null): { raw: string; kind: QueryKind; to: string | null } | null {
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) return null;
  let raw = parts[parts.length - 1];
  try {
    raw = decodeURIComponent(raw);
  } catch {
    /* keep it as typed */
  }
  const kind = classify(raw, latest);
  let to = routeFor(kind);
  // a height past the tip still has a page: it counts down to the block
  if (!to && /^#?\d[\d,]*$/.test(raw.trim())) to = `/block?h=${raw.replace(/[#,]/g, '')}`;
  return { raw, kind, to };
}

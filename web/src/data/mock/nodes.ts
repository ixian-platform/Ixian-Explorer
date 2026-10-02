/**
 * Mock node set: 100 DLT and 50 S2 nodes spread over real cities by weight.
 * City-level positions only, jittered slightly; no IPs exist anywhere here.
 * Some nodes joined during the last 90 days, which drives the node-count
 * series, so the history ends exactly at today's list.
 */
import { CITIES } from '../geo/cities';
import { hf, h32 } from './rng';
import type { NodeKind } from '../types';

export const DLT_COUNT = 100;
export const S2_COUNT = 50;

export interface MockNode {
  id: string;
  index: number; // index within its kind
  kind: NodeKind;
  cityIndex: number;
  lat: number;
  lon: number;
  version: string;
  /** height from which the node is online */
  joinHeight: number;
  /** unix seconds of the last (re)start, relative offset from join */
  restartSalt: number;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/** Largest-remainder allocation of `total` nodes over city weights. */
function allocate(total: number, weight: (i: number) => number): number[] {
  const w = CITIES.map((_, i) => weight(i));
  const sum = w.reduce((a, b) => a + b, 0);
  const exact = w.map((x) => (x / sum) * total);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i]++;
    left--;
  }
  return out;
}

const DLT_VERSIONS = [
  ['xdc-0.9.14', 0.64],
  ['xdc-0.9.13', 0.27],
  ['xdc-0.9.12', 0.09],
] as const;
const S2_VERSIONS = [
  ['xs2c-0.9.14', 0.58],
  ['xs2c-0.9.13', 0.3],
  ['xs2c-0.9.11', 0.12],
] as const;

function pickVersion(list: readonly (readonly [string, number])[], u: number) {
  let acc = 0;
  for (const [v, p] of list) {
    acc += p;
    if (u < acc) return v;
  }
  return list[list.length - 1][0];
}

let cache: MockNode[] | null = null;

/**
 * @param hA the mock anchor height; late joiners are placed around it
 */
export function mockNodes(hA: number): MockNode[] {
  if (cache) return cache;
  const out: MockNode[] = [];
  const build = (kind: NodeKind, total: number, stable: number) => {
    const per = allocate(total, (i) => (kind === 'dlt' ? CITIES[i].dlt : CITIES[i].s2));
    // spread nodes so late joiners are not all in one city
    const slots: number[] = [];
    per.forEach((n, ci) => {
      for (let j = 0; j < n; j++) slots.push(ci);
    });
    // deterministic shuffle (seeded Fisher-Yates)
    for (let i = slots.length - 1; i > 0; i--) {
      const j = h32(i, kind === 'dlt' ? 51 : 52) % (i + 1);
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    slots.forEach((ci, idx) => {
      const c = CITIES[ci];
      const salt = kind === 'dlt' ? 53 : 54;
      // jitter up to ~0.25 degrees: enough to separate dots, still city-level
      const lat = r2(c.lat + (hf(idx, salt, 1) - 0.5) * 0.5);
      const lon = r2(c.lon + (hf(idx, salt, 2) - 0.5) * 0.5);
      const late = idx >= stable;
      // late joiners arrive between 90 days before the anchor and a week after it
      const joinHeight = late
        ? hA - 250_000 + Math.floor(((idx - stable) / Math.max(1, total - stable)) * 270_000 + hf(idx, salt, 3) * 9_000)
        : 1;
      out.push({
        id: `${kind}-${String(idx + 1).padStart(3, '0')}`,
        index: idx,
        kind,
        cityIndex: ci,
        lat,
        lon,
        version: pickVersion(kind === 'dlt' ? DLT_VERSIONS : S2_VERSIONS, hf(idx, salt, 4)),
        joinHeight,
        restartSalt: h32(idx, salt, 5),
      });
    });
  };
  build('dlt', DLT_COUNT, 86);
  build('s2', S2_COUNT, 38);
  cache = out;
  return out;
}

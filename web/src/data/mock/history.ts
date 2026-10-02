/**
 * Per-address history for the mock chain: scans the address's own edges (and
 * its reward or mining role) over the indexed window, so an address page and
 * the block that holds each transaction always agree.
 */
import {
  getEdges,
  edgeTx,
  traffic,
  signed,
  rewardSplit,
  mined,
  minerOf,
  NODE0,
  MINER0,
  STRESS_A,
  STRESS_B,
  H_A,
  W0,
  H_S0,
  H_S1,
  stressCount,
  POOL,
  type TxRef,
} from './chain';
import { DLT_COUNT } from './nodes';
import { miningRewardAt } from '../emission';
import { SEED, fmix } from './rng';

export interface Events {
  /** newest first */
  h: Int32Array;
  kind: Uint8Array;
  id: Int32Array;
  /** balance change in 1e-8 units */
  delta: Float64Array;
  n: number;
  /** highest height scanned */
  to: number;
}

const STRESS_AMOUNT = 1_000_000; // 0.01 IXI
const STRESS_FEE = 1_000_000;

const cache = new Map<number, Events>();

function fires(e: number, h: number, pm: number): boolean {
  return fmix(Math.imul(e + 1, 0x9e3779b1) ^ Math.imul(h, 0x85ebca77) ^ SEED) / 4294967296 < pm;
}

/** Scan [from, to] (inclusive) for address k, newest first. */
function scan(k: number, from: number, to: number) {
  const E = getEdges();
  const inc = E.inc[k] || [];
  const isNode = k >= NODE0 && k < NODE0 + DLT_COUNT;
  const node = k - NODE0;
  const isMiner = k >= MINER0 && k < MINER0 + 30;
  const H: number[] = [];
  const K: number[] = [];
  const I: number[] = [];
  const D: number[] = [];
  const push = (h: number, kind: number, id: number, d: number) => {
    H.push(h);
    K.push(kind);
    I.push(id);
    D.push(d);
  };
  if (k === STRESS_A || k === STRESS_B) {
    for (let h = Math.min(to, H_S1 - 1); h >= Math.max(from, H_S0); h--) {
      const c = stressCount(h);
      for (let j = c - 1; j >= 0; j--) push(h, 3, j, k === STRESS_A ? -(STRESS_AMOUNT + STRESS_FEE) : STRESS_AMOUNT);
    }
    return { H, K, I, D };
  }
  const sorted = inc.slice().sort((a, b) => a - b);
  for (let h = to; h >= from; h--) {
    if (isNode && signed(node, h)) {
      const r = rewardSplit(h);
      let first = 0;
      while (!signed(first, h)) first++;
      push(h, 0, 0, r.share + (first === node ? r.rem : 0));
    }
    if (isMiner && mined(h) && minerOf(h) === k) push(h, 1, 0, 0); // amount filled below
    if (sorted.length) {
      const m = traffic(h);
      for (const e of sorted) {
        if (!fires(e, h, E.p[e] * m)) continue;
        const t = edgeTx(e, h);
        const d = t.from === k ? -(t.amount + t.fee) : t.amount;
        push(h, 2, e, d);
      }
    }
  }
  return { H, K, I, D };
}

/** All indexed events for address k up to `tip`, newest first. Cached and extended as blocks arrive. */
export function events(k: number, tip: number): Events {
  if (k < 0 || k >= POOL) return { h: new Int32Array(0), kind: new Uint8Array(0), id: new Int32Array(0), delta: new Float64Array(0), n: 0, to: tip };
  const prev = cache.get(k);
  if (prev && prev.to >= tip) return prev;
  const from = prev ? prev.to + 1 : W0;
  const s = scan(k, from, tip);
  // fill mining amounts
  for (let i = 0; i < s.K.length; i++) if (s.K[i] === 1) s.D[i] = Math.round(miningRewardAt(s.H[i]) * 1e8);
  const n = s.H.length + (prev ? prev.n : 0);
  const h = new Int32Array(n);
  const kind = new Uint8Array(n);
  const id = new Int32Array(n);
  const delta = new Float64Array(n);
  h.set(s.H, 0);
  kind.set(s.K, 0);
  id.set(s.I, 0);
  delta.set(s.D, 0);
  if (prev) {
    h.set(prev.h, s.H.length);
    kind.set(prev.kind, s.H.length);
    id.set(prev.id, s.H.length);
    delta.set(prev.delta, s.H.length);
  }
  const ev = { h, kind, id, delta, n, to: tip };
  cache.set(k, ev);
  return ev;
}

export const refAt = (ev: Events, i: number): TxRef => ({ h: ev.h[i], kind: ev.kind[i] as TxRef['kind'], id: ev.id[i] });

/** Balance in units at height x (x >= W0), given the anchor balance. */
export function balanceAt(base: number, ev: Events, x: number): bigint {
  let b = BigInt(base);
  for (let i = 0; i < ev.n; i++) {
    const h = ev.h[i];
    if (h > H_A && h <= x) b += BigInt(Math.round(ev.delta[i]));
    else if (h <= H_A && h > x) b -= BigInt(Math.round(ev.delta[i]));
  }
  return b;
}

/** Sum of balance changes for address k in (a, b], without caching the whole history. */
export function deltaBetween(k: number, a: number, b: number): number {
  const cached = cache.get(k);
  if (cached && cached.to >= b) {
    let d = 0;
    for (let i = 0; i < cached.n; i++) if (cached.h[i] > a && cached.h[i] <= b) d += cached.delta[i];
    return d;
  }
  const s = scan(k, a + 1, b);
  let d = 0;
  for (let i = 0; i < s.H.length; i++) d += s.K[i] === 1 ? Math.round(miningRewardAt(s.H[i]) * 1e8) : s.D[i];
  return d;
}

/**
 * Time series for the mock chain. Aggregates use expected values per block
 * (the traffic model), except the stress test, which uses exact block counts
 * so the TPS peak on the chart is the same block the block page shows.
 */
import type { Metric, Range, Series, SeriesPoint, TpsPeak } from '../types';
import {
  H_A,
  H_S0,
  H_S1,
  MINING_END,
  T_A,
  blocktime,
  expectedTx,
  heightAt,
  ts,
  expectedSigners,
  blockTxs,
  sigCountAt,
} from './chain';
import { mockNodes } from './nodes';
import { hf, noise1 } from './rng';
import { signingRewardAt, miningRewardAt } from '../emission';

export const RANGE_STEP: Record<Range, { step: number; count: number }> = {
  '24h': { step: 600, count: 144 },
  '7d': { step: 3600, count: 168 },
  '30d': { step: 21600, count: 120 },
  '90d': { step: 86400, count: 90 },
};

/* ------------------------------------------------------------- supply */

/** Mock supply at the anchor (IXI). */
const SUPPLY_A = 13_513_899_127;
const BLOCK_RATIO = 0.5; // share of blocks that were mined while mining ran

/** New IXI in block x (signing + mined share). */
function emittedIn(x: number): number {
  const s = signingRewardAt(x) ?? 60;
  const m = x <= MINING_END ? miningRewardAt(x) * BLOCK_RATIO : 0;
  return s + m;
}

/** Sum of emittedIn over (a, b]; piecewise constant after 1.8M blocks, so this is exact and quick. */
function emittedBetween(a: number, b: number): number {
  if (b <= a) return 0;
  const cuts = [MINING_END, 6_307_199, 9_460_799, 12_614_399, 15_767_999, 105_119_999];
  let sum = 0;
  let x = a;
  while (x < b) {
    const next = Math.min(b, ...cuts.filter((c) => c > x));
    sum += emittedIn(x + 1) * (next - x);
    x = next;
  }
  return sum;
}

export function supplyAt(h: number): number {
  return h >= H_A ? SUPPLY_A + emittedBetween(H_A, h) : SUPPLY_A - emittedBetween(h, H_A);
}

/* ------------------------------------------------------------- signers */

/** Network signer difficulty baseline (smooth). */
export function signerBaseline(h: number): number {
  const t = T_A + 30 * (h - H_A);
  const growth = 1 + 0.16 * ((t - T_A) / (90 * 86400));
  return 3.05e12 * growth * (1 + 0.05 * noise1(h / 5760, 81) + 0.015 * noise1(h / 240, 82));
}
export const requiredDifficulty = (h: number) => signerBaseline(h) * 0.0189;

/* ------------------------------------------------------------- series */

let peakCache: TpsPeak | null = null;
/** The stress test's busiest block: the TPS record. */
export function tpsRecord(): TpsPeak {
  if (peakCache) return peakCache;
  let best = { tps: 0, height: H_S0, timestamp: ts(H_S0) };
  for (let h = H_S0; h < H_S1; h++) {
    const bt = blocktime(h);
    const tps = Math.round((blockTxs(h).total / bt) * 100) / 100;
    if (tps > best.tps) best = { tps, height: h, timestamp: ts(h) };
  }
  peakCache = best;
  return best;
}

const cache = new Map<string, Series>();

export function mockSeries(metric: Metric, range: Range, nowSec: number): Series {
  const { step, count } = RANGE_STEP[range];
  const endBucket = Math.floor(nowSec / step) * step; // start of the current (partial) bucket
  const key = `${metric}|${range}|${endBucket}|${metric === 'tx' || metric === 'tps' ? '' : Math.floor(nowSec / 30)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const points: SeriesPoint[] = [];
  let peak: TpsPeak | null = null;
  const nodes = mockNodes(H_A);
  for (let i = count - 1; i >= 0; i--) {
    const t0 = endBucket - i * step;
    const t1 = Math.min(t0 + step, nowSec);
    const h0 = heightAt(t0) + 1;
    const h1 = heightAt(t1);
    const n = Math.max(0, h1 - h0 + 1);
    let v = 0;
    const p: SeriesPoint = { t: t0, v: 0 };
    if (n > 0) {
      p.h0 = h0;
      p.h1 = h1;
    }
    switch (metric) {
      case 'tx': {
        for (let h = h0; h <= h1; h++) v += expectedTx(h);
        v = Math.round(v);
        break;
      }
      case 'tps': {
        let best = 0;
        let bh = h0;
        for (let h = h0; h <= h1; h++) {
          const bt = blocktime(h) || 30;
          // per-block spread around the expected rate, so maxima look like maxima
          const x = h >= H_S0 && h < H_S1 ? blockTxs(h).total / bt : (expectedTx(h) * (1 + 0.9 * hf(h, 63) ** 3)) / bt;
          if (x > best) {
            best = x;
            bh = h;
          }
        }
        v = Math.round(best * 100) / 100;
        p.h = bh;
        if (!peak || best > peak.tps) peak = { tps: v, height: bh, timestamp: ts(bh) };
        break;
      }
      case 'nodesDlt':
      case 'nodesS2': {
        const kind = metric === 'nodesDlt' ? 'dlt' : 's2';
        const c = nodes.filter((x) => x.kind === kind && x.joinHeight <= h1).length;
        // brief dips as nodes restart, never above the joined count
        const dip = Math.floor(hf(Math.floor(t0 / 3600), kind === 'dlt' ? 83 : 84) ** 14 * 3);
        v = Math.max(0, c - (i === 0 ? 0 : dip));
        break;
      }
      case 'supply':
        v = Math.round(supplyAt(h1));
        p.h = h1;
        break;
      case 'emission':
        v = Math.round(supplyAt(h1) - supplyAt(h0 - 1));
        break;
      case 'blocktime': {
        let lo = Infinity;
        let hi = 0;
        for (let h = h0; h <= h1; h++) {
          const b = blocktime(h);
          if (b < lo) {
            lo = b;
            p.loH = h;
          }
          if (b > hi) {
            hi = b;
            p.hiH = h;
          }
        }
        v = n > 0 ? Math.round(((ts(h1) - ts(h0 - 1)) / n) * 100) / 100 : 30;
        p.lo = Number.isFinite(lo) ? lo : v;
        p.hi = hi || v;
        break;
      }
      case 'signerDifficulty':
      case 'hashrate': {
        const mid = Math.round((h0 + h1) / 2);
        const total = signerBaseline(mid) * (expectedSigners(mid) / 92);
        v = metric === 'hashrate' ? Math.round(total / 900) : Math.round(total);
        break;
      }
      case 'requiredDifficulty':
        v = Math.round(requiredDifficulty(Math.round((h0 + h1) / 2)));
        break;
      case 'sigRequired': {
        // the same sample as 'signatures': 75% of the previous block's signer count
        const k = Math.min(40, n);
        let sum = 0;
        for (let j = 0; j < k; j++) sum += Math.max(1, Math.floor(0.75 * sigCountAt(h0 + Math.floor(((j + 0.5) / k) * n) - 1)));
        v = k ? Math.round((sum / k) * 10) / 10 : 0;
        break;
      }
      case 'signatures': {
        // average of real (mock) signer counts over a sample of the bucket's blocks
        const k = Math.min(40, n);
        let sum = 0;
        for (let j = 0; j < k; j++) sum += sigCountAt(h0 + Math.floor(((j + 0.5) / k) * n));
        v = k ? Math.round((sum / k) * 10) / 10 : 0;
        break;
      }
      default:
        v = 0;
    }
    p.v = v;
    points.push(p);
  }
  const s: Series = { metric, range, step, points, peak: metric === 'tps' ? peak : undefined };
  if (cache.size > 200) cache.clear();
  cache.set(key, s);
  return s;
}

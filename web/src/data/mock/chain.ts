/**
 * The mock chain: a seeded, deterministic model of the Ixian DLT.
 *
 * Every block, transaction and address is a pure function of the seed and
 * its coordinates, computed on demand. Nothing is stored, so the chain can be
 * millions of blocks long and still load instantly, and the same seed always
 * gives the same data (safe for server rendering and hydration).
 *
 * How the pieces stay consistent:
 * - Transactions happen on fixed "edges" between pool addresses. Whether an
 *   edge fires at height h is a hash of (edge, h), so a block can list its
 *   transactions (scan all edges at h) and an address can list its history
 *   (scan its own edges over h) and both see the same transactions.
 * - IDs are invertible: a txid encodes (height, kind, id) and a block hash
 *   encodes its height, both under a key derived from the random-looking
 *   bytes, so lookups need no index.
 * - Supply, rewards and node counts follow the documented schedule and the
 *   mock node set.
 *
 * Nothing here is real. The UI marks every value as demo data.
 */
import { SEED, fmix, h32, hf, prng, bytes, noise1, hex } from './rng';
import { base58Encode, base58Decode, sha3_512 } from '@/lib/sha3';
import { sha512 } from '@/lib/sha512';
import { KNOWN_LIST } from '../knownWallets';
import { signingRewardAt } from '../emission';
import { mockNodes, DLT_COUNT } from './nodes';

/* ------------------------------------------------------------------ time */

/** Anchor: block 6,208,000 at 1 Sep 2026 00:00 UTC. */
export const H_A = 6_208_000;
export const T_A = Date.UTC(2026, 8, 1) / 1000;
/** Mock: the last Argon2-mined block, 30 Jun 2026 (docs: mining retired in Q2 2026). */
export const MINING_END = 6_026_560;
/** Address histories are indexed from here (about 90 days before the anchor). */
export const W0 = H_A - 260_000;
/** Mock stress test: 19 Aug 2026, 14:00 to 16:00 UTC. */
export const H_S0 = 6_172_240;
export const H_S1 = 6_172_480;

const STRESS_SLOW = 5; // extra seconds per block at the height of the test

function stressShape(h: number): number {
  if (h < H_S0 || h >= H_S1) return 0;
  const x = (h - H_S0 + 0.5) / (H_S1 - H_S0);
  // quick ramp, long plateau with wobble, quick release
  const env = Math.min(1, x / 0.12) * Math.min(1, (1 - x) / 0.1);
  return Math.max(0, env * (0.86 + 0.1 * Math.sin(x * 23) + 0.04 * (hf(h, 71) - 0.5)));
}

/** Seconds the stress test added to blocks after h (blocks before it sit earlier). */
let slowAfterCache: Float64Array | null = null;
function slowAfter(h: number): number {
  if (h >= H_S1) return 0;
  if (!slowAfterCache) {
    const n = H_S1 - H_S0;
    const a = new Float64Array(n + 1);
    for (let i = n - 1; i >= 0; i--) a[i] = a[i + 1] + STRESS_SLOW * stressShape(H_S0 + i);
    slowAfterCache = a;
  }
  if (h < H_S0) return slowAfterCache[0];
  return slowAfterCache[h - H_S0 + 1];
}

/** Block timestamp (unix seconds). */
export function ts(h: number): number {
  const jitter = (hf(h, 5) - 0.5) * 11;
  return Math.round(T_A + 30 * (h - H_A) + jitter - slowAfter(h));
}

export const blocktime = (h: number) => (h <= 1 ? 0 : ts(h) - ts(h - 1));

/** The highest height whose timestamp is at or before t. */
export function heightAt(t: number): number {
  let h = H_A + Math.floor((t - T_A) / 30) + 3;
  if (h > H_S0 - 200 && h < H_S1 + 400) h += 60; // the stress window shifts timestamps
  while (h > 1 && ts(h) > t) h--;
  while (ts(h + 1) <= t) h++;
  return Math.max(1, h);
}

/* --------------------------------------------------------------- traffic */

/** Traffic multiplier at height h (mean about 1), memoised over the indexed window. */
const TRAFFIC_SPAN = 600_000;
let trafficMemo: Float32Array | null = null;
export function traffic(h: number): number {
  const i = h - W0;
  if (i < 0 || i >= TRAFFIC_SPAN) return trafficAt(h);
  if (!trafficMemo) trafficMemo = new Float32Array(TRAFFIC_SPAN).fill(-1);
  let v = trafficMemo[i];
  if (v < 0) {
    v = trafficAt(h);
    trafficMemo[i] = v;
  }
  return v;
}

/** Daily and weekly rhythm, slow growth, noise, bursts. */
function trafficAt(h: number): number {
  const t = T_A + 30 * (h - H_A);
  const hour = (t / 3600) % 24;
  const day = Math.floor(t / 86400);
  const dow = (day + 4) % 7; // 0 = Sunday
  const diurnal = 1 + 0.35 * Math.cos((2 * Math.PI * (hour - 14)) / 24);
  const weekly = dow === 0 || dow === 6 ? 0.84 : 1.04;
  const trend = 1 + 0.18 * Math.max(-1.5, Math.min(1.5, (t - T_A) / (90 * 86400)));
  const n = 1 + 0.22 * noise1(t / 21600, 21) + 0.08 * noise1(t / 3000, 22);
  const burstDay = hf(day, 23) < 0.09;
  const burst = burstDay ? 1 + 1.4 * Math.max(0, Math.cos((2 * Math.PI * (hour - 3 - 18 * hf(day, 24))) / 24)) ** 6 : 1;
  return Math.max(0.12, diurnal * weekly * trend * n * burst);
}

const NORMAL_PER_BLOCK = 20; // mean edge transactions per block at traffic 1

/* ------------------------------------------------------------- addresses */

export const POOL = 3000;
export const NODE0 = 7; // 100 DLT node wallets
export const MINER0 = 107; // 30 legacy miners
export const STRESS_A = 137;
export const STRESS_B = 138;
export const USER0 = 139;
/** the first 30 users are services: busy, well funded */
export const SERVICES = 30;

const addrCache = new Map<number, string>();

function fold16(b: Uint8Array, from: number): number {
  let x = 0x811c9dc5;
  for (let i = from; i < b.length; i++) x = Math.imul(x ^ b[i], 0x01000193);
  return fmix(x) & 0xffff;
}

/** Address string for pool index k. Known wallets keep their real address. */
export function addressOf(k: number): string {
  if (k < KNOWN_LIST.length) return KNOWN_LIST[k];
  const hit = addrCache.get(k);
  if (hit) return hit;
  const version = hf(k, 31) < 0.45 ? 1 : 2;
  const payload = bytes(44, k, 32);
  const key = fold16(payload, 2);
  const v = (k ^ key) & 0xffff;
  payload[0] = v >> 8;
  payload[1] = v & 0xff;
  const body = new Uint8Array(45);
  body[0] = version;
  body.set(payload, 1);
  const sum = version === 2 ? sha3_512(sha3_512(body)) : sha512(sha512(body));
  const full = new Uint8Array(48);
  full.set(body);
  full.set(sum.slice(0, 3), 45);
  const s = base58Encode(full);
  addrCache.set(k, s);
  return s;
}

/** Pool index of an address string, or -1. */
export function indexOfAddress(s: string): number {
  const known = KNOWN_LIST.indexOf(s);
  if (known >= 0) return known;
  const b = base58Decode(s);
  if (!b || b.length !== 48 || (b[0] !== 1 && b[0] !== 2)) return -1;
  const payload = b.slice(1, 45);
  const k = (((payload[0] << 8) | payload[1]) ^ fold16(payload, 2)) & 0xffff;
  if (k < KNOWN_LIST.length || k >= POOL) return -1;
  return addressOf(k) === s ? k : -1;
}

/** Balance at the anchor height, in 1e-8 units. */
export function baseBalance(k: number): number {
  const known = [620e6, 380e6, 2.1e6, 310e6, 84e6, 41e6, 12.5e6];
  let ixi: number;
  if (k < NODE0) ixi = known[k];
  else if (k < MINER0) ixi = 2e4 * Math.exp(4.8 * hf(k, 33));
  else if (k < STRESS_A) ixi = 4e5 * Math.exp(3.6 * hf(k, 34));
  else if (k === STRESS_A) ixi = 5e6;
  else if (k === STRESS_B) ixi = 2e4;
  else if (k < USER0 + SERVICES) ixi = 3e6 * Math.exp(3.4 * hf(k, 35)); // services and whales
  else ixi = Math.min(9e6, 20 * Math.pow(1 - hf(k, 36) * 0.9999, -1 / 0.8));
  const cents = Math.floor(hf(k, 37) * 1e8);
  return Math.round(ixi) * 1e8 + cents;
}

/* ----------------------------------------------------------------- edges */

interface Edges {
  a: Int32Array;
  b: Int32Array;
  p: Float64Array;
  scale: Float64Array; // typical amount in IXI
  multisig: Uint8Array;
  inc: number[][];
  n: number;
}
let edges: Edges | null = null;

export function getEdges(): Edges {
  if (edges) return edges;
  const r = prng(SEED ^ 0xed9e5);
  const A: number[] = [];
  const B: number[] = [];
  const P: number[] = [];
  const S: number[] = [];
  const MS: number[] = [];
  const users = POOL - USER0;
  const user = () => USER0 + SERVICES + Math.floor(Math.pow(r(), 1.4) * (users - SERVICES));
  const ixiOf = (k: number) => baseBalance(k) / 1e8;
  /** amounts stay a small share of the poorer side, so balances wander but hold up */
  const add = (a: number, b: number, p: number, share: number, ms = 0) => {
    if (a === b) return;
    A.push(a);
    B.push(b);
    P.push(p);
    S.push(Math.max(0.5, share * Math.min(ixiOf(a), ixiOf(b))));
    MS.push(ms);
  };
  // services (payment processors, bots, market makers): the bulk of daily traffic
  for (let i = 0; i < SERVICES; i++) {
    for (let j = 0; j < 5; j++) {
      const k = USER0 + ((i + 1 + Math.floor(r() * (SERVICES - 1))) % SERVICES);
      add(USER0 + i, k, 0, 0.00008 + 0.00016 * r());
    }
    add(USER0 + i, 3 + Math.floor(r() * 4), 0, 0.00015);
  }
  const serviceEdges = A.length;
  // exchanges and the bridge with their customers
  for (const hub of [3, 4, 5, 6]) {
    const deg = hub === 6 ? 14 : 30;
    for (let i = 0; i < deg; i++) add(hub, user(), 4e-4 * (0.5 + 1.5 * r()), 0.008 + 0.017 * r());
  }
  // hubs move funds between themselves now and then
  add(4, 5, 4e-3, 0.004);
  add(5, 6, 3e-3, 0.004);
  add(3, 4, 2e-3, 0.002);
  // genesis wallets: rare, large
  add(0, 3, 4e-6, 0.002);
  add(1, 4, 3e-6, 0.002);
  // node operators sell part of their rewards
  for (let n = NODE0; n < NODE0 + DLT_COUNT; n++) if (r() < 0.55) add(n, 3 + Math.floor(r() * 4), 2e-4 * (0.5 + r()), 0.01);
  // legacy miners
  for (let m = MINER0; m < STRESS_A; m++) add(m, 4 + Math.floor(r() * 3), 3e-4 * (0.5 + r()), 0.008);
  // people paying people
  for (let u = USER0 + SERVICES; u < POOL; u++) {
    const deg = r() < 0.12 ? 0 : 1 + Math.floor(r() * r() * 4);
    for (let i = 0; i < deg; i++) add(u, user(), 1e-4 * (0.3 + 2.7 * Math.pow(r(), 2)), 0.01 + 0.03 * r());
  }
  // a few multisig wallets
  for (let i = 0; i < 14; i++) add(USER0 + SERVICES + 3 + i * 7, user(), 3e-4 * (0.5 + r()), 0.01, 1);

  // services carry whatever the rest leaves of the average traffic
  const n = A.length;
  const rest = P.reduce((x, y) => x + y, 0);
  const each = Math.max(0, NORMAL_PER_BLOCK - rest) / serviceEdges;
  for (let i = 0; i < serviceEdges; i++) P[i] = each * (0.4 + 1.2 * hf(i, 44));
  const p = Float64Array.from(P, (x) => Math.min(0.9, x));
  const inc: number[][] = Array.from({ length: POOL }, () => []);
  for (let i = 0; i < n; i++) {
    inc[A[i]].push(i);
    inc[B[i]].push(i);
  }
  edges = {
    a: Int32Array.from(A),
    b: Int32Array.from(B),
    p,
    scale: Float64Array.from(S),
    multisig: Uint8Array.from(MS),
    inc,
    n,
  };
  return edges;
}

/** Does edge e carry a transaction in block h? (m = traffic(h), passed in for speed) */
function fires(e: number, h: number, pm: number): boolean {
  return fmix(Math.imul(e + 1, 0x9e3779b1) ^ Math.imul(h, 0x85ebca77) ^ SEED) / 4294967296 < pm;
}

function gauss(a: number, b: number) {
  return Math.sqrt(-2 * Math.log(1 - a)) * Math.cos(2 * Math.PI * b);
}

const FEE = 1_000_000; // 0.01 IXI in 1e-8 units

export interface EdgeTx {
  from: number;
  to: number;
  amount: number; // units
  fee: number;
  type: 0 | 4 | 5 | 6;
}

export function edgeTx(e: number, h: number): EdgeTx {
  const E = getEdges();
  const dir = h32(e, h, 7) & 1;
  const from = dir ? E.b[e] : E.a[e];
  const to = dir ? E.a[e] : E.b[e];
  let type: EdgeTx['type'] = 0;
  if (E.multisig[e]) {
    const u = hf(e, h, 10);
    type = u < 0.82 ? 4 : u < 0.94 ? 6 : 5;
  }
  let ixi = E.scale[e] * Math.exp(0.9 * gauss(hf(e, h, 8), hf(e, h, 9)));
  if (hf(e, h, 11) < 0.45) ixi = Math.max(1, Math.round(ixi));
  let amount = Math.round(ixi * 1e8);
  if (type === 5 || type === 6) amount = 0;
  return { from, to, amount, fee: FEE, type };
}

/* ---------------------------------------------------------------- blocks */

const nodes = () => mockNodes(H_A);

/** DLT node n (0-99) is online at h. */
export const nodeActive = (n: number, h: number) => nodes()[n].joinHeight <= h;

const signQ = (n: number) => 0.84 + 0.15 * hf(n, 42);

/** DLT node n signed block h. */
export function signed(n: number, h: number): boolean {
  if (!nodeActive(n, h)) return false;
  return hf(h, n, 41) < signQ(n);
}

let joinTable: { h: number[]; q: number[] } | null = null;
/** Expected number of signers at h (sum of signing odds of online nodes). */
export function expectedSigners(h: number): number {
  if (!joinTable) {
    const list = nodes()
      .filter((x) => x.kind === 'dlt')
      .map((x) => [x.joinHeight, signQ(x.index)] as const)
      .sort((a, b) => a[0] - b[0]);
    const H: number[] = [];
    const Q: number[] = [];
    let acc = 0;
    for (const [jh, q] of list) {
      acc += q;
      H.push(jh);
      Q.push(acc);
    }
    joinTable = { h: H, q: Q };
  }
  const { h: H, q: Q } = joinTable;
  let lo = 0;
  let hi = H.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (H[mid] <= h) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans < 0 ? 1 : Q[ans];
}

/** Signer count per height, memoised over the indexed window (node-wallet histories read it a lot). */
let sigMemo: Uint8Array | null = null;
export function sigCountAt(h: number): number {
  const i = h - W0;
  if (i < 0 || i >= TRAFFIC_SPAN) return signers(h).length;
  if (!sigMemo) sigMemo = new Uint8Array(TRAFFIC_SPAN).fill(255);
  let v = sigMemo[i];
  if (v === 255) {
    v = signers(h).length;
    sigMemo[i] = v;
  }
  return v;
}

/**
 * How block h's signing reward is split. The protocol weighs signers by their
 * PoW difficulty (docs: economics); the mock splits evenly and gives the
 * rounding remainder to the first signer, so the total is exactly the
 * scheduled reward.
 */
export function rewardSplit(h: number) {
  const total = rewardUnits(h);
  const n = Math.max(1, sigCountAt(h));
  const share = Math.floor(total / n);
  return { total, n, share, rem: total - share * n };
}

export function signers(h: number): number[] {
  const out: number[] = [];
  for (let n = 0; n < DLT_COUNT; n++) if (signed(n, h)) out.push(n);
  return out;
}

export const mined = (h: number) => h > 1 && h <= MINING_END && hf(h, 77) < 0.5;
export const minerOf = (h: number) => MINER0 + (h32(h, 78) % 30);

/** Stress-test transactions in block h. */
export function stressCount(h: number): number {
  const s = stressShape(h);
  if (s <= 0) return 0;
  return Math.round(2240 * s * blocktime(h));
}

export type TxKind = 0 | 1 | 2 | 3 | 4; // reward, pow, edge, stress, genesis
export interface TxRef {
  h: number;
  kind: TxKind;
  id: number;
}

/** Edge transactions in block h, in edge order. */
export function activeEdges(h: number): number[] {
  const E = getEdges();
  const m = traffic(h);
  const out: number[] = [];
  for (let e = 0; e < E.n; e++) if (fires(e, h, E.p[e] * m)) out.push(e);
  return out;
}

export interface BlockTxs {
  refs: TxRef[]; // everything except stress
  stress: number;
  total: number;
}

const blockTxCache = new Map<number, BlockTxs>();

export function blockTxs(h: number): BlockTxs {
  const hit = blockTxCache.get(h);
  if (hit) return hit;
  const refs: TxRef[] = [];
  if (h === 1) refs.push({ h, kind: 4, id: 0 });
  else {
    refs.push({ h, kind: 0, id: 0 });
    if (mined(h)) refs.push({ h, kind: 1, id: 0 });
    for (const e of activeEdges(h)) refs.push({ h, kind: 2, id: e });
  }
  const stress = stressCount(h);
  const v = { refs, stress, total: refs.length + stress };
  if (blockTxCache.size > 3000) blockTxCache.clear();
  blockTxCache.set(h, v);
  return v;
}

/** Expected transactions in block h (for series; cheap, no scan). */
export function expectedTx(h: number): number {
  return 1 + (mined(h) ? 1 : 0) + NORMAL_PER_BLOCK * traffic(h) + stressCount(h);
}

/** Signing reward in units for block h. */
export function rewardUnits(h: number): number {
  const r = signingRewardAt(h);
  return Math.round((r ?? 60) * 1e8);
}

/* ------------------------------------------------------------ ids / hashes */

function fold32(b: Uint8Array, from: number): number {
  let x = 0x811c9dc5;
  for (let i = from; i < b.length; i++) x = Math.imul(x ^ b[i], 0x01000193);
  return fmix(x);
}

/** Block checksum (SHA3-512 sized, 128 hex), encoding its height. */
export function blockHashBytes(h: number): Uint8Array {
  const b = bytes(64, h, 91);
  const key = fold32(b, 4);
  const v = (h ^ key) >>> 0;
  b[0] = v >>> 24;
  b[1] = (v >>> 16) & 255;
  b[2] = (v >>> 8) & 255;
  b[3] = v & 255;
  return b;
}
export const blockHash = (h: number) => hex(blockHashBytes(h));

export function heightOfHash(hash: string): number {
  if (!/^[0-9a-f]{128}$/.test(hash)) return -1;
  const b = new Uint8Array(64);
  for (let i = 0; i < 64; i++) b[i] = parseInt(hash.slice(i * 2, i * 2 + 2), 16);
  const v = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
  const h = (v ^ fold32(b, 4)) >>> 0;
  return h >= 1 && blockHash(h) === hash ? h : -1;
}

/** Height a transaction was created for (blockNr); applied at h. */
export function createdAt(r: TxRef): number {
  if (r.kind === 0 || r.kind === 1 || r.kind === 4) return r.h;
  return Math.max(1, r.h - 1 - (h32(r.h, r.kind, r.id, 3) % 2));
}

export function txid(r: TxRef): string {
  const b = bytes(32, r.h, r.kind * 1_000_003 + r.id, 93);
  const key = fold32(b, 6);
  const off = r.h - createdAt(r);
  b[0] = (r.kind ^ key) & 255;
  b[1] = ((r.id >>> 24) ^ (key >>> 8)) & 255;
  b[2] = ((r.id >>> 16) ^ (key >>> 16)) & 255;
  b[3] = ((r.id >>> 8) ^ (key >>> 24)) & 255;
  b[4] = ((r.id & 255) ^ key) & 255;
  b[5] = (off ^ (key >>> 8)) & 255;
  return `${createdAt(r)}-${base58Encode(b)}`;
}

export function refOfTxid(id: string): TxRef | null {
  const m = /^(\d+)-([1-9A-HJ-NP-Za-km-z]+)$/.exec(id.trim());
  if (!m) return null;
  const b = base58Decode(m[2]);
  if (!b || b.length !== 32) return null;
  const key = fold32(b, 6);
  const kind = ((b[0] ^ key) & 255) as TxKind;
  const idv =
    ((((b[1] ^ (key >>> 8)) & 255) << 24) |
      (((b[2] ^ (key >>> 16)) & 255) << 16) |
      (((b[3] ^ (key >>> 24)) & 255) << 8) |
      ((b[4] ^ key) & 255)) >>>
    0;
  const off = (b[5] ^ (key >>> 8)) & 255;
  if (kind > 4 || off > 3) return null;
  const h = Number(m[1]) + off;
  const ref: TxRef = { h, kind, id: idv };
  return txid(ref) === id.trim() ? ref : null;
}

/** Does this ref exist on the mock chain (up to `tip`)? */
export function refExists(r: TxRef, tip: number): boolean {
  if (r.h < 1 || r.h > tip) return false;
  switch (r.kind) {
    case 4:
      return r.h === 1 && r.id === 0;
    case 0:
      return r.h > 1 && r.id === 0;
    case 1:
      return r.id === 0 && mined(r.h);
    case 2:
      return r.id < getEdges().n && fires(r.id, r.h, getEdges().p[r.id] * traffic(r.h));
    case 3:
      return r.id < stressCount(r.h);
  }
}

export const hexOf = (n: number, a: number, b = 0) => hex(bytes(n, a, b, 95));

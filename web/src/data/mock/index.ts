/**
 * mockSource: the DataSource backed by the seeded mock chain.
 * Adds a small artificial latency so loading states are real, not theoretical.
 */
import type { DataSource } from '../source';
import type {
  AddressInfo,
  AddressTx,
  Block,
  LiveEvent,
  NetworkStatus,
  NodeInfo,
  Page,
  Range,
  Series,
  TopAddress,
  Transaction,
  TxIO,
  TxSummary,
  TxType,
} from '../types';
import { toAmount } from '../amount';
import { knownLabel } from '../knownWallets';
import { CITIES } from '../geo/cities';
import {
  H_A,
  H_S0,
  H_S1,
  W0,
  POOL,
  STRESS_A,
  STRESS_B,
  NODE0,
  addressOf,
  baseBalance,
  blockHash,
  blockTxs,
  blocktime,
  createdAt,
  edgeTx,
  heightAt,
  heightOfHash,
  hexOf,
  indexOfAddress,
  mined,
  minerOf,
  refExists,
  refOfTxid,
  rewardSplit,
  signers,
  stressCount,
  ts,
  txid,
  expectedTx,
  type TxRef,
} from './chain';
import { events, balanceAt, refAt, deltaBetween } from './history';
import { mockSeries, supplyAt, signerBaseline, requiredDifficulty, RANGE_STEP } from './series';
import { mockNodes } from './nodes';
import { h32, hf, bytes, hex } from './rng';
import { miningRewardAt, signingRewardAt } from '../emission';

const nowSec = () => Math.floor(Date.now() / 1000);
const tip = () => heightAt(nowSec());

/**
 * Review switches for the states every page must handle, via the URL:
 *   ?mock=slow   everything takes about 4 s (skeletons)
 *   ?mock=error  every request fails (error states and retry)
 */
function mockMode(): 'slow' | 'error' | null {
  if (typeof window === 'undefined') return null;
  const m = new URLSearchParams(window.location.search).get('mock');
  return m === 'slow' || m === 'error' ? m : null;
}

// a small simulated delay, so loading states still show; ?mock=slow adds 4 s to review them.
function later<T>(fn: () => T, ms = 30 + Math.random() * 50): Promise<T> {
  const mode = mockMode();
  if (mode === 'slow') ms += 4000;
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      if (mode === 'error') return reject(new Error('Demo error: the data source did not answer (?mock=error).'));
      try {
        resolve(fn());
      } catch (e) {
        reject(e);
      }
    }, ms)
  );
}

/* ----------------------------------------------------------------- blocks */

const STRESS_UNITS = 1_000_000; // 0.01 IXI
const GENESIS_EACH = BigInt('100016000000000000'); // 1,000,160,000 IXI each (docs: 2,000,320,000 at genesis)

function signerDifficulty(n: number, h: number): number {
  return (signerBaseline(h) / 92) * Math.exp(0.9 * (hf(n, 88) - 0.5)) * (1 + 0.05 * (hf(n, h, 89) - 0.5));
}

const fmtDec = (x: number) => x.toFixed(8);

function sigRequiredAt(h: number): number {
  if (h <= 2) return 1;
  return Math.max(1, Math.floor(0.75 * signers(h - 1).length));
}

const blockCache = new Map<number, Block>();

function buildBlock(h: number): Block {
  const hit = blockCache.get(h);
  if (hit) return hit;
  const bt = blockTxs(h);
  const sig = h === 1 ? [] : signers(h);
  let amount = BigInt(0);
  for (const r of bt.refs) amount += refAmountUnits(r);
  amount += BigInt(bt.stress * STRESS_UNITS);
  const total = sig.reduce((a, n) => a + signerDifficulty(n, h), 0);
  const x = BigInt(Math.round(5.4e14 * (1 + 0.1 * (hf(h, 96) - 0.5))));
  const diff = (BigInt(2) ** BigInt(64) - x).toString();
  const b: Block = {
    id: h,
    blockChecksum: blockHash(h),
    lastBlockChecksum: h > 1 ? blockHash(h - 1) : '',
    wsChecksum: hexOf(64, h, 1),
    sigFreezeChecksum: h > 5 ? hexOf(64, h - 5, 2) : '',
    powField: mined(h) ? hex(bytes(3, h, 97)) + '0000000000' : '',
    difficulty: diff,
    sigCount: sig.length,
    txCount: bt.total,
    txAmount: toAmount(amount),
    timestamp: ts(h),
    version: 12,
    hashrate: String(Math.round(total / 900)),
    blocktime: blocktime(h),
    totalSignerDifficulty: fmtDec(total),
    sigRequired: sigRequiredAt(h),
    requiredSignerDifficulty: fmtDec(requiredDifficulty(h)),
    sigChecksum: hexOf(64, h, 3),
  };
  if (blockCache.size > 2000) blockCache.clear();
  blockCache.set(h, b);
  return b;
}

/* ----------------------------------------------------------- transactions */

function refType(r: TxRef): TxType {
  if (r.kind === 0) return 2;
  if (r.kind === 1) return 1;
  if (r.kind === 4) return 3;
  if (r.kind === 3) return 0;
  return edgeTx(r.id, r.h).type;
}

function refAmountUnits(r: TxRef): bigint {
  return BigInt(refAmountRaw(r));
}

function refAmountRaw(r: TxRef): number | bigint {
  switch (r.kind) {
    case 0:
      return rewardSplit(r.h).total;
    case 1:
      return Math.round(miningRewardAt(r.h) * 1e8);
    case 2:
      return edgeTx(r.id, r.h).amount;
    case 3:
      return STRESS_UNITS;
    case 4:
      return GENESIS_EACH * BigInt(2);
  }
}

function refFee(r: TxRef): number {
  return r.kind === 2 ? edgeTx(r.id, r.h).fee : r.kind === 3 ? STRESS_UNITS : 0;
}

function summary(r: TxRef): TxSummary {
  const base = { id: txid(r), type: refType(r), applied: r.h, timestamp: ts(r.h) };
  const amount = refAmountUnits(r);
  const fee = refFee(r);
  switch (r.kind) {
    case 0: {
      const s = signers(r.h);
      return { ...base, amount: toAmount(amount), fee: toAmount(0), from: null, to: s.length ? addressOf(NODE0 + s[0]) : null, fromCount: 0, toCount: s.length };
    }
    case 1:
      return { ...base, amount: toAmount(amount), fee: toAmount(0), from: null, to: addressOf(minerOf(r.h)), fromCount: 0, toCount: 1 };
    case 4:
      return { ...base, amount: toAmount(amount), fee: toAmount(0), from: null, to: addressOf(0), fromCount: 0, toCount: 2 };
    case 3:
      return { ...base, amount: toAmount(amount), fee: toAmount(fee), from: addressOf(STRESS_A), to: addressOf(STRESS_B), fromCount: 1, toCount: 1 };
    case 2: {
      const t = edgeTx(r.id, r.h);
      return { ...base, amount: toAmount(t.amount), fee: toAmount(t.fee), from: addressOf(t.from), to: addressOf(t.to), fromCount: 1, toCount: 1 };
    }
  }
}

function fullTx(r: TxRef): Transaction {
  const s = summary(r);
  let from: TxIO[] = [];
  let to: TxIO[] = [];
  let data = '';
  switch (r.kind) {
    case 0: {
      const sp = rewardSplit(r.h);
      to = signers(r.h).map((n, i) => ({ address: addressOf(NODE0 + n), amount: toAmount(sp.share + (i === 0 ? sp.rem : 0)) }));
      break;
    }
    case 1:
      to = [{ address: addressOf(minerOf(r.h)), amount: s.amount }];
      data = hex(bytes(24, r.h, 98));
      break;
    case 4:
      to = [
        { address: addressOf(0), amount: toAmount(GENESIS_EACH) },
        { address: addressOf(1), amount: toAmount(GENESIS_EACH) },
      ];
      break;
    case 3:
      from = [{ address: addressOf(STRESS_A), amount: toAmount(STRESS_UNITS * 2) }];
      to = [{ address: addressOf(STRESS_B), amount: s.amount }];
      break;
    case 2: {
      const t = edgeTx(r.id, r.h);
      from = [{ address: addressOf(t.from), amount: toAmount(t.amount + t.fee) }];
      to = [{ address: addressOf(t.to), amount: toAmount(t.amount) }];
      if (hf(r.id, r.h, 99) < 0.06) data = hex(bytes(12, r.h, r.id));
      break;
    }
  }
  const signedTx = r.kind !== 0 && r.kind !== 4;
  return {
    id: s.id,
    type: s.type,
    blockNr: createdAt(r),
    applied: r.h,
    timestamp: s.timestamp,
    amount: s.amount,
    fee: s.fee,
    from,
    to,
    nonce: String(h32(r.h, r.kind, r.id, 12) % 9_000_000),
    signature: signedTx ? hex(bytes(512, r.h, r.kind * 7919 + r.id)) : '',
    checksum: hex(bytes(32, r.h, r.kind * 104729 + r.id)),
    data,
    version: 7,
  };
}

/** Refs of block h, stress transactions included, in block order. */
function blockRefAt(h: number, i: number): TxRef {
  const bt = blockTxs(h);
  if (i < bt.refs.length) return bt.refs[i];
  return { h, kind: 3, id: i - bt.refs.length };
}

/* ------------------------------------------------------------- addresses */

const stressTable = (() => {
  let t: { h: number; c: number }[] | null = null;
  return () => {
    if (!t) {
      t = [];
      for (let h = H_S1 - 1; h >= H_S0; h--) {
        const c = stressCount(h);
        if (c > 0) t.push({ h, c });
      }
    }
    return t;
  };
})();

function isStress(k: number) {
  return k === STRESS_A || k === STRESS_B;
}

function stressInfo(k: number, top: number) {
  const tab = stressTable().filter((x) => x.h <= top);
  const n = tab.reduce((a, x) => a + x.c, 0);
  const per = k === STRESS_A ? -2 * STRESS_UNITS : STRESS_UNITS;
  return { tab, n, per };
}

function addressBalance(k: number, top: number): bigint {
  if (isStress(k)) {
    const { tab, per } = stressInfo(k, top);
    // all stress blocks are before the anchor
    let b = BigInt(baseBalance(k));
    for (const x of tab) if (x.h > top) b -= BigInt(per * x.c);
    return b;
  }
  return balanceAt(baseBalance(k), events(k, top), top);
}

function addressInfo(addr: string): AddressInfo | null {
  const k = indexOfAddress(addr);
  if (k < 0) return null;
  const top = tip();
  const label = knownLabel(addr);
  if (isStress(k)) {
    const { tab, n, per } = stressInfo(k, top);
    const moved = BigInt(Math.abs(per)) * BigInt(n);
    return {
      address: addr,
      amount: toAmount(addressBalance(k, top)),
      lastblock: tab[0]?.h ?? W0,
      txcount: n,
      firstblock: tab[tab.length - 1]?.h ?? null,
      label,
      received: toAmount(k === STRESS_B ? moved : BigInt(0)),
      sent: toAmount(k === STRESS_A ? moved : BigInt(0)),
    };
  }
  const ev = events(k, top);
  let rec = BigInt(0);
  let sent = BigInt(0);
  for (let i = 0; i < ev.n; i++) {
    const d = BigInt(Math.round(ev.delta[i]));
    if (d > BigInt(0)) rec += d;
    else sent -= d;
  }
  const bal = balanceAt(baseBalance(k), ev, top);
  return {
    address: addr,
    amount: toAmount(bal < BigInt(0) ? BigInt(0) : bal),
    lastblock: ev.n ? ev.h[0] : W0,
    txcount: ev.n,
    firstblock: ev.n ? ev.h[ev.n - 1] : null,
    label,
    received: toAmount(rec),
    sent: toAmount(sent),
  };
}

const amountOrder = new Map<string, Int32Array>();

function addressTxs(
  addr: string,
  page: number,
  pageSize: number,
  sort: 'time' | 'amount',
  dir: 'asc' | 'desc'
): Page<AddressTx> {
  const k = indexOfAddress(addr);
  const top = tip();
  if (k < 0) return { items: [], total: 0, page, pageSize };
  const row = (r: TxRef, delta: number): AddressTx => ({ ...summary(r), delta: toAmount(delta) });
  if (isStress(k)) {
    const { tab, n, per } = stressInfo(k, top);
    const out: AddressTx[] = [];
    // stress rows all have the same amount, so "amount" order is time order
    const start = page * pageSize;
    for (let i = start; i < Math.min(n, start + pageSize); i++) {
      const idx = dir === 'desc' ? i : n - 1 - i; // idx counts from newest
      let acc = 0;
      for (const x of tab) {
        if (idx < acc + x.c) {
          out.push(row({ h: x.h, kind: 3, id: x.c - 1 - (idx - acc) }, per));
          break;
        }
        acc += x.c;
      }
    }
    return { items: out, total: n, page, pageSize };
  }
  const ev = events(k, top);
  let order: ArrayLike<number> | null = null;
  if (sort === 'amount') {
    const key = `${k}|${ev.n}`;
    let o = amountOrder.get(key);
    if (!o) {
      o = Int32Array.from({ length: ev.n }, (_, i) => i).sort((a, b) => Math.abs(ev.delta[b]) - Math.abs(ev.delta[a]) || a - b);
      amountOrder.set(key, o);
    }
    order = o;
  }
  const items: AddressTx[] = [];
  const start = page * pageSize;
  for (let i = start; i < Math.min(ev.n, start + pageSize); i++) {
    const j = dir === 'desc' ? i : ev.n - 1 - i;
    const idx = order ? order[j] : j;
    items.push(row(refAt(ev, idx), ev.delta[idx]));
  }
  return { items, total: ev.n, page, pageSize };
}

function balanceSeries(addr: string, range: Range): Series {
  const k = indexOfAddress(addr);
  const { step, count } = RANGE_STEP[range];
  const now = nowSec();
  const end = Math.floor(now / step) * step;
  const top = tip();
  const points: Series['points'] = [];
  if (k < 0) return { metric: 'balance', range, step, points };
  if (isStress(k)) {
    for (let i = count - 1; i >= 0; i--) {
      const t = end - i * step;
      const h = heightAt(Math.min(t + step, now));
      points.push({ t, v: Number(addressBalance(k, h)) / 1e8, h });
    }
    return { metric: 'balance', range, step, points };
  }
  const ev = events(k, top);
  let bal = balanceAt(baseBalance(k), ev, top);
  let e = 0;
  const rev: Series['points'] = [];
  for (let i = 0; i < count; i++) {
    const t = end - i * step;
    const h = heightAt(Math.min(t + step, now));
    if (h < W0) break;
    while (e < ev.n && ev.h[e] > h) {
      bal -= BigInt(Math.round(ev.delta[e]));
      e++;
    }
    rev.push({ t, v: Math.max(0, Number(bal) / 1e8), h });
  }
  return { metric: 'balance', range, step, points: rev.reverse() };
}

/* ---------------------------------------------------------------- top list */

let topCache: { top: number; list: TopAddress[] } | null = null;

function topAddresses(limit: number): TopAddress[] {
  const top = tip();
  if (topCache && topCache.top === top) return topCache.list.slice(0, limit);
  const cands = Array.from({ length: POOL }, (_, k) => k)
    .sort((a, b) => baseBalance(b) - baseBalance(a))
    .slice(0, Math.max(60, limit + 10));
  const supply = supplyAt(top);
  const rows = cands
    .map((k) => ({ k, bal: isStress(k) ? addressBalance(k, top) : BigInt(baseBalance(k)) + BigInt(Math.round(deltaBetween(k, H_A, top))) }))
    .sort((a, b) => (b.bal > a.bal ? 1 : b.bal < a.bal ? -1 : a.k - b.k));
  const list = rows.map((r, i) => {
    const address = addressOf(r.k);
    return { rank: i + 1, address, amount: toAmount(r.bal), share: Number(r.bal) / 1e8 / supply, label: knownLabel(address) };
  });
  topCache = { top, list };
  return list.slice(0, limit);
}

/* ------------------------------------------------------------------ nodes */

function nodeList(): NodeInfo[] {
  const now = nowSec();
  const top = tip();
  return mockNodes(H_A)
    .filter((n) => n.joinHeight <= top)
    .map((n) => {
      const c = CITIES[n.cityIndex];
      const joined = n.joinHeight <= 1 ? now - 400 * 86400 : ts(n.joinHeight);
      const cycle = 3 * 86400 + (n.restartSalt % (60 * 86400));
      const restart = Math.max(joined, now - ((now + n.restartSalt) % cycle));
      return {
        id: n.id,
        kind: n.kind,
        city: c.name,
        country: c.country,
        countryCode: c.cc,
        lat: n.lat,
        lon: n.lon,
        version: n.version,
        uptime: now - restart,
        lastSeen: now - (h32(n.index, Math.floor(now / 30), n.kind === 'dlt' ? 1 : 2) % 40),
      };
    });
}

/* ------------------------------------------------------------------ status */

function status(): NetworkStatus {
  const h = tip();
  const b = buildBlock(h);
  let tx24 = 0;
  for (let x = h - 2879; x <= h; x++) tx24 += expectedTx(x);
  const d30 = mockSeries('tx', '30d', nowSec()).points.reduce((a, p) => a + p.v, 0);
  // all-time count: a mock anchor plus the model since then
  let since = 0;
  for (let x = H_A + 1; x <= h; x++) since += expectedTx(x);
  const nodes = nodeList();
  // ?mock=syncing shows the explorer 412 blocks behind the network, to review the notice
  const syncing = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mock') === 'syncing';
  return {
    blockheight: h,
    indexedHeight: syncing ? h - 412 : h,
    timestamp: b.timestamp,
    totalixi: Math.round(supplyAt(h)).toString(),
    hashrate: Number(b.hashrate),
    difficulty: b.difficulty,
    blockratio: 0,
    nodes_m: nodes.filter((n) => n.kind === 'dlt').length,
    nodes_r: nodes.filter((n) => n.kind === 's2').length,
    nodes_c: 0,
    tpsNow: b.blocktime ? Math.round((b.txCount / b.blocktime) * 100) / 100 : 0,
    // no TPS record in demo data: an invented record would read as a fact
    tpsPeak: { tps: 0, height: 0, timestamp: 0 },
    tx24h: Math.round(tx24),
    txAvgPerDay: Math.round(d30 / 30),
    txTotal: 104_612_388 + Math.round(since),
    signingReward: toAmount(Math.round((signingRewardAt(h + 1) ?? 0) * 1e8)),
  };
}

/* -------------------------------------------------------------------- live */

type Listener = (e: LiveEvent) => void;
const listeners = new Set<Listener>();
let ticker: ReturnType<typeof setInterval> | null = null;
let lastTip = 0;
const timers = new Set<ReturnType<typeof setTimeout>>();

function emit(e: LiveEvent) {
  listeners.forEach((l) => l(e));
}

function onTick() {
  const t = tip();
  if (!lastTip) lastTip = t;
  if (t <= lastTip) return;
  for (let h = lastTip + 1; h <= t; h++) {
    emit({ type: 'block', block: buildBlock(h) });
    // stream the block's transactions in over the next block interval
    const bt = blockTxs(h);
    const n = Math.min(bt.total, 40);
    for (let i = 0; i < n; i++) {
      const delay = 600 + ((i + 0.3 * hf(h, i, 5)) / n) * 26_000;
      const id = setTimeout(() => {
        timers.delete(id);
        emit({ type: 'tx', tx: summary(blockRefAt(h, i)) });
      }, delay);
      timers.add(id);
    }
  }
  lastTip = t;
}

/* ------------------------------------------------------------------ source */

export const mockSource: DataSource = {
  kind: 'mock',

  getStatus: () => later(status),
  getLatestBlock: () => later(() => buildBlock(tip())),
  getBlock: (height) => later(() => (height >= 1 && height <= tip() ? buildBlock(height) : null)),
  getBlockByHash: (hash) =>
    later(() => {
      const h = heightOfHash(hash.toLowerCase());
      return h >= 1 && h <= tip() ? buildBlock(h) : null;
    }),
  getBlocks: ({ before, limit }) =>
    later(() => {
      const top = Math.min(before ?? tip(), tip());
      const out: Block[] = [];
      for (let h = top; h >= Math.max(1, top - limit + 1); h--) out.push(buildBlock(h));
      return out;
    }),
  getSlowestBlocks: ({ from, to, page, pageSize }) =>
    later(() => {
      const hi = Math.min(to, tip());
      const lo = Math.max(1, from);
      const hs: number[] = [];
      for (let h = hi; h >= lo; h--) hs.push(h);
      hs.sort((a, b) => blocktime(b) - blocktime(a) || b - a);
      return { items: hs.slice(page * pageSize, (page + 1) * pageSize).map(buildBlock), total: hs.length, page, pageSize };
    }),
  getBlockTransactions: (height, { page, pageSize, type }) =>
    later(() => {
      if (height < 1 || height > tip()) return { items: [], total: 0, page, pageSize };
      const bt = blockTxs(height);
      if (type == null) {
        const items: TxSummary[] = [];
        for (let i = page * pageSize; i < Math.min(bt.total, (page + 1) * pageSize); i++) items.push(summary(blockRefAt(height, i)));
        return { items, total: bt.total, page, pageSize };
      }
      // filtered: refs of that type, then stress rows (type 0)
      const refs = bt.refs.filter((r) => refType(r) === type);
      const total = refs.length + (type === 0 ? bt.stress : 0);
      const items: TxSummary[] = [];
      for (let i = page * pageSize; i < Math.min(total, (page + 1) * pageSize); i++) {
        items.push(summary(i < refs.length ? refs[i] : { h: height, kind: 3, id: i - refs.length }));
      }
      return { items, total, page, pageSize };
    }),

  getTransaction: (id) =>
    later(() => {
      const r = refOfTxid(id);
      if (!r || !refExists(r, tip())) return null;
      return fullTx(r);
    }),
  getRecentTransactions: (limit) =>
    later(() => {
      const out: TxSummary[] = [];
      for (let h = tip(); h > 1 && out.length < limit; h--) {
        const bt = blockTxs(h);
        for (let i = Math.min(bt.total, 40) - 1; i >= 0 && out.length < limit; i--) out.push(summary(blockRefAt(h, i)));
      }
      return out;
    }),

  getAddress: (a) => later(() => addressInfo(a.trim())),
  getAddressTransactions: (a, { page, pageSize, sort, dir }) => later(() => addressTxs(a.trim(), page, pageSize, sort, dir)),
  getBalanceHistory: (a, range) => later(() => balanceSeries(a.trim(), range)),

  getSeries: (metric, range) => later(() => mockSeries(metric, range, nowSec()), 40 + Math.random() * 60),
  getTopAddresses: (limit) => later(() => topAddresses(limit)),
  getNodes: () => later(nodeList),

  subscribe(listener) {
    listeners.add(listener);
    if (!ticker) {
      lastTip = tip();
      ticker = setInterval(onTick, 1000);
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && ticker) {
        clearInterval(ticker);
        ticker = null;
        timers.forEach(clearTimeout);
        timers.clear();
      }
    };
  },
};

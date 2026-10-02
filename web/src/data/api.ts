/**
 * apiSource: real data from the ixiscope API on the explorer server.
 *
 * The API is the PHP folder ixiscope-api/ at the repository root (see its README): it runs
 * next to the existing explorer and reads the explorer's own database, and it
 * answers in the shapes of ./types.ts, so this file is mostly plumbing.
 *
 * Base: NEXT_PUBLIC_IXISCOPE_API, e.g. https://explorer.ixian.io/ixiscope-api
 * Every call is GET {base}/index.php?p={path}&..., so the server needs no URL
 * rewriting. No key: it serves the same public data the explorer pages show.
 *
 * The one thing the explorer does not have yet is where the nodes are. Until
 * the server publishes a node list, getNodes() rejects with
 * NotAvailableError and the UI shows counts and versions without the map.
 */
import type { DataSource } from "./source";
import type {
  AddressInfo,
  AddressTx,
  Block,
  NetworkStatus,
  NodeInfo,
  NodeVersion,
  Page,
  Series,
  TopAddress,
  Transaction,
  TxSummary,
} from "./types";
import { signingRewardAt } from "./emission";
import { knownLabel } from "./knownWallets";

const BASE = (
  process.env.NEXT_PUBLIC_IXISCOPE_API ||
  "https://explorer.ixian.io/ixiscope-api"
).replace(/\/+$/, "");

/** The server can't answer this yet (HTTP 204 or 501). The UI treats it as "not published", not as a failure. */
export class NotAvailableError extends Error {
  constructor(what: string) {
    super(`${what} is not available from the explorer yet.`);
    this.name = "NotAvailableError";
  }
}
export const isNotAvailable = (e: unknown) =>
  e instanceof Error && e.name === "NotAvailableError";

async function get<T>(
  path: string,
  query: Record<string, string | number | undefined> = {},
  what = "This",
): Promise<T | null> {
  const q = new URLSearchParams({ p: path });
  for (const [k, v] of Object.entries(query))
    if (v !== undefined) q.set(k, String(v));
  const r = await fetch(`${BASE}/index.php?${q}`, { cache: "no-store" });
  if (r.status === 404) return null;
  if (r.status === 204 || r.status === 501) throw new NotAvailableError(what);
  if (!r.ok) throw new Error(`ixiscope API ${r.status} on ${path}`);
  return (await r.json()) as T;
}

async function must<T>(
  path: string,
  query: Record<string, string | number | undefined> = {},
  what = "This",
): Promise<T> {
  const v = await get<T>(path, query, what);
  if (v == null) throw new Error(`ixiscope API: nothing at ${path}`);
  return v;
}

type ApiStatus = Omit<NetworkStatus, "signingReward">;
type ApiAddress = AddressInfo;

export const apiSource: DataSource = {
  kind: "api",

  async getStatus() {
    const s = await must<ApiStatus>("/status");
    return {
      ...s,
      signingReward: (signingRewardAt(s.blockheight + 1) ?? 0).toFixed(8),
    };
  },

  getLatestBlock: () => must<Block>("/blocks/latest"),
  getBlock: (height) => get<Block>(`/blocks/${height}`),
  getBlockByHash: (hash) =>
    get<Block>(`/blocks/hash/${encodeURIComponent(hash)}`),
  getBlocks: async ({ before, limit }) =>
    (await get<Block[]>("/blocks", { before, limit })) ?? [],
  getSlowestBlocks: ({ from, to, page, pageSize }) =>
    must<Page<Block>>("/blocks/slowest", { from, to, page, size: pageSize }),
  getBlockTransactions: (height, { page, pageSize, type }) =>
    must<Page<TxSummary>>(`/blocks/${height}/transactions`, {
      page,
      size: pageSize,
      type,
    }),

  getTransaction: (id) =>
    get<Transaction>(`/transactions/${encodeURIComponent(id)}`),
  getRecentTransactions: async (limit) =>
    (await get<TxSummary[]>("/transactions/recent", { limit })) ?? [],

  getAddress: async (addr) => {
    const a = await get<ApiAddress>(`/addresses/${encodeURIComponent(addr)}`);
    return a && { ...a, label: a.label ?? knownLabel(a.address) };
  },
  getAddressTransactions: (addr, { page, pageSize, sort, dir }) =>
    must<Page<AddressTx>>(
      `/addresses/${encodeURIComponent(addr)}/transactions`,
      { page, size: pageSize, sort, dir },
    ),
  getBalanceHistory: (addr, range) =>
    must<Series>(`/addresses/${encodeURIComponent(addr)}/balance`, { range }),

  getSeries: (metric, range) => must<Series>(`/stats/${metric}`, { range }),
  getTopAddresses: async (limit) =>
    ((await get<TopAddress[]>("/addresses/top", { limit })) ?? []).map((a) => ({
      ...a,
      label: a.label ?? knownLabel(a.address),
    })),
  getNodes: () => must<NodeInfo[]>("/nodes", {}, "The node list"),
  getNodeVersions: async () =>
    (await get<NodeVersion[]>("/nodes/versions")) ?? [],

  /** Polls every 10 s while the tab is visible: new blocks in order, then their transactions. */
  subscribe(listener) {
    let tip = 0;
    const seen = new Set<string>();
    let stopped = false;
    let busy = false;
    const poll = async () => {
      if (stopped || busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const latest = await this.getLatestBlock();
        if (tip && latest.id > tip) {
          const blocks =
            latest.id - tip > 1
              ? await this.getBlocks({
                  before: latest.id,
                  limit: Math.min(10, latest.id - tip),
                })
              : [latest];
          for (const b of blocks.slice().reverse())
            if (b.id > tip) listener({ type: "block", block: b });
          const txs = await this.getRecentTransactions(25);
          for (const t of txs.slice().reverse()) {
            if (t.applied > tip && !seen.has(t.id)) {
              seen.add(t.id);
              listener({ type: "tx", tx: t });
            }
          }
          if (seen.size > 500) seen.clear();
        }
        tip = latest.id;
      } catch {
        /* keep the last good state; never invent one */
      } finally {
        busy = false;
      }
    };
    poll();
    const id = setInterval(poll, 10_000);
    const onVis = () => document.visibilityState === "visible" && poll();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  },
};

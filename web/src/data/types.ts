/**
 * ixiscope data contract: the shapes the UI reads, from the demo data or from
 * the ixiscope API (ixiscope-api/, over the explorer database). Field names
 * follow the explorer's columns where they exist (`blockChecksum`, `sigCount`,
 * `txcount`, `nodes_m`, ...).
 *
 * - timestamps are numbers (unix seconds);
 * - `from` / `to` are arrays of { address, amount };
 * - amounts are decimal strings with 8 decimals, so no precision is lost
 *   (IXI supply does not fit a float at 1e-8).
 */

/** A decimal IXI amount with up to 8 decimals, e.g. "2881.51662599". */
export type Amount = string;

/**
 * Transaction types as stored by the current explorer (ixi_transactions.type)
 * and labelled in pages/transaction.php. docs.ixian.io lists 0-3 the same and
 * 4 as RegName.
 */
export type TxType = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** GET /status */
export interface NetworkStatus {
  /** the network's height, as the node reports it */
  blockheight: number;
  /**
   * The newest block the explorer has indexed. More than 10 below `blockheight` means the
   * explorer is catching up (the old explorer's "IXIScope is synchronizing" rule, index.php).
   */
  indexedHeight?: number;
  /** unix seconds of the latest block */
  timestamp: number;
  totalixi: Amount;
  hashrate: number;
  difficulty: string;
  blockratio: number;
  /** DLT nodes (nodeStatus `M`) */
  nodes_m: number;
  /** S2 nodes (nodeStatus `R`) */
  nodes_r: number;
  /** nodeStatus `C`; not shown until its meaning is confirmed */
  nodes_c: number;
  /** transactions per second over the latest block */
  tpsNow: number;
  /** the highest single-block TPS on record */
  tpsPeak: TpsPeak;
  /** transactions in the last 24 hours */
  tx24h: number;
  /** average transactions per day over the last 30 days */
  txAvgPerDay: number;
  /** all on-chain transactions */
  txTotal: number;
  /** IXI paid to signers per block at this height */
  signingReward: Amount;
}

export interface TpsPeak {
  tps: number;
  height: number;
  timestamp: number;
}

/** GET /blocks/{height}, /blocks/latest */
export interface Block {
  id: number;
  blockChecksum: string;
  lastBlockChecksum: string;
  wsChecksum: string;
  sigFreezeChecksum: string;
  powField: string;
  difficulty: string;
  sigCount: number;
  txCount: number;
  txAmount: Amount;
  timestamp: number;
  version: number;
  hashrate: string;
  /** seconds since the previous block */
  blocktime: number;
  totalSignerDifficulty: string;
  sigRequired: number;
  requiredSignerDifficulty: string;
  sigChecksum: string;
}

export interface TxIO {
  address: string;
  amount: Amount;
}

/** GET /transactions/{id} */
export interface Transaction {
  id: string;
  type: TxType;
  /** height the transaction was created for */
  blockNr: number;
  /** height of the block that includes it */
  applied: number;
  timestamp: number;
  amount: Amount;
  fee: Amount;
  from: TxIO[];
  to: TxIO[];
  nonce: string;
  signature: string;
  checksum: string;
  data: string;
  version: number;
}

/** A transaction row in lists (feeds, block and address tables). */
export interface TxSummary {
  id: string;
  type: TxType;
  applied: number;
  timestamp: number;
  amount: Amount;
  fee: Amount;
  /** first sender and first recipient, for one-line display */
  from: string | null;
  to: string | null;
  fromCount: number;
  toCount: number;
}

/** A row in an address's history: the transaction and what it did to the balance. */
export interface AddressTx extends TxSummary {
  /** signed change to this address's balance */
  delta: Amount;
}

/** GET /addresses/{address} */
export interface AddressInfo {
  address: string;
  amount: Amount;
  lastblock: number;
  txcount: number;
  /** first block with activity */
  firstblock: number | null;
  /** known-wallet label (Genesis, exchange, bridge) */
  label: string | null;
  /** totals over the indexed history */
  received: Amount;
  sent: Amount;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type SortDir = 'asc' | 'desc';
export type AddressTxSort = 'time' | 'amount';

export type Range = '24h' | '7d' | '30d' | '90d';
export const RANGES: Range[] = ['24h', '7d', '30d', '90d'];

export type Metric =
  | 'tx' // transactions per bucket
  | 'tps' // highest block TPS per bucket
  | 'nodesDlt'
  | 'nodesS2'
  | 'supply' // IXI in circulation at the end of each bucket
  | 'emission' // new IXI per bucket
  | 'blocktime' // average seconds per block
  | 'signerDifficulty' // total signer difficulty (average)
  | 'requiredDifficulty' // required signer difficulty (average)
  | 'hashrate' // estimated signer hashrate (average, h/s)
  | 'signatures' // average signatures per block
  | 'sigRequired' // average required signatures per block (ixi_blocks.sigRequired)
  | 'balance'; // an address's balance at the end of each bucket

export interface SeriesPoint {
  /** bucket start, unix seconds */
  t: number;
  v: number;
  /** block height the value belongs to (peaks, balances), when meaningful */
  h?: number;
  /** lowest and highest single value inside the bucket (block time band) */
  lo?: number;
  hi?: number;
  /** the blocks that hold lo and hi, so a table row can open them */
  loH?: number;
  hiH?: number;
  /** first and last block in the bucket, so a bucket can open its blocks */
  h0?: number;
  h1?: number;
}

export interface Series {
  metric: Metric;
  range: Range;
  /** bucket width in seconds */
  step: number;
  points: SeriesPoint[];
  /** for `tps`: the exact peak inside the range */
  peak?: TpsPeak | null;
}

export interface TopAddress {
  rank: number;
  address: string;
  amount: Amount;
  /** share of total supply, 0-1 */
  share: number;
  label: string | null;
}

export type NodeKind = 'dlt' | 's2';

/**
 * A node as the UI may show it: city-level location only, never an IP.
 * Real mode: the server resolves the IP to a city (ixiscope-api/nodes.php).
 */
export interface NodeInfo {
  id: string;
  kind: NodeKind;
  city: string;
  country: string;
  countryCode: string;
  /** city centre, slightly jittered, 2 decimals */
  lat: number;
  lon: number;
  /** node agent, e.g. "xdc-0.9.12" */
  version: string;
  /** seconds */
  uptime: number;
  /** unix seconds */
  lastSeen: number;
}

/** How many nodes report each agent version (the old explorer's countnodeversions, cache/nodes.ixi). */
export interface NodeVersion {
  kind: NodeKind;
  /** node agent, e.g. "xdc-0.9.12" */
  version: string;
  count: number;
}

export type LiveEvent =
  | { type: 'block'; block: Block }
  | { type: 'tx'; tx: TxSummary };

export interface BlockListOptions {
  /** highest height to include (defaults to the latest) */
  before?: number;
  limit: number;
}

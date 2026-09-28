/**
 * The one seam between the UI and its data.
 *
 * Pages and components only ever call `source`. To switch from generated demo
 * data to the real explorer, either set NEXT_PUBLIC_IXISCOPE_SOURCE=api at
 * build time, or change the single line marked SWITCH below to `apiSource`.
 * Set NEXT_PUBLIC_IXISCOPE_API to the ixiscope API on the explorer server
 * (ixiscope-api/ at the repository root, see its README). Everything else, including the "Demo data" marker,
 * follows `source.kind`.
 */
import type {
  AddressInfo,
  AddressTx,
  AddressTxSort,
  Block,
  BlockListOptions,
  LiveEvent,
  Metric,
  NetworkStatus,
  NodeInfo,
  NodeVersion,
  Page,
  Range,
  Series,
  SortDir,
  TopAddress,
  Transaction,
  TxSummary,
  TxType,
} from './types';
import { mockSource } from './mock';
import { apiSource } from './api';

export interface DataSource {
  /** 'mock' shows the Demo data marker everywhere and never claims to be live */
  kind: 'mock' | 'api';

  getStatus(): Promise<NetworkStatus>;
  getLatestBlock(): Promise<Block>;
  /** null when the block does not exist */
  getBlock(height: number): Promise<Block | null>;
  getBlockByHash(hash: string): Promise<Block | null>;
  /** newest first */
  getBlocks(opts: BlockListOptions): Promise<Block[]>;
  /**
   * Blocks from..to (inclusive), slowest block time first, paged. Optional: the UI hides
   * "Slowest first" when a source can't do it (the API needs
   * GET /blocks?from&to&sort=blocktime&page&limit for it).
   */
  getSlowestBlocks?(opts: { from: number; to: number; page: number; pageSize: number }): Promise<Page<Block>>;
  getBlockTransactions(height: number, opts: { page: number; pageSize: number; type?: TxType }): Promise<Page<TxSummary>>;

  getTransaction(id: string): Promise<Transaction | null>;
  /** newest first */
  getRecentTransactions(limit: number): Promise<TxSummary[]>;

  getAddress(address: string): Promise<AddressInfo | null>;
  getAddressTransactions(
    address: string,
    opts: { page: number; pageSize: number; sort: AddressTxSort; dir: SortDir }
  ): Promise<Page<AddressTx>>;
  getBalanceHistory(address: string, range: Range): Promise<Series>;

  getSeries(metric: Metric, range: Range): Promise<Series>;
  getTopAddresses(limit: number): Promise<TopAddress[]>;
  /** Rejects with NotAvailableError while the server does not publish node locations. */
  getNodes(): Promise<NodeInfo[]>;
  /** Version counts per node kind. Optional: without it, versions are counted from getNodes(). */
  getNodeVersions?(): Promise<NodeVersion[]>;

  /** New blocks and transactions as they arrive. Returns an unsubscribe function. */
  subscribe(listener: (e: LiveEvent) => void): () => void;
}

// SWITCH: the one line to change. `mockSource` = generated demo data, `apiSource` = the ixiscope API on the explorer server.
export const source: DataSource = process.env.NEXT_PUBLIC_IXISCOPE_SOURCE === 'api' ? apiSource : mockSource;

export const isDemo = () => source.kind === 'mock';

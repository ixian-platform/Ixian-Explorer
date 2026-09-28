/**
 * IXI emission schedule, from docs.ixian.io/docs/architecture/ixi-emission.
 * These are protocol facts, not data, so both sources share them.
 *
 * Where the docs and the PHP explorer's code (include/ixianlib.php) differ,
 * the docs win.
 */
import { links } from '@/lib/links';

export const BLOCK_SECONDS = 30; // docs: network-parameters, "Block Generation Interval: 30 seconds"
export const BLOCKS_PER_DAY = 2880;
export const REWARD_MATURITY = 960; // docs: network-parameters, rewardMaturity
export const SIGNER_RATIO = 0.75; // docs: network-parameters, networkSignerConsensusRatio
export const MAX_SIGNERS = 1000; // docs: network-parameters, maximumBlockSigners
export const GENESIS_SUPPLY = 2_000_320_000; // docs: ixi-emission, premine

export interface RewardStep {
  from: number;
  /** inclusive end, or null for open-ended */
  to: number | null;
  /** IXI per block, or null when the docs give a share of supply instead */
  reward: number | null;
  note?: string;
}

/** Signing rewards (docs: ixi-emission, "Signing Rewards"). */
export const SIGNING_SCHEDULE: RewardStep[] = [
  { from: 1, to: 86_400, reward: null, note: 'About 0.1% of supply per year' },
  { from: 86_401, to: 1_801_999, reward: null, note: 'About 5% of supply per year' },
  { from: 1_802_000, to: 6_307_199, reward: 576 },
  { from: 6_307_200, to: 9_460_799, reward: 864 },
  { from: 9_460_800, to: 12_614_399, reward: 432 },
  { from: 12_614_400, to: 15_767_999, reward: 81 },
  { from: 15_768_000, to: 105_119_999, reward: 45 },
  { from: 105_120_000, to: null, reward: 36 },
];

/** Argon2 mining rewards, legacy (docs: ixi-emission, "Argon2 Mining Rewards"). */
export const MINING_SCHEDULE: RewardStep[] = [
  { from: 1, to: 1_051_199, reward: null, note: 'Rises linearly from 10 IXI' },
  { from: 1_051_200, to: 1_801_999, reward: 4740.4 },
  { from: 1_802_000, to: 6_307_199, reward: 2304 },
];

/** Docs roadmap: "Argon2 Mining Deprecation", completed Q2 2026. */
export const MINING_RETIRED = { label: 'Q2 2026', href: links.docs.roadmap };

/** Signing reward per block in IXI at a height (null for the supply-share eras). */
export function signingRewardAt(h: number): number | null {
  const s = SIGNING_SCHEDULE.find((x) => h >= x.from && (x.to == null || h <= x.to));
  return s ? s.reward : null;
}

/** Linear first-year mining reward (docs: "linearly increases from 10 IXI"; slope from the explorer code). */
export function miningRewardAt(h: number): number {
  if (h < 1_051_200) return (h * 0.009 + 0.009) / 2 + 10;
  if (h < 1_802_000) return 4740.4;
  if (h < 6_307_200) return 2304;
  return 0;
}

/** The next change in the signing reward after height h. */
export function nextSigningChange(h: number): { at: number; from: number | null; to: number | null } | null {
  const i = SIGNING_SCHEDULE.findIndex((x) => h >= x.from && (x.to == null || h <= x.to));
  if (i < 0 || i === SIGNING_SCHEDULE.length - 1) return null;
  return { at: SIGNING_SCHEDULE[i + 1].from, from: SIGNING_SCHEDULE[i].reward, to: SIGNING_SCHEDULE[i + 1].reward };
}

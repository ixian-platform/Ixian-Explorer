/**
 * Known wallet labels, carried over from the current explorer (wallets.php).
 * These are labels, not balances: both sources use them.
 */
export type WalletKind = 'genesis' | 'exchange' | 'bridge' | 'burn';

export const KNOWN_WALLETS: Record<string, { label: string; kind: WalletKind }> = {
  '16LUmwUnU9M4Wn92nrvCStj83LDCRwvAaSio6Xtb3yvqqqCCz': { label: 'Genesis', kind: 'genesis' },
  '13fiCRZHPqcCFvQvuggKEjDvFsVLmwoavaBw1ng5PdSKvCUGp': { label: 'Genesis', kind: 'genesis' },
  '1ixianinfinimine234234234234234234234234234242HP': { label: 'Infinimine', kind: 'burn' },
  '4uuXowvxs3pWUKtGuBd9sypn2UmnLpygXHnCJ22X8YYdtry7NqFyZxm3otzJyHgVP': { label: 'IxiBridge', kind: 'bridge' },
  '4kUY8jDNxEoRJQweiLgUtbdWDaLgXMC6zHWPkfsY8gU9bmyxTth6J22mGQddrX4qu': { label: 'ViteX', kind: 'exchange' },
  '4WzxTwYMmAPHYK4RQjwaVAvHuopxGy59oNa5vuPwLs6tUkHoZwD5jyJZUgXFxfv4J': { label: 'ViteX', kind: 'exchange' },
  '3XZjEorLSEDWSCaJE2L3qrsmUhFfjeWAqv4vfE9i1B4S5H1p3Wv3kpvqjyuupspjb': { label: 'ViteX', kind: 'exchange' },
};

export const KNOWN_LIST = Object.keys(KNOWN_WALLETS);

export const knownLabel = (addr: string) => KNOWN_WALLETS[addr]?.label ?? null;

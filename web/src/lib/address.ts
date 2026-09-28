/**
 * Ixian address checks and search-input classification.
 *
 * Address layout (docs: architecture/10_data-structures/addresses):
 *   v0: 0x00 + sha512quTrunc(pubkey, 32)       + 3-byte checksum = 36 bytes
 *   v1: 0x01 + sha512sqTrunc(pubkey, 44)       + 3-byte checksum = 48 bytes
 *   v2: 0x02 + sha3_512sqTrunc(pubkey, 44)     + 3-byte checksum = 48 bytes
 * Checksum: first 3 bytes of the double hash (SHA-512 for v0/v1, SHA3-512 for
 * v2) of version || payload. Encoded with Base58 (Bitcoin alphabet).
 */
import { sha3_512, base58Decode } from './sha3';
import { sha512 } from './sha512';
import { KNOWN_WALLETS } from '@/data/knownWallets';

export const B58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

export type AddressCheck =
  | { ok: true; version: 0 | 1 | 2; known: boolean }
  | { ok: false; reason: string };

/** Strip an extended-address suffix ("addr_xyz"), as the current explorer does. */
export const baseAddress = (s: string) => s.trim().split('_')[0];

export function addressChecksum(body: Uint8Array): Uint8Array {
  const v = body[0];
  const h = v === 2 ? sha3_512(sha3_512(body)) : sha512(sha512(body));
  return h.slice(0, 3);
}

export function checkAddress(input: string): AddressCheck {
  const s = baseAddress(input);
  if (KNOWN_WALLETS[s]) return { ok: true, version: s.length > 60 ? 1 : 0, known: true };
  if (!s) return { ok: false, reason: 'Empty input.' };
  const bad = s.match(/[^1-9A-HJ-NP-Za-km-z]/);
  if (bad) {
    const ch = bad[0];
    const hint = '0OIl'.includes(ch)
      ? ` Base58 leaves out 0, O, I and l because they look alike.`
      : '';
    return { ok: false, reason: `"${ch}" is not a Base58 character.${hint}` };
  }
  const b = base58Decode(s);
  if (!b) return { ok: false, reason: 'Not valid Base58.' };
  const v = b[0];
  if (v > 2) return { ok: false, reason: `This decodes to address version ${v}, and Ixian addresses are versions 0, 1 and 2. Check the first characters.` };
  const want = v === 0 ? 36 : 48;
  if (b.length !== want) {
    return {
      ok: false,
      reason: `A version ${v} address is ${want} bytes; this one decodes to ${b.length}. A character may be missing or extra.`,
    };
  }
  const body = b.slice(0, b.length - 3);
  const sum = addressChecksum(body);
  const given = b.slice(b.length - 3);
  if (sum[0] !== given[0] || sum[1] !== given[1] || sum[2] !== given[2]) {
    return { ok: false, reason: 'The checksum does not match, so there is probably a typo.' };
  }
  return { ok: true, version: v as 0 | 1 | 2, known: false };
}

export type QueryKind =
  | { kind: 'empty' }
  | { kind: 'height'; height: number }
  | { kind: 'blockHash'; hash: string }
  | { kind: 'txid'; id: string }
  | { kind: 'address'; address: string; version: 0 | 1 | 2 }
  | { kind: 'partial'; hint: string }
  | { kind: 'invalid'; reason: string };

/**
 * Work out what the user typed. Cheap checks first; the address checksum only
 * runs once the input is long enough to be a whole address.
 */
export function classify(raw: string, latest?: number | null): QueryKind {
  const q = raw.trim().replace(/,/g, (m) => (/^[\d,]+$/.test(raw.trim()) ? '' : m));
  if (!q) return { kind: 'empty' };

  // Block height ("#123", "123", "1,234,567")
  const hq = q.replace(/^#/, '');
  if (/^\d+$/.test(hq)) {
    const n = Number(hq);
    if (!Number.isSafeInteger(n) || n < 1) return { kind: 'invalid', reason: 'Block heights start at 1.' };
    if (latest != null && n > latest) {
      return { kind: 'invalid', reason: `Block ${n.toLocaleString('en')} does not exist yet. The latest is ${latest.toLocaleString('en')}.` };
    }
    return { kind: 'height', height: n };
  }

  // Transaction id: "<height>-<base58>" (explorer format), legacy ids keep a type prefix
  if (/^[a-z]{0,4}-?\d+-[1-9A-HJ-NP-Za-km-z]+$/.test(q)) {
    const tail = q.split('-').pop() || '';
    if (tail.length < 20) return { kind: 'partial', hint: 'Looks like a transaction ID. Keep typing.' };
    return { kind: 'txid', id: q };
  }
  if (/^\d+-/.test(q)) return { kind: 'invalid', reason: 'Transaction IDs are a block number, a dash and Base58 characters.' };

  // Block hash: SHA3-512 checksum, 128 hex characters
  // (hex that contains "0" cannot be Base58, so it can only be a hash)
  if (/^[0-9a-f]+$/i.test(q) && (q.includes('0') || q.length > 66)) {
    if (q.length === 128) return { kind: 'blockHash', hash: q.toLowerCase() };
    if (q.length > 128) return { kind: 'invalid', reason: `Too long for a block hash: ${q.length} of 128 hex characters.` };
    return q.length >= 16
      ? { kind: 'partial', hint: `Looks like a block hash: ${q.length} of 128 hex characters.` }
      : { kind: 'partial', hint: 'Keep typing: a block hash, address or transaction ID.' };
  }

  // Address
  const a = baseAddress(q);
  const bad = a.match(/[^1-9A-HJ-NP-Za-km-z]/);
  if (bad) {
    if (/[0OIl]/.test(bad[0])) return { kind: 'invalid', reason: `"${bad[0]}" is not used in Ixian addresses. Base58 leaves out 0, O, I and l because they look alike.` };
    return { kind: 'invalid', reason: 'Not a block height, block hash, transaction ID or address.' };
  }
  if (a.length < 40) return { kind: 'partial', hint: 'Looks like the start of an address. Ixian addresses are 49 to 66 characters.' };
  const c = checkAddress(a);
  if (!c.ok) return { kind: 'invalid', reason: c.reason };
  return { kind: 'address', address: a, version: c.version };
}

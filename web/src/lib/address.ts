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
  if (b.length !== 36 && b.length !== 48) {
    return { ok: false, reason: `Ixian addresses are 36 or 48 bytes; this one decodes to ${b.length}. A character may be missing or extra.` };
  }
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

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export interface AddressInspection {
  /** the input without an extended-address suffix */
  address: string;
  /** positions of characters outside the Base58 alphabet */
  badChars: number[];
  /** decoded length in bytes, when the characters are valid */
  bytes: number | null;
  version: number | null;
  /** the length this version needs */
  want: number | null;
  /** checksum in the address and the one its contents give, hex; set when the length is right */
  given: string | null;
  expected: string | null;
  ok: boolean;
}

/** The same checks as checkAddress, kept apart so a page can show each one. */
export function inspectAddress(input: string): AddressInspection {
  const address = baseAddress(input);
  const badChars = [...address].flatMap((c, i) => (B58.includes(c) ? [] : [i]));
  const out: AddressInspection = { address, badChars, bytes: null, version: null, want: null, given: null, expected: null, ok: false };
  if (!address || badChars.length) return out;
  const b = base58Decode(address);
  if (!b) return out;
  out.bytes = b.length;
  if (b.length !== 36 && b.length !== 48) return out;
  out.version = b[0];
  if (b[0] > 2) return out;
  out.want = b[0] === 0 ? 36 : 48;
  if (b.length !== out.want) return out;
  out.given = toHex(b.slice(b.length - 3));
  out.expected = toHex(addressChecksum(b.slice(0, b.length - 3)));
  out.ok = out.given === out.expected;
  return out;
}

const validQuick = (s: string) => {
  const b = base58Decode(s);
  if (!b || b[0] > 2 || b.length !== (b[0] === 0 ? 36 : 48)) return false;
  const sum = addressChecksum(b.slice(0, b.length - 3));
  return sum[0] === b[b.length - 3] && sum[1] === b[b.length - 2] && sum[2] === b[b.length - 1];
};

/**
 * Valid addresses one edit away: a character changed, missing, extra, or two neighbours
 * swapped. A three-byte checksum makes a chance match rare, so one result is a safe hint.
 * Stops after `limit` hits. Runs in slices so the page stays responsive.
 */
export async function repairAddress(input: string, limit = 2): Promise<string[]> {
  const a = baseAddress(input);
  if (a.length < 40 || a.length > 70 || KNOWN_WALLETS[a]) return [];
  const bad = [...a].flatMap((c, i) => (B58.includes(c) ? [] : [i]));
  if (bad.length > 1) return [];
  const found = new Set<string>();
  const tryOne = (s: string) => {
    if (s !== a && !found.has(s) && validQuick(s)) found.add(s);
    return found.size >= limit;
  };
  const jobs: (() => boolean)[] = [];
  const at = bad.length ? bad : [...a].map((_, i) => i);
  for (const i of at) jobs.push(() => [...B58].some((c) => tryOne(a.slice(0, i) + c + a.slice(i + 1))));
  for (const i of at) jobs.push(() => tryOne(a.slice(0, i) + a.slice(i + 1)));
  if (!bad.length) {
    for (let i = 0; i < a.length - 1; i++) jobs.push(() => tryOne(a.slice(0, i) + a[i + 1] + a[i] + a.slice(i + 2)));
    for (let i = 0; i <= a.length; i++) jobs.push(() => [...B58].some((c) => tryOne(a.slice(0, i) + c + a.slice(i))));
  }
  for (let j = 0; j < jobs.length; j++) {
    if (jobs[j]()) break;
    if (j % 8 === 7) await new Promise((r) => setTimeout(r, 0));
  }
  return [...found];
}

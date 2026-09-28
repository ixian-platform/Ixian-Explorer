/**
 * SHA3-512 (FIPS 202) and Base58, small and dependency-free, for the
 * Platform page's live address lookup. Keccak-f[1600] on BigInt lanes:
 * slow compared with native code, instant for one short input.
 */
const RC = ([
  '0x0000000000000001', '0x0000000000008082', '0x800000000000808a', '0x8000000080008000',
  '0x000000000000808b', '0x0000000080000001', '0x8000000080008081', '0x8000000000008009',
  '0x000000000000008a', '0x0000000000000088', '0x0000000080008009', '0x000000008000000a',
  '0x000000008000808b', '0x800000000000008b', '0x8000000000008089', '0x8000000000008003',
  '0x8000000000008002', '0x8000000000000080', '0x000000000000800a', '0x800000008000000a',
  '0x8000000080008081', '0x8000000000008080', '0x0000000080000001', '0x8000000080008008',
]).map((h) => BigInt(h));
const ROT = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];
// BigInt literals need ES2020; the project targets ES2017, so constants are built once
const N0 = BigInt(0);
const N8 = BigInt(8);
const NFF = BigInt(255);
const N58 = BigInt(58);
const M = (BigInt(1) << BigInt(64)) - BigInt(1);
const rotl = (x: bigint, n: number) => (n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & M);

function keccakF(A: bigint[]) {
  const B = new Array<bigint>(25);
  const C = new Array<bigint>(5);
  for (let round = 0; round < 24; round++) {
    for (let x = 0; x < 5; x++) C[x] = A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20];
    for (let x = 0; x < 5; x++) {
      const d = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1);
      for (let y = 0; y < 25; y += 5) A[y + x] ^= d;
    }
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++) B[y + ((2 * x + 3 * y) % 5) * 5] = rotl(A[x + 5 * y], ROT[x + 5 * y]);
    for (let x = 0; x < 5; x++)
      for (let y = 0; y < 5; y++) A[x + 5 * y] = B[x + 5 * y] ^ (~B[((x + 1) % 5) + 5 * y] & M & B[((x + 2) % 5) + 5 * y]);
    A[0] ^= RC[round];
  }
}

export function sha3_512(data: Uint8Array): Uint8Array {
  const rate = 72;
  const len = data.length;
  const padded = new Uint8Array(Math.ceil((len + 1) / rate) * rate);
  padded.set(data);
  padded[len] ^= 0x06;
  padded[padded.length - 1] ^= 0x80;
  const A = new Array<bigint>(25).fill(N0);
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = N0;
      for (let b = 7; b >= 0; b--) lane = (lane << N8) | BigInt(padded[off + i * 8 + b]);
      A[i] ^= lane;
    }
    keccakF(A);
  }
  const out = new Uint8Array(64);
  for (let i = 0; i < 8; i++) {
    let lane = A[i];
    for (let b = 0; b < 8; b++) {
      out[i * 8 + b] = Number(lane & NFF);
      lane >>= N8;
    }
  }
  return out;
}

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Decode(s: string): Uint8Array | null {
  if (!s) return null;
  let n = N0;
  for (const ch of s) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    n = n * N58 + BigInt(v);
  }
  const bytes: number[] = [];
  while (n > N0) {
    bytes.unshift(Number(n & NFF));
    n >>= N8;
  }
  for (const ch of s) {
    if (ch !== '1') break;
    bytes.unshift(0);
  }
  return new Uint8Array(bytes);
}

export function base58Encode(b: Uint8Array): string {
  let n = N0;
  for (const x of b) n = (n << N8) | BigInt(x);
  let s = '';
  while (n > N0) {
    s = ALPHABET[Number(n % N58)] + s;
    n /= N58;
  }
  for (const x of b) {
    if (x !== 0) break;
    s = '1' + s;
  }
  return s;
}

export const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

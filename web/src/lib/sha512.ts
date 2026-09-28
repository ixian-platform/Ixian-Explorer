/**
 * SHA-512 (FIPS 180-4), small and synchronous, for checking v0 and v1 address
 * checksums while typing. BigInt lanes: slow next to native code, instant for
 * one short input. Checked against Node's `sha512` in scripts/check-crypto.mjs.
 */
const K = [
  '428a2f98d728ae22', '7137449123ef65cd', 'b5c0fbcfec4d3b2f', 'e9b5dba58189dbbc', '3956c25bf348b538', '59f111f1b605d019',
  '923f82a4af194f9b', 'ab1c5ed5da6d8118', 'd807aa98a3030242', '12835b0145706fbe', '243185be4ee4b28c', '550c7dc3d5ffb4e2',
  '72be5d74f27b896f', '80deb1fe3b1696b1', '9bdc06a725c71235', 'c19bf174cf692694', 'e49b69c19ef14ad2', 'efbe4786384f25e3',
  '0fc19dc68b8cd5b5', '240ca1cc77ac9c65', '2de92c6f592b0275', '4a7484aa6ea6e483', '5cb0a9dcbd41fbd4', '76f988da831153b5',
  '983e5152ee66dfab', 'a831c66d2db43210', 'b00327c898fb213f', 'bf597fc7beef0ee4', 'c6e00bf33da88fc2', 'd5a79147930aa725',
  '06ca6351e003826f', '142929670a0e6e70', '27b70a8546d22ffc', '2e1b21385c26c926', '4d2c6dfc5ac42aed', '53380d139d95b3df',
  '650a73548baf63de', '766a0abb3c77b2a8', '81c2c92e47edaee6', '92722c851482353b', 'a2bfe8a14cf10364', 'a81a664bbc423001',
  'c24b8b70d0f89791', 'c76c51a30654be30', 'd192e819d6ef5218', 'd69906245565a910', 'f40e35855771202a', '106aa07032bbd1b8',
  '19a4c116b8d2d0c8', '1e376c085141ab53', '2748774cdf8eeb99', '34b0bcb5e19b48a8', '391c0cb3c5c95a63', '4ed8aa4ae3418acb',
  '5b9cca4f7763e373', '682e6ff3d6b2b8a3', '748f82ee5defb2fc', '78a5636f43172f60', '84c87814a1f0ab72', '8cc702081a6439ec',
  '90befffa23631e28', 'a4506cebde82bde9', 'bef9a3f7b2c67915', 'c67178f2e372532b', 'ca273eceea26619c', 'd186b8c721c0c207',
  'eada7dd6cde0eb1e', 'f57d4f7fee6ed178', '06f067aa72176fba', '0a637dc5a2c898a6', '113f9804bef90dae', '1b710b35131c471b',
  '28db77f523047d84', '32caab7b40c72493', '3c9ebe0a15c9bebc', '431d67c49c100d4c', '4cc5d4becb3e42b6', '597f299cfc657e2a',
  '5fcb6fab3ad6faec', '6c44198c4a475817',
].map((h) => BigInt('0x' + h));
const H0 = [
  '6a09e667f3bcc908', 'bb67ae8584caa73b', '3c6ef372fe94f82b', 'a54ff53a5f1d36f1',
  '510e527fade682d1', '9b05688c2b3e6c1f', '1f83d9abfb41bd6b', '5be0cd19137e2179',
].map((h) => BigInt('0x' + h));
const M = (BigInt(1) << BigInt(64)) - BigInt(1);
const B8 = BigInt(8);
const BFF = BigInt(255);
const rotr = (x: bigint, n: number) => ((x >> BigInt(n)) | (x << BigInt(64 - n))) & M;
const shr = (x: bigint, n: number) => x >> BigInt(n);

export function sha512(data: Uint8Array): Uint8Array {
  const len = data.length;
  const total = Math.ceil((len + 17) / 128) * 128;
  const p = new Uint8Array(total);
  p.set(data);
  p[len] = 0x80;
  const bits = len * 8;
  // lengths here are far below 2^53 bits
  for (let i = 0; i < 8; i++) p[total - 1 - i] = Math.floor(bits / 2 ** (8 * i)) & 0xff;
  const H = H0.slice();
  const W = new Array<bigint>(80);
  for (let off = 0; off < total; off += 128) {
    for (let t = 0; t < 16; t++) {
      let w = BigInt(0);
      for (let b = 0; b < 8; b++) w = (w << B8) | BigInt(p[off + t * 8 + b]);
      W[t] = w;
    }
    for (let t = 16; t < 80; t++) {
      const s0 = rotr(W[t - 15], 1) ^ rotr(W[t - 15], 8) ^ shr(W[t - 15], 7);
      const s1 = rotr(W[t - 2], 19) ^ rotr(W[t - 2], 61) ^ shr(W[t - 2], 6);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) & M;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 80; t++) {
      const S1 = rotr(e, 14) ^ rotr(e, 18) ^ rotr(e, 41);
      const ch = (e & f) ^ (~e & M & g);
      const t1 = (h + S1 + ch + K[t] + W[t]) & M;
      const S0 = rotr(a, 28) ^ rotr(a, 34) ^ rotr(a, 39);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) & M;
      h = g;
      g = f;
      f = e;
      e = (d + t1) & M;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) & M;
    }
    H[0] = (H[0] + a) & M;
    H[1] = (H[1] + b) & M;
    H[2] = (H[2] + c) & M;
    H[3] = (H[3] + d) & M;
    H[4] = (H[4] + e) & M;
    H[5] = (H[5] + f) & M;
    H[6] = (H[6] + g) & M;
    H[7] = (H[7] + h) & M;
  }
  const out = new Uint8Array(64);
  for (let i = 0; i < 8; i++) {
    let v = H[i];
    for (let b = 7; b >= 0; b--) {
      out[i * 8 + b] = Number(v & BFF);
      v >>= B8;
    }
  }
  return out;
}

/**
 * Seeded, deterministic randomness for the mock chain. Everything the mock
 * shows is a pure function of (SEED, inputs), so the same seed always gives
 * the same data and server and browser always agree.
 */
export const SEED = 0x1a2b3c4d;

/** 32-bit finaliser (murmur3 fmix). */
export function fmix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Hash up to four integers to an unsigned 32-bit value. */
export function h32(a: number, b = 0, c = 0, d = 0): number {
  let h = SEED ^ Math.imul(a | 0, 0x9e3779b1);
  h = fmix(h ^ Math.imul(b | 0, 0x85ebca77));
  h = fmix(h ^ Math.imul(c | 0, 0xc2b2ae3d));
  h = fmix(h ^ Math.imul(d | 0, 0x27d4eb2f));
  return h;
}

/** Hash to a float in [0, 1). */
export const hf = (a: number, b = 0, c = 0, d = 0) => h32(a, b, c, d) / 4294967296;

/** Small fast PRNG stream (mulberry32). */
export function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic bytes. */
export function bytes(n: number, a: number, b = 0, c = 0): Uint8Array {
  const r = prng(h32(a, b, c, 0x0b17e5));
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.floor(r() * 256);
  return out;
}

/** Smooth 1D value noise in [-1, 1], period-free. */
export function noise1(x: number, salt: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hf(i, salt) * 2 - 1;
  const b = hf(i + 1, salt) * 2 - 1;
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}

export const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

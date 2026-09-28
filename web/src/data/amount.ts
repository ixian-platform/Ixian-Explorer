/** IXI amounts: 8 decimals. Exact arithmetic in BigInt units of 1e-8 IXI. */
import type { Amount } from './types';

export const DECIMALS = 8;
export const UNIT = BigInt(100_000_000);
const ZERO = BigInt(0);

export function toAmount(units: bigint | number): Amount {
  let u = typeof units === 'bigint' ? units : BigInt(Math.round(units));
  const neg = u < ZERO;
  if (neg) u = -u;
  const whole = u / UNIT;
  const frac = (u % UNIT).toString().padStart(DECIMALS, '0');
  return `${neg ? '-' : ''}${whole.toString()}.${frac}`;
}

export function toUnits(a: Amount): bigint {
  const neg = a.startsWith('-');
  const [w, f = ''] = (neg ? a.slice(1) : a).split('.');
  const u = BigInt(w || '0') * UNIT + BigInt((f + '00000000').slice(0, DECIMALS));
  return neg ? -u : u;
}

export const ixi = (n: number): bigint => BigInt(Math.round(n * 1e8));

/** Number of IXI, for charts and shares only (not exact past 2^53 units). */
export const amountNumber = (a: Amount) => Number(a);

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

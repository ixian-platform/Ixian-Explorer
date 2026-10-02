import Link from 'next/link';
import type { SeriesPoint } from '@/data/types';
import { int, utc } from '@/lib/format';

/* Drill-down from a chart bucket: a table row leads to its blocks.
   A bucket opens the blocks list at its last block; a band value opens that exact block. */

export const bucketHref = (p: SeriesPoint) => (p.h1 != null ? `/blocks?from=${p.h0 ?? p.h1}&to=${p.h1}` : null);

export function BucketCell({ p, step }: { p: SeriesPoint; step: number }) {
  const label = utc(p.t).replace(' UTC', '').slice(0, step >= 86400 ? 10 : 16);
  const href = bucketHref(p);
  if (!href) return <>{label}</>;
  return (
    <Link href={href} className="ix-link" title={`Blocks ${int(p.h0 ?? p.h1!)} to ${int(p.h1!)}`}>
      {label}
    </Link>
  );
}

export function BlockValue({ v, h, format }: { v: number | undefined; h: number | undefined; format: (v: number) => string }) {
  if (v == null) return null;
  if (h == null) return <>{format(v)}</>;
  return (
    <Link href={`/block?h=${h}`} className="ix-link" title={`Open block ${int(h)}`}>
      {format(v)} <span style={{ color: 'var(--ix-text-3)' }}>· block {int(h)}</span>
    </Link>
  );
}

'use client';

import type { Metric, Range } from '@/data/types';
import { source } from '@/data/source';
import { useQuery } from '@/lib/hooks';
import { compact, dec } from '@/lib/format';
import ComboChart from './ComboChart';

function useS(metric: Metric, range: Range) {
  const q = useQuery(`${metric}|${range}`, () => source.getSeries(metric, range));
  return { points: q.data?.points ?? null, step: q.data?.step ?? 600, error: q.status === 'error' };
}

/** The old explorer's "Block signing status": what signed against what was required. */
export default function SigningChart({ range = '24h', title = 'Block signing, last 24 hours' }: { range?: Range; title?: string }) {
  const d = useS('signerDifficulty', range);
  const r = useS('requiredDifficulty', range);
  const sg = useS('signatures', range);
  const rs = useS('sigRequired', range);
  const err = d.error || r.error || sg.error || rs.error;
  return (
    <ComboChart
      title={title}
      subtitle="Solid is what signed each block, dashed is what was required; averages per 10 minutes, UTC"
      step={d.step}
      error={err ? 'Signing history is not available right now.' : undefined}
      lanes={[
        { id: 'd', label: 'Signer difficulty', log: true, tick: (v) => compact(v), height: 120 },
        { id: 's', label: 'Signatures', zero: true, tick: (v) => dec(v, 0), height: 100 },
      ]}
      series={[
        { key: 'td', label: 'Total signer difficulty', color: 'var(--ix-m-difficulty)', points: d.points, format: (v) => compact(v, 3), lane: 'd' },
        { key: 'rd', label: 'Required signer difficulty', color: 'var(--ix-m-difficulty)', points: r.points, format: (v) => compact(v, 3), lane: 'd', dashed: true },
        { key: 'sg', label: 'Signatures', color: 'var(--ix-m-signers)', points: sg.points, format: (v) => dec(v, 1), lane: 's' },
        { key: 'rs', label: 'Required signatures', color: 'var(--ix-m-signers)', points: rs.points, format: (v) => dec(v, 1), lane: 's', dashed: true },
      ]}
    />
  );
}

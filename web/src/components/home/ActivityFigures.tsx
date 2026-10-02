'use client';

import { useStatus } from '@/lib/hooks';
import { int } from '@/lib/format';
import { Figures, Fig } from '@/components/page/Page';
import { Skel } from '@/components/ui/Primitives';

/** Transaction totals (the old home's three counters). */
export default function ActivityFigures() {
  const { data, error } = useStatus();
  const v = (n: number | undefined) => (data && n ? int(n) : error || (data && !n) ? 'Unavailable' : <Skel w={110} h={22} />);
  return (
    <div style={{ marginBottom: 32 }}>
      <Figures cols={3}>
        <Fig k="Transactions, last 24 hours" v={v(data?.tx24h)} />
        <Fig k="Average per day" v={v(data?.txAvgPerDay)} sub="over the last 30 days" />
        <Fig k="All on-chain transactions" v={v(data?.txTotal)} sub="since the genesis block" />
      </Figures>
    </div>
  );
}

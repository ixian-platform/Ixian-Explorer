import { Suspense } from 'react';
import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import Fallback from '@/components/page/Fallback';
import StatsView from '@/components/views/StatsView';

export const metadata: Metadata = pageMeta({ title: 'Statistics', description: 'Ixian network statistics: transactions, TPS with its peak, nodes, supply, emissions, block time and signing.', path: '/stats', og: 'stats' });

export default function Page() {
  return (
    <Suspense fallback={<Fallback />}>
      <StatsView />
    </Suspense>
  );
}

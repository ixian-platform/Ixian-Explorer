import { Suspense } from 'react';
import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import Fallback from '@/components/page/Fallback';
import NetworkView from '@/components/views/NetworkView';

export const metadata: Metadata = pageMeta({ title: 'Network', description: 'Ixian DLT and S2 nodes on a globe and in a list: where they are, what they run, and how blocks are signed.', path: '/network', og: 'network' });

export default function Page() {
  return (
    <Suspense fallback={<Fallback />}>
      <NetworkView />
    </Suspense>
  );
}

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import Fallback from '@/components/page/Fallback';
import BlockView from '@/components/views/BlockView';

export const metadata: Metadata = pageMeta({ title: 'Block', description: 'An Ixian block: transactions, signatures, rewards and checksums.', path: '/block', og: 'detail' });

export default function Page() {
  return (
    <Suspense fallback={<Fallback />}>
      <BlockView />
    </Suspense>
  );
}

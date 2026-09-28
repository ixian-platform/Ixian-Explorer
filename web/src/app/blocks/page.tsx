import { Suspense } from 'react';
import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import Fallback from '@/components/page/Fallback';
import BlocksView from '@/components/views/BlocksView';

export const metadata: Metadata = pageMeta({ title: 'Blocks', description: 'Every Ixian block, newest first, with signatures, block time and signer difficulty.', path: '/blocks', og: 'blocks' });

export default function Page() {
  return (
    <Suspense fallback={<Fallback />}>
      <BlocksView />
    </Suspense>
  );
}

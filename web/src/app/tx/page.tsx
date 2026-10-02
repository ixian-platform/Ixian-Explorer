import { Suspense } from 'react';
import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import Fallback from '@/components/page/Fallback';
import TxView from '@/components/views/TxView';

export const metadata: Metadata = pageMeta({ title: 'Transaction', description: 'An Ixian transaction: who sent what to whom, in which block.', path: '/tx', og: 'detail' });

export default function Page() {
  return (
    <Suspense fallback={<Fallback />}>
      <TxView />
    </Suspense>
  );
}

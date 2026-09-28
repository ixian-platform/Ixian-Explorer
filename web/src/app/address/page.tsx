import { Suspense } from 'react';
import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import Fallback from '@/components/page/Fallback';
import AddressView from '@/components/views/AddressView';

export const metadata: Metadata = pageMeta({ title: 'Address', description: 'An Ixian address: balance, history and transactions.', path: '/address', og: 'detail' });

export default function Page() {
  return (
    <Suspense fallback={<Fallback />}>
      <AddressView />
    </Suspense>
  );
}

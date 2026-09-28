import { Suspense } from 'react';
import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import Fallback from '@/components/page/Fallback';
import SearchView from '@/components/views/SearchView';

export const metadata: Metadata = pageMeta({ title: 'Search', description: 'Search Ixian blocks, transactions and addresses by block height, hash, transaction ID or address.', path: '/search', og: 'detail', noindex: true });

export default function Page() {
  return (
    <Suspense fallback={<Fallback />}>
      <SearchView />
    </Suspense>
  );
}

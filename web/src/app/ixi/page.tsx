import { Suspense } from 'react';
import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import Fallback from '@/components/page/Fallback';
import IxiView from '@/components/views/IxiView';

export const metadata: Metadata = pageMeta({ title: 'IXI', description: 'IXI in circulation and the emission schedule: how much IXI exists and where new IXI comes from.', path: '/ixi', og: 'ixi' });

export default function Page() {
  return (
    <Suspense fallback={<Fallback />}>
      <IxiView />
    </Suspense>
  );
}

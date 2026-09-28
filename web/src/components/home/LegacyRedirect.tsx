'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Keeps old explorer links working: index.php?p=block&id=123 and friends
 * land on the new pages. Runs only when a legacy `p` parameter is present.
 */
export default function LegacyRedirect() {
  const router = useRouter();
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const p = q.get('p');
    if (!p) return;
    const id = q.get('id') ?? '';
    const map: Record<string, string> = {
      block: `/block?h=${encodeURIComponent(id)}`,
      transaction: `/tx?id=${encodeURIComponent(id)}`,
      address: `/address?a=${encodeURIComponent(id.split('_')[0])}`,
      search: `/search?q=${encodeURIComponent(q.get('q') ?? '')}`,
      nodes: '/network',
      network: '/stats',
      top: '/ixi#top',
      emissions: '/ixi',
      devblocks: '/blocks?view=detailed',
    };
    if (map[p]) router.replace(map[p]);
  }, [router]);
  return null;
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { legacyTarget } from '@/lib/lost';

/**
 * Keeps old explorer links working: index.php?p=block&id=123 and friends
 * land on the new pages. Runs only when a legacy `p` parameter is present.
 */
export default function LegacyRedirect() {
  const router = useRouter();
  useEffect(() => {
    const to = legacyTarget(window.location.search);
    if (to) router.replace(to);
  }, [router]);
  return null;
}

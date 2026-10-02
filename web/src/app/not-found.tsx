import type { Metadata } from 'next';
import PathLost from '@/components/lost/PathLost';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false } };

export default function NotFound() {
  return <PathLost />;
}

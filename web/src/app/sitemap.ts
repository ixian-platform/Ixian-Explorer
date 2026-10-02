import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-static';

/** The index pages only: blocks, transactions and addresses live behind query strings. */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: [string, number, MetadataRoute.Sitemap[number]['changeFrequency']][] = [
    ['/', 1, 'always'],
    ['/blocks', 0.8, 'always'],
    ['/network', 0.7, 'hourly'],
    ['/stats', 0.7, 'hourly'],
    ['/ixi', 0.6, 'daily'],
  ];
  return pages.map(([p, priority, changeFrequency]) => ({ url: `${SITE_URL}${p}`, changeFrequency, priority }));
}

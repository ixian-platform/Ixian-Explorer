import type { Metadata } from 'next';

/**
 * Page metadata, in the ixian.io pattern: title, description,
 * canonical URL, Open Graph and Twitter cards. Each page has its own OG image
 * in public/og/ (made by scripts/og/og.mjs); `og` is its name without `.jpg`.
 * Detail pages (block, tx, address, search) share `detail`.
 */
export const SITE_URL = 'https://explorer.ixian.io';

export function pageMeta({ title, description, path, og, noindex }: { title?: string; description: string; path: string; og: string; noindex?: boolean }): Metadata {
  const full = title ? `${title} · ixiscope` : 'ixiscope · Ixian block explorer';
  const image = { url: `${SITE_URL}/og/${og}.jpg`, width: 1200, height: 630, alt: full };
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph: { type: 'website', locale: 'en_US', siteName: 'ixiscope', url: `${SITE_URL}${path}`, title: full, description, images: [image] },
    twitter: { card: 'summary_large_image', site: '@ixian_IO', title: full, description, images: [image] },
  };
}

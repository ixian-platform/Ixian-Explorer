import type { NextConfig } from 'next';

/** Static export: the explorer is plain files on any host. Detail pages use
    query strings (/block?h=…) because heights, txids and addresses cannot be
    pre-rendered. */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: false,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

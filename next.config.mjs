/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['ts', 'tsx', 'mdx'],
  // Keep dev artifacts separate so `next build` cannot corrupt `next dev` chunks.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',

  // A-26 closure (Wave 12): backward-compat redirects for the
  // /community → /academy semantic rename. 308 permanent (preserves
  // request method + signals caches/CDN to update). Two rules:
  //   1. Exact /community → /academy
  //   2. Sub-path wildcard /community/:path* → /academy/:path*
  // Pre-Wave-12 deep links (search-engine indexed, bookmarks, audit
  // doc historical narrative references) keep working without manual
  // user intervention. Auth gate still enforced at the destination
  // via src/app/academy/layout.tsx (BUG-006 closure preserved).
  async redirects() {
    return [
      {
        source: '/community',
        destination: '/academy',
        permanent: true,
      },
      {
        source: '/community/:path*',
        destination: '/academy/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

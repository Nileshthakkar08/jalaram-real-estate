/** @type {import('next').NextConfig} */

// Laravel API origin. The browser always calls same-origin /api and /sanctum paths, which are
// proxied here in development. In production Nginx routes those paths directly to Laravel.
const apiOrigin = process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000';

const nextConfig = {
  // Lets a production build run without touching a running dev server's .next folder.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
      { source: '/sanctum/:path*', destination: `${apiOrigin}/sanctum/:path*` },
      { source: '/storage/:path*', destination: `${apiOrigin}/storage/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

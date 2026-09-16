/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    // Linting is handled at the workspace root (`pnpm lint`), not during `next build`.
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      // Chart screenshots are posted through route handlers, not server actions,
      // but keep the ceiling aligned with MAX_UPLOAD_BYTES.
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), payment=(self)',
          },
        ],
      },
      {
        // Never let a signed chart image be cached by a shared proxy.
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
      },
    ];
  },
};

export default nextConfig;

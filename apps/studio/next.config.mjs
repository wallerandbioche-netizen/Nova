/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // sharp and the Remotion renderer are native/server-only: keep them out of the bundle.
  serverExternalPackages: ['sharp', '@remotion/bundler', '@remotion/renderer', 'bullmq', 'ioredis'],
  experimental: {
    serverActions: { bodySizeLimit: '25mb' },
  },
  eslint: { ignoreDuringBuilds: true },
  images: {
    // Listing thumbnails are served from our own signed-URL route, never hot-linked.
    remotePatterns: [],
  },
};

export default nextConfig;

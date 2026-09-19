import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // sharp and the ffmpeg binaries must stay outside the bundler: they are
  // native//executable assets resolved at runtime, not importable modules.
  serverExternalPackages: ['sharp', 'ffmpeg-static', 'ffprobe-static'],
  experimental: {
    // Generated media can be large; keep route handler bodies generous for uploads.
    serverActions: { bodySizeLimit: '32mb' },
  },
};

export default config;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    DJANGO_API_URL: process.env.DJANGO_API_URL || 'http://backend:8000',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.DJANGO_API_URL || 'http://backend:8000'}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

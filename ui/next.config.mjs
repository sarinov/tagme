/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // proxy to the NestJS backend — avoids CORS entirely
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.BACKEND_URL ?? 'http://localhost:3000'}/:path*`,
      },
    ];
  },
};

export default nextConfig;

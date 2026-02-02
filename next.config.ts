import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
        port: '',
        pathname: '/**',
      },
       {
        protocol: 'https',
        hostname: 'wsrv.nl',
        port: '',
        pathname: '/**',
      },
       {
        protocol: 'https',
        hostname: 'static-cdn.jtvnw.net',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Required for discord-verify to work
  serverExternalPackages: ['discord-verify'],
};

export default nextConfig;

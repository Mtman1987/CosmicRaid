import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: 'standalone',
  env: {
    // Expose all NEXT_PUBLIC_ variables at build time
    // These will be replaced with their values from the environment
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_TWITCH_CLIENT_ID: process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID,
    NEXT_PUBLIC_TWITCH_CLIENT_SECRET: process.env.NEXT_PUBLIC_TWITCH_CLIENT_SECRET,
    NEXT_PUBLIC_DISCORD_CLIENT_ID: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_HARDCODED_ADMIN_DISCORD_ID: process.env.NEXT_PUBLIC_HARDCODED_ADMIN_DISCORD_ID,
    NEXT_PUBLIC_HARDCODED_ADMIN_TWITCH_ID: process.env.NEXT_PUBLIC_HARDCODED_ADMIN_TWITCH_ID,
    NEXT_PUBLIC_HARDCODED_GUILD_ID: process.env.NEXT_PUBLIC_HARDCODED_GUILD_ID,
    NEXT_PUBLIC_TWITCH_BROADCASTER_USERNAME: process.env.NEXT_PUBLIC_TWITCH_BROADCASTER_USERNAME,
    NEXT_PUBLIC_DISCORD_INVITE_URL: process.env.NEXT_PUBLIC_DISCORD_INVITE_URL,
    NEXT_PUBLIC_DISCORD_CALENDAR_CHANNEL_ID: process.env.NEXT_PUBLIC_DISCORD_CALENDAR_CHANNEL_ID,
    NEXT_PUBLIC_DISCORD_LEADERBOARD_CHANNEL_ID: process.env.NEXT_PUBLIC_DISCORD_LEADERBOARD_CHANNEL_ID,
    NEXT_PUBLIC_DISCORD_LOG_CHANNEL_ID: process.env.NEXT_PUBLIC_DISCORD_LOG_CHANNEL_ID,
    NEXT_PUBLIC_DISCORD_RAID_PILE_CHANNEL_ID: process.env.NEXT_PUBLIC_DISCORD_RAID_PILE_CHANNEL_ID,
    NEXT_PUBLIC_DISCORD_RAID_TRAIN_CHANNEL_ID: process.env.NEXT_PUBLIC_DISCORD_RAID_TRAIN_CHANNEL_ID,
    NEXT_PUBLIC_DISCORD_SHARE_CHANNEL_ID: process.env.NEXT_PUBLIC_DISCORD_SHARE_CHANNEL_ID,
    NEXT_PUBLIC_DISCORD_SHOUTOUT_CHANNEL_ID: process.env.NEXT_PUBLIC_DISCORD_SHOUTOUT_CHANNEL_ID,
    NEXT_PUBLIC_EMERGENCY_SLOTS_LOOKAHEAD_HOURS: process.env.NEXT_PUBLIC_EMERGENCY_SLOTS_LOOKAHEAD_HOURS,
    NEXT_PUBLIC_EMERGENCY_SLOT_COST: process.env.NEXT_PUBLIC_EMERGENCY_SLOT_COST,
    NEXT_PUBLIC_POINTS_COMMUNITY_HELP: process.env.NEXT_PUBLIC_POINTS_COMMUNITY_HELP,
    NEXT_PUBLIC_POINTS_DAILY_BONUS: process.env.NEXT_PUBLIC_POINTS_DAILY_BONUS,
    NEXT_PUBLIC_POINTS_DISCORD_HELP_REACTION: process.env.NEXT_PUBLIC_POINTS_DISCORD_HELP_REACTION,
    NEXT_PUBLIC_POINTS_DISCORD_MESSAGE: process.env.NEXT_PUBLIC_POINTS_DISCORD_MESSAGE,
    NEXT_PUBLIC_POINTS_DISCORD_REACTION: process.env.NEXT_PUBLIC_POINTS_DISCORD_REACTION,
    NEXT_PUBLIC_POINTS_DISCORD_VOICE_MINUTE: process.env.NEXT_PUBLIC_POINTS_DISCORD_VOICE_MINUTE,
    NEXT_PUBLIC_POINTS_STREAM_ATTENDANCE: process.env.NEXT_PUBLIC_POINTS_STREAM_ATTENDANCE,
    NEXT_PUBLIC_POINTS_TWITCH_BITS: process.env.NEXT_PUBLIC_POINTS_TWITCH_BITS,
    NEXT_PUBLIC_POINTS_TWITCH_FOLLOW: process.env.NEXT_PUBLIC_POINTS_TWITCH_FOLLOW,
    NEXT_PUBLIC_POINTS_TWITCH_HOST: process.env.NEXT_PUBLIC_POINTS_TWITCH_HOST,
    NEXT_PUBLIC_POINTS_TWITCH_RAID: process.env.NEXT_PUBLIC_POINTS_TWITCH_RAID,
    NEXT_PUBLIC_POINTS_TWITCH_SUB: process.env.NEXT_PUBLIC_POINTS_TWITCH_SUB,
    NEXT_PUBLIC_RAID_PILE_MAX_SIZE: process.env.NEXT_PUBLIC_RAID_PILE_MAX_SIZE,
    NEXT_PUBLIC_RAID_PILE_MIN_SIZE: process.env.NEXT_PUBLIC_RAID_PILE_MIN_SIZE,
    NEXT_PUBLIC_RAID_PILE_POINTS_REWARD: process.env.NEXT_PUBLIC_RAID_PILE_POINTS_REWARD,
    NEXT_PUBLIC_RAID_TRAIN_SLOT_COST: process.env.NEXT_PUBLIC_RAID_TRAIN_SLOT_COST,
  },
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
  logging: {
    fetches: {
      fullUrl: false,
    },
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
  // Skip prerendering for API routes
  generateStaticParams: false,
  webpack: (config) => {
    config.ignoreWarnings = config.ignoreWarnings || [];
    config.ignoreWarnings.push((warning: any) => {
      const message = typeof warning.message === 'string' ? warning.message : '';
      return message.includes('Critical dependency: the request of a dependency is an expression');
    });
    return config;
  },
};

export default nextConfig;

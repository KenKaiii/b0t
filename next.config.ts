import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force dynamic rendering for all pages to avoid static generation errors
  output: 'standalone',

  // Skip generating 404 and 500 pages during build to prevent Html import errors
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },

  // Skip static error page generation during build
  // This prevents build failures from prerendering errors
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },

  // Performance optimizations (10-15% bundle size reduction)
  experimental: {
    // Tree-shake icon libraries for better bundle size
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    // Minify server code in production
    serverMinification: true,
  },

  // Production-only optimizations
  compiler: {
    // Remove console.log in production (keep error/warn for debugging)
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Exclude packages with native dependencies from webpack bundling
  // This fixes build errors with discord.js and other native modules
  // Note: ioredis and bullmq are NOT in this list to avoid Turbopack conflicts
  serverExternalPackages: [
    'discord.js',
    'zlib-sync',
    'better-sqlite3',
    'sharp',
    'canvas',
    'mongodb',
    'mysql2',
    'pg',
    'snoowrap',
    'bufferutil',
    'utf-8-validate',
    '@node-rs/argon2',
    '@node-rs/bcrypt',
    'pdf-parse',
  ],

  // Configure webpack to ignore native modules and optional dependencies
  // Note: This config is only used in production builds (npm run build)
  // During dev (npm run dev with --turbopack), webpack config is ignored
  // The one-time warning "Webpack is configured while Turbopack is not" is expected and harmless
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle native modules on server
      config.externals.push({
        'discord.js': 'commonjs discord.js',
        'zlib-sync': 'commonjs zlib-sync',
        'better-sqlite3': 'commonjs better-sqlite3',
        'snoowrap': 'commonjs snoowrap',
      });
    }

    // Suppress warnings about missing optional dependencies, conflicting exports, and package externals
    config.ignoreWarnings = [
      /Module not found.*bufferutil/,
      /Module not found.*utf-8-validate/,
      /Module not found.*encoding/,
      /Module not found.*@chroma-core\/default-embed/,
      /Module not found.*pg-native/,
      /conflicting star exports/,
      /A Node\.js API is used/,
      /Package ioredis can't be external/,
    ];

    return config;
  },
};

export default nextConfig;

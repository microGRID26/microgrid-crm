import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        // CSP: unsafe-inline required for Next.js inline styles; unsafe-eval only in dev (hot reload).
        // Production builds on Vercel set NODE_ENV=production, removing unsafe-eval.
        { key: 'Content-Security-Policy', value: [
          "default-src 'self'",
          `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: blob: https://*.supabase.co https://unpkg.com https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://exp.host https://api.anthropic.com https://api.zippopotam.us https://*.basemaps.cartocdn.com",
          "frame-src 'self'",
          "frame-ancestors 'self'",
          "object-src 'none'",
          "base-uri 'self'",
        ].join('; ') },
      ],
    }]
  },
};

export default withSentryConfig(nextConfig, {
  // Suppresses Sentry SDK build logs
  silent: true,
  // Disable source map upload until Sentry org/project/auth token are configured
  sourcemaps: {
    disable: true,
  },
});

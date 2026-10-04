import type { NextConfig } from 'next';

// chessoninvestments.com (and www) is the public website, served from /site.
// Keep in step with PUBLIC_HOSTS in src/lib/site.ts.
const PUBLIC_HOST = '(www\\.)?chessoninvestments\\.com';
const onPublic = [{ type: 'host' as const, value: PUBLIC_HOST }];

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
];

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // The app is never listed by search engines; only the website's own address is.
      { source: '/:path*', missing: onPublic, headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
  async rewrites() {
    return {
      // On the website's address every page is a website page: the app (sign-in,
      // records, /api) can't be reached there at all.
      beforeFiles: [
        { source: '/', has: onPublic, destination: '/site' },
        { source: '/:path((?!_next/|site(?:/|$)).+)', has: onPublic, destination: '/site/:path' },
      ],
    };
  },
};

export default nextConfig;

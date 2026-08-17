/** @type {import('next').NextConfig} */

// CSP pragmatique : 'unsafe-inline' reste requis par le bootstrap inline de
// Next.js ; tout le reste est verrouillé sur l'origine et Supabase.
const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-eval' uniquement en développement : React s'en sert pour ses
  // outils de debug. Jamais en production.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com",
  `connect-src 'self' https://*.supabase.co${process.env.NODE_ENV === 'development' ? ' ws: wss:' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com https://www.tiktok.com",
].join('; ')

const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig

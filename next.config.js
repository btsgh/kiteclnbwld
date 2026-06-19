const fs = require('node:fs');
const path = require('node:path');

// Legacy HTML pipeline marker. The old Python ``website_create`` pipeline
// writes the chosen design to ``public/prototype.html``; the Next.js
// pipeline (``website_create_opencode``) overlays real routes onto
// ``src/app/`` and never writes a prototype file. The rewrite below only
// kicks in for legacy apps so the new pipeline's real routes take effect
// without hitting an infinite-loop on Vercel
// (``/`` → ``/prototype.html`` → 404 → ``_not-found`` → rewrite → loop).
const hasPrototypeHtml = fs.existsSync(
  path.join(__dirname, 'public', 'prototype.html'),
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['*.sandbox.kite.ai'],

  // Legacy: serve the chosen design as the live site. The backend writes
  // ``public/prototype.html`` (with its content JSONs in ``public/content/``)
  // and this rewrite makes any non-API, non-static request fall through to
  // that single static file. The prototype's own client-side router handles
  // route changes by reading ``window.location.pathname``, so multi-page
  // sites work without per-route server handlers.
  async rewrites() {
    if (!hasPrototypeHtml) return [];
    return [
      {
        source:
          '/((?!api|_next|content|images|js|favicon|robots|sitemap|prototype).*)',
        destination: '/prototype.html',
      },
    ];
  },
};

module.exports = nextConfig;

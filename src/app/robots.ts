import type { MetadataRoute } from 'next';
import { getBaseUrl } from '../lib/site-url';

// Next.js serves this at `/robots.txt` automatically. Emitted from code so
// the `Sitemap:` directive can be an absolute URL — sitemaps.org and Google
// both silently ignore relative `Sitemap:` lines, so a static
// `public/robots.txt` saying `Sitemap: /sitemap.xml` would not actually
// register the sitemap with crawlers.

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/',
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

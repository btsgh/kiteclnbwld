// Resolves the deploy URL for metadata routes (sitemap, robots). Used by
// both `app/sitemap.ts` and `app/robots.ts` so they advertise the same
// origin. Vercel sets VERCEL_PROJECT_PRODUCTION_URL on production
// deployments and VERCEL_URL on previews — both come without a scheme.

export function getBaseUrl(): string {
  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:4321';
}

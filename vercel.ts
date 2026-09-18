import { existsSync, readFileSync } from 'node:fs';

// Per-app redirects.csv is the platform's "bulk redirects" channel. The
// template ships a header-only file by default; only point Vercel at it once
// at least one redirect row has been added. Row validity is enforced by Vercel
// itself at build time.
// Vercel runs vercel.ts with cwd at the project root (where this file lives).
function hasRedirectRows(): boolean {
  if (!existsSync('redirects.csv')) return false;
  const dataRows = readFileSync('redirects.csv', 'utf8')
    .split('\n')
    .slice(1)
    .filter((line) => line.trim().length > 0);
  return dataRows.length > 0;
}

// Common headers for both layouts — security hardening that applies regardless
// of framework.
const SECURITY_HEADERS = [
  {
    source: '/(.*)',
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Content-Security-Policy',
        value:
          "default-src * 'self' data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors *",
      },
    ],
  },
];

const REDIRECTS_CONFIG = hasRedirectRows()
  ? { bulkRedirectsPath: 'redirects.csv' }
  : {};

// Layout detection: new apps generated from the Next.js templates always ship
// `next.config.*` at the project root (this template uses `next.config.js`,
// the Payload template `next.config.mjs`). Legacy apps generated from the
// older Vite + Fastify template don't — they have a `frontend/` + `backend/`
// split and own a frozen `package.json` from when they were created. Each
// layout needs different Vercel project settings, so this single file branches
// on the marker file. Existing apps keep redeploying without intervention.
// Keep in sync with NEXT_CONFIG_NAMES in backend/app/utils/nextjs_detection.py.
const isNextjs = [
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'next.config.cjs',
].some((name) => existsSync(name));

// Plain object export — no `@vercel/config` import. Each deployed app has a
// frozen package.json from when it was generated; importing `@vercel/config`
// here would force every existing app to add the package as a dep before its
// next deploy. The Vercel docs explicitly support a bare typed export.
export const config = isNextjs
  ? {
      // Let Vercel use its built-in Next.js handling — it picks the right
      // build command, install command, and output directory based on the
      // detected lockfile and the `next` dep in package.json.
      framework: 'nextjs',
      ...REDIRECTS_CONFIG,
      headers: SECURITY_HEADERS,
    }
  : {
      framework: null,
      cleanUrls: true,
      outputDirectory: 'frontend/dist/client',
      ...REDIRECTS_CONFIG,
      headers: SECURITY_HEADERS,
      rewrites: [
        { source: '/api/(.*)', destination: '/api' },
        { source: '/(.*)', destination: '/api' },
      ],
      functions: {
        'api/index.ts': {
          includeFiles:
            '{shared/openapi_spec.yaml,node_modules/.pnpm/@seriousme+openapi-schema-validator@*/node_modules/@seriousme/openapi-schema-validator/schemas/**/*.json,frontend/dist/client/**}',
        },
      },
    };

import type { Metadata } from 'next';
import {
  RUNTIME_ERROR_CAPTURE_SCRIPT,
  buildErrorProviderPin,
  buildPosthogInitScript,
  escapeJsonForScript,
  isValidPosthogToken,
} from '@appsmithorg/template-frontend';
import DevErrorOverlay from '@/components/dev-error-overlay';
import ScrollReveal from '@/components/scroll-reveal';
import { getBaseUrl } from '@/lib/site-url';
import { linkedInInsightTagScript } from '@/lib/linkedin-insight-tag';
import './globals.css';

// metadataBase resolves the relative `alternates.canonical` and
// `openGraph.url` paths that route pages export into absolute URLs, and
// follows the deploy URL (preview, production, custom domain) instead of a
// domain frozen at generation time.
export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: 'Prototype',
  description: '',
  twitter: { card: 'summary_large_image' },
};

// Cache-bust for the stamp-driven SDK: a content hash DERIVED at build time in
// next.config.js from public/kite-analytics.js itself — never hand-bumped, so an
// SDK edit can't ship with a stale ?v= (returning visitors always re-fetch).
const KITE_SDK_VERSION = process.env.NEXT_PUBLIC_KITE_SDK_HASH || 'dev';

// `apiHost` is an option of @appsmithorg/template-frontend 1.1.11. The installed
// 1.1.10 predates it, so its published .d.ts rejects the property while the
// helper below still reads it at runtime — a build-order gap, not a wrong call.
// Mirror the ONE missing field by intersecting the published parameter type
// rather than restating it, so every other option stays checked against the real
// shape. Delete this once package.json's range floors at 1.1.11 (the
// package-publish auto-PR) and pass the literal inline again.
type PosthogInitOptions = NonNullable<
  Parameters<typeof buildPosthogInitScript>[1]
> & { apiHost?: string };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // PostHog analytics — sits beside Pirsch. Per-site project token injected at
  // build via NEXT_PUBLIC_KITE_POSTHOG_KEY — Kite-namespaced on purpose, so a
  // site imported with its own PostHog keeps reading the unprefixed name for its
  // OWN project and the two never resolve to the same token; production-only.
  // The helpers come from
  // @appsmithorg/template-frontend (>=1.1.7 — the version that exports all
  // three), the same published-package channel the Payload layout uses; seeded
  // sites pick up helper changes at publish time. Returns null for a
  // missing/malformed token.
  // Capture-off on purpose FOR THIS TEMPLATE ONLY: the Kite analytics SDK below
  // emits page_viewed/page_engaged as the source of truth and the data-kite-*
  // stamps are the interaction vocabulary — posthog-js $pageview/$autocapture
  // would double-count and harvest element text. Consumers without the SDK
  // (Vite, Payload) keep the helper's capture-on defaults.
  const posthogOptions: PosthogInitOptions = {
    capturePageview: false,
    capturePageleave: false,
    autocapture: false,
    // Injected at build beside the token, from the same backend setting
    // the management API and the analytics read path use. Absent, the
    // helper falls back to its US default — so an older deploy keeps the
    // host it already had, and a region change cannot leave sites
    // ingesting to one cloud while the platform reads another.
    apiHost: process.env.NEXT_PUBLIC_KITE_POSTHOG_HOST,
    // The init is a NAMED instance ('kite') on every site — built into the
    // helper, not an option, so no shell can forget it. `window.__KITE_PH__`
    // is then the Kite destination everywhere.
    // Bootstrap posthog-js on the first-party `kite_did` cookie instead of
    // letting it mint its own anonymous id. The helper prepends the
    // visitor-id script to what it returns, so this is one self-contained
    // blob and the ordering cannot be broken by a caller. That id is also
    // what the platform reads
    // off the same-origin contact-form POST when it records a conversion
    // server-side — so client and server events land on ONE person even
    // when posthog-js itself is blocked.
    bootstrapFromVisitorId: true,
  };
  const posthogScript =
    process.env.NODE_ENV === 'production'
      ? buildPosthogInitScript(
          process.env.NEXT_PUBLIC_KITE_POSTHOG_KEY,
          posthogOptions,
        )
      : null;

  // Kite custom-event analytics envelope. The stamp-driven SDK
  // (/kite-analytics.js) reads window.__KITE_ENV__ and captures through the
  // named instance the init above publishes — window.__KITE_PH__, or its
  // pre-load queue window.posthog.kite. Production-only; needs both a PostHog
  // project and a website id. `<` escaped so no value can close the inline
  // <script> (XSS guard).
  const kiteEnv =
    process.env.NODE_ENV === 'production' &&
    isValidPosthogToken(process.env.NEXT_PUBLIC_KITE_POSTHOG_KEY) &&
    process.env.NEXT_PUBLIC_KITE_WEBSITE_ID
      ? escapeJsonForScript({
          posthogToken: process.env.NEXT_PUBLIC_KITE_POSTHOG_KEY,
          websiteId: process.env.NEXT_PUBLIC_KITE_WEBSITE_ID,
          accountId: process.env.NEXT_PUBLIC_KITE_ACCOUNT_ID || undefined,
          goalType: process.env.NEXT_PUBLIC_KITE_GOAL_TYPE || undefined,
          // The site's own analytics providers, DECLARED by the platform's
          // detector for this exact site (deploy env, comma-separated detector
          // names). The SDK's mirroring wraps only these — it never sniffs
          // globals — so the key is simply absent on a site with none.
          mirrorProviders: (process.env.NEXT_PUBLIC_KITE_MIRROR_PROVIDERS || '')
            .split(',')
            .map((name) => name.trim())
            .filter(Boolean),
          schemaVersion: '1.0',
        })
      : null;

  // Pinned when the team connected LinkedIn Ads and injected at build; absent for
  // every other team. Digits only, because the value is inlined into a script.
  const linkedinInsightScript =
    process.env.NODE_ENV === 'production'
      ? linkedInInsightTagScript(
          process.env.NEXT_PUBLIC_KITE_LINKEDIN_PARTNER_ID,
        )
      : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Flags scripting for the scroll-reveal CSS gate (html.js in */}
        {/* globals.css). Inline and first so the class lands before paint — */}
        {/* reveal content must never start hidden unless JS is running. The */}
        {/* html-level suppressHydrationWarning above covers the class-attr */}
        {/* mismatch this creates. */}
        <script
          id="js-class-bootstrap"
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js');",
          }}
        />
        {/* Runtime error capture. Inlined first so window listeners attach before */}
        {/* any user code runs, catching async/window errors + unhandled rejections */}
        {/* that the global-error boundary (render errors only) never sees. Gated */}
        {/* on either analytics token. The provider pin (ANALYTICS_ERROR_PROVIDER, */}
        {/* set by provisioning to match the backend Errors view) is prepended so */}
        {/* writes go to the same provider reads do; absent, it falls back to */}
        {/* whichever SDK is present. Script + pin live in the shared package (one */}
        {/* source with the Vite runtime-error-capture plugin). */}
        {process.env.NODE_ENV === 'production' &&
          (process.env.NEXT_PUBLIC_PIRSCH_TOKEN ||
            process.env.NEXT_PUBLIC_KITE_POSTHOG_KEY) && (
            <script
              id="runtime-error-capture"
              dangerouslySetInnerHTML={{
                __html:
                  buildErrorProviderPin(
                    process.env.NEXT_PUBLIC_ANALYTICS_ERROR_PROVIDER,
                  ) + RUNTIME_ERROR_CAPTURE_SCRIPT,
              }}
            />
          )}
        {/* Pirsch analytics. A static <script> (not next/script) so it sits in */}
        {/* the server HTML at parse time — pa.js then auto-tracks the first */}
        {/* pageview and SPA navigations. next/script's afterInteractive injects */}
        {/* post-load, after pa.js's load hooks have fired, so the initial */}
        {/* pageview is missed; beforeInteractive can strip data-* in app router */}
        {/* (vercel/next.js#49830). Token injected at build via */}
        {/* NEXT_PUBLIC_PIRSCH_TOKEN (deployment_service); absent in dev. */}
        {process.env.NODE_ENV === 'production' &&
          process.env.NEXT_PUBLIC_PIRSCH_TOKEN && (
            <script
              defer
              src="https://api.pirsch.io/pa.js"
              id="pianjs"
              data-code={process.env.NEXT_PUBLIC_PIRSCH_TOKEN}
            />
          )}
        {/* PostHog analytics (autocapture + pageviews). Inline so it sits in the */}
        {/* server HTML at parse time, beside Pirsch. Because this was built with */}
        {/* bootstrapFromVisitorId, it already carries the first-party `kite_did` */}
        {/* script ahead of the init — one tag, so the order cannot be broken here. */}
        {posthogScript && (
          <script
            id="posthog-analytics"
            dangerouslySetInnerHTML={{ __html: posthogScript }}
          />
        )}
        {/* Kite custom-event analytics SDK. Inline envelope (parse-time, after */}
        {/* PostHog init) then the deferred stamp-driven SDK from public/. */}
        {kiteEnv && (
          <>
            <script
              id="kite-analytics-env"
              dangerouslySetInnerHTML={{
                __html: `window.__KITE_ENV__=${kiteEnv};`,
              }}
            />
            <script src={`/kite-analytics.js?v=${KITE_SDK_VERSION}`} defer />
          </>
        )}
        {/* LinkedIn Insight Tag for the team's own ad account. */}
        {linkedinInsightScript && (
          <script
            id="linkedin-insight-tag"
            dangerouslySetInnerHTML={{
              __html: linkedinInsightScript,
            }}
          />
        )}
      </head>
      {/* suppressHydrationWarning (html above + body): extensions and the */}
      {/* preview iframe host stamp attributes on both before React hydrates */}
      {/* (Grammarly marks <body>); the mismatch is attribute-only and */}
      {/* harmless, but would open the dev error overlay. */}
      <body suppressHydrationWarning>
        {process.env.NODE_ENV !== 'production' && <DevErrorOverlay />}
        {/* Site-wide scroll-reveal observer. Mounted here only (it watches */}
        {/* <body> for new matches itself) — pages must not add their own. */}
        <ScrollReveal />
        {children}
      </body>
    </html>
  );
}

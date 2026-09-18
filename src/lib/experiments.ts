import { cache } from 'react';

import { cookies } from 'next/headers';

/**
 * Server-side A/B experiment assignment.
 *
 * Call this from a page that renders a `<KiteExperimentSwitch>`, never from the
 * root layout: reading cookies opts the calling route into dynamic rendering,
 * and a layout would drag every route beneath it along. Scoped to experiment
 * pages, the rest of the site stays statically generated and CDN-cached
 * (verified: a page calling this builds as `ƒ`, its siblings stay `○`).
 *
 * The variant is decided before any HTML is produced, so the page ships only
 * the assigned branch — the losing variant has zero layout on frame 1. The same
 * assignments are handed to posthog-js via `bootstrap` in the layout, so the
 * client starts out already knowing its bucket and never re-buckets or reflows.
 *
 * The `kite_did` cookie is minted by `middleware.ts`, which also forwards it on
 * the *request*, so even a visitor's first-ever pageview resolves a real
 * assignment. Without that forward the first request would see no cookie, fall
 * back to control, and record no exposure — on a single-page site every session
 * is that first request, which would zero exposure for the whole experiment.
 */

/**
 * Anonymous visitor id. Shared with posthog-js as its `distinctID`.
 * Duplicated on purpose in `middleware.ts` (which resolves it server-side) and
 * in `visitor-id.js` in `@appsmithorg/template-frontend` (which resolves it
 * client-side, for sites that also record conversions server-side) — neither
 * may import this module. Change all three together.
 */
export const KITE_DID_COOKIE = 'kite_did';

/**
 * Consent, as the server can see it — the same cookie `middleware.ts` reads
 * before minting, duplicated there on purpose (middleware may import nothing
 * from `src/`; change the two together). Only the exact value `denied`
 * refuses; absent means granted, matching the client defaults
 * (`!== 'denied'` and `|| 'granted'`).
 */
const KITE_CONSENT_COOKIE = 'kite_consent';
const CONSENT_DENIED = 'denied';

/**
 * Flag key -> assigned variant (`"control"` / `"test"`).
 *
 * Bucketing always uses the anonymous id, never an authenticated one: PostHog's
 * "persist flags across authentication" is incompatible with bootstrapping, and
 * an id that changes mid-session would flip the visitor's variant.
 */
export type ExperimentAssignments = Record<string, string>;

/**
 * PostHog's decide endpoint. `?v=2` returns variants under `flags[key].variant`.
 *
 * The ingest host is duplicated on purpose from `POSTHOG_INGEST_HOST` in
 * `packages/kite-template-frontend/src/vite/integrations/posthog.js` — the
 * template runtime must not import the vite package. Change the two together
 * (e.g. if the org moves to EU Cloud).
 */
const FLAGS_ENDPOINT = 'https://us.i.posthog.com/flags?v=2';

/**
 * Budget for the flag call. Every visitor waits on this before the first byte,
 * so it is deliberately tight: a slow PostHog degrades to control rather than
 * to a slow site.
 */
const FLAGS_TIMEOUT_MS = 300;

type FlagsResponse = {
  flags?: Record<string, { variant?: string | null }>;
};

/**
 * Resolve every experiment assignment for this visitor.
 *
 * Fails open to `{}` on a missing token, a timeout, a non-200, or a malformed
 * body. An empty map renders control everywhere — the correct degraded state:
 * the site stays up and only the experiment under-reports.
 *
 * A visitor whose `kite_consent` cookie reads `denied` also resolves `{}` —
 * deliberately, and on EVERY request, not only at mint time. The middleware's
 * consent gate can only stop a first-visit mint: a visitor minted before they
 * denied still holds `kite_did` for a year, and this check is what stops that
 * id from being POSTed to PostHog on every later pageview. Empty assignments
 * render control and expose no keys, so the experiment under-counts; it never
 * tracks a visitor who said no.
 *
 * Residual cost of failing open, on multi-page sites only: the fail-open is
 * per pageview, so one navigation can time out (→ control) while the next
 * resolves (→ the sticky `test` assignment) — the visitor sees the variant
 * flip across navigations. Single-page sites (the common generated shape)
 * cannot hit this: the session has only the one pageview. The analytics stay
 * clean either way: the failed pageview bootstraps posthog-js with empty
 * flags, so no exposure is recorded for it — the experiment under-counts, it
 * never mis-attributes.
 *
 * Wrapped in React `cache()` so a page with several switches (or a layout and
 * a page both calling it) makes ONE flags call per request, not one per call
 * site. `cache()` is request-scoped on the server, so visitors never share a
 * result — the per-visitor `no-store` on the fetch below still holds.
 */
export const resolveExperiments = cache(
  async (): Promise<ExperimentAssignments> => {
    const token = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!token) return {};

    const store = await cookies();
    if (store.get(KITE_CONSENT_COOKIE)?.value === CONSENT_DENIED) return {};

    const distinctId = await getKiteDistinctId();
    if (!distinctId) return {};

    try {
      const res = await fetch(FLAGS_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ api_key: token, distinct_id: distinctId }),
        // Assignments are per-visitor; a shared cache would hand one visitor's
        // bucket to every other visitor.
        cache: 'no-store',
        signal: AbortSignal.timeout(FLAGS_TIMEOUT_MS),
      });
      if (!res.ok) return {};

      const body = (await res.json()) as FlagsResponse;
      const assignments: ExperimentAssignments = {};
      for (const [key, value] of Object.entries(body.flags ?? {})) {
        // Multivariate flags carry `variant`; a boolean flag carries none and is
        // not an experiment.
        if (value?.variant) assignments[key] = value.variant;
      }
      return assignments;
    } catch {
      // Timeout or network failure — fail open to control. See the docblock
      // above for the cross-navigation variant flip this can produce on
      // multi-page sites (and why no wrong exposure is recorded).
      return {};
    }
  },
);

/** The visitor id handed to posthog-js, so client and server share one identity. */
export async function getKiteDistinctId(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(KITE_DID_COOKIE)?.value;
}

import { NextResponse, type NextRequest } from 'next/server';

// Resolves the anonymous visitor id used to bucket A/B experiments — adopting an
// identity the visitor already has, minting one only on a true first visit.
// Nothing else: no data fetching, no rewrites, no upstream calls.
//
// Two invariants, both with an incident behind them:
// - Pass-through is ALWAYS `NextResponse.next()`. Never `fetch(req)` — that
//   re-enters the edge and 508s.
// - This file imports nothing from `src/`, so the cookie name is duplicated here
//   (and in the client-side `visitor-id.js`) on purpose. Change all three.
//
// Why, plus the static-generation measurements:
// docs/decisions/2026-07-21-experiments-authored-in-the-draft-not-composed-at-start.md
// ("The visitor id, in detail").
const KITE_DID_COOKIE = 'kite_did';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Consent, as the edge can see it. The browser halves read
// `window.__KITE_CONSENT__` (visitor-id.js) and `window.__KITE_ENV__.consentState`
// (kite-analytics.js), neither of which exists here — so a site that denies
// consent mirrors it into this cookie, and that is the only signal this file
// can honour. Absent means granted, matching both client defaults
// (`!== 'denied'` and `|| 'granted'`). The name/value pair is duplicated on
// purpose in `src/lib/experiments.ts`, which honours the same denial when
// resolving assignments — change the two together.
const KITE_CONSENT_COOKIE = 'kite_consent';
const CONSENT_DENIED = 'denied';

// posthog-js persists its own state in `ph_<project token>_posthog`. Matched by
// prefix + marker rather than by exact name because the token is per-site.
const POSTHOG_COOKIE_PREFIX = 'ph_';
const POSTHOG_COOKIE_MARKER = '_posthog';

/**
 * The anonymous id posthog-js is already using for this visitor, if any.
 *
 * Minting over an id posthog-js already holds detaches an established visitor
 * from their own history, because the layout's bootstrap OVERWRITES posthog-js's
 * persisted `distinct_id`. So: adopt first, mint last.
 *
 * This ladder must stay identical to the client-side one in
 * `packages/kite-template-frontend/src/vite/integrations/visitor-id.js` — pinned
 * by `test_middleware_and_client_visitor_id_ladders_agree`, because middleware
 * always wins the race, so a disagreement would surface as the client's adoption
 * silently never running rather than as a conflict.
 *
 * No manual encoding: Next decodes cookie values on read and re-encodes on
 * write, matching the client script's own encode/decode pair.
 */
function adoptPosthogVisitorId(request: NextRequest): string | undefined {
  for (const { name, value } of request.cookies.getAll()) {
    if (!name.startsWith(POSTHOG_COOKIE_PREFIX)) continue;
    if (!name.includes(POSTHOG_COOKIE_MARKER)) continue;
    try {
      const stored = JSON.parse(value) as { distinct_id?: unknown } | null;
      // Shape-checked rather than coerced. `String()` turns an object or array
      // into `[object Object]` / a joined list and adopts THAT as the visitor's
      // durable identity — every such visitor collapsing onto one shared id,
      // which buckets them into one arm and silently ruins the split. A cookie
      // that does not hold a string id holds no id: fall through and mint.
      if (typeof stored?.distinct_id === 'string' && stored.distinct_id) {
        return stored.distinct_id;
      }
    } catch {
      // A malformed posthog cookie just means there is no id to adopt — fall
      // through to the next cookie, then to a fresh mint. Never throw: this
      // runs on every page request, so an exception here is a site-wide outage
      // traded for an analytics nicety.
    }
  }
  return undefined;
}

export default function middleware(request: NextRequest) {
  // Consent is checked FIRST, so a denial wins on every request — not only on
  // the visit that would have minted. A never-minted visitor who denies gets no
  // id at all, not even a render-scoped one; a visitor who denies AFTER being
  // minted still holds `kite_did` for a year, passes straight through here, and
  // `resolveExperiments()` honours the same cookie to stop that id from being
  // POSTed to PostHog on every later pageview. Both halves degrade identically:
  // no assignments, control rendered, nothing recorded.
  //
  // Why "no id at all" rather than a render-scoped one (this gate used to sit
  // between the request-side forward and the durable Set-Cookie): the server
  // would resolve arms for id X and the bootstrap would emit `featureFlags`
  // computed for X, while the browser — holding no cookie — mints its own Y.
  // `$feature_flag_called` then fires for person Y carrying X's variant, which
  // is a MIS-ATTRIBUTED exposure. `src/lib/experiments.ts` states the contract
  // the other way round: the experiment under-counts, it never mis-attributes.
  //
  // The cookie is an integration point, and it is opt-in: nothing in the
  // template writes it. `window.__KITE_CONSENT__` (visitor-id.js) and
  // `window.__KITE_ENV__.consentState` (kite-analytics.js) are browser globals
  // the edge cannot read, so a site that wants middleware to honour a refusal
  // must mirror it into this cookie itself. Absent means granted, matching both
  // client defaults (`!== 'denied'` and `|| 'granted'`).
  if (request.cookies.get(KITE_CONSENT_COOKIE)?.value === CONSENT_DENIED) {
    return NextResponse.next();
  }

  // `.value`, not the object: `cookies.get()` returns `{name, value}` whenever
  // the header key is present, so a client sending `kite_did=` would look
  // cookied while `resolveExperiments()` reads an empty id and returns no
  // assignments — that visitor renders control forever and is never re-minted.
  if (request.cookies.get(KITE_DID_COOKIE)?.value) return NextResponse.next();

  // Adopt first, mint last: a brand-new id is only correct for a visitor this
  // site has genuinely never seen. See `adoptPosthogVisitorId`.
  const visitorId = adoptPosthogVisitorId(request) ?? crypto.randomUUID();

  // Set on the REQUEST as well as the response. A page's ``cookies()`` reads the
  // request, so without this forward a visitor's first pageview would resolve no
  // assignments — they would see control regardless of bucket and their events
  // would carry no ``$feature/<flag>`` property, leaving exposure at zero. On a
  // single-page site (the common generated shape) every session IS that first
  // request, which would zero exposure for the whole experiment.
  request.cookies.set(KITE_DID_COOKIE, visitorId);
  const response = NextResponse.next({ request });

  // httpOnly is false because the client half of this identity reads the cookie
  // directly, and two paths now depend on that: `KITE_VISITOR_ID_SCRIPT`
  // publishes it as `window.__KITE_DID__` for posthog-js's bootstrap, and
  // `contact-form-submit.ts` sends it with the form POST so a server-recorded
  // conversion lands on the same person who browsed the site. Making it HttpOnly
  // would silently unstitch every server-side conversion. Safe to expose: it is
  // an anonymous bucketing key, never a credential.
  response.cookies.set(KITE_DID_COOKIE, visitorId, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ONE_YEAR_SECONDS,
    path: '/',
  });
  return response;
}

export const config = {
  // Skip API routes and static assets. The `.*\..*` clause is what covers
  // `public/` — without it a cold visit mints a separate id per parallel asset
  // request and the next navigation buckets on a different one than the arm just
  // served. App routes are extensionless, so excluding any path with a dot keeps
  // every real page. Full reasoning in the decision record named at the top.
  //
  // `api/|api$` rather than a bare `api`: the negative lookahead is a prefix
  // match, so a bare clause would also exclude real page routes that merely
  // START with those letters (`/apidocs`, `/apiary`) — silently, since the
  // page still renders, just never bucketed.
  matcher: ['/((?!api/|api$|_next/static|_next/image|.*\\..*).*)'],
};

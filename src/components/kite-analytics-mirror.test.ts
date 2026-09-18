// Behaviour contract for third-party client mirroring in the analytics SDK.
// The template ships no unit-test runner, so this is a self-contained script
// (run in CI by nextjs-template-code-quality.yml, like the arm-selection and
// bootstrap-merge contracts beside it).
//
// It evaluates `packages/kite-analytics/kite-analytics.js` ITSELF — the SDK
// source this repo publishes — against a stand-in window. Nothing is
// re-implemented here, because the failure this guards is that file drifting
// from what the mirroring design says it does.
//
// COVERAGE BOUNDARY: this is the source intended for publication, not the
// public/ copy a template serves. A site serves whichever version its
// lockfile resolved, so between publishing a version and the follow-up that
// refreshes the lockfiles the two differ, and this proves only the former.
//
// Run locally:
//   pnpm dlx tsx src/components/kite-analytics-mirror.test.ts

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SDK_SOURCE = readFileSync(
  join(process.cwd(), '..', 'packages', 'kite-analytics', 'kite-analytics.js'),
  'utf8',
);

type Captured = { event: string; props: Record<string, unknown> };

/** A window/document pair with just enough surface for the SDK to boot. */
function makeEnvironment(
  mirrorProviders: string[] = [],
  consentState = 'granted',
) {
  const captured: Captured[] = [];

  const win: Record<string, any> = {
    __KITE_ENV__: {
      websiteId: 'w1',
      accountId: 'a1',
      posthogToken: 'phc_test',
      consentState,
      // The DECLARED providers — the platform detector's findings for this
      // site. The SDK wraps only these; it never sniffs globals.
      mirrorProviders,
      schemaVersion: '2.0',
    },
    __KITE_PH__: {
      capture: (event: string, props: Record<string, unknown>) =>
        captured.push({ event, props }),
      register: () => {},
    },
    location: { pathname: '/', search: '', href: 'https://site.test/' },
    document: undefined as any,
    console,
    addEventListener: () => {},
    removeEventListener: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
    history: { pushState: () => {}, replaceState: () => {} },
    IntersectionObserver: class {
      observe() {}
      disconnect() {}
    },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    navigator: { userAgent: 'test' },
    screen: { width: 1280 },
    innerWidth: 1280,
    // Timeouts run immediately: every SDK use of them is a debounce, and the
    // contract below is about what gets mirrored, never about when.
    setTimeout: (fn: () => void) => {
      fn();
      return 0;
    },
    clearTimeout: () => {},
  };

  const doc: Record<string, any> = {
    readyState: 'complete',
    title: 'Test',
    referrer: '',
    // The live consent signal the mirror path reads (`kite_consent` cookie).
    // Empty by default: absent means granted, the sitewide client default.
    cookie: '',
    visibilityState: 'visible',
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: () => null,
    documentElement: { scrollHeight: 2000, clientHeight: 1000, scrollTop: 0 },
    body: { scrollHeight: 2000 },
  };
  win.document = doc;
  win.self = win;

  return { win, doc, captured };
}

// The free identifiers the SDK reads without a `window.` prefix. Passing them
// as parameters is what makes the stand-in the SDK's ENTIRE visible world — a
// real global leaking in would let a case pass for the wrong reason.
const AMBIENT = [
  'window',
  'document',
  'location',
  'localStorage',
  'history',
  'screen',
  'IntersectionObserver',
  'MutationObserver',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
] as const;

function boot(env: ReturnType<typeof makeEnvironment>) {
  const values = AMBIENT.map((name) =>
    name === 'window' ? env.win : name === 'document' ? env.doc : env.win[name],
  );
  new Function(...AMBIENT, SDK_SOURCE)(...values);
}

const failures: string[] = [];
function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    console.log(`  ok  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function mirrored(captured: Captured[]) {
  return captured.filter((c) => c.props.kite_event_type === 'mirrored');
}

// 1. A DECLARED Mixpanel client already on the page is wrapped, and its call
//    still runs — the vendor first, unconditionally.
{
  const env = makeEnvironment(['mixpanel']);
  const vendorCalls: unknown[][] = [];
  env.win.mixpanel = {
    track: (...args: unknown[]) => {
      vendorCalls.push(args);
      return 'vendor-return';
    },
  };
  boot(env);
  const result = env.win.mixpanel.track('demo_requested', { plan: 'starter' });

  const seen = mirrored(env.captured);
  check('a declared mixpanel event is mirrored', seen.length === 1);
  check(
    'mirrored event keeps the vendor event name',
    seen[0]?.event === 'demo_requested',
  );
  check(
    'mirror_source names the vendor',
    seen[0]?.props.mirror_source === 'mixpanel',
  );
  check(
    'vendor property values are never transmitted',
    !('mirror_props' in (seen[0]?.props ?? {})) &&
      !('plan' in (seen[0]?.props ?? {})),
  );
  check('the vendor still receives its own call', vendorCalls.length === 1);
  check(
    'the vendor return value is passed through',
    result === 'vendor-return',
  );
}

// 2. Not transmitting vendor properties is the point: a vendor property named
//    like an envelope super-property must not reach the event at all, where it
//    would override it — and a vendor `email` must never cross into Kite's
//    store, because vendor properties carry no sensitivity classification.
{
  const env = makeEnvironment(['mixpanel']);
  env.win.mixpanel = { track: () => {} };
  boot(env);
  env.win.mixpanel.track('signup', {
    website_id: 'THEIRS',
    page_id: 'theirs',
    kite_event_type: 'cta_clicked',
    email: 'person@example.com',
  });

  const seen = mirrored(env.captured)[0];
  check(
    'a colliding website_id cannot override the envelope',
    seen?.props.website_id === undefined,
  );
  check(
    'a colliding page_id cannot override the envelope',
    seen?.props.page_id === undefined,
  );
  check(
    'kite_event_type stays "mirrored"',
    seen?.props.kite_event_type === 'mirrored',
  );
  check(
    'unclassified personal data never leaves the page',
    !JSON.stringify(seen?.props ?? {}).includes('person@example.com'),
  );
}

// 3. A declared client that ARRIVES after boot is wrapped by the property
//    trap the moment the vendor assigns it — the async snippet-load case.
//    No polling: there is no timer to outwait, however late it loads.
{
  const env = makeEnvironment(['amplitude']);
  boot(env);
  env.win.amplitude = { track: () => {} };
  env.win.amplitude.track('trial_started', { plan: 'pro' });

  const seen = mirrored(env.captured);
  check(
    'a late-arriving declared client is wrapped on arrival',
    seen.length === 1,
  );
  check(
    'mirror_source names amplitude',
    seen[0]?.props.mirror_source === 'amplitude',
  );
}

// 4. Stub libraries replace their own methods in place once the real client
//    loads. The method trap keeps the replacement wrapped — and one call is
//    mirrored exactly once, never doubled by the re-wrap.
{
  const env = makeEnvironment(['mixpanel']);
  env.win.mixpanel = { track: () => {} };
  boot(env);
  env.win.mixpanel.track = () => 'real-library';
  env.win.mixpanel.track('demo_requested');

  check(
    'an in-place method replacement stays wrapped, exactly once',
    mirrored(env.captured).length === 1,
  );
}

// 5. gtag (declared as google_analytics): only the 'event' command is an
//    event. Mirroring 'config' or 'consent' would invent events the site
//    never fired.
{
  const env = makeEnvironment(['google_analytics']);
  env.win.gtag = () => {};
  boot(env);
  env.win.gtag('config', 'G-ABC');
  env.win.gtag('consent', 'update', {});
  env.win.gtag('event', 'purchase', { value: 10 });

  const seen = mirrored(env.captured);
  check('gtag config/consent commands are not events', seen.length === 1);
  check(
    'the gtag event is mirrored under its name',
    seen[0]?.event === 'purchase',
  );
}

// 6. dataLayer (declared as google_tag_manager): entries without an `event`
//    key are variable assignments. GTM replacing `push` on the same array
//    when its container loads stays wrapped via the method trap.
{
  const env = makeEnvironment(['google_tag_manager']);
  env.win.dataLayer = [] as unknown[];
  (env.win.dataLayer as any).push = Array.prototype.push.bind(
    env.win.dataLayer,
  );
  boot(env);
  env.win.dataLayer.push({ pageCategory: 'pricing' });
  env.win.dataLayer.push({ event: 'form_submit', formId: 'contact' });

  const seen = mirrored(env.captured);
  check('a dataLayer variable assignment is not an event', seen.length === 1);
  check(
    'the dataLayer event is mirrored under its name',
    seen[0]?.event === 'form_submit',
  );
  check(
    'dataLayer entry values are never transmitted',
    seen[0]?.props.formId === undefined &&
      !('mirror_props' in (seen[0]?.props ?? {})),
  );
}

// 7. NOTHING undeclared is touched. `window.analytics` is a generic name —
//    a site with its own analytics object that happens to have a `track`
//    method must not be wrapped or mislabeled as Segment when the detector
//    never found Segment in its source.
{
  const env = makeEnvironment(['mixpanel']);
  const ownCalls: unknown[][] = [];
  env.win.analytics = { track: (...a: unknown[]) => ownCalls.push(a) };
  boot(env);
  env.win.analytics.track('their_internal_thing', {});

  check(
    'an undeclared generic `analytics` global is never wrapped',
    mirrored(env.captured).length === 0,
  );
  check('their object still works untouched', ownCalls.length === 1);
}

// 7b. The same client IS wrapped when the site actually declares segment.
{
  const env = makeEnvironment(['segment']);
  env.win.analytics = { track: () => {} };
  boot(env);
  env.win.analytics.track('demo_requested');

  const seen = mirrored(env.captured);
  check('a declared segment client is wrapped', seen.length === 1);
  check(
    'mirror_source names segment',
    seen[0]?.props.mirror_source === 'segment',
  );
}

// 7c. Segment's snippet queues early calls on an ARRAY stub, then
//     analytics-next replaces the global and replays the queue through the
//     real client. One user action must still produce ONE mirrored event:
//     wrapping the stub would mirror it when it queued and again when it
//     replayed.
{
  const env = makeEnvironment(['segment']);
  // The snippet's stub: an array the queued calls are pushed onto.
  const queue: unknown[][] = [];
  const stub: any = [];
  stub.track = (...args: unknown[]) => {
    queue.push(args);
  };
  env.win.analytics = stub;
  boot(env);

  env.win.analytics.track('demo_requested', { plan: 'starter' });
  check(
    'a call queued on the stub is not mirrored yet',
    mirrored(env.captured).length === 0,
  );

  // analytics-next loads: it replaces the global, then replays the queue
  // through the real instance's own public method.
  const real: any = { track: () => {} };
  env.win.analytics = real;
  for (const args of queue) env.win.analytics.track(...(args as [string, any]));

  const seen = mirrored(env.captured);
  check('the replayed call is mirrored exactly once', seen.length === 1);
  check(
    'the replayed mirror keeps the vendor event name',
    seen[0]?.event === 'demo_requested',
  );
}

// 8. A site that declares nothing gets nothing: no traps, no wrapping, no
//    work — and PostHog can never be declared (the installer table has no
//    entry), so a customer PostHog client is never wrapped.
{
  const env = makeEnvironment([]);
  const posthogCalls: unknown[][] = [];
  env.win.mixpanel = { track: () => {} };
  env.win.posthog = { capture: (...a: unknown[]) => posthogCalls.push(a) };
  boot(env);
  env.win.mixpanel.track('demo_requested');
  env.win.posthog.capture('their_event', {});

  check(
    'no declaration means nothing is mirrored',
    mirrored(env.captured).length === 0,
  );
  check('a customer PostHog client is untouched', posthogCalls.length === 1);
}

// 9. An explicit env consentState of 'denied' gates mirroring.
{
  const env = makeEnvironment(['mixpanel'], 'denied');
  env.win.mixpanel = { track: () => {} };
  boot(env);
  env.win.mixpanel.track('demo_requested', { plan: 'starter' });

  check(
    'nothing is mirrored without consent',
    mirrored(env.captured).length === 0,
  );
}

// 9b. Production supplies no consentState in __KITE_ENV__ — the authoritative
//     live signal is the `kite_consent` cookie (the same cookie middleware.ts
//     and src/lib/experiments.ts read). This is the producer-consumer contract
//     the field-based check alone cannot test.
{
  const env = makeEnvironment(['mixpanel']);
  delete env.win.__KITE_ENV__.consentState; // the production shape
  env.doc.cookie = 'kite_consent=denied';
  env.win.mixpanel = { track: () => {} };
  boot(env);
  env.win.mixpanel.track('demo_requested', { plan: 'starter' });

  check(
    'a denied kite_consent cookie blocks mirroring without any env field',
    mirrored(env.captured).length === 0,
  );
}

// 9c. Consent is read per capture, not snapshotted at boot: a visitor who
//     denies mid-session stops being mirrored on their next vendor call.
{
  const env = makeEnvironment(['mixpanel']);
  delete env.win.__KITE_ENV__.consentState;
  env.win.mixpanel = { track: () => {} };
  boot(env);
  env.win.mixpanel.track('before_denial');
  env.doc.cookie = 'other=1; kite_consent=denied';
  env.win.mixpanel.track('after_denial');

  const seen = mirrored(env.captured);
  check(
    'a mid-session denial stops later mirroring',
    seen.length === 1 && seen[0]?.event === 'before_denial',
  );
}

// 9d. An unreadable cookie jar fails CLOSED for mirroring: no readable
//     consent signal means no mirrored collection.
{
  const env = makeEnvironment(['mixpanel']);
  delete env.win.__KITE_ENV__.consentState;
  Object.defineProperty(env.doc, 'cookie', {
    get() {
      throw new Error('sandboxed');
    },
  });
  env.win.mixpanel = { track: () => {} };
  boot(env);
  env.win.mixpanel.track('demo_requested');

  check(
    'an unreadable consent signal blocks mirroring',
    mirrored(env.captured).length === 0,
  );
}

// 10. A vendor that throws must not take the site's own analytics down with
//     it — the error still surfaces to the vendor's caller.
{
  const env = makeEnvironment(['mixpanel']);
  env.win.mixpanel = {
    track: () => {
      throw new Error('vendor exploded');
    },
  };
  boot(env);
  let propagated = false;
  try {
    env.win.mixpanel.track('demo_requested');
  } catch {
    propagated = true;
  }
  check('a vendor error still surfaces to the vendor caller', propagated);
}

// 11. A declared vendor whose client cannot be trapped (frozen object) must
//     not take down the SDK: core instrumentation still installs and the
//     other declared providers still wrap.
{
  const env = makeEnvironment(['mixpanel', 'amplitude']);
  env.win.mixpanel = Object.freeze({ track: () => {} });
  env.win.amplitude = { track: () => {} };
  let threw = false;
  try {
    boot(env);
  } catch {
    threw = true;
  }
  env.win.amplitude.track('trial_started');

  check('an untrappable vendor client does not throw out of boot', !threw);
  check(
    'core instrumentation still emits with an untrappable vendor present',
    env.captured.some((c) => c.event === 'page_viewed'),
  );
  check(
    'other declared vendors are still wrapped',
    mirrored(env.captured).some((c) => c.props.mirror_source === 'amplitude'),
  );
}

// 12. The interception boundary: only clients exposed on `window` are
//     reachable. A module-local ESM client (`import mixpanel from
//     'mixpanel-browser'`) never touches window, so its events are NOT
//     mirrored even when declared — the backend inventory records such
//     providers, but this SDK's mirroring contract is deliberately narrower.
{
  const env = makeEnvironment(['mixpanel']);
  boot(env);
  // The production ESM shape: the bundled client lives in module scope only.
  const moduleLocalMixpanel = { track: (_name: string, _props?: object) => {} };
  moduleLocalMixpanel.track('demo_requested', { plan: 'starter' });

  check(
    'a module-local ESM client is outside the mirroring boundary',
    mirrored(env.captured).length === 0,
  );
}

console.log('');
if (failures.length) {
  console.error(`${failures.length} contract failure(s):`);
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}
console.log('kite-analytics mirroring contract OK');

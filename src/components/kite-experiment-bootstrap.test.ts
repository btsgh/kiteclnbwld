// Behaviour contract for the PostHog bootstrap-merge algorithm. The template
// ships no unit-test runner, so this is a self-contained script (run in CI by
// nextjs-template-code-quality.yml, like the arm-selection contract).
//
// The algorithm ships as a STATIC SOURCE STRING
// (`KITE_EXPERIMENT_BOOTSTRAP_SCRIPT`), so every case below executes the exact
// bytes production inlines — no bundler, transpiler, or minifier sits between
// what this file proves and what a visitor's browser parses. The stand-in
// windows use the same `_i` queue shape AND the same instance placement the
// backend contract suite pins by running the real vendor stub.
//
// Run locally:
//   pnpm dlx tsx src/components/kite-experiment-bootstrap.test.ts

import {
  KITE_EXPERIMENT_BOOTSTRAP_SCRIPT,
  type KiteBootstrapPayload,
  type KitePosthogWindow,
} from './kite-experiment-bootstrap-core';

// The shipped script, callable. Evaluating the constant here is the point of
// the file: the string must BE a function expression, or production's
// `(${script})(window,${payload});` composition is a syntax error.
const applyBootstrap = new Function(
  'win',
  'payload',
  `return (${KITE_EXPERIMENT_BOOTSTRAP_SCRIPT})(win, payload);`,
) as (win: KitePosthogWindow, payload: KiteBootstrapPayload) => boolean;

let failures = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.error(
      `  FAIL ${name}\n        expected: ${e}\n        actual:   ${a}`,
    );
  }
}

type QueuedConfig = { bootstrap?: Record<string, unknown> };
type PosthogStub = NonNullable<KitePosthogWindow['posthog']>;

/** What Kite's layout always passes as `posthog.init`'s third argument. */
const KITE_INSTANCE = 'kite';
/** What the vendor stub rewrites a missing third argument to. */
const UNNAMED_INSTANCE = 'posthog';

/**
 * A window shaped like the one the real vendor stub leaves behind.
 *
 * Placement is the point, not just the `_i` shape: for a NAMED init the stub
 * does `u=e[a]=[]` and hangs every queued method — `getFeatureFlag` included —
 * off `posthog[name]`, leaving the global object carrying `_i` and nothing
 * else. For an unnamed one it rewrites the name to `'posthog'` and keeps the
 * methods on the global object. A double that always exposed `getFeatureFlag`
 * globally is what let the exposure loop ship reading the wrong handle.
 */
function stubWindow(
  queuedConfig: QueuedConfig | null,
  instanceName: string = KITE_INSTANCE,
): {
  win: KitePosthogWindow;
  flagCalls: string[];
  config: QueuedConfig | null;
} {
  const flagCalls: string[] = [];
  const getFeatureFlag = (key: string) => {
    flagCalls.push(key);
  };
  const posthog: PosthogStub = {
    _i:
      queuedConfig === null ? [] : [['phc_token', queuedConfig, instanceName]],
  };
  if (instanceName === UNNAMED_INSTANCE) {
    posthog.getFeatureFlag = getFeatureFlag;
  } else {
    posthog[instanceName] = { getFeatureFlag };
  }
  return { win: { posthog }, flagCalls, config: queuedConfig };
}

const PAYLOAD: KiteBootstrapPayload = {
  distinctID: 'visitor-from-server',
  featureFlags: { 'exp-hero': 'test' },
  exposeKeys: ['exp-hero'],
};

function main(): void {
  // The layout queued an identity — it wins, and every key it queued survives
  // the merge. `featureFlagPayloads` stands in for whatever the layout's init
  // grows next; a fresh-object "merge" drops it silently.
  {
    const { win, flagCalls, config } = stubWindow({
      bootstrap: {
        distinctID: 'visitor-from-layout',
        featureFlagPayloads: { 'exp-hero': { copy: 'hi' } },
      },
    });
    const patched = applyBootstrap(win, PAYLOAD);
    check('patch reports it landed', patched, true);
    check(
      'layout identity wins the merge',
      config!.bootstrap!.distinctID,
      'visitor-from-layout',
    );
    check(
      'a queued key this code knows nothing about survives',
      config!.bootstrap!.featureFlagPayloads,
      { 'exp-hero': { copy: 'hi' } },
    );
    check('assignments land', config!.bootstrap!.featureFlags, {
      'exp-hero': 'test',
    });
    check('one exposure per rendered switch', flagCalls, ['exp-hero']);
  }

  // A site frozen before the layout carried a bootstrap: the config is queued
  // with no bootstrap at all, so the server-read id fills in rather than
  // leaving posthog-js to mint its own and re-bucket the visitor.
  {
    const { win, config } = stubWindow({});
    applyBootstrap(win, PAYLOAD);
    check(
      'frozen site falls back to the payload identity',
      config!.bootstrap!.distinctID,
      'visitor-from-server',
    );
  }

  // `featureFlags` is a wholesale replace — a stale assignment queued earlier
  // must not survive into the merged set, or the visitor renders one arm and
  // records another.
  {
    const { win, config } = stubWindow({
      bootstrap: { featureFlags: { 'exp-hero': 'control', 'exp-old': 'test' } },
    });
    applyBootstrap(win, PAYLOAD);
    check(
      'featureFlags is replaced whole, never merged per-key',
      config!.bootstrap!.featureFlags,
      { 'exp-hero': 'test' },
    );
  }

  // Only this page's switches are exposed. A page rendering one experiment on
  // a site running two must not touch the other's denominator.
  {
    const { win, flagCalls } = stubWindow({});
    applyBootstrap(win, {
      distinctID: 'v',
      featureFlags: { 'exp-hero': 'test', 'exp-pricing': 'control' },
      exposeKeys: ['exp-hero'],
    });
    check('exposure stays scoped to exposeKeys', flagCalls, ['exp-hero']);
  }

  // The return value gates the exposure loop: an empty queue means the patch
  // never landed, and exposing anyway would record a variant nothing rendered.
  {
    const { win, flagCalls } = stubWindow(null);
    const patched = applyBootstrap(win, PAYLOAD);
    check('an empty queue reports unpatched', patched, false);
    check('an unpatched store records no exposure', flagCalls, []);
  }

  // No posthog at all (script blocked, ad-blocker): degrade silently.
  {
    const patched = applyBootstrap({}, PAYLOAD);
    check('a page with no posthog degrades to unpatched', patched, false);
  }

  // THE INSTANCE CASE. Kite always inits NAMED, so the queued `getFeatureFlag`
  // is on `posthog.kite` and the global handle has none — and if the page runs
  // its own default posthog too, the global handle has one belonging to a
  // DIFFERENT project. Exposing there records nothing for Kite's experiment
  // (and pollutes someone else's), which is how a running experiment reads
  // zero exposures while the split visibly works.
  {
    const { win, flagCalls } = stubWindow({ bootstrap: {} });
    const strayCalls: string[] = [];
    win.posthog!.getFeatureFlag = (key: string) => {
      strayCalls.push(key);
    };
    applyBootstrap(win, PAYLOAD);
    check('exposure goes to the instance that was patched', flagCalls, [
      'exp-hero',
    ]);
    check("the page's own default instance is left alone", strayCalls, []);
  }

  // An unnamed init — no third argument, so the stub rewrites the name to
  // 'posthog' and keeps the methods on the global handle. Not what Kite ships,
  // but the fallback has to hold or a site that ever drops the name silently
  // stops recording.
  {
    const { win, flagCalls } = stubWindow({ bootstrap: {} }, UNNAMED_INSTANCE);
    applyBootstrap(win, PAYLOAD);
    check('an unnamed init exposes on the global handle', flagCalls, [
      'exp-hero',
    ]);
  }

  // THE COMPOSITION CASE. Run the component's exact inline-script shape —
  // script source and JSON payload composed into one statement — so a change
  // that breaks the argument-position payload (or turns the string into
  // something that is not a function expression) fails here rather than in
  // every visitor's browser.
  {
    const { win, flagCalls, config } = stubWindow({
      bootstrap: { distinctID: 'visitor-from-layout' },
    });
    const script = `(${KITE_EXPERIMENT_BOOTSTRAP_SCRIPT})(window,${JSON.stringify(PAYLOAD)});`;
    new Function('window', script)(win);
    check(
      'the inline composition still merges',
      config!.bootstrap!.distinctID,
      'visitor-from-layout',
    );
    check('the inline composition still exposes', flagCalls, ['exp-hero']);
  }

  if (failures === 0) {
    console.log('kite-experiment-bootstrap merge contract OK');
  } else {
    console.error(
      `kite-experiment-bootstrap merge contract: ${failures} FAILED`,
    );
    process.exit(1);
  }
}

main();

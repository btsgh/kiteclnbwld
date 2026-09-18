/**
 * The PostHog bootstrap-merge algorithm behind `<KiteExperimentBootstrap>`.
 *
 * A STATIC SOURCE STRING, not a live function — the same mechanism as
 * `KITE_VISITOR_ID_SCRIPT` and the loader stub in
 * `@appsmithorg/template-frontend`. The component inlines this text into a
 * `<script>`, so what ships to the browser is exactly the bytes below: no
 * bundler, transpiler, or minifier ever sits between the tested source and the
 * delivered script, and nothing in it can close over module scope. Tests run
 * these exact bytes: `kite-experiment-bootstrap.test.ts` drives the merge
 * contract through `new Function`, and the backend contract suite
 * (`backend/tests/test_template_assets/test_kite_experiment_sdk_contract.py`)
 * runs it against the layout's real init script.
 *
 * The body is ES5 (`var`, `for`, no arrows) and must stay that way: the string
 * is delivered verbatim, so it has to parse wherever the site does. Comments
 * live HERE, not inside the string — every byte of the string rides every
 * experiment page.
 *
 * Load-bearing invariants, each measured against the vendor loader stub:
 * - MERGE into the config the layout already queued; never assign over it, and
 *   never call `posthog.init()` again (a second init is swallowed, not queued).
 *   Building a fresh object dropped every key the layout had queued — harmless
 *   only because `bootstrapFromVisitorId: true` happens to queue nothing else
 *   today; `featureFlagPayloads` is the next one that would go.
 * - The layout owns `distinctID`; the payload's value is a fallback for sites
 *   frozen before the layout carried a bootstrap.
 * - `featureFlags` is a wholesale replace and must stay complete (a partial
 *   set re-buckets); `exposeKeys` must stay narrow (or other experiments'
 *   denominators are corrupted).
 * - The return value gates the exposure loop on the patch having actually
 *   landed: an unpatched store would record a wrong variant, so a lost race
 *   degrades to no exposure rather than a wrong one.
 * - Resolve `getFeatureFlag` on the instance the stub actually populated, NOT
 *   on `window.posthog`. Kite always inits named —
 *   `posthog.init(token, config, 'kite')`, and `KITE_INSTANCE_NAME` is a
 *   constant, not an option — while the stub hangs every queued method off
 *   `posthog[name]` (`u=e[a]=[]`), leaving the global object carrying `_i` and
 *   nothing else. Read there, the guard below silently skipped the whole
 *   exposure loop while the merge above kept working: the split ran, the
 *   variant rode every event as `$feature/<key>`, and the denominator stayed
 *   empty. The name comes off the same queue entry the config does, so the two
 *   can never disagree.
 *
 * Why each of those holds — the stub behaviour they were measured against, and
 * the failure each prevents:
 * `docs/decisions/2026-07-21-experiments-authored-in-the-draft-not-composed-at-start.md`
 * ("The client bootstrap, in detail").
 */

/** What `<KiteExperimentBootstrap>` embeds in the page for this visitor. */
export type KiteBootstrapPayload = {
  distinctID: string;
  featureFlags: Record<string, string>;
  exposeKeys: readonly string[];
};

/**
 * The slice of the PostHog loader stub the algorithm touches: `init` parks
 * `[token, config, name]` entries in `_i` until array.js replays them, and the
 * queued `getFeatureFlag` records an exposure. The `_i[0][1]` and `_i[0][2]`
 * shapes are pinned against the REAL stub by the backend contract suite.
 * Exported for the test harnesses that type their `new Function` wrapper
 * around the script.
 *
 * `getFeatureFlag` sits on the global object only for an UNNAMED init. Under a
 * name — which is what Kite ships — it lives on `posthog[name]` instead, hence
 * the index signature.
 */
export type KitePosthogWindow = {
  posthog?: {
    _i?: Array<
      [
        unknown,
        { bootstrap?: Record<string, unknown> } | undefined,
        string | undefined,
      ]
    >;
    getFeatureFlag?: (key: string) => unknown;
    /** Named instances: `posthog.init(token, config, 'kite')` → `posthog.kite`. */
    [instanceName: string]: unknown;
  };
};

/**
 * Source of a `function (win, payload)` expression: merge this visitor's
 * server-resolved assignments into the queued PostHog config, then record one
 * exposure per rendered switch. Evaluates to `true` when the patch landed —
 * the exposure loop only runs then. `win` is a {@link KitePosthogWindow},
 * `payload` a {@link KiteBootstrapPayload}.
 */
export const KITE_EXPERIMENT_BOOTSTRAP_SCRIPT = `function (win, payload) {
  var posthog = win.posthog;
  var queue = posthog && posthog._i;
  var patched = false;
  var instance = posthog;
  if (queue && queue.length && queue[0] && queue[0][1]) {
    var config = queue[0][1];
    var existing = config.bootstrap || {};
    var merged = {};
    for (var key in existing) {
      if (Object.prototype.hasOwnProperty.call(existing, key)) {
        merged[key] = existing[key];
      }
    }
    merged.distinctID = existing.distinctID || payload.distinctID;
    merged.featureFlags = payload.featureFlags;
    config.bootstrap = merged;
    patched = true;
    var name = queue[0][2];
    instance = (name && posthog[name]) || posthog;
  }
  if (patched && instance && instance.getFeatureFlag && payload.exposeKeys) {
    for (var i = 0; i < payload.exposeKeys.length; i++) {
      instance.getFeatureFlag(payload.exposeKeys[i]);
    }
  }
  return patched;
}`;

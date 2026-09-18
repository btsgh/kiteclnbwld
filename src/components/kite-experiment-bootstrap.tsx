import { escapeJsonForScript } from '@appsmithorg/template-frontend';

import { KITE_EXPERIMENT_BOOTSTRAP_SCRIPT } from './kite-experiment-bootstrap-core';
import {
  getKiteDistinctId,
  type ExperimentAssignments,
} from '@/lib/experiments';

/**
 * Hands posthog-js the bucket the server already rendered.
 *
 * Rendered by an experiment page, right after the layout's PostHog init. Pages
 * without experiments never render it, so they read no cookie and keep static
 * rendering.
 *
 * This component is TRANSPORT ONLY: it resolves the payload and emits the
 * algorithm as an inline script. The algorithm itself — the merge into the
 * queued config, the exposure loop, and the invariants both carry — lives in
 * `kite-experiment-bootstrap-core.ts`, tested directly by
 * `kite-experiment-bootstrap.test.ts` and, against the layout's real init
 * script, by the backend contract suite.
 */

export async function KiteExperimentBootstrap({
  assignments,
  flagKeys,
}: {
  assignments: ExperimentAssignments;
  /**
   * The flag keys whose switches this page actually renders — the only ones an
   * exposure is recorded for. Empty records NO exposure rather than every
   * exposure; widening it corrupts other experiments' denominators.
   *
   * Required, for the same reason `KiteExperimentSwitch.assignments` is (see
   * its prop doc). Optional let an authored page drop the array entirely and
   * still compile, build, preview and split visitors correctly — while
   * recording zero exposures, which reads as a working experiment until someone
   * opens the results. That is the incident in
   * `agent-context/entries/2026-07-24-experiment-zero-exposures-bootstrap-flag-called.md`,
   * and the only other net under it is `conclusive_bootstrap_absence`, which is
   * warn-only and disarms itself on a truncated scan. Spelling it required
   * makes the site's own `tsc` — which the draft build already runs — the thing
   * that catches it. `[]` stays legal for a caller that means it.
   */
  flagKeys: readonly string[];
}) {
  // The layout only emits the PostHog init in production, so there is no queued
  // config to patch in dev — and the draft preview resolves variants through the
  // preview provider, not through PostHog.
  if (process.env.NODE_ENV !== 'production') return null;

  const distinctId = await getKiteDistinctId();
  if (!distinctId) return null;

  // `featureFlags` stays complete so posthog-js never re-buckets; `exposeKeys`
  // is the narrower list the exposure loop iterates. Only keys the visitor
  // actually holds an assignment for are worth exposing — getFeatureFlag on an
  // unassigned key would record an exposure with no variant.
  const exposeKeys = flagKeys.filter((key) => key in assignments);
  const payload = escapeJsonForScript({
    distinctID: distinctId,
    featureFlags: assignments,
    exposeKeys,
  });
  // No JSON representation: emitting null would make the call below throw and
  // leave the queued config untouched, re-bucketing the visitor. Bail instead.
  if (!payload) return null;

  // Inline (never next/script) so it runs at parse time, before array.js
  // replays the queue. The algorithm crosses as the static source string the
  // unit test executes — the shipped bytes ARE the tested bytes, with no
  // bundler or minifier in between. This exact composition is what the backend
  // contract suite reproduces
  // (test_the_component_emits_the_core_function_as_its_script); change one
  // side only and that test says so.
  const script = `(${KITE_EXPERIMENT_BOOTSTRAP_SCRIPT})(window,${payload});`;

  return (
    <script
      id="kite-experiment-bootstrap"
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}

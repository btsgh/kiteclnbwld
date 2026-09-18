import { type ReactNode } from 'react';

import {
  KitePreviewProvider,
  KitePreviewVariant,
} from './kite-experiment-client';
// Type-only, so this server component pulls no runtime code (and no
// `next/headers`) out of the lib module.
import type { ExperimentAssignments } from '@/lib/experiments';

/**
 * A/B experiment switch.
 *
 * The two arms are typed slots, not children:
 *
 *     <KiteExperimentSwitch
 *       experimentId="…"
 *       flagKey="…"
 *       assignments={assignments}
 *       control={<>…the site as it is today…</>}
 *       test={<>…the change being tested…</>}
 *     />
 *
 * Slots are what make the switch impossible to author wrong in the two ways
 * the children-based version shipped wrong:
 *
 * 1. **An arm cannot hide behind a component boundary.** The old
 *    `<KiteVariant>` children had to be DIRECT children of the switch — an arm
 *    inside `<PricingRow/>`'s own JSX had not run when the switch inspected
 *    its children, so it was invisible to selection and rendered for every
 *    visitor (or, fail-closed, for none) while the context-based preview
 *    looked correct. With slots the switch never inspects anything: it returns
 *    the chosen prop's element, so what sits behind a component boundary is
 *    simply that arm's own content, selected before it renders.
 * 2. **An arm cannot be forgotten.** Both slots are required, so a switch
 *    missing one is a type error in the draft build rather than a live
 *    experiment with an accidental empty arm. Testing a removal is still a
 *    one-liner — pass `test={null}` — but now it reads as a decision instead
 *    of an omission.
 *
 * There is deliberately no `children` prop: the compiler rejecting nested
 * content is what retires the whole family of unwrapped-arm bugs (and the
 * post-edit scanner that tried to catch them).
 *
 * Two implementation constraints carry over from the children-based version,
 * each learned from a bug that shipped silently:
 *
 * - **Production selects the arm inside the switch, synchronously.** Never in
 *   the arms via shared state: React's flight renderer defers work into later
 *   tasks, so a module-level "current variant" is read after another request
 *   (or another switch on the same page) has overwritten it.
 * - **In production the whole tree stays server-side.** Putting the arms under
 *   a client provider makes React serialize *both* into the RSC flight
 *   payload — the losing copy then ships to every visitor and shows up in
 *   view-source (measured). Production returns only the assigned slot; the
 *   client boundary exists solely for the draft preview, which has to
 *   re-render on the editor's toggle.
 */

/**
 * The one flag key the platform mints for an experiment: `kite_exp_` plus the
 * experiment UUID's first 12 hex characters (the backend's
 * `experiment_shared.flag_key`, reimplemented byte-for-byte). Serving is gated
 * on this coherence below, which is the SEMANTIC enforcement boundary no
 * source-text scan can be: however a switch is reached — a direct tag, an
 * aliased or computed reference to this export, a JSX spread overriding a
 * prop — the effective props all arrive HERE, and a pair the platform did not
 * mint serves control to every visitor instead of splitting traffic.
 */
function mintedFlagKey(experimentId: string): string {
  return (
    'kite_exp_' + experimentId.toLowerCase().replace(/-/g, '').slice(0, 12)
  );
}

/** Variant served whenever there is no assignment. */
export const CONTROL_VARIANT = 'control';

/** The arm an assignment must name exactly for the test slot to serve. */
export const TEST_VARIANT = 'test';

/**
 * True in the draft preview (`next dev`), where PostHog is never initialised
 * and no flag can resolve, so the editor drives the variant instead.
 */
const IS_PREVIEW = process.env.NODE_ENV !== 'production';

export type KiteExperimentSwitchProps = {
  /** Names the experiment; what the preview toggle addresses. */
  experimentId: string;
  /** What PostHog buckets on. Stamped by the coding agent alongside the id. */
  flagKey: string;
  /**
   * Server-resolved assignments, from the page's one `resolveExperiments()`.
   *
   * Required as a KEY, nullable as a value. Making it optional let an authored
   * switch drop the prop entirely and still compile, build and preview
   * correctly — then serve `CONTROL_VARIANT` to every visitor in production
   * while the bootstrap kept recording exposures for both arms. That is the
   * same "arms look right, results measure nothing" shape as the zero-exposure
   * incident, and unlike that one it has no post-edit detector: the scan
   * matches `experimentId` + `KiteExperimentSwitch` and never reads props.
   * Spelling it `| undefined` makes the site's own `tsc` — which the draft
   * build already runs — the thing that catches it.
   */
  assignments: ExperimentAssignments | undefined;
  /**
   * The site as it is today. `null` shows this arm nothing — the baseline of a
   * test that ADDS something.
   */
  control: ReactNode;
  /**
   * The change being tested. `null` shows this arm nothing — how a removal is
   * tested.
   */
  test: ReactNode;
};

/**
 * Serve this visitor their assigned arm.
 *
 * Falls back to control whenever there is no assignment — an unresolved flag, a
 * paused experiment, a PostHog outage, or a crawler arriving without a cookie.
 * Control is the safe, deterministic default, which also keeps what search
 * engines index stable between crawls.
 */
export function KiteExperimentSwitch({
  experimentId,
  flagKey,
  assignments,
  control,
  test,
}: KiteExperimentSwitchProps) {
  if (IS_PREVIEW) {
    // Both arms render under the provider, each gated on the previewed variant
    // through context. Context is what lets the editor's toggle re-render the
    // choice at runtime; serializing both arms is fine HERE because the
    // preview is the one place a losing arm may ship.
    return (
      <KitePreviewProvider experimentId={experimentId}>
        <KitePreviewVariant type={CONTROL_VARIANT}>
          {control}
        </KitePreviewVariant>
        <KitePreviewVariant type={TEST_VARIANT}>{test}</KitePreviewVariant>
      </KitePreviewProvider>
    );
  }

  // The platform-minted pair is the serving precondition: a flagKey that is
  // not the one minted for this experimentId is not a platform-launched
  // experiment — whether the pair was hand-authored, produced by a spread
  // overriding one prop, or reached through an aliased/computed reference to
  // this component — so it serves control and never splits. Combined with the
  // assignment lookup below (assignments exist only for flags the platform
  // launched), no unregistered experiment can split traffic in production.
  if (flagKey !== mintedFlagKey(experimentId)) {
    return <>{control}</>;
  }

  // Keyed by flag key throughout: `resolveExperiments` copies PostHog's
  // `flags` object verbatim, and the bootstrap replays the same keys through
  // `getFeatureFlag`. `experimentId` is a dashed UUID from a disjoint
  // namespace, so it is never a key here.
  //
  // Selected HERE, in this call, and only the chosen slot is returned — the
  // losing arm is never rendered and never serialized. Anything that is not
  // exactly the test arm serves control: an unknown assignment value is a
  // remote-configuration bug, and control is the deterministic answer to it.
  const chosen = assignments?.[flagKey] ?? CONTROL_VARIANT;
  return <>{chosen === TEST_VARIANT ? test : control}</>;
}

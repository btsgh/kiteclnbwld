/**
 * Manifest assembly: turn a completed scan into the JSON the backend persists
 * into `site_event_catalog`.
 *
 * Assembly-time warnings (no_stamps, no_conversion, multiple_conversions,
 * intent_conversion, hero_without_cta) are pushed onto `state.warnings` — one
 * warnings channel end to end.
 */
import { recoverAttribution } from './kite-attribution.mjs';
import { SCHEMA_VERSION } from './kite-stamp-grammar.mjs';

/** Project a collected CTA down to the manifest's public shape (drops nulls). */
function publicCta(c) {
  const o = {
    cta_id: c.cta_id,
    kind: c.kind,
    event: c.event,
    is_conversion: c.is_conversion,
    surface_id: c.surface_id,
  };
  if (c.role !== undefined) o.role = c.role;
  if (c.href !== undefined) o.href = c.href;
  if (c.goal_type !== undefined) o.goal_type = c.goal_type;
  if (c.conversion_medium !== undefined)
    o.conversion_medium = c.conversion_medium;
  return o;
}

/** A surface entry with its in-scope CTAs nested. Every registered surface is
 * emitted (it fires section_viewed/section_engaged on its own), not only those
 * that contain a CTA. */
function surfaceEntry(s, scopeCtas) {
  const e = { surface_id: s.surface_id, position: s.position };
  if (s.surface_type !== undefined) e.surface_type = s.surface_type;
  e.ctas = scopeCtas
    .filter((c) => c.surface_id === s.surface_id)
    .map(publicCta);
  return e;
}

export function assembleManifest(state, srcArg) {
  const { ctas, surfaces, pages } = state;

  // A non-conversion form whose conversion sits on an INNER control never
  // fires its own event: the SDK resolves the inner conversion at submit and
  // fires the goal instead (kite-analytics.js onSubmit), so the form's
  // form_submitted entry would be a phantom with a permanent zero count.
  for (let i = ctas.length - 1; i >= 0; i--) {
    const c = ctas[i];
    if (c.kind === 'form' && !c.is_conversion && c._containsConversion) {
      ctas.splice(i, 1);
    }
  }

  // Assemble the manifest: events (deduped, ordered), pages with nested
  // surfaces+ctas, a shared bucket for stamps with no page ancestor (chrome),
  // and the home-first primary conversion.
  const events = [];
  const eventSeen = new Set();
  for (const c of ctas) {
    if (!eventSeen.has(c.event)) {
      eventSeen.add(c.event);
      events.push(c.event);
    }
  }
  // A hook-marked conversion form fires a literal `form_submitted` ATTEMPT
  // (conversion_attempt: true) on every native submit, BEFORE the success hook
  // fires the goal — guaranteed live traffic, so the catalog must list it.
  // Keyed on the shapes that actually submit — hook + conversion + form-type
  // on one element, or a hooked conversion contained in a stamped form (see
  // recordConversionHook / resolveContainment) — not just any hook stamp, or a
  // hook on a non-form widget conversion would catalog an event that can never
  // fire.
  // KEEP IN SYNC with public/kite-analytics.js onSubmit.
  if (state.sawHookedConversionForm && !eventSeen.has('form_submitted')) {
    eventSeen.add('form_submitted');
    events.push('form_submitted');
  }

  const surfaceList = [...surfaces.values()];
  const pageOrder = [...pages.keys()];

  // Cross-file page attribution recovery. Section components live in separate
  // files, so their AST never sees the `<main data-kite-page-id>` in page.tsx and
  // `page_id` comes back null — otherwise every surface/CTA files as page-less
  // chrome and per-page metrics + experiment surfaces are impossible (the runtime
  // SDK, which reads page_id live from the DOM, would disagree with the catalog).
  // The surface_id encodes the page (`<page>.<section>`), so recover the page from
  // that prefix when it matches a known page id.
  //
  // Cross-file attribution FIRST, so a surface it recovers can still feed the
  // prefix recovery below. See kite-attribution.mjs for why it only fires when
  // every render site of a component agrees.
  recoverAttribution(state.usage, surfaces.values(), ctas);

  const pageIdSet = new Set(pageOrder);
  const recoverPage = (id) => {
    if (typeof id !== 'string' || !id.includes('.')) return null;
    const prefix = id.slice(0, id.indexOf('.'));
    return pageIdSet.has(prefix) ? prefix : null;
  };
  for (const s of surfaces.values()) {
    if (s.page_id == null) {
      const p = recoverPage(s.surface_id);
      if (p) s.page_id = p;
    }
  }
  for (const c of ctas) {
    if (c.page_id == null) {
      const p = recoverPage(c.surface_id);
      if (p) c.page_id = p;
    }
  }

  // One assembly rule for both page buckets and the shared/chrome bucket
  // (pageId === null): the two must never diverge in shape, or the deploy-seam
  // consumer has to special-case the chrome (Header/Footer — the highest-traffic
  // events, rendered on every route).
  function bucketFor(pageId) {
    const scopeCtas = ctas.filter((c) => c.page_id === pageId);
    return {
      surfaces: surfaceList
        .filter((s) => s.page_id === pageId)
        .map((s) => surfaceEntry(s, scopeCtas)),
      ctas: scopeCtas.filter((c) => !c.surface_id).map(publicCta),
    };
  }

  const pageEntries = pageOrder.map((pid) => {
    const meta = pages.get(pid);
    const entry = { page_id: pid, ...bucketFor(pid) };
    if (meta.page_type !== undefined) entry.page_type = meta.page_type;
    return entry;
  });

  // Chrome (Header/Footer): surfaces and CTAs with no page ancestor, rendered on
  // every route. Surfaces are kept (with metadata) even when they hold no CTA.
  const sharedBucket = bucketFor(null);
  const sharedSurfaces = sharedBucket.surfaces;
  const shared = sharedBucket.ctas;

  // Home-first primary conversion, else first conversion in scan order.
  const conversions = ctas.filter((c) => c.is_conversion);
  const homeConv = conversions.find((c) => c.page_id === 'home');
  const primary = homeConv ?? conversions[0] ?? null;

  // A scan that found NOTHING is the worst silent failure — the generation
  // ignored the stamping grammar entirely (or scanned the wrong tree) and the
  // site ships with an empty catalog. Warn loudly; the previous gating on
  // ctas.length > 0 made exactly this case the only one with no diagnostic.
  if (pages.size === 0 && surfaces.size === 0 && ctas.length === 0) {
    state.warnings.push({
      kind: 'no_stamps',
      hint:
        `No data-kite-* stamps found anywhere under ${srcArg}. The site will have ` +
        'an empty analytics catalog: stamp the page root, sections, CTAs, and the ' +
        'primary conversion per the authoring grammar.',
    });
  }
  // Zero-conversion is otherwise a silent failure: the site ships with a null
  // primary_conversion and no goal ever fires, and nothing alerts. Surface it as a
  // non-blocking warning so it shows up in generation output.
  if (ctas.length > 0 && conversions.length === 0) {
    state.warnings.push({
      kind: 'no_conversion',
      hint: 'No element carries data-kite-conversion, so no conversion/goal is tracked. Stamp the primary CTA or form with data-kite-conversion="<goal_type>".',
    });
  }
  // Exactly one conversion is the contract; more than one is accepted (warn-only)
  // with the home-first winner nominated as primary_conversion.
  //
  // A/B variants are NOT a violation: both arms of a <KiteExperimentSwitch>
  // stamp the same conversion, which is what makes their rates comparable.
  // Because `conversions` is keyed by cta_id, two arms sharing one cta_id
  // collapse to a single entry and never reach this branch — so a warning here
  // means the arms were given DIFFERENT cta_ids, which also splits the CTA into
  // two unrelated series in analytics.
  if (conversions.length > 1) {
    state.warnings.push({
      kind: 'multiple_conversions',
      hint: `${conversions.length} elements carry data-kite-conversion; expected exactly one. "${primary.cta_id}" (home-first) was nominated as the primary conversion — remove data-kite-conversion from the others, or, if these are A/B variants of one CTA, give every arm the same data-kite-cta-id.`,
    });
  }
  // A mailto:/tel: conversion counts INTENT (the click), not a verifiable
  // outcome — conversion numbers will overstate. Non-blocking by decision.
  if (
    primary &&
    (primary.conversion_medium === 'mailto' ||
      primary.conversion_medium === 'tel')
  ) {
    state.warnings.push({
      kind: 'intent_conversion',
      hint: `The primary conversion "${primary.cta_id}" completes via ${primary.conversion_medium}: — a click counts as the goal even when no message/call ever happens. Prefer a real form (verifiable completion) when the goal is purchase/lead/inquiry/booking.`,
    });
  }
  // A hero with no stamped CTA means the most-viewed surface offers no
  // measurable action and no hero->conversion funnel leg can exist.
  const allSurfaceEntries = pageEntries
    .flatMap((p) => p.surfaces)
    .concat(sharedSurfaces);
  for (const s of allSurfaceEntries) {
    if (s.surface_type === 'hero' && s.ctas.length === 0) {
      state.warnings.push({
        kind: 'hero_without_cta',
        hint: `Hero surface "${s.surface_id}" contains no stamped CTA. The hero should usually carry at least one data-kite-cta-id action (primary or secondary).`,
      });
    }
  }

  return {
    schema_version: SCHEMA_VERSION,
    primary_conversion: primary ? (primary.goal_type ?? null) : null,
    primary_conversion_event: primary ? primary.event : null,
    primary_conversion_medium: primary
      ? (primary.conversion_medium ?? null)
      : null,
    events,
    pages: pageEntries,
    shared,
    shared_surfaces: sharedSurfaces,
  };
}

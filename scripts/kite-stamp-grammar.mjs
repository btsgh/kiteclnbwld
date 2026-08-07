/**
 * Stamp grammar: what a `data-kite-*` stamp means, and how to read one off a JSX
 * AST node.
 *
 * The one home of the vocabulary shared by the collector and the assembler — the
 * event-name machine, the attribute readers, and which defect kinds still permit
 * a manifest to be written.
 *
 * KEEP IN SYNC with public/kite-analytics.js: the event NAME recorded for each
 * stamp must equal what that SDK fires at runtime, so the catalog and the live
 * events agree.
 *
 * Plain ESM JavaScript (not TypeScript) so it runs under bare `node` from a
 * frozen `pnpm install`. Resolves the `typescript` compiler from process.cwd()
 * (the iteration dir), so it works wherever these files physically live.
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';

const require = createRequire(path.join(process.cwd(), 'noop.js'));
export const ts = require('typescript');

export const SCHEMA_VERSION = '2.1';

// ---- event naming -----------------------------------------------------------

/**
 * The event NAME the runtime SDK fires when an element has no explicit
 * `data-kite-event` — its kind/conversion machine fallback. MUST mirror
 * public/kite-analytics.js: conversions fire `<goalType>_completed` when a goal
 * type is known (else the literal `goal_completed` no-goal-type fallback);
 * otherwise nav -> `nav_clicked`, form -> `form_submitted`, expand ->
 * `content_expanded`, cta -> `cta_clicked`. (`data-kite-event` is required by
 * the prompt, so this is the out-of-grammar fallback; recording the SDK's value
 * keeps the catalog truthful.)
 */
export function machineEvent(kind, isConversion, goalType) {
  if (isConversion)
    return goalType ? `${goalType}_completed` : 'goal_completed';
  switch (kind) {
    case 'nav':
      return 'nav_clicked';
    case 'form':
      return 'form_submitted';
    case 'expand':
      return 'content_expanded';
    default:
      return 'cta_clicked';
  }
}

/**
 * The event name recorded for a stamp: the authored `data-kite-event` when
 * present, else the kind's machine fallback. Nav links fire a fixed
 * `nav_clicked` at runtime (the SDK uses the nav id as a property, not the
 * event name) — record that so the catalog matches what actually lands in
 * PostHog. Conversion outranks nav: the SDK's onClick fires the goal event for
 * a non-form conversion element and RETURNS before the nav handler
 * (kite-analytics.js onClick), so a nav link that is also a conversion (e.g. a
 * footer mailto stamped data-kite-conversion) never emits nav_clicked at
 * runtime — record the goal's name, not nav_clicked.
 */
export function resolveEventName(kind, isConversion, goalType, eventAttr) {
  const authored = eventAttr && eventAttr.value ? eventAttr.value : null;
  if (isConversion) return authored ?? machineEvent(kind, true, goalType);
  if (kind === 'nav') return 'nav_clicked';
  return authored ?? machineEvent(kind, false, goalType);
}

// ---- AST attribute reading ---------------------------------------------------

/** Iterate an element's plain JSX attributes as [name, prop] pairs — the one
 * shared guard (skip spreads and nameless nodes) every attribute reader builds
 * on. */
export function* jsxAttrs(el, sf) {
  for (const prop of el.attributes.properties) {
    if (ts.isJsxAttribute(prop) && prop.name) {
      yield [prop.name.getText(sf), prop];
    }
  }
}

/** Read a JSX attribute as a static string literal. dynamic=true for {expr}.
 * Returns { value, dynamic } or null when the attribute is absent. */
export function readAttr(el, name, sf) {
  for (const [attrName, prop] of jsxAttrs(el, sf)) {
    if (attrName !== name) continue;
    const init = prop.initializer;
    if (init === undefined) return { value: '', dynamic: false }; // bare attr: name only
    if (ts.isStringLiteral(init)) return { value: init.text, dynamic: false };
    if (ts.isJsxExpression(init)) {
      const e = init.expression;
      // A string-literal or no-substitution template inside {} is still static.
      if (
        e &&
        (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e))
      ) {
        return { value: e.text, dynamic: false };
      }
      return { value: null, dynamic: true };
    }
    return { value: null, dynamic: true };
  }
  return null;
}

/** Raw initializer text of a JSX attribute (any form — string, expression,
 * template literal), or null when absent. Used where the VALUE may be dynamic
 * but its text still carries signal (e.g. an href template containing
 * "mailto:"). */
export function readAttrRawText(el, name, sf) {
  for (const [attrName, prop] of jsxAttrs(el, sf)) {
    if (attrName !== name) continue;
    return prop.initializer ? prop.initializer.getText(sf) : '';
  }
  return null;
}

// Defect kinds that still permit a manifest to be written.
//
// Both are element-local or heuristic, so holding the WHOLE catalog hostage to
// them costs more than the partial data is worth:
//   dynamic_stamp            — one element is excluded; everything else is exact
//   unpaired_conversion_hook — judged by a text heuristic over call-site code, so
//                              a false positive must never zero the catalog. A
//                              true positive shows up as a catalogued goal with
//                              no traffic, which is far more visible than a
//                              missing catalog.
// Every other kind (duplicate ids, empty conversions) means the scan itself is
// ambiguous, so a partial manifest could be WRONG — those still write nothing.
export const PARTIAL_DEFECT_KINDS = new Set([
  'dynamic_stamp',
  'unpaired_conversion_hook',
]);

// The success-hook call the SDK contract requires when an element is stamped
// data-kite-conversion-hook (the SDK skips goal emission on submit AND click
// and waits for this call). Text-level signatures on purpose.
//
// TWO signals that must co-occur IN THE SAME FILE, because a single adjacency
// pattern was a false positive on correct code: a handler that aliases the SDK
// before calling it —
//   const kite = window.__kite; ... kite.conversion('signup')
// — never matches `__kite.conversion(`, and the resulting bogus
// unpaired_conversion_hook was a BLOCKING error that zeroed the whole catalog.
// Splitting the reference from the call accepts every idiomatic form.
//
// Per file, not site-wide: ORing each signal across the whole tree and ANDing
// only at the end pairs tokens that have nothing to do with each other — a
// `__kite` readiness check in one file plus an unrelated `fx.conversion('USD')`
// in a currency helper would vouch for a site with no real SDK call anywhere,
// which is exactly the silent-never-fires case this check exists to catch. The
// alias idiom still passes because an alias and its call live in one file. A
// cross-file alias export (`export const kite = window.__kite`) is the one form
// this now misses; it is a warning-grade cost, since unpaired_conversion_hook
// is a PARTIAL defect and no longer zeroes the catalog.
export const KITE_SDK_REF_PATTERN = /\b__kite\b/;
export const CONVERSION_CALL_PATTERN = /\.conversion\(/;

// Event names follow `{object}_{past-tense verb}` (signup_completed,
// plan_selected) — the convention of the whole closed vocabulary and standard
// instrumentation guides. Heuristic: the final segment ends in "ed" or is a
// common irregular past form. A rough lint, not grammar: it false-accepts
// present-tense "-ed" words (proceed, feed, embed) — acceptable because the
// check is warn-only and those rarely end an event name.  Imperative names
// (contact_us, inquire_purchase) still work at runtime but read as commands.
export const IRREGULAR_PAST = new Set([
  'sent',
  'done',
  'made',
  'given',
  'shown',
  'seen',
  'met',
  'left',
  'paid',
  'sold',
  'bought',
  'built',
  'found',
  'won',
  'kept',
  'begun',
  'chosen',
  'set',
  'put',
]);
export function isPastTenseName(name) {
  const last = name.split('_').pop();
  return last.length > 2 && (last.endsWith('ed') || IRREGULAR_PAST.has(last));
}

export function hasAnyKiteAttr(el, sf) {
  for (const [attrName] of jsxAttrs(el, sf)) {
    if (attrName.startsWith('data-kite-')) return true;
  }
  return false;
}

export function lineOf(node, sf) {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

/** Same 1-based line, from a raw character offset — a parse diagnostic reports
 * a position, not a node (the node it names may not have been built). */
export function lineFromPos(sf, pos) {
  return sf.getLineAndCharacterOfPosition(pos).line + 1;
}

// Only .tsx is AST-extracted; the other extensions are text-scanned for the
// conversion-call signature (a form's success handler may live in a lib file)
// and for stray data-kite- stamps the AST pass would silently miss.
export const SOURCE_EXTS = ['.tsx', '.ts', '.jsx', '.js'];

/** Recursively list source files under `dir`, sorted for deterministic order. */
export function sourceFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...sourceFiles(full));
    else if (e.isFile() && SOURCE_EXTS.some((ext) => e.name.endsWith(ext)))
      out.push(full);
  }
  return out;
}

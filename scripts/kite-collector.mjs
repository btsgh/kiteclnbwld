/**
 * The scan: walk a source tree and collect every stamped element into one
 * mutable Collector.
 *
 * `scanSourceTree()` is the entry point. `recordStamp()` is the per-element
 * orchestration, and each concern below it is a named step — a plain function of
 * (collector, element, context) — so a new rule gets its own home instead of
 * growing an inline block.
 *
 * Shapes (plain objects, documented for readers — no static types):
 *   Cta     { cta_id, kind: 'cta'|'nav'|'form'|'expand', role?, event,
 *             is_conversion, goal_type?, href?, page_id|null, surface_id|null }
 *   Surface { surface_id, surface_type?, position, page_id|null }
 *   PageMeta{ page_id, page_type? }
 *   Diag    { path, line, kind, hint }
 *   Ctx     { page: string|null, surface: string|null, form: Cta|null }
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  buildImportMap,
  newUsageIndex,
  recordAuthor,
  recordUsage,
} from './kite-attribution.mjs';
import {
  CONVERSION_CALL_PATTERN,
  hasAnyKiteAttr,
  isPastTenseName,
  jsxAttrs,
  KITE_SDK_REF_PATTERN,
  lineFromPos,
  lineOf,
  readAttr,
  readAttrRawText,
  resolveEventName,
  sourceFiles,
  ts,
} from './kite-stamp-grammar.mjs';

function newCollector() {
  return {
    // Where each imported component renders, and which file authored each
    // entry — the two halves cross-file attribution needs (kite-assemble.mjs).
    usage: newUsageIndex(),
    surfaces: new Map(), // surface_id -> Surface (dedupe, ordered)
    pages: new Map(), // page_id -> PageMeta (ordered)
    ctas: [],
    errors: [],
    warnings: [], // non-blocking Diags, surfaced in generation output
    conversionHooks: [], // {path, line} of data-kite-conversion-hook stamps
    sawHookedConversionForm: false, // hook + conversion + form-type on one element
    // Some ONE scanned file both references the __kite SDK and calls
    // .conversion( — see the pattern definitions for why pairing is per-file.
    sawPairedConversionCall: false,
    namingWarned: new Set(), // event names already warned (dedupe loop renders)
    // Dedupe identical stamps (loop-rendered) by page+surface+kind+id+event;
    // flag same kind+id with a DIFFERENT event as an ambiguous-identity defect.
    seen: new Set(),
    idToEvent: new Map(), // `${kind}:${id}` -> first event
  };
}

/** Any dynamic data-kite-* value is a blocking defect (the catalog needs a
 * stable literal; the SDK fires the literal too). Scans the element's ACTUAL
 * attributes by prefix — not a hand-maintained name list, which silently
 * exempts any newly added attribute from this gate. `data-kite-item` is the
 * one deliberate exception (a per-item property that MUST be dynamic). */
function checkDynamicStamps(col, el, sf, relPath) {
  let found = false;
  for (const [attrName] of jsxAttrs(el, sf)) {
    if (!attrName.startsWith('data-kite-') || attrName === 'data-kite-item')
      continue;
    const a = readAttr(el, attrName, sf);
    if (a && a.dynamic) {
      found = true;
      col.errors.push({
        path: relPath,
        line: lineOf(el, sf),
        kind: 'dynamic_stamp',
        hint: `${attrName} must be a static string literal (e.g. ${attrName}="value"), not a {expression}, so the analytics catalog and the runtime SDK agree on a stable value.`,
      });
    }
  }
  return found;
}

/** Conversion-hook stamp: the SDK will NOT fire the goal on submit for this
 * element — record it so the hook/call pairing can be verified site-wide. */
function recordConversionHook(col, el, sf, relPath) {
  if (readAttr(el, 'data-kite-conversion-hook', sf) === null) return;
  col.conversionHooks.push({ path: relPath, line: lineOf(el, sf) });
  // The SDK's form_submitted ATTEMPT fires only when a submitted
  // data-kite-form-type form resolves a conversion element (onSubmit); a
  // hook on a non-form conversion (a JS widget button) never produces a
  // submit, so cataloging form_submitted for it would be a phantom event.
  // Detect the canonical stamped shape: hook + conversion + form-type on
  // ONE element (the grammar puts all three on the <form>).
  if (
    readAttr(el, 'data-kite-conversion', sf) !== null &&
    readAttr(el, 'data-kite-form-type', sf) !== null
  ) {
    col.sawHookedConversionForm = true;
  }
}

/** Page root. Returns the attribute read so recordStamp derives `own.page`
 * from the same single read. */
function registerPage(col, el, sf) {
  const pageId = readAttr(el, 'data-kite-page-id', sf);
  if (pageId && pageId.value && !col.pages.has(pageId.value)) {
    const meta = { page_id: pageId.value };
    const pt = readAttr(el, 'data-kite-page-type', sf);
    if (pt && pt.value) meta.page_type = pt.value;
    col.pages.set(pageId.value, meta);
  }
  return pageId;
}

/** Surface. Returns the attribute read (same single-read rule as
 * registerPage). */
function registerSurface(col, el, sf, relPath, ctx) {
  const surfaceId = readAttr(el, 'data-kite-surface', sf);
  if (surfaceId && surfaceId.value && !col.surfaces.has(surfaceId.value)) {
    const entry = {
      surface_id: surfaceId.value,
      position: col.surfaces.size,
      // A surface fires section_viewed/section_engaged on its own; record the
      // page it lives under so it is emitted even when it holds no CTA.
      page_id: ctx.page,
    };
    // A surface declared in a section component has no page ancestor in its own
    // file; the author record is how the recovery finds the page it renders on.
    recordAuthor(col.usage, entry, relPath);
    const stype = readAttr(el, 'data-kite-surface-type', sf);
    if (stype && stype.value) entry.surface_type = stype.value;
    col.surfaces.set(surfaceId.value, entry);
  }
  return surfaceId;
}

/** Interaction identity (CTA / nav / form / expand), or null when the element
 * carries no interaction stamp. */
function resolveKindAndId(el, sf) {
  const ctaId = readAttr(el, 'data-kite-cta-id', sf);
  if (ctaId && ctaId.value) return { kind: 'cta', id: ctaId.value };
  const navId = readAttr(el, 'data-kite-nav', sf);
  if (navId && navId.value) return { kind: 'nav', id: navId.value };
  const formType = readAttr(el, 'data-kite-form-type', sf);
  if (formType && formType.value) return { kind: 'form', id: formType.value };
  const expandId = readAttr(el, 'data-kite-expand', sf);
  if (expandId && expandId.value) return { kind: 'expand', id: expandId.value };
  return null;
}

/** Conversion marking. Empty data-kite-conversion="" is a defect, not a
 * conversion. */
function resolveConversion(col, el, sf, relPath) {
  const conversion = readAttr(el, 'data-kite-conversion', sf);
  if (!conversion) return { isConversion: false, goalType: undefined };
  if (!conversion.value) {
    col.errors.push({
      path: relPath,
      line: lineOf(el, sf),
      kind: 'empty_conversion',
      hint: 'data-kite-conversion must name the goal (e.g. data-kite-conversion="signup"); remove it if this element is not the conversion.',
    });
    return { isConversion: false, goalType: undefined };
  }
  return { isConversion: true, goalType: conversion.value };
}

/** Warn-only naming lint on authored (non-nav) event names. */
function lintEventName(col, el, sf, relPath, kind, eventAttr) {
  if (kind === 'nav' || !eventAttr || !eventAttr.value) return;
  if (isPastTenseName(eventAttr.value) || col.namingWarned.has(eventAttr.value))
    return;
  col.namingWarned.add(eventAttr.value);
  col.warnings.push({
    path: relPath,
    line: lineOf(el, sf),
    kind: 'event_name_not_past_tense',
    hint: `data-kite-event "${eventAttr.value}" is not {object}_{past-tense verb}. Name what HAPPENED, not the button label: e.g. "contact_us" -> "contact_requested", "inquire_purchase" -> "purchase_inquiry_sent".`,
  });
}

/** Dedup + global identity uniqueness. Returns false when the stamp must not
 * be recorded (an identical loop-rendered repeat, or a defect just reported).
 *
 * Dedup is scoped to page+surface: identical stamps in the SAME slot are a
 * loop render (collapse to one); the SAME id+event legitimately placed on a
 * different page/surface is a distinct placement and is kept under each.
 * Identity is global: one kind+id must map to exactly one event name across
 * the whole site, regardless of where it is placed. */
function validateIdentity(col, el, sf, relPath, facts) {
  const { kind, id, name, elPage, elSurface } = facts;
  const dedupeKey = `${elPage ?? ''}:${elSurface ?? ''}:${kind}:${id}:${name}`;
  if (col.seen.has(dedupeKey)) return false; // identical stamp repeated (loop render)
  const idKey = `${kind}:${id}`;
  const prior = col.idToEvent.get(idKey);
  if (prior !== undefined && prior !== name) {
    col.errors.push({
      path: relPath,
      line: lineOf(el, sf),
      kind: 'duplicate_identity',
      hint: `${kind} id "${id}" is used for two different events ("${prior}" and "${name}"); give each distinct action a distinct id.`,
    });
    return false;
  }
  col.seen.add(dedupeKey);
  col.idToEvent.set(idKey, name);
  return true;
}

/** How the goal completes. A form submit is a verifiable OUTCOME; a
 * mailto:/tel: click is only INTENT (nothing observable happens after) —
 * the read side splits conversion numbers on this. The href value is
 * often a dynamic template (`mailto:${brand.email}`), so classify from
 * the RAW attribute text, not just the static value. */
function classifyConversionMedium(el, sf, kind) {
  if (kind === 'form') return 'form';
  const hrefRaw = readAttrRawText(el, 'href', sf);
  if (hrefRaw === null) return 'button';
  if (hrefRaw.indexOf('mailto:') !== -1) return 'mailto';
  if (hrefRaw.indexOf('tel:') !== -1) return 'tel';
  return 'link';
}

/** Conversion containment (SDK onSubmit parity): the SDK resolves a
 * submitted form's conversion element via form.querySelector — a
 * conversion stamped on an INNER control belongs to the enclosing form,
 * and the form itself then never fires its own form_submitted. Same-file
 * lexical containment only (a form and its controls live in one
 * component); a conversion in a child component file is invisible here,
 * the same accepted limit as cross-file page attribution.
 *
 * Returns false when the entry must be dropped (the enclosing
 * conversion-form's own stamp wins at submit, so this one can never fire). */
function resolveContainment(col, entry, el, sf, relPath, ctx, facts) {
  const { kind, isConversion, id } = facts;
  if (!isConversion || kind === 'form' || !ctx.form) return true;
  if (ctx.form.is_conversion) {
    // The form's own stamp wins at submit (hasAttribute is checked before
    // querySelector) — this inner stamp can never fire. Don't catalog it.
    col.warnings.push({
      path: relPath,
      line: lineOf(el, sf),
      kind: 'conversion_inside_form',
      hint: `This element and its enclosing form both carry data-kite-conversion; the form's stamp wins at submit and this one never fires. Remove data-kite-conversion from "${id}".`,
    });
    return false;
  }
  ctx.form._containsConversion = true;
  // The goal completes via the form's submit — a verifiable outcome, not
  // click-intent. KEEP IN SYNC with kite-analytics.js fireGoal.
  entry.conversion_medium = 'form';
  col.warnings.push({
    path: relPath,
    line: lineOf(el, sf),
    kind: 'conversion_inside_form',
    hint: `data-kite-conversion sits on "${id}" inside form "${ctx.form.cta_id}"; the goal fires on the form's submit. Prefer stamping the <form> itself (conversion + form-type + hook on one element).`,
  });
  // The SDK fires the form_submitted ATTEMPT when the resolved conversion
  // element or the form carries the hook — containment equivalent of the
  // one-element rule in recordConversionHook.
  if (
    readAttr(el, 'data-kite-conversion-hook', sf) !== null ||
    ctx.form._hasHook
  ) {
    col.sawHookedConversionForm = true;
  }
  return true;
}

/** Per-element orchestration over the named steps above. Returns the element's
 * OWN page/surface/form declarations so walk() derives the subtree context
 * from the same single read — page/surface resolution must not exist in two
 * places, or containment and stamp records can disagree on which page/surface
 * a descendant belongs to. */
function recordStamp(col, el, sf, relPath, ctx) {
  // A dynamic stamp is still a blocking defect (see the errors handling in
  // main), but only this element's INTERACTION entry is dropped rather than the
  // whole scan aborting: one idiomatic `data-kite-nav={link.id}` in a mapped nav
  // used to zero the entire catalog, reading as "this site emits no events".
  //
  // Dropping the entry rather than guessing is deliberate — cataloguing the
  // machine fallback (`cta_clicked`) while the runtime fires the evaluated name
  // would be a wrong entry, which is worse than a missing one.
  const hadDynamicStamp = checkDynamicStamps(col, el, sf, relPath);

  // Structure and hook records are kept even then. A page/surface declaration
  // describes where the element sits, not the defective stamp, and dropping it
  // would orphan every descendant onto the wrong page. The conversion hook is
  // kept because the SDK honours an evaluated one, so the site-wide pairing
  // guard must still see it.
  recordConversionHook(col, el, sf, relPath);
  const pageId = registerPage(col, el, sf);
  const surfaceId = registerSurface(col, el, sf, relPath, ctx);

  const own = {
    page: pageId && pageId.value ? pageId.value : null,
    surface: surfaceId && surfaceId.value ? surfaceId.value : null,
    // Set below when this element is a stamped form: descendants resolve
    // conversion containment against it (SDK onSubmit parity).
    form: null,
  };

  // The one thing a dynamic stamp costs: this element's interaction entry. Its
  // page/surface declarations above are already recorded, so descendants keep
  // their true ancestry.
  if (hadDynamicStamp) return own;

  // Interaction stamp (CTA / nav / form / expand). The element's enclosing
  // surface is ctx.surface (the nearest surface ANCESTOR — true containment,
  // not source order), unless the element itself carries the surface stamp.
  const kindId = resolveKindAndId(el, sf);
  if (!kindId) return own;
  const { kind, id } = kindId;

  const { isConversion, goalType } = resolveConversion(col, el, sf, relPath);
  const eventAttr = readAttr(el, 'data-kite-event', sf);
  const name = resolveEventName(kind, isConversion, goalType, eventAttr);
  lintEventName(col, el, sf, relPath, kind, eventAttr);

  // The element's resolved page/surface (its own surface stamp, else ancestor).
  const elPage = ctx.page;
  const elSurface =
    surfaceId && surfaceId.value ? surfaceId.value : ctx.surface;

  if (
    !validateIdentity(col, el, sf, relPath, {
      kind,
      id,
      name,
      elPage,
      elSurface,
    })
  ) {
    return own;
  }

  const entry = {
    cta_id: id,
    kind,
    event: name,
    is_conversion: isConversion,
    // A CTA's page is always its ancestor page; its surface is its own when it
    // carries a surface stamp (a clickable card is both), else its ancestor.
    page_id: elPage,
    surface_id: elSurface,
  };
  const role = readAttr(el, 'data-kite-role', sf);
  if (role && role.value) entry.role = role.value;
  const href = readAttr(el, 'href', sf);
  if (href && href.value) entry.href = href.value;
  if (isConversion && goalType) entry.goal_type = goalType;
  if (isConversion)
    entry.conversion_medium = classifyConversionMedium(el, sf, kind);

  if (
    !resolveContainment(col, entry, el, sf, relPath, ctx, {
      kind,
      isConversion,
      id,
    })
  ) {
    return own;
  }

  // Indexed only once the entry is certain to survive: containment can still
  // drop it above, and an author record for an entry that never reaches
  // `col.ctas` would make `usage.authoredIn` a superset of the manifest it
  // describes.
  recordAuthor(col.usage, entry, relPath);

  if (kind === 'form') {
    entry._hasHook = readAttr(el, 'data-kite-conversion-hook', sf) !== null;
    own.form = entry;
  }
  col.ctas.push(entry);
  return own;
}

function walk(col, node, sf, relPath, ctx, imports) {
  let childCtx = ctx;
  let opening = null;
  if (ts.isJsxElement(node)) opening = node.openingElement;
  else if (ts.isJsxSelfClosingElement(node)) opening = node;

  // A rendered local component: note the page/surface it sits in, so the stamps
  // authored in ITS file can be attributed back here. Read before the stamp
  // handling below so the context is the one enclosing the component.
  if (opening && ts.isIdentifier(opening.tagName)) {
    const target = imports.get(opening.tagName.text);
    if (target) recordUsage(col.usage, target, ctx);
  }

  // Stamps hidden inside a spread ({...attrs} whose inline object mentions
  // data-kite-) are invisible to the attribute reader below: the catalog would
  // silently miss them. Warn (non-blocking); indirect spreads (a variable
  // defined elsewhere) stay invisible — accepted limit of a static scan.
  if (opening) {
    for (const prop of opening.attributes.properties) {
      if (
        ts.isJsxSpreadAttribute(prop) &&
        prop.expression.getText(sf).includes('data-kite-')
      ) {
        col.warnings.push({
          path: relPath,
          line: lineOf(prop, sf),
          kind: 'spread_stamp',
          hint: 'data-kite-* attributes inside a {...spread} are not extracted into the analytics catalog; write them as literal JSX attributes on the element instead.',
        });
      }
    }
  }

  if (opening && hasAnyKiteAttr(opening, sf)) {
    // recordStamp returns the element's OWN page/surface (single source of
    // the resolution rule): a page-id / surface set here contains its
    // descendants, so it becomes the subtree ctx.
    const own = recordStamp(col, opening, sf, relPath, ctx);
    childCtx = {
      page: own.page !== null ? own.page : ctx.page,
      surface: own.surface !== null ? own.surface : ctx.surface,
      form: own.form !== null ? own.form : ctx.form,
    };
  }
  ts.forEachChild(node, (c) => walk(col, c, sf, relPath, childCtx, imports));
}

/** Walk every source file under `srcDir` and return the fully collected scan
 * state, blocking defects included. Only .tsx is AST-extracted; the other
 * extensions are text-scanned for the conversion-call signature (a form's
 * success handler may live in a lib file) and for stray data-kite- stamps the
 * extractor would silently miss. */
export function scanSourceTree(srcDir) {
  const col = newCollector();
  for (const file of sourceFiles(srcDir)) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue; // unreadable file: skip, never fail the whole extract
    }
    const rel = path.relative(srcDir, file);
    // The template's own analytics plumbing (src/lib/analytics/) ships with
    // EVERY site and mentions data-kite-* / the hook API in comments — it is
    // not site code, so it must neither warn nor satisfy the hook-call check.
    if (rel.startsWith('lib/analytics/')) continue;
    if (KITE_SDK_REF_PATTERN.test(text) && CONVERSION_CALL_PATTERN.test(text)) {
      col.sawPairedConversionCall = true;
    }
    if (!file.endsWith('.tsx')) {
      // Manifest extraction stays .tsx-only (the template's component grammar);
      // a stamp in any other extension would never reach the catalog — warn.
      if (text.includes('data-kite-')) {
        col.warnings.push({
          path: rel,
          line: 0,
          kind: 'unscanned_file_stamp',
          hint: 'data-kite- appears in a non-.tsx file; only .tsx under src/ is extracted into the analytics catalog. Move the stamped JSX into a .tsx component.',
        });
      }
      continue;
    }
    const sf = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      /*setParentNodes*/ true,
      ts.ScriptKind.TSX,
    );
    // A file that does not parse still yields a tree: TypeScript recovers and
    // walking it collects whatever stamps survived and silently drops the rest,
    // so the run reports ok with a manifest missing a page or a surface — worse
    // than failing. Blocking only for STAMPED files: an unrelated syntax error
    // elsewhere in the tree is the build's problem, and failing the catalog for
    // it would be a new way to lose analytics. Deliberately NOT in
    // PARTIAL_DEFECT_KINDS: an element-local defect excludes one element, this
    // one says every stamp in the file is unreliable.
    //
    // `parseDiagnostics` is INTERNAL to the compiler — not on the public
    // ts.SourceFile type — and it is the only way to get syntactic diagnostics
    // for a standalone SourceFile (the public `ts.getPreEmitDiagnostics` needs a
    // Program, which means a tsconfig and a type-check pass this script has no
    // business running). The `|| []` below would turn a renamed field into a
    // silently disabled check, so the risk is pinned from the outside:
    // `test_parse_diagnostics_internal_field_still_exists`
    // (backend/tests/test_llm/test_extract_kite_manifest_script.py) fails on the
    // TypeScript bump that changes it, while `typescript` stays a caret range.
    const parseErrors = sf.parseDiagnostics || [];
    if (parseErrors.length > 0 && text.includes('data-kite-')) {
      const d = parseErrors[0];
      col.errors.push({
        path: rel,
        line: d.start != null ? lineFromPos(sf, d.start) : 0,
        kind: 'unparsable_stamped_file',
        hint:
          `${ts.flattenDiagnosticMessageText(d.messageText, ' ')} — this file carries ` +
          'data-kite-* stamps and does not parse, so only the stamps the parser ' +
          'recovered would reach the catalog. Fix the syntax error and re-extract.',
      });
      continue;
    }
    const imports = buildImportMap(ts, sf, rel, srcDir);
    walk(col, sf, sf, rel, { page: null, surface: null, form: null }, imports);
  }

  // Hook/call pairing (runs after every file is scanned, since the handler may
  // live in a different file from the stamp): a data-kite-conversion-hook form
  // suppresses the SDK's submit-time goal emission and relies on the site
  // calling window.__kite.conversion(...) from its success handler. No file
  // pairing both signals means the conversion silently never fires.
  if (col.conversionHooks.length > 0 && !col.sawPairedConversionCall) {
    for (const h of col.conversionHooks) {
      col.errors.push({
        path: h.path,
        line: h.line,
        kind: 'unpaired_conversion_hook',
        hint: "data-kite-conversion-hook is stamped but no source file calls window.__kite.conversion(...). Either call it in the form's success handler (after the submission succeeds), or remove data-kite-conversion-hook so the SDK fires the goal on native submit.",
      });
    }
  }
  return col;
}

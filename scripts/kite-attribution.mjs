/*
 * Cross-file attribution for the analytics manifest extractor.
 *
 * The scan is file-local: it parses one .tsx at a time. A section component
 * authors its CTAs in its OWN file while the enclosing `data-kite-surface` and
 * `data-kite-page-id` live in the PARENT page, so those stamps come back with
 * no page and no surface and file as page-less chrome — while the runtime SDK,
 * reading the live DOM, reports the surface the visitor actually saw. Catalog
 * and live traffic then disagree, which is the one thing the manifest exists to
 * prevent.
 *
 * Two halves, in scan order:
 *   newUsageIndex / recordUsage — during the walk (kite-collector.mjs), note the
 *                       page/surface each imported component is RENDERED under
 *                       (`buildImportMap` resolves which local module a JSX tag
 *                       refers to).
 *   recoverAttribution — after the walk (kite-assemble.mjs), give the
 *                       component's own stamps that context, but only when every
 *                       render site agrees.
 *
 * The "every site agrees" rule is what keeps this honest rather than merely
 * tidier. Real chrome (a nav on every route) and a component reused under two
 * surfaces have no single answer, and inventing one would file half an
 * element's traffic under a surface it never came from.
 *
 * Authoring paths are held in a side Map keyed by the entry object, never as a
 * field on the entry: manifest entries are serialized into a deployed artifact,
 * and an in-band `_path` is one careless copy away from publishing a filesystem
 * path.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

// Page and surface joined for set-membership. NUL cannot appear in either (both
// are authored attribute values), so no pair can collide with another.
const KEY_SEP = '\u0000';

/** Resolve an import specifier to a src-relative .tsx path, or null.
 *
 * Only the two shapes the template uses: the `@/` alias for `src/`, and paths
 * relative to the importing file. A package import cannot carry site stamps, so
 * anything else resolves to null. */
export function resolveLocalModule(spec, relPath, srcDir) {
  let base;
  if (spec.startsWith('@/')) base = path.join(srcDir, spec.slice(2));
  else if (spec.startsWith('.'))
    base = path.resolve(srcDir, path.dirname(relPath), spec);
  else return null;
  for (const cand of [`${base}.tsx`, path.join(base, 'index.tsx')]) {
    if (fs.existsSync(cand)) return path.relative(srcDir, cand);
  }
  return null;
}

/** Local binding name -> the src-relative file it is imported from. Default and
 * named imports both count: either can be the component whose file authors the
 * stamps. */
export function buildImportMap(ts, sf, relPath, srcDir) {
  const map = new Map();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause) continue;
    if (!ts.isStringLiteral(st.moduleSpecifier)) continue;
    const target = resolveLocalModule(st.moduleSpecifier.text, relPath, srcDir);
    if (!target) continue;
    const clause = st.importClause;
    if (clause.name) map.set(clause.name.text, target);
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const el of clause.namedBindings.elements)
        map.set(el.name.text, target);
    }
  }
  return map;
}

/** The mutable index the walk fills and the recovery reads. */
export function newUsageIndex() {
  return {
    // src-relative file -> Set of `page\0surface` render contexts.
    contexts: new Map(),
    // manifest entry object -> the src-relative file that authored it.
    authoredIn: new Map(),
  };
}

/** Note that `targetPath`'s component was rendered under this page/surface. */
export function recordUsage(index, targetPath, ctx) {
  let seen = index.contexts.get(targetPath);
  if (!seen) {
    seen = new Set();
    index.contexts.set(targetPath, seen);
  }
  seen.add(`${ctx.page ?? ''}${KEY_SEP}${ctx.surface ?? ''}`);
}

/** Remember which file authored a manifest entry, off-band. */
export function recordAuthor(index, entry, relPath) {
  index.authoredIn.set(entry, relPath);
}

/** The one context a file's components render under, or null when they render
 * under several (or none) and no single answer exists. */
function soleContext(index, entry) {
  const filePath = index.authoredIn.get(entry);
  const seen = filePath != null ? index.contexts.get(filePath) : null;
  if (!seen || seen.size !== 1) return null;
  const [page, surface] = [...seen][0].split(KEY_SEP);
  return { page: page || null, surface: surface || null };
}

/** Fill in the page/surface of stamps authored in a child component.
 *
 * Runs BEFORE the surface-id-prefix recovery so a surface recovered here can
 * still feed it. Mutates in place, matching the rest of the assembly.
 */
export function recoverAttribution(index, surfaces, ctas) {
  for (const s of surfaces) {
    if (s.page_id != null) continue;
    const ctx = soleContext(index, s);
    if (ctx && ctx.page) s.page_id = ctx.page;
  }
  for (const c of ctas) {
    const ctx = soleContext(index, c);
    if (!ctx) continue;
    if (c.surface_id == null && ctx.surface) c.surface_id = ctx.surface;
    if (c.page_id == null && ctx.page) c.page_id = ctx.page;
  }
}

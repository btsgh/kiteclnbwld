/**
 * Kite analytics manifest extractor — CLI entry point.
 *
 * The generation/edit agent authors `data-kite-*` stamps onto the components it
 * writes (see the `website-code-writing` skill); this tool parses those .tsx with
 * the TypeScript compiler API (a REAL JSX AST, not a regex) and emits the
 * analytics manifest the backend persists into `site_event_catalog`.
 *
 * Why an AST and not a regex: a `>` inside an attribute value (a Tailwind class
 * `[&>svg]`, an `aria-label`, an href query, a `{x > 1 ? ...}` expression) is
 * just attribute text to a real parser and can never truncate a tag — the whole
 * class of "stamp silently dropped" bugs disappears. The tree also gives true
 * page->surface->cta nesting and exposes `{expression}` values, so a dynamic
 * stamp becomes a repairable diagnostic instead of a silent omission.
 *
 * This file is CLI wiring only. The work lives in four modules beside it:
 *   kite-stamp-grammar.mjs  what a stamp means; how to read one off the AST
 *   kite-collector.mjs      the tree walk that collects stamps into a scan
 *   kite-attribution.mjs    which page/surface a component's stamps belong to
 *   kite-assemble.mjs       the scan turned into manifest JSON
 *
 * Contract (mirrors cms-content/validate_cms.mjs): prints exactly ONE line of
 * JSON to stdout and exits
 *   0  -> ok, manifest emitted
 *   1  -> stamp defect(s); the generation repair gate routes these to the agent
 *   2  -> usage error (bad args)
 *
 * A non-zero exit does NOT mean nothing was written. `status` is the field that
 * answers that, for every exit code:
 *   clean    manifest assembled with no defects, and `--out` written if asked
 *   partial  manifest assembled and written, with defective elements excluded
 *   failed   nothing was persisted (blocking defects, bad args, or a failed
 *            `--out` write)
 * Consumers branch on `status`; `ok` and the exit code report the DEFECT, which
 * is a different question and is what the repair gate keys on.
 *
 * Usage:  node scripts/extract-kite-manifest.mjs <src-dir> [--out <file>]
 *   <src-dir>   directory to scan recursively for *.tsx (e.g. "src")
 *   --out FILE  also write the manifest JSON to FILE (e.g. kite-manifest.json)
 *
 * Callers should invoke `scripts/refresh-manifest.mjs` instead, which owns these
 * arguments so they cannot drift between the backend and the sandbox boot script.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assembleManifest } from './kite-assemble.mjs';
import { scanSourceTree } from './kite-collector.mjs';
import { PARTIAL_DEFECT_KINDS } from './kite-stamp-grammar.mjs';

const STATUS_CLEAN = 'clean';
const STATUS_PARTIAL = 'partial';
const STATUS_FAILED = 'failed';

/** The one JSON line this tool is contracted to print. */
function emit(envelope) {
  process.stdout.write(JSON.stringify(envelope) + '\n');
}

function usageError(hint) {
  emit({
    ok: false,
    status: STATUS_FAILED,
    manifest: null,
    errors: [{ path: '', line: 0, kind: 'usage', hint }],
  });
  return 2;
}

/**
 * Run the extractor: prints the one JSON line, returns the exit code.
 *
 * Exported so `refresh-manifest.mjs` can call it in-process. Spawning this file
 * as a child instead forced the wrapper to hand-rebuild this envelope for the
 * "child never printed the JSON line" case — a second copy of the shape, in the
 * file whose whole purpose is preventing second copies.
 */
export function main(argv) {
  // Parse flags first so a flag's VALUE (e.g. the file after --out) is never
  // mistaken for the positional src dir — `--out kite-manifest.json` with src
  // omitted must be a usage error, not a scan of the out-file path.
  const outIdx = argv.indexOf('--out');
  const outFile = outIdx >= 0 ? (argv[outIdx + 1] ?? null) : null;
  const outValueIdx = outIdx >= 0 ? outIdx + 1 : -1;
  const positional = argv.filter(
    (a, i) => !a.startsWith('--') && i !== outValueIdx,
  );
  const srcArg = positional[0];
  if (!srcArg || (outIdx >= 0 && !outFile)) {
    return usageError(
      'usage: extract-kite-manifest.mjs <src-dir> [--out <file>]',
    );
  }
  const srcDir = path.resolve(process.cwd(), srcArg);
  // A missing src dir is tooling trouble (wrong cwd, layout drift), not "the
  // site has zero stamps" — exit 2 so callers classify it as a skip, instead
  // of writing an empty manifest over a previously valid one.
  if (!fs.existsSync(srcDir) || !fs.statSync(srcDir).isDirectory()) {
    return usageError(`src dir not found: ${srcDir}`);
  }

  const state = scanSourceTree(srcDir);

  // A partial defect is deterministic and element-local: the offending element
  // was already excluded from the scan, so everything else is still accurate.
  // When it is the ONLY kind of defect, write the partial manifest anyway —
  // otherwise one `data-kite-nav={link.id}` in a mapped nav leaves the deploy
  // reading a missing file and the site's whole event catalog empty, which
  // surfaces to the user as "this site emits no events".
  const partialOnly =
    state.errors.length > 0 &&
    state.errors.every((e) => PARTIAL_DEFECT_KINDS.has(e.kind));

  if (state.errors.length > 0 && !partialOnly) {
    emit({
      ok: false,
      status: STATUS_FAILED,
      manifest: null,
      errors: state.errors,
      warnings: state.warnings,
    });
    return 1;
  }

  const manifest = assembleManifest(state, srcArg);

  let persisted = true;
  if (outFile) {
    try {
      fs.writeFileSync(
        path.resolve(process.cwd(), outFile),
        JSON.stringify(manifest, null, 2) + '\n',
        'utf8',
      );
    } catch (e) {
      // Tooling trouble, not a stamp defect. Reported through the same warnings
      // channel as every other diagnostic AND through `status: failed`, which is
      // what tells a consumer the file on disk is missing or stale.
      persisted = false;
      state.warnings.push({
        path: outFile,
        line: 0,
        kind: 'out_write_failed',
        hint: `could not write ${outFile}: ${String(e)} — kite-manifest.json on disk is missing or stale; the manifest on stdout is still valid.`,
      });
    }
  }

  emit({
    ok: !partialOnly,
    status: !persisted
      ? STATUS_FAILED
      : partialOnly
        ? STATUS_PARTIAL
        : STATUS_CLEAN,
    manifest,
    errors: state.errors,
    warnings: state.warnings,
  });
  return partialOnly ? 1 : 0;
}

// Only when this file IS the process entry point. `refresh-manifest.mjs` imports
// `main` and supplies its own arguments; without the guard that import would also
// run this line with the wrapper's argv and emit a usage error.
//
// Set exitCode rather than process.exit(): the script is synchronous, so letting
// the process exit naturally guarantees the JSON line on stdout is fully flushed
// to the (async) pipe before we exit — process.exit() can truncate a buffered
// write and silently drop the manifest.
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = main(process.argv.slice(2));
}

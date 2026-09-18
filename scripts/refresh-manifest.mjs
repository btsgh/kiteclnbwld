/**
 * Re-derive this site's kite analytics manifest. The one entry point callers use.
 *
 * Two places outside this repo's Python run the extractor and cannot share code
 * with each other: the backend (`app/llm/coding/kite_manifest.py`, over the
 * sandbox tool plane) and the sandbox boot script (`e2b/start-nextjs-main.sh`,
 * in bash, at Main promotion). They used to spell the arguments out separately,
 * which made `src`, `--out kite-manifest.json` and the exit semantics three
 * hand-synced copies of one decision. This file is that decision:
 *
 *   node scripts/refresh-manifest.mjs
 *
 * It scans `src` and writes `kite-manifest.json` next to it, then passes the
 * extractor's single JSON line and its exit code through UNCHANGED — the
 * generation repair gate keys on both, so this wrapper must not flatten them.
 * `main` runs in THIS process, so the envelope on stdout and the exit code are
 * the extractor's own; there is no child whose output could go missing and no
 * second copy of the envelope shape here to drift from it.
 *
 * Reading the result: branch on the `status` field (`clean` | `partial` |
 * `failed`), which says whether a manifest was persisted. The exit code reports
 * whether the scan found a DEFECT, which is a different question — a run can
 * exit 1 having written a perfectly usable partial manifest. See
 * `extract-kite-manifest.mjs` for the full contract.
 */
import { main } from './extract-kite-manifest.mjs';

const SRC_DIR = 'src';
const OUT_FILE = 'kite-manifest.json';

// Both are resolved against cwd by the extractor, and the backend runs this from
// the site dir — same as when the extractor is invoked directly.
process.exitCode = main([SRC_DIR, '--out', OUT_FILE]);

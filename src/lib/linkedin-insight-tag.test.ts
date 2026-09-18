// Behaviour contract for the LinkedIn Insight Tag loader the root layout
// inlines. The template ships no unit-test runner, so this is a self-contained
// script (run in CI by nextjs-template-code-quality.yml). Every case executes
// the exact string the layout puts into <script id="linkedin-insight-tag">
// against a stub window and document, so a refactor that breaks the loader
// fails here instead of in every visitor's browser.
//
// Run locally:
//   pnpm dlx tsx src/lib/linkedin-insight-tag.test.ts

import { linkedInInsightTagScript } from './linkedin-insight-tag';

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

type Lintrk = ((action: unknown, data: unknown) => void) & { q?: unknown[] };
type LinkedInWindow = {
  _linkedin_partner_id?: unknown;
  _linkedin_data_partner_ids?: unknown[];
  lintrk?: Lintrk;
};
type InsertedScript = { type?: string; async?: boolean; src?: string };
type Anchor = {
  parentNode: {
    insertBefore: (node: InsertedScript, before: unknown) => void;
  };
};

/** Runs a loader on a page whose first <script> is the one LinkedIn inserts before. */
function load(script: string, win: LinkedInWindow): InsertedScript[] {
  const inserted: InsertedScript[] = [];
  const anchor: Anchor = {
    parentNode: {
      insertBefore: (node, before) => {
        if (before !== anchor) {
          throw new Error(
            'inserted before something other than the first script',
          );
        }
        inserted.push(node);
      },
    },
  };
  const doc = {
    getElementsByTagName: (name: string) => (name === 'script' ? [anchor] : []),
    createElement: (): InsertedScript => ({}),
  };
  new Function('window', 'document', script)(win, doc);
  return inserted;
}

function main(): void {
  const script = linkedInInsightTagScript('10858609');
  if (script === null) {
    failures++;
    console.error('  FAIL a numeric partner id renders a loader');
  } else {
    const win: LinkedInWindow = {};
    const inserted = load(script, win);
    check(
      'sets the partner id as a string',
      win._linkedin_partner_id,
      '10858609',
    );
    check('registers the partner id', win._linkedin_data_partner_ids, [
      '10858609',
    ]);
    check('inserts LinkedIn’s insight script once, async', inserted, [
      {
        type: 'text/javascript',
        async: true,
        src: 'https://snap.licdn.com/li.lms-analytics/insight.min.js',
      },
    ]);
    win.lintrk?.('track', { conversion_id: 1 });
    check('queues lintrk calls until that script loads', win.lintrk?.q, [
      ['track', { conversion_id: 1 }],
    ]);

    const existing: Lintrk = () => undefined;
    const shared: LinkedInWindow = {
      _linkedin_data_partner_ids: ['111'],
      lintrk: existing,
    };
    load(script, shared);
    check(
      'keeps a partner id another tag on the page registered',
      shared._linkedin_data_partner_ids,
      ['111', '10858609'],
    );
    check(
      'leaves an already loaded lintrk in place',
      shared.lintrk === existing,
      true,
    );
  }

  const refused: ReadonlyArray<readonly [string, string | undefined]> = [
    ['absent', undefined],
    ['empty', ''],
    ['script breakout', '1";alert(1);//'],
    ['closing tag', '</script><script>alert(1)</script>'],
    ['non-ASCII digits', '١٢٣'],
    ['surrounding space', ' 10858609'],
    ['trailing newline', '10858609\n'],
  ];
  for (const [name, value] of refused) {
    check(
      `renders nothing for partner id: ${name}`,
      linkedInInsightTagScript(value),
      null,
    );
  }

  if (failures > 0) {
    console.error(`linkedin-insight-tag loader contract: ${failures} FAILED`);
    process.exit(1);
  }
  console.log('linkedin-insight-tag loader contract OK');
}

main();

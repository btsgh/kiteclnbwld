// Regression for V1-F1 (unchecked custom properties relabeling ordinary
// interactions as conversions): a stamped data-kite-prop-kite_event_type
// must never overwrite the closed kite_event_type this SDK assigns, or a
// plain CTA click could be counted as a goal_completed conversion.
//
// The template ships no unit-test runner, so this is a self-contained
// script (run in CI by nextjs-template-code-quality.yml), matching
// kite-experiment-bootstrap.test.ts. It executes the SDK source this repo
// publishes, packages/kite-analytics/kite-analytics.js — no bundler or
// transpiler in between, though a site serves whichever version its lockfile
// resolved, which trails this source until the refresh — against a hand-built
// stub DOM (this file's boot path only needs a handful of browser globals;
// IntersectionObserver is deliberately left undefined so the surface/item
// observers no-op, matching a browser where that API is unused here).
//
// Run locally:
//   pnpm dlx tsx src/components/kite-analytics-reserved-props.test.ts

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_SOURCE = fs.readFileSync(
  path.join(__dirname, '../../../packages/kite-analytics/kite-analytics.js'),
  'utf8',
);

type CapturedEvent = { event: string; props: Record<string, unknown> };
type FakeElement = {
  nodeType: 1;
  tagName: string;
  parentElement: FakeElement | null;
  textContent: string;
  attributes: { name: string; value: string }[];
  getAttribute(name: string): string | null;
  hasAttribute(name: string): boolean;
  querySelector(): null;
  addEventListener?(type: string, listener: () => void): void;
  __kiteMediaWired?: boolean;
};

function makeEl(
  tag: string,
  attrs: Record<string, string>,
  parent: FakeElement | null = null,
): FakeElement {
  const list = Object.keys(attrs).map((name) => ({ name, value: attrs[name] }));
  return {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    parentElement: parent,
    textContent: attrs.__text || '',
    attributes: list,
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name)
        ? attrs[name]
        : null;
    },
    hasAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name);
    },
    querySelector() {
      return null;
    },
  };
}

// Boots the real SDK against a minimal stub environment and returns every
// event it captured, plus the registered click listener so the test can
// drive interactions directly (no real DOM event dispatch needed).
type KiteConversionApi = {
  conversion(goalType: string, props?: Record<string, unknown>): void;
};

function bootSdk(media: FakeElement[] = []): {
  captured: CapturedEvent[];
  clickListener: (e: { target: FakeElement }) => void;
  win: { __kite?: KiteConversionApi };
} {
  const captured: CapturedEvent[] = [];
  const listeners: Record<string, (e: { target: FakeElement }) => void> = {};
  const store: Record<string, string> = {};

  const fakeWindow: Record<string, unknown> = {
    __KITE_ENV__: {
      posthogToken: 'phc_test',
      websiteId: 'site-1',
      accountId: 'acct-1',
      schemaVersion: '2.2',
      consentState: 'granted',
    },
    __KITE_PH__: {
      capture(event: string, props: Record<string, unknown>) {
        captured.push({ event, props });
      },
      register() {},
    },
    console,
    innerWidth: 1280,
    innerHeight: 800,
    scrollY: 0,
    localStorage: {
      getItem: (k: string) =>
        Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    },
    addEventListener(type: string) {
      // window-level listeners (scroll/popstate/pagehide) — not exercised here.
      void type;
    },
  };
  const fakeLocation = {
    pathname: '/',
    search: '',
    href: 'https://example.test/',
  };
  fakeWindow.location = fakeLocation;

  const fakeDocument: Record<string, unknown> = {
    readyState: 'complete',
    referrer: '',
    visibilityState: 'visible',
    documentElement: { scrollHeight: 0 },
    querySelector() {
      return null;
    },
    querySelectorAll(selector: string) {
      return selector === '[data-kite-media]' ? media : [];
    },
    addEventListener(type: string, fn: (e: { target: FakeElement }) => void) {
      listeners[type] = fn;
    },
  };

  const fakeHistory = {
    pushState() {},
    replaceState() {},
  };

  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const run = new Function(
    'window',
    'document',
    'location',
    'history',
    SCRIPT_SOURCE,
  ) as (win: unknown, doc: unknown, loc: unknown, hist: unknown) => void;
  run(fakeWindow, fakeDocument, fakeLocation, fakeHistory);

  return {
    captured,
    clickListener: listeners.click,
    win: fakeWindow as { __kite?: KiteConversionApi },
  };
}

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

function main(): void {
  // A stamped CTA carries a malicious data-kite-prop-kite_event_type that
  // tries to relabel the click as a completed goal, plus a malicious
  // is_conversion, alongside an unclassified custom property
  // that the positive allowlist must reject before capture (D1-F1: the
  // canonical contract approves parameters WITH sensitivity classes; an
  // unclassified key must never reach analytics).
  {
    const { captured, clickListener } = bootSdk();
    captured.length = 0; // drop boot-time events (page_viewed, register)

    const cta = makeEl('button', {
      'data-kite-cta-id': 'hero-learn-more',
      'data-kite-prop-kite_event_type': 'goal_completed',
      'data-kite-prop-is_conversion': 'true',
      'data-kite-prop-campaign': 'spring-launch',
      __text: 'Learn more',
    });

    clickListener({ target: cta });

    const ctaClicks = captured.filter((c) => c.event === 'cta_clicked');
    check('exactly one cta_clicked event fires', ctaClicks.length, 1);
    const props = ctaClicks[0]?.props || {};
    check(
      'the stamped kite_event_type cannot override the real one',
      props.kite_event_type,
      'cta_clicked',
    );
    check(
      'the stamped is_conversion cannot inject a conversion flag',
      props.is_conversion,
      undefined,
    );
    check(
      'an unclassified custom property is rejected before capture',
      props.campaign,
      undefined,
    );
  }

  // Media fields are SDK-owned too. A stamp must not be able to falsify which
  // media played or which action occurred.
  {
    let play: (() => void) | undefined;
    const media = makeEl('video', {
      'data-kite-media': 'hero-video',
      'data-kite-prop-media_id': 'forged-video',
      'data-kite-prop-action': 'completed',
    });
    media.addEventListener = (type, listener) => {
      if (type === 'play') play = listener;
    };

    const { captured } = bootSdk([media]);
    captured.length = 0;
    play?.();

    const events = captured.filter((c) => c.event === 'media_engaged');
    check('exactly one media_engaged event fires', events.length, 1);
    const props = events[0]?.props || {};
    check(
      'the stamped media_id cannot override the real one',
      props.media_id,
      'hero-video',
    );
    check(
      'the stamped action cannot override the real one',
      props.action,
      'play',
    );
  }

  // A stamped goal conversion element (data-kite-conversion, no hook) with a
  // malicious data-kite-prop-kite_event_type on the goal itself: the goal
  // path (fireGoal) already assigns kite_event_type after merging custom
  // props, but the shared reserved-name gate covers it identically, so the
  // stamped value is dropped before it ever reaches fireGoal's own merge.
  {
    const { captured, clickListener } = bootSdk();
    captured.length = 0;

    const goal = makeEl('button', {
      'data-kite-conversion': 'signup',
      'data-kite-prop-kite_event_type': 'page_viewed',
      __text: 'Sign up',
    });

    clickListener({ target: goal });

    const goals = captured.filter(
      (c) => c.props.kite_event_type === 'goal_completed',
    );
    check('the goal still fires as goal_completed', goals.length, 1);
  }

  // The public window.__kite.conversion API is a sibling emission path whose
  // props object merges AFTER fireGoal's authoritative conversion fields, so
  // without the reserved gate application code could overwrite
  // kite_event_type / is_conversion and make a real conversion disappear from
  // conversion totals (D1-F6).
  {
    const { captured, win } = bootSdk();
    captured.length = 0;

    check(
      'the SDK registers window.__kite.conversion',
      typeof win.__kite?.conversion,
      'function',
    );
    win.__kite?.conversion('signup', {
      kite_event_type: 'cta_clicked',
      is_conversion: false,
      campaign: 'spring-launch',
    });

    const goals = captured.filter((c) => c.event === 'signup_completed');
    check('exactly one signup_completed goal fires', goals.length, 1);
    const props = goals[0]?.props || {};
    check(
      'programmatic kite_event_type cannot overwrite goal_completed',
      props.kite_event_type,
      'goal_completed',
    );
    check(
      'programmatic is_conversion cannot flip the conversion flag',
      props.is_conversion,
      true,
    );
    check(
      'an unclassified programmatic property is rejected before capture',
      props.campaign,
      undefined,
    );
  }

  if (failures === 0) {
    console.log('kite-analytics reserved-property contract OK');
  } else {
    console.error(
      `kite-analytics reserved-property contract: ${failures} FAILED`,
    );
    process.exit(1);
  }
}

main();

// Arm-selection contract for the production A/B switch. The template ships no
// unit-test runner, so this is a self-contained tsx script (run in CI by
// nextjs-template-code-quality.yml, like the platform-token forge contract).
//
// It renders the REAL component with react-dom/server, which is the only way
// to observe what a visitor actually receives.
//
// What it pins is that a visitor receives exactly their assigned slot. The
// children-based predecessor needed a page of fail-closed cases here because
// an arm could hide behind a wrapper or a component boundary and dodge
// selection; slots removed that authoring surface, so the cases below cover
// the shapes that remain: assignment routing, the control fallback, `null`
// slots, arms behind component boundaries (now supported), and the losing arm
// never reaching the payload.
//
// Run locally:
//   NODE_ENV=production pnpm exec tsx src/components/kite-experiment.test.tsx
//
// NODE_ENV must come from the environment, not from an assignment in here: the
// switch reads it at module scope to pick preview-vs-production, and the JSX
// runtime import this file compiles down to is hoisted above any statement we
// could write — so setting it in code binds a development JSX runtime against a
// production react-dom and crashes on a dispatcher mismatch. The guard below
// turns "ran it wrong" into a message instead of a green run of the preview
// path, which is the half this file is not trying to test.

import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentProps, ReactNode } from 'react';

import { KiteExperimentSwitch } from './kite-experiment';

if (process.env.NODE_ENV !== 'production') {
  console.error(
    'NODE_ENV must be "production" — this contract covers the production ' +
      'arm-selection path.\n' +
      'Run: NODE_ENV=production pnpm exec tsx src/components/kite-experiment.test.tsx',
  );
  process.exit(1);
}

let failures = 0;

function check(name: string, actual: string, expected: string): void {
  if (actual === expected) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.error(
      `  FAIL ${name}\n        expected: ${expected}\n        actual:   ${actual}`,
    );
  }
}

function main(): void {
  // A platform-minted pair: the flag key is kite_exp_ + the experiment
  // UUID's first 12 hex chars. Serving is gated on that coherence, so the
  // fixtures must use a real pair the way generated markup always does.
  const EXPERIMENT_ID = '01234567-89ab-cdef-0123-456789abcdef';
  const FLAG_KEY = 'kite_exp_0123456789ab';
  const IN_TEST = { [FLAG_KEY]: 'test' };
  const IN_CONTROL = { [FLAG_KEY]: 'control' };

  function render(
    assignments: Record<string, string> | undefined,
    arms: { control: ReactNode; test: ReactNode },
  ): string {
    return renderToStaticMarkup(
      <KiteExperimentSwitch
        experimentId={EXPERIMENT_ID}
        flagKey={FLAG_KEY}
        assignments={assignments}
        control={arms.control}
        test={arms.test}
      />,
    );
  }

  const arms = { control: <p>ctl</p>, test: <p>tst</p> };

  // Assignment routing.
  check(
    'assigned test serves the test slot',
    render(IN_TEST, arms),
    '<p>tst</p>',
  );
  check(
    'assigned control serves the control slot',
    render(IN_CONTROL, arms),
    '<p>ctl</p>',
  );
  check(
    'unassigned visitor falls back to control',
    render(undefined, arms),
    '<p>ctl</p>',
  );
  check(
    'an unknown assignment value serves control, not nothing',
    render({ [FLAG_KEY]: 'variant-3' }, arms),
    '<p>ctl</p>',
  );

  // The losing arm must never reach the visitor at all — the whole reason
  // production gates server-side instead of shipping both and hiding one.
  check(
    'the losing arm is absent from the markup',
    String(render(IN_TEST, arms).includes('ctl')),
    'false',
  );

  // A multi-element arm needs no wrapper element.
  check(
    'a fragment arm renders all of its elements',
    render(IN_TEST, {
      control: null,
      test: (
        <>
          <h2>New</h2>
          <p>tst</p>
        </>
      ),
    }),
    '<h2>New</h2><p>tst</p>',
  );

  // `null` slots: how removals (test={null}) and additions (control={null})
  // are expressed. The empty result is a real answer, never a fallback —
  // falling back would silently un-test every removal.
  check(
    'test={null} shows the test arm nothing',
    render(IN_TEST, { control: <p>ctl</p>, test: null }),
    '',
  );
  check(
    'test={null} still serves control to the control arm',
    render(IN_CONTROL, { control: <p>ctl</p>, test: null }),
    '<p>ctl</p>',
  );
  check(
    'control={null} shows the control arm nothing',
    render(IN_CONTROL, { control: null, test: <button>Buy</button> }),
    '',
  );
  check(
    'control={null} still serves the addition to the test arm',
    render(IN_TEST, { control: null, test: <button>Buy</button> }),
    '<button>Buy</button>',
  );

  // The shape the children-based switch could not support: an arm behind a
  // component boundary. Slots select before the component renders, so this
  // now serves exactly the assigned arm — no scanner needed.
  function PricingRow({ badge }: { badge?: string }) {
    return <p>{badge ? `pro ${badge}` : 'pro'}</p>;
  }
  check(
    'an arm behind a component boundary serves the assigned arm',
    render(IN_TEST, {
      control: <PricingRow />,
      test: <PricingRow badge="popular" />,
    }),
    '<p>pro popular</p>',
  );
  check(
    'an arm behind a component boundary never leaks the losing arm',
    String(
      render(IN_CONTROL, {
        control: <PricingRow />,
        test: <PricingRow badge="popular" />,
      }).includes('popular'),
    ),
    'false',
  );

  // A second experiment on the page resolves against ITS OWN assignment. The
  // inner switch sits in an arm slot, so it is reached only when that arm wins.
  const OUTER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const OUTER_KEY = 'kite_exp_aaaaaaaaaaaa';
  const INNER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const INNER_KEY = 'kite_exp_bbbbbbbbbbbb';
  const twoExperiments = { [OUTER_KEY]: 'test', [INNER_KEY]: 'control' };
  check(
    'a nested switch keeps its own arms',
    renderToStaticMarkup(
      <KiteExperimentSwitch
        experimentId={OUTER_ID}
        flagKey={OUTER_KEY}
        assignments={twoExperiments}
        control={null}
        test={
          <KiteExperimentSwitch
            experimentId={INNER_ID}
            flagKey={INNER_KEY}
            assignments={twoExperiments}
            control={<p>inner-ctl</p>}
            test={<p>inner-tst</p>}
          />
        }
      />,
    ),
    '<p>inner-ctl</p>',
  );

  // THE SEMANTIC BOUNDARY: however the component is reached, the effective
  // props arrive here, and a pair the platform did not mint serves control.
  // A spread overriding experimentId (leaving a real launched flagKey) breaks
  // the minted coherence — the assigned test arm must NOT serve. The Partial
  // type keeps the override optional to the checker (a literal spread here is
  // a TS2783 compile error), matching the attack shape: the compiler cannot
  // see what a spread carries, only the runtime can.
  const spreadOverride: Partial<ComponentProps<typeof KiteExperimentSwitch>> = {
    experimentId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  };
  check(
    'a spread-overridden experimentId cannot ride a real flag',
    renderToStaticMarkup(
      <KiteExperimentSwitch
        experimentId={EXPERIMENT_ID}
        flagKey={FLAG_KEY}
        assignments={IN_TEST}
        control={<p>ctl</p>}
        test={<p>tst</p>}
        {...spreadOverride}
      />,
    ),
    '<p>ctl</p>',
  );

  // A coherent but unlaunched rogue pair gets no assignment and serves
  // control — an unregistered experiment can never split traffic.
  check(
    'a hand-minted rogue pair with no launched flag serves control',
    renderToStaticMarkup(
      <KiteExperimentSwitch
        experimentId="ffffffff-ffff-4fff-8fff-ffffffffffff"
        flagKey="kite_exp_ffffffffffff"
        assignments={IN_TEST}
        control={<p>ctl</p>}
        test={<p>tst</p>}
      />,
    ),
    '<p>ctl</p>',
  );

  // A computed/namespace reference still funnels into the same function, so
  // the source scanner refusing such references is defense-in-depth, not the
  // only line: even if one slipped through, it could not split traffic with
  // an unminted pair.
  const ns: Record<string, typeof KiteExperimentSwitch> = {
    KiteExperimentSwitch,
  };
  const Computed = ns['KiteExperimentSwitch'];
  check(
    'a computed reference with an unminted pair serves control',
    renderToStaticMarkup(
      <Computed
        experimentId="ffffffff-ffff-4fff-8fff-ffffffffffff"
        flagKey={FLAG_KEY}
        assignments={IN_TEST}
        control={<p>ctl</p>}
        test={<p>tst</p>}
      />,
    ),
    '<p>ctl</p>',
  );

  if (failures === 0) {
    console.log('kite-experiment arm-selection contract OK');
  } else {
    console.error(`kite-experiment arm-selection contract: ${failures} FAILED`);
    process.exit(1);
  }
}

main();

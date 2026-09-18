'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

/**
 * Draft-preview variant switching.
 *
 * `next dev` never initialises PostHog (the layout gates it on
 * NODE_ENV === 'production') and the sandbox has no project token, so no flag
 * can resolve here. The preview decides on the client instead, which also lets
 * the Kite editor flip a variant live without a rebuild.
 *
 * Both arms ship to the browser in the preview — they must, to toggle without a
 * rebuild. That is exactly why production uses the server-side gate instead.
 */

const TEST_VARIANT = 'test';

/** Message the Kite editor posts to flip a variant. */
const SET_VARIANT_MESSAGE = 'v2-set-experiment-variant';

/** Handshake: the preview announces which experiments it can toggle. */
const READY_MESSAGE = 'v2-experiment-switch-ready';

const PreviewContext = createContext<string | null>(null);

export function KitePreviewProvider({
  experimentId,
  children,
}: {
  experimentId: string;
  children: ReactNode;
}) {
  // Opens on the variant being authored: that is the change the user just asked
  // for and came to review.
  const [variant, setVariant] = useState(TEST_VARIANT);

  useEffect(() => {
    // Announce on mount and on every remount, so the editor can rebuild its
    // toggle list after an HMR reload discards this state.
    window.parent?.postMessage({ type: READY_MESSAGE, experimentId }, '*');

    function onMessage(event: MessageEvent) {
      // Only the editor that framed this preview may flip a variant. Checked by
      // window identity rather than by origin because the editor is served from
      // many origins (localhost, *.kite.localhost, staging, deploy previews,
      // production) while the preview is always an e2b sandbox host — an origin
      // allowlist would have to enumerate all of them, and this is exact. The
      // editor half of the bridge already gates its inbound messages the same
      // way, on `event.source`.
      if (event.source !== window.parent) return;
      const data = event.data;
      if (!data || data.type !== SET_VARIANT_MESSAGE) return;
      // A message with no experimentId targets every switch on the page, so the
      // editor can flip the whole site at once.
      if (data.experimentId && data.experimentId !== experimentId) return;
      if (typeof data.variant !== 'string') return;
      setVariant(data.variant);
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [experimentId]);

  return (
    <PreviewContext.Provider value={variant}>
      {children}
    </PreviewContext.Provider>
  );
}

/**
 * Render this arm only when it matches the previewed variant.
 *
 * Outside a switch there is no context, so the arm renders as ordinary markup —
 * a stray preview arm degrades to plain content rather than vanishing.
 */
export function KitePreviewVariant({
  type,
  children,
}: {
  type: string;
  children: ReactNode;
}) {
  const chosen = useContext(PreviewContext);
  if (chosen === null) return <>{children}</>;
  return chosen === type ? <>{children}</> : null;
}

'use client';

// Scroll-reveal primitive shipped with the template.
//
// Usage: put the `reveal` class on any element that should fade + rise in as
// it enters the viewport. The layout mounts one <ScrollReveal /> site-wide,
// which adds `is-revealed` as elements scroll into view; the visual contract
// (hidden state, transition, reduced-motion override) lives in globals.css.
// Mount it in the root layout only — never in a page component — and never
// hand-roll an IntersectionObserver for entrance reveals; use `useInView`
// below for custom in-view triggers (count-ups, chart entrance plays).
//
// Correctness properties, each load-bearing:
// - The hidden state is gated on `html.js` (an inline script in the layout
//   head adds the class before paint), so content stays visible when
//   scripting is disabled or the observer never runs.
// - Matches are picked up as the DOM changes, not snapshotted once at mount:
//   a MutationObserver on <body> hands every newly inserted (or class-rewritten)
//   match to the IntersectionObserver. A layout-mounted observer that only
//   queries on mount — or only on a pathname change — fires for hard loads and
//   client navigations, but never for DOM that arrives on the same route: an
//   RSC `router.refresh()` (the CMS live preview's save path) or a Fast Refresh
//   remount renders new nodes that would stay hidden forever.
// - `prefers-reduced-motion` reveals everything immediately, no animation.
import { useEffect, useRef } from 'react';

// Slightly early trigger so reveals land before the element is centered.
const OBSERVER_DEFAULTS: IntersectionObserverInit = {
  rootMargin: '0px 0px -10% 0px',
  threshold: 0.1,
};

function revealImmediately(): boolean {
  return (
    typeof IntersectionObserver === 'undefined' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// Hook form of the primitive for components that need a callback when they
// enter the viewport rather than a class toggle. Fires `onEnter` once, then
// disconnects. Under reduced motion (or no IntersectionObserver) it fires
// immediately so the final state always renders.
export function useInView(
  ref: React.RefObject<Element | null>,
  onEnter: () => void,
  options?: IntersectionObserverInit,
) {
  // Stable ref so consumer re-renders don't re-run the effect.
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (revealImmediately()) {
      onEnterRef.current();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        onEnterRef.current();
        observer.disconnect();
      }
    }, options ?? OBSERVER_DEFAULTS);
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}

// Arms the reveal for every current and future `selector` match under <body>
// and returns the teardown. Exported for the contract test; the component
// below is the only runtime caller.
export function armScrollReveal(
  selector: string,
  shownClass: string,
): () => void {
  const observer = revealImmediately()
    ? null
    : new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(shownClass);
            observer?.unobserve(entry.target);
          }
        });
      }, OBSERVER_DEFAULTS);

  const watch = (el: Element) => {
    // Already revealed: nothing to do. This guard is what stops a feedback
    // loop when a caller's selector does not exclude `shownClass` — the
    // reveal's own class write is reported by the class observer below, the
    // element still matches, and without it we would re-observe (or re-add,
    // which re-serialises the attribute) forever.
    if (el.classList.contains(shownClass)) return;
    if (observer) observer.observe(el);
    else el.classList.add(shownClass);
  };
  const watchTree = (root: Element) => {
    if (root.matches(selector)) watch(root);
    root.querySelectorAll(selector).forEach(watch);
  };

  document.querySelectorAll(selector).forEach(watch);

  const mutations = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') {
        // React rewrites `className` wholesale when the prop string changes,
        // which drops the imperatively added `is-revealed`; re-arm so the
        // element reveals again instead of staying hidden.
        const el = record.target as Element;
        if (el.matches(selector)) watch(el);
        continue;
      }
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) watchTree(node as Element);
      });
    }
  });
  mutations.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });

  return () => {
    mutations.disconnect();
    observer?.disconnect();
  };
}

export default function ScrollReveal({
  selector = '.reveal:not(.is-revealed)',
  shownClass = 'is-revealed',
}: {
  selector?: string;
  shownClass?: string;
}) {
  useEffect(
    () => armScrollReveal(selector, shownClass),
    [selector, shownClass],
  );

  return null;
}

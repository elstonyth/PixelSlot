"use client";

// Drop-in scroll-entry + reduced-motion hooks. Copy into the target project at
// src/lib/use-reveal.ts. Pair with assets/Reveal.tsx.

import { useEffect, useRef, useState } from "react";

/** SSR-safe `prefers-reduced-motion` listener. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Fire-once scroll-into-view detector. Returns a ref + a `shown` flag that flips
 * true the first time the element enters the viewport, then stops observing.
 * IntersectionObserver uses the nearest scrollable ancestor automatically, so
 * this works whether the page scrolls on `window` or inside an `overflow-y-auto`
 * container.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            obs.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);
  return [ref, shown] as const;
}

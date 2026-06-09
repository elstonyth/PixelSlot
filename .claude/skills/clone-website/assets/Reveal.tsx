"use client";

// Drop-in scroll-entry wrapper. Copy into the target project at
// src/components/Reveal.tsx. Requires assets/use-reveal.ts and a `cn` helper.
//
// Usage:
//   <Reveal>            ...section...            </Reveal>
//   <Reveal as="section" delay={i*110}> ...card... </Reveal>
//
// Fades up + slides in ONCE when scrolled into view; respects reduced-motion
// (renders visible instantly, no transition). Stagger siblings via `delay`.

import { type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useInView, usePrefersReducedMotion } from "@/lib/use-reveal";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** stagger delay in ms (applied only while animating in) */
  delay?: number;
  /** distance to travel up, in px (default 24) */
  y?: number;
  /** element to render (default div). e.g. "section" */
  as?: ElementType;
};

export default function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
  as: Tag = "div",
}: RevealProps) {
  const [ref, shown] = useInView<HTMLElement>();
  const reduced = usePrefersReducedMotion();
  const visible = shown || reduced;

  return (
    <Tag
      ref={ref}
      className={cn(
        !reduced &&
          "transition-all duration-700 ease-out will-change-[opacity,transform] motion-reduce:transition-none",
        visible ? "translate-y-0 opacity-100" : "opacity-0",
        className,
      )}
      style={{
        transform: visible ? undefined : `translateY(${y}px)`,
        transitionDelay: shown && !reduced ? `${delay}ms` : "0ms",
      }}
    >
      {children}
    </Tag>
  );
}

# HowItWorksSection Specification (re-extracted from live site)

## Overview
- **Target file:** `src/components/HowItWorksSection.tsx`
- **Interaction model:** scroll-triggered entry animation (fade-up + slight slide, staggered per card) via IntersectionObserver. Client component.
- **CRITICAL:** the current clone has WRONG content. Real content below (verbatim from live site).

## Real content (verbatim)
- Eyebrow/heading: **"How It Works"** (font-heading, gradient white→muted like other section headings)
- Subtitle: **"Three simple steps to start collecting"** (muted, text-neutral-400, centered under heading)
- Right-aligned link (optional, top-right of header row): **"View Marketplace"** → href `/marketplace`, muted `text-white/45 hover:text-white/60`, with a `→`.
- THREE step cards (no images — numbered + icon based):
  1. **Choose Your Pack** — "Browse our curated selection of trading card packs from Pokémon, sports, and more"
  2. **Rip & Reveal** — "Watch the excitement unfold as you rip open your pack"
  3. **Collect & Trade** — "Build your collection or trade with others in our marketplace"

## Layout
- Wrapper: `<section className="mt-10 sm:mt-14">` (matches sibling section rhythm).
- Header block centered: heading h2 + subtitle p. (Heading style identical to OpenPacks/Leaderboard: `font-heading bg-gradient-to-b from-white via-white/80 to-white/30 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl`.)
- Cards: responsive grid — `grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5` (1 col mobile, 3 cols ≥640px).
- Each card: `rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.25)]`.
  - Numbered badge top: a circle `flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white` showing 1 / 2 / 3 (plus a lucide icon is acceptable above/beside: Choose→`PackageOpen` or `Layers`, Rip&Reveal→`Sparkles`, Collect&Trade→`Repeat`/`ArrowLeftRight`).
  - Title `mt-4 font-heading text-lg font-bold text-white` (or text-xl).
  - Body `mt-2 text-sm leading-relaxed text-neutral-400`.

## Entry animation (scroll-triggered) — THIS IS THE KEY REQUIREMENT
The current clone has NO entry animation; the live section fades/slides its cards up as they scroll into view.
- **Mechanism:** IntersectionObserver on each card (or the grid). When a card enters the viewport (threshold ~0.2 / rootMargin "0px 0px -10% 0px"), it animates from hidden→shown ONCE.
- **Before (hidden):** `opacity-0 translate-y-6` (≈24px down).
- **After (shown):** `opacity-100 translate-y-0`.
- **Transition:** `transition-all duration-700 ease-out`.
- **Stagger:** card 1 delay 0ms, card 2 ~120ms, card 3 ~240ms (via inline `transitionDelay` or delay classes).
- **Header** (heading + subtitle) also fades-up on enter (slightly before the cards).
- **Respect `prefers-reduced-motion`:** if reduced, render everything visible immediately (no opacity/translate, no transition).
- Implementation: a small `useInView` hook (useRef + IntersectionObserver, set a `shown` boolean, unobserve after first trigger). Each animated element: `className={cn(base, reduced ? "" : "transition-all duration-700 ease-out", shown || reduced ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6")}` with per-card `style={{ transitionDelay: shown && !reduced ? `${i*120}ms` : "0ms" }}`.

## Responsive (test at 390 / 768 / 1440 / 1920)
- Mobile (<640): single column, cards stack, gap-4, full width.
- ≥640: 3 columns equal width.
- Heading/subtitle centered at all sizes. No fixed max-width that causes empty desktop margins (section inherits full-width page wrapper).

## Hover (cards)
- Subtle: `transition-[border-color,transform] hover:border-white/20` and optionally `hover:-translate-y-1`. Keep light; the main effect is the entry animation.

## Shared imports
- `import { cn } from "@/lib/utils"`
- Icons from `lucide-react` (e.g. Layers, Sparkles, ArrowLeftRight).

## Acceptance
- Content matches verbatim (Choose Your Pack / Rip & Reveal / Collect & Trade + subtitle "Three simple steps to start collecting").
- Cards fade-up + slide-in (staggered) when scrolled into view — and DON'T animate again on scroll back.
- Works at 390/768/1440/1920 (1 col → 3 col).
- `prefers-reduced-motion` shows everything instantly.
- `npx tsc --noEmit` passes; 0 broken (no external images).

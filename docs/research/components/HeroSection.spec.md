# HeroSection Specification (frame-by-frame measured + approved refinements)

## Overview
- **Target file:** `src/components/HeroSection.tsx`
- **Reference frames:** `docs/research/hero-film/frame_*.png` (80 frames), `docs/research/hero-compare/ORIGINAL.png`
- **Interaction model:** time-driven auto-rotating 3-card stack carousel + per-card hover feedback
- **Client component** (`"use client"`) — uses `useState`/`useEffect` for rotation + reduced-motion.

## Measured geometry (getBoundingClientRect, live site)
- Hero container: width = full content width (NO max-width cap), height **480px** desktop, radius 16px (`rounded-2xl`).
- Center card: pack image ≈ h 400 / w 251; sits LOW in the box (clipped slightly at bottom).
- Sides peek ~**65px** from center (heavy ~70% overlap), **NOT blurred**, opacity **0.6**, ~0.92 scale.

## Slot model (relative offset from center)
Keyed by offset: -1 (left/previous), 0 (center/featured), +1 (right/next), else hidden.
| slot | translateX | scale | opacity | z | rotate |
|---|---|---|---|---|---|
| -1 (left)  | -11% | 0.92 | 0.6 | 20 | **-6deg** |
| 0 (center) | 0%   | 1.0  | 1.0 | 30 | **0deg** |
| +1 (right) | +11% | 0.92 | 0.6 | 20 | **+6deg** |
| others     | 0    | 0.9  | 0   | 0  | 0 |

- **Center card is straight (0deg); side cards tilt outward (±6deg)** — approved refinement.
- The per-card transform composes `translateX(x) scale(s) rotate(r)`, transitioned together.

## Card composition (each slot)
A graded **slab emerging from an opened foil pack** — slab BEHIND, pack in FRONT, both inside a `relative h-full w-full max-w-[250px]` wrapper:
- slab: `absolute bottom-[14%] left-1/2 z-0 h-[58%] w-auto -translate-x-1/2 object-contain drop-shadow-[0_10px_28px_rgba(0,0,0,0.5)]`
- pack: `absolute bottom-[-6%] left-1/2 z-10 h-[74%] w-auto -translate-x-1/2 object-contain drop-shadow-[0_16px_36px_rgba(0,0,0,0.6)]`
- The card sits LOW with the pack slightly clipped at the bottom edge (matches original).

## Auto-rotation
- `setInterval` **2800ms**, `center = (center+1) % N`, loops infinitely.
- Order: pokemon → onepiece → basketball → football → baseball → yugioh → …
- Transition: `transition-all duration-[650ms] ease-in-out` on each slot wrapper → slide+scale+rotate+opacity cross-fade with brief overlap.

## Background glow (color FOLLOWS the center card) — approved refinement
- A **radial-gradient** behind the cards whose COLOR = the featured card's dominant saturated hue.
- One absolutely-positioned glow div per theme; only the center theme's is `opacity-100`, others `opacity-0`, crossfading `transition-opacity duration-700 ease-in-out`.
- Glow div: `pointer-events-none absolute right-[2%] top-1/2 h-[90%] w-[42%] -translate-y-1/2`, with inline
  `background: radial-gradient(ellipse 55% 60% at 60% 50%, rgba(R,G,B,0.55) 0%, rgba(R,G,B,0.22) 38%, transparent 70%)`.
- **Per-theme glow RGB** (sampled, saturation-weighted, from each pack):
  - pokemon `81, 110, 200`
  - onepiece `210, 80, 165`
  - basketball `150, 120, 100`
  - football `210, 70, 65`
  - baseball `170, 150, 120`
  - yugioh `205, 170, 80`
- Dark overlay over everything: `bg-gradient-to-r from-neutral-950 via-neutral-950/80 to-transparent`
  (solid left for headline readability, fades right so the color glow stays visible).

## Hover — scoped to ONLY the center card — approved refinement
- `pointer-events-auto` on the CENTER card wrapper; `pointer-events-none` on side cards AND the surrounding hero area, so ONLY hovering the card images triggers the effect (not the headline/empty space).
- Effect (Tailwind v4 — uses `translate`/`scale` props): on the center card wrapper add
  `transition-transform duration-200 ease-out hover:-translate-y-2 hover:scale-[1.03]`.
- (Do NOT put `group/x` and `group-hover/x:` on the same element — use a plain `hover:` on the wrapper.)
- Disable hover effect when reduced-motion.

## Reduced motion
- `prefers-reduced-motion: reduce` → no auto-rotate (no interval), no transitions, no hover transform; show the static featured card + its glow.

## Layout / container
- `<section className="mb-8">` wrapping an `<a href="/claw">` that is the hero box.
- Hero box: `group/hero relative flex overflow-hidden rounded-2xl bg-neutral-950 h-[420px] sm:h-[450px] lg:h-[480px] shadow-[0_4px_20px_rgba(0,0,0,0.15)]`.
- Inside: glow layers → dark overlay → `relative z-10 flex h-full w-full flex-col md:flex-row`:
  - LEFT copy column: `flex flex-[1.05] flex-col justify-end p-6 sm:p-8 md:justify-center md:p-10`.
  - RIGHT carousel column: `relative flex-1` containing an `absolute inset-0` stack of all theme slots.
- The PAGE wrapper (page.tsx) has NO max-width cap — hero fills full viewport width minus padding (verified at 1920px).

## Assets (already local in /public)
slabs: `/home/hero/slabs/{pokemon1,onepiece2,basketball3,football4,baseball1,yugioh2}.webp`
packs: `/home/hero/ripped-packs/{pokemon,onepiece,basketball,football,baseball,yugioh}.webp`
Use plain `<img>` (eslint-disable next-line `@next/next/no-img-element`), NOT next/image.

## Text content (verbatim, static left column)
- Eyebrow: "Packs available now" (uppercase, tracking-widest, white/35)
- Headline (`font-heading`): "Rip packs. " (white) + "Pull graded cards." (text-neutral-400)
- Subtext: "Choose to hold, trade, redeem, or sell it back to us at up to " + pill "90% value." (`rounded-md bg-white/15 px-2 py-0.5 font-heading text-white`)
- Button: "Open Packs" (white pill, `group-hover/hero:bg-white`)
- Whole hero links to `/claw`.

## Responsive
- ≥768px: two columns (text left, carousel right).
- <768px: stacks — text then carousel below; carousel keeps the 3-card stack.

## Shared imports
- `import { cn } from "@/lib/utils"`
- No icon imports needed.

## Acceptance
- 3 cards visible at all times (1 sharp center + 2 dimmed/tilted sides), center changes on a ~2.8s loop.
- Background glow color changes IN SYNC with the featured card.
- Hovering ONLY the card lifts it; hovering text/empty area does nothing.
- `npx tsc --noEmit` passes. 0 broken images. Fills full width at 1920px.

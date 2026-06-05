# Phygitals Homepage — Behavior Bible

Findings from the interaction sweep. Reference when writing each component spec.

## Global
- **Scrolling:** native (no Lenis/Locomotive). `scroll-behavior: auto`. Content scrolls inside `main.overflow-y-auto`, not body.
- **Theme:** dark mode is the default/only mode shown. Neutral palette.
- **Header:** sticky, **no transform on scroll** (bg/shadow/backdrop unchanged at scrollTop 0 vs 600). Simple sticky bar with bottom border.

## Per-section behaviors (to refine during extraction)
- **Hero:** static. Right-side hero image sits over a large blurred multicolor gradient blob (decorative). Possible subtle entrance animation — verify.
- **Open Packs (categories):** horizontal row of 6 cards. Likely horizontally scrollable / drag carousel on overflow. Card + button hover states.
- **Recent Pulls:** horizontal carousel of recently-pulled cards ("Xm ago"). Content is server-driven (real pulls) → in clone use MOCK data. May auto-advance or be drag-scroll — verify. Cards have hover lift.
- **Our Community:** image grid/marquee — check for auto-scroll marquee animation.
- **Weekly Leaderboard:** ranked list/table; possibly tabbed (weekly/all-time?) — check for tabs.
- **CTA "Ready to start collecting?":** static with buttons.
- **Footer:** static; link hover states.

## To verify during Phase 3 extraction (per section)
- Card hover: scale/shadow/border transitions (duration + easing).
- Carousels: drag vs auto-advance; scroll-snap?
- Button hover: bg/color/scale.
- Responsive breakpoints: where category/pull rows change column count; where nav collapses to hamburger (mobile).

## Responsive (Tailwind breakpoints in use)
- Classes seen: `sm:px-6`, `sm:mt-14`, etc. → standard Tailwind breakpoints (sm 640, md 768, lg 1024, xl 1280).
- Nav collapses to hamburger ("Open menu") at mobile widths.

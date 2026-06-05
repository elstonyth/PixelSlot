# Section-by-Section Re-Review Plan (Playwright MCP)

**Trigger:** User installed `@playwright/mcp` (âœ“ connected, persisted in `~/.claude.json` user scope).
After a Claude Code **restart**, the `mcp__playwright__*` tools are available â€” use them for an
interactive, DOM-accurate re-review of every cloned section against the live site.

## â–¶ MODE CHOSEN BY USER: "All sections, auto-fix"
Walk EVERY section on BOTH pages (homepage + /how-it-works), measure clone vs original via
Playwright MCP, and FIX discrepancies as you go (don't stop for per-section approval). Give ONE
consolidated report at the end listing every diff found + fixed. On restart, immediately:
1. `npm run build && npx next start -p 4000` (pinned port, prod, no standalone).
2. Open original (https://www.phygitals.com/) + clone (http://localhost:4000/) via Playwright MCP.
3. Run the per-section loop below for all sections, auto-applying fixes, re-verifying each.

## Why this approach (root cause of prior mismatches)
Prior verification used one-shot headless scripts â€” blind to the live accessibility/DOM tree, easy
to mis-measure, and confused by stale ports/caches. The Playwright MCP stays connected and lets us
inspect the REAL computed DOM of both the original and the clone interactively, side by side.

## Setup each session
1. Start the clone prod server on a pinned port: `npm run build && npx next start -p 4000`.
   (Do NOT use dev; do NOT change the port mid-session. Confirm `output: standalone` is REMOVED from next.config.)
2. Use Playwright MCP to open TWO contexts/tabs: original `https://www.phygitals.com/` and clone `http://localhost:4000/`.
3. Remember: the live site SCROLLS INSIDE `main.overflow-y-auto`, not window. Scroll that element.

## Per-section review loop (do for EACH section below)
For the original AND the clone, at widths 390 / 768 / 1440 / 1920 / 3840:
1. Navigate + scroll the section into view.
2. `browser_snapshot` (accessibility tree) + screenshot both.
3. For key elements, read computed styles (font size/weight, color, padding, gap, border-radius,
   width/height, transform translate/scale/rotate â€” Tailwind v4 uses translate/scale, not `transform`).
4. Diff original vs clone numerically. Fix the clone to the measured values. Re-verify.
5. Check interactions: hover (scoped to element), scroll-entry (opacity 0 below fold â†’ 1), any
   modal/carousel. Modals MUST portal to body (createPortal) and darken page with rgba(0,0,0,0.8).

## Sections to review (homepage, topâ†’bottom)
- [ ] SiteHeader â€” sticky nav, icons (Layers/PartyPopper/Store/Trophy/Sparkles/HelpCircle), NEW badge, Login/Sign Up
- [ ] HeroSection â€” 3-card rotating carousel (Â±11% offset, 0.92 scale, 0.6 op sides, Â±6Â° tilt, 0Â° center),
      color-synced radial glow, pack sits low, hover lifts ONLY center card, fluid width
- [ ] OpenPacksSection â€” 6 category cards, slab behind + ripped pack `bottom-[-45%] z-1` in front,
      grid 2â†’3â†’6 cols, hover lift on imgs
- [ ] RecentPullsSection â€” live-pull cards, "Xm ago" badge, pack chips, hover lift
- [ ] HowItWorksSection (home) === HowItWorksSteps (shared) â€” 3 cards + StepInfoPill (packs=arrow link,
      buyback=? modal, ships=globe). Modal: 512px orig (clone 480 max-w), radius 16, overlay 0.8, "Got it" radius 12
- [ ] CommunitySection â€” auto-scroll marquee, pause on hover, tweet cards
- [ ] LeaderboardSection â€” ranked table (#, Name, Volume, Claw Pulls, Points), row hover
- [ ] CtaSection â€” "Ready to start collecting?", fanned 7 images, hover lift
- [ ] SiteFooter â€” Quick Links / Support / Social, full width

## /how-it-works page sections
- [ ] Hero "Real Cards, Owned Digitally" + stats bar (staggered entry) + measure orig sizes
- [ ] How It Works (shared HowItWorksSteps â€” must match homepage exactly)
- [ ] See It in Action (video placeholder, play button)
- [ ] Vault & Security (4 cards) Â· Testimonials (3) Â· What You Can Do (4) Â· FAQ accordion Â· CTA
- [ ] Re-extract each section's VERBATIM text + real images from live DOM; don't trust prior simplifications.

## Shared primitives already in place (reuse, keep in sync)
- `src/lib/use-reveal.ts` (useInView + usePrefersReducedMotion)
- `src/components/Reveal.tsx` (fade-up scroll-entry)
- `src/components/HowItWorksSteps.tsx` (the 3 cards â€” SHARED by home + page)
- `src/components/StepInfoPill.tsx` (pills + portaled buyback modal)
- `.px-fluid` in globals.css (clamp(1rem,1.6vw,4.5rem) gutter)

## Known-good run discipline
- Build green (`tsc --noEmit` + `npm run build`) before every screenshot.
- Watch runaway node procs: `powershell "@(Get-Process node).Count"`; kill: `Get-Process node | Stop-Process -Force`.
- Skill with all lessons: `~/.claude/skills/clone-website/` (SKILL.md + references/field-notes.md + assets + scripts).


# Field Notes — hard-won lessons from production clones

Read this when you hit (or want to pre-empt) the failure modes below. Each one
cost real hours on a real clone. The SKILL.md **Operating Rules** summarize the
top five; this file is the depth behind them, plus the long tail.

## Table of contents
1. Verification & tooling
2. Scroll, animation & interaction
3. Layout, responsive & 4K
4. Assets & content fidelity
5. Environment hazards (Windows/Next)
6. Bundled resources — what to copy and when

---

## 1. Verification & tooling

- **Verify with headless Playwright, never the live browser tab.** Install
  `playwright` + browsers (`npx playwright install chromium`), drive it headless,
  screenshot to `docs/research/*.png`, and READ those files. The live browser MCP
  caches stale state — when you change dev ports, the user's open tab keeps showing
  the OLD build and a correct clone looks "still broken." This single confusion
  cost hours. `scripts/verify-clone.mjs` automates the responsive + broken-image +
  entry-animation checks.
- **Measure, don't eyeball.** For any geometry or animation question, capture
  `getBoundingClientRect()` + `getComputedStyle()` from BOTH the original and the
  clone at the same viewport and compare the numbers. "Looks bigger / too high / not
  the same" is never actionable; "original pack h=400 vs clone h=686" is. Every
  stuck "it's still wrong" was resolved by measuring, none by guessing.
- **Tailwind v4 stores transforms in separate `translate` / `scale` / `rotate` CSS
  properties**, not the legacy `transform`. When you probe hover/animation state,
  read `getComputedStyle(el).translate` and `.scale` — `.transform` reads `"none"`
  and will fool you into thinking nothing fires when it actually does.
- **Run the production server for review** (`next build` && `next start`), not the
  dev server. Turbopack dev compiles and serves dozens of images slowly under load,
  so they paint late and look broken when the files are fine. Prod serves `/public`
  statically and instantly.
- **Pin ONE port for the whole session and never change it.** Every port change
  (3000→3001→3005…) guarantees the user is reviewing a stale cached tab. Pick a
  fresh port once, tell the user, and have them hard-refresh (Ctrl+Shift+R) or use
  an Incognito window if anything looks off.

## 2. Scroll, animation & interaction

- **Many sites scroll INSIDE a container, not the window.** E.g. content inside
  `main.overflow-y-auto`. `window.scrollTo` then does nothing and you'll wrongly
  conclude "there's no scroll animation." Find the real scroller — the element with
  `overflowY: auto|scroll` and `scrollHeight > clientHeight` — and scroll THAT when
  capturing or verifying.
- **Entry animations are one-shot; you'll miss them if you sample late.** They
  fade-up and fire once (IntersectionObserver), then rest at `opacity:1`. To CAPTURE
  one: park the section just below the fold, scroll it in, sample at high FPS
  immediately. To VERIFY a clone's: confirm the element is `opacity:0` while below
  the fold on load, then `opacity:1` after you scroll to it (this is exactly what a
  "no entry animation" bug looks like — elements already visible on load).
- **Capture rotating / carousel motion frame-by-frame BEFORE coding it.** Guessing
  the interaction model is the most expensive mistake. On one clone a "single card"
  was actually a 3-card stack carousel; a "crossfade" was actually a tilted rotating
  stack. Film 30–80 frames + per-frame transforms (`scripts/film-motion.mjs`) and
  decide slide vs rotate vs fade vs stack from the data. Real measured values that
  no one would guess: side cards ±~65px offset, opacity 0.6, NO blur, ~0.92 scale,
  ±6° tilt on sides / 0° on center.
- **Scope hover to the actual element.** Put `pointer-events-auto` on the hover
  target and `pointer-events-none` on its siblings and the surrounding link, so
  hovering empty space doesn't trigger it. And NEVER put `group/x` and
  `group-hover/x:` on the SAME element — Tailwind needs the trigger on a parent and
  the response on a child; or just use a plain `hover:` on the element itself.
- **Build the `<Reveal>` primitive once** (`assets/Reveal.tsx` + `assets/use-reveal.ts`)
  and reuse it for every section/card instead of re-implementing IntersectionObserver
  per component. Stagger siblings with `delay={i * ~110}`. Always render visible
  instantly under reduced-motion.

## 3. Layout, responsive & 4K

- **Test EVERY breakpoint, including 4K (3840).** 390 / 768 / 1440 / 1920 / 2560 /
  3840. A layout that's perfect at 1440 often has empty margins at 4K or horizontal
  overflow on mobile. `documentElement.scrollWidth > innerWidth` at any size = an
  overflow bug to fix.
- **Match the original's width behavior — don't impose your own.** Measure the
  original's content box across widths first. If it's full-bleed (`width:100%`,
  `max-width:none`), do NOT add `max-w-7xl`/`max-w-[1480px]` — that leaves big empty
  margins on wide screens. Remove caps from the page wrapper AND every section
  (header, footer, content).
- **Prefer a fluid gutter over breakpoint jumps** when the original is full-bleed:
  `padding-inline: clamp(1rem, 1.6vw, 4.5rem)` (`assets/fluid-width.css`). It tightens
  when minimized, scales continuously, and caps so 4K/ultrawide breathe instead of
  stretching edge-to-edge. Add `2xl:` scale-ups (larger text/padding/card heights)
  so big screens don't look sparse. If the original DOES cap its width, mirror that
  cap exactly instead.

## 4. Assets & content fidelity

- **Re-extract content per section; don't trust a prior simplification.** A "How It
  Works" section once got cloned as 3 generic steps when the real copy was specific
  ("Open a pack / Reveal your card / Keep, ship, or sell", with pack-icon
  illustrations and info pills). Always re-pull verbatim text + real image URLs from
  the live DOM for the section you're building.
- **Validate downloaded image bytes, not just HTTP 200.** curl loops (especially on
  Windows/cygwin `fork` errors) can write truncated or 0-byte files that still report
  `naturalWidth>0` yet render garbled. Check the real header (WebP `RIFF…WEBP` +
  declared-size vs filesize; PNG `IEND`; JPG `FFD9`) and re-download failures with
  Node `fetch`. `scripts/validate-assets.mjs` does this.
- **Sanitize Windows-illegal characters in filenames.** `:` is illegal in Windows
  paths — sanitize to `_` both on disk and in the component `src` strings, and map
  back to the original URL only when re-downloading.

## 5. Environment hazards (Windows / Next)

- **Watch for runaway `node` processes.** Dev servers + spawned agents can multiply
  into thousands (observed 5000+ processes / 91 GB RAM), which makes the machine
  crawl and the renderer "freeze" — a frozen page or a `taskkill` that times out is
  the tell. Check `powershell "@(Get-Process node).Count"`; kill all with
  `Get-Process node | Stop-Process -Force`, then restart the one prod server.
- **`turbopack.root` / multiple lockfiles.** If Next warns about multiple lockfiles,
  the safe fix is removing the stray lockfile or just leaving the warning. Setting
  `turbopack.root` to the app dir reactively once broke module resolution
  (`tailwindcss` not found). Don't add it to silence the warning.
- **`output: "standalone"` in next.config makes `next start` serve a STALE build.**
  Next prints `"next start" does not work with "output: standalone"` — it keeps
  serving an older prerender, so your edits silently don't appear and the user
  reviews ghosts of old code (e.g. an affordance you already removed still shows).
  This caused a long "why is the old version still there" loop. If the template
  ships `output: "standalone"` and you're not deploying that way, REMOVE it so
  `next build && next start` always serves current code. (If you do need standalone,
  run `node .next/standalone/server.js`, not `next start`.)

## 7. Component consistency & small affordances

- **The same section often appears on multiple routes (homepage teaser + dedicated
  page) — keep them in sync via a SHARED component, not two copies.** A "How It
  Works" block lived on both `/` and `/how-it-works`; they drifted (different step-3
  title, one had interactive pills, the other plain). Extract the repeated piece
  (e.g. an info-pill with per-variant icon/arrow/modal) into one component both
  import, so a fix lands everywhere at once.
- **Match small per-element affordances exactly — they're easy to miss and the user
  WILL notice.** On one card row each footer "pill" differed: one had a left icon +
  right arrow and was a link; one had a right "?" button that opened a modal; one had
  just a left icon and NO arrow. Inspect each element's real children
  (`el.querySelectorAll(":scope svg, :scope img")` — use `:scope` so you don't grab a
  parent's icons) and reproduce the exact set. A stray arrow or missing icon reads as
  "wrong" even when layout/text match.
- **Interactive affordances (a "?" that opens a modal, a play button, an accordion)
  are part of the clone, not decoration.** Build the real behavior (dialog with
  overlay, Escape-to-close, scroll-lock, focus return) — a static look-alike of an
  interactive control is a visible miss.
- **`position: fixed` modals get trapped by an ancestor `transform`/`will-change`/
  `filter`.** Scroll-reveal wrappers and animated cards create a containing block, so
  a `fixed` dialog anchors to that ancestor (not the viewport) and gets clipped by its
  `overflow-hidden` — the modal appears offset, half-size, top cut off. ALWAYS render
  modals/overlays via `createPortal(node, document.body)` so they escape to the
  viewport. Verify the dialog's `parentElement === BODY` and it's fully on-screen.
- **Measure the modal/overlay from the original — don't guess its chrome.** Open the
  real dialog and read its panel width/height/radius AND the overlay's
  `backgroundColor` + `backdropFilter`. A buyback modal was 480px wide with an
  `rgba(0,0,0,0.8)` overlay and NO blur; the clone defaulted to 560px + `black/70` +
  `backdrop-blur`, so it looked too big and the page didn't darken enough. The
  backdrop opacity is a real spec, not a vibe.

## 6. Bundled resources — what to copy and when

- `assets/use-reveal.ts` → `src/lib/use-reveal.ts` — IntersectionObserver + reduced-motion hooks.
- `assets/Reveal.tsx` → `src/components/Reveal.tsx` — scroll-entry wrapper (needs `cn` + use-reveal).
- `assets/fluid-width.css` → paste `.px-fluid` into globals.css `@layer utilities` (full-bleed sites only).
- `scripts/verify-clone.mjs` → run from project root after a build: responsive overflow + broken-image + entry-animation audit at 390–3840, with screenshots.
- `scripts/film-motion.mjs` → capture any animation/carousel frame-by-frame with per-frame transforms before you code it.
- `scripts/validate-assets.mjs` → validate + repair downloaded image bytes (set `REMOTE_HOST`).

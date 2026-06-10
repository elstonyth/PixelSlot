# Re-clone Kickoff — phygitals.com  ·  branch `clone/phygitals-v2`

**Read this first in a fresh session, before running `/clone-website`.**

## Goal
Refine the existing phygitals.com clone (it's already ~complete and near-pixel-perfect),
focusing on **animation/motion fidelity** — the main remaining gap — plus any residual
catalog/visual deltas. Work on branch `clone/phygitals-v2` (branched from
`feat/backend-medusa-mercur`, which is the pristine backup).

## Command
```
/clone-website https://www.phygitals.com/
```
The **evolved** clone-website skill is installed at `.claude/skills/clone-website/`
(SKILL.md + bundled `scripts/{verify-clone,film-motion,validate-assets}.mjs` and
`assets/{Reveal.tsx,use-reveal.ts,fluid-width.css}` + `references/field-notes.md`).

## Key decisions to carry into the rebuild
- **Animation = Framer Motion.** Live uses **GSAP + Framer Motion**; our clone is **CSS-keyframes
  only** (no animation lib) — that's the root of "the motion isn't the same." Build motion-heavy
  surfaces (pack-opening reveal + cylinder drag, `/claw` carousels, hero, scroll-reveal) with
  **Framer Motion** (spring/physics easing, gestures, layout animations). → `TECH_STACK_ANALYSIS.md`.
- **Verify with headless Playwright** (`scripts/*.mjs` + the skill's `verify-clone.mjs`/`film-motion.mjs`),
  **NOT Chrome MCP** (banned here — stale-cache false-negatives). Run the PROD build:
  `npm run build` → `npx next start -p 4000`; read the PNGs back.
- **Live-review technique:** the live site scrolls inside `main.overflow-y-auto` (not `window`);
  the hero ignores reduced-motion; the demo spin / reveal is free (no login). Film motion
  frame-by-frame — the live reveal is already captured in `docs/research/openpack-live/`.
- **Backend is intentional:** Medusa/Mercur, **not** the live's Shopify/Supabase. Web3
  (Privy/Ethers), TalkJS chat, and analytics pixels are **out of scope** (visual clone).

## Already done — DO NOT redo (committed on `clone/phygitals-v2`)
- **P1** `/claw`: per-card `− 1 + MAX` stepper; `Open` → the pack **detail** page (free demo spin,
  no login wall — only a real open/claim is auth-gated).
- **P2** `/claw` parity: dynamic buyback **+90 / +92%**, **Dragon Ball** chip + empty state,
  **out-of-stock** tiles (new backend `in_stock` + `buyback_percent` fields, `Migration20260609112655`,
  reseeded Black/Diamond/Trainer), per-category **horizontal carousel**.
- **Pack-open reveal:** **tap-to-advance** (no forced ~3s wait) + "Tap to continue" hint. The reveal
  **already matches the live structure** (cylinder → slab → metadata → pull → card); the open item is
  Framer-Motion-grade *motion*, not structure.
- Browser-QA `scripts/qa-claw-changes.mjs` = **14/14**, 0 console/network errors.

## Research artifacts (`docs/research/`)
- `TECH_STACK_ANALYSIS.md` — live stack vs clone + the Framer Motion recommendation.
- `LIVE_QA_GAP_REPORT.md` — full live-vs-clone gap analysis (missing / incomplete / not-gaps).
- `PAGE_TOPOLOGY.md`, `BEHAVIORS.md`, `components/*.spec.md` — measured per-page/section specs.
- `openpack-live/` — frame-by-frame live pack-opening reveal (+ `reveal-text.json`, `recon*.json`).
- `route-qa/`, `audit/`, `gap/`, `pixelmatch/` — comparison screenshots.

## Environment / gotchas
- **Storefront** (npm, repo root): `npm run build` → `npx next start -p 4000`; `npm run check` = lint+typecheck+build.
- **Backend** (corepack yarn, `backend/`): build from the **backend ROOT** — `corepack yarn build` (turbo, builds
  api + apps/admin + apps/vendor together), **not** `medusa build` from `packages/api` alone. Restart: kill the
  `:9000` PID, then `corepack yarn start` from `packages/api`. Migrations: `corepack yarn medusa db:generate <module>`
  + `db:migrate`; reseed `corepack yarn seed` (idempotent by slug — only adds new slugs).
- **`medusa start` gotcha:** the bundled `/app` admin is **disabled** in `medusa-config.ts` (Mercur serves its own
  `/dashboard` + `/seller`; the bundled admin's start-time `index.html` requirement blocked boot after a rebuild).
  See `backend/.claude/lessons.md`.
- **Runaway node:** check `@(Get-Process node).Count`; kill all with `Get-Process node | Stop-Process -Force`.
- Servers: storefront **:4000**, backend **:9000** (restart if down).

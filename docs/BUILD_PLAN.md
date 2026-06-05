# Phygitals-Style Marketplace — Build Plan

> A pixel-faithful front-end (cloned from phygitals.com for UI/UX study) wired to **your own**
> Medusa v2 commerce backend, with a custom pack-opening (gacha) system and real-time live-pull feeds.
>
> **Status:** PLAN — nothing scaffolded yet. Review and approve before Phase 0 begins.
> **Last updated:** 2026-05-30

---

## 0. Scope, intent & ground rules

**What this project is:** a learning/portfolio build. We are reconstructing the *look and feel* of
phygitals.com and pairing it with an original, self-built backend (Medusa + custom modules) running
on **mock/seed data**. This is your own product built on open-source foundations.

**What this project is NOT:**
- Not a copy of phygitals' real backend, inventory, or data (impossible — none of that is public).
- Not a deployable look-alike of their auth/checkout meant to impersonate them or handle real users'
  money. We build our *own* auth/payments against test keys (Stripe test mode), never a replica of theirs.
- Not their brand/logo/trademarked content in any shipped/deployed form. Cloned text & assets are
  scaffolding/reference during development; real launch content must be original.

**Hard rules baked into every phase:**
- Stripe stays in **test mode** until/unless this becomes a real, owned, legally-cleared product.
- No real user data. All accounts, cards, packs, pulls are seeded/fake.
- Every build step must compile (`tsc --noEmit`) and the app must run before moving on.

---

## 1. Architecture overview

```
┌────────────────────────────────┐   REST/Store API + publishable key   ┌─────────────────────────────┐
│  Storefront (Next.js 16 +      │  ──────────────────────────────────▶ │  Medusa v2 backend          │
│  React 19 + Tailwind v4 +      │   NEXT_PUBLIC_MEDUSA_BACKEND_URL      │  ├─ Core: products, orders, │
│  shadcn) — phygitals UI clone  │   :9000                              │  │   inventory, payments,    │
│                                │ ◀──────────────────────────────────  │  │   customers, auth         │
│                                │        cart / order / pull responses  │  ├─ Admin dashboard (built-in)│
└───────────────┬────────────────┘                                      │  └─ CUSTOM "Packs" module   │
                │                                                        │      (cards, odds, pull wf) │
                │ subscribe (live pulls, leaderboard)                    └──────────────┬──────────────┘
                ▼                                                                       │ emits events
┌────────────────────────────────┐   realtime stream                                    │
│  Supabase (Realtime + Postgres │ ◀────────────────────────────────────────────────────┘
│  mirror for feed/leaderboard)  │   pull events fan out to all connected clients
└────────────────────────────────┘
```

**All on DigitalOcean App Platform (one platform, no Docker):**
1. **Medusa backend** (`/backend`) — DO **web** component (API) + **worker** component. Commerce + gacha
   module + admin. Connects to DO Managed Postgres + DO Managed Valkey (private networking).
2. **Storefront** (`/storefront`) — the cloned phygitals Next.js frontend, calls Medusa's Store API.
   Another **web** component in the same DO app.
3. **Realtime** — a small **Socket.io** layer inside the Medusa backend pushes `pack.opened` events to
   browsers for the live-pulls feed + leaderboard (replaces the earlier Supabase Realtime choice).

> ⚠️ **Medusa's backend canNOT run on Vercel serverless** — it needs a persistent Node server (+ worker,
> min 2GB RAM). DO App Platform's web/worker components handle this natively.
> **No Docker needed even locally:** run Medusa + storefront as plain Node processes pointed at the DO
> managed databases (or a local Postgres/Redis if you prefer offline dev).

> The Medusa **Next.js *starter*** is used as a **reference implementation** for *how* to call the Store
> API (cart, checkout, customer flows) — we copy patterns from it, but ship the phygitals-cloned UI.

---

## 2. Tech stack & pinned versions

| Layer | Choice | Version / note |
|---|---|---|
| Runtime | Node.js | **24.14.0** — satisfies Medusa (`<25`) AND cloner template (`24+`). Do NOT upgrade to 25. |
| Backend | Medusa | v2.14.0+ |
| Backend DB | **DO Managed Postgres** | managed Postgres on DigitalOcean (same platform as everything else) |
| Backend cache/events | **DO Managed Valkey** | Redis-compatible; powers Medusa event bus, workflow engine, cache |
| Backend host | **DO App Platform** | **web** component (API) + **worker** component (background jobs). Min 2GB RAM. |
| Storefront | Next.js / React / Tailwind | 16 / 19 / v4 (from cloner template) |
| Storefront host | **DO App Platform** | Next.js as another web component in the same DO app |
| UI components | shadcn/ui | as in template |
| Payments | Stripe | **test mode** |
| Realtime | **Socket.io** (in backend) | small WebSocket service pushing `pack.opened` → live feed/leaderboard (no Supabase) |
| Image storage | **DO Spaces** | S3-compatible object storage on DigitalOcean |
| Pkg manager | npm | 11.x |
| Local dev | no Docker | run Medusa + storefront locally as Node processes → DO managed PG + Valkey (or local PG/Redis if preferred) |

> **Everything on one platform: DigitalOcean App Platform** — backend (web), worker, Postgres, Valkey,
> storefront, and Spaces. One bill, one dashboard, private networking between components.

---

## 3. Repository / directory layout

```
phygitals-clone/
├── docs/
│   ├── BUILD_PLAN.md              ← this file
│   ├── research/                  ← cloner output: per-page extraction artifacts
│   └── design-references/         ← cloner output: screenshots
├── backend/                       ← Medusa v2 app (create-medusa-app)
│   └── src/
│       ├── modules/packs/         ← CUSTOM gacha module (models, service)
│       ├── workflows/open-pack/   ← weighted-pull workflow w/ rollback
│       ├── api/                   ← custom Store + Admin routes for packs
│       ├── admin/widgets/         ← admin UI: edit pull odds
│       └── subscribers/           ← on pull → push event to Supabase
└── storefront/                    ← cloned phygitals frontend (Next.js)
    └── src/...                    ← from ai-website-cloner-template, rewired to Medusa
```

> Decision to confirm: **monorepo** (above, one folder) vs **two sibling repos**. Plan assumes monorepo
> for simplicity; not a Turborepo — just two npm apps side by side.

---

## 4. Data model — the custom "Packs" (gacha) module

Built as a Medusa custom module so it auto-gets migrations, CRUD, and container access to core modules.

```
Pack
  id, title, slug, price (→ links to a Medusa product/variant for checkout)
  category (pokemon | basketball | football | onepiece | baseball | yugioh)
  image, status (active/draft)
  ── has many ──▶ PackOdds

PackOdds  (the gacha table — admin-editable)
  id, pack_id (FK)
  card_id (FK → Card)
  weight        ← relative probability (e.g. 1000 = common, 1 = chase)
  // pull chance = weight / sum(weights in pack)

Card
  id, name, set, grader (PSA | Fanatics | Alt), grade, rarity
  image, market_value
  ── links to ──▶ Medusa Inventory item (vault custody / stock)

Pull   (ledger — one row per opened pack)
  id, customer_id, pack_id, card_id (result), rolled_at, order_id
  // source of truth for the live-pulls feed + leaderboard
```

**Provably-fair note:** real phygitals advertises *provably fair* odds (commit-reveal / on-chain seed).
For the clone we implement a simpler **server-side seeded RNG with an auditable Pull ledger**. A true
commit-reveal scheme is an optional later enhancement, documented but not required for v1.

---

## 5. The pack-opening workflow (gacha core)

`open-pack` workflow steps (each with rollback):
1. **Validate** — customer authenticated, pack active, customer has paid / has credit.
2. **Charge** — create a Medusa order for the pack price (Stripe test) OR debit balance.
3. **Roll** — load `PackOdds` for the pack, compute weighted random pick (seeded), select `card_id`.
4. **Allocate inventory** — reserve/decrement the won card's inventory item.
5. **Record** — write a `Pull` ledger row (customer, pack, card, order).
6. **Emit event** — `pack.opened` → subscriber pushes to Supabase Realtime (feed + leaderboard).

If any step fails, prior steps roll back (no orphaned charge, no lost card). This is exactly what
Medusa workflows are built for.

---

## 6. Admin experience (content + odds management)

Inherited from Medusa admin dashboard (no code): products, inventory, orders, customers, refunds.

Custom additions we build:
- **Admin UI route** `/app/packs` — list/create/edit packs.
- **Admin widget** on the pack page — a table to edit each card's `weight`, with a live-computed
  "pull chance %" column so the admin sees real probabilities as they tune.
- Validation: weights must be ≥ 0; show warning if a pack has no cards / total weight 0.

This is the answer to your earlier question — **yes, an admin manages items AND configures pull rates**,
through a real dashboard page, no code.

---

## 7. Real-time feeds (Supabase)

- A **Socket.io** server runs inside the Medusa backend (or as a tiny sibling service).
- Medusa **subscriber** on `pack.opened` emits the pull to a Socket.io room/channel.
- Storefront connects via Socket.io client → homepage "Live Pulls" feed updates instantly.
- **Leaderboard** = aggregation query over the `Pull` ledger (top pullers / rarest cards), refreshed on
  each new pull event (or polled). Cached in Valkey for cheap reads.

Why Socket.io: keeps **everything on one platform (DO)** with no extra realtime provider. Trade-off vs
the earlier Supabase Realtime option = ~a day of WebSocket plumbing instead of zero-code subscriptions.

---

## 8. Front-end cloning plan (page by page)

Driven by the `clone-website` skill + Chrome MCP. Order = simplest/most-static first.

| # | Page | Route | Notes / dynamic bits |
|---|---|---|---|
| 1 | Home | `/` | Hero, pack categories, **live-pulls feed** (wire to Supabase), 3-step, footer |
| 2 | How it works | `/how-it-works` | Static content — easiest, good warm-up |
| 3 | About | `/about` | Static content |
| 4 | Marketplace | `/marketplace` | Grid of listings → Medusa products (mock/seed) |
| 5 | Leaderboard | `/leaderboard` | Table → Supabase aggregation |
| 6 | Packs / Claw | `/claw` | Pack-opening **animation/UI** → `open-pack` workflow + reveal |
| 7 | Pack Party | `/pack-party` | Group/live opening — assess after core is up |
| 8 | Auth | login/signup | Our **own** Medusa auth, NOT a visual replica of theirs |

For templated/dynamic detail pages (individual card, individual pack), clone **one template each**,
then populate from backend data — not every URL.

---

## 9. Phased milestones

Each phase ends with a concrete, verifiable deliverable. We stop and confirm between phases.
**Build order: FRONTEND FIRST** (per decision) — get the UI cloned and running before backend work.

**Phase 0 — Storefront scaffold & verify it runs**
- Place the `ai-website-cloner-template` into `/storefront` (monorepo). Confirm Node 24.x.
- Run the base template locally (`npm run dev`) and confirm it serves a page.
- ✅ Done when: the base Next.js storefront runs at `localhost:3000`.

**Phase 1 — Clone the homepage (+ verify)**
- Use the `clone-website` skill + Chrome MCP to clone `https://www.phygitals.com/` homepage.
- Extract assets, CSS, content; build sections; assemble `page.tsx`. Live-pulls feed = static mock for now.
- ✅ Done when: cloned homepage runs locally and visually matches the original at 1440 + 390px.

**Phase 2 — Clone remaining static pages**
- How-it-works, About (easy), then Marketplace + Leaderboard shells (mock data), Claw UI.
- ✅ Done when: pages run and match reference screenshots; all on mock data.

**Phase 3 — Backend scaffold (no Docker)**
- Create DO Managed Postgres + Valkey (or local for dev), Stripe test keys.
- `create-medusa-app` into `/backend`; backend + admin run at `:9000` / `:9000/app`.
- ✅ Done when: admin dashboard loads, can log in, seed data visible.

**Phase 4 — Wire storefront → Medusa**
- Point the cloned storefront at the Medusa Store API; replace mock data with real products/listings.
- ✅ Done when: marketplace/home render real Medusa data.

**Phase 5 — Packs/gacha module**
- Build `packs` module (models + service), `open-pack` workflow, Store/Admin API routes.
- Admin odds-editing page + widget. Wire claw page → open-pack → reveal animation.
- ✅ Done when: admin sets odds; a user opens a pack in the UI and sees the weighted result; Pull ledger writes.

**Phase 6 — Realtime feeds (Socket.io)**
- Socket.io in backend; subscriber on `pack.opened`; wire home live-feed + leaderboard.
- ✅ Done when: opening a pack updates the live feed in another browser tab.

**Phase 7 — Polish & QA**
- Visual QA diff vs original (per cloner skill Phase 5), responsive pass, seed realistic demo data.
- ✅ Done when: side-by-side matches, all flows work on seed data.

---

## 10. Prerequisites checklist (before Phase 0)

**For Phase 0–2 (frontend, what we're doing now): nothing external needed** — just Node 24.x (have it).

Needed later, at the backend phases (Phase 3+):
- [ ] **No Docker needed.** ✅
- [ ] **DigitalOcean** account → App Platform, Managed Postgres, Managed Valkey, Spaces
- [ ] **Stripe** account + **test** API keys
- [ ] Layout: **monorepo** (confirmed ✅)
- [ ] Keep Node pinned at 24.x (do not move to 25)

---

## 11. Risks & open questions

| Risk / question | Mitigation / decision needed |
|---|---|
| "Provably fair" is on-chain on the real site | v1 uses seeded server RNG + audit ledger; on-chain is optional later |
| Pack Party (live group opening) is complex realtime | Defer to after core (Phase 7+), assess then |
| Cloning auth UI could resemble phishing | We build our OWN auth flow, not a visual replica of theirs |
| Medusa is a multi-week backend to learn | Phased plan; each phase independently runnable |
| **Medusa backend can't run on Vercel** | Hosting is **DO App Platform** (web + worker components handle persistent Node) |
| DO managed DB add-ons add fixed cost | ~$15/mo each for Postgres + Valkey; fine for this project, note for budgeting |
| Realtime now needs custom Socket.io | ~1 day of WebSocket plumbing (vs zero-code Supabase) — accepted trade for one-platform hosting |
| Cloning against no backend yet | Frontend-first build uses **mock data**; swap to Medusa data in Phase 4 |
| Storefront needs rewrite to use Medusa API | Use Medusa's Next.js starter as the API-call reference (Phase 4) |

---

## 12. Immediate next step (on approval)

Begin **Phase 0**: place the cloner template into `/storefront`, verify the base Next.js app runs
locally, then **Phase 1** — run the `clone-website` skill against the phygitals homepage and confirm the
clone renders. No external accounts needed until the backend phases.

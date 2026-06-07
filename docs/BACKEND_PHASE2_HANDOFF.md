# Handoff — Medusa/Mercur backend, Phase 2 (Catalog)

> **Date:** 2026-06-07 · **Branch:** `feat/backend-medusa-mercur` · **Last commit:** `bbb864b`
> **Purpose:** resume the backend wiring at Phase 2 with full context. Read this top-to-bottom,
> then run the "Resume checklist" before writing code. The roadmap is `docs/BUILD_PLAN.md`
> (its top **Addendum** reconciles the plan with the Mercur pivot — read that first).

---

## TL;DR — where we are
- Backend is **Mercur v2** (multi-vendor marketplace on Medusa v2), a yarn 4.5 + turbo monorepo
  under `backend/` (`packages/api` = `@acme/api` server; `apps/admin` @ `/dashboard`;
  `apps/vendor` @ `/seller`). This **reverses** BUILD_PLAN's original plain-Medusa choice.
- **Phase 0 (boot): DONE & verified.** **Phase 1 (marketplace data seam): DONE & committed** (`bbb864b`).
- **Phase 2 (catalog): PLANNED, awaiting "proceed".** The full plan + recommended defaults are below.
- `npm run check` is **green** (lint 0 errors / typecheck / build).

## Resume checklist (run these first)
1. **Containers up?** `docker ps` → expect `pokenic-postgres` (PG16, :5432) + `pokenic-redis` (R7, :6379).
2. **Backend booting?** A dev server may still be running on :9000 from the prior session —
   `curl http://localhost:9000/health` (expect `OK`). If down: `cd backend && corepack yarn dev`
   (or `backend/packages/api` for the API alone). Node ≥20 (24.14.0 pinned); `yarn` via corepack.
3. **Store API sanity:** `GET http://localhost:9000/store/products` with header
   `x-publishable-api-key: pk_a23d4482ee6673a760097f3d013aab59679ceaebab54f987638cbeeb0132863c`
   → currently **200 but `count: 0`** (that's the Phase 2 problem — see Finding below).
4. **Storefront verify port:** `:3000` is occupied by an unrelated `open-webui` container —
   verify the storefront on **:4000** (`npm run build && npx next start -p 4000`), per CLAUDE.md.
   Watch node-process count (`@(Get-Process node).Count`); kill runaways with
   `Get-Process node | Stop-Process -Force`.

## Environment facts (verified 2026-06-07)
- DB: `postgres://medusa:medusa@localhost:5432/medusa` (in `backend/packages/api/.env`). 180 tables.
- Publishable key id `apk_01KTDZ12Z5JSH46VW4NES53DCZ`, token `pk_a23d…0132863c`, linked to sales
  channel `sc_01KTDZ12Y43MY18ZAKNC6V0QDB`; token already in root `.env.local`.
- 1 admin user, 1 region ("Europe", eur default + usd), 4 **demo** apparel products
  (T-Shirt/Sweatshirt/Sweatpants/Shorts) from the default Medusa seed.
- Secrets are still `supersecret` (fine for local-only dev).

## What's committed in `bbb864b` (Phase 1 seam)
- `src/lib/data/products.ts` (NEW) — `getMarketplaceCards()` / `getMarketplaceCategories()` return
  the **static** cloned catalog today; designed to flip to the SDK in one place.
- `src/app/marketplace/page.tsx` — server component, calls the getters, passes `cards`/`categories` props.
- `src/app/marketplace/MarketplaceClient.tsx` — consumes props (inline data removed); empty-list guard; named props type.
- `docs/BUILD_PLAN.md` — Mercur-pivot addendum.
- (Uncommitted, separate: a localized `eslint-disable` in `.claude/skills/strategic-compact/suggest-compact.js`
  to clear a pre-existing CJS `require()` lint error — vendored tooling, not app code.)

---

## ★ Verified Phase 2 findings (do NOT re-derive — confirmed from source + DB)

**Root cause of `count: 0`:** Mercur's `GET /store/products` middleware
`applyVisibleSellerIdsFilter` (`backend/packages/api/node_modules/@mercurjs/core/.medusa/server/src/api/store/products/middlewares.js`)
only surfaces products linked to a **seller whose `status === "open"`** (and not in a closure
window). The 4 demo products have **0** rows in `product_product_seller_seller` → invisible,
*despite* being published + in the key's sales channel + priced. **⇒ Option B (a "house" seller)
is REQUIRED, not optional.**

**Seller creation (seed):** module key `MercurModules.SELLER` (`"seller"`).
```ts
import { MercurModules, SellerStatus } from "@mercurjs/types"
const sellerService = container.resolve(MercurModules.SELLER)
// guard: listSellers({ handle: "house" }) — email/name/handle are unique
const [seller] = await sellerService.createSellers([{
  name: "House", handle: "house", email: "house@pokenic.local",
  currency_code: "usd", status: SellerStatus.OPEN /* "open" — pending_approval is invisible */,
  metadata: { house: true },
}])
```
No member / stock-location / sales-channel association required just to be store-visible.

**Seller-owned product (seed):** call **core** `createProductsWorkflow` with
`additional_data.seller_id`; Mercur's `productsCreated` hook
(`@mercurjs/core/.../workflows/hooks/product-created.js`) auto-creates the `product_seller` link
(and inventory-item→seller links). Keep all standard fields the demo seed sets.
```ts
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
await createProductsWorkflow(container).run({
  input: {
    products: [{ /* title, handle, status: PUBLISHED, shipping_profile_id,
                    sales_channels:[{id: defaultSalesChannel}], options, variants(+usd prices),
                    images:[{url:"/cdn/cards/<id>.webp"}], metadata:{ fmv, points, grade, grader, set, rarity } */ }],
    additional_data: { seller_id: seller.id },
  },
})
```
Then create inventory levels at the stock location (as the demo seed already does).

**metadata read-back gotcha:** `metadata` is NOT in `defaultStoreProductFields`. The storefront MUST
request it: `GET /store/products?currency_code=usd&fields=*variants.calculated_price,+metadata`
(currency/region context is also required or `calculated_price` is absent).

---

## Phase 2 plan (presented, awaiting "proceed")

**Goal:** fix `count: 0` by seeding our 16 cards as a house seller's products, then flip the seam to the SDK.

**Tasks** (each ends green — backend boots + `npm run check`):
1. House seller in `backend/packages/api/src/scripts/seed.ts` (status open, guarded). Verify: `seller` has 1 open row.
2. Card dataset for the seed (16 cards: title/price/fmv/points/grade/grader/set/rarity/image/handle).
   **Source of truth = the seed** (storefront can't import backend; the storefront's static `CARDS`
   becomes dead once the getters hit the SDK).
3. Seed 16 cards as seller products (additional_data.seller_id; PUBLISHED; key's sales channel; USD
   decimal prices; metadata; local `/cdn/cards/*.webp`; `handle` = existing slug; inventory levels).
   Verify: `product_product_seller_seller` = 16; `/store/products?fields=+metadata&currency_code=usd` → 16 with prices+metadata.
4. Flip `getMarketplaceCards()` → `sdk.store.product.list({ currency_code:"usd", fields:"+metadata,*variants.calculated_price" })`
   → map to `MarketplaceCard` (price from `calculated_price`, fmv/points from metadata, image from thumbnail).
   Make `marketplace/page.tsx` async. Verify: marketplace renders 16 real cards; **Playwright screenshot vs. current** on :4000.
5. Fold `card/[id]` → `getCardById(handle)` (SDK retrieve by handle, **fallback to existing
   `cardOrGeneric` mock** for non-seeded slugs so all links survive). `generateStaticParams` from product list.
6. `src/app/marketplace/loading.tsx`; final `npm run check`; re-run seed to confirm idempotent.

**Files:** `backend/packages/api/src/scripts/seed.ts` (UPDATE — add house seller + cards, replace demo
apparel block); `src/lib/data/products.ts` (UPDATE — async SDK + map; add `getCardById`; remove static
`CARDS`); `src/app/marketplace/page.tsx` (UPDATE — async); `src/app/marketplace/loading.tsx` (CREATE);
`src/app/card/[id]/page.tsx` (UPDATE — seam + fallback).

**4 decisions (recommended defaults):**
1. Card dataset source of truth → **the seed (backend)**. *(Alt: shared JSON — unnecessary.)*
2. Categories **stay static** this phase (tab icons are local assets; all demo cards are Pokémon).
3. `card/[id]` **included with mock fallback** (vs. defer again).
4. Demo apparel products → **purge** the 4 for a clean catalog (they're invisible anyway).

**Risks:** `+metadata`/currency context required (above); seed.ts is a Mercur "starter contract
surface" (extend deliberately, keep idempotent); seed `handle` = slug so `/card/<slug>` links work;
guard seller/products by handle for re-run safety.

**Commands:** seed = `cd backend/packages/api && corepack yarn seed` (`medusa exec ./src/scripts/seed.ts`);
storefront gate = `npm run check`; storefront visual = `npm run build && npx next start -p 4000` + a `scripts/*.mjs` Playwright screenshot.

---

## How to start in the new chat
Say: **"Read docs/BACKEND_PHASE2_HANDOFF.md and proceed with Phase 2 (take the 4 recommended defaults)."**
Project memory (`medusa-mercur-backend-state`) also auto-loads the backend state. Re-verify the
Resume checklist (the prior session's :9000 dev server may not be running anymore).

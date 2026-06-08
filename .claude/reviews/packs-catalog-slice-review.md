# Code Review: Packs catalog slice (Phase 4)

**Reviewed**: 2026-06-08
**Author**: elstonyth
**Branch**: feat/backend-medusa-mercur (uncommitted)
**Decision**: APPROVE with comments

## Summary

Wires the `/claw` pack listing and the home "Open Packs" tiles to a new custom
Medusa module (`packs`) + custom store route `GET /store/packs`. The backend is a
minimal catalog model (Pack) with idempotent seed of 21 packs; the storefront
reads from the backend with a graceful static-mock fallback. Server/client split
(`ClawPage` server → `ClawClient` client), deep-link validation via
`searchParams.category`, and the join-key chain
(OpenPacksSection key === backend `category` === `MOCK_CATEGORIES.id` === tab id)
are all correct. No CRITICAL or HIGH issues. Four LOW operational notes; none
blocking.

## Security posture (affirmed)

`searchParams.category` is safe: the raw string is only compared via `.some()`
against known category ids, and `initialCategory` is assigned only when it matches
a known value or defaults to `"all"`. It is never reflected into URLs, rendered
into HTML, or used as a DB filter, so there is no injection surface here.

The store route exposes public catalog data filtered to `{ status: "active" }` and
is consistent with `/store/products` in access level. Draft packs are hidden.
Neither route nor response leaks sensitive fields.

## Findings

### CRITICAL
None.

### HIGH
None.

### MEDIUM

**M1 — `sdk.client.fetch` response is cast, not validated (`src/lib/data/packs.ts:56`)**

```ts
const { packs } = await sdk.client.fetch<{ packs: BackendPack[] }>("/store/packs");
```

`fetch<T>` is a TypeScript type assertion, not a runtime guard. The project's
`coding-style.md` rule is "never trust external data (API responses)." If the
backend returns an unexpected shape (e.g., a field renamed in Phase 5), the
storefront silently degrades: a missing `category` is dropped (packs disappear
from the UI), a missing/null `price` renders `"$NaN"` rather than throwing. The
graceful fallback (`return MOCK_CATEGORIES` on any exception) catches hard throws
but not silent mismatches.

**Fix**: add a lightweight runtime guard or Zod shape-check on `packs` before
handing it to `toPack`. A minimal guard that prevents `"$NaN"`:

```ts
if (!packs?.length || !Array.isArray(packs)) return MOCK_CATEGORIES;
// optionally: packs.filter(p => typeof p.category === "string" && typeof p.price === "number")
```

Severity is MEDIUM (not HIGH) because: (a) the backend is under our control,
(b) schema-mismatches would surface in typecheck during Phase 5 wiring, and
(c) the page degrades rather than crashing.

### LOW

**L1 — Seed is create-only; updates are a no-op for existing rows**

`seed.ts` (pack block, ~line 1031–1057) keys idempotency on slug existence and
skips any slug already in the DB. Editing a pack's `price`, `image`, `title`, or
`boost` in `PACK_SEED_GROUPS` and re-running `seed` will not update the stored
row. This is fine for Phase 4 (catalog is stable), but becomes a footgun in Phase
5 when pack metadata is expected to change. Note and handle at Phase 5: either
switch to upsert (`createOrUpdate`) or add an update pass alongside the create.

**L2 — No explicit `take` on `listPacks` calls (future page-size footgun)**

`route.ts:17` and `seed.ts` (existence check) both call `listPacks` without a
`take` argument. Currently harmless: the Playwright capture confirms 21 "Open"
buttons returned, so no default cap is truncating results. However, if the Medusa
framework or Mercur introduces a default page size below the pack count in a
future upgrade, packs would silently disappear. Future-proof by adding
`{ take: 500 }` (or the Medusa "no-limit" sentinel) to both call sites with a
comment.

**L3 — New backend categories not in `MOCK_CATEGORIES` are silently dropped**

`packs.ts:71-74` merges backend packs into categories by iterating `MOCK_CATEGORIES`.
A new category added to the backend seed with no matching entry in the storefront
mock will be silently omitted from the grid. This is partly by design (presentational
meta — tabs, headings, icons — is local), but there is no code-level warning when
a backend category has no storefront counterpart. Low operational risk now (the 8
categories are stable), but worth calling out as a coupling-to-watch: adding a
backend category requires a co-ordinated storefront change to `packs-data.ts`.

**L4 — `price` stored as `integer` in the migration**

`models/pack.ts:22` uses `model.number()`, which MikroORM maps to `integer not null`
in the migration. Whole-dollar pricing is correct for the current catalog and is
stated in the seed comment. If fractional prices are needed in a future phase
(e.g., $9.99), the column type would need a migration to `numeric`/`float`. Note
for Phase 5 when pack pricing is wired to checkout.

## Validation Results

| Check | Result |
|---|---|
| Type check (`npm run typecheck`) | Pass |
| Lint (`npm run lint`) | Pass (0 errors) |
| Build (`npm run build`) | Pass (`/claw` → ƒ Dynamic, `/` → static) |
| Playwright `scripts/capture-claw.mjs` — 21 Open buttons (`claw_openButtons`) | Pass |
| Playwright — One Piece deep link tab active (`onepiece_activeTab = "One Piece"`) | Pass |
| Playwright — Yu-Gi-Oh! deep link tab active (`yugioh_activeTab = "Yu-Gi-Oh!"`) | Pass |
| Playwright — unknown category → All Packs fallback (`unknown_activeTab = "All Packs"`) | Pass |
| Playwright — home `OpenPacksSection` 6 tiles href to `/claw?category=<key>` | Pass |

## Files Reviewed

**Backend (`backend/packages/api/`)**
- `medusa-config.ts` — Modified (registers `./src/modules/packs`)
- `src/modules/packs/models/pack.ts` — Added (Pack model: id, slug unique, title, category, price, image, boost, rank, status enum)
- `src/modules/packs/service.ts` — Added (MedusaService factory; auto-generates CRUD)
- `src/modules/packs/index.ts` — Added (Module registration, `PACKS_MODULE` export)
- `src/modules/packs/migrations/Migration20260608035226.ts` — Added (generated; DDL correct, partial unique index on slug WHERE deleted_at IS NULL)
- `src/api/store/packs/route.ts` — Added (GET /store/packs; status=active filter; category+rank order)
- `src/scripts/seed.ts` — Modified (PACK_SEED_GROUPS + PACK_SEED constants + pack seed block + duplicate-slug guard)

**Storefront (`src/`)**
- `src/lib/data/packs.ts` — Added (getPackCategories; fetch+group+fallback; BackendPack interface; formatPrice)
- `src/app/claw/page.tsx` — Modified (server component; Promise.all for searchParams+categories; initialCategory validation)
- `src/app/claw/ClawClient.tsx` — Added (extracted from old page.tsx; accepts categories+initialCategory props; PackCard + PackRow + chip rail)
- `src/components/OpenPacksSection.tsx` — Modified (tile hrefs updated from /claw/<slug> to /claw?category=<key>)

**QA script**
- `scripts/capture-claw.mjs` — Added (Playwright: grid, section headings, deep-link tabs, unknown-category fallback, home hrefs)

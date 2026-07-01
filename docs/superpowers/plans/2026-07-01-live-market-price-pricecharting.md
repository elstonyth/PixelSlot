# Live Market Price (PriceCharting) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin create a card by searching PriceCharting, and have that card auto-track its grade's live value daily; customers see the value converted to MYR and marked up 20%, while internal money math stays on the raw USD value.

**Architecture:** Add PriceCharting linkage + a per-card display multiplier to the `Card` model. A daily job refreshes each linked card's raw USD `market_value` from PriceCharting and refreshes a cached USD→MYR FX rate. The customer-facing price is **computed on read** as `market_value × fx × multiplier` (MYR); `market_value` itself stays raw so buyback/RTP are unaffected. Admin sees raw + markup + margin.

**Tech Stack:** Medusa v2 / Mercur backend (`backend/packages/api`, TypeScript, jest), Vite + React + React Query + `@medusajs/ui` admin (`backend/apps/admin`), Next.js 16 storefront (`src/`). Package managers: `npm` at repo root, `corepack yarn` inside `backend/`.

## Global Constraints

- **Currency:** internal `Card.market_value` is a **raw USD decimal** (bigNumber). Display MYR = `market_value × fx × multiplier`. FX + markup are **display-only**, never written back to `market_value`.
- **Default multiplier:** `1.20`, per-card, editable; pre-filled on create and edit.
- **Refresh cadence:** daily job only. PriceCharting API hard limit **1 request/second** — the job must throttle to ≤1 req/sec.
- **Guardrails:** if PriceCharting or FX returns null/zero/error, **keep the last-known value** — never zero out a price; never crash the batch on one bad card; log every change.
- **Secret:** `PRICECHARTING_API_TOKEN` is read server-side only (existing proxy); never expose to browser; never commit the value.
- **Grade model:** one card = one grade. Product `handle` is unique and equals the card key, so two grades of the same card need **distinct handles** (`slug(name-grader-grade)`).
- **Money-path rule:** commission/VIP/pricing backend changes run `test:integration:http` (from `backend/packages/api`: `corepack yarn test:integration:http`), not just unit — see the repo money-path memory.
- **Verification:** the repo Stop hook type-checks storefront + backend and blocks on real type errors. Presentational/UI work is verified with Playwright/manual capture, not brittle unit assertions (repo `testing.md`).

---

## File Structure

**Backend — new files**
- `backend/packages/api/src/modules/packs/pricecharting-grades.ts` — shared grade-label ⇄ PriceCharting price-field mapping + `priceFieldForGrade()` + `gradeToGrader()`. (Pure, no Medusa deps.)
- `backend/packages/api/src/modules/packs/pricing.ts` — `displayMarketPrice()`, `effectiveRate()`, `DEFAULT_USD_MYR`, `fetchUsdMyr()`. (Pure + one fetch fn.)
- `backend/packages/api/src/modules/packs/models/fx-rate.ts` — `FxRate` model (single `USD_MYR` row).
- `backend/packages/api/src/workflows/create-card-from-pricecharting.ts` — workflow: create Product (with image) → `createCardStep`, with compensation.
- `backend/packages/api/src/api/admin/cards/from-pricecharting/route.ts` — `POST` one-step create endpoint.
- `backend/packages/api/src/api/admin/pricing/fx/route.ts` — `GET`/`POST` admin FX rate (read + manual override).
- `backend/packages/api/src/jobs/sync-market-prices.ts` — daily job (FX + per-card refresh).
- Tests under `backend/packages/api/src/**/__tests__/` and `integration-tests/http/`.

**Backend — modified files**
- `src/modules/packs/models/card.ts` — add `pc_product_id`, `pc_grade`, `market_multiplier`, `pc_synced_at`.
- `src/modules/packs/service.ts` — register `FxRate` in the module service.
- `src/modules/packs/index.ts` (module definition) — register the `FxRate` model.
- `src/api/admin/pricecharting/product/route.ts` — import `PRICE_FIELDS` from the new shared module (DRY).
- `src/workflows/steps/create-card.ts` — extend `RegisterCardInput` + Card insert with the 3 new fields.
- `src/workflows/steps/update-card.ts` — extend input + Card update with the 3 new fields.
- `src/api/admin/cards/route.ts` + `src/api/admin/cards/[handle]/route.ts` — accept/return the new fields + admin price breakdown.
- `src/api/store/vault/route.ts` — add `marketPriceMyr` to each item.
- `src/api/store/pulls/recent/route.ts` + `src/api/store/pulls/[id]/reveal/route.ts` — add `marketPriceMyr`.

**Admin UI — modified files**
- `backend/apps/admin/src/lib/admin-rest.ts` — extend Card DTO + add FX + one-step-create helpers.
- `backend/apps/admin/src/lib/queries.ts` + `query-keys.ts` — hooks/keys for FX + one-step create.
- `backend/apps/admin/src/routes/cards/RegisterCardModal.tsx` — structured grade picker, markup field, live preview, persist pc fields, one-step "create product from PriceCharting" path, linked/synced indicator.

**Storefront — modified files**
- `src/lib/actions/vault.ts` — add `marketPriceMyr` to `VaultItem`.
- `src/app/(account)/vault/VaultClient.tsx` — render `marketPriceMyr` instead of raw `marketValue`.
- Pull-reveal component(s) — render `marketPriceMyr`.

---

## Phase 1 — Pricing core (backend, no UI)

### Task 1: Shared grade ⇄ price-field mapping

**Files:**
- Create: `backend/packages/api/src/modules/packs/pricecharting-grades.ts`
- Modify: `backend/packages/api/src/api/admin/pricecharting/product/route.ts` (import `PRICE_FIELDS` from the new module instead of the local const)
- Test: `backend/packages/api/src/modules/packs/__tests__/pricecharting-grades.test.ts`

**Interfaces:**
- Produces: `PRICE_FIELDS` (readonly `[field, label]` tuples), `type PcPriceField`, `priceFieldForGrade(label: string): PcPriceField | null`, `gradeToGrader(label: string): { grader: string; grade: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// pricecharting-grades.test.ts
import { priceFieldForGrade, gradeToGrader, PRICE_FIELDS } from "../pricecharting-grades";

describe("pricecharting-grades", () => {
  test("priceFieldForGrade maps labels to upstream fields", () => {
    expect(priceFieldForGrade("PSA 10")).toBe("manual-only-price");
    expect(priceFieldForGrade("BGS 10")).toBe("bgs-10-price");
    expect(priceFieldForGrade("Ungraded")).toBe("loose-price");
    expect(priceFieldForGrade("nonsense")).toBeNull();
  });

  test("gradeToGrader splits graded tiers, leaves generic grader blank", () => {
    expect(gradeToGrader("PSA 10")).toEqual({ grader: "PSA", grade: "10" });
    expect(gradeToGrader("CGC 10")).toEqual({ grader: "CGC", grade: "10" });
    expect(gradeToGrader("Grade 9.5")).toEqual({ grader: "", grade: "9.5" });
    expect(gradeToGrader("Ungraded")).toEqual({ grader: "", grade: "Ungraded" });
  });

  test("PRICE_FIELDS covers all nine tiers in ascending order", () => {
    expect(PRICE_FIELDS.map(([, label]) => label)).toEqual([
      "Ungraded", "Grade 7", "Grade 8", "Grade 9", "Grade 9.5",
      "PSA 10", "BGS 10", "CGC 10", "SGC 10",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `backend/packages/api`): `corepack yarn test:unit pricecharting-grades`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// pricecharting-grades.ts
// Shared PriceCharting grade mapping. Upstream returns integer pennies in these
// nine fields; labels + order match the admin proxy (product/route.ts) and the
// PriceCharting key table (loose=Ungraded, manual-only=PSA 10, condition-18=SGC 10).
export const PRICE_FIELDS = [
  ["loose-price", "Ungraded"],
  ["cib-price", "Grade 7"],
  ["new-price", "Grade 8"],
  ["graded-price", "Grade 9"],
  ["box-only-price", "Grade 9.5"],
  ["manual-only-price", "PSA 10"],
  ["bgs-10-price", "BGS 10"],
  ["condition-17-price", "CGC 10"],
  ["condition-18-price", "SGC 10"],
] as const;

export type PcPriceField = (typeof PRICE_FIELDS)[number][0];

export function priceFieldForGrade(label: string): PcPriceField | null {
  const hit = PRICE_FIELDS.find(([, l]) => l === label);
  return hit ? hit[0] : null;
}

// Tiers that name a grading company auto-fill grader; generic Grade N tiers set
// only the grade and leave grader for the admin to pick.
export function gradeToGrader(label: string): { grader: string; grade: string } {
  const named = ["PSA", "BGS", "CGC", "SGC"];
  for (const g of named) {
    if (label.startsWith(g + " ")) return { grader: g, grade: label.slice(g.length + 1) };
  }
  if (label.startsWith("Grade ")) return { grader: "", grade: label.slice("Grade ".length) };
  return { grader: "", grade: label }; // "Ungraded"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack yarn test:unit pricecharting-grades`
Expected: PASS (3 tests).

- [ ] **Step 5: Refactor `product/route.ts` to use the shared const**

In `src/api/admin/pricecharting/product/route.ts`, delete the local `PRICE_FIELDS` const and add at the top:

```ts
import { PRICE_FIELDS } from "../../../../modules/packs/pricecharting-grades";
```

(Leave the rest of that route unchanged — it already iterates `PRICE_FIELDS`.)

- [ ] **Step 6: Verify types + commit**

Run: `corepack yarn tsc --noEmit` (backend). Expected: clean.

```bash
git add backend/packages/api/src/modules/packs/pricecharting-grades.ts \
        backend/packages/api/src/modules/packs/__tests__/pricecharting-grades.test.ts \
        backend/packages/api/src/api/admin/pricecharting/product/route.ts
git commit -m "feat(pricing): extract shared PriceCharting grade mapping"
```

---

### Task 2: Display-price + FX helpers

**Files:**
- Create: `backend/packages/api/src/modules/packs/pricing.ts`
- Test: `backend/packages/api/src/modules/packs/__tests__/pricing.test.ts`

**Interfaces:**
- Produces:
  - `DEFAULT_USD_MYR: number` (fallback constant)
  - `displayMarketPrice(marketValueUsd: number, fxUsdMyr: number, multiplier: number): number` — MYR rounded to 2 dp; returns `0` on invalid input.
  - `effectiveRate(row: { rate: number; manual_override: boolean; manual_rate: number | null } | null): number`
  - `fetchUsdMyr(url?: string): Promise<number>` — throws on bad response.
  - `FX_USD_MYR_URL: string`

- [ ] **Step 1: Write the failing test**

```ts
// pricing.test.ts
import { displayMarketPrice, effectiveRate, DEFAULT_USD_MYR } from "../pricing";

describe("displayMarketPrice", () => {
  test("raw × fx × multiplier, rounded to 2dp", () => {
    expect(displayMarketPrice(100, 4.7, 1.2)).toBe(564); // 100*4.7*1.2
    expect(displayMarketPrice(19.99, 4.5, 1.2)).toBe(107.95); // 107.946 -> 107.95
  });
  test("invalid inputs collapse to 0 (never negative / NaN price)", () => {
    expect(displayMarketPrice(-1, 4.7, 1.2)).toBe(0);
    expect(displayMarketPrice(100, 0, 1.2)).toBe(0);
    expect(displayMarketPrice(NaN, 4.7, 1.2)).toBe(0);
  });
});

describe("effectiveRate", () => {
  test("manual override wins when valid", () => {
    expect(effectiveRate({ rate: 4.5, manual_override: true, manual_rate: 4.8 })).toBe(4.8);
  });
  test("falls back to cached rate, then to DEFAULT when unusable", () => {
    expect(effectiveRate({ rate: 4.5, manual_override: false, manual_rate: null })).toBe(4.5);
    expect(effectiveRate({ rate: 0, manual_override: false, manual_rate: null })).toBe(DEFAULT_USD_MYR);
    expect(effectiveRate(null)).toBe(DEFAULT_USD_MYR);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack yarn test:unit pricing`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// pricing.ts
// Display-side pricing. market_value stays raw USD; MYR shown to customers is
// computed here as raw × fx × multiplier. FX + markup never touch market_value.

// Sane fallback if the FX feed has never succeeded and no manual rate is set.
// Auto-refreshed daily; overridable in admin. Ballpark USD→MYR.
export const DEFAULT_USD_MYR = 4.7;

// ECB-derived, no API key, refreshed daily on business days. Override via env.
export const FX_USD_MYR_URL =
  process.env.FX_USD_MYR_URL ?? "https://api.frankfurter.app/latest?from=USD&to=MYR";

export function displayMarketPrice(
  marketValueUsd: number,
  fxUsdMyr: number,
  multiplier: number
): number {
  const raw = Number(marketValueUsd);
  const fx = Number(fxUsdMyr);
  const mult = Number(multiplier);
  if (![raw, fx, mult].every(Number.isFinite) || raw < 0 || fx <= 0 || mult <= 0) return 0;
  return Math.round(raw * fx * mult * 100) / 100;
}

export function effectiveRate(
  row: { rate: number; manual_override: boolean; manual_rate: number | null } | null
): number {
  if (!row) return DEFAULT_USD_MYR;
  if (row.manual_override) {
    const m = Number(row.manual_rate);
    if (Number.isFinite(m) && m > 0) return m;
  }
  const r = Number(row.rate);
  return Number.isFinite(r) && r > 0 ? r : DEFAULT_USD_MYR;
}

export async function fetchUsdMyr(url: string = FX_USD_MYR_URL): Promise<number> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const data = (await resp.json()) as { rates?: { MYR?: number } };
  const rate = data?.rates?.MYR;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("FX feed returned no usable USD->MYR rate");
  }
  return rate;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack yarn test:unit pricing`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/packages/api/src/modules/packs/pricing.ts \
        backend/packages/api/src/modules/packs/__tests__/pricing.test.ts
git commit -m "feat(pricing): display-price + FX resolution helpers"
```

---

### Task 3: `Card` model fields + `FxRate` model + migration

**Files:**
- Modify: `backend/packages/api/src/modules/packs/models/card.ts`
- Create: `backend/packages/api/src/modules/packs/models/fx-rate.ts`
- Modify: `backend/packages/api/src/modules/packs/index.ts` (module model registration) and `service.ts` (service model list)
- Migration: generated under `backend/packages/api/src/modules/packs/migrations/`
- Test: `backend/packages/api/integration-tests/modules/card-fields.spec.ts`

**Interfaces:**
- Produces: `Card.pc_product_id`, `Card.pc_grade`, `Card.market_multiplier`, `Card.pc_synced_at`; `FxRate` with `{ pair, rate, source, fetched_at, manual_override, manual_rate }`.

- [ ] **Step 1: Add fields to `card.ts`**

Append inside the `model.define("card", { ... })` object (after `sprite_image`):

```ts
  // PriceCharting linkage. Set => auto-tracked by the daily job; null => manual.
  pc_product_id: model.text().nullable(),
  // Exact grade-tier label (e.g. "PSA 10") so the job reads the right price field.
  pc_grade: model.text().nullable(),
  // Per-card display markup over market value. Default 1.20 (= +20%). Decimal.
  market_multiplier: model.bigNumber().default(1.2),
  // Last successful PriceCharting refresh (ops/debug; not shown to customers).
  pc_synced_at: model.dateTime().nullable(),
```

- [ ] **Step 2: Create `fx-rate.ts`**

```ts
// fx-rate.ts
import { model } from "@medusajs/framework/utils";

// Single-row cache of the USD->MYR display rate. Refreshed daily; admin can pin
// a manual override. Display prices multiply market_value (USD) by this.
export const FxRate = model.define("fx_rate", {
  id: model.id().primaryKey(),
  pair: model.text().unique(),            // "USD_MYR"
  rate: model.bigNumber(),                // last auto-fetched rate
  source: model.text(),                   // "frankfurter" | "fallback" | "manual"
  fetched_at: model.dateTime().nullable(),
  manual_override: model.boolean().default(false),
  manual_rate: model.bigNumber().nullable(),
});

export default FxRate;
```

- [ ] **Step 3: Register `FxRate` in the module + service**

In `src/modules/packs/index.ts`, add `FxRate` to the model list passed to the module definition (next to `Card`, `Pack`, etc.). In `src/modules/packs/service.ts`, add `FxRate` to the `MedusaService({ ... })` model map so `listFxRates`/`createFxRates`/`updateFxRates` are generated. (Match the exact import/registration style already used for `Card` in those two files.)

- [ ] **Step 4: Generate the migration**

Run (from `backend/packages/api`):
```bash
corepack yarn medusa db:generate packs
```
(If the module is registered under a different key in `medusa-config.ts`, use that key.) Confirm a new file appears in `src/modules/packs/migrations/`.

- [ ] **Step 5: Write the module test**

```ts
// card-fields.spec.ts
import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { PACKS_MODULE } from "../../src/modules/packs";

medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    it("persists PriceCharting linkage fields with default multiplier", async () => {
      const packs = getContainer().resolve(PACKS_MODULE);
      const [card] = await packs.createCards([{
        handle: "charizard-psa-10", name: "Charizard", set: "Base Set",
        grader: "PSA", grade: "10", market_value: 100, image: "https://x/y.png",
        pc_product_id: "6910", pc_grade: "PSA 10",
      }]);
      expect(card.pc_product_id).toBe("6910");
      expect(card.pc_grade).toBe("PSA 10");
      expect(Number(card.market_multiplier)).toBe(1.2);
      expect(card.pc_synced_at).toBeNull();
    });
  },
});
```

- [ ] **Step 6: Run the migration + test**

Run: `corepack yarn medusa db:migrate` then `corepack yarn test:integration:modules card-fields`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/packages/api/src/modules/packs/models/card.ts \
        backend/packages/api/src/modules/packs/models/fx-rate.ts \
        backend/packages/api/src/modules/packs/index.ts \
        backend/packages/api/src/modules/packs/service.ts \
        backend/packages/api/src/modules/packs/migrations/ \
        backend/packages/api/integration-tests/modules/card-fields.spec.ts
git commit -m "feat(pricing): add PriceCharting linkage + FxRate model + migration"
```

---

## Phase 2 — Persist link + expose price (backend)

### Task 4: Persist `pc_*` fields through create/update

**Files:**
- Modify: `src/workflows/steps/create-card.ts` (extend `RegisterCardInput` + Card insert)
- Modify: `src/workflows/steps/update-card.ts` (extend input + Card update)
- Modify: `src/api/admin/cards/route.ts` (POST validation + pass-through)
- Modify: `src/api/admin/cards/[handle]/route.ts` (POST validation + pass-through; GET returns new fields)
- Test: `backend/packages/api/integration-tests/http/cards-pc-link.spec.ts`

**Interfaces:**
- Consumes: `Card` fields from Task 3.
- Produces: `RegisterCardInput` and the update input both gain optional `pc_product_id?: string | null`, `pc_grade?: string | null`, `market_multiplier?: number`.

- [ ] **Step 1: Extend `create-card.ts`**

Add to `RegisterCardInput`:
```ts
  pc_product_id?: string | null;
  pc_grade?: string | null;
  market_multiplier?: number;
```
In the `packs.createCards([{ ... }])` object, add (after `sprite_image`):
```ts
      pc_product_id: input.pc_product_id ?? null,
      pc_grade: input.pc_grade ?? null,
      market_multiplier: input.market_multiplier ?? 1.2,
```

- [ ] **Step 2: Extend `update-card.ts`**

Add the same three optional fields to the update step's input type, and in the `packs.updateCards([{ ... }])` object add:
```ts
      pc_product_id: input.pc_product_id ?? null,
      pc_grade: input.pc_grade ?? null,
      market_multiplier: input.market_multiplier ?? 1.2,
```

- [ ] **Step 3: Extend admin route validation**

In `src/api/admin/cards/route.ts` (POST) and `src/api/admin/cards/[handle]/route.ts` (POST), add the three fields to the request zod/validation schema (optional; `market_multiplier` coerced number defaulting to `1.2`) and pass them into the workflow input. In the `[handle]/route.ts` GET response, include `pc_product_id`, `pc_grade`, `market_multiplier`, `pc_synced_at` on the returned card. (Match the existing schema + response style in those files.)

- [ ] **Step 4: Write the HTTP test**

```ts
// cards-pc-link.spec.ts — register a product as a card WITH pc link, read it back.
// (Use the suite's existing admin-auth + product-fixture helpers.)
it("stores and returns PriceCharting linkage on a registered card", async () => {
  const productId = await createEligibleProduct(); // existing helper
  await api.post("/admin/cards", {
    product_id: productId, set: "Base Set", grader: "PSA", grade: "10",
    market_value: 100, pc_product_id: "6910", pc_grade: "PSA 10", market_multiplier: 1.2,
  }, adminHeaders);

  const { data } = await api.get(`/admin/cards/${handleOf(productId)}`, adminHeaders);
  expect(data.card.pc_product_id).toBe("6910");
  expect(data.card.pc_grade).toBe("PSA 10");
  expect(Number(data.card.market_multiplier)).toBe(1.2);
});
```

- [ ] **Step 5: Run + commit**

Run: `corepack yarn test:integration:http cards-pc-link`
Expected: PASS.
```bash
git add backend/packages/api/src/workflows/steps/create-card.ts \
        backend/packages/api/src/workflows/steps/update-card.ts \
        backend/packages/api/src/api/admin/cards/route.ts \
        backend/packages/api/src/api/admin/cards/[handle]/route.ts \
        backend/packages/api/integration-tests/http/cards-pc-link.spec.ts
git commit -m "feat(pricing): persist PriceCharting link + multiplier on cards"
```

---

### Task 5: One-step create workflow + route

**Files:**
- Create: `src/workflows/create-card-from-pricecharting.ts`
- Create: `src/api/admin/cards/from-pricecharting/route.ts`
- Test: `backend/packages/api/integration-tests/http/cards-from-pc.spec.ts`

**Interfaces:**
- Consumes: `createCardStep` (Task 4 signature), Medusa `createProductsWorkflow`.
- Produces: `POST /admin/cards/from-pricecharting` body `{ pc_product_id, pc_grade, name, set, grader, grade, market_value, image, price?, for_sale?, pokemon_dex?, sprite_image?, market_multiplier? }` → `{ handle, productId }`.

- [ ] **Step 1: Write the workflow**

```ts
// create-card-from-pricecharting.ts
import { createWorkflow, WorkflowResponse, createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { createProductsWorkflow } from "@medusajs/medusa/core-flows";
import { createCardStep } from "./steps/create-card";

export type CreateFromPcInput = {
  pc_product_id: string; pc_grade: string;
  name: string; set: string; grader: string; grade: string;
  market_value: number; image: string;
  price?: number | null; for_sale?: boolean;
  pokemon_dex?: number | null; sprite_image?: string | null;
  market_multiplier?: number;
};

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// Compensatable product-create so a failed card registration rolls the product back.
const createPcProductStep = createStep(
  "create-pc-product",
  async (input: CreateFromPcInput, { container }) => {
    const handle = slug(`${input.name}-${input.grader}-${input.grade}`);
    const { result } = await createProductsWorkflow(container).run({
      input: { products: [{
        title: input.name,
        handle,
        status: input.for_sale === false ? "draft" : "published",
        thumbnail: input.image,
        images: [{ url: input.image }],
        options: [{ title: "Default", values: ["Default"] }],
        variants: [{
          title: "Default", options: { Default: "Default" },
          prices: [{ amount: Math.round((input.price ?? input.market_value) * 100), currency_code: "myr" }],
        }],
      }] },
    });
    const product = result[0];
    return new StepResponse({ productId: product.id, handle }, product.id);
  },
  async (productId, { container }) => {
    if (!productId) return;
    const { deleteProductsWorkflow } = await import("@medusajs/medusa/core-flows");
    await deleteProductsWorkflow(container).run({ input: { ids: [productId] } });
  }
);

export const createCardFromPriceChartingWorkflow = createWorkflow(
  "create-card-from-pricecharting",
  (input: CreateFromPcInput) => {
    const created = createPcProductStep(input);
    const card = createCardStep({
      product_id: created.productId,
      set: input.set, grader: input.grader, grade: input.grade,
      market_value: input.market_value,
      pokemon_dex: input.pokemon_dex ?? null,
      sprite_image: input.sprite_image ?? null,
      pc_product_id: input.pc_product_id,
      pc_grade: input.pc_grade,
      market_multiplier: input.market_multiplier ?? 1.2,
    });
    return new WorkflowResponse(card);
  }
);
```

- [ ] **Step 2: Write the route**

```ts
// from-pricecharting/route.ts
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import { createCardFromPriceChartingWorkflow } from "../../../../workflows/create-card-from-pricecharting";

const Body = z.object({
  pc_product_id: z.string().min(1),
  pc_grade: z.string().min(1),
  name: z.string().min(1),
  set: z.string().default(""),
  grader: z.string().default(""),
  grade: z.string().default(""),
  market_value: z.coerce.number().nonnegative(),
  image: z.string().url(),
  price: z.coerce.number().nonnegative().nullable().optional(),
  for_sale: z.boolean().optional(),
  pokemon_dex: z.coerce.number().int().nullable().optional(),
  sprite_image: z.string().nullable().optional(),
  market_multiplier: z.coerce.number().positive().default(1.2),
});

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid body" });
    return;
  }
  const { result } = await createCardFromPriceChartingWorkflow(req.scope).run({ input: parsed.data });
  res.status(201).json({ card: result });
}
```

- [ ] **Step 3: Write the HTTP test**

```ts
// cards-from-pc.spec.ts
it("creates product + card + pc link in one call", async () => {
  const { data } = await api.post("/admin/cards/from-pricecharting", {
    pc_product_id: "6910", pc_grade: "PSA 10",
    name: "Charizard", set: "Base Set", grader: "PSA", grade: "10",
    market_value: 100, image: "https://example.com/charizard.png", market_multiplier: 1.2,
  }, adminHeaders);
  expect(data.card.handle).toBe("charizard-psa-10");

  const read = await api.get(`/admin/cards/${data.card.handle}`, adminHeaders);
  expect(read.data.card.pc_product_id).toBe("6910");
});
```

- [ ] **Step 4: Run + commit**

Run: `corepack yarn test:integration:http cards-from-pc`
Expected: PASS.
```bash
git add backend/packages/api/src/workflows/create-card-from-pricecharting.ts \
        backend/packages/api/src/api/admin/cards/from-pricecharting/route.ts \
        backend/packages/api/integration-tests/http/cards-from-pc.spec.ts
git commit -m "feat(pricing): one-step create card from PriceCharting"
```

---

### Task 6: Admin FX rate endpoint + settings access

**Files:**
- Create: `src/api/admin/pricing/fx/route.ts` (GET current effective rate + row; POST set manual override / clear)
- Test: `backend/packages/api/integration-tests/http/fx-rate.spec.ts`

**Interfaces:**
- Consumes: `FxRate` model (Task 3), `effectiveRate` (Task 2).
- Produces: `GET /admin/pricing/fx` → `{ pair, rate, source, fetched_at, manual_override, manual_rate, effective }`. `POST /admin/pricing/fx` body `{ manual_override: boolean, manual_rate?: number }` upserts the `USD_MYR` row.

- [ ] **Step 1: Write the route**

```ts
// pricing/fx/route.ts
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { z } from "zod";
import { PACKS_MODULE } from "../../../../modules/packs";
import { effectiveRate, DEFAULT_USD_MYR } from "../../../../modules/packs/pricing";

async function loadRow(scope: MedusaRequest["scope"]) {
  const packs: any = scope.resolve(PACKS_MODULE);
  const [row] = await packs.listFxRates({ pair: "USD_MYR" }, { take: 1 });
  return { packs, row };
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { row } = await loadRow(req.scope);
  res.json({
    pair: "USD_MYR",
    rate: row ? Number(row.rate) : DEFAULT_USD_MYR,
    source: row?.source ?? "fallback",
    fetched_at: row?.fetched_at ?? null,
    manual_override: row?.manual_override ?? false,
    manual_rate: row?.manual_rate != null ? Number(row.manual_rate) : null,
    effective: effectiveRate(row ?? null),
  });
}

const Body = z.object({
  manual_override: z.boolean(),
  manual_rate: z.coerce.number().positive().nullable().optional(),
});

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: "Invalid body" }); return; }
  const { packs, row } = await loadRow(req.scope);
  if (row) {
    await packs.updateFxRates([{ id: row.id, manual_override: parsed.data.manual_override, manual_rate: parsed.data.manual_rate ?? null }]);
  } else {
    await packs.createFxRates([{ pair: "USD_MYR", rate: DEFAULT_USD_MYR, source: "manual", manual_override: parsed.data.manual_override, manual_rate: parsed.data.manual_rate ?? null }]);
  }
  const after = await loadRow(req.scope);
  res.json({ effective: effectiveRate(after.row ?? null) });
}
```

- [ ] **Step 2: Write the HTTP test**

```ts
// fx-rate.spec.ts
it("returns fallback then honours a manual override", async () => {
  const before = await api.get("/admin/pricing/fx", adminHeaders);
  expect(before.data.effective).toBeGreaterThan(0);

  await api.post("/admin/pricing/fx", { manual_override: true, manual_rate: 4.85 }, adminHeaders);
  const after = await api.get("/admin/pricing/fx", adminHeaders);
  expect(after.data.effective).toBe(4.85);
});
```

- [ ] **Step 3: Run + commit**

Run: `corepack yarn test:integration:http fx-rate`
Expected: PASS.
```bash
git add backend/packages/api/src/api/admin/pricing/fx/route.ts \
        backend/packages/api/integration-tests/http/fx-rate.spec.ts
git commit -m "feat(pricing): admin FX rate endpoint with manual override"
```

---

### Task 7: Expose computed market price in reads

**Files:**
- Modify: `src/api/store/vault/route.ts` (add `marketPriceMyr` per item)
- Modify: `src/api/store/pulls/recent/route.ts` and `src/api/store/pulls/[id]/reveal/route.ts` (add `marketPriceMyr`)
- Modify: `src/api/admin/cards/route.ts` + `[handle]/route.ts` (add admin breakdown: `raw`, `fxRate`, `marketMyr`, `displayPrice`, `markup`)
- Test: `backend/packages/api/integration-tests/http/vault-market-price.spec.ts`

**Interfaces:**
- Consumes: `displayMarketPrice`, `effectiveRate` (Task 2); `FxRate` (Task 3).
- Produces: store card payloads gain `marketPriceMyr: number`; admin card payloads gain `{ raw, fxRate, marketMyr, displayPrice, markup }`.

- [ ] **Step 1: Add a small shared read helper**

Append to `src/modules/packs/pricing.ts`:
```ts
// Resolve the effective USD->MYR once per request from the packs module.
export async function resolveFxRate(packs: {
  listFxRates: (f: unknown, c: unknown) => Promise<Array<{ rate: number; manual_override: boolean; manual_rate: number | null }>>;
}): Promise<number> {
  const [row] = await packs.listFxRates({ pair: "USD_MYR" }, { take: 1 });
  return effectiveRate(row ?? null);
}
```

- [ ] **Step 2: Wire into the vault route**

In `src/api/store/vault/route.ts`, resolve the rate once before mapping items:
```ts
import { resolveFxRate, displayMarketPrice } from "../../../modules/packs/pricing";
// ...
const packs: any = req.scope.resolve(PACKS_MODULE);
const fxRate = await resolveFxRate(packs);
```
Then for each item, add `marketPriceMyr` next to the existing `marketValue`:
```ts
marketPriceMyr: displayMarketPrice(Number(card.market_value), fxRate, Number(card.market_multiplier ?? 1.2)),
```
Apply the same addition in `pulls/recent/route.ts` and `pulls/[id]/reveal/route.ts` wherever a card's value is serialized.

- [ ] **Step 3: Wire the admin breakdown**

In `src/api/admin/cards/route.ts` (list) and `[handle]/route.ts` (detail), resolve `fxRate` once, then attach per card:
```ts
const raw = Number(card.market_value);
const mult = Number(card.market_multiplier ?? 1.2);
const marketMyr = displayMarketPrice(raw, fxRate, 1);
const displayPrice = displayMarketPrice(raw, fxRate, mult);
// attach: raw, fxRate, marketMyr, displayPrice, markup: Math.round((displayPrice - marketMyr) * 100) / 100
```

- [ ] **Step 4: Write the HTTP test**

```ts
// vault-market-price.spec.ts — a customer with one owned card sees raw×fx×1.2.
it("vault item exposes marketPriceMyr = raw × fx × multiplier", async () => {
  await api.post("/admin/pricing/fx", { manual_override: true, manual_rate: 4.0 }, adminHeaders);
  // seed a pull of a card with market_value=100, multiplier=1.2 via existing helpers
  const { data } = await api.get("/store/vault", customerHeaders);
  const item = data.items.find((i: any) => i.card.handle === seededHandle);
  expect(item.card.marketPriceMyr).toBe(480); // 100 * 4.0 * 1.2
});
```

- [ ] **Step 5: Run + commit**

Run: `corepack yarn test:integration:http vault-market-price`
Expected: PASS.
```bash
git add backend/packages/api/src/api/store/vault/route.ts \
        backend/packages/api/src/api/store/pulls/recent/route.ts \
        backend/packages/api/src/api/store/pulls/[id]/reveal/route.ts \
        backend/packages/api/src/api/admin/cards/route.ts \
        backend/packages/api/src/api/admin/cards/[handle]/route.ts \
        backend/packages/api/src/modules/packs/pricing.ts \
        backend/packages/api/integration-tests/http/vault-market-price.spec.ts
git commit -m "feat(pricing): expose computed MYR market price in store + admin reads"
```

---

## Phase 3 — Daily sync job (backend)

### Task 8: `sync-market-prices` job

**Files:**
- Create: `src/jobs/sync-market-prices.ts`
- Create: `src/modules/packs/sync-market-prices.ts` (testable core: `refreshCardPrice`)
- Test: `backend/packages/api/src/modules/packs/__tests__/sync-market-prices.test.ts`

**Interfaces:**
- Consumes: `pcFetch` (`src/api/admin/pricecharting/client.ts`), `priceFieldForGrade` (Task 1), `fetchUsdMyr`/`effectiveRate` (Task 2), `FxRate`/`Card` service methods.
- Produces: `refreshCardPrice(card, deps): Promise<{ handle, oldValue, newValue, changed, skippedReason? }>` and the scheduled `default` job.

- [ ] **Step 1: Write the failing test for the core**

```ts
// sync-market-prices.test.ts
import { refreshCardPrice } from "../sync-market-prices";

const card = { id: "c1", handle: "charizard-psa-10", pc_product_id: "6910", pc_grade: "PSA 10", market_value: 100 };

test("updates market_value from the tier's fresh price", async () => {
  const updates: any[] = [];
  const r = await refreshCardPrice(card as any, {
    pcFetch: async () => ({ kind: "ok", data: { "manual-only-price": 15000 } }), // $150.00 in pennies
    updateCards: async (u: any) => { updates.push(u[0]); },
    now: new Date("2026-07-01T00:00:00Z"),
  });
  expect(r.newValue).toBe(150);
  expect(r.changed).toBe(true);
  expect(updates[0].market_value).toBe(150);
});

test("keeps last-known value when PriceCharting errors", async () => {
  const r = await refreshCardPrice(card as any, {
    pcFetch: async () => ({ kind: "error", message: "boom" }),
    updateCards: async () => { throw new Error("must not write"); },
    now: new Date("2026-07-01T00:00:00Z"),
  });
  expect(r.changed).toBe(false);
  expect(r.skippedReason).toBe("boom");
});

test("skips zero/blank upstream price (never zeroes a card)", async () => {
  const r = await refreshCardPrice(card as any, {
    pcFetch: async () => ({ kind: "ok", data: { "manual-only-price": 0 } }),
    updateCards: async () => { throw new Error("must not write"); },
    now: new Date("2026-07-01T00:00:00Z"),
  });
  expect(r.changed).toBe(false);
  expect(r.skippedReason).toMatch(/no usable price/i);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `corepack yarn test:unit sync-market-prices`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the testable core**

```ts
// modules/packs/sync-market-prices.ts
import { priceFieldForGrade } from "./pricecharting-grades";

type PcOk = { kind: "ok"; data: Record<string, unknown> };
type PcRes = PcOk | { kind: "no-token" } | { kind: "error"; message: string };

export type RefreshDeps = {
  pcFetch: (path: string, params: Record<string, string>) => Promise<PcRes>;
  updateCards: (updates: Array<{ id: string; market_value: number; pc_synced_at: Date }>) => Promise<unknown>;
  now: Date;
};

export type CardRow = { id: string; handle: string; pc_product_id: string | null; pc_grade: string | null; market_value: number };

export async function refreshCardPrice(card: CardRow, deps: RefreshDeps) {
  const oldValue = Number(card.market_value);
  const base = { handle: card.handle, oldValue, newValue: oldValue, changed: false as boolean };
  if (!card.pc_product_id || !card.pc_grade) return { ...base, skippedReason: "not linked" };

  const field = priceFieldForGrade(card.pc_grade);
  if (!field) return { ...base, skippedReason: `unknown grade '${card.pc_grade}'` };

  const res = await deps.pcFetch("/api/product", { id: card.pc_product_id });
  if (res.kind !== "ok") return { ...base, skippedReason: res.kind === "no-token" ? "no token" : res.message };

  const pennies = res.data[field];
  if (typeof pennies !== "number" || !Number.isFinite(pennies) || pennies <= 0) {
    return { ...base, skippedReason: "no usable price" };
  }
  const newValue = Math.round(pennies) / 100;
  await deps.updateCards([{ id: card.id, market_value: newValue, pc_synced_at: deps.now }]);
  return { handle: card.handle, oldValue, newValue, changed: newValue !== oldValue };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `corepack yarn test:unit sync-market-prices`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the scheduled job wrapper**

```ts
// jobs/sync-market-prices.ts
import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { PACKS_MODULE } from "../modules/packs";
import { pcFetch } from "../api/admin/pricecharting/client";
import { fetchUsdMyr } from "../modules/packs/pricing";
import { refreshCardPrice } from "../modules/packs/sync-market-prices";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default async function syncMarketPricesJob(container: MedusaContainer): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const packs: any = container.resolve(PACKS_MODULE);
  const now = new Date();

  // 1) Refresh FX (keep last-known on failure).
  try {
    const rate = await fetchUsdMyr();
    const [row] = await packs.listFxRates({ pair: "USD_MYR" }, { take: 1 });
    if (row) await packs.updateFxRates([{ id: row.id, rate, source: "frankfurter", fetched_at: now }]);
    else await packs.createFxRates([{ pair: "USD_MYR", rate, source: "frankfurter", fetched_at: now }]);
    logger.info(`[sync-market-prices] FX USD->MYR = ${rate}`);
  } catch (e) {
    logger.warn(`[sync-market-prices] FX refresh failed, keeping last-known: ${(e as Error).message}`);
  }

  // 2) Refresh each linked card's raw value (throttle 1 req/sec).
  const cards = await packs.listCards({ pc_product_id: { $ne: null } }, { take: 10000 });
  let changed = 0;
  for (const card of cards) {
    const r = await refreshCardPrice(card, { pcFetch, updateCards: (u) => packs.updateCards(u), now });
    if (r.changed) { changed++; logger.info(`[sync-market-prices] ${r.handle} ${r.oldValue} -> ${r.newValue}`); }
    else if (r.skippedReason) logger.warn(`[sync-market-prices] skip ${r.handle}: ${r.skippedReason}`);
    await sleep(1100); // < 1 req/sec ceiling
  }
  logger.info(`[sync-market-prices] done: ${changed}/${cards.length} cards updated`);
}

export const config = { name: "sync-market-prices", schedule: "0 3 * * *" }; // daily 03:00
```

- [ ] **Step 6: Type-check + commit**

Run: `corepack yarn tsc --noEmit`. Expected: clean. (The `$ne` filter is Medusa's list operator; if the local service rejects it, filter linked cards in JS instead — list all, then `.filter(c => c.pc_product_id)`.)
```bash
git add backend/packages/api/src/jobs/sync-market-prices.ts \
        backend/packages/api/src/modules/packs/sync-market-prices.ts \
        backend/packages/api/src/modules/packs/__tests__/sync-market-prices.test.ts
git commit -m "feat(pricing): daily PriceCharting + FX sync job"
```

---

## Phase 4 — Admin UI

> Presentational work: verify with the admin running (`node ../../node_modules/vite/bin/vite.js` in `backend/apps/admin`, backend on :9000) and Playwright/manual capture, per repo `testing.md` — not brittle unit assertions.

### Task 9: Admin REST + query wiring

**Files:**
- Modify: `backend/apps/admin/src/lib/admin-rest.ts` (extend Card DTO; add `createCardFromPriceCharting`, `getFxRate`, `setFxRate`)
- Modify: `backend/apps/admin/src/lib/queries.ts` + `query-keys.ts`

- [ ] **Step 1: Extend the admin Card DTO + helpers**

In `admin-rest.ts`, add `pc_product_id`, `pc_grade`, `market_multiplier`, `pc_synced_at`, and the admin breakdown (`raw`, `fxRate`, `marketMyr`, `displayPrice`, `markup`) to the card type, and add:
```ts
export async function createCardFromPriceCharting(body: {
  pc_product_id: string; pc_grade: string; name: string; set: string; grader: string; grade: string;
  market_value: number; image: string; price?: number | null; for_sale?: boolean;
  pokemon_dex?: number | null; sprite_image?: string | null; market_multiplier?: number;
}): Promise<{ handle: string }> {
  const res = await fetch(`${__BACKEND_URL__}/admin/cards/from-pricecharting`, {
    method: "POST", credentials: "include",
    headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? "Create failed");
  return (await res.json()).card;
}

export async function getFxRate(): Promise<{ effective: number; manual_override: boolean; manual_rate: number | null; fetched_at: string | null }> {
  const res = await fetch(`${__BACKEND_URL__}/admin/pricing/fx`, { credentials: "include" });
  return res.json();
}
export async function setFxRate(body: { manual_override: boolean; manual_rate?: number | null }): Promise<void> {
  await fetch(`${__BACKEND_URL__}/admin/pricing/fx`, {
    method: "POST", credentials: "include",
    headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
```

- [ ] **Step 2: Add hooks + keys**

In `query-keys.ts` add `fxRate: ["admin", "pricing", "fx"] as const`. In `queries.ts` add `useFxRate()` (useQuery), `useSetFxRate()` (useMutation → invalidate `fxRate` + cards), and `useCreateCardFromPriceCharting()` (useMutation → invalidate cards + eligible products). Match the existing hook style.

- [ ] **Step 3: Type-check + commit**

Run (in `backend/apps/admin`): `node ../../node_modules/typescript/bin/tsc --noEmit`. Expected: clean.
```bash
git add backend/apps/admin/src/lib/admin-rest.ts backend/apps/admin/src/lib/queries.ts backend/apps/admin/src/lib/query-keys.ts
git commit -m "feat(pricing): admin REST + query wiring for PC create + FX"
```

---

### Task 10: RegisterCardModal — grade picker, markup, preview, one-step create

**Files:**
- Modify: `backend/apps/admin/src/routes/cards/RegisterCardModal.tsx`

- [ ] **Step 1: Structured grade picker + auto-fill**

When the operator picks a PriceCharting grade tier (existing `pcProduct.prices` list), replace the current `applyPrice(grade, usd)` so it also records the tier and derives grader/grade via the shared mapping logic (mirror `gradeToGrader` client-side): set `pc_grade = grade` (tier label), `market_value = usd`, and for `PSA 10/BGS 10/CGC 10/SGC 10` set `grader`+`grade` from the label; for `Grade N` set `grade` only. Store `pc_product_id = pcProduct.id`.

- [ ] **Step 2: Markup field + live preview**

Add a `market_multiplier` field to the form state, default `1.2`, rendered as a percent input (`20` ⇄ `1.2`). Add a read-only preview row using `useFxRate()`:
```
Raw ${market_value}  ·  FX {effective}  ·  Market RM {raw×fx}  ·  Customer sees RM {raw×fx×mult}  ·  Markup RM {raw×fx×(mult−1)}
```

- [ ] **Step 3: One-step create path**

Add a mode where, after picking a PriceCharting match+grade and uploading an image (existing `useUploadImage`), the submit calls `useCreateCardFromPriceCharting()` (creates product+card) instead of the existing register-existing-product mutation. Keep the existing "register an already-in-inventory product" path available via a toggle/tab.

- [ ] **Step 4: Persist pc fields on the existing register/edit paths**

Pass `pc_product_id`, `pc_grade`, `market_multiplier` into the existing `registerCard`/`updateCard` mutation payloads (Task 4 accepts them).

- [ ] **Step 5: Linked/synced indicator**

On the edit form, when `card.pc_product_id` is set, show `🔗 Linked · synced {pc_synced_at}` with an "Unlink" button that submits `pc_product_id: null` (reverts the card to manual pricing).

- [ ] **Step 6: Verify running**

Start backend (:9000) + admin, open `/dashboard/gacha/cards` → register-from-PriceCharting. Confirm: search returns matches, picking a grade fills value+grader+grade, the preview row math is correct, submit creates a product+card, and the edit form shows the linked indicator. Capture a screenshot to `docs/research/`.

- [ ] **Step 7: Commit**

```bash
git add backend/apps/admin/src/routes/cards/RegisterCardModal.tsx
git commit -m "feat(pricing): PriceCharting grade picker, markup preview, one-step create in admin"
```

---

## Phase 5 — Storefront display

### Task 11: Vault shows the live MYR market price

**Files:**
- Modify: `src/lib/actions/vault.ts` (add `marketPriceMyr` to `VaultItem.card`)
- Modify: `src/app/(account)/vault/VaultClient.tsx` (render `marketPriceMyr`)

- [ ] **Step 1: Extend the type + mapping**

In `src/lib/actions/vault.ts`, add `marketPriceMyr: number` to the `card` shape of `VaultItem` and map it from the `/store/vault` response (Task 7 now returns it).

- [ ] **Step 2: Render it**

In `VaultClient.tsx` (~line 321-328), change the value line from `{rm(item.card.marketValue)}` to `{rm(item.card.marketPriceMyr)}`. (Raw `marketValue` stays available but is no longer the customer-facing number.)

- [ ] **Step 3: Verify**

Build storefront (`npm run build`) + serve standalone (`pwsh scripts/serve-standalone.ps1 -Port 4000`) with the backend up; log in as the test customer, open the vault, confirm each owned card shows `raw × fx × 1.2`. Screenshot to `docs/research/`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/vault.ts "src/app/(account)/vault/VaultClient.tsx"
git commit -m "feat(pricing): vault shows live MYR market price (raw×fx×1.2)"
```

---

### Task 12: Pull-reveal shows the market price

**Files:**
- Modify: the pull-reveal component that renders a freshly pulled card (locate via the `/store/pulls/[id]/reveal` consumer in `src/`), plus its data type.

- [ ] **Step 1: Surface `marketPriceMyr`**

The reveal/`recent` store routes now return `marketPriceMyr` (Task 7). Thread it into the reveal component's card type and render it as the card's value (via `rm()`), same as the vault.

- [ ] **Step 2: Verify + commit**

Open a pack, watch the reveal, confirm the revealed card shows the marked-up MYR price. Screenshot to `docs/research/`.
```bash
git add <reveal component + type>
git commit -m "feat(pricing): pull-reveal shows live MYR market price"
```

---

### Task 13: Marketplace listing (dormant behind flag)

**Files:**
- Modify: the marketplace card/listing component (under `src/app/marketplace/`).

- [ ] **Step 1: Show the market price on listings**

On the marketplace product/card listing, display the computed MYR market price. Source it the same way as the vault (prefer a store endpoint that returns `marketPriceMyr`; if listings read Mercur product data directly, compute from `product.metadata.fmv` × FX × `1.2` using the same `displayMarketPrice` formula ported to the storefront). This surface stays behind `NEXT_PUBLIC_FEATURE_MARKETPLACE` (default off) — build it, don't enable it.

- [ ] **Step 2: Verify (flag on locally) + commit**

Temporarily set `NEXT_PUBLIC_FEATURE_MARKETPLACE=true` locally, confirm listings show the marked-up price, then leave the flag off. Screenshot to `docs/research/`.
```bash
git add <marketplace listing files>
git commit -m "feat(pricing): marketplace listings show live MYR market price (dormant)"
```

---

## Phase 6 — Config, docs, final verification

### Task 14: Env + ops wiring

- [ ] **Step 1: Env** — Add `PRICECHARTING_API_TOKEN` to the backend `.env` (value provided out-of-band; never commit it). Optionally set `FX_USD_MYR_URL`. Add both to `.env.template` as **empty** keys with a comment.
- [ ] **Step 2: Confirm the job registers** — Start the backend and confirm the logs list `sync-market-prices` among scheduled jobs. Optionally trigger the core once via a throwaway script against a linked card.
- [ ] **Step 3: Deploy note** — Record in the PR description that production must run `medusa db:migrate` (Card fields + `fx_rate` table) and set `PRICECHARTING_API_TOKEN` before the job runs.
- [ ] **Step 4: Commit**
```bash
git add backend/packages/api/.env.template
git commit -m "chore(pricing): env template + deploy notes for PriceCharting tracking"
```

### Task 15: Full verification pass

- [ ] **Step 1: Backend suites** — from `backend/packages/api`: `corepack yarn test:unit` and `corepack yarn test:integration:http` (money-path rule). Expected: green.
- [ ] **Step 2: Typecheck** — backend + storefront tsc clean (Stop hook enforces this).
- [ ] **Step 3: End-to-end smoke** — with a real `PRICECHARTING_API_TOKEN`: create a card from PriceCharting, run the sync core once, confirm `market_value` refreshes and the vault shows `raw × fx × 1.2`. Confirm buyback on that card still pays off the **raw** value (unchanged).
- [ ] **Step 4: Finish the branch** — use `superpowers:finishing-a-development-branch` to open the PR.

---

## Self-Review (author checklist — completed)

**Spec coverage:** search→create (Task 5, 10) · one card = one grade + structured picker (Task 1, 10) · persist PC link (Task 3, 4) · daily refresh + 1 req/s + guardrails (Task 8) · +20% multiplier, per-card, default, on create & edit (Task 4, 10) · USD→MYR FX with manual override + last-known fallback (Task 2, 6, 8) · display-only, internals raw (Task 2, 7; buyback/RTP untouched) · customer surfaces vault/reveal/marketplace (Task 11–13) · admin margin visibility (Task 7, 10) · image is a manual upload (Task 5, 10) · token server-side only (Task 14). No spec requirement is unmapped.

**Placeholder scan:** UI tasks (Phase 4–5) intentionally use "verify running + screenshot" rather than unit tests, per repo `testing.md` (presentational work → Playwright/manual, not brittle assertions) — this is a deliberate repo-rule override of the skill's TDD default, not a placeholder. Two spots name "locate the reveal/marketplace component in `src/`" because their exact file wasn't read during planning; the transform to apply is fully specified.

**Type consistency:** `displayMarketPrice`/`effectiveRate`/`fetchUsdMyr`/`resolveFxRate` (pricing.ts), `priceFieldForGrade`/`gradeToGrader`/`PRICE_FIELDS` (pricecharting-grades.ts), `refreshCardPrice` (sync-market-prices.ts), and the `pc_product_id`/`pc_grade`/`market_multiplier`/`pc_synced_at` field names are used identically across every task that references them.

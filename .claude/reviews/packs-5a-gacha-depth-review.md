# Phase 5a Gacha Depth - Code Review

Scope: backend models (Card, PackOdds, Pull), service, store route, seed (gacha block),
migration; frontend seam (packs.ts), detail page, PackDetailClient, Playwright script.
Review date: 2026-06-08.

---

## Findings

No CRITICAL issues. No HIGH issues.

---

### [MEDIUM] Pack.status default is load-bearing but undocumented at the seed callsite

Files:
- backend/packages/api/src/modules/packs/models/pack.ts line 25
- backend/packages/api/src/api/store/packs/[slug]/route.ts lines 19-22
- backend/packages/api/src/scripts/seed.ts line 1053

The detail route filters listPacks({ slug, status: "active" }) and returns 404 otherwise.
The seed calls createPacks(packsToCreate) with no status field on any object. This is
correct because Pack.status defaults to "active" in the model. But the invariant is
implicit - the seed callsite has no comment explaining why omitting status is safe.

Concrete failure mode: A developer adds a pack group with status: "draft" to PACK_SEED_GROUPS
expecting it to be hidden until promoted. The route silently returns 404, getPackDetail
returns null, and the page falls back to mock pools with no visible error - indistinguishable
from a backend-down scenario.

Fix: Add a comment at the createPacks call in seed.ts clarifying that status is intentionally
omitted because the model default ("active") is the correct production state for all seed
packs. No code change required.

---

### [MEDIUM] Odds idempotency guard uses a take bound with zero headroom

File: backend/packages/api/src/scripts/seed.ts lines 1107-1110

    const existingOdds = await packsModuleService.listPackOdds(
      { pack_id: PACK_SLUGS },
      { select: ["pack_id"], take: PACK_SLUGS.length * CARD_HANDLES.length }
    );

take is 21 * 16 = 336, exactly the table capacity. If the Medusa framework applies a default
page cap before the pack_id filter is resolved in JS (rather than pushing the IN() clause
to SQL), the idempotency check sees a truncated result, concludes some packs have no odds,
and re-inserts rows for those packs - doubling their weights and skewing aggregated
percentages.

Realistic probability: Low. Medusa service filters are pushed to SQL in practice. But the
take is a silent assumption.

Fix: Use take: PACK_SLUGS.length * CARD_HANDLES.length + 1. The +1 costs nothing and removes
the ambiguity.

Severity context: No impact on first-run deploy. Worst case on re-seed is inflated pull odds
for some packs, caught by QA. Not a security issue.

---

### [LOW] Number(card.market_value) is correct but the confidence path is undocumented

File: backend/packages/api/src/api/store/packs/[slug]/route.ts line 57

    market_value: Number(card.market_value),

Confirmed safe: @medusajs/utils/dist/totals/big-number.js implements BigNumber.valueOf()
(returns this.numeric_, a plain JS number) and Symbol.toPrimitive. Number() coercion via
valueOf is lossless for valid decimal inputs. The storefront seam's Number.isFinite guard
is an adequate downstream safety net regardless.

Recommendation: Add a comment such as "// BigNumber.valueOf() returns numeric_, Number()
coercion is safe" so future reviewers do not need to trace SDK internals. No code change
needed.

---

### [LOW] Playwright PASS criteria are implicitly coupled to the current seed pool

File: scripts/capture-pack-detail.mjs lines 48-54

    r.hasLegendaryRow = r.rarityRows.some((t) => /Legendary/i.test(t));
    r.verdict =
      r.rarityCount === 4 && !r.hasLegendaryRow && r.backendTopValuePresent && !r.mockTopValuePresent
        ? "PASS (backend-wired)"
        : "FAIL (mock fallback or wrong data)";

rarityCount === 4 and !hasLegendaryRow are correct for the current 16-card seed (0 Legendary
entries). If a Legendary card is added to CARD_PRODUCTS the verdict flips to FAIL even
though the backend integration is working correctly.

Recommendation: Add a comment explaining that the 4-rarity/no-Legendary criteria derive from
the current seed pool composition, so a future maintainer adding a Legendary card knows to
update the discriminator.

---

## Confirmed Correct - Not Flagged

Weight-to-chance aggregation (packs.ts lines 186-201): total > 0 guard present; formula is
sum(weight by rarity) / sum(all weights) * 100; formatChance drops trailing ".0"; RARITY_ORDER
.filter(r => weightByRarity.has(r)) correctly omits rarities absent from the pool (Legendary
has 0 seed cards, so 4 rows are emitted, not 5). Math verified: Epic 90/5040 = 1.786%, Rare
450/5040 = 8.928%, Uncommon 1500/5040 = 29.76%, Common 3000/5040 = 59.52%.

Odds-to-card join (route.ts lines 34-62): handle-keyed Map; orphaned odds rows are dropped by
the null filter; explicit take: cardHandles.length prevents the second listCards call from
being silently re-capped. In-module join on stable business keys is appropriate (not a
cross-module filter violation).

Top Hits sort (packs.ts lines 174-183): spread-then-sort preserves immutability; descending
market_value; slice(0,5). Correct.

Pack.status default: Confirmed by reading models/pack.ts line 25.
status: model.enum(["active", "draft"]).default("active"). Seeded packs without an explicit
status field are created as "active", satisfying the route filter. The feature is live as
shipped.

Number(BigNumber) correctness: Confirmed from node_modules/@medusajs/utils/dist/totals/
big-number.js lines 115-120. valueOf() returns this.numeric_ (plain JS number). Safe.

Duplicate-odds guard: Pack-granular check (skip a pack if any of its odds rows exist); single
createPackOdds batch call; no partial-write-then-retry path exists. Cannot double-insert.

Graceful fallback chain: Backend 404/500 -> fetch throws -> catch in getPackDetail -> null ->
detail?.topHits ?? mockTopHits and detail?.rarityOdds ?? ODDS in PackDetailClient.

Security: Route slug used only in parameterized service filter calls (no SQL string concat).
encodeURIComponent(slug) used in frontend fetch. No hardcoded secrets. 404 echoes slug in
JSON body only (no HTML injection surface). Store route is publishable-key scoped by design.

TypeScript type safety: BackendOddsEntry runtime validation in getPackDetail (typeof string,
isRarity type guard, Number.isFinite checks) correctly compensates for the SDK fetch generic
being a type assertion rather than a runtime guard. isRarity narrows string to Rarity before
use.

Migration: card.market_value uses numeric column type (correct for USD decimals, matches
model.bigNumber()). pack_odds.weight is integer (correct). pull.order_id is nullable
(correct - checkout not wired until 5b). Down migration uses DROP CASCADE (appropriate for
development-phase migration).

force-dynamic on the detail page: Correct. Backend-fetched odds must not be statically baked
at build time. Degrades cleanly during npm run build when the backend is unreachable.

---

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0     | pass   |
| HIGH     | 0     | pass   |
| MEDIUM   | 2     | info   |
| LOW      | 2     | note   |

Verdict: APPROVE - No CRITICAL or HIGH issues. The two MEDIUM items are bounded operational
risks (a documentation gap and a theoretical re-seed edge case) with no impact on a first-run
deploy. The two LOW items are documentation suggestions only. The feature is structurally
sound across correctness, security, resilience, and type-safety dimensions.

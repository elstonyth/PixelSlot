/**
 * Gacha pack catalog data seam.
 *
 * Single source for the /claw pack listing. Packs are read live from the custom
 * Medusa route `GET /store/packs` (backend Packs module — see
 * `backend/packages/api/src/modules/packs`). The custom route is publishable-key
 * scoped but bypasses Mercur's seller-visibility product middleware, so packs
 * need no house-seller link to be listed.
 *
 * Resilience: `getPackCategories()` degrades gracefully to the static mock
 * catalog (`src/app/claw/packs-data.ts`) if the backend is unreachable, so the
 * page stays populated and `npm run check` stays green on a backend-down build.
 * The mock catalog also supplies the presentational per-category labels/icons
 * (local assets, not backend-derived).
 */

import { sdk } from "@/lib/medusa";
import { logger } from "@/lib/logger";
import {
  CATEGORIES as MOCK_CATEGORIES,
  type Pack,
  type PackCategory,
} from "@/app/claw/packs-data";

// Shape of a pack row from GET /store/packs (backend Pack model).
interface BackendPack {
  slug: string;
  title: string;
  category: string;
  price: number;
  image: string;
  boost: boolean;
  rank: number;
}

// Pack prices are whole-dollar USD; render as "$1,000" to match the live site.
const formatPrice = (price: number): string =>
  `$${Math.round(price).toLocaleString("en-US")}`;

const toPack = (p: BackendPack): Pack => ({
  id: p.slug,
  name: p.title,
  price: formatPrice(p.price),
  image: p.image,
  boost: p.boost || undefined,
});

/**
 * Pack catalog grouped by category, in the live-site category order. Each
 * category's packs come entirely from the backend (ordered by rank); empty
 * categories are dropped. Presentational labels/icons come from the mock
 * catalog. Falls back to the full mock catalog on any backend failure.
 */
export async function getPackCategories(): Promise<PackCategory[]> {
  try {
    const { packs } = await sdk.client.fetch<{ packs: BackendPack[] }>(
      "/store/packs",
    );
    if (!Array.isArray(packs) || packs.length === 0) return MOCK_CATEGORIES;

    // Group backend packs by category key (response is already rank-ordered).
    // Skip malformed rows defensively — the fetch generic is a type assertion,
    // not a runtime guard, so a renamed/absent field can't silently render
    // "$NaN" or a category-less pack.
    const byCategory = new Map<string, Pack[]>();
    for (const p of packs) {
      if (!p || typeof p.category !== "string" || !Number.isFinite(p.price)) {
        continue;
      }
      const list = byCategory.get(p.category) ?? [];
      list.push(toPack(p));
      byCategory.set(p.category, list);
    }

    // Preserve the live-site category order + presentational meta; keep only
    // categories that actually have backend packs.
    const categories = MOCK_CATEGORIES.map((cat) => ({
      ...cat,
      packs: byCategory.get(cat.id) ?? [],
    })).filter((cat) => cat.packs.length > 0);

    return categories.length ? categories : MOCK_CATEGORIES;
  } catch (error) {
    logger.error("[packs] failed to load packs from backend:", error);
    return MOCK_CATEGORIES;
  }
}

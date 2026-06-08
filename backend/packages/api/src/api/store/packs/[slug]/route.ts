import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import PacksModuleService from "../../../../modules/packs/service";
import { PACKS_MODULE } from "../../../../modules/packs";

// GET /store/packs/:slug — one active pack plus its gacha odds, each joined to
// the referenced Card (the prize pool behind /claw/[slug]'s Top Hits + Pull
// Odds). A plain Medusa store route (publishable-key scoped, NOT subject to
// Mercur's seller-visibility product middleware), so no house-seller link is
// needed. 404 when the slug is unknown or inactive. The join is in-module by
// stable business keys (Pack.slug, Card.handle); presentation aggregation
// (top hits, rarity %, dot colors) lives in the storefront seam.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const packsModuleService: PacksModuleService = req.scope.resolve(PACKS_MODULE);
  const { slug } = req.params;

  const [pack] = await packsModuleService.listPacks(
    { slug, status: "active" },
    { take: 1 }
  );
  if (!pack) {
    res.status(404).json({ message: `Pack '${slug}' not found` });
    return;
  }

  const odds = await packsModuleService.listPackOdds(
    { pack_id: slug },
    // Explicit take so a framework default can't silently cap the prize pool.
    { take: 1000 }
  );

  const cardHandles = odds.map((o) => o.card_id);
  const cards = cardHandles.length
    ? await packsModuleService.listCards(
        { handle: cardHandles },
        { take: cardHandles.length }
      )
    : [];
  const cardByHandle = new Map(cards.map((c) => [c.handle, c]));

  // Join each odds row to its card; drop orphaned odds whose card is missing.
  const entries = odds
    .map((o) => {
      const card = cardByHandle.get(o.card_id);
      if (!card) return null;
      return {
        handle: card.handle,
        name: card.name,
        set: card.set,
        grader: card.grader,
        grade: card.grade,
        rarity: card.rarity,
        // market_value is a BigNumber (numeric column) — normalize to a JSON
        // number; it's a USD decimal, never cents.
        market_value: Number(card.market_value),
        image: card.image,
        weight: o.weight,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  res.json({ pack, odds: entries });
}

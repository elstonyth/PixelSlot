import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import PacksModuleService from "../../../modules/packs/service";
import { PACKS_MODULE } from "../../../modules/packs";

// GET /admin/packs — the pack selector list for the win-rate editor. An admin
// route, so it is auto-protected by Medusa's admin auth (session/bearer); no
// custom middleware needed. Returns every pack (active + draft) ordered by
// (category, rank) to mirror the storefront grouping.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const packsModuleService: PacksModuleService = req.scope.resolve(PACKS_MODULE);

  const packs = await packsModuleService.listPacks({}, { take: 1000 });
  const sorted = [...packs].sort((a, b) =>
    a.category === b.category
      ? a.rank - b.rank
      : a.category.localeCompare(b.category)
  );

  res.json({
    packs: sorted.map((p) => ({
      slug: p.slug,
      title: p.title,
      category: p.category,
      status: p.status,
      rank: p.rank,
      price: p.price,
      image: p.image,
    })),
  });
}

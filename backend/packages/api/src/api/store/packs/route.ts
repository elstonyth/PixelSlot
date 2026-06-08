import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import PacksModuleService from "../../../modules/packs/service";
import { PACKS_MODULE } from "../../../modules/packs";

// GET /store/packs — the gacha pack catalog for /claw and the home "Open Packs"
// tiles. A plain Medusa store route (publishable-key scoped, but NOT subject to
// Mercur's seller-visibility product middleware), so the house-seller machinery
// the marketplace needs does not apply here. Returns active packs ordered by
// (category, rank); the storefront groups them and attaches presentational
// category labels/icons from local assets.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const packsModuleService: PacksModuleService = req.scope.resolve(PACKS_MODULE);

  const packs = await packsModuleService.listPacks(
    { status: "active" },
    // Explicit take so a framework default can't silently cap the catalog.
    { order: { category: "ASC", rank: "ASC" }, take: 500 }
  );

  res.json({ packs });
}

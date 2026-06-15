import type { ExecArgs } from "@medusajs/framework/types";
import { Modules, ProductStatus } from "@medusajs/framework/utils";
import { createProductsWorkflow } from "@medusajs/medusa/core-flows";
import {
  buildCardProductInput,
  resolveCardProductContext,
} from "../modules/packs/card-product";

// Mint ONE inventory product that is NOT yet registered as a gacha card, so the
// admin "Add from inventory" UI has something eligible to register (the seed
// registers all 16 of its products, leaving eligible-products empty). Idempotent
// by handle. Run from backend/packages/api:
//   npx medusa exec ./src/scripts/create-test-product.ts
const HANDLE = "pw-test-card";

export default async function createTestProduct({
  container,
}: ExecArgs): Promise<void> {
  const productModule = container.resolve(Modules.PRODUCT);
  const existing = await productModule.listProducts({ handle: HANDLE }, { take: 1 });
  if (existing.length) {
    console.log(
      `[create-test-product] '${HANDLE}' already exists (${existing[0].id}).`,
    );
    return;
  }

  const ctx = await resolveCardProductContext(container);
  const input = buildCardProductInput(
    {
      handle: HANDLE,
      title: "PW Test Eligible Card",
      image: "/cdn/cards/celebi.webp", // reuse a seeded image
      price: 12.5,
      metadata: {
        fmv: 12.5,
        points: 90,
        grade: "9",
        grader: "PSA",
        set: "PW Test Set",
        year: 2026,
      },
    },
    {
      shippingProfileId: ctx.shippingProfileId,
      salesChannelId: ctx.salesChannelId,
      status: ProductStatus.PUBLISHED,
      manageInventory: false, // untracked => ∞ stock, drawable when pooled
    },
  );

  const { result } = await createProductsWorkflow(container).run({
    input: { products: [input], additional_data: { seller_id: ctx.sellerId } },
  });
  console.log(`[create-test-product] created ${result[0].id} (${HANDLE}).`);
}

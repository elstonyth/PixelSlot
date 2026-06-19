import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { MedusaError } from "@medusajs/framework/utils";
import { PACKS_MODULE } from "../../modules/packs";
import type PacksModuleService from "../../modules/packs/service";

type RollPackInput = {
  pack_id: string; // = Pack.slug
  // customer_id is carried on the workflow input but unused here — the roll is
  // anonymous; the authenticated id is attached when the pull is recorded.
  customer_id?: string;
};

// Plain, JSON-safe winner shape. market_value is a BigNumber on the Card model;
// it is normalized to a number HERE so no ORM instance / BigNumber crosses the
// workflow boundary (StepResponse → transform → WorkflowResponse all serialize).
// rarity comes from the WINNING PackOdds row — it is the tier the card has in
// THIS pack, not a card property.
export type RolledCard = {
  handle: string;
  name: string;
  set: string;
  grader: string;
  grade: string;
  rarity: string;
  market_value: number;
  image: string;
  pokemon_dex: number | null;
  sprite_image: string | null;
};

// rollOne — the pure draw logic, extracted so the batch step can reuse the
// exact same algorithm without duplicating it. Exported for direct testing.
export async function rollOne(
  packs: PacksModuleService,
  packId: string,
): Promise<RolledCard> {
  const [pack] = await packs.listPacks({ slug: packId, status: "active" }, { take: 1 });
  if (!pack) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Pack '${packId}' is not available.`);
  const odds = await packs.listPackOdds({ pack_id: packId }, { take: 1000 });
  if (odds.length === 0) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Pack '${packId}' has no odds configured.`);
  const totalWeight = odds.reduce((sum, o) => sum + o.weight, 0);
  if (totalWeight <= 0) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `Pack '${packId}' has invalid odds.`);
  let roll = Math.random() * totalWeight;
  let won = odds[odds.length - 1];
  for (const o of odds) { roll -= o.weight; if (roll < 0) { won = o; break; } }
  const [card] = await packs.listCards({ handle: won.card_id }, { take: 1 });
  if (!card) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Card '${won.card_id}' not found.`);
  return {
    handle: card.handle, name: card.name, set: card.set, grader: card.grader,
    grade: card.grade, rarity: won.rarity, market_value: Number(card.market_value),
    image: card.image, pokemon_dex: card.pokemon_dex ?? null, sprite_image: card.sprite_image ?? null,
  };
}

// roll-pack — read-only step: validate the pack is active, then pick a winner
// over its weighted PackOdds table. No mutation, so no compensation. The weighted
// draw runs at execution time, so Math.random here is correct (the composition
// body, which runs at load time, must never contain this logic).
export const rollPackStep = createStep(
  "roll-pack",
  async (input: RollPackInput, { container }) => {
    const packs = container.resolve<PacksModuleService>(PACKS_MODULE);
    return new StepResponse(await rollOne(packs, input.pack_id));
  }
);

export default rollPackStep;

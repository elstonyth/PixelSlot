import { model } from "@medusajs/framework/utils";

// Card — the gacha prize metadata referenced by PackOdds (weights) and Pull
// (results). In Phase 5a it carries its own display fields so the read-only
// catalog depth (Top Hits / Pull Odds) needs no cross-module join. Phase 5b
// links each Card to the Medusa Product whose variant carries inventory +
// checkout; `handle` is that product's handle (the future link key, and the
// stable id PackOdds/Pull reference).
export const Card = model.define("card", {
  id: model.id().primaryKey(),
  handle: model.text().unique(),
  name: model.text(),
  set: model.text(),
  grader: model.text(),
  grade: model.text(),
  rarity: model.enum(["Legendary", "Epic", "Rare", "Uncommon", "Common"]),
  // USD fair-market value — a DECIMAL (e.g. 19.2), never cents. bigNumber maps to
  // a numeric column; model.number() would map to integer and truncate the cents.
  market_value: model.bigNumber(),
  image: model.text(),
});

export default Card;

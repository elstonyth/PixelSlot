import { model } from "@medusajs/framework/utils";

// PackOdds — the gacha table: one row per (pack, card) with a relative weight.
// Pull chance = weight / Σ(weights in the pack). Admin-editable in Phase 6.
//
// References are stored by stable business keys (Pack.slug, Card.handle) rather
// than generated ids, so the seed needs no id round-trip and the store route
// joins them in-module (same-module JS join is fine; the cross-module-filter
// caveat in BUILD_PLAN only applies to linked modules).
export const PackOdds = model.define("pack_odds", {
  id: model.id().primaryKey(),
  pack_id: model.text(), // = Pack.slug
  card_id: model.text(), // = Card.handle
  weight: model.number(),
});

export default PackOdds;

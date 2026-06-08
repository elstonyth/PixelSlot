import { model } from "@medusajs/framework/utils";

// Pull — the ledger: one row per opened pack (the rolled result). Written by the
// open-pack workflow in Phase 5b; it is the source of truth for the live-pulls
// feed (Phase 7) and the leaderboard. Empty until 5b ships the workflow — the
// model lands now so 5a and 5b share a single migration.
//
// References use the same stable business keys as PackOdds (Pack.slug,
// Card.handle). `order_id` ties the pull to the Medusa order that paid for it
// (nullable until checkout is wired in 5b).
export const Pull = model.define("pull", {
  id: model.id().primaryKey(),
  customer_id: model.text(),
  pack_id: model.text(), // = Pack.slug
  card_id: model.text(), // = Card.handle (the won card)
  order_id: model.text().nullable(),
  rolled_at: model.dateTime(),
});

export default Pull;

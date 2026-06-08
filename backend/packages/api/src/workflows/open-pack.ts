import {
  createWorkflow,
  WorkflowResponse,
  transform,
} from "@medusajs/framework/workflows-sdk";
import { emitEventStep } from "@medusajs/medusa/core-flows";
import { rollPackStep } from "./steps/roll-pack";
import { recordPullStep } from "./steps/record-pull";

export type OpenPackInput = {
  pack_id: string; // = Pack.slug
  customer_id: string; // from the authenticated token — NEVER the request body
};

// open-pack — the gacha "open a pack" business process.
//
//   roll (validate + weighted draw)  →  [payment seam]  →  record pull  →  emit
//
// recordPull is the only side-effecting step and is compensated by delete, so a
// failure after it rolls the ledger row back (proven by the commit-gate test).
// The composition body stays pure: every derived value goes through transform()
// (no literals/conditionals/Date here — that all lives inside the steps).
export const openPackWorkflow = createWorkflow(
  "open-pack",
  function (input: OpenPackInput) {
    // 1. Validate the pack is active and roll a winner over its weighted odds.
    const card = rollPackStep(input);

    // ── PAYMENT SEAM ─────────────────────────────────────────────────────────
    // A future charge step slots in HERE, before the pull is recorded, so a
    // failed charge rolls back via recordPull's compensation and never leaves an
    // unpaid Pull row. Payment was dropped from this slice (2026-06-08 product
    // decision) and will land as a custom endpoint; inventory reserve lands with
    // it. Keeping the seam here makes that a single-step insertion.
    // ─────────────────────────────────────────────────────────────────────────

    // 2. Record the pull (the only mutation; compensated by delete on failure).
    const recordInput = transform({ input, card }, (d) => ({
      customer_id: d.input.customer_id,
      pack_id: d.input.pack_id,
      card_id: d.card.handle,
    }));
    const pull = recordPullStep(recordInput);

    // 3. Emit pack.opened for the live-pulls feed / leaderboard subscribers. The
    //    event only fires if the whole workflow succeeds (Medusa defers emission
    //    to commit), so a compensated run emits nothing.
    const eventData = transform({ input, card, pull }, (d) => ({
      pull_id: d.pull.id,
      pack_id: d.input.pack_id,
      card_id: d.card.handle,
      customer_id: d.input.customer_id,
    }));
    emitEventStep({ eventName: "pack.opened", data: eventData });

    const result = transform({ card, pull }, (d) => ({
      pull: d.pull,
      card: d.card,
    }));
    return new WorkflowResponse(result);
  }
);

export default openPackWorkflow;

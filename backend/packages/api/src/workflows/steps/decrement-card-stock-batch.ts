import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { PACKS_MODULE } from '../../modules/packs';
import type PacksModuleService from '../../modules/packs/service';
import { findCardInventoryTarget } from '../../modules/packs/card-stock';

export type DecrementCardStockBatchInput = {
  items: {
    card_id: string; // = Card.handle (=== Product.handle)
    pull_id: string; // The pull this earmark belongs to
  }[];
};

// Per-item compensation data — only populated when a unit was actually taken.
type ItemCompensate = { inventoryItemId: string; locationId: string };

// Compensation: the list of items where stock was decremented, so each can be
// restored +1 on rollback.
type CompensateData = ItemCompensate[];

// decrement-card-stock-batch — best-effort batch version of decrement-card-stock.
// Loops over input.items and earmarks one physical unit for each pull that won
// a card. STOCK IS NEVER A GATE: pulls must never fail because of inventory, so
// every error is caught and logged as a warning. The compensation list only
// contains entries for items that were actually decremented.
export const decrementCardStockBatchStep = createStep<
  DecrementCardStockBatchInput,
  void,
  CompensateData
>(
  'decrement-card-stock-batch',
  async (input: DecrementCardStockBatchInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const compensate: CompensateData = [];

    for (const item of input.items) {
      try {
        const target = await findCardInventoryTarget(container, item.card_id);
        // Untracked (null) or already at 0 — nothing to earmark; the pull is
        // fulfilled via buyback if the customer wants no/own physical card.
        if (target && target.stocked > 0) {
          const inventoryModule = container.resolve(Modules.INVENTORY);
          await inventoryModule.adjustInventory(
            target.inventoryItemId,
            target.locationId,
            -1,
          );
          compensate.push({
            inventoryItemId: target.inventoryItemId,
            locationId: target.locationId,
          });
          // Record that THIS pull took a unit — buyback only restores flagged
          // pulls (a 0-stock pull must never mint a phantom unit on sell-back).
          // If the flag write fails the counter errs LOW (no restore later) —
          // the conservative direction — so warn rather than fail the pull.
          const packs = container.resolve<PacksModuleService>(PACKS_MODULE);
          await packs.updatePulls([
            { id: item.pull_id, stock_earmarked: true },
          ]);
        }
      } catch (error) {
        logger.warn(
          `decrement-card-stock-batch: could not adjust stock for '${item.card_id}' — pull continues (buyback-only). ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return new StepResponse(undefined, compensate);
  },
  async (data: CompensateData, { container }) => {
    if (!data?.length) return;
    const inventoryModule = container.resolve(Modules.INVENTORY);
    for (const item of data) {
      await inventoryModule.adjustInventory(
        item.inventoryItemId,
        item.locationId,
        1,
      );
    }
  },
);

export default decrementCardStockBatchStep;

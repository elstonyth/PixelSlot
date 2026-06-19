import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import { PACKS_MODULE } from '../../modules/packs';
import type PacksModuleService from '../../modules/packs/service';

export type RecordPullsBatchInput = {
  customer_id: string;
  pack_id: string; // = Pack.slug
  card_ids: string[]; // = Card.handle[] (one per won card)
};

// Compensation data: the IDs of every pull row inserted, so we can delete
// them all if a later step in the workflow fails.
type CompensateData = { pullIds: string[] } | undefined;

// record-pulls-batch — insert N Pull rows in one shot (one per card_id), then
// return them all. Mirrors record-pull.ts but accepts an array. Compensation
// deletes every inserted row if a later step throws.
export const recordPullsBatchStep = createStep<
  RecordPullsBatchInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any[],
  CompensateData
>(
  'record-pulls-batch',
  async (input: RecordPullsBatchInput, { container }) => {
    const packs = container.resolve<PacksModuleService>(PACKS_MODULE);

    const pulls = await packs.createPulls(
      input.card_ids.map((card_id) => ({
        customer_id: input.customer_id,
        pack_id: input.pack_id,
        card_id,
        order_id: null,
        rolled_at: new Date(),
      })),
    );

    return new StepResponse(pulls, {
      pullIds: pulls.map((p: { id: string }) => p.id),
    });
  },
  async (data: CompensateData, { container }) => {
    if (!data?.pullIds?.length) return;
    const packs = container.resolve<PacksModuleService>(PACKS_MODULE);
    await packs.deletePulls(data.pullIds);
  },
);

export default recordPullsBatchStep;

import { createStep, StepResponse } from '@medusajs/framework/workflows-sdk';
import { PACKS_MODULE } from '../../modules/packs';
import type PacksModuleService from '../../modules/packs/service';
import { rollOne, type RolledCard } from './roll-pack';

export type RollPackBatchInput = { pack_id: string; count: number };

// Read-only (no compensation). Loops INSIDE the step (the workflow body can't
// loop). N independent draws — win-rate lock holds per roll.
export const rollPackBatchStep = createStep(
  'roll-pack-batch',
  async (input: RollPackBatchInput, { container }) => {
    const packs = container.resolve<PacksModuleService>(PACKS_MODULE);
    const cards: RolledCard[] = [];
    for (let i = 0; i < input.count; i++) cards.push(await rollOne(packs, input.pack_id));
    return new StepResponse(cards);
  },
);

export default rollPackBatchStep;

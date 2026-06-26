import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { drawRewardBoxWorkflow } from '../../../../workflows/draw-reward-box';
import { rewardsRedemptionEnabled } from '../../../../modules/packs/rewards-gate';

// POST /store/rewards/draw — open today's reward box. The whole daily-capped draw
// (tier resolve → cap COUNT → drawPrize → payout → reward_draw INSERT) runs in the
// settle step under the per-customer credit: lock; the inventory earmark runs after
// it commits. The result carries {status, prize?, draw_ordinal?}.
//
// FAIL-CLOSED GATE: the redemption gate is the FIRST line — a 403 returns BEFORE
// the workflow runs (no reward_draw row written) while REWARDS_REDEMPTION_ENABLED
// is unset (spec §13).
//
// AUTH + RATE LIMIT: registered in api/middlewares.ts. The customer id comes ONLY
// from the verified bearer token, never the body.
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  if (!rewardsRedemptionEnabled()) {
    res.status(403).json({ message: 'Reward redemption is not enabled.' });
    return;
  }

  const customerId = req.auth_context?.actor_id;
  if (!customerId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, 'Unauthorized');
  }

  const { result } = await drawRewardBoxWorkflow(req.scope).run({
    input: { customer_id: customerId },
  });

  res.json(result);
}

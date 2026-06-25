import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { PACKS_MODULE } from '../../../modules/packs';
import type PacksModuleService from '../../../modules/packs/service';

// GET /store/rewards — the logged-in customer's reward-economy state in one read:
//   - grants:  claimable VIP reward grants (status 'granted'), newest first.
//   - draw:    today's draw progress (drawn_today / draws_per_day) so the UI can
//              show "x of y boxes opened today" without a second call.
//   - prizes:  vaulted reward Pulls (source='reward'), rendered from the matching
//              reward_draw.prize_snapshot (the same shape the vault route emits).
//
// AUTH + RATE LIMIT: registered in api/middlewares.ts (authenticate() then the
// store-read limiter). The customer id comes ONLY from the verified bearer token,
// so a caller can never read another customer's rewards.
const GRANT_LIMIT = 200;
const PRIZE_LIMIT = 500;

export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const customerId = req.auth_context?.actor_id;
  if (!customerId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, 'Unauthorized');
  }

  const packs = req.scope.resolve<PacksModuleService>(PACKS_MODULE);
  const drawDay = new Date().toISOString().slice(0, 10);

  const [grantRows, todaysDraws, rewardPulls] = await Promise.all([
    packs.listVipRewardGrants(
      { customer_id: customerId, status: 'granted' },
      { order: { level: 'DESC' }, take: GRANT_LIMIT },
    ),
    packs.listRewardDraws(
      { customer_id: customerId, draw_day: drawDay },
      { take: 1000 },
    ),
    packs.listPulls(
      { customer_id: customerId, status: 'vaulted', source: 'reward' },
      { order: { rolled_at: 'DESC' }, take: PRIZE_LIMIT },
    ),
  ]);

  const grants = grantRows.map((g) => ({
    id: g.id,
    level: g.level,
    kind: g.kind as string,
    payload: g.payload,
    status: g.status as string,
  }));

  // Draw state: how many boxes the customer opened today. The per-day cap is a
  // per-pool value resolved against the tier box inside settleRewardDraw — NOT a
  // global setting — so it's intentionally not surfaced here; the storefront
  // reads the cap from the draw response when it actually opens a box.
  // ponytail: drawn_today is the one cheap signal; don't re-resolve the tier box
  // pack just to echo a cap — add that here only if the UI proves it needs it.
  const draw = { drawn_today: todaysDraws.length };

  // Vaulted reward prizes, rendered from prize_snapshot (no Card row exists for a
  // reward Pull). Batch-load the matching reward_draw rows keyed by vault_pull_id.
  const pullIds = rewardPulls.map((p) => p.id);
  const drawRows = pullIds.length
    ? await packs.listRewardDraws(
        { vault_pull_id: pullIds },
        { take: pullIds.length },
      )
    : [];
  const drawByPullId = new Map(drawRows.map((d) => [d.vault_pull_id, d]));

  const prizes = rewardPulls
    .map((p) => {
      const d = drawByPullId.get(p.id);
      if (!d) return null;
      const snap = d.prize_snapshot as { title?: string; image?: string };
      return {
        pull_id: p.id,
        rolled_at: p.rolled_at,
        title: snap.title ?? '',
        image: snap.image ?? '',
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  res.json({ grants, draw, prizes });
}

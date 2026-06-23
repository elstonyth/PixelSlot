import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError, Modules } from '@medusajs/framework/utils';
import { PACKS_MODULE } from '../../../modules/packs';
import type PacksModuleService from '../../../modules/packs/service';
import { HANDLE_RE } from '../../../utils/profile-handle';

type Body = { sponsor_id?: unknown };

// GET /store/referral — the authenticated customer's referral summary.
//
// Privacy: directRecruits entries expose ONLY { handle, contribution } on the
// wire — raw customerId is NEVER emitted. Handle resolution is a no-N+1
// batch (listCustomers with an id[] filter), mirroring the leaderboard pattern.
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const customerId = req.auth_context?.actor_id;
  if (!customerId) {
    throw new MedusaError(MedusaError.Types.UNAUTHORIZED, 'Unauthorized');
  }

  const packs = req.scope.resolve<PacksModuleService>(PACKS_MODULE);
  const s = await packs.referralSummary(customerId);

  // Batch-resolve handles for all gen-1 recruits in a single listCustomers
  // call — no N+1. Pattern mirrors store/leaderboard/route.ts:47-62.
  const ids = s.directRecruits.map((r) => r.customerId);
  const customerService = req.scope.resolve(Modules.CUSTOMER);
  const customers = ids.length
    ? await customerService.listCustomers({ id: ids }, { take: ids.length })
    : [];
  const handleById = new Map(
    customers.map((c) => {
      const handle = (c.metadata ?? {})['handle'];
      return [
        c.id,
        typeof handle === 'string' && HANDLE_RE.test(handle) ? handle : null,
      ];
    }),
  );

  res.json({
    directRecruits: s.directRecruits.map((r) => ({
      handle: handleById.get(r.customerId) ?? null,
      contribution: r.contribution,
    })),
    downstreamCount: s.downstreamCount,
    totalEarned: s.totalEarned,
  });
}

// POST /store/referral — the recruit sets their sponsor. recruitId is the
// verified token actor (NEVER the body); sponsor_id is the body. linkSponsor
// enforces self-referral / cycle / immutability under a dual-id lock.
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const recruitId = req.auth_context.actor_id;
  const sponsorId = (req.body as Body)?.sponsor_id;
  if (typeof sponsorId !== 'string' || sponsorId.length === 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'sponsor_id is required.',
    );
  }

  const packs = req.scope.resolve<PacksModuleService>(PACKS_MODULE);
  const { id } = await packs.linkSponsor({ recruitId, sponsorId });
  res.status(201).json({ id });
}

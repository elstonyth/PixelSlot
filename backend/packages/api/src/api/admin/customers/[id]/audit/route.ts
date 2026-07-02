import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { PACKS_MODULE } from '../../../../../modules/packs';
import type PacksModuleService from '../../../../../modules/packs/service';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { id } = req.params;
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);
  // Reject clearly-invalid pagination at the boundary (the service also clamps,
  // so this is hygiene, not a live DoS) — NaN/negative/absurd → 400.
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'limit must be an integer in [1, 200].',
    );
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'offset must be an integer >= 0.',
    );
  }
  const packs = req.scope.resolve<PacksModuleService>(PACKS_MODULE);
  res.json(await packs.auditForCustomer(id, { limit, offset }));
}

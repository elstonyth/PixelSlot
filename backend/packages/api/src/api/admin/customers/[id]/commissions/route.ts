import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules, MedusaError } from '@medusajs/framework/utils';
import type { ICustomerModuleService } from '@medusajs/framework/types';
import { PACKS_MODULE } from '../../../../../modules/packs';
import type PacksModuleService from '../../../../../modules/packs/service';
import { enrichCustomers } from '../../../../../utils/enrich-customers';

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
  const rows = await packs.commissionsForBeneficiary(id, { limit, offset });

  const openerIds = [...new Set(rows.map((r) => r.opener_customer_id).filter(Boolean) as string[])];
  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER);
  const idMap = await enrichCustomers(openerIds, customerService);

  res.json({
    commissions: rows.map((r) => ({
      id: r.id, generation: r.generation, kind: r.kind, status: r.status,
      amount: r.amount, reason: r.reason, matures_at: r.matures_at,
      reversal_transaction_id: r.reversal_transaction_id,
      source_transaction_id: r.source_transaction_id,
      opener: {
        customer_id: r.opener_customer_id,
        handle: r.opener_customer_id ? (idMap.get(r.opener_customer_id)?.handle ?? null) : null,
      },
      created_at: r.created_at,
    })),
  });
}

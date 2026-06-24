import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import type { ICustomerModuleService } from '@medusajs/framework/types';
import { PACKS_MODULE } from '../../../../../modules/packs';
import type PacksModuleService from '../../../../../modules/packs/service';
import { HANDLE_RE } from '../../../../../utils/profile-handle';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { id } = req.params;
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);

  const packs = req.scope.resolve<PacksModuleService>(PACKS_MODULE);
  const rows = await packs.commissionsForBeneficiary(id, { limit, offset });

  const openerIds = [...new Set(rows.map((r) => r.opener_customer_id).filter(Boolean) as string[])];
  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER);
  const customers = openerIds.length
    ? await customerService.listCustomers({ id: openerIds }, { take: openerIds.length })
    : [];
  const handleById = new Map(customers.map((c) => {
    const h = (c.metadata ?? {})['handle'];
    return [c.id, typeof h === 'string' && HANDLE_RE.test(h) ? h : null];
  }));

  res.json({
    commissions: rows.map((r) => ({
      id: r.id, generation: r.generation, kind: r.kind, status: r.status,
      amount: r.amount, reason: r.reason, matures_at: r.matures_at,
      reversal_transaction_id: r.reversal_transaction_id,
      source_transaction_id: r.source_transaction_id,
      opener: {
        customer_id: r.opener_customer_id,
        handle: r.opener_customer_id ? (handleById.get(r.opener_customer_id) ?? null) : null,
      },
      created_at: r.created_at,
    })),
  });
}

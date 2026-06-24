import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import type { ICustomerModuleService } from '@medusajs/framework/types';
import { PACKS_MODULE } from '../../../../../modules/packs';
import type PacksModuleService from '../../../../../modules/packs/service';
import type { PacksTreeNode } from '../../../../../modules/packs/service';
import { HANDLE_RE } from '../../../../../utils/profile-handle';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { id } = req.params;
  const maxDepth = Number(req.query.maxDepth ?? 6);

  const customerService = req.scope.resolve<ICustomerModuleService>(Modules.CUSTOMER);
  const [customer] = await customerService.listCustomers({ id }, { take: 1 });
  if (!customer) { res.status(404).json({ message: `Customer '${id}' not found` }); return; }

  const packs = req.scope.resolve<PacksModuleService>(PACKS_MODULE);
  const tree = await packs.referralTreeFor(id, maxDepth);

  const ids = [tree.root.customer_id, ...tree.nodes.map((n) => n.customer_id)];
  const customers = ids.length
    ? await customerService.listCustomers({ id: ids }, { take: ids.length })
    : [];
  const byId = new Map(customers.map((c) => {
    const handle = (c.metadata ?? {})['handle'];
    return [c.id, {
      handle: typeof handle === 'string' && HANDLE_RE.test(handle) ? handle : null,
      email: c.email ?? null,
      created_at: c.created_at ?? null,
    }];
  }));
  const merge = (n: PacksTreeNode) => ({ ...n, ...(byId.get(n.customer_id) ?? { handle: null, email: null, created_at: null }) });

  res.json({ root: merge(tree.root), nodes: tree.nodes.map(merge), maxDepth: tree.maxDepth, truncated: tree.truncated });
}

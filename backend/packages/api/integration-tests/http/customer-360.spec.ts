import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import { PACKS_MODULE } from '../../src/modules/packs';
import type PacksModuleService from '../../src/modules/packs/service';
import { mintSuperAdmin, unwrapResponse } from './utils';
import { VIP_LEVELS } from '../../src/scripts/vip-levels.data';

jest.setTimeout(240 * 1000);
const PASSWORD = 'customer360-pw-1';

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    let storeHeaders: Record<string, string>;
    let adminToken: string;

    beforeEach(async () => {
      const container = getContainer();
      const apiKey = container.resolve(Modules.API_KEY);
      const key = await apiKey.createApiKeys({ title: 'c360-test', type: 'publishable', created_by: 'c360-test' });
      storeHeaders = { 'x-publishable-api-key': key.token };
      adminToken = await mintSuperAdmin(container, api, 'c360-admin@test.dev', PASSWORD);
    });

    const adminHeaders = () => ({ authorization: `Bearer ${adminToken}` });
    const registerCustomer = async (email: string): Promise<string> => {
      const reg = await api.post('/auth/customer/emailpass/register', { email, password: PASSWORD });
      const created = await api.post('/store/customers', { email },
        { headers: { ...storeHeaders, authorization: `Bearer ${reg.data.token}` } });
      return created.data.customer.id;
    };
    async function seedLadder(packs: PacksModuleService) {
      const existing = await packs.listVipLevels({}, { take: 1 });
      if (existing.length === 0) {
        await packs.createVipLevels(VIP_LEVELS.map((r) => ({
          level: r.level, spend_threshold: r.spend_threshold, voucher_amount: r.voucher_amount,
          box_tier: r.box_tier, frame_unlock: r.frame_unlock, direct_referral_pct: r.direct_referral_pct,
          prizes: r.prizes ?? null,
        })));
      }
    }

    describe('GET /admin/customers/:id/referral-tree', () => {
      it('200 with root + descendant nodes carrying handle/email keys', async () => {
        const rootId = await registerCustomer('c360-root@test.dev');
        const packs = getContainer().resolve<PacksModuleService>(PACKS_MODULE);
        await seedLadder(packs);
        await packs.linkSponsor({ recruitId: 'c360_b', sponsorId: rootId });
        await packs.linkSponsor({ recruitId: 'c360_c', sponsorId: 'c360_b' });

        const res = await unwrapResponse(
          api.get(`/admin/customers/${rootId}/referral-tree?maxDepth=2`, { headers: adminHeaders() }));
        expect(res.status).toBe(200);
        expect(res.data.root.customer_id).toBe(rootId);
        expect(res.data.maxDepth).toBe(2);
        const ids = res.data.nodes.map((n: any) => n.customer_id).sort();
        expect(ids).toEqual(['c360_b', 'c360_c']);
        for (const n of res.data.nodes) {
          expect(n).toHaveProperty('handle');   // route-merged identity keys (null when no real customer)
          expect(n).toHaveProperty('email');
        }
      });
    });

    // Task 9 appends `describe('GET /admin/customers/:id/audit', ...)` here.

    describe('GET /admin/customers/:id/commissions', () => {
      it('shows the direct commission (opener = recruit), then status reversed after reverseOpen', async () => {
        const sponsorId = await registerCustomer('c360-sponsor@test.dev');
        const recruitId = await registerCustomer('c360-recruit@test.dev');
        const packs = getContainer().resolve<PacksModuleService>(PACKS_MODULE);
        await seedLadder(packs);                  // REQUIRED before settleOpen
        await packs.linkSponsor({ recruitId, sponsorId });
        await packs.mutateCreditAtomic({ customerId: recruitId, amount: 30, reason: 'topup' });
        await packs.settleOpen({ customerId: recruitId, amount: -20, sourceTransactionId: 'c360_open_1' });

        const res = await unwrapResponse(api.get(`/admin/customers/${sponsorId}/commissions`, { headers: adminHeaders() }));
        expect(res.status).toBe(200);
        expect(res.data.commissions).toHaveLength(1);
        expect(res.data.commissions[0].opener.customer_id).toBe(recruitId);  // gen-1 opener = recruit
        expect(res.data.commissions[0].status).not.toBe('reversed');

        await packs.reverseOpen('c360_open_1');
        const after = await unwrapResponse(api.get(`/admin/customers/${sponsorId}/commissions`, { headers: adminHeaders() }));
        expect(after.data.commissions).toHaveLength(1);   // amount<0 guard → no 2-row fan-out
        expect(after.data.commissions[0].status).toBe('reversed');
      });
    });
  },
});

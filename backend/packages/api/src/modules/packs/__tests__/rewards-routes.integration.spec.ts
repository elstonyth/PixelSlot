/**
 * D1 — Store reward routes + fail-closed gate (integration:modules)
 *
 * The route handlers are imported and called directly with a mock req/res (the
 * same pattern as the C2/C3 vault + profile route tests) — moduleIntegrationTestRunner
 * has no HTTP server, but it does give a real PacksModuleService, which is all the
 * handlers touch. The auth/rate-limit middleware is registered in api/middlewares.ts
 * and is OUT OF SCOPE here: these tests verify the handler bodies, with actor id
 * supplied via auth_context (never the body).
 *
 * Gate contract (spec §13, fail-closed):
 *  - REWARDS_REDEMPTION_ENABLED unset → POST /store/rewards/claim/:id and
 *    POST /store/rewards/draw return 403 BEFORE any write: the grant stays
 *    'granted' and COUNT(reward_draw)===0 (proves the gate is the first line).
 *  - POST /store/rewards/withdraw is NOT env-gated (balance-neutral; only the
 *    withdrawals_per_day cap inside recordRewardWithdrawal applies). With the
 *    env unset it still ships a vaulted reward Pull → 'requested'.
 *  - GET /store/rewards returns claimable grants + draw state + vaulted prizes.
 *
 * Test-runner caveat: moduleIntegrationTestRunner rebuilds schema from MODELS, so
 * hand-written CHECK/partial-unique constraints are ABSENT here; runtime logic only.
 *
 * Path note: this lives under src/modules/packs/__tests__ (not src/api/__tests__)
 * so the integration:modules testMatch (`**\/src/modules/*\/__tests__/**`) actually
 * runs it — a file under src/api would match no test type and silently never run.
 */

import path from 'path';
import { moduleIntegrationTestRunner } from '@medusajs/test-utils';
import { PACKS_MODULE } from '../index';
import type PacksModuleService from '../service';
import Pack from '../models/pack';
import Card from '../models/card';
import PackOdds from '../models/pack-odds';
import Pull from '../models/pull';
import CreditTransaction from '../models/credit-transaction';
import DeliveryOrder from '../models/delivery-order';
import DeliveryOrderItem from '../models/delivery-order-item';
import VipLevel from '../models/vip-level';
import RewardsSettings from '../models/rewards-settings';
import ReferralRelationship from '../models/referral-relationship';
import Commission from '../models/commission';
import CustomerAccountState from '../models/customer-account-state';
import AdminActionAudit from '../models/admin-action-audit';
import VipMemberState from '../models/vip-member-state';
import VipRewardGrant from '../models/vip-reward-grant';
import NotificationRead from '../models/notification-read';
import RewardDraw from '../models/reward-draw';

import { GET as rewardsGET } from '../../../api/store/rewards/route';
import { POST as claimPOST } from '../../../api/store/rewards/claim/[grantId]/route';
import { POST as drawPOST } from '../../../api/store/rewards/draw/route';
import { POST as withdrawPOST } from '../../../api/store/rewards/withdraw/route';
import { Modules } from '@medusajs/framework/utils';

jest.setTimeout(300 * 1000);

const today = () => new Date().toISOString().slice(0, 10);

// A complete, snapshot-able shipping address (matches snapshotAddress' required
// fields). The route resolves this from the customer's address book; here the
// stubbed CUSTOMER module hands it back keyed by id+customer_id.
const ADDRESS = {
  id: 'addr_d1',
  first_name: 'Ada',
  last_name: 'Lovelace',
  address_1: '1 Analytical Engine Way',
  city: 'Kuala Lumpur',
  postal_code: '50000',
  country_code: 'my',
};

moduleIntegrationTestRunner<PacksModuleService>({
  moduleName: PACKS_MODULE,
  resolve: path.resolve(__dirname, '../../..', 'modules/packs'),
  moduleModels: [
    Pack,
    Card,
    PackOdds,
    Pull,
    CreditTransaction,
    DeliveryOrder,
    DeliveryOrderItem,
    VipLevel,
    RewardsSettings,
    ReferralRelationship,
    Commission,
    CustomerAccountState,
    AdminActionAudit,
    VipMemberState,
    VipRewardGrant,
    NotificationRead,
    RewardDraw,
  ],
  testSuite: ({ service }) => {
    // Build a mock req/res. scope.resolve returns the real packs service for
    // PACKS_MODULE and a stub CUSTOMER module (the address book) — mirrors the
    // C3 profile-route test's cross-module stub.
    type ResCapture = { status?: number; body?: unknown };
    const makeReqRes = (opts: {
      customerId?: string;
      params?: Record<string, string>;
      body?: unknown;
      addresses?: Array<Record<string, unknown>>;
    }) => {
      const captured: ResCapture = {};
      const res = {
        status(code: number) {
          captured.status = code;
          return this;
        },
        json(body: unknown) {
          captured.body = body;
          return this;
        },
      };
      const stubCustomerModule = {
        listCustomerAddresses: async (
          selector: { id?: string; customer_id?: string },
        ) =>
          (opts.addresses ?? []).filter(
            (a) =>
              (!selector.id || a.id === selector.id) &&
              (!selector.customer_id || a.customer_id === selector.customer_id),
          ),
      };
      const req = {
        auth_context: { actor_id: opts.customerId },
        params: opts.params ?? {},
        body: opts.body,
        scope: {
          resolve: (name: string) =>
            name === Modules.CUSTOMER ? stubCustomerModule : service,
        },
      };
      return { req, res, captured };
    };

    const seedVoucherGrant = async (customerId: string) => {
      const [grant] = await service.createVipRewardGrants([
        {
          customer_id: customerId,
          level: 10,
          kind: 'voucher',
          payload: { amount_myr: 25 },
          status: 'granted',
        },
      ]);
      return grant;
    };

    const seedRewardPull = async (customerId: string) => {
      const [pull] = await service.createPulls([
        {
          customer_id: customerId,
          pack_id: 'reward-box-c',
          card_id: 'prize-handle',
          order_id: null,
          rolled_at: new Date(),
          source: 'reward',
        },
      ]);
      await service.updatePulls([{ id: pull.id, status: 'vaulted' as const }]);
      await service.createRewardDraws([
        {
          customer_id: customerId,
          tier: 'c',
          draw_day: today(),
          draw_ordinal: 1,
          prize_kind: 'product',
          prize_snapshot: {
            product_handle: 'prize-handle',
            title: 'D1 Prize',
            image: 'https://cdn.example.com/d1.png',
          },
          vault_pull_id: pull.id,
          credit_txn_id: null,
          status: 'drawn',
        },
      ]);
      return pull;
    };

    describe('D1 — fail-closed gate (REWARDS_REDEMPTION_ENABLED unset)', () => {
      const prev = process.env.REWARDS_REDEMPTION_ENABLED;
      beforeAll(() => {
        delete process.env.REWARDS_REDEMPTION_ENABLED;
      });
      afterAll(() => {
        if (prev === undefined) delete process.env.REWARDS_REDEMPTION_ENABLED;
        else process.env.REWARDS_REDEMPTION_ENABLED = prev;
      });

      it('POST /rewards/claim/:id → 403 and the grant stays granted (no write)', async () => {
        const customerId = 'cus_d1_claim';
        const grant = await seedVoucherGrant(customerId);

        const { req, res, captured } = makeReqRes({
          customerId,
          params: { grantId: grant.id },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await claimPOST(req as any, res as any);

        expect(captured.status).toBe(403);

        // Proves the gate ran BEFORE claimReward: status untouched.
        const [after] = await service.listVipRewardGrants(
          { id: grant.id },
          { take: 1 },
        );
        expect(after.status).toBe('granted');
      });

      it('POST /rewards/draw → 403 and COUNT(reward_draw)===0 (no write)', async () => {
        const customerId = 'cus_d1_draw';

        const { req, res, captured } = makeReqRes({ customerId });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await drawPOST(req as any, res as any);

        expect(captured.status).toBe(403);

        // Proves the gate ran BEFORE settleRewardDraw: no draw row written.
        const draws = await service.listRewardDraws(
          { customer_id: customerId },
          { take: 10 },
        );
        expect(draws).toHaveLength(0);
      });

      it('POST /rewards/withdraw is NOT gated → ships a vaulted reward Pull', async () => {
        const customerId = 'cus_d1_wd';
        const pull = await seedRewardPull(customerId);

        const { req, res, captured } = makeReqRes({
          customerId,
          body: { pull_id: pull.id, address_id: ADDRESS.id },
          addresses: [{ ...ADDRESS, customer_id: customerId }],
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await withdrawPOST(req as any, res as any);

        expect((captured.body as { status: string }).status).toBe('requested');
        const [after] = await service.listPulls({ id: pull.id }, { take: 1 });
        expect(after.status).toBe('delivering');
      });

      it('POST /rewards/withdraw rejects a foreign / unknown address (404)', async () => {
        const customerId = 'cus_d1_wd_foreign';
        const pull = await seedRewardPull(customerId);

        const { req, res, captured } = makeReqRes({
          customerId,
          body: { pull_id: pull.id, address_id: ADDRESS.id },
          // Address belongs to someone else → ownership-scoped lookup misses.
          addresses: [{ ...ADDRESS, customer_id: 'someone_else' }],
        });
        let threw = false;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await withdrawPOST(req as any, res as any);
        } catch {
          threw = true;
        }
        // Either a 404 status or a thrown NOT_FOUND MedusaError is acceptable;
        // the load-bearing assertion is that the Pull was NOT shipped.
        expect(threw || captured.status === 404).toBe(true);
        const [after] = await service.listPulls({ id: pull.id }, { take: 1 });
        expect(after.status).toBe('vaulted');
      });
    });

    describe('GET /store/rewards', () => {
      it('returns claimable grants + draw state + vaulted prizes', async () => {
        const customerId = 'cus_d1_get';
        const grant = await seedVoucherGrant(customerId);
        const pull = await seedRewardPull(customerId);

        const { req, res, captured } = makeReqRes({ customerId });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await rewardsGET(req as any, res as any);

        const body = captured.body as {
          grants: Array<{ id: string; status: string }>;
          draw: { drawn_today: number };
          prizes: Array<{ pull_id: string }>;
        };

        // Claimable grant present (status 'granted').
        expect(body.grants.some((g) => g.id === grant.id)).toBe(true);
        // Draw state: the one seeded reward_draw counts as today's draw.
        expect(body.draw.drawn_today).toBe(1);
        // Vaulted prize rendered from the reward Pull.
        expect(body.prizes.some((p) => p.pull_id === pull.id)).toBe(true);
      });
    });
  },
});

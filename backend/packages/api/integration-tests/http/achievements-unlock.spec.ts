/**
 * achievements-unlock — integration:http
 *
 * End-to-end gate for the achievementsSpendSettledHandler subscriber:
 *   1. Seed the `cases_opened_1` achievement def.
 *   2. Register a real Medusa customer, top up credit, and open a pack via
 *      the real HTTP route (POST /store/packs/:slug/open).
 *   3. The open-pack workflow emits vip.spend_settled → both subscribers
 *      run (vip-spend-settled + achievements-spend-settled).
 *   4. Assert: listAchievementGrants contains cases_opened_1 and
 *      listAchievementMemberStates shows total_xp >= 50.
 *
 * Mirrors vip-2a-e2e.spec.ts: real HTTP open, getContainer() for seeding
 * and post-open state reads.
 */

import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import { PACKS_MODULE } from '../../src/modules/packs';
import type PacksModuleService from '../../src/modules/packs/service';
import { VIP_LEVELS } from '../../src/scripts/vip-levels.data';
import { unwrapResponse } from './utils';

jest.setTimeout(240 * 1000);

const PASSWORD = 'ach-e2e-pw1';
const PACK_SLUG = 'ach-e2e-pack';
const CARD_HANDLE = 'ach-e2e-card';
const PACK_PRICE = 10;

// Poll an async read until `done` holds or the budget runs out, then return the
// last value (so the caller's expect() produces a readable diff on timeout).
// For asserting local-event-bus subscriber effects, which run post-response.
async function waitFor<T>(
  read: () => Promise<T>,
  done: (v: T) => boolean,
  { tries = 25, delayMs = 200 }: { tries?: number; delayMs?: number } = {},
): Promise<T> {
  let last = await read();
  for (let i = 0; i < tries && !done(last); i++) {
    await new Promise((r) => setTimeout(r, delayMs));
    last = await read();
  }
  return last;
}

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    // Seed the VIP ladder (required by settleOpen → levelForSpend).
    async function seedLadder(packs: PacksModuleService) {
      const existing = await packs.listVipLevels({}, { take: 1 });
      if (existing.length === 0) {
        await packs.createVipLevels(
          VIP_LEVELS.map((r) => ({
            level: r.level,
            spend_threshold: r.spend_threshold,
            voucher_amount: r.voucher_amount,
            box_tier: r.box_tier,
            frame_unlock: r.frame_unlock,
            direct_referral_pct: r.direct_referral_pct,
            prizes: r.prizes ?? null,
          })),
        );
      }
    }

    // Seed the achievement def needed for this test (idempotent).
    async function seedAchievementDef(packs: PacksModuleService) {
      const existing = await packs.listAchievementDefs(
        { key: 'cases_opened_1' },
        { take: 1 },
      );
      if (existing.length === 0) {
        await packs.createAchievementDefs([
          {
            key: 'cases_opened_1',
            name: 'First Pull',
            description: 'Open your first case',
            category: 'cases_opened',
            rarity: 'Common',
            xp: 50,
            metric: 'cases_opened',
            threshold: 1,
          },
        ]);
      }
    }

    // Seed the minimal pack fixture needed for the HTTP open route.
    async function seedPack(packs: PacksModuleService) {
      const existing = await packs.listPacks(
        { slug: PACK_SLUG },
        { take: 1 },
      );
      if (existing.length === 0) {
        await packs.createPacks([
          {
            slug: PACK_SLUG,
            title: 'Ach E2E Pack',
            category: 'pokemon',
            price: PACK_PRICE,
            image: '/cdn/ach-e2e-pack.webp',
            buyback_percent: 90,
          },
        ]);
        await packs.createCards([
          {
            handle: CARD_HANDLE,
            name: 'Ach E2E Card PSA 10',
            set: 'Ach E2E Set',
            grader: 'PSA',
            grade: '10',
            market_value: 50,
            image: '/cdn/ach-e2e-card.webp',
          },
        ]);
        await packs.createPackOdds([
          {
            pack_id: PACK_SLUG,
            card_id: CARD_HANDLE,
            weight: 100,
            locked: false,
            rarity: 'Rare' as const,
          },
        ]);
      }
    }

    async function mintStoreHeaders(): Promise<Record<string, string>> {
      const apiKeyModule = getContainer().resolve(Modules.API_KEY);
      const key = await apiKeyModule.createApiKeys({
        title: 'ach-e2e-test',
        type: 'publishable',
        created_by: 'ach-e2e-test',
      });
      return { 'x-publishable-api-key': key.token };
    }

    async function registerAndLogin(
      email: string,
      storeHeaders: Record<string, string>,
    ): Promise<{ token: string; actorId: string }> {
      const reg = await api.post('/auth/customer/emailpass/register', {
        email,
        password: PASSWORD,
      });
      const created = await api.post(
        '/store/customers',
        { email },
        {
          headers: {
            ...storeHeaders,
            authorization: `Bearer ${reg.data.token}`,
          },
        },
      );
      const login = await api.post('/auth/customer/emailpass', {
        email,
        password: PASSWORD,
      });
      return {
        token: login.data.token as string,
        actorId: created.data.customer.id as string,
      };
    }

    it(
      'pack open via HTTP triggers achievements-spend-settled: cases_opened_1 granted with 50 XP',
      async () => {
        const packs = getContainer().resolve<PacksModuleService>(PACKS_MODULE);

        await seedLadder(packs);
        await seedAchievementDef(packs);
        await seedPack(packs);

        const storeHeaders = await mintStoreHeaders();
        const customer = await registerAndLogin(
          'ach-e2e-customer@pokenic.test',
          storeHeaders,
        );

        // Top up the customer with enough credit to open one pack.
        await packs.mutateCreditAtomic({
          customerId: customer.actorId,
          amount: PACK_PRICE * 2,
          reason: 'topup',
          reference: 'mock_ach_e2e',
        });

        // Open via the real HTTP route — triggers open-pack workflow which
        // emits vip.spend_settled → achievements-spend-settled subscriber runs.
        const openRes = await unwrapResponse(
          api.post(
            `/store/packs/${PACK_SLUG}/open`,
            {},
            {
              headers: {
                ...storeHeaders,
                authorization: `Bearer ${customer.token}`,
              },
            },
          ),
        );
        expect(openRes.status).toBe(200);
        expect(openRes.data.price).toBe(PACK_PRICE);

        // emitEventStep dispatches vip.spend_settled post-commit and the local
        // event bus runs subscribers on the next tick — NOT awaited by the HTTP
        // response. Poll for the grant (the subscriber completes in ms; cap at
        // ~5s so a regression fails loudly instead of hanging).
        const grants = await waitFor(
          () => packs.listAchievementGrants({ customer_id: customer.actorId }),
          (rows) =>
            rows.some(
              (g: { achievement_key: string }) =>
                g.achievement_key === 'cases_opened_1',
            ),
        );
        const keys = grants.map(
          (g: { achievement_key: string }) => g.achievement_key,
        );
        expect(keys).toContain('cases_opened_1');

        // Member state must reflect >= 50 XP (the cases_opened_1 award).
        const states = await packs.listAchievementMemberStates({
          customer_id: customer.actorId,
        });
        expect(states.length).toBeGreaterThan(0);
        expect(Number(states[0].total_xp)).toBeGreaterThanOrEqual(50);
      },
    );
  },
});

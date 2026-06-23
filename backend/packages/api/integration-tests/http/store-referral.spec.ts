import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import { unwrapResponse } from './utils';

jest.setTimeout(180 * 1000);

// Task 6 — GET /store/referral
//
// Security invariants:
//   1. An unauthenticated GET must be 401 (not 200/unprotected), asserting the
//      separate GET middleware entry works — the existing /store/referral entry
//      pins method:'POST', so an unguarded GET would fall through unprotected.
//   2. The response NEVER leaks raw customerId on the wire: every directRecruits
//      entry has exactly the keys ['contribution', 'handle'] and nothing more.

const PASSWORD = 'store-referral-get-pw-1';

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe('GET /store/referral', () => {
      let storeHeaders: Record<string, string>;
      let customerToken: string;

      beforeEach(async () => {
        const container = getContainer();

        const apiKeyModule = container.resolve(Modules.API_KEY);
        const key = await apiKeyModule.createApiKeys({
          title: 'store-referral-get-test',
          type: 'publishable',
          created_by: 'store-referral-get-test',
        });
        storeHeaders = { 'x-publishable-api-key': key.token };

        // Register + login a customer.
        const reg = await api.post('/auth/customer/emailpass/register', {
          email: 'store-referral-get-a@test.dev',
          password: PASSWORD,
        });
        await api.post(
          '/store/customers',
          { email: 'store-referral-get-a@test.dev' },
          {
            headers: {
              ...storeHeaders,
              authorization: `Bearer ${reg.data.token}`,
            },
          },
        );
        const login = await api.post('/auth/customer/emailpass', {
          email: 'store-referral-get-a@test.dev',
          password: PASSWORD,
        });
        customerToken = login.data.token as string;
      });

      const authed = (token: string): Record<string, string> => ({
        ...storeHeaders,
        authorization: `Bearer ${token}`,
      });

      it('GET /store/referral is auth-protected and omits raw recruit ids', async () => {
        // Unauthenticated GET must be 401 — asserts the separate GET middleware
        // entry is present (the POST entry alone would leave GET unguarded).
        const unauthRes = await unwrapResponse(
          api.get('/store/referral', { headers: storeHeaders }),
        );
        expect(unauthRes.status).toBe(401);

        // Authenticated GET must return 200 with the referral summary shape.
        const res = await unwrapResponse(
          api.get('/store/referral', { headers: authed(customerToken) }),
        );
        expect(res.status).toBe(200);
        expect(res.data).toMatchObject({
          downstreamCount: expect.any(Number),
          totalEarned: expect.any(Number),
        });
        expect(Array.isArray(res.data.directRecruits)).toBe(true);

        // Privacy invariant: no customerId on the wire — every directRecruits
        // entry must have EXACTLY ['contribution', 'handle'] and nothing else.
        for (const r of res.data.directRecruits) {
          expect(Object.keys(r).sort()).toEqual(['contribution', 'handle']);
        }
      });
    });
  },
});

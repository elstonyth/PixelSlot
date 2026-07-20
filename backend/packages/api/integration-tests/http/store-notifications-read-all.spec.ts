// integration-tests/http/store-notifications-read-all.spec.ts
// TDD: RED first — POST /store/notifications/read-all does not exist yet (404).
// Tests:
//   (auth)     no bearer → 401.
//   (positive) marks every unread row for the caller; unread_count → 0.
//   (idempotent) a second call marks 0 and does not change read_at.
//   (IDOR)     B's rows are untouched by A's read-all.
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import { unwrapResponse } from './utils';

jest.setTimeout(120 * 1000);

const PASSWORD = 'read-all-test-password-1';

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe('POST /store/notifications/read-all', () => {
      let storeHeaders: Record<string, string>;
      let tokenA: string;
      let customerIdA: string;
      let customerIdB: string;

      beforeEach(async () => {
        const container = getContainer();

        const apiKeyModule = container.resolve(Modules.API_KEY);
        const key = await apiKeyModule.createApiKeys({
          title: 'read-all-test',
          type: 'publishable',
          created_by: 'read-all-test',
        });
        storeHeaders = { 'x-publishable-api-key': key.token };

        const regA = await api.post('/auth/customer/emailpass/register', {
          email: 'read-all-a@test.dev',
          password: PASSWORD,
        });
        await api.post(
          '/store/customers',
          { email: 'read-all-a@test.dev' },
          {
            headers: {
              ...storeHeaders,
              authorization: `Bearer ${regA.data.token}`,
            },
          },
        );
        const loginA = await api.post('/auth/customer/emailpass', {
          email: 'read-all-a@test.dev',
          password: PASSWORD,
        });
        tokenA = loginA.data.token;
        customerIdA = JSON.parse(
          Buffer.from(tokenA.split('.')[1], 'base64').toString('utf8'),
        ).actor_id as string;

        const regB = await api.post('/auth/customer/emailpass/register', {
          email: 'read-all-b@test.dev',
          password: PASSWORD,
        });
        await api.post(
          '/store/customers',
          { email: 'read-all-b@test.dev' },
          {
            headers: {
              ...storeHeaders,
              authorization: `Bearer ${regB.data.token}`,
            },
          },
        );
        customerIdB = JSON.parse(
          Buffer.from(regB.data.token.split('.')[1], 'base64').toString('utf8'),
        ).actor_id as string;

        // Three unread rows for A, two for B.
        const notif = container.resolve(Modules.NOTIFICATION);
        for (const template of [
          'vip_level_up',
          'commission_matured',
          'delivery_status',
        ]) {
          await notif.createNotifications([
            {
              to: customerIdA,
              receiver_id: customerIdA,
              channel: 'feed',
              template,
              data: {},
            },
          ]);
        }
        for (const template of ['vip_level_up', 'topup_credited']) {
          await notif.createNotifications([
            {
              to: customerIdB,
              receiver_id: customerIdB,
              channel: 'feed',
              template,
              data: {},
            },
          ]);
        }
      });

      const authed = (token: string) => ({
        ...storeHeaders,
        authorization: `Bearer ${token}`,
      });

      it('(auth) returns 401 without a bearer token', async () => {
        const res = await unwrapResponse(
          api.post('/store/notifications/read-all', {}, { headers: storeHeaders }),
        );
        expect(res.status).toBe(401);
      });

      it('(positive) marks every unread row and zeroes unread_count', async () => {
        const before = await unwrapResponse(
          api.get('/store/notifications', { headers: authed(tokenA) }),
        );
        expect(before.data.unread_count).toBe(3);

        const res = await unwrapResponse(
          api.post('/store/notifications/read-all', {}, { headers: authed(tokenA) }),
        );
        expect(res.status).toBe(200);
        expect(res.data.marked).toBe(3);
        expect(res.data.read_at).toBeTruthy();

        const after = await unwrapResponse(
          api.get('/store/notifications', { headers: authed(tokenA) }),
        );
        expect(after.data.unread_count).toBe(0);
        for (const n of after.data.notifications) {
          expect(n.read_at).toBeTruthy();
        }
      });

      it('(idempotent) a second call marks nothing more', async () => {
        await unwrapResponse(
          api.post('/store/notifications/read-all', {}, { headers: authed(tokenA) }),
        );
        const second = await unwrapResponse(
          api.post('/store/notifications/read-all', {}, { headers: authed(tokenA) }),
        );
        expect(second.status).toBe(200);
        expect(second.data.marked).toBe(0);
      });

      it("(IDOR) A's read-all never touches B's rows", async () => {
        await unwrapResponse(
          api.post('/store/notifications/read-all', {}, { headers: authed(tokenA) }),
        );

        const container = getContainer();
        const packs = container.resolve('packs') as {
          listNotificationReads: (
            f: Record<string, unknown>,
            c: Record<string, unknown>,
          ) => Promise<Array<{ customer_id: string }>>;
        };
        const bReads = await packs.listNotificationReads(
          { customer_id: customerIdB },
          { take: 100 },
        );
        expect(bReads).toHaveLength(0);
      });
    });
  },
});

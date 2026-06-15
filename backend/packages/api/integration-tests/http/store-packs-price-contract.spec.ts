import { medusaIntegrationTestRunner } from '@medusajs/test-utils';
import { Modules } from '@medusajs/framework/utils';
import { PACKS_MODULE } from '../../src/modules/packs';
import type PacksModuleService from '../../src/modules/packs/service';
import { unwrapResponse } from './utils';

jest.setTimeout(240 * 1000);

// Regression guard for the pack.price integer -> bigNumber change. A bigNumber
// column serializes as a JSON NUMBER for in-range values — a LOAD-BEARING
// assumption: the storefront (src/lib/data/packs.ts) gates the live catalog on
// Number.isFinite(price) and renders via formatPrice(price), so if price ever
// came back a string the catalog would SILENTLY fall back to the mock list
// (same class of bug as commit a2fb6b4's admin-pack 404). This also guards that
// the two public store routes' explicit DTOs never leak the internal raw_price
// jsonb sidecar. See docs/superpowers/specs/2026-06-15-db-indexes-price-decimal-design.md.

const PACK_SLUG = 'price-contract-pack';
// Decimal on purpose: proves cents survive the bigNumber round-trip AND that the
// value serializes as a JSON number, not a string.
const PACK_PRICE = 4.99;

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe('store pack price contract', () => {
      let storeHeaders: Record<string, string>;

      beforeEach(async () => {
        const container = getContainer();

        const apiKeyModule = container.resolve(Modules.API_KEY);
        const key = await apiKeyModule.createApiKeys({
          title: 'price-contract-test',
          type: 'publishable',
          created_by: 'price-contract-test',
        });
        storeHeaders = { 'x-publishable-api-key': key.token };

        const packs = container.resolve<PacksModuleService>(PACKS_MODULE);
        await packs.createPacks([
          {
            slug: PACK_SLUG,
            title: 'Price Contract Pack',
            category: 'pokemon',
            price: PACK_PRICE,
            image: '/cdn/test-pack.webp',
          },
        ]);
      });

      // Both endpoints asserted in ONE test on purpose: the integration runner
      // resets the DB between tests, and that reset cycles the workflow-engine
      // (bullmq) Redis connection — its "Connection is closed" emits as an
      // unhandled error that jest blames on whatever test is mid-flight. A single
      // test sidesteps that between-test teardown window (the read-only pack
      // routes touch no workflow/redis themselves).
      it('serves pack price as a finite JSON number with no raw_price leak', async () => {
        // GET /store/packs — the catalog list.
        const list = await unwrapResponse(
          api.get('/store/packs', { headers: storeHeaders }),
        );
        expect(list.status).toBe(200);
        const listed = list.data.packs.find(
          (p: { slug: string }) => p.slug === PACK_SLUG,
        );
        expect(listed).toBeDefined();
        expect(typeof listed.price).toBe('number');
        expect(Number.isFinite(listed.price)).toBe(true);
        expect(listed.price).toBeCloseTo(PACK_PRICE, 2);
        // The bigNumber internal jsonb sidecar must NOT reach a public payload.
        expect(listed).not.toHaveProperty('raw_price');

        // GET /store/packs/:slug — the single-pack detail.
        const detail = await unwrapResponse(
          api.get(`/store/packs/${PACK_SLUG}`, { headers: storeHeaders }),
        );
        expect(detail.status).toBe(200);
        const single = detail.data.pack;
        expect(typeof single.price).toBe('number');
        expect(Number.isFinite(single.price)).toBe(true);
        expect(single.price).toBeCloseTo(PACK_PRICE, 2);
        expect(single).not.toHaveProperty('raw_price');
      });
    });
  },
});

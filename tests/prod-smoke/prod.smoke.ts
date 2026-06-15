// READ-ONLY production smoke — verifies the deployed stack serves, renders, and
// has data, WITHOUT mutating anything (no signup, no opens, no admin writes).
// URLs overridable via PW_PROD_STORE / PW_PROD_BACKEND.
import { test, expect, request } from '@playwright/test';

const STORE =
  process.env.PW_PROD_STORE ??
  'https://pokenic-storefront-ijfiu.ondigitalocean.app';
const BACKEND =
  process.env.PW_PROD_BACKEND ??
  'https://pokenic-backend-tltfm.ondigitalocean.app';

test('backend /health is green', async () => {
  const ctx = await request.newContext();
  const res = await ctx.get(`${BACKEND}/health`);
  expect(res.status()).toBe(200);
  await ctx.dispose();
});

test('storefront home renders core sections', async ({ page }) => {
  await page.goto(STORE, { waitUntil: 'domcontentloaded' });
  for (const s of [/recent pulls/i, /how it works/i, /leaderboard/i]) {
    await expect(page.getByText(s).first()).toBeVisible();
  }
});

test('claw catalog lists packs (prod has data)', async ({ page }) => {
  await page.goto(`${STORE}/claw`, { waitUntil: 'domcontentloaded' });
  const packLinks = page.locator('a[href*="/claw/"]');
  await expect(packLinks.first()).toBeVisible({ timeout: 20_000 });
  expect(await packLinks.count()).toBeGreaterThan(0);
});

test('a pack detail shows static published odds + Top Hits', async ({
  page,
}) => {
  await page.goto(`${STORE}/claw`, { waitUntil: 'domcontentloaded' });
  const first = page.locator('a[href*="/claw/"]').first();
  await first.waitFor({ timeout: 20_000 });
  const href = await first.getAttribute('href');
  await page.goto(`${STORE}${href}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/top hits/i).first()).toBeVisible();
  // The published Pull Odds are the static, decoupled marketing table.
  await expect(
    page.locator('li', { hasText: 'Legendary' }).filter({ hasText: '0.5%' }),
  ).toHaveCount(1);
});

test('login modal opens (no submit — read-only)', async ({ page }) => {
  await page.goto(`${STORE}/claw`, { waitUntil: 'domcontentloaded' });
  await page
    .getByRole('button', { name: /^login$/i })
    .first()
    .click();
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
});

test('admin dashboard SPA mounts on backend /dashboard', async ({ page }) => {
  // Past prod bug: router basename baked "/" not "/dashboard" -> blank 404.
  await page.goto(`${BACKEND}/dashboard`, { waitUntil: 'domcontentloaded' });
  await expect(
    page
      .getByText(/welcome to mercur/i)
      .or(page.locator('input[name="email"]'))
      .first(),
  ).toBeVisible({ timeout: 20_000 });
});

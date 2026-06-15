// Customer workflow, end to end through the storefront UI:
//   create account → top up credits → open a pack → keep the card in the vault
//   → sell it back. Backend ledgers are asserted via API as ground truth.
import { test, expect } from '@playwright/test';
import { BASE, stamp } from './helpers/constants';
import { api } from './helpers/api';
import * as sf from './helpers/storefront';

const PACK = 'pokemon-rookie';

test.describe('customer workflow', () => {
  const id = stamp();
  const username = `pw-cust-${id}`;
  const email = `pw-cust-${id}@pokenic.local`;
  const password = 'PwCust2026!';

  test('signup → top up → open → keep → vault → sell-back', async ({
    page,
  }) => {
    await test.step('create account via the auth modal', async () => {
      await sf.signup(page, PACK, username, email, password);
      // CTA flips from "Log in to open" to "Open Pack" once authenticated.
      await expect(
        page.getByRole('button', { name: /open pack/i }),
      ).toBeVisible();
    });

    await test.step('top up $100 and see it on the vault balance', async () => {
      await sf.topUp(page, 100);
      await sf.gotoVault(page);
      await expect(page.getByText(/Credit balance/i)).toBeVisible();
      await expect(page.getByText('$100.00').first()).toBeVisible();
    });

    let openCost = 0;
    await test.step('open a pack — balance debits exactly the price', async () => {
      await sf.gotoPack(page, PACK);
      const before = await sf.readPriceAndBalance(page);
      await sf.openPackAndKeep(page);
      const after = await sf.readPriceAndBalance(page);
      openCost = Math.round((before.balance - after.balance) * 100) / 100;
      expect(openCost).toBe(before.price);
    });

    await test.step('kept card appears in the vault', async () => {
      await sf.gotoVault(page);
      await sf.expectVaultHasCard(page);
    });

    await test.step('sell the card back — balance refills', async () => {
      await sf.sellFirstCard(page);
      // The buyback hits the credit ledger; verify the reason landed server-side.
      await expect
        .poll(
          async () => {
            const login = await api<{ token: string }>(
              '/auth/customer/emailpass',
              { method: 'POST', body: { email, password } },
            );
            const credits = await api<{
              transactions: Array<{ reason: string }>;
            }>('/store/credits', { token: login.token });
            return credits.transactions.map((t) => t.reason);
          },
          { timeout: 20_000 },
        )
        .toEqual(expect.arrayContaining(['topup', 'pack_open', 'buyback']));
    });

    await test.step('screenshot the funded vault', async () => {
      await sf.gotoVault(page);
      await page.screenshot({
        path: 'docs/research/pw-customer-vault.png',
        fullPage: true,
      });
    });

    await test.step('log out — the open CTA is gated again', async () => {
      // sf.logout asserts the CTA reverts to "Log in to open".
      await sf.logout(page, PACK);
    });
  });
});

test('anonymous demo spin creates NO backend pull', async ({ page }) => {
  const newest = (pulls: Array<{ rolled_at: string }>): string | null =>
    pulls[0]?.rolled_at ?? null;
  const before = await api<{ pulls: Array<{ rolled_at: string }> }>(
    '/store/pulls/recent',
  );
  await page.goto(`${BASE}/claw/${PACK}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /demo spin/i }).click();
  await page.waitForTimeout(3000); // let any (erroneous) write land before re-checking
  const after = await api<{ pulls: Array<{ rolled_at: string }> }>(
    '/store/pulls/recent',
  );
  expect(newest(after.pulls)).toBe(newest(before.pulls));
});

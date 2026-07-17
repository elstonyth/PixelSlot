// Vault Room slot machine, end to end through the storefront UI:
//   spin → reel settles → the slab appears face-down (sell footer flip-gated)
//   → flip → "Sell for RM…" appears → confirm sell-back → credit ledger gains
//   a buyback row (server truth). Plus: leaving a flipped card unsold until the
//   shared 30s window expires auto-vaults it (instant button disappears, vault
//   copy appears).
// Login goes through the existing /claw/<slug> CTA (sf.login) — auth is a
// global session, so navigating on to /slots/<slug>/spin afterwards carries
// the same signed-in customer. Two spins total across the whole spec (opens
// are rate-limited and spend real local credits).
import { test, expect } from '@playwright/test';
import { BASE } from './helpers/constants';
import { api, createCustomer } from './helpers/api';
import * as sf from './helpers/storefront';

const PACK = 'pokemon-rookie';
// createCustomer() registers every customer with this fixed password.
const PASSWORD = 'PwE2e2026!';

const FLIP_BUTTON = { name: 'Flip to reveal your card' };
const SELL_BUTTON = { name: /^Sell for RM/ };

async function spinAndSettle(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/slots/${PACK}/spin?count=1`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('button', { name: 'Spin', exact: true }).click();
  // Reel settle has no clean end-signal beyond the slab appearing — but the
  // flip button renders (disabled) during the 'transform' phase already, so
  // waiting for mere presence races the review-phase enable. Wait for it to
  // become enabled instead — that's the real "ready to flip" signal.
  await expect(page.getByRole('button', FLIP_BUTTON)).toBeEnabled({
    timeout: 30_000,
  });
}

test.describe('slot vault room', () => {
  test('spin → flip → instant sell → server-truth ledger row', async ({
    page,
  }) => {
    const cust = await createCustomer(200);
    await sf.login(page, PACK, cust.email, PASSWORD);

    await test.step('the bet debits on spin press, before the reel settles (PR #200 guard)', async () => {
      await page.goto(`${BASE}/slots/${PACK}/spin?count=1`, {
        waitUntil: 'domcontentloaded',
      });
      const spinBtn = page.getByRole('button', { name: 'Spin', exact: true });
      // Spin is gated on canAfford, so an enabled button means the balance has
      // loaded — otherwise `before` would capture a placeholder and the later
      // change would just be the initial load, not the debit.
      await expect(spinBtn).toBeEnabled();
      // The credit meter's sr-only span carries the real balance; the visible
      // odometer digits are aria-hidden AND animated, so never read those.
      // waitFor (retrying) — isVisible() is non-retrying and races hydration.
      const creditValue = page
        .getByText('Credit', { exact: true })
        .locator('..')
        .locator('.sr-only');
      await creditValue.waitFor({ state: 'visible' });
      const before = (await creditValue.innerText()).trim();

      await spinBtn.click();

      // THE guard for PR #200: openBatch has already charged by the time it
      // resolves, so the fix paints the server's post-charge balance at once —
      // while the reel is still spinning (aria-busy=true) — not at settle ~5s
      // later. Assert the credit meter changes WHILE the stage is still busy.
      // Pre-fix the balance only moves once the reel settles (aria-busy already
      // false), so the two are never true together and this times out: reverting
      // the SlotMachineClient fix turns this red. A real page function (not an
      // evaluate string), so no IIFE trap.
      await page.waitForFunction(
        (prev) => {
          const label = Array.from(document.querySelectorAll('p')).find(
            (p) => p.textContent?.trim() === 'Credit',
          );
          const now = label?.parentElement
            ?.querySelector('.sr-only')
            ?.textContent?.trim();
          const busy = document.querySelector('[aria-busy="true"]') != null;
          return now != null && now !== prev && busy;
        },
        before,
        { timeout: 8000 },
      );

      // Let the reel settle — the flip button enabling is the real "ready to
      // flip" signal (it renders disabled during 'transform').
      await expect(page.getByRole('button', FLIP_BUTTON)).toBeEnabled({
        timeout: 30_000,
      });
    });

    await test.step('no sell button before the flip', async () => {
      await expect(page.getByRole('button', SELL_BUTTON)).toHaveCount(0);
    });

    await test.step('flip the card — the instant sell button appears', async () => {
      // force: true — the unflipped card has a perpetual idle float
      // (translateY loop in SlabCard), so Playwright's actionability
      // stability check can spin forever waiting for it to stop moving. The
      // enabled-wait in spinAndSettle already proves it's genuinely clickable.
      await page.getByRole('button', FLIP_BUTTON).click({ force: true });
      await expect(page.getByRole('button', SELL_BUTTON)).toBeVisible({
        timeout: 10_000,
      });
    });

    await test.step('confirm the sell in the shared modal', async () => {
      await page.getByRole('button', SELL_BUTTON).click();
      const dialog = page.getByRole('dialog', { name: 'Confirm sell-back' });
      await expect(dialog.getByText(/Sell this card\?/i)).toBeVisible();
      await dialog.getByRole('button', { name: /^Sell for RM/ }).click();
      await expect(dialog).toBeHidden({ timeout: 20_000 });
    });

    await test.step('server truth: a buyback row lands on the credit ledger', async () => {
      await expect
        .poll(
          async () => {
            const credits = await api<{
              transactions: Array<{ reason: string }>;
            }>('/store/credits', { token: cust.token });
            return credits.transactions.filter((t) => t.reason === 'buyback')
              .length;
          },
          { timeout: 20_000 },
        )
        .toBeGreaterThanOrEqual(1);
    });
  });

  test('unsold flipped card auto-vaults at window expiry', async ({ page }) => {
    test.setTimeout(120_000);
    const cust = await createCustomer(200);
    await sf.login(page, PACK, cust.email, PASSWORD);

    await test.step('second spin, settle, flip — do not sell', async () => {
      await spinAndSettle(page);
      await page.getByRole('button', FLIP_BUTTON).click({ force: true });
      await expect(page.getByRole('button', SELL_BUTTON)).toBeVisible({
        timeout: 10_000,
      });
    });

    // The shared 30s window is server-anchored (instant_deadline_ms from the
    // reveal ping) — no test-mode short deadline, so this genuinely waits it
    // out on the real wall clock rather than mocking page.clock (which would
    // fight the rAF reel engine).
    await test.step('wait out the real 30s window — vault copy replaces the sell button', async () => {
      await expect(page.getByText(/Stored in your vault/i)).toBeVisible({
        timeout: 40_000,
      });
      await expect(page.getByRole('button', SELL_BUTTON)).toHaveCount(0);
    });
  });
});

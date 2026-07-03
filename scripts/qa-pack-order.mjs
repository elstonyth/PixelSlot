// Step 2 verification: drive the real admin UI reorder arrows and confirm the
// new order flows through to the storefront, then restore.
import { chromium } from 'playwright';

const ADMIN = 'http://localhost:7000/dashboard';
const OUT = 'C:/Users/PC/Desktop/Projects/Pokenic_Game/docs/research';

const firstRowTitle = (page) =>
  page.locator('table tbody tr').first().locator('td').nth(1).innerText();

const storefrontOrder = async () => {
  const res = await fetch('http://localhost:4000/');
  const html = await res.text();
  return [
    ...new Set(
      [
        ...html.matchAll(
          /(Mythic|Legend|Elite|Platinum|Rookie|Black|Diamond|Trainer) Pack/g,
        ),
      ].map((m) => m[0]),
    ),
  ];
};

const waitFor = async (fn, want, label, tries = 30) => {
  for (let i = 0; i < tries; i++) {
    const got = await fn();
    if (got === want) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${label}: never reached "${want}"`);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Login — the SPA redirects to /login only after its JS boots, so wait for
// whichever renders first: the packs table (already authed) or the login form.
await page.goto(`${ADMIN}/packs`, {
  waitUntil: 'domcontentloaded',
  timeout: 20000,
});
await page.waitForSelector('table tbody tr, input[name="email"]', {
  timeout: 25000,
});
if (await page.locator('input[name="email"]').count()) {
  await page.fill('input[name="email"]', 'admin@pokenic.app');
  await page.fill('input[name="password"]', 'xvAklfgvCGWZVqOUl2n6aA9');
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => !u.pathname.includes('login'), {
    timeout: 15000,
  });
  await page.goto(`${ADMIN}/packs`, {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  });
}

await page.waitForSelector('table tbody tr', { timeout: 20000 });
console.log('BEFORE first row:', await firstRowTitle(page));
console.log('BEFORE storefront:', (await storefrontOrder()).join(' | '));
await page.screenshot({
  path: `${OUT}/step2-admin-order-before.png`,
  fullPage: false,
});

// Move the top pack (Mythic) down one — Legend should take position 1.
const mythicRow = page.locator('table tbody tr', { hasText: 'Mythic Pack' });
await mythicRow.getByLabel('Move down').click();
await waitFor(
  () => firstRowTitle(page),
  'Legend Pack',
  'admin first row after move',
);
console.log('AFTER  first row:', await firstRowTitle(page));
await page.screenshot({
  path: `${OUT}/step2-admin-order-after.png`,
  fullPage: false,
});

// Storefront must now lead with Legend.
await waitFor(
  async () => (await storefrontOrder())[0],
  'Legend Pack',
  'storefront order after move',
);
console.log('AFTER  storefront:', (await storefrontOrder()).join(' | '));

// Restore: move Mythic back up.
await mythicRow.getByLabel('Move up').click();
await waitFor(
  () => firstRowTitle(page),
  'Mythic Pack',
  'admin first row after restore',
);
await waitFor(
  async () => (await storefrontOrder())[0],
  'Mythic Pack',
  'storefront order after restore',
);
console.log('RESTORED storefront:', (await storefrontOrder()).join(' | '));

await browser.close();
console.log('OK: admin arrows reorder -> storefront follows -> restored');

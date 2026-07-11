// UI check for the playthrough withdrawal gate on the wallet page (:4100).
// Locked state (S3) is pre-seeded by withdraw-scenarios.mjs; this script
// screenshots it, reseeds to the unlocked state (S1b), and screenshots again.
import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';

const STORE = 'http://127.0.0.1:4100';
const EMAIL = process.env.WD_EMAIL;
const PASSWORD = process.env.WD_PW;
const CUST_ID = process.env.WD_CUST;
const OUT = process.env.WD_OUT;

function psql(sql) {
  execSync(
    'docker exec -i pokenic-postgres psql -U medusa -d medusa -v ON_ERROR_STOP=1',
    {
      input: sql,
      encoding: 'utf8',
    },
  );
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// login via header modal (same flow as scripts/login-stack.mjs)
let ok = false;
for (let i = 0; i < 4 && !ok; i++) {
  try {
    await page.goto(`${STORE}/`, { waitUntil: 'domcontentloaded' });
    const loginBtn = page
      .locator('header')
      .getByRole('button', { name: /^login$/i })
      .first();
    await loginBtn.waitFor({ state: 'visible', timeout: 30000 });
    await loginBtn.click();
    const email = page.locator('input[name="email"]');
    await email.waitFor({ state: 'visible', timeout: 20000 });
    await email.fill(EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await page.press('input[name="password"]', 'Enter');
    await loginBtn.waitFor({ state: 'detached', timeout: 15000 });
    ok = true;
  } catch (e) {
    console.log(
      `login attempt ${i + 1} failed: ${String(e.message).split('\n')[0]}`,
    );
    await page.waitForTimeout(3000);
  }
}
if (!ok) {
  console.log('LOGIN FAILED');
  process.exit(1);
}
console.log('logged in');

async function shot(name, mustContain) {
  await page.goto(`${STORE}/wallet`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${OUT}/wallet-${name}.png`, fullPage: false });
  const text = await page.locator('main, body').first().innerText();
  const missing = mustContain.filter((s) => !text.includes(s));
  console.log(
    missing.length
      ? `FAIL  ${name}: missing ${JSON.stringify(missing)}`
      : `PASS  ${name}: found ${JSON.stringify(mustContain)}`,
  );
  return missing.length === 0;
}

// state 1: S3 locked — deposit 100, used 50, buyback 100
psql(
  `DELETE FROM credit_transaction WHERE customer_id = '${CUST_ID}';
   INSERT INTO credit_transaction (id, customer_id, amount, reason, raw_amount) VALUES
   ('ctx_wdui_l1', '${CUST_ID}', 100, 'topup', '{"value": "100", "precision": 20}'),
   ('ctx_wdui_l2', '${CUST_ID}', -50, 'pack_open', '{"value": "-50", "precision": 20}'),
   ('ctx_wdui_l3', '${CUST_ID}', 100, 'buyback', '{"value": "100", "precision": 20}');`,
);
const a = await shot('locked', [
  'Withdrawals locked',
  'RM 50.00', // remaining playthrough
  'RM 150.00', // total balance
]);

// state 2: S1b unlocked — deposit 100, used 100, buyback 80
psql(
  `DELETE FROM credit_transaction WHERE customer_id = '${CUST_ID}';
   INSERT INTO credit_transaction (id, customer_id, amount, reason, raw_amount) VALUES
   ('ctx_wdui_1', '${CUST_ID}', 100, 'topup', '{"value": "100", "precision": 20}'),
   ('ctx_wdui_2', '${CUST_ID}', -100, 'pack_open', '{"value": "-100", "precision": 20}'),
   ('ctx_wdui_3', '${CUST_ID}', 80, 'buyback', '{"value": "80", "precision": 20}');`,
);
const b = await shot('unlocked', ['Withdrawable', 'RM 80.00']);

await browser.close();
process.exit(a && b ? 0 : 1);

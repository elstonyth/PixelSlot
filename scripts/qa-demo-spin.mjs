// QA Task C — guest demo spin on the PROD build (:4000).
// Flow A (anonymous): demo spin plays the full reveal, result is DEMO-labeled,
//   keep/sell is replaced by the sign-up CTA, and NO POST hits the backend
//   (asserted from the page's network log). Real-open CTA reads "Log in to open".
// Flow B (logged-in): demo overlay shows NO sign-up CTA; real-open CTA + the
//   credits footer render unchanged (the full paid loop is qa-pack-open-charge.mjs).
// Headless; screenshots to docs/research/. Run: node scripts/qa-demo-spin.mjs
import { chromium } from "playwright";

const BASE = "http://localhost:4000";
const PACK = "pokemon-rookie";
const EMAIL = "stocktest-1@pokenic.local";
const PASSWORD = "stocktest2026!";

const fail = (m) => {
  console.error(`✗ ${m}`);
  process.exitCode = 1;
};
const ok = (m) => console.log(`✓ ${m}`);

const browser = await chromium.launch({ headless: true });

// Demo theater: cylinder → tap pack → slab → tap → metadata → card.
async function playDemoToCard(page) {
  await page.getByRole("button", { name: /demo spin/i }).click();
  await page.waitForTimeout(1200); // cylinder mounts + idles
  await page.mouse.click(720, 420); // pack → slab
  await page.waitForTimeout(900);
  await page.mouse.click(720, 420); // slab → metadata (→ card via timer/tap)
  await page.waitForTimeout(600);
  await page.mouse.click(720, 80); // metadata → card (background tap, off the card stack)
  // Card stage is reached when the demo watermark mounts; give the flip/exit
  // animations a beat to settle so screenshots show the final frame.
  await page.getByText("Demo", { exact: true }).waitFor({ timeout: 25000 });
  await page.waitForTimeout(1500);
}

try {
  // ── Flow A: anonymous visitor ─────────────────────────────────────────────
  const ctxA = await browser.newContext({
    viewport: { width: 1440, height: 860 },
  });
  const page = await ctxA.newPage();
  const posts = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });

  await page.goto(`${BASE}/claw/${PACK}`, { waitUntil: "domcontentloaded" });
  const loginCta = await page
    .getByRole("button", { name: /log in to open/i })
    .isVisible();
  if (loginCta) ok("anonymous real-open CTA reads 'Log in to open'");
  else fail("anonymous real-open CTA missing");

  await playDemoToCard(page);
  ok("demo spin played through to the card reveal");

  const watermark = await page.getByText("Demo", { exact: true }).isVisible();
  if (watermark) ok("result watermarked DEMO");
  else fail("DEMO watermark missing");

  const signup = page.getByRole("button", {
    name: /sign up to keep what you pull/i,
  });
  if (await signup.isVisible()) ok("sign-up conversion CTA shown");
  else fail("sign-up CTA missing");

  if (await page.getByRole("button", { name: /sell back/i }).count())
    fail("sell-back offered on a demo spin");
  else ok("no keep/sell offer on the demo result");

  await page.screenshot({ path: "docs/research/qa-demo-spin-anon.png" });

  const openPosts = posts.filter((u) => /\/store\/packs\/.+\/open/.test(u));
  if (openPosts.length === 0) ok("no POST /store/packs/*/open fired");
  else fail(`demo fired real open POST(s): ${openPosts.join(", ")}`);
  const backendPosts = posts.filter((u) => !u.startsWith(`${BASE}/`));
  if (backendPosts.length === 0)
    ok("no cross-origin POSTs at all from the demo");
  else fail(`unexpected POSTs: ${backendPosts.join(", ")}`);

  // Sign-up CTA opens the auth modal in signup mode.
  await signup.click();
  await page
    .getByRole("button", { name: /create account|sign up/i })
    .first()
    .waitFor({ timeout: 10000 });
  ok("sign-up CTA opens the auth modal");
  await page.screenshot({ path: "docs/research/qa-demo-spin-signup.png" });
  await ctxA.close();

  // ── Flow B: logged-in customer — real flow unchanged, demo loses the CTA ──
  const ctxB = await browser.newContext({
    viewport: { width: 1440, height: 860 },
  });
  const page2 = await ctxB.newPage();
  await page2.goto(`${BASE}/claw/${PACK}`, { waitUntil: "domcontentloaded" });
  await page2
    .getByRole("button", { name: /^login$/i })
    .first()
    .click();
  await page2.fill('input[name="email"]', EMAIL);
  await page2.fill('input[name="password"]', PASSWORD);
  await page2.press('input[name="password"]', "Enter");
  await page2
    .getByRole("button", { name: /open pack/i })
    .waitFor({ timeout: 20000 });
  ok("logged in — real 'Open Pack' CTA unchanged");
  await page2.getByText(/Each open costs/).waitFor({ timeout: 15000 });
  ok("credits footer renders for the logged-in customer");

  await playDemoToCard(page2);
  if (await page2.getByRole("button", { name: /sign up to keep/i }).count())
    fail("sign-up CTA shown to a logged-in customer");
  else ok("logged-in demo shows no sign-up CTA");
  const spinAgain = await page2
    .getByRole("button", { name: /spin again/i })
    .isVisible();
  if (spinAgain) ok("demo reveal offers 'Spin again'");
  else fail("'Spin again' missing on demo reveal");
  await page2.screenshot({ path: "docs/research/qa-demo-spin-authed.png" });
  await ctxB.close();
} catch (err) {
  fail(err.message);
} finally {
  await browser.close();
}

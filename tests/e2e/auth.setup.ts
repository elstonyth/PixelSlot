// Logs the operator in ONCE and saves the session, so the rest of the suite
// reuses it via storageState instead of re-authenticating (admin /auth is
// rate-limited — repeated logins trip "Too many sign-in attempts").
import { test as setup } from '@playwright/test';
import { adminLogin, ADMIN_STORAGE } from './helpers/admin';
import { assertSeedPacks } from './helpers/seed-guard';

// Every e2e spec depends on this 'setup' project, so it's the one central hook
// where a missing-seed preflight fails the whole run fast (before 9 specs edit
// their own copy of the slug). Independent setup check — does not depend on any
// ordering relative to the admin login below (both must pass before e2e runs).
setup('seed packs present', async () => {
  await assertSeedPacks();
});

setup('authenticate admin', async ({ page }) => {
  await adminLogin(page);
  await page.context().storageState({ path: ADMIN_STORAGE });
});

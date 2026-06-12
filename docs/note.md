# Production Recheck Notes

> Running log of **deferred decisions, dev-only shortcuts, and platform limitations**
> to re-verify **before / at production launch**. Each entry records what was decided,
> why, and what to recheck. Add an entry whenever a "fine for local dev, revisit for
> prod" choice is made.

---

## 2026-06-08 — Profile pages use mock data (no public customer API)

**Area:** `src/app/profile/[user]/page.tsx` (+ `ProfileClient.tsx`), `UserMenu`/account links.

**Issue:** Medusa v2's Store API exposes only the **logged-in customer's own** record
(`GET /store/customers/me`). There is **no public "other customer" endpoint**, so a public
`/profile/[user]` page cannot fetch real data for an arbitrary user.

**Decision (Phase 3):** keep `/profile/[user]` on the deterministic **mock pool** for now;
wire real data only where it's the logged-in user ("me"). Real per-user public profiles are
out of scope for the account-data slice.

**Recheck at launch:**

- [x] ~~Decide if public profiles ship at all.~~ **Shipped 2026-06-12 (Task B)**:
      `GET /store/profiles/:handle` (public, IP rate-limited) + `GET /store/profiles/me`
      (authed, lazily assigns `metadata.handle`). Safe subset only — display name, avatar
      seed, join date, pull stats, recent pulls. Unknown handles fall back to the mock pool
      on the storefront (links from mock surfaces keep working).
- [x] Profile pages now render real data for collector handles; the mock pool remains the
      fallback/skeleton for unknown usernames.
- [x] PII leak check is integration-tested (`public-profile.spec.ts` asserts no email /
      customer id / balance / vault fields in the payload). Re-verify at launch anyway.

---

## 2026-06-08 — Other Phase 3 (Auth) deferrals to recheck for prod

**Dev secrets (CRITICAL for prod):**

- [x] ~~`backend/packages/api/.env` has `JWT_SECRET=supersecret` / `COOKIE_SECRET=supersecret`~~
      **Rotated to strong random values 2026-06-11** (cleanup wave). Prod deploys still
      need their own values — generation one-liner documented in `.env.template`'s
      PROD CHECKLIST block.

**CORS config is local-only:**

- [ ] `STORE_CORS` / `AUTH_CORS` were set to include `http://localhost:4000` in the local
      (gitignored) `.env`. Production must set these to the **real storefront origin(s)** —
      this won't travel in git. Document canonical values in a `.env.example` if added.

**Auth cookie hardening:**

- [ ] The session cookie (`_pokenic_jwt`, `src/lib/data/customer.ts`) sets
      `secure: process.env.NODE_ENV === "production"`. Confirm prod actually runs with
      `NODE_ENV=production` so `Secure` is set (cookie is already `httpOnly` + `SameSite=Lax`).
- [x] ~~Consider rate-limiting the auth endpoints~~ **Done 2026-06-11**: per-IP burst+
      sustained limiter on `POST /auth/*/emailpass(/*)` (login/register/reset, all actor
      types; token refresh excluded). `AUTH_RATE_*` envs; integration-tested.

**Stubbed auth features (not wired):**

- [ ] Social login (Google / Discord) buttons in `AuthForm` are placeholders.
- [x] ~~"Forgot password?" is a placeholder~~ **Done 2026-06-12** (Task D): full
      reset flow — `AuthForm` forgot view → `POST /auth/customer/emailpass/reset-password`
      (always "check your email", no enumeration) → `auth.password_reset` subscriber logs
      the `${STOREFRONT_URL}/reset-password?token&email` link at WARN (dev-mode mail; swap
      in a real provider later) → `/reset-password` page posts `/auth/customer/emailpass/update`.
      Reset tokens are SINGLE-USE (Redis-backed guard, `src/api/utils/reset-token-guard.ts`);
      integration-tested in `password-reset.spec.ts`. Caveat: password min-length
      (8) is enforced only by the storefront server actions — core's emailpass
      update/register routes accept any non-empty string, so a direct `:9000`
      POST can set a 1-char password (pre-existing core behavior; revisit if a
      backend password policy ever lands).

**Orders will be empty until checkout exists:**

- [ ] `/orders` (once wired to `sdk.store.order.list`) shows an empty state until the
      Phase 5 cart→Stripe→order flow lands. Expected, not a bug — recheck once checkout ships.

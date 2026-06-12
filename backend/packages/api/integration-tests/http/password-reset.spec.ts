import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type Redis from "ioredis";
import { connectTestRedisOrFail, unwrapResponse } from "./utils";

jest.setTimeout(240 * 1000);

// Forgot-password flow (Task D): the stock emailpass reset endpoints plus the
// custom single-use token guard from src/api/utils/reset-token-guard.ts.
// Token capture: the auth.password_reset event carries the reset JWT — the
// suite subscribes on the in-app local event bus instead of parsing the
// password-reset subscriber's log line.
//
// ONE it covers the whole loop on purpose: the runner resets the DB between
// it-blocks (verified — a provider identity registered in beforeAll is gone
// by the second it), so splitting the flow would orphan the reset token from
// the identity it belongs to. (Redis state, by contrast, persists across the
// per-test DB resets — hence the key cleanup in beforeAll.)
//
// The auth rate limiter also covers these endpoints (/auth/*/emailpass/*);
// .env.test parks its budgets effectively unlimited so it never interferes.

const EMAIL = "reset-flow@test.dev";
const OLD_PASSWORD = "old-password-1";
const NEW_PASSWORD = "new-password-2";

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ api, getContainer }) => {
    describe("forgot-password flow", () => {
      let redis: Redis;
      const tokens: string[] = [];

      const post = (
        path: string,
        body: Record<string, unknown>,
        headers?: Record<string, string>,
      ) => unwrapResponse(api.post(path, body, headers && { headers }));

      const login = (password: string) =>
        post("/auth/customer/emailpass", { email: EMAIL, password });

      const requestReset = (identifier: string) =>
        post("/auth/customer/emailpass/reset-password", { identifier });

      const updatePassword = (token: string, password: string) =>
        post(
          "/auth/customer/emailpass/update",
          { password },
          { Authorization: `Bearer ${token}` },
        );

      // The local event bus emits on a detached promise chain — poll until
      // the expected token count lands instead of racing it.
      const waitForTokens = async (count: number) => {
        const deadline = Date.now() + 10_000;
        while (tokens.length < count && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 100));
        }
        expect(tokens.length).toBeGreaterThanOrEqual(count);
      };

      beforeAll(async () => {
        redis = await connectTestRedisOrFail(
          "the reset-token single-use guard stores consumed token hashes in Redis",
        );
        // A previous run's consumed-token markers live for 15m and would 401
        // this run's replay assertions for the wrong reason — clean slate.
        const keys = await redis.keys("reset-token:used:*");
        if (keys.length) await redis.del(...keys);

        const eventBus = getContainer().resolve(Modules.EVENT_BUS);
        // The local bus hands subscribers the raw event body ({ name, data }).
        // Dedupe: workflow events can be delivered more than once (direct +
        // grouped release) — a duplicate would satisfy waitForTokens(2) with
        // a stale (already consumed) token.
        eventBus.subscribe("auth.password_reset", (async (event: {
          data: { token: string };
        }) => {
          if (!tokens.includes(event.data.token)) tokens.push(event.data.token);
        }) as unknown as Parameters<typeof eventBus.subscribe>[1]);
      });

      afterAll(() => {
        redis?.disconnect();
      });

      it("runs the full reset loop: no enumeration, rotate, single-use, garbage", async () => {
        // ── Arrange: a real emailpass provider identity ────────────────────
        const register = await post("/auth/customer/emailpass/register", {
          email: EMAIL,
          password: OLD_PASSWORD,
        });
        expect(register.status).toBe(200);

        // ── reset-password 201s identically for known AND unknown emails ──
        const known = await requestReset(EMAIL);
        const unknown = await requestReset("nobody-here@test.dev");
        expect(known.status).toBe(201);
        expect(unknown.status).toBe(201);
        expect(unknown.data).toEqual(known.data);

        // Only the known identity mints a token (the workflow aborts quietly
        // for unknown identifiers — that's the no-enumeration contract).
        await waitForTokens(1);
        expect(tokens).toHaveLength(1);

        // ── valid token rotates the password: old fails, new works ────────
        const updated = await updatePassword(tokens[0], NEW_PASSWORD);
        expect(updated.status).toBe(200);
        expect(updated.data).toMatchObject({ success: true });

        expect((await login(OLD_PASSWORD)).status).toBe(401);
        const fresh = await login(NEW_PASSWORD);
        expect(fresh.status).toBe(200);
        expect(fresh.data.token).toEqual(expect.any(String));

        // ── replayed token 401s (single-use guard), password untouched ────
        // The same JWT is still signature-valid for ~15m — only the guard's
        // consumed-token marker turns this into a 401.
        const replay = await updatePassword(tokens[0], "attacker-password-3");
        expect(replay.status).toBe(401);
        expect(replay.data).toMatchObject({ message: "Invalid token" });
        expect((await login("attacker-password-3")).status).toBe(401);
        expect((await login(NEW_PASSWORD)).status).toBe(200);

        // Whitespace-padded headers parse identically in core's bearer
        // parser — the guard must reject them too, or padding becomes a
        // single-use bypass.
        const padded = await post(
          "/auth/customer/emailpass/update",
          { password: "attacker-password-3" },
          { Authorization: `Bearer ${tokens[0]} ` },
        );
        expect(padded.status).toBe(401);
        expect((await login("attacker-password-3")).status).toBe(401);

        // ── garbage / missing tokens 401 ───────────────────────────────────
        const garbage = await updatePassword("not-a-jwt", "whatever-pass-4");
        expect(garbage.status).toBe(401);
        const missing = await post("/auth/customer/emailpass/update", {
          password: "whatever-pass-4",
        });
        expect(missing.status).toBe(401);

        // ── a failed update must NOT consume a fresh token ─────────────────
        // Two resets inside the same epoch second mint byte-identical JWTs
        // (same payload, iat has second granularity) — and an identical
        // "fresh" token would already be consumed. Cross into the next
        // second so token2 is guaranteed distinct.
        await new Promise((r) => setTimeout(r, 1_100));
        const second = await requestReset(EMAIL);
        expect(second.status).toBe(201);
        await waitForTokens(2);
        const token2 = tokens[1];
        expect(token2).not.toBe(tokens[0]);

        // emailpass treats a missing/non-string password as a no-op success,
        // so force a non-2xx WITHOUT a password change: the customer token on
        // the user actor route 401s in core's validateToken (actor_type
        // mismatch) — the guard must not burn the token for it.
        const wrongActor = await post(
          "/auth/user/emailpass/update",
          { password: "whatever-pass-5" },
          { Authorization: `Bearer ${token2}` },
        );
        expect(wrongActor.status).toBe(401);

        // The token still works where it belongs.
        const ok = await updatePassword(token2, "final-password-6");
        expect(ok.status).toBe(200);
        expect((await login("final-password-6")).status).toBe(200);
      });
    });
  },
});

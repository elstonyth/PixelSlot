import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { PACKS_MODULE } from "../../src/modules/packs";
import type PacksModuleService from "../../src/modules/packs/service";

jest.setTimeout(120 * 1000);

medusaIntegrationTestRunner({
  inApp: true,
  env: { COMMISSION_COOLDOWN_DAYS: "0" }, // demo: immediate maturity
  testSuite: ({ getContainer }) => {
    describe("rewardsSettings accessor", () => {
      it("returns the env-overridden cooldown and the static defaults", async () => {
        const packs = getContainer().resolve<PacksModuleService>(PACKS_MODULE);
        const s = await packs.rewardsSettings();
        expect(s.commissionCooldownDays).toBe(0); // env override
        expect(s.teamOverridePct).toBeCloseTo(0.2);
        expect(s.overrideGenerationCap).toBe(100);
      });

      it("falls through to default on a malformed cooldown env (no NaN)", async () => {
        const packs = getContainer().resolve<PacksModuleService>(PACKS_MODULE);
        const prev = process.env.COMMISSION_COOLDOWN_DAYS;
        process.env.COMMISSION_COOLDOWN_DAYS = "abc";
        try {
          const s = await packs.rewardsSettings();
          expect(Number.isNaN(s.commissionCooldownDays)).toBe(false);
          expect(s.commissionCooldownDays).toBe(3); // no row → default
        } finally {
          process.env.COMMISSION_COOLDOWN_DAYS = prev;
        }
      });
    });
  },
});

import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { PACKS_MODULE } from "../../src/modules/packs";
import type PacksModuleService from "../../src/modules/packs/service";

jest.setTimeout(120 * 1000);

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ getContainer }) => {
    describe("availableBalance gates locked commission", () => {
      it("excludes a not-yet-matured commission credit from available", async () => {
        const packs = getContainer().resolve<PacksModuleService>(PACKS_MODULE);
        const cust = "cus_avail";
        // A commission credit row + its lifecycle record, locked (future maturity).
        const [credit] = await packs.createCreditTransactions([
          {
            customer_id: cust, amount: 50, reason: "direct_referral" as const,
            pull_id: null, reference: null, source_transaction_id: "open_av_1",
            generation: 1,
          } as Record<string, unknown>,
        ]);
        await packs.createCommissions([
          {
            credit_transaction_id: credit.id, beneficiary: cust,
            source_transaction_id: "open_av_1", generation: 1, kind: "direct",
            status: "pending", matures_at: new Date(Date.now() + 86_400_000),
            effective_pct: 5,
          } as Record<string, unknown>,
        ]);
        expect(await packs.creditBalance(cust)).toBe(50); // raw
        expect(await packs.availableBalance(cust)).toBe(0); // locked out
      });
    });
  },
});

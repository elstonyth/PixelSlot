import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { PACKS_MODULE } from "../../src/modules/packs";
import type PacksModuleService from "../../src/modules/packs/service";

jest.setTimeout(120 * 1000);

medusaIntegrationTestRunner({
  inApp: true,
  testSuite: ({ getContainer }) => {
    describe("credit_transaction.reason widened to 8 values", () => {
      it("accepts a direct_referral credit row", async () => {
        const packs = getContainer().resolve<PacksModuleService>(PACKS_MODULE);
        const [row] = await packs.createCreditTransactions([
          {
            customer_id: "cus_reason",
            amount: 1.5,
            reason: "direct_referral" as const,
            pull_id: null,
            reference: null,
            source_transaction_id: "open_reason_1",
          } as Record<string, unknown>,
        ]);
        expect(row.reason).toBe("direct_referral");
      });
    });
  },
});

import { MedusaService } from "@medusajs/framework/utils";
import Pack from "./models/pack";
import Card from "./models/card";
import PackOdds from "./models/pack-odds";
import Pull from "./models/pull";
import CreditTransaction from "./models/credit-transaction";
import {
  resolveBuybackRate,
  buybackAmount,
  type BuybackRate,
} from "./buyback-rate";
import {
  EMPTY_TOTALS,
  foldLedgerRow,
  totalsToUsd,
  type LedgerTotals,
} from "./credit-summary";

// Auto-generates CRUD for each model: list/retrieve/create/update/delete<Model>s
// (e.g. listPacks, listCards, listPackOdds, createPulls,
// listCreditTransactions). Card = prize metadata, PackOdds = the weighted
// table (+ per-pack rarity), Pull = the result ledger doubling as the vault,
// CreditTransaction = the site-credit ledger written by buybacks.

const BALANCE_PAGE = 1000;

class PacksModuleService extends MedusaService({
  Pack,
  Card,
  PackOdds,
  Pull,
  CreditTransaction,
}) {
  // The instant/flat sell-back offer for a pull, composed from the SAME pure
  // helpers the buyback workflow credits with — so the reveal quote, the vault
  // quote, and the credit can never disagree. Removes the listPacks +
  // resolveBuybackRate re-query the open route did inline.
  async quoteBuyback(
    packSlug: string,
    rolledAt: Date | string,
    marketValue: number,
    nowMs: number = Date.now()
  ): Promise<{ percent: number; amount: number; rate_type: BuybackRate["rate_type"] }> {
    const [pack] = await this.listPacks({ slug: packSlug }, { take: 1 });
    const { percent, rate_type } = resolveBuybackRate(pack, rolledAt, nowMs);
    return { percent, amount: buybackAmount(marketValue, percent), rate_type };
  }

  // Lifetime ledger totals (balance + money-in/out), paged so the result is
  // exact at any ledger size. Reuses the pure fold so the arithmetic is
  // unit-tested. balance == Σ(amount); topupTotal == Σ top-ups; spendTotal == Σ
  // |negatives|.
  async creditSummary(customerId: string): Promise<{
    balance: number;
    topupTotal: number;
    spendTotal: number;
  }> {
    let totals: LedgerTotals = EMPTY_TOTALS;
    for (let skip = 0; ; skip += BALANCE_PAGE) {
      const page = await this.listCreditTransactions(
        { customer_id: customerId },
        { skip, take: BALANCE_PAGE, order: { created_at: "ASC" } }
      );
      for (const t of page) {
        totals = foldLedgerRow(totals, {
          amount: Number(t.amount),
          reason: t.reason,
        });
      }
      if (page.length < BALANCE_PAGE) break;
    }
    return totalsToUsd(totals);
  }

  // Customer credit balance = Σ(amount) over the append-only ledger. Kept as a
  // thin delegate so existing callers (pack detail affordability, etc.) are
  // unchanged.
  async creditBalance(customerId: string): Promise<number> {
    return (await this.creditSummary(customerId)).balance;
  }
}

export default PacksModuleService;

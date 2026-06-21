import { Migration } from "@medusajs/framework/mikro-orm/migrations";

// Phase 2a — widen the credit ledger reason check to admit the commission
// reasons (direct_referral / team_override) plus their lifecycle counterparts
// (commission_reversal / cashout). Drop + re-add is the house pattern
// (Migration20260612002121); up() always succeeds (the new set is a superset).
export class Migration20260622130000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "credit_transaction" drop constraint if exists "credit_transaction_reason_check";`,
    );
    this.addSql(
      `alter table if exists "credit_transaction" add constraint "credit_transaction_reason_check" check("reason" in ('buyback', 'topup', 'pack_open', 'adjustment', 'direct_referral', 'team_override', 'commission_reversal', 'cashout'));`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "credit_transaction" drop constraint if exists "credit_transaction_reason_check";`,
    );
    // The narrow check cannot hold with the new reasons present — remove them
    // first (same reasoning as the pack_open/topup widening migrations).
    this.addSql(
      `delete from "credit_transaction" where "reason" in ('direct_referral', 'team_override', 'commission_reversal', 'cashout');`,
    );
    this.addSql(
      `alter table if exists "credit_transaction" add constraint "credit_transaction_reason_check" check("reason" in ('buyback', 'topup', 'pack_open', 'adjustment'));`,
    );
  }
}

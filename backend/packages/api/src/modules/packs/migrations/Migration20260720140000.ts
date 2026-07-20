import { Migration } from '@medusajs/framework/mikro-orm/migrations';

// pull.open_id — the money↔card audit link: the same uuid the open's charge
// row stores in credit_transaction.source_transaction_id, now stamped on the
// pull(s) that charge paid for (a count=N batch shares one open_id across its
// N pulls). Nullable + forward-only: reward pulls (no charge; reward_draw is
// their provenance) and all pre-migration rows stay NULL — never back-filled,
// matching source_transaction_id's own forward-only discipline.
export class Migration20260720140000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "pull" add column if not exists "open_id" text null;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "pull" drop column if exists "open_id";`,
    );
  }
}

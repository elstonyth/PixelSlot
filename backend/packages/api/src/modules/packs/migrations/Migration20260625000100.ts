import { Migration } from '@medusajs/framework/mikro-orm/migrations';

// A3 — hand-written partial-unique index on reward_draw.
// db:generate cannot emit partial-expression unique indexes, so this is
// authored by hand (per enum-CHECK taxonomy: partial-expression index =
// hand-written). The unique tuple (customer_id, draw_day, draw_ordinal)
// WHERE deleted_at IS NULL is the daily-cap backstop that, combined with the
// credit: advisory lock, prevents concurrent over-draws (spec §5.2, B6).
export class Migration20260625000100 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_reward_draw_customer_day_ordinal" ON "reward_draw" ("customer_id", "draw_day", "draw_ordinal") WHERE deleted_at IS NULL;`,
    );
  }

  override async down(): Promise<void> {
    this.addSql(
      `DROP INDEX IF EXISTS "UQ_reward_draw_customer_day_ordinal";`,
    );
  }
}

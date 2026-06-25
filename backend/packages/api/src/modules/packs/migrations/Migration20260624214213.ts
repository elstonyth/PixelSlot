import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260624214213 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "reward_draw" ("id" text not null, "customer_id" text not null, "tier" text not null, "draw_day" text not null, "draw_ordinal" integer not null, "prize_kind" text check ("prize_kind" in ('product', 'credit', 'nothing')) not null, "prize_snapshot" jsonb not null, "vault_pull_id" text null, "credit_txn_id" text null, "status" text check ("status" in ('drawn', 'voided')) not null default 'drawn', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "reward_draw_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_reward_draw_deleted_at" ON "reward_draw" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_reward_draw_customer_day" ON "reward_draw" ("customer_id", "draw_day") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "reward_draw" cascade;`);
  }

}

import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260704070016 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "reward_draw" drop constraint if exists "reward_draw_prize_kind_check";`);
    this.addSql(`alter table if exists "reward_draw" add constraint "reward_draw_prize_kind_check" check ("prize_kind" in ('product','credit','voucher','nothing'));`);
    this.addSql(`alter table if exists "reward_draw" add column if not exists "odds_snapshot" jsonb null;`);

    this.addSql(`alter table if exists "vip_reward_grant" add column if not exists "origin" text check ("origin" in ('ladder', 'box')) not null default 'ladder';`);

    this.addSql(`drop index if exists "UQ_vip_reward_grant_customer_level_kind";`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_vip_reward_grant_customer_level_kind" ON "vip_reward_grant" (customer_id, level, kind) WHERE deleted_at IS NULL AND origin = 'ladder';`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "UQ_vip_reward_grant_customer_level_kind";`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_vip_reward_grant_customer_level_kind" ON "vip_reward_grant" (customer_id, level, kind) WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "vip_reward_grant" drop column if exists "origin";`);

    this.addSql(`alter table if exists "reward_draw" drop constraint if exists "reward_draw_prize_kind_check";`);
    this.addSql(`alter table if exists "reward_draw" drop column if exists "odds_snapshot";`);
    this.addSql(`alter table if exists "reward_draw" add constraint "reward_draw_prize_kind_check" check ("prize_kind" in ('product','credit','nothing'));`);
  }

}

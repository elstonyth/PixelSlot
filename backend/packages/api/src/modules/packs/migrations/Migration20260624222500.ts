import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260624222500 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "rewards_settings" add column if not exists "withdrawals_per_day" integer not null default 1;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "rewards_settings" drop column if exists "withdrawals_per_day";`);
  }

}

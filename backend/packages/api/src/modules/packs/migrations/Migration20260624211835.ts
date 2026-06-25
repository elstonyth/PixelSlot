import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260624211835 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "pack" add column if not exists "pool_enabled" boolean not null default false, add column if not exists "draws_per_day" integer not null default 0;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "pack" drop column if exists "pool_enabled", drop column if exists "draws_per_day";`);
  }

}

import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260611080753 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "pull" add column if not exists "stock_earmarked" boolean not null default false;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "pull" drop column if exists "stock_earmarked";`);
  }

}

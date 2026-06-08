import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260608094036 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "pack_odds" add column if not exists "locked" boolean not null default false;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "pack_odds" drop column if exists "locked";`);
  }

}

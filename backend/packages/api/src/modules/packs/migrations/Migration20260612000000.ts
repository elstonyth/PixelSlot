import { Migration } from "@medusajs/framework/mikro-orm/migrations";

// Flat-rate vault buyback: sells from the vault/inventory always pay the
// site-wide flat rate (90% — FLAT_PERCENT in modules/packs/buyback-rate.ts),
// so the per-pack vault_buyback_percent column is dropped. buyback_percent
// stays as the instant/on-the-spot rate behind the 30s keep/sell countdown.
export class Migration20260612000000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "pack" drop column if exists "vault_buyback_percent";`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "pack" add column if not exists "vault_buyback_percent" integer not null default 90;`);
  }

}

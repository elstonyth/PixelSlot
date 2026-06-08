import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260608045250 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "card" drop constraint if exists "card_handle_unique";`);
    this.addSql(`create table if not exists "card" ("id" text not null, "handle" text not null, "name" text not null, "set" text not null, "grader" text not null, "grade" text not null, "rarity" text check ("rarity" in ('Legendary', 'Epic', 'Rare', 'Uncommon', 'Common')) not null, "market_value" numeric not null, "image" text not null, "raw_market_value" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "card_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_card_handle_unique" ON "card" ("handle") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_card_deleted_at" ON "card" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "pack_odds" ("id" text not null, "pack_id" text not null, "card_id" text not null, "weight" integer not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pack_odds_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pack_odds_deleted_at" ON "pack_odds" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "pull" ("id" text not null, "customer_id" text not null, "pack_id" text not null, "card_id" text not null, "order_id" text null, "rolled_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pull_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pull_deleted_at" ON "pull" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "card" cascade;`);

    this.addSql(`drop table if exists "pack_odds" cascade;`);

    this.addSql(`drop table if exists "pull" cascade;`);
  }

}

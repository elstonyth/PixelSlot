import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260608035226 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "pack" drop constraint if exists "pack_slug_unique";`);
    this.addSql(`create table if not exists "pack" ("id" text not null, "slug" text not null, "title" text not null, "category" text not null, "price" integer not null, "image" text not null, "boost" boolean not null default false, "rank" integer not null default 0, "status" text check ("status" in ('active', 'draft')) not null default 'active', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pack_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pack_slug_unique" ON "pack" ("slug") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pack_deleted_at" ON "pack" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "pack" cascade;`);
  }

}

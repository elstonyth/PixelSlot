import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260704072247 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "admin_action_audit" drop constraint if exists "admin_action_audit_entity_type_check";`);
    this.addSql(`alter table if exists "admin_action_audit" drop constraint if exists "admin_action_audit_action_check";`);

    this.addSql(`alter table if exists "admin_action_audit" add constraint "admin_action_audit_entity_type_check" check("entity_type" in ('customer', 'commission', 'rewards_settings', 'credit', 'reward_pool', 'daily_reward_settings', 'daily_box', 'voucher_ladder'));`);
    this.addSql(`alter table if exists "admin_action_audit" add constraint "admin_action_audit_action_check" check("action" in ('freeze', 'unfreeze', 'reverse_commission', 'suspend_commission', 'unsuspend_commission', 'adjust_credit', 'edit_rewards_settings', 'edit_reward_pool', 'edit_daily_reward_settings', 'edit_daily_box', 'edit_voucher_ladder'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "admin_action_audit" drop constraint if exists "admin_action_audit_entity_type_check";`);
    this.addSql(`alter table if exists "admin_action_audit" drop constraint if exists "admin_action_audit_action_check";`);

    this.addSql(`alter table if exists "admin_action_audit" add constraint "admin_action_audit_entity_type_check" check("entity_type" in ('customer', 'commission', 'rewards_settings', 'credit', 'reward_pool', 'daily_reward_settings'));`);
    this.addSql(`alter table if exists "admin_action_audit" add constraint "admin_action_audit_action_check" check("action" in ('freeze', 'unfreeze', 'reverse_commission', 'suspend_commission', 'unsuspend_commission', 'adjust_credit', 'edit_rewards_settings', 'edit_reward_pool', 'edit_daily_reward_settings'));`);
  }

}

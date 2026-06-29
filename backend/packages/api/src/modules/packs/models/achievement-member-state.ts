import { model } from '@medusajs/framework/utils';

// Per-customer achievements projection (mirrors vip_member_state). Rebuildable
// from pulls + ledger + grant rows. peak_* and highest_level_ever are monotonic.
export const AchievementMemberState = model.define('achievement_member_state', {
  id: model.id().primaryKey(),
  customer_id: model.text().unique(),
  peak_cases_opened: model.number().default(0),
  peak_collection_size: model.number().default(0),
  total_xp: model.number().default(0),
  collector_level: model.number().default(1),
  highest_level_ever: model.number().default(1),
});

export default AchievementMemberState;

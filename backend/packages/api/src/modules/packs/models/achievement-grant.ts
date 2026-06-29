import { model } from '@medusajs/framework/utils';

// One row per unlocked achievement (mirrors vip_reward_grant). xp_awarded is a
// snapshot, immune to later def edits. Unique (customer_id, achievement_key).
export const AchievementGrant = model
  .define('achievement_grant', {
    id: model.id().primaryKey(),
    customer_id: model.text(),
    achievement_key: model.text(),
    xp_awarded: model.number(),
    unlocked_at: model.dateTime(),
  })
  .indexes([
    {
      name: 'IDX_achievement_grant_unique',
      on: ['customer_id', 'achievement_key'],
      unique: true,
      where: 'deleted_at IS NULL',
    },
  ]);

export default AchievementGrant;

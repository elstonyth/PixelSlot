import { model } from '@medusajs/framework/utils';

// Achievement definition (mirrors vip_level). Admin-editable. `metric` selects
// which customer counter the `threshold` is compared against.
export const AchievementDef = model.define('achievement_def', {
  id: model.id().primaryKey(),
  key: model.text().unique(), // e.g. 'cases_opened_25'
  name: model.text(),
  description: model.text(),
  category: model.text(), // 'cases_opened' | 'collection' | 'spending'
  rarity: model.text(), // Common..Legendary (display only)
  xp: model.number(),
  metric: model.text(), // 'spend' | 'cases_opened' | 'collection_size'
  threshold: model.number(), // spend in MYR (compared in sen); counts as integers
});

export default AchievementDef;

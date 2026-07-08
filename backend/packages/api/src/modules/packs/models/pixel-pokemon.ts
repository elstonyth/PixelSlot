import { model } from '@medusajs/framework/utils';

// PixelPokemon — the pixel-sprite library each Card links to by id (Spec 2).
// One "normal" row per national dex is seeded (encyclopedia); admins add
// variants / custom uploads later. `dex` is grouping/display only (NOT unique —
// many variants can share a dex); the id is the unique link key. `image_url` is
// a Spaces-hosted sprite (the "sprite not loaded" root fix); null → the
// storefront renders its poké-ball fallback. `types` is always written as a
// string[] (possibly empty).
export const PixelPokemon = model.define('pixel_pokemon', {
  id: model.id().primaryKey(),
  name: model.text(),
  dex: model.number().nullable(),
  variant: model.text().default('normal'),
  types: model.json(),
  image_url: model.text().nullable(),
  image_key: model.text().nullable(),
  is_custom: model.boolean().default(false),
});

export default PixelPokemon;

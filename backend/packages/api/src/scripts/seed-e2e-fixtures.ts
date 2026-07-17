import { ExecArgs } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { RARITY_WEIGHT, type OddsRarity } from '@acme/odds-math';
import { PACKS_MODULE } from '../modules/packs';
import type PacksModuleService from '../modules/packs/service';

// seed-e2e-fixtures — E2E-ONLY fixture. The prod catalog seed (seed.ts, run by
// deploy:init) ships packs as EMPTY DRAFTS by design (operators register cards
// in admin), so a fresh CI DB has NO openable pack — the whole nightly E2E suite
// then dies at auth.setup's `seed packs present` preflight and 19 specs never
// run. This script recreates the two fully-populated, ACTIVE packs the specs
// hardcode (pokemon-rookie / pokemon-elite) with just the rows a pack open
// actually reads: an active Pack, its Card rows, and weighted PackOdds. No
// product/inventory/slab-bake — the roll (workflows/steps/roll-pack.ts) needs
// none of that, and skipping it also dodges the localhost-SSRF bake trap in CI.
//
// NEVER wire this into deploy:init — it must not touch the prod catalog. It runs
// only from the e2e workflow (deploy:seed-e2e) and locally when driving the suite.
//
// Idempotent: guarded by pack slug, card handle, and (pack_id, card_id) so a
// re-run is a no-op. Run from backend/packages/api:
//   corepack yarn medusa exec ./src/scripts/seed-e2e-fixtures.ts

type CardSeed = {
  handle: string;
  name: string;
  rarity: OddsRarity; // the card's tier IN THESE PACKS (drives PackOdds.weight)
  market_value: number; // raw USD FMV decimal (the system's only USD)
};

// A small mixed-rarity pool, shared by both packs (odds are per-pack rows, so
// sharing cards keeps the two packs' draws fully independent). Distinct names —
// odds-reflection.spec's forceCardTo100ViaUI selects a card by name. Images
// point at real seeded assets (public/cdn/cards/h-0NN.webp) so nothing 404s.
const CARDS: CardSeed[] = [
  {
    handle: 'pw-pikachu',
    name: 'PW Pikachu',
    rarity: 'Common',
    market_value: 5,
  },
  {
    handle: 'pw-bulbasaur',
    name: 'PW Bulbasaur',
    rarity: 'Common',
    market_value: 8,
  },
  {
    handle: 'pw-jolteon',
    name: 'PW Jolteon',
    rarity: 'Uncommon',
    market_value: 25,
  },
  { handle: 'pw-gengar', name: 'PW Gengar', rarity: 'Rare', market_value: 120 },
  {
    handle: 'pw-charizard',
    name: 'PW Charizard',
    rarity: 'Rare',
    market_value: 350,
  },
  {
    handle: 'pw-mewtwo',
    name: 'PW Mewtwo',
    rarity: 'Mythical',
    market_value: 900,
  },
];

const cardImage = (n: number): string =>
  `/cdn/cards/h-${String(n).padStart(3, '0')}.webp`;

type PackSeed = { slug: string; title: string; price: number; rank: number };

// Net-new packs — the base seed owns bronze/silver/gold/platinum/diamond, so
// these slugs never collide. Prices match odds-reflection.spec's funding math
// (rookie RM25, elite RM50: 3 opens of each = RM225, under the RM400 it funds).
const PACKS: PackSeed[] = [
  {
    slug: 'pokemon-rookie',
    title: 'Pokémon Rookie (E2E)',
    price: 25,
    rank: 90,
  },
  { slug: 'pokemon-elite', title: 'Pokémon Elite (E2E)', price: 50, rank: 91 },
];

export default async function seedE2eFixtures({
  container,
}: ExecArgs): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const packs = container.resolve<PacksModuleService>(PACKS_MODULE);

  const packSlugs = PACKS.map((p) => p.slug);
  const cardHandles = CARDS.map((c) => c.handle);

  // --- Packs (active) ------------------------------------------------------
  const existingPacks = await packs.listPacks(
    { slug: packSlugs },
    { select: ['slug'], take: packSlugs.length },
  );
  const havePack = new Set(existingPacks.map((p) => p.slug));
  const packsToCreate = PACKS.filter((p) => !havePack.has(p.slug)).map((p) => ({
    slug: p.slug,
    title: p.title,
    category: 'pokemon', // must be non-'reward_box' to be openable
    price: p.price,
    image: `/images/polycards/bronze-pack.webp`, // reuse a real seeded asset
    rank: p.rank,
    status: 'active' as const,
  }));
  if (packsToCreate.length > 0) {
    await packs.createPacks(packsToCreate);
    logger.info(`[e2e] Seeded ${packsToCreate.length} active pack(s).`);
  } else {
    logger.info('[e2e] Packs already present, skipping.');
  }

  // --- Cards ---------------------------------------------------------------
  const existingCards = await packs.listCards(
    { handle: cardHandles },
    { select: ['handle'], take: cardHandles.length },
  );
  const haveCard = new Set(existingCards.map((c) => c.handle));
  const cardsToCreate = CARDS.filter((c) => !haveCard.has(c.handle)).map(
    (c, i) => ({
      handle: c.handle,
      name: c.name,
      set: 'PW E2E Set',
      grader: 'PSA',
      grade: '10',
      market_value: c.market_value,
      image: cardImage(i + 1),
      // Gacha-pool only; there is no backing Medusa product, so keep it off the
      // marketplace (for_sale defaults true, which assumes a mirrored product).
      for_sale: false,
    }),
  );
  if (cardsToCreate.length > 0) {
    await packs.createCards(cardsToCreate);
    logger.info(`[e2e] Seeded ${cardsToCreate.length} card(s).`);
  } else {
    logger.info('[e2e] Cards already present, skipping.');
  }

  // --- Odds (one weighted row per pack×card) -------------------------------
  // Pull chance = weight / Σ(weights in pack). RARITY_WEIGHT is the same table
  // the live odds engine uses, so fixture weights can't drift from the tiers.
  // Idempotency is keyed per (pack, card), not per pack: a partial failure that
  // created only some of a pack's odds rows must be backfilled on re-run, not
  // skipped because the pack already has *an* odds row.
  const existingOdds = await packs.listPackOdds(
    { pack_id: packSlugs },
    { select: ['pack_id', 'card_id'], take: packSlugs.length * CARDS.length + 1 },
  );
  const oddsKey = (packId: string, cardId: string): string =>
    `${packId}::${cardId}`;
  const haveOdds = new Set(
    existingOdds.map((o) => oddsKey(o.pack_id, o.card_id ?? '')),
  );
  const oddsToCreate = PACKS.flatMap((pack) =>
    CARDS.filter((card) => !haveOdds.has(oddsKey(pack.slug, card.handle))).map(
      (card) => ({
        pack_id: pack.slug,
        card_id: card.handle,
        rarity: card.rarity,
        weight: RARITY_WEIGHT[card.rarity],
      }),
    ),
  );
  if (oddsToCreate.length > 0) {
    await packs.createPackOdds(oddsToCreate);
    logger.info(`[e2e] Seeded ${oddsToCreate.length} pack-odds row(s).`);
  } else {
    logger.info('[e2e] Pack odds already present, skipping.');
  }

  // --- FX rate (firm) ------------------------------------------------------
  // Buyback quotes are FIRM only when a USD_MYR FxRate row exists (else
  // resolveFxRateInfo returns firm:false and the reveal shows "Keep in vault"
  // with NO sell button, and the vault bulk-sell button is disabled). The base
  // seed creates none — locally a scheduled frankfurter fetch fills it, but a
  // fresh CI DB has nothing, so every sell-path spec (reveal sell, vault
  // bulk-sell) fails. Seed one firm rate so those flows are exercisable.
  const [fx] = await packs.listFxRates({ pair: 'USD_MYR' }, { take: 1 });
  if (!fx) {
    await packs.createFxRates([
      {
        pair: 'USD_MYR',
        rate: 4.0725,
        source: 'e2e-fixture',
        manual_override: false,
        manual_rate: null,
      },
    ]);
    logger.info('[e2e] Seeded firm USD_MYR FX rate.');
  } else {
    logger.info('[e2e] FX rate already present, skipping.');
  }

  logger.info('[e2e] Fixture seed complete.');
}

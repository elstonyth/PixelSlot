import {
  CreateInventoryLevelInput,
  ExecArgs,
} from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  deleteProductsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import { MercurModules, SellerStatus } from "@mercurjs/types";

const updateStoreCurrencies = createWorkflow(
  "update-store-currencies",
  (input: {
    supported_currencies: { currency_code: string; is_default?: boolean }[];
    store_id: string;
  }) => {
    const normalizedInput = transform({ input }, (data) => {
      return {
        selector: { id: data.input.store_id },
        update: {
          supported_currencies: data.input.supported_currencies.map(
            (currency) => {
              return {
                currency_code: currency.currency_code,
                is_default: currency.is_default ?? false,
              };
            }
          ),
        },
      };
    });

    const stores = updateStoresStep(normalizedInput);

    return new WorkflowResponse(stores);
  }
);

// ---------------------------------------------------------------------------
// Pokénic card catalog — the single source of truth for the marketplace.
//
// Seeded as products owned by a "house" seller because Mercur's store API only
// surfaces a product when it is linked to a seller whose status is "open"
// (see @mercurjs/core store/products `applyVisibleSellerIdsFilter`). The
// storefront reads these back through the Store API; `handle` doubles as the
// `/card/<slug>` route id, and `metadata` carries the card-specific facts
// (fmv/points/grade/grader/set/rarity/year) that are not first-class Medusa
// product fields. Images are local assets under the storefront's
// public/cdn/cards/ and are stored as site-relative URLs.
// ---------------------------------------------------------------------------
const HOUSE_SELLER = {
  name: "House",
  handle: "house",
  email: "house@pokenic.local",
} as const;

// Only 7 real graded-slab images were harvested from the live site; the 16
// listings intentionally reuse them (matching the original clone's static data).
// Each id maps to an existing public/cdn/cards/<id>.webp — adding a new card
// without a real image should reuse one of these, not invent a missing filename.
const CARD_IMG = {
  celebi: "FQEYWuGiKTkJpZSG6XqGHDBmH6EmxctEqk1kAT2MYzHc",
  mewtwo: "9kRLkdbbvzm335GBvraQrWrNVs72gzEzynvP1RPvftTx",
  darkrai: "4h13RDtFX4MWNYjvgMPeBS1hcL4AewupiFzDvyFUUTkd",
  jolteon: "BEnddEeBXBHyL5qWXCg6sKS5VmUbUtZaKJ1aVB8yCWHN",
  rapidash: "FFbo5jfXHHQWN8bmc88UDYSDP5QzYCCj6RwUkiWYyffC",
  hooh: "FjAJZ7en585MpnoLUGbuALHEmbBAPd61EZCefQzFMmRX",
  gengar: "6noxMybjBLtLqicAUTrG63VhWG2FgWzDBsQGnnZEyNCG",
} as const;

const cardImage = (id: string) => `/cdn/cards/${id}.webp`;

type CardSeed = {
  handle: string;
  title: string;
  price: number; // USD listing price
  fmv: number; // USD fair-market value
  points: number;
  grade: string;
  grader: string;
  set: string;
  rarity: string;
  year: number;
  image: string;
};

const CARD_PRODUCTS: CardSeed[] = [
  {
    handle: "celebi",
    title:
      "2021 Pokemon Japanese Sword & Shield Jet-Black Spirit Celebi V #3 CGC 10 GEM MINT",
    price: 18.4,
    fmv: 19.2,
    points: 93,
    grade: "10 GEM MINT",
    grader: "CGC",
    set: "Jet-Black Spirit",
    rarity: "Rare",
    year: 2021,
    image: cardImage(CARD_IMG.celebi),
  },
  {
    handle: "mewtwo",
    title:
      "2025 Pokemon Japanese SV Glory Of Rocket Gang Holo Team Rockets Mewtwo ex CGC 10",
    price: 24.75,
    fmv: 23.9,
    points: 100,
    grade: "10 GEM MINT",
    grader: "CGC",
    set: "Glory of Team Rocket",
    rarity: "Rare",
    year: 2025,
    image: cardImage(CARD_IMG.mewtwo),
  },
  {
    handle: "darkrai-gg",
    title:
      "2023 Pokemon Sword and Shield Crown Zenith Galarian Gallery Darkrai Vstar #GG50 PSA 10",
    price: 41.2,
    fmv: 39.8,
    points: 100,
    grade: "10",
    grader: "PSA",
    set: "Crown Zenith",
    rarity: "Epic",
    year: 2023,
    image: cardImage(CARD_IMG.darkrai),
  },
  {
    handle: "jolteon",
    title:
      "2024 Pokemon Japanese Scarlet & Violet Terastal Fest ex Holo Jolteon ex #52 CGC 10 PRISTINE",
    price: 15.6,
    fmv: 16.1,
    points: 96,
    grade: "10 PRISTINE",
    grader: "CGC",
    set: "Terastal Festival ex",
    rarity: "Uncommon",
    year: 2024,
    image: cardImage(CARD_IMG.jolteon),
  },
  {
    handle: "shaymin",
    title:
      "2022 Pokemon Japanese Sword & Shield Star Birth Holo Shaymin VSTAR #13 CGC 9.5 MINT+",
    price: 12.9,
    fmv: 13.4,
    points: 95,
    grade: "9.5 MINT+",
    grader: "CGC",
    set: "Star Birth",
    rarity: "Uncommon",
    year: 2022,
    image: cardImage(CARD_IMG.celebi),
  },
  {
    handle: "rapidash",
    title:
      "2025 Pokemon Japanese Mega Start Deck 100 Battle Collection Reverse Holo Rapidash #90 CGC 10",
    price: 8.45,
    fmv: 8.9,
    points: 92,
    grade: "10",
    grader: "CGC",
    set: "Battle Collection",
    rarity: "Common",
    year: 2025,
    image: cardImage(CARD_IMG.rapidash),
  },
  {
    handle: "hooh",
    title:
      "2022 Pokemon Japanese Sword & Shield Incandescent Arcana Ho-Oh V #55 CGC 10 GEM MINT",
    price: 21.3,
    fmv: 20.5,
    points: 98,
    grade: "10 GEM MINT",
    grader: "CGC",
    set: "Incandescent Arcana",
    rarity: "Rare",
    year: 2022,
    image: cardImage(CARD_IMG.hooh),
  },
  {
    handle: "gengar",
    title:
      "2023 Pokemon Japanese Scarlet & Violet 151 Holo Gengar #94 CGC 10 GEM MINT",
    price: 29.99,
    fmv: 31.2,
    points: 100,
    grade: "10 GEM MINT",
    grader: "CGC",
    set: "Scarlet & Violet 151",
    rarity: "Epic",
    year: 2023,
    image: cardImage(CARD_IMG.gengar),
  },
  {
    handle: "espathra",
    title:
      "2023 Pokemon Scarlet & Violet Paradox Rift Reverse Holo Espathra #081 CGC 8.5 NM-MT+",
    price: 9.59,
    fmv: 9.96,
    points: 90,
    grade: "8.5 NM-MT+",
    grader: "CGC",
    set: "Paradox Rift",
    rarity: "Common",
    year: 2023,
    image: cardImage(CARD_IMG.gengar),
  },
  {
    handle: "mimikyu",
    title:
      "2021 Pokemon Japanese SWSH VMAX Climax Mimikyu VMAX #77 CGC 8.5 NM-MT+",
    price: 9.33,
    fmv: 9.96,
    points: 92,
    grade: "8.5 NM-MT+",
    grader: "CGC",
    set: "VMAX Climax",
    rarity: "Common",
    year: 2021,
    image: cardImage(CARD_IMG.celebi),
  },
  {
    handle: "lycanroc",
    title:
      "2016 Pokemon Japanese Sun & Moon Rockruff Full Power Deck Holo Lycanroc GX #9 CGC 5.5",
    price: 7.8,
    fmv: 8.4,
    points: 92,
    grade: "5.5",
    grader: "CGC",
    set: "Sun & Moon",
    rarity: "Common",
    year: 2016,
    image: cardImage(CARD_IMG.rapidash),
  },
  {
    handle: "garchomp",
    title:
      "2025 Pokemon Japanese Mega Dream ex Holo Cynthia's Garchomp ex #90 CGC 8.5 NM-MT+",
    price: 9.1,
    fmv: 9.5,
    points: 92,
    grade: "8.5 NM-MT+",
    grader: "CGC",
    set: "Mega Dream ex",
    rarity: "Common",
    year: 2025,
    image: cardImage(CARD_IMG.mewtwo),
  },
  {
    handle: "ribombee",
    title:
      "2025 Pokemon Scarlet & Violet Journey Together Holo Lillie's Ribombee #67 CGC 9.5 MINT",
    price: 11.2,
    fmv: 10.8,
    points: 97,
    grade: "9.5 MINT",
    grader: "CGC",
    set: "Journey Together",
    rarity: "Uncommon",
    year: 2025,
    image: cardImage(CARD_IMG.jolteon),
  },
  {
    handle: "obstagoon",
    title:
      "2023 Pokemon Sword & Shield Fusion Strike K.O. Collection Galarian Obstagoon #161 CGC 9",
    price: 12.0,
    fmv: 11.5,
    points: 100,
    grade: "9",
    grader: "CGC",
    set: "Fusion Strike",
    rarity: "Uncommon",
    year: 2023,
    image: cardImage(CARD_IMG.hooh),
  },
  {
    handle: "darkrai-tot",
    title:
      "2024 Pokemon Scarlet & Violet Obsidian Flames Trick Or Trade Holo Darkrai #136 CGC 9.5",
    price: 13.4,
    fmv: 12.9,
    points: 100,
    grade: "9.5",
    grader: "CGC",
    set: "Obsidian Flames",
    rarity: "Uncommon",
    year: 2024,
    image: cardImage(CARD_IMG.darkrai),
  },
  {
    handle: "dustox",
    title: "2025 Pokemon Japanese Mega Dream ex AR Dustox #195 CGC 9 MINT",
    price: 10.2,
    fmv: 9.25,
    points: 100,
    grade: "9 MINT",
    grader: "CGC",
    set: "Mega Dream ex",
    rarity: "Common",
    year: 2025,
    image: cardImage(CARD_IMG.celebi),
  },
];

const CARD_HANDLES = CARD_PRODUCTS.map((c) => c.handle);
// Handle = the storefront's /card/<slug> id and the seed's idempotency key, so a
// duplicate would silently drop a card (the existing-handle guard dedupes it).
// Fail fast at load instead of seeding a short catalog.
if (new Set(CARD_HANDLES).size !== CARD_HANDLES.length) {
  throw new Error("CARD_PRODUCTS contains duplicate handles");
}
const DEMO_APPAREL_HANDLES = ["t-shirt", "sweatshirt", "sweatpants", "shorts"];

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);

  const countries = ["gb", "de", "dk", "se", "fr", "es", "it"];

  logger.info("Seeding store data...");
  const [store] = await storeModuleService.listStores();
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    // create the default sales channel
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
          },
        ],
      },
    });
    defaultSalesChannel = salesChannelResult;
  }

  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [
        {
          currency_code: "eur",
          is_default: true,
        },
        {
          currency_code: "usd",
        },
      ],
    },
  });

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  });
  logger.info("Seeding region data...");
  const regionModuleService = container.resolve(Modules.REGION);

  // Check if any of the countries are already assigned to a region
  const existingRegions = await regionModuleService.listRegions({}, {
    relations: ["countries"],
  });

  const assignedCountries = new Set<string>();
  for (const r of existingRegions) {
    for (const c of r.countries || []) {
      assignedCountries.add(c.iso_2);
    }
  }

  const unassignedCountries = countries.filter(c => !assignedCountries.has(c));

  let region;
  if (unassignedCountries.length === 0) {
    // All countries already assigned - find the region that has most of our countries
    region = existingRegions.find(r =>
      r.countries?.some(c => countries.includes(c.iso_2))
    ) || existingRegions[0];
    logger.info("Countries already assigned to a region, skipping region creation.");
  } else if (unassignedCountries.length < countries.length) {
    // Some countries assigned, some not - only create with unassigned ones
    logger.info(`Some countries already assigned, creating region with: ${unassignedCountries.join(", ")}`);
    const { result: regionResult } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Europe",
            currency_code: "eur",
            countries: unassignedCountries,
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    });
    region = regionResult[0];
  } else {
    // No countries assigned - create full region
    const { result: regionResult } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Europe",
            currency_code: "eur",
            countries,
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    });
    region = regionResult[0];
  }

  // USD region — the storefront prices and displays cards in USD, so it queries
  // `/store/products` with this region's id to resolve `calculated_price` in USD
  // (card variants carry USD prices). Guarded by currency so re-runs are no-ops.
  const allRegions = await regionModuleService.listRegions({});
  let usdRegion = allRegions.find((r) => r.currency_code === "usd");
  if (!usdRegion) {
    // Only claim "us" if no existing region already has it (countries are unique
    // to one region); a USD region with no country still resolves USD prices.
    const usdCountries = assignedCountries.has("us") ? [] : ["us"];
    const { result: usdRegionResult } = await createRegionsWorkflow(
      container
    ).run({
      input: {
        regions: [
          {
            name: "United States",
            currency_code: "usd",
            countries: usdCountries,
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    });
    usdRegion = usdRegionResult[0];
    logger.info(`Created USD region (${usdRegion.id}).`);
  } else {
    logger.info("USD region already exists, skipping.");
  }
  logger.info("Finished seeding regions.");

  logger.info("Seeding tax regions...");
  const taxModuleService = container.resolve(Modules.TAX);
  const existingTaxRegions = await taxModuleService.listTaxRegions();
  const existingCountryCodes = new Set(existingTaxRegions.map((tr) => tr.country_code));
  const countriesToCreate = countries.filter((c) => !existingCountryCodes.has(c));

  if (countriesToCreate.length > 0) {
    await createTaxRegionsWorkflow(container).run({
      input: countriesToCreate.map((country_code) => ({
        country_code,
        provider_id: "tp_system",
      })),
    });
  } else {
    logger.info("Tax regions already exist, skipping.");
  }
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  const stockLocationModule = container.resolve(Modules.STOCK_LOCATION);
  const existingStockLocations = await stockLocationModule.listStockLocations({
    name: "European Warehouse",
  });

  let stockLocation;
  if (existingStockLocations.length) {
    stockLocation = existingStockLocations[0];
    logger.info("Stock location 'European Warehouse' already exists, skipping.");
  } else {
    const { result: stockLocationResult } = await createStockLocationsWorkflow(
      container
    ).run({
      input: {
        locations: [
          {
            name: "European Warehouse",
            address: {
              city: "Copenhagen",
              country_code: "DK",
              address_1: "",
            },
          },
        ],
      },
    });
    stockLocation = stockLocationResult[0];
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        default_location_id: stockLocation.id,
      },
    },
  });

  // Link stock location to fulfillment provider (idempotent)
  try {
    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocation.id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_provider_id: "manual_manual",
      },
    });
  } catch (error: unknown) {
    // Ignore if link already exists
    if (!(error instanceof Error && error.message.includes("already exists"))) {
      throw error;
    }
    logger.info("Stock location already linked to fulfillment provider, skipping.");
  }

  logger.info("Seeding fulfillment data...");
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null;

  if (!shippingProfile) {
    const { result: shippingProfileResult } =
      await createShippingProfilesWorkflow(container).run({
        input: {
          data: [
            {
              name: "Default Shipping Profile",
              type: "default",
            },
          ],
        },
      });
    shippingProfile = shippingProfileResult[0];
  }

  const existingFulfillmentSets = await fulfillmentModuleService.listFulfillmentSets({
    name: "European Warehouse delivery",
  });

  let fulfillmentSet;
  if (existingFulfillmentSets.length) {
    fulfillmentSet = existingFulfillmentSets[0];
    logger.info("Fulfillment set 'European Warehouse delivery' already exists, skipping.");
  } else {
    fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: "European Warehouse delivery",
      type: "shipping",
      service_zones: [
        {
          name: "Europe",
          geo_zones: [
            {
              country_code: "gb",
              type: "country",
            },
            {
              country_code: "de",
              type: "country",
            },
            {
              country_code: "dk",
              type: "country",
            },
            {
              country_code: "se",
              type: "country",
            },
            {
              country_code: "fr",
              type: "country",
            },
            {
              country_code: "es",
              type: "country",
            },
            {
              country_code: "it",
              type: "country",
            },
          ],
        },
      ],
    });

    try {
      await link.create({
        [Modules.STOCK_LOCATION]: {
          stock_location_id: stockLocation.id,
        },
        [Modules.FULFILLMENT]: {
          fulfillment_set_id: fulfillmentSet.id,
        },
      });
    } catch (error: unknown) {
      if (!(error instanceof Error && error.message.includes("already exists"))) {
        throw error;
      }
    }

    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "Standard Shipping",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Standard",
            description: "Ship in 2-3 days.",
            code: "standard",
          },
          prices: [
            {
              currency_code: "usd",
              amount: 10,
            },
            {
              currency_code: "eur",
              amount: 10,
            },
            {
              region_id: region.id,
              amount: 10,
            },
          ],
          rules: [
            {
              attribute: "enabled_in_store",
              value: "true",
              operator: "eq",
            },
            {
              attribute: "is_return",
              value: "false",
              operator: "eq",
            },
          ],
        },
        {
          name: "Express Shipping",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Express",
            description: "Ship in 24 hours.",
            code: "express",
          },
          prices: [
            {
              currency_code: "usd",
              amount: 10,
            },
            {
              currency_code: "eur",
              amount: 10,
            },
            {
              region_id: region.id,
              amount: 10,
            },
          ],
          rules: [
            {
              attribute: "enabled_in_store",
              value: "true",
              operator: "eq",
            },
            {
              attribute: "is_return",
              value: "false",
              operator: "eq",
            },
          ],
        },
      ],
    });
  }
  logger.info("Finished seeding fulfillment data.");

  // Link sales channel to stock location (idempotent - workflow handles duplicates)
  try {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: {
        id: stockLocation.id,
        add: [defaultSalesChannel[0].id],
      },
    });
  } catch (error: unknown) {
    // Ignore if link already exists
    if (!(error instanceof Error && error.message.includes("already"))) {
      throw error;
    }
    logger.info("Sales channel already linked to stock location, skipping.");
  }
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding publishable API key data...");
  let publishableApiKey;
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id"],
    filters: {
      type: "publishable",
    },
  });

  publishableApiKey = data?.[0];

  if (!publishableApiKey) {
    const {
      result: [publishableApiKeyResult],
    } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          {
            title: "Webshop",
            type: "publishable",
            created_by: "",
          },
        ],
      },
    });

    publishableApiKey = publishableApiKeyResult
  }

  // Link sales channel to API key (idempotent)
  try {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: {
        id: publishableApiKey.id,
        add: [defaultSalesChannel[0].id],
      },
    });
  } catch (error: unknown) {
    // Ignore if link already exists
    if (!(error instanceof Error && error.message.includes("already"))) {
      throw error;
    }
    logger.info("Sales channel already linked to API key, skipping.");
  }
  logger.info("Finished seeding publishable API key data.");

  logger.info("Seeding marketplace catalog...");

  const productModule = container.resolve(Modules.PRODUCT);

  // House seller — Mercur's store/products filter only surfaces products linked
  // to a seller whose status is "open", so the catalog needs one owner. Guarded
  // by handle (name/email/handle are unique) so re-runs are idempotent.
  const sellerService = container.resolve(MercurModules.SELLER);
  const existingSellers = await sellerService.listSellers({
    handle: HOUSE_SELLER.handle,
  });

  let houseSeller = existingSellers[0];
  if (!houseSeller) {
    const [created] = await sellerService.createSellers([
      {
        ...HOUSE_SELLER,
        currency_code: "usd",
        status: SellerStatus.OPEN,
        metadata: { house: true },
      },
    ]);
    houseSeller = created;
    logger.info(`Created house seller (${houseSeller.id}).`);
  } else {
    logger.info("House seller already exists, skipping.");
  }

  // Purge the 4 default Medusa demo apparel products for a clean card catalog
  // (best-effort: they are invisible anyway with no seller link).
  const apparelProducts = await productModule.listProducts({
    handle: DEMO_APPAREL_HANDLES,
  });
  if (apparelProducts.length) {
    try {
      await deleteProductsWorkflow(container).run({
        input: { ids: apparelProducts.map((p) => p.id) },
      });
      logger.info(`Purged ${apparelProducts.length} demo apparel product(s).`);
    } catch (error: unknown) {
      logger.warn(
        `Could not purge demo apparel products: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // Seed the 16 cards as house-seller products (guarded by handle). The
  // createProductsWorkflow `productsCreated` hook reads `additional_data.seller_id`
  // and creates the product->seller (+ inventory->seller) links automatically.
  const existingCards = await productModule.listProducts({
    handle: CARD_HANDLES,
  });
  const existingCardHandles = new Set(existingCards.map((p) => p.handle));
  const cardsToCreate = CARD_PRODUCTS.filter(
    (c) => !existingCardHandles.has(c.handle)
  );

  if (cardsToCreate.length === 0) {
    logger.info("Card products already exist, skipping.");
  } else {
    await createProductsWorkflow(container).run({
      input: {
        products: cardsToCreate.map((card) => ({
          title: card.title,
          handle: card.handle,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          thumbnail: card.image,
          images: [{ url: card.image }],
          options: [{ title: "Format", values: ["Slab"] }],
          variants: [
            {
              title: "Slab",
              sku: `CARD-${card.handle.toUpperCase()}`,
              manage_inventory: true,
              options: { Format: "Slab" },
              prices: [{ currency_code: "usd", amount: card.price }],
            },
          ],
          sales_channels: [{ id: defaultSalesChannel[0].id }],
          metadata: {
            fmv: card.fmv,
            points: card.points,
            grade: card.grade,
            grader: card.grader,
            set: card.set,
            rarity: card.rarity,
            year: card.year,
          },
        })),
        additional_data: { seller_id: houseSeller.id },
      },
    });
    logger.info(`Seeded ${cardsToCreate.length} card product(s).`);
  }

  logger.info("Finished seeding marketplace catalog.");

  logger.info("Seeding inventory levels.");

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  const inventoryModule = container.resolve(Modules.INVENTORY);
  const existingLevels = await inventoryModule.listInventoryLevels({
    location_id: stockLocation.id,
  });
  const existingItemIds = new Set(existingLevels.map((l) => l.inventory_item_id));

  const inventoryLevels: CreateInventoryLevelInput[] = [];
  for (const inventoryItem of inventoryItems) {
    if (!existingItemIds.has(inventoryItem.id)) {
      const inventoryLevel = {
        location_id: stockLocation.id,
        stocked_quantity: 1000000,
        inventory_item_id: inventoryItem.id,
      };
      inventoryLevels.push(inventoryLevel);
    }
  }

  if (inventoryLevels.length > 0) {
    await createInventoryLevelsWorkflow(container).run({
      input: {
        inventory_levels: inventoryLevels,
      },
    });
  } else {
    logger.info("Inventory levels already exist, skipping.");
  }

  logger.info("Finished seeding inventory levels data.");
}

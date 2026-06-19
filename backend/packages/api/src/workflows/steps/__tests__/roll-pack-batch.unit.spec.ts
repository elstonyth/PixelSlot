import { MedusaError } from "@medusajs/framework/utils";
import { rollOne } from "../roll-pack";

// Stub shape matching the fields rollOne reads from PacksModuleService.
// We drive rollOne directly (it's exported) — not the step wrapper — so
// no container is needed.

const PACK = { id: "pack_1", slug: "test-pack", status: "active", price: 5 };

const ODDS = [
  { id: "o1", pack_id: "test-pack", card_id: "pikachu", weight: 70, rarity: "common" },
  { id: "o2", pack_id: "test-pack", card_id: "charizard", weight: 30, rarity: "rare" },
];

const CARD_PIKACHU = {
  handle: "pikachu", name: "Pikachu", set: "Base", grader: "PSA", grade: "9",
  market_value: 10, image: "/pikachu.webp", pokemon_dex: 25, sprite_image: "/sprites/25.png",
};

const CARD_CHARIZARD = {
  handle: "charizard", name: "Charizard", set: "Base", grader: "PSA", grade: "10",
  market_value: 500, image: "/charizard.webp", pokemon_dex: 6, sprite_image: "/sprites/6.png",
};

/** Build a minimal PacksModuleService stub with overrideable mocks. */
function buildPacks(overrides?: {
  listPacks?: jest.Mock;
  listPackOdds?: jest.Mock;
  listCards?: jest.Mock;
}) {
  return {
    listPacks: overrides?.listPacks ?? jest.fn().mockResolvedValue([PACK]),
    listPackOdds: overrides?.listPackOdds ?? jest.fn().mockResolvedValue(ODDS),
    listCards: overrides?.listCards ?? jest.fn().mockResolvedValue([CARD_PIKACHU]),
  } as unknown as Parameters<typeof rollOne>[0];
}

describe("rollOne", () => {
  it("returns a RolledCard with pokemon_dex and sprite_image keys", async () => {
    const packs = buildPacks();
    const result = await rollOne(packs, "test-pack");

    expect(result).toMatchObject({
      handle: "pikachu",
      name: "Pikachu",
      rarity: expect.any(String),
      market_value: expect.any(Number),
    });
    // These keys MUST exist (even if null) — batch step relies on them.
    expect("pokemon_dex" in result).toBe(true);
    expect("sprite_image" in result).toBe(true);
  });

  it("sets rarity from the winning odds row (not the card)", async () => {
    // Force Math.random to return 0 → first odds row wins (weight 70 / common).
    const spy = jest.spyOn(Math, "random").mockReturnValue(0);
    try {
      const packs = buildPacks({
        listCards: jest
          .fn()
          .mockImplementation(({ handle }: { handle: string }) =>
            Promise.resolve(handle === "pikachu" ? [CARD_PIKACHU] : [CARD_CHARIZARD])
          ),
      });
      const result = await rollOne(packs, "test-pack");
      expect(result.rarity).toBe("common");
      expect(result.handle).toBe("pikachu");
    } finally {
      spy.mockRestore();
    }
  });

  it("calling rollOne 3× yields 3 independent RolledCard results", async () => {
    // Spy on Math.random to verify each rollOne performs its own independent draw.
    const spy = jest.spyOn(Math, "random");
    try {
      const packs = buildPacks();
      const results = await Promise.all([
        rollOne(packs, "test-pack"),
        rollOne(packs, "test-pack"),
        rollOne(packs, "test-pack"),
      ]);
      expect(results).toHaveLength(3);
      results.forEach((r) => {
        expect(r).toHaveProperty("handle");
        expect(r).toHaveProperty("rarity");
        expect(r).toHaveProperty("pokemon_dex");
        expect(r).toHaveProperty("sprite_image");
      });
      // Each rollOne must call Math.random independently — 3 draws = at least 3 calls.
      expect(spy).toHaveBeenCalledTimes(3);
    } finally {
      spy.mockRestore();
    }
  });

  it("throws NOT_FOUND when the pack is inactive/missing", async () => {
    const packs = buildPacks({ listPacks: jest.fn().mockResolvedValue([]) });
    await expect(rollOne(packs, "ghost-pack")).rejects.toMatchObject({
      type: MedusaError.Types.NOT_FOUND,
    });
  });

  it("throws NOT_FOUND when the pack has no odds rows", async () => {
    const packs = buildPacks({ listPackOdds: jest.fn().mockResolvedValue([]) });
    await expect(rollOne(packs, "test-pack")).rejects.toMatchObject({
      type: MedusaError.Types.NOT_FOUND,
    });
  });
});

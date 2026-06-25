import { MedusaError } from '@medusajs/framework/utils';
import { fetchPackData } from '../roll-pack';

// B2 — reward_box isolation guard.
// fetchPackData must reject any pack whose category === 'reward_box',
// even when the pack is status='active' and has odds configured.
// reward_box packs are internal draw pools — never openable via the normal pack path.

const REWARD_BOX_PACK = {
  id: 'pack_rb',
  slug: 'vip-tier-c-box',
  title: 'VIP Tier C Reward Box',
  category: 'reward_box',
  status: 'active' as const,
  price: 0,
  pool_enabled: true,
  draws_per_day: 3,
};

const ODDS = [
  { id: 'o1', pack_id: 'vip-tier-c-box', card_id: null, weight: 1, rarity: null, kind: 'nothing' },
];

function buildPacks(overrides?: {
  listPacks?: jest.Mock;
  listPackOdds?: jest.Mock;
}) {
  return {
    listPacks: overrides?.listPacks ?? jest.fn().mockResolvedValue([REWARD_BOX_PACK]),
    listPackOdds: overrides?.listPackOdds ?? jest.fn().mockResolvedValue(ODDS),
    listCards: jest.fn().mockResolvedValue([]),
  } as unknown as Parameters<typeof fetchPackData>[0];
}

describe('fetchPackData — reward_box isolation (B2)', () => {
  it('throws NOT_FOUND for a reward_box pack even when status=active', async () => {
    const packs = buildPacks();
    await expect(fetchPackData(packs, 'vip-tier-c-box')).rejects.toMatchObject({
      type: MedusaError.Types.NOT_FOUND,
    });
  });

  it('does NOT call listPackOdds when category=reward_box (fail-fast)', async () => {
    const listPackOdds = jest.fn().mockResolvedValue(ODDS);
    const packs = buildPacks({ listPackOdds });
    await expect(fetchPackData(packs, 'vip-tier-c-box')).rejects.toMatchObject({
      type: MedusaError.Types.NOT_FOUND,
    });
    // Should bail before odds are fetched
    expect(listPackOdds).not.toHaveBeenCalled();
  });

  it('still throws NOT_FOUND for an unknown slug (pre-existing behaviour)', async () => {
    const packs = buildPacks({ listPacks: jest.fn().mockResolvedValue([]) });
    await expect(fetchPackData(packs, 'ghost-pack')).rejects.toMatchObject({
      type: MedusaError.Types.NOT_FOUND,
    });
  });

  it('normal pokemon pack passes through unaffected', async () => {
    const normalPack = { ...REWARD_BOX_PACK, slug: 'normal-pack', category: 'pokemon' };
    const packs = buildPacks({
      listPacks: jest.fn().mockResolvedValue([normalPack]),
      listPackOdds: jest.fn().mockResolvedValue([
        { id: 'o1', pack_id: 'normal-pack', card_id: 'pikachu', weight: 1, rarity: 'common', kind: null },
      ]),
    });
    // Should not throw — returns pack data
    const data = await fetchPackData(packs, 'normal-pack');
    expect(data.pack.slug).toBe('normal-pack');
  });
});

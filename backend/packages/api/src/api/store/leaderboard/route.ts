import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";
import PacksModuleService from "../../../modules/packs/service";
import { PACKS_MODULE } from "../../../modules/packs";
import { HANDLE_RE, seedOf } from "../../../utils/profile-handle";

// GET /store/leaderboard?period=weekly|alltime — public leaderboard aggregated
// from the Pull ledger. A plain publishable-key store route (read-only, no
// workflow).
//
// 🔒 PII: this is PUBLIC, so it NEVER exposes a customer's email or raw id. Each
// entry carries only a display name (first_name, else an anonymous "Collector
// ####" handle) and a stable `seed` integer the storefront hashes into an avatar.
//
// Ranking is by points = Σ(pack price × 100) over the customer's pulls (the same
// points awarded on open). `volume` = Σ won-card market value; `pulls` = count.
const TOP_N = 10;
const WEEKLY_MS = 7 * 24 * 60 * 60 * 1000;

// Avatar seed = the shared `seedOf` (utils/profile-handle) so the leaderboard
// and the public profile page render the SAME avatar for the same customer.

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const packs: PacksModuleService = req.scope.resolve(PACKS_MODULE);
  const customerService = req.scope.resolve(Modules.CUSTOMER);

  const period = req.query.period === "alltime" ? "alltime" : "weekly";
  const filter =
    period === "weekly"
      ? { rolled_at: { $gte: new Date(Date.now() - WEEKLY_MS) } }
      : {};

  const pulls = await packs.listPulls(filter, { take: 20000 });
  if (pulls.length === 0) {
    res.json({ period, entries: [] });
    return;
  }

  // Lookup tables: card market value (by handle), pack price (by slug).
  const handles = [...new Set(pulls.map((p) => p.card_id))];
  const cards = handles.length
    ? await packs.listCards({ handle: handles }, { take: handles.length })
    : [];
  const mvByHandle = new Map(
    cards.map((c) => [c.handle, Number(c.market_value)]),
  );

  const packIds = [...new Set(pulls.map((p) => p.pack_id))];
  const packRows = packIds.length
    ? await packs.listPacks({ slug: packIds }, { take: packIds.length })
    : [];
  const priceBySlug = new Map(packRows.map((p) => [p.slug, p.price]));

  // Aggregate per customer (skip anonymous/null pulls).
  type Agg = { pulls: number; volume: number; points: number };
  const byCustomer = new Map<string, Agg>();
  for (const p of pulls) {
    if (!p.customer_id) continue;
    const a = byCustomer.get(p.customer_id) ?? {
      pulls: 0,
      volume: 0,
      points: 0,
    };
    a.pulls += 1;
    a.volume += mvByHandle.get(p.card_id) ?? 0;
    a.points += (priceBySlug.get(p.pack_id) ?? 0) * 100;
    byCustomer.set(p.customer_id, a);
  }

  const ranked = [...byCustomer.entries()]
    .sort((a, b) => b[1].points - a[1].points)
    .slice(0, TOP_N);

  // Names for the ranked customers only — first_name ONLY (never email).
  // The public profile handle (customer metadata.handle, PII-safe by design)
  // rides along so the storefront can link each row to /profile/<handle>.
  // Customers that predate handle assignment return null — NO mutation here
  // (handles are assigned by the ensure-profile-handle workflow, not a GET).
  const ids = ranked.map(([id]) => id);
  const customers = ids.length
    ? await customerService.listCustomers({ id: ids }, { take: ids.length })
    : [];
  const firstNameById = new Map(
    customers.map((c) => [c.id, (c.first_name || "").trim()]),
  );
  const handleById = new Map(
    customers.map((c) => {
      const handle = (c.metadata ?? {})["handle"];
      return [
        c.id,
        typeof handle === "string" && HANDLE_RE.test(handle) ? handle : null,
      ];
    }),
  );

  const entries = ranked.map(([id, a], i) => {
    const first = firstNameById.get(id);
    const seed = seedOf(id);
    return {
      rank: i + 1,
      name:
        first && first.length > 0
          ? first
          : `Collector ${String(seed).slice(0, 4)}`,
      handle: handleById.get(id) ?? null,
      volume: Math.round(a.volume * 100) / 100,
      pulls: a.pulls,
      points: a.points,
      seed,
    };
  });

  res.json({ period, entries });
}

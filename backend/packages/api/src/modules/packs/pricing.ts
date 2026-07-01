export const DEFAULT_USD_MYR = 4.7;
export const FX_USD_MYR_URL = process.env.FX_USD_MYR_URL ?? "https://api.frankfurter.app/latest?from=USD&to=MYR";

export function displayMarketPrice(marketValueUsd: number, fxUsdMyr: number, multiplier: number): number {
  const raw = Number(marketValueUsd), fx = Number(fxUsdMyr), mult = Number(multiplier);
  if (![raw, fx, mult].every(Number.isFinite) || raw < 0 || fx <= 0 || mult <= 0) return 0;
  return Math.round(raw * fx * mult * 100) / 100;
}

export function effectiveRate(row: { rate: number; manual_override: boolean; manual_rate: number | null } | null): number {
  if (!row) return DEFAULT_USD_MYR;
  if (row.manual_override) {
    const m = Number(row.manual_rate);
    if (Number.isFinite(m) && m > 0) return m;
  }
  const r = Number(row.rate);
  return Number.isFinite(r) && r > 0 ? r : DEFAULT_USD_MYR;
}

// Resolve the current effective USD->MYR rate for a request — the single seam
// store/admin routes call so they never touch FxRate rows or effectiveRate's
// fallback logic directly. Row fields (rate/manual_rate) are bigNumber and can
// come back as strings/objects; effectiveRate already does Number(...) with a
// finite/>0 guard, so no extra normalization is needed here (verified against
// the identical raw-row usage in admin/pricing/fx/route.ts).
export async function resolveFxRate(packs: {
  listFxRates: (f: unknown, c: unknown) => Promise<Array<{ rate: number; manual_override: boolean; manual_rate: number | null }>>;
}): Promise<number> {
  const [row] = await packs.listFxRates({ pair: "USD_MYR" }, { take: 1 });
  return effectiveRate(row ?? null);
}

export async function fetchUsdMyr(url: string = FX_USD_MYR_URL): Promise<number> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const data = (await resp.json()) as { rates?: { MYR?: number } };
  const rate = data?.rates?.MYR;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) throw new Error("FX feed: no usable USD->MYR");
  return rate;
}

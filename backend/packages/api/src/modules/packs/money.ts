// The single coercion from a stored money value (Medusa numeric column →
// BigNumber | numeric string | number) to a JSON-safe JS number. The param is
// `unknown` because a DB money value genuinely arrives untyped; the body is
// exactly `Number(value)`, so this is a behavior-preserving, centralized
// replacement for the ~15 inline `Number(card.market_value)` / `Number(pack.price)`
// call sites. USD decimals, never cents.
export function toMoney(value: unknown): number {
  return Number(value);
}

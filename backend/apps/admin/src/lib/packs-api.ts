import { client } from "./client";
import type { ComputedOdd, OddsInput } from "./odds-math";

// Typed facade for the custom gacha admin routes.
//
// The shared `client` is a generic path-proxy from @mercurjs/client: a property
// chain becomes a URL and the leaf action picks the verb (`query` -> GET,
// `mutate` -> POST), with `$seg` keys substituted into the path. That works at
// RUNTIME for any route — but the compile-time `Routes` type (from
// @acme/api/_generated) is codegen'd from framework routes and does NOT include
// our custom /admin/packs endpoints. So we narrow `client` to a hand-written
// facade describing exactly those endpoints. (Cookie auth via credentials:
// 'include' in client.ts covers the auto-protected /admin/* routes.)

export interface AdminPack {
  slug: string;
  title: string;
  category: string;
  status: "active" | "draft";
  rank: number;
  price: number;
  image: string;
  boost: boolean;
}

// Create/update payload. `slug` is sent on create only (immutable thereafter —
// on update it travels as the `$slug` path param, not the body).
export interface AdminPackWrite {
  slug?: string;
  title: string;
  category: string;
  price: number;
  image: string;
  boost: boolean;
  rank: number;
  status: "active" | "draft";
}

export interface AdminCard {
  handle: string;
  name: string;
  set: string;
  grader: string;
  grade: string;
  rarity: string;
  market_value: number;
  image: string;
  /** Stored sale price; `null` means "use FMV (market_value)". */
  price: number | null;
  for_sale: boolean;
}

// Create/update payload. `handle` is sent on create only (immutable thereafter —
// on update it travels as the `$handle` path param, not the body).
export interface AdminCardWrite {
  handle?: string;
  name: string;
  set: string;
  grader: string;
  grade: string;
  rarity: string;
  market_value: number;
  image: string;
  price?: number;
  for_sale: boolean;
}

export interface OddsRow {
  card_id: string;
  name: string;
  image: string;
  rarity: string;
  market_value: number;
  weight: number;
  locked: boolean;
  /** Current win % = weight / Σweight × 100. */
  pct: number;
}

export interface PackOddsResponse {
  pack: { slug: string; title: string; category: string; status: string };
  odds: OddsRow[];
}

export interface PullRow {
  id: string;
  rolled_at: string;
  customer_id: string | null;
  customer_email: string | null;
  pack_id: string;
  card: {
    handle: string;
    name: string;
    rarity: string;
    market_value: number;
    image: string;
  } | null;
}

export interface TopCard {
  handle: string;
  name: string;
  rarity: string | null;
  market_value: number | null;
  image: string | null;
  count: number;
}

export interface TopRarity {
  rarity: string;
  count: number;
}

export interface PullsResponse {
  total: number;
  pulls: PullRow[];
  topCards: TopCard[];
  topRarities: TopRarity[];
}

type PacksApi = {
  admin: {
    packs: {
      query: () => Promise<{ packs: AdminPack[] }>;
      mutate: (input: AdminPackWrite) => Promise<{ pack: { slug: string } }>;
      $slug: {
        query: (input: { $slug: string }) => Promise<{ pack: AdminPack }>;
        mutate: (
          input: { $slug: string } & AdminPackWrite
        ) => Promise<{ pack: { slug: string } }>;
        odds: {
          query: (input: { $slug: string }) => Promise<PackOddsResponse>;
          mutate: (input: {
            $slug: string;
            entries: OddsInput[];
          }) => Promise<{ odds: ComputedOdd[] }>;
        };
        members: {
          query: (input: { $slug: string }) => Promise<{ members: string[] }>;
          mutate: (input: {
            $slug: string;
            card_ids: string[];
          }) => Promise<{
            pack_id: string;
            members: string[];
            added: number;
            removed: number;
          }>;
        };
      };
    };
    pulls: {
      query: () => Promise<PullsResponse>;
    };
    cards: {
      query: () => Promise<{ cards: AdminCard[] }>;
      mutate: (input: AdminCardWrite) => Promise<{
        card: { handle: string; productId: string };
      }>;
      $handle: {
        query: (input: { $handle: string }) => Promise<{ card: AdminCard }>;
        mutate: (
          input: { $handle: string } & AdminCardWrite
        ) => Promise<{ card: { handle: string; productId: string } }>;
      };
    };
  };
};

export const packsApi = client as unknown as PacksApi;

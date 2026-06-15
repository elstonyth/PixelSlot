// Thin backend client for the parts of the flow we drive directly (auth, credits,
// odds, opens). The storefront's "Open Pack" button is just a server action over
// POST /store/packs/{slug}/open, so opening via this client exercises the exact
// same code path the UI does — just without the slow reveal animation.
import { BACKEND, PK, ADMIN_EMAIL, ADMIN_PASSWORD, stamp } from './constants';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

// Auth and pack-open endpoints are rate-limited (429 + "Try again in Ns"). Honor
// the hint and retry so a multi-customer / multi-open suite paces itself.
export async function api<T>(
  path: string,
  opts: { method?: Method; body?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-publishable-api-key': PK,
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${BACKEND}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    if (res.ok) return (await res.json()) as T;
    const text = await res.text();
    if (res.status === 429 && attempt < 5) {
      const secs = Number(text.match(/again in (\d+)s/)?.[1] ?? '8');
      await sleep((secs + 1) * 1000);
      continue;
    }
    throw new Error(`${opts.method ?? 'GET'} ${path} -> ${res.status} ${text}`);
  }
  throw new Error(`${opts.method ?? 'GET'} ${path} -> still rate-limited`);
}

export async function adminToken(): Promise<string> {
  const r = await api<{ token: string }>('/auth/user/emailpass', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  return r.token;
}

export interface CustomerCreds {
  email: string;
  password: string;
  token: string;
}

// Register → create customer (Bearer register token) → login, mirroring
// src/lib/actions/auth.ts. Optionally top the customer up so they can open packs.
export async function createCustomer(fundUsd = 0): Promise<CustomerCreds> {
  const email = `pw-e2e-${stamp()}@pokenic.local`;
  const password = 'PwE2e2026!';
  const reg = await api<{ token: string }>(
    '/auth/customer/emailpass/register',
    { method: 'POST', body: { email, password } },
  );
  await api('/store/customers', {
    method: 'POST',
    token: reg.token,
    body: { email, first_name: 'PW' },
  });
  const login = await api<{ token: string }>('/auth/customer/emailpass', {
    method: 'POST',
    body: { email, password },
  });
  const creds: CustomerCreds = { email, password, token: login.token };
  if (fundUsd > 0) await topup(creds.token, fundUsd);
  return creds;
}

export async function topup(token: string, amount: number): Promise<number> {
  const r = await api<{ balance: number }>('/store/credits/topup', {
    method: 'POST',
    token,
    body: { amount },
  });
  return r.balance;
}

export interface OpenResult {
  card: { handle: string; name: string; rarity: string; market_value: number };
  balance: number;
  price: number;
}

// Open is rate-limited; api() already retries on 429.
export const openPack = (token: string, slug: string): Promise<OpenResult> =>
  api<OpenResult>(`/store/packs/${slug}/open`, {
    method: 'POST',
    token,
    body: {},
  });

export interface OddsRow {
  card_id: string;
  name: string;
  rarity: string;
  market_value: number;
  stock: number | null;
  pct: number;
  locked: boolean;
}

export interface OddsState {
  pack: { title: string; status: string };
  odds: OddsRow[];
}

export const getOdds = (token: string, slug: string): Promise<OddsState> =>
  api<OddsState>(`/admin/packs/${slug}/odds`, { token });

type OddsEntry = Pick<OddsRow, 'card_id' | 'locked' | 'pct' | 'rarity'>;

export const setOdds = (
  token: string,
  slug: string,
  entries: OddsEntry[],
): Promise<OddsState> =>
  api<OddsState>(`/admin/packs/${slug}/odds`, {
    method: 'POST',
    token,
    body: { entries },
  });

export const setMembers = (
  token: string,
  slug: string,
  cardIds: string[],
): Promise<unknown> =>
  api(`/admin/packs/${slug}/members`, {
    method: 'POST',
    token,
    body: { card_ids: cardIds },
  });

export interface EligibleProduct {
  id: string;
  title: string;
  handle: string;
}

export const eligibleProducts = (
  token: string,
): Promise<{ products: EligibleProduct[] }> =>
  api<{ products: EligibleProduct[] }>('/admin/gacha/eligible-products', {
    token,
  });

export interface AdminCard {
  handle: string;
  name: string;
  market_value: number;
  for_sale: boolean;
}

export const listCards = (token: string): Promise<{ cards: AdminCard[] }> =>
  api<{ cards: AdminCard[] }>('/admin/cards', { token });

export async function deleteCardIfExists(
  token: string,
  handle: string,
): Promise<void> {
  try {
    await api(`/admin/cards/${handle}`, { method: 'DELETE', token });
  } catch {
    /* 404 = already gone */
  }
}

// Snapshot the current odds as a restorable entry list.
export const snapshotOdds = (odds: OddsRow[]): OddsEntry[] =>
  odds.map((o) => ({
    card_id: o.card_id,
    locked: o.locked,
    pct: o.pct,
    rarity: o.rarity,
  }));

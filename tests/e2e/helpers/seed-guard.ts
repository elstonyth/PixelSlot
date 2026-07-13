// Fail-fast seed preflight. Many specs hardcode the seed pack slugs
// (pokemon-rookie / pokemon-elite); against a drifted shared dev DB those slugs
// can be missing, and a spec then fails opaquely deep in a flow (this bit us in
// plan 023). Assert their presence once, up front, with a message that names
// the fix — so a missing seed reads as "reseed the DB", not a mystery timeout.
import { BACKEND, PK } from './constants';

// Keep in sync with the slugs the specs open (see PACK constants in the specs).
const REQUIRED_PACK_SLUGS = ['pokemon-rookie', 'pokemon-elite'];

const RESEED_HINT =
  'reseed with `corepack yarn seed` from backend/packages/api';

export async function assertSeedPacks(): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND}/store/packs`, {
      headers: { 'x-publishable-api-key': PK },
    });
  } catch (err) {
    throw new Error(
      `Seed preflight: GET ${BACKEND}/store/packs failed to connect — is the backend up? (${err})`,
    );
  }
  if (!res.ok) {
    throw new Error(
      `Seed preflight: GET /store/packs -> ${res.status}. Backend up at ${BACKEND}? ${RESEED_HINT}.`,
    );
  }
  const { packs } = (await res.json()) as { packs: Array<{ slug: string }> };
  const present = new Set(packs.map((p) => p.slug));
  const missing = REQUIRED_PACK_SLUGS.filter((slug) => !present.has(slug));
  if (missing.length) {
    throw new Error(
      `Seed preflight: required pack(s) missing: ${missing.join(', ')}. ` +
        `The E2E specs hardcode these slugs — ${RESEED_HINT}.`,
    );
  }
}

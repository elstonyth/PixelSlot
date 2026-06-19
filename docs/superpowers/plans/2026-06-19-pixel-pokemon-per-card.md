# Pixel Pokémon per card (1:1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin assign exactly one pixel-art Pokémon (a national-dex number and/or a custom uploaded sprite) to each gacha card, and show that Pokémon on the immersive slot reel — without touching the per-card win-rate or the weighted draw.

**Architecture:** Two new nullable columns on the `Card` model (`pokemon_dex`, `sprite_image`). A single canonical resolution rule — *explicit fields win, name-derivation is the fallback* — implemented as a pure helper in two workspaces (backend `@acme/pokemon` for the admin, storefront `src/lib`). The won-card payload (`roll-pack`'s `RolledCard` → `/store/packs/:slug/open` → `openPack` → `WonCard`) carries the two fields to the reel; `SlotMachineClient` switches its winner-build from name-only to the rule. Admin gets a dex picker + a custom-sprite upload (new `sprite` media profile) on both the create modal and the inline edit modal.

**Tech Stack:** Next.js 16 / React 19 storefront (Vitest + Playwright); Medusa v2 / Mercur backend (`@acme/api`) + Vite admin (`@acme/admin`, Vitest); workspace packages under `backend/packages/*` (Jest + `@swc/jest`); zod runtime guards; `@medusajs/ui` admin primitives.

## Global Constraints

- **Scope is the slot reel ONLY.** The reel (`/slots`) is the only surface switched to the resolution rule. Vault, public profiles, `/claw`, and leaderboard render card art and are intentionally **out of scope** (decision 2026-06-19). Backend exposure is limited to the won-card path; do **not** edit `toCardView`, `pulls/recent`, or `profiles/[handle]`.
- **Win-rate + draw are UNTOUCHED.** Do not edit `@acme/odds-math`, `PackOdds`, the odds editor, the `roll-pack` weighted pick (the `Math.random` loop), or the reel components themselves (`SlotReelStack`/`SlotReelColumn`/`PokemonToken`). The two new fields are read off the card row *after* the winner is chosen.
- **Dex convention:** national-dex, 1-based. `POKEDEX_NAMES[dex - 1]` is the name; `dex = index + 1`. Valid range is `[1, POKEDEX_NAMES.length]` (currently 1025). **Never hardcode 1025** — derive the bound from `POKEDEX_NAMES.length`.
- **No backfill.** Existing cards have `pokemon_dex = null` / `sprite_image = null` and must keep resolving via `pokemonFromCard(name)` exactly as today.
- **`@acme/pokemon` is source-based and admin-only.** `main`/`types`/`exports` → `./src/index.ts`, `noEmit`, NO `dist`, NO `build` script. Do **not** add it to `apps/admin/vite.config.ts` (`optimizeDeps.include` / `commonjsOptions.include`) — that CJS wiring exists only for the dist-based `@acme/odds-math`. Do **not** add it to `packages/api` (the backend does pure passthrough, no server-side resolution).
- **Tooling is NOT on PATH.** Run via explicit node paths from the app dir: `node ../../node_modules/typescript/bin/tsc ...`, `node ../../node_modules/vite/bin/vite.js build`. `medusa` works via `corepack yarn medusa <cmd>` from `backend/packages/api`. Yarn workspace commands run from `backend/` (not the worktree root).
- **Worktree:** all paths below are relative to the repo root, which for this work is `C:\Users\PC\Desktop\Projects\Pokenic_Game\.claude\worktrees\feat+pixel-pokemon-per-card` (branch `worktree-feat+pixel-pokemon-per-card`, baselined on master `6aa4cca`).
- **Quality gate:** a PostToolUse hook type-checks after every `.ts`/`.tsx` edit and a Stop hook type-checks storefront + backend and blocks finishing on real type errors. Keep both green.

### Canonical resolution rule (the single source of truth — both copies implement this verbatim)

```
resolveCardPokemon(card: { name; pokemon_dex?; sprite_image? }) -> { dex, name, sprite }

  MAX_DEX  = POKEDEX_NAMES.length                       // 1025; derive, never hardcode
  validDex = Number.isInteger(d) && d >= 1 && d <= MAX_DEX

  explicit = validDex(card.pokemon_dex) ? card.pokemon_dex : null   // out-of-range => treat as unset
  fallback = explicit === null ? pokemonFromCard(card.name) : null
  dex      = explicit ?? fallback?.dex ?? null
  name     = explicit !== null ? POKEDEX_NAMES[explicit - 1]
                               : (fallback?.name ?? null)
  custom   = (card.sprite_image && card.sprite_image.trim() !== '') ? card.sprite_image : null
  sprite   = custom ?? (dex !== null ? spriteGif(dex) : null)
  return { dex, name, sprite }
```

**Reel adaptation (the one intentional divergence):** the reel never shows card art (spoiler guard). When mapping to `ColumnWinner`, the terminal fallback is the Poké Ball, not card art:
```
const r = resolveCardPokemon(card)
const custom = (card.sprite_image && card.sprite_image.trim() !== '') ? card.sprite_image : null
columnWinner = {
  dex:   r.dex,
  image: custom ?? (r.dex === null ? POKEBALL_PLACEHOLDER : undefined),  // undefined => column draws spriteGif(dex)
  name:  r.name ?? card.name,
  tier,
}
```
This is a strict superset of today's behavior: name-resolvable cards still get `dex` → `image:undefined` (column draws the gif); trainer/energy cards (`dex===null`, no custom) still get the Poké Ball; explicit dex and custom sprite are the new wins.

---

## Task 0: Commit the in-flight spec wording fix

**Files:**
- Modify: `docs/superpowers/specs/2026-06-19-pixel-pokemon-per-card-design.md` (already has one uncommitted 1-line wording fix in the worktree)
- Create: `docs/superpowers/plans/2026-06-19-pixel-pokemon-per-card.md` (this file)

- [ ] **Step 1: Stage the spec + this plan and commit**

```bash
git -C "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card" add docs/superpowers/specs/2026-06-19-pixel-pokemon-per-card-design.md docs/superpowers/plans/2026-06-19-pixel-pokemon-per-card.md
git -C "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card" commit -m "docs: pixel-pokemon-per-card spec wording fix + implementation plan"
```

Expected: a commit containing the spec edit + the new plan. (Git hooks may rebuild the graph; that is fine.)

---

## Task 1: Recreate the `@acme/pokemon` shared package (source-based, admin-only)

**Files:**
- Create: `backend/packages/pokemon/package.json`
- Create: `backend/packages/pokemon/tsconfig.json`
- Create: `backend/packages/pokemon/jest.config.js`
- Create: `backend/packages/pokemon/src/pokedex-names.ts` (verbatim copy)
- Create: `backend/packages/pokemon/src/pokedex.ts` (verbatim copy)
- Create: `backend/packages/pokemon/src/pokemon-from-card.ts` (verbatim copy, one import path fixed)
- Create: `backend/packages/pokemon/src/index.ts`
- Test: `backend/packages/pokemon/src/__tests__/pokemon.unit.spec.ts`
- Modify: `backend/apps/admin/package.json` (add the workspace dep)

**Interfaces:**
- Produces (re-exported from `@acme/pokemon`):
  - `type CardPokemon = { dex: number; name: string }`
  - `function pokemonFromCard(cardName: string): CardPokemon | null`
  - `const POKEDEX_NAMES: string[]` (1025 entries, dex = index + 1)
  - `const spriteGif: (dex: number) => string`
  - `const spritePng: (dex: number) => string`

- [ ] **Step 1: Copy the three source files verbatim from the storefront into the package `src/`**

```bash
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card"
mkdir -p backend/packages/pokemon/src/__tests__
cp src/lib/mock/pokedex-names.ts backend/packages/pokemon/src/pokedex-names.ts
cp src/lib/mock/pokedex.ts        backend/packages/pokemon/src/pokedex.ts
cp src/lib/pokemon-from-card.ts   backend/packages/pokemon/src/pokemon-from-card.ts
```

(`pokedex.ts` imports `'./pokedex-names'` and is now colocated with it — no edit needed. `pokedex-names.ts` has no imports.)

- [ ] **Step 2: Fix the one relative import in the copied `pokemon-from-card.ts`**

In `backend/packages/pokemon/src/pokemon-from-card.ts`, change line 2 from:
```ts
import { POKEDEX_NAMES } from './mock/pokedex-names';
```
to:
```ts
import { POKEDEX_NAMES } from './pokedex-names';
```

- [ ] **Step 3: Create the package entrypoint `backend/packages/pokemon/src/index.ts`**

```ts
// @acme/pokemon — pixel-Pokémon resolution data shared by the admin dashboard.
// SOURCE-BASED (no dist/build): main/types -> ./src/index.ts. Admin-only consumer.
//
// NOTE: the storefront keeps its OWN copies of these files (separate workspace —
// src/lib/pokemon-from-card.ts, src/lib/mock/pokedex.ts, src/lib/mock/pokedex-names.ts).
// This is intentional dex-data duplication; keep the two in sync when editing.
export type { CardPokemon } from './pokemon-from-card';
export { pokemonFromCard } from './pokemon-from-card';
export { POKEDEX_NAMES } from './pokedex-names';
export { spriteGif, spritePng } from './pokedex';
```

- [ ] **Step 4: Create `backend/packages/pokemon/package.json` (DIVERGES from odds-math: source-based, noEmit, no dist/build)**

```json
{
  "name": "@acme/pokemon",
  "version": "2.1.6",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "check-types": "tsc -p tsconfig.json --noEmit",
    "test": "jest"
  },
  "devDependencies": {
    "@swc/core": "^1.7.28",
    "@swc/jest": "^0.2.36",
    "@types/jest": "^29.5.13",
    "jest": "^29.7.0",
    "typescript": "5.9.3"
  }
}
```

- [ ] **Step 5: Create `backend/packages/pokemon/tsconfig.json` (noEmit, no declaration/outDir)**

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "noEmit": true,
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "src/__tests__"]
}
```

- [ ] **Step 6: Create `backend/packages/pokemon/jest.config.js` (verbatim mirror of odds-math)**

```js
module.exports = {
  transform: {
    '^.+\\.[jt]s$': [
      '@swc/jest',
      { jsc: { parser: { syntax: 'typescript' } } },
    ],
  },
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'ts', 'json'],
  testMatch: ['**/src/**/__tests__/**/*.unit.spec.[jt]s'],
};
```

- [ ] **Step 7: Write the failing unit test `backend/packages/pokemon/src/__tests__/pokemon.unit.spec.ts`**

(Note the `.unit.spec.ts` suffix — the jest `testMatch` requires it. This mirrors the storefront's `src/lib/__tests__/pokemon-from-card.test.ts` cases.)

```ts
import {
  pokemonFromCard,
  POKEDEX_NAMES,
  spriteGif,
  spritePng,
} from '../index';

describe('@acme/pokemon', () => {
  describe('POKEDEX_NAMES', () => {
    it('is 1-based national dex (Bulbasaur = dex 1)', () => {
      expect(POKEDEX_NAMES[0]).toBe('Bulbasaur');
      expect(POKEDEX_NAMES.length).toBeGreaterThanOrEqual(1025);
    });
  });

  describe('pokemonFromCard', () => {
    it('matches a full species name in the card name', () => {
      expect(pokemonFromCard('Charizard VMAX')).toEqual({
        dex: 6,
        name: 'Charizard',
      });
    });

    it('prefers the longest match (Mewtwo over Mew)', () => {
      expect(pokemonFromCard('Mewtwo GX')?.name).toBe('Mewtwo');
    });

    it('returns null when no species is present', () => {
      expect(pokemonFromCard("Professor's Research")).toBeNull();
    });
  });

  describe('sprite URL helpers', () => {
    it('spriteGif points at the PokeAPI showdown gif for the dex', () => {
      expect(spriteGif(6)).toBe(
        'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/6.gif',
      );
    });
    it('spritePng points at the PokeAPI static png for the dex', () => {
      expect(spritePng(6)).toBe(
        'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/6.png',
      );
    });
  });
});
```

- [ ] **Step 8: Add the workspace dependency to the admin app**

In `backend/apps/admin/package.json`, add `@acme/pokemon` to `dependencies` (alongside `@acme/odds-math`):

```json
  "dependencies": {
    "@acme/api": "workspace:*",
    "@acme/odds-math": "workspace:*",
    "@acme/pokemon": "workspace:*",
    "@mercurjs/admin": "2.1.6"
  },
```

- [ ] **Step 9: Install so yarn links the new workspace package**

```bash
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card/backend"
corepack yarn install
```

Expected: install succeeds; `backend/apps/admin/node_modules/@acme/pokemon` is a symlink to `backend/packages/pokemon`. (No glob edit needed — `backend/package.json` already has `workspaces: ['packages/*','apps/*']`.)

- [ ] **Step 10: Run the package test + type-check (RED→GREEN)**

```bash
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card/backend"
corepack yarn workspace @acme/pokemon test
corepack yarn workspace @acme/pokemon check-types
```

Expected: all tests PASS; `check-types` reports no errors.

- [ ] **Step 11: Commit**

```bash
git -C "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card" add backend/packages/pokemon backend/apps/admin/package.json backend/yarn.lock
git -C "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card" commit -m "feat(pokemon): recreate source-based @acme/pokemon package (admin-only)"
```

---

## Task 2: Add `pokemon_dex` + `sprite_image` to the `Card` model (+ migration)

**Files:**
- Modify: `backend/packages/api/src/modules/packs/models/card.ts`
- Generated: `backend/packages/api/src/modules/packs/migrations/Migration<timestamp>.ts` + `.snapshot-packs.json` (created by `db:generate`)

**Interfaces:**
- Produces: `Card.pokemon_dex: number | null`, `Card.sprite_image: string | null` (auto-CRUD via `listCards`/`createCards`/`updateCards` — no `service.ts` edit).

- [ ] **Step 1: Add the two nullable columns to the model**

In `backend/packages/api/src/modules/packs/models/card.ts`, inside the `model.define("card", { ... })` object, after `for_sale: model.boolean().default(true),` add:

```ts
  // Pixel-Pokémon avatar (1:1 per card). national-dex number, 1-based. Nullable:
  // existing cards resolve via name-derivation (pokemonFromCard) until an admin
  // assigns one. model.number() (NOT bigNumber) — an integer dex, distinct from
  // the bigNumber money columns above.
  pokemon_dex: model.number().nullable(),
  // Optional custom uploaded pixel sprite URL; overrides the dex default gif.
  sprite_image: model.text().nullable(),
```

- [ ] **Step 2: Generate the additive migration**

```bash
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card/backend/packages/api"
corepack yarn medusa db:generate packs
```

Expected: a new `src/modules/packs/migrations/Migration<timestamp>.ts` whose `up()` is `ALTER TABLE "card" ADD COLUMN ...` for `pokemon_dex` (nullable integer) and `sprite_image` (nullable text), and an updated `.snapshot-packs.json`. **Inspect the generated file** — it must be purely additive (ADD COLUMN, no drops/renames). If it contains anything else, stop and investigate.

- [ ] **Step 3: Apply the migration**

```bash
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card/backend/packages/api"
corepack yarn medusa db:migrate
```

Expected: migration applies cleanly against `pokenic-postgres`.

- [ ] **Step 4: Type-check the backend**

```bash
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card/backend/packages/api"
node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card" add backend/packages/api/src/modules/packs/models/card.ts backend/packages/api/src/modules/packs/migrations
git -C "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card" commit -m "feat(packs): add nullable pokemon_dex + sprite_image to Card model (additive migration)"
```

---

## Task 3: Expose the two fields on the won-card payload (`roll-pack` → open route)

**Files:**
- Modify: `backend/packages/api/src/workflows/steps/roll-pack.ts` (type lines 18-27 + object literal lines 89-98)
- Test (optional, services-gated): `backend/packages/api/integration-tests/http/customer-gacha.spec.ts`

**Interfaces:**
- Consumes: `Card.pokemon_dex`, `Card.sprite_image` (from Task 2; `listCards` returns them).
- Produces: `RolledCard` gains `pokemon_dex: number | null` and `sprite_image: string | null`. `/store/packs/:slug/open` spreads `result.card`, so the open response carries them with no route edit.

- [ ] **Step 1: Add the two fields to the `RolledCard` type**

In `backend/packages/api/src/workflows/steps/roll-pack.ts`, extend the `RolledCard` type:

```ts
export type RolledCard = {
  handle: string;
  name: string;
  set: string;
  grader: string;
  grade: string;
  rarity: string;
  market_value: number;
  image: string;
  pokemon_dex: number | null;
  sprite_image: string | null;
};
```

- [ ] **Step 2: Populate them in the `rolled` object literal (read off the already-chosen `card` row)**

In the same file, in the `const rolled: RolledCard = { ... }` literal, after `image: card.image,` add:

```ts
      pokemon_dex: card.pokemon_dex ?? null,
      sprite_image: card.sprite_image ?? null,
```

These are read from the winning card row **after** the weighted `Math.random` pick — the draw is unchanged.

- [ ] **Step 3: Type-check the backend**

```bash
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card/backend/packages/api"
node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 4 (optional, services-gated): add a regression assertion to the gacha integration test**

If `backend/packages/api/integration-tests/http/customer-gacha.spec.ts` exists and you can run the integration harness (DB + Redis up), add — next to the existing open-response assertions — assertions that the two keys are present and that the existing draw assertions are unchanged:

```ts
    // pixel-pokemon: the open payload carries the avatar fields (present-or-null).
    expect(openBody.card).toHaveProperty('pokemon_dex');
    expect(openBody.card).toHaveProperty('sprite_image');
```

Run (only if services are up):
```bash
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card/backend/packages/api"
corepack yarn test:integration:http
```

If the integration harness is unavailable, rely on the type-check + the determinism argument above (the fields are read after the pick). State which path was taken in the task report.

- [ ] **Step 5: Commit**

```bash
git -C "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card" add backend/packages/api/src/workflows/steps/roll-pack.ts backend/packages/api/integration-tests
git -C "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card" commit -m "feat(packs): carry pokemon_dex + sprite_image on the won-card payload"
```

---

## Task 4: Admin card DTO + validators + persistence carry the two fields

**Files:**
- Modify: `backend/packages/api/src/modules/packs/admin-card.ts` (`AdminCardLike` + `toAdminCardDto`)
- Modify: `backend/packages/api/src/workflows/steps/create-card.ts` (`RegisterCardInput` + `createCards`)
- Modify: `backend/packages/api/src/workflows/steps/update-card.ts` (`UpdateCardInput` + `CardSnapshot` + `updateCards` + compensation)
- Modify: `backend/packages/api/src/api/admin/cards/validate.ts` (coerce both bodies)
- Test: `backend/packages/api/src/api/admin/cards/__tests__/validate.unit.spec.ts` (create if absent)

**Interfaces:**
- Consumes: `Card.pokemon_dex`, `Card.sprite_image`.
- Produces:
  - `RegisterCardInput` + `UpdateCardInput` gain `pokemon_dex: number | null` and `sprite_image: string | null`.
  - `toAdminCardDto(card)` returns the two fields (read path → edit pre-fill).
  - `coerceRegisterCardBody` / `coerceUpdateCardBody` validate `pokemon_dex` ∈ `[1,1025]` (or null) and `sprite_image` (http(s)/relative URL or null).

- [ ] **Step 1: Write failing unit tests for the validators**

Create `backend/packages/api/src/api/admin/cards/__tests__/validate.unit.spec.ts`:

```ts
import { coerceRegisterCardBody, coerceUpdateCardBody } from '../validate';

describe('coerceRegisterCardBody — pixel-pokemon fields', () => {
  const base = { product_id: 'prod_1', set: 'Base', grader: 'PSA', grade: '10', market_value: 100 };

  it('accepts a valid in-range dex and a sprite URL', () => {
    const out = coerceRegisterCardBody({ ...base, pokemon_dex: 6, sprite_image: '/static/x.png' });
    expect(out.pokemon_dex).toBe(6);
    expect(out.sprite_image).toBe('/static/x.png');
  });

  it('defaults both to null when omitted', () => {
    const out = coerceRegisterCardBody(base);
    expect(out.pokemon_dex).toBeNull();
    expect(out.sprite_image).toBeNull();
  });

  it('rejects an out-of-range dex', () => {
    expect(() => coerceRegisterCardBody({ ...base, pokemon_dex: 99999 })).toThrow();
    expect(() => coerceRegisterCardBody({ ...base, pokemon_dex: 0 })).toThrow();
    expect(() => coerceRegisterCardBody({ ...base, pokemon_dex: 5.5 })).toThrow();
  });
});

describe('coerceUpdateCardBody — pixel-pokemon fields', () => {
  const base = { name: 'Charizard', set: 'Base', grader: 'PSA', grade: '10', market_value: 100, image: '/x.png', for_sale: true };

  it('round-trips dex + sprite', () => {
    const out = coerceUpdateCardBody({ ...base, pokemon_dex: 151, sprite_image: 'https://cdn/x.png' }, 'charizard');
    expect(out.pokemon_dex).toBe(151);
    expect(out.sprite_image).toBe('https://cdn/x.png');
  });

  it('clears to null on empty/missing', () => {
    const out = coerceUpdateCardBody(base, 'charizard');
    expect(out.pokemon_dex).toBeNull();
    expect(out.sprite_image).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card/backend/packages/api"
corepack yarn test:unit src/api/admin/cards/__tests__/validate.unit.spec.ts
```
Expected: FAIL (validators don't return the new fields / don't throw on range yet). If `test:unit` needs a path filter flag, run `corepack yarn test:unit --testPathPattern validate.unit`.

- [ ] **Step 3: Add the dex + sprite coercion helpers and wire them into both bodies**

In `backend/packages/api/src/api/admin/cards/validate.ts`, add these helpers after `reqNum` (uses `POKEDEX_NAMES.length` is unavailable backend-side without the package; use the literal upper bound but comment it — the storefront resolver derives it from the array):

```ts
// Pixel-Pokémon avatar fields. dex is a 1-based national-dex int in [1, MAX_DEX];
// MAX_DEX mirrors POKEDEX_NAMES.length in @acme/pokemon (1025 today). Both are
// optional → null when omitted/blank (the card then resolves via name-derivation).
const MAX_DEX = 1025;

const optDex = (b: Record<string, unknown>): number | null => {
  const v = b.pokemon_dex;
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_DEX) {
    bad(`'pokemon_dex' must be an integer between 1 and ${MAX_DEX}.`);
  }
  return n as number;
};

const optSprite = (b: Record<string, unknown>): string | null => {
  const v = b.sprite_image;
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string') bad(`'sprite_image' must be a string URL.`);
  const s = (v as string).trim();
  if (s === '') return null;
  if (s.length > MAX_URL) bad(`'sprite_image' is too long (max ${MAX_URL} chars).`);
  if (!IMAGE_RE.test(s)) bad(`'sprite_image' must be an http(s) URL or a /storefront path.`);
  return s;
};
```

In `coerceRegisterCardBody`'s returned object, add:
```ts
    pokemon_dex: optDex(b),
    sprite_image: optSprite(b),
```

In `coerceUpdateCardBody`'s returned object, add the same two lines.

- [ ] **Step 4: Add the fields to the workflow input types + persistence**

In `backend/packages/api/src/workflows/steps/create-card.ts`:
- Extend `RegisterCardInput`:
```ts
export type RegisterCardInput = {
  product_id: string;
  set: string;
  grader: string;
  grade: string;
  market_value: number; // USD FMV — a decimal, never cents
  pokemon_dex: number | null;
  sprite_image: string | null;
};
```
- In the `packs.createCards([{ ... }])` call, after `for_sale: product.status === "published",` add:
```ts
          pokemon_dex: input.pokemon_dex,
          sprite_image: input.sprite_image,
```

In `backend/packages/api/src/workflows/steps/update-card.ts`:
- Extend `UpdateCardInput` (after `for_sale: boolean;`):
```ts
  pokemon_dex: number | null;
  sprite_image: string | null;
```
- Extend `CardSnapshot` (after `for_sale: boolean;`):
```ts
  pokemon_dex: number | null;
  sprite_image: string | null;
```
- In the `snapshot` object, after `for_sale: card.for_sale,` add:
```ts
      pokemon_dex: card.pokemon_dex ?? null,
      sprite_image: card.sprite_image ?? null,
```
- In the `packs.updateCards([{ ... }])` call (the forward write), after `for_sale: input.for_sale,` add:
```ts
        pokemon_dex: input.pokemon_dex,
        sprite_image: input.sprite_image,
```
- In the compensation `packs.updateCards([{ ... }])` call, after `for_sale: data.card.for_sale,` add:
```ts
        pokemon_dex: data.card.pokemon_dex,
        sprite_image: data.card.sprite_image,
```

(The mirrored Product is unaffected — these fields live only on the Card.)

- [ ] **Step 5: Add the fields to the admin read DTO**

In `backend/packages/api/src/modules/packs/admin-card.ts`:
- Extend `AdminCardLike`:
```ts
export type AdminCardLike = CardLike & {
  price: unknown;
  for_sale: boolean;
  pokemon_dex: number | null;
  sprite_image: string | null;
};
```
- In `toAdminCardDto`'s returned object, after `for_sale: card.for_sale,` add:
```ts
    pokemon_dex: card.pokemon_dex ?? null,
    sprite_image: card.sprite_image ?? null,
```

- [ ] **Step 6: Run the validator unit test (GREEN) + backend type-check**

```bash
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card/backend/packages/api"
corepack yarn test:unit --testPathPattern validate.unit
node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
```
Expected: tests PASS; no type errors.

- [ ] **Step 7: Commit**

```bash
git -C "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card" add backend/packages/api/src/api/admin/cards backend/packages/api/src/workflows/steps/create-card.ts backend/packages/api/src/workflows/steps/update-card.ts backend/packages/api/src/modules/packs/admin-card.ts
git -C "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card" commit -m "feat(packs): validate + persist + return pokemon_dex/sprite_image on admin card create/edit"
```

---

## Task 5: Add a `sprite` media-validation profile (square / relaxed aspect)

**Files:**
- Modify: `backend/packages/api/src/api/admin/media/validate.ts` (server gate)
- Modify: `backend/packages/api/src/api/admin/media/route.ts` (accept `kind: 'sprite'`)
- Modify: `backend/apps/admin/src/lib/image-validation.ts` (browser pre-check)
- Modify: `backend/apps/admin/src/lib/admin-rest.ts` (`uploadImage` kind union)
- Modify: `backend/apps/admin/src/lib/queries.ts` (`useUploadImage` kind union)
- Test: `backend/packages/api/src/api/admin/media/__tests__/validate.unit.spec.ts` (create if absent; if a media validate test already exists, extend it)

**Interfaces:**
- Produces: `ImageKind = 'pack' | 'card' | 'sprite'`. The `sprite` profile accepts a square-ish pixel sprite (min 64×64, ~1:1, generous tolerance).

- [ ] **Step 1: Write a failing unit test for the sprite profile (server gate)**

Create `backend/packages/api/src/api/admin/media/__tests__/validate.unit.spec.ts` (if the file exists, add only the `sprite` cases):

```ts
import { validateImage } from '../validate';

const facts = (w: number, h: number) => ({
  width: w, height: h, bytes: 1000, mimeType: 'image/png', detectedFormat: 'png', frames: 1,
});

describe('validateImage — sprite profile', () => {
  it('accepts a square pixel sprite', () => {
    expect(validateImage(facts(96, 96), 'sprite')).toEqual({ ok: true });
  });
  it('accepts a small near-square sprite', () => {
    expect(validateImage(facts(64, 64), 'sprite')).toEqual({ ok: true });
  });
  it('rejects a portrait card-shaped image under the sprite profile', () => {
    const r = validateImage(facts(600, 840), 'sprite');
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to confirm failure**

```bash
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card/backend/packages/api"
corepack yarn test:unit --testPathPattern media/__tests__/validate.unit
```
Expected: FAIL (`'sprite'` is not an `ImageKind`).

- [ ] **Step 3: Add the `sprite` profile to the server gate**

In `backend/packages/api/src/api/admin/media/validate.ts`:
- Widen the kind union:
```ts
export type ImageKind = "pack" | "card" | "sprite";
```
- Add a `sprite` profile to `IMAGE_RULES.profiles` (keep `satisfies Record<ImageKind, ProfileRule>`):
```ts
  profiles: {
    card: { minWidth: 600, minHeight: 840, targetRatio: 5 / 7, aspectTolerance: 0.03 },
    pack: { minWidth: 512, minHeight: 512, targetRatio: 1, aspectTolerance: 0.05 },
    // Pixel sprite: small + square-ish. Generous tolerance — pixel art is often
    // a few px off square; the storefront renders it object-contain regardless.
    sprite: { minWidth: 64, minHeight: 64, targetRatio: 1, aspectTolerance: 0.25 },
  } satisfies Record<ImageKind, ProfileRule>,
```
- The two binary `kind === "card" ? ... : ...` messages (steps 7 and 8 in `validateImage`) must handle three kinds. Replace the `too_small` message:
```ts
  if (facts.width < profile.minWidth || facts.height < profile.minHeight) {
    const label = kind === "card" ? "Card" : kind === "pack" ? "Pack" : "Sprite";
    return fail(
      "too_small",
      `${label} art must be at least ${profile.minWidth}×${profile.minHeight}px.`,
    );
  }
```
and the `bad_aspect` message:
```ts
  if (deviation > profile.aspectTolerance) {
    return fail(
      "bad_aspect",
      kind === "card"
        ? "Card art must be roughly 5:7 (portrait)."
        : "Sprite/pack art must be roughly square (1:1).",
    );
  }
```

- [ ] **Step 4: Accept `kind: 'sprite'` in the media route**

In `backend/packages/api/src/api/admin/media/route.ts`, replace the kind guard:
```ts
  const rawKind = (req.body as { kind?: string } | undefined)?.kind;
  if (rawKind !== 'pack' && rawKind !== 'card' && rawKind !== 'sprite') {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Field 'kind' must be 'pack', 'card', or 'sprite'.",
    );
  }
  const kind: ImageKind = rawKind;
```

- [ ] **Step 5: Mirror the `sprite` profile in the browser pre-check**

In `backend/apps/admin/src/lib/image-validation.ts`:
- Widen the kind union:
```ts
export type ImageKind = 'pack' | 'card' | 'sprite';
```
- Add the `sprite` profile to `PROFILES` (keep numbers in sync with `validate.ts`):
```ts
  sprite: {
    minWidth: 64,
    minHeight: 64,
    targetRatio: 1,
    aspectTolerance: 0.25,
  },
```
- Update the two messages to handle three kinds:
```ts
  if (dim.width < profile.minWidth || dim.height < profile.minHeight) {
    const label = kind === 'card' ? 'Card' : kind === 'pack' ? 'Pack' : 'Sprite';
    return `${label} art must be at least ${profile.minWidth}×${profile.minHeight}px.`;
  }
```
```ts
  if (deviation > profile.aspectTolerance) {
    return kind === 'card'
      ? 'Card art must be roughly 5:7 (portrait).'
      : 'Sprite/pack art must be roughly square (1:1).';
  }
```

- [ ] **Step 6: Widen the upload kind unions in the admin client**

In `backend/apps/admin/src/lib/admin-rest.ts`, change `uploadImage`'s signature:
```ts
export async function uploadImage(
  file: File,
  kind: 'pack' | 'card' | 'sprite',
): Promise<string> {
```

In `backend/apps/admin/src/lib/queries.ts`, change `useUploadImage`'s vars type:
```ts
export const useUploadImage = () =>
  useMutation({
    mutationFn: (vars: { file: File; kind: 'pack' | 'card' | 'sprite' }) =>
      uploadImage(vars.file, vars.kind),
  });
```

- [ ] **Step 7: Run the media test (GREEN) + backend type-check**

```bash
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card/backend/packages/api"
corepack yarn test:unit --testPathPattern media/__tests__/validate.unit
node ../../node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
```
Expected: tests PASS; no type errors.

- [ ] **Step 8: Commit**

```bash
git -C "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card" add backend/packages/api/src/api/admin/media backend/apps/admin/src/lib/image-validation.ts backend/apps/admin/src/lib/admin-rest.ts backend/apps/admin/src/lib/queries.ts
git -C "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card" commit -m "feat(media): add square 'sprite' upload-validation profile"
```

---

## Task 6: Add the two fields to the admin API facade types

**Files:**
- Modify: `backend/apps/admin/src/lib/packs-api.ts` (`AdminCard`, `AdminCardRegister`, `AdminCardUpdate`)

**Interfaces:**
- Consumes: the backend DTO (Task 4) now returns/accepts the fields.
- Produces: `AdminCard`, `AdminCardRegister`, `AdminCardUpdate` each gain `pokemon_dex: number | null` and `sprite_image: string | null`. (`queries.ts` register/update mutationFns spread the payload through — no query edit needed.)

- [ ] **Step 1: Extend the three card types**

In `backend/apps/admin/src/lib/packs-api.ts`:
- `AdminCard` (read shape) — after `for_sale: boolean;` (before `stock`):
```ts
  /** Assigned national-dex (1-based) or null → resolve from the name. */
  pokemon_dex: number | null;
  /** Custom uploaded pixel sprite URL or null → use the dex default gif. */
  sprite_image: string | null;
```
- `AdminCardRegister` — after `market_value: number;`:
```ts
  pokemon_dex: number | null;
  sprite_image: string | null;
```
- `AdminCardUpdate` — after `for_sale: boolean;`:
```ts
  pokemon_dex: number | null;
  sprite_image: string | null;
```

- [ ] **Step 2: Type-check the admin app**

```bash
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card/backend/apps/admin"
node ../../node_modules/typescript/bin/tsc -b --noEmit
```
Expected: this will surface type errors at the two call sites (`RegisterCardModal.tsx` `mutateAsync`, `cards/page.tsx` `save`/`formFromCard`) because the payloads now require the fields. That is expected — Task 7 fixes them. (If running tasks strictly in order, you may defer this check to the end of Task 7.)

- [ ] **Step 3: Commit** (after Task 7 makes the app compile, or commit together with Task 7)

```bash
git -C "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card" add backend/apps/admin/src/lib/packs-api.ts
git -C "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card" commit -m "feat(admin): add pokemon_dex/sprite_image to card API facade types"
```

---

## Task 7: Admin UI — shared dex-picker + sprite-upload field, wired into create + edit

**Files:**
- Create: `backend/apps/admin/src/routes/cards/CardPokemonFields.tsx`
- Modify: `backend/apps/admin/src/routes/cards/RegisterCardModal.tsx` (create flow)
- Modify: `backend/apps/admin/src/routes/cards/page.tsx` (inline edit flow)

**Interfaces:**
- Consumes: `@acme/pokemon` (`POKEDEX_NAMES`, `pokemonFromCard`, `spriteGif`); `useUploadImage` + `validateImageFile` with `kind: 'sprite'` (Task 5); `AdminCardRegister`/`AdminCardUpdate` requiring the two fields (Task 6).
- Produces: a reusable `<CardPokemonFields>` used by both card forms.

> **Sub-skill:** load `medusa-ui-conformance` before editing these files. The component below reuses only primitives already imported in this folder (`Input`, `Button`, `Label`, `Text` from `@medusajs/ui`, raw `<img>` for thumbnails, `resolveImageUrl`) — matching the existing product-picker/upload patterns. Do not introduce a new combobox dependency.

- [ ] **Step 1: Create the shared `CardPokemonFields` component**

Create `backend/apps/admin/src/routes/cards/CardPokemonFields.tsx`:

```tsx
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Button, Input, Label, Text, clx, toast } from '@medusajs/ui';
import { POKEDEX_NAMES, pokemonFromCard, spriteGif } from '@acme/pokemon';
import { useUploadImage } from '../../lib/queries';
import { validateImageFile } from '../../lib/image-validation';
import { resolveImageUrl } from '../../lib/image-url';

// The pixel-Pokémon assignment value for a card: an explicit national-dex number
// and/or a custom uploaded sprite. Both null → the card resolves via its name.
export type CardPokemonValue = {
  pokemon_dex: number | null;
  sprite_image: string | null;
};

type Props = {
  value: CardPokemonValue;
  onChange: (patch: Partial<CardPokemonValue>) => void;
  /** Card/product title used to compute the default name-derived suggestion. */
  suggestionName: string;
};

const PICKER_LIMIT = 60;

const CardPokemonFields = ({ value, onChange, suggestionName }: Props) => {
  const [filter, setFilter] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadImg = useUploadImage();
  const uploading = uploadImg.isPending;

  const suggestion = useMemo(
    () => pokemonFromCard(suggestionName),
    [suggestionName],
  );

  // Effective dex shown in the preview: explicit wins, else the name suggestion.
  const effectiveDex = value.pokemon_dex ?? suggestion?.dex ?? null;
  const effectiveName =
    value.pokemon_dex !== null
      ? (POKEDEX_NAMES[value.pokemon_dex - 1] ?? null)
      : (suggestion?.name ?? null);

  const matches = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return [] as { dex: number; name: string }[];
    const out: { dex: number; name: string }[] = [];
    for (let i = 0; i < POKEDEX_NAMES.length && out.length < PICKER_LIMIT; i++) {
      if (POKEDEX_NAMES[i].toLowerCase().includes(q)) {
        out.push({ dex: i + 1, name: POKEDEX_NAMES[i] });
      }
    }
    return out;
  }, [filter]);

  const handleSprite = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const problem = await validateImageFile(file, 'sprite');
    if (problem) {
      toast.error(problem);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    try {
      const url = await uploadImg.mutateAsync({ file, kind: 'sprite' });
      onChange({ sprite_image: url });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // Preview: custom sprite wins, else the effective dex gif, else nothing.
  const previewSrc = value.sprite_image
    ? resolveImageUrl(value.sprite_image)
    : effectiveDex !== null
      ? spriteGif(effectiveDex)
      : null;

  return (
    <div className="bg-ui-bg-subtle flex flex-col gap-y-3 rounded-lg p-4">
      <Label size="small" weight="plus">
        Pixel Pokémon
      </Label>

      <div className="flex items-center gap-4">
        {previewSrc ? (
          <img
            src={previewSrc}
            alt=""
            className="border-ui-border-base h-16 w-16 shrink-0 rounded border bg-white object-contain"
          />
        ) : (
          <div className="border-ui-border-base bg-ui-bg-base text-ui-fg-muted flex h-16 w-16 shrink-0 items-center justify-center rounded border text-xs">
            —
          </div>
        )}
        <div className="flex flex-col">
          <Text size="small" className="font-medium">
            {value.pokemon_dex !== null
              ? `#${value.pokemon_dex} ${effectiveName ?? ''}`
              : suggestion
                ? `Auto: #${suggestion.dex} ${suggestion.name}`
                : 'Unassigned'}
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            {value.sprite_image
              ? 'Custom sprite uploaded'
              : value.pokemon_dex !== null
                ? 'Showdown gif for the chosen dex'
                : 'Falls back to the card name'}
          </Text>
        </div>
      </div>

      {/* Dex picker — search by name, click to assign */}
      <Input
        placeholder="Search a Pokémon by name to assign…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      {matches.length > 0 && (
        <div className="max-h-44 divide-y overflow-y-auto rounded-lg border">
          {matches.map((m) => (
            <button
              key={m.dex}
              type="button"
              onClick={() => {
                onChange({ pokemon_dex: m.dex });
                setFilter('');
              }}
              className={clx(
                'hover:bg-ui-bg-base-hover flex w-full items-center gap-3 px-4 py-2 text-left',
                value.pokemon_dex === m.dex && 'bg-ui-bg-base-pressed',
              )}
            >
              <img
                src={spriteGif(m.dex)}
                alt=""
                className="h-8 w-8 shrink-0 bg-white object-contain"
              />
              <span className="flex-1 truncate text-sm font-medium">
                #{m.dex} {m.name}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {value.pokemon_dex !== null && (
          <Button
            size="small"
            variant="secondary"
            type="button"
            onClick={() => onChange({ pokemon_dex: null })}
          >
            Clear dex (use name)
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleSprite}
        />
        <Button
          size="small"
          variant="secondary"
          type="button"
          onClick={() => fileRef.current?.click()}
          isLoading={uploading}
        >
          Upload custom sprite
        </Button>
        {value.sprite_image && (
          <Button
            size="small"
            variant="transparent"
            type="button"
            onClick={() => onChange({ sprite_image: null })}
          >
            Remove sprite
          </Button>
        )}
      </div>
    </div>
  );
};

export default CardPokemonFields;
```

- [ ] **Step 2: Wire `CardPokemonFields` into the create modal**

In `backend/apps/admin/src/routes/cards/RegisterCardModal.tsx`:
- Add the import (with the other local imports):
```ts
import CardPokemonFields from './CardPokemonFields';
```
- Extend the `Fields` type and `EMPTY_FIELDS`:
```ts
type Fields = {
  set: string;
  grader: string;
  grade: string;
  market_value: string; // string so the operator can type freely
  pokemon_dex: number | null;
  sprite_image: string | null;
};

const EMPTY_FIELDS: Fields = {
  set: '',
  grader: '',
  grade: '',
  market_value: '',
  pokemon_dex: null,
  sprite_image: null,
};
```
- In `save()`, add the two fields to the `mutateAsync` payload:
```ts
      await registerCard.mutateAsync({
        product_id: productId,
        set: fields.set.trim(),
        grader: fields.grader.trim(),
        grade: fields.grade.trim(),
        market_value: Number(fields.market_value),
        pokemon_dex: fields.pokemon_dex,
        sprite_image: fields.sprite_image,
      });
```
- Render the field block. After the gacha-facts `grid` block (the `</div>` closing the `grid grid-cols-2 gap-4`) and before the `<Text ...>{t('cards.register.rarityHint')}</Text>`, add:
```tsx
            <CardPokemonFields
              value={{
                pokemon_dex: fields.pokemon_dex,
                sprite_image: fields.sprite_image,
              }}
              onChange={(p) => patch(p)}
              suggestionName={selected?.title ?? ''}
            />
```

- [ ] **Step 3: Wire `CardPokemonFields` into the inline edit modal**

In `backend/apps/admin/src/routes/cards/page.tsx`:
- Add the import:
```ts
import CardPokemonFields from './CardPokemonFields';
```
- Extend `FormState` (after `for_sale: boolean;`):
```ts
  pokemon_dex: number | null;
  sprite_image: string | null;
```
- Extend `formFromCard` (after `for_sale: c.for_sale,`):
```ts
  pokemon_dex: c.pokemon_dex,
  sprite_image: c.sprite_image,
```
- In `save()`, add the two fields to the `payload`:
```ts
    const payload: AdminCardUpdate = {
      name: form.name.trim(),
      set: form.set.trim(),
      grader: form.grader.trim(),
      grade: form.grade.trim(),
      market_value: Number(form.market_value),
      image: form.image.trim(),
      price: form.price.trim() === '' ? undefined : Number(form.price),
      for_sale: form.for_sale,
      pokemon_dex: form.pokemon_dex,
      sprite_image: form.sprite_image,
    };
```
- Render the field block. Inside the edit `FocusModal.Body`, after the `for_sale` switch block (the `<div className="bg-ui-bg-subtle flex items-center justify-between ...">…</div>`) and before the closing `</div>` of the `max-w-[640px]` column, add:
```tsx
                <CardPokemonFields
                  value={{
                    pokemon_dex: form.pokemon_dex,
                    sprite_image: form.sprite_image,
                  }}
                  onChange={(p) => patch(p)}
                  suggestionName={form.name}
                />
```

- [ ] **Step 4: Type-check + build the admin app**

```bash
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card/backend/apps/admin"
node ../../node_modules/typescript/bin/tsc -b --noEmit
node ../../node_modules/vite/bin/vite.js build
```
Expected: no type errors; the Vite build succeeds. (`@acme/odds-math`'s `dist` must already be built for the admin build — if Vite errors on it, run `cd backend/packages/odds-math && node ../../node_modules/typescript/bin/tsc -p tsconfig.json` once, then rebuild. `@acme/pokemon` is source-based and needs no such step, and must NOT appear in `vite.config.ts`.)

- [ ] **Step 5: Manual verification (admin on :7000)**

Per `CLAUDE.md`, run the admin on **:7000** only (CORS allows only that origin). Build the backend if needed, start backend `:9000`, start admin vite on `:7000`. Verify: open Gacha Cards → "Add card" → pick a product whose title contains a Pokémon → the field shows `Auto: #N Name`; search + pick a different dex → preview updates; upload a square PNG → it's accepted and previews; Save. Edit an existing card → the picker pre-fills from `pokemon_dex`/`sprite_image`; clear dex → falls back to Auto. Confirm a non-square card-shaped image is rejected with the sprite message.

- [ ] **Step 6: Commit** (fold in Task 6's `packs-api.ts` change if not already committed)

```bash
git -C "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card" add backend/apps/admin/src/routes/cards backend/apps/admin/src/lib/packs-api.ts
git -C "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card" commit -m "feat(admin): dex picker + custom-sprite upload on card create/edit"
```

---

## Task 8: Storefront — canonical resolver + reel switch

**Files:**
- Create: `src/lib/resolve-card-pokemon.ts`
- Test: `src/lib/__tests__/resolve-card-pokemon.test.ts`
- Modify: `src/lib/data/schemas.ts` (`WonCardSchema`)
- Modify: `src/lib/actions/packs.ts` (`BackendWonCard`, `WonCard`, `openPack` mapping)
- Modify: `src/app/slots/[slug]/SlotMachineClient.tsx` (winner build, lines 171-185)

**Interfaces:**
- Consumes: the open route now returns `card.pokemon_dex` / `card.sprite_image` (Task 3).
- Produces: `resolveCardPokemon(card) => { dex: number|null; name: string|null; sprite: string|null }`; `WonCard` gains the two fields.

- [ ] **Step 1: Write the failing resolver unit test**

Create `src/lib/__tests__/resolve-card-pokemon.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveCardPokemon } from '@/lib/resolve-card-pokemon';
import { POKEDEX_NAMES } from '@/lib/mock/pokedex-names';

describe('resolveCardPokemon', () => {
  it('explicit pokemon_dex wins over name-derivation', () => {
    const r = resolveCardPokemon({ name: 'Pikachu Card', pokemon_dex: 150 });
    expect(r.dex).toBe(150);
    expect(r.name).toBe('Mewtwo');
  });

  it('custom sprite_image wins over the dex gif', () => {
    const r = resolveCardPokemon({
      name: 'Charizard',
      pokemon_dex: 6,
      sprite_image: '/static/custom.png',
    });
    expect(r.sprite).toBe('/static/custom.png');
  });

  it('falls back to name-derivation when pokemon_dex is null', () => {
    const r = resolveCardPokemon({ name: 'Charizard VMAX', pokemon_dex: null });
    expect(r.dex).toBe(6);
    expect(r.name).toBe('Charizard');
    expect(r.sprite).toContain('/6.gif');
  });

  it('treats an out-of-range dex as unset and falls through to the name', () => {
    const r = resolveCardPokemon({ name: 'Charizard', pokemon_dex: 99999 });
    expect(r.dex).toBe(6); // from the name, not the bad dex
    const r2 = resolveCardPokemon({ name: "Professor's Research", pokemon_dex: 0 });
    expect(r2.dex).toBeNull();
  });

  it('resolves to all-null for an unresolvable card with no fields', () => {
    const r = resolveCardPokemon({ name: "Professor's Research" });
    expect(r).toEqual({ dex: null, name: null, sprite: null });
  });

  it('uses the full national dex range', () => {
    expect(POKEDEX_NAMES.length).toBeGreaterThanOrEqual(1025);
  });
});
```

- [ ] **Step 2: Run it to confirm failure**

```bash
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card"
npx vitest run src/lib/__tests__/resolve-card-pokemon.test.ts
```
Expected: FAIL (`resolve-card-pokemon` does not exist).

- [ ] **Step 3: Implement the canonical resolver**

Create `src/lib/resolve-card-pokemon.ts`:

```ts
// The single canonical card→Pokémon resolution rule (storefront copy). Mirrors
// the backend admin rule in @acme/pokemon. Explicit fields win; name-derivation
// (pokemonFromCard) is the graceful fallback so unassigned cards keep working.
import { pokemonFromCard } from '@/lib/pokemon-from-card';
import { POKEDEX_NAMES } from '@/lib/mock/pokedex-names';
import { spriteGif } from '@/lib/mock/pokedex';

export type CardPokemonInput = {
  name: string;
  pokemon_dex?: number | null;
  sprite_image?: string | null;
};

export type ResolvedCardPokemon = {
  dex: number | null;
  name: string | null;
  sprite: string | null;
};

const MAX_DEX = POKEDEX_NAMES.length; // derive the bound; never hardcode 1025

const validDex = (d: number | null | undefined): d is number =>
  typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= MAX_DEX;

export function resolveCardPokemon(card: CardPokemonInput): ResolvedCardPokemon {
  const explicit = validDex(card.pokemon_dex) ? card.pokemon_dex : null;
  const fallback = explicit === null ? pokemonFromCard(card.name) : null;
  const dex = explicit ?? fallback?.dex ?? null;
  const name =
    explicit !== null
      ? (POKEDEX_NAMES[explicit - 1] ?? null)
      : (fallback?.name ?? null);
  const custom =
    card.sprite_image && card.sprite_image.trim() !== ''
      ? card.sprite_image
      : null;
  const sprite = custom ?? (dex !== null ? spriteGif(dex) : null);
  return { dex, name, sprite };
}
```

- [ ] **Step 4: Run the test (GREEN)**

```bash
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card"
npx vitest run src/lib/__tests__/resolve-card-pokemon.test.ts
```
Expected: PASS.

- [ ] **Step 5: Add the fields to `WonCardSchema` for typed access**

In `src/lib/data/schemas.ts`, extend `WonCardSchema` (looseObject passes the fields through at runtime, but they must be declared for TS to read them; do NOT constrain the dex range here — a bad value must not null the whole card, the resolver guards it):

```ts
export const WonCardSchema = z.looseObject({
  handle: z.string(),
  name: z.string(),
  rarity,
  market_value: finite,
  pokemon_dex: z.number().nullable().optional(),
  sprite_image: z.string().nullable().optional(),
});
```

- [ ] **Step 6: Thread the fields through `openPack`**

In `src/lib/actions/packs.ts`:
- Extend `WonCard`:
```ts
export type WonCard = {
  id: string;
  name: string;
  image: string;
  value: string;
  rarity: Rarity;
  pokemon_dex: number | null;
  sprite_image: string | null;
};
```
- Extend `BackendWonCard`:
```ts
interface BackendWonCard {
  handle: string;
  name: string;
  image: string;
  market_value: number;
  rarity: string;
  pokemon_dex?: number | null;
  sprite_image?: string | null;
}
```
- In the success return's `card: { ... }` mapping (lines ~133-139), add the two fields (read from `wonCard`, the parsed `WonCardSchema` result):
```ts
      card: {
        id: wonCard.handle,
        name: wonCard.name,
        image: card.image,
        value: formatValue(wonCard.market_value),
        rarity: wonCard.rarity as Rarity,
        pokemon_dex: wonCard.pokemon_dex ?? null,
        sprite_image: wonCard.sprite_image ?? null,
      },
```

- [ ] **Step 7: Switch the reel winner-build to the resolution rule**

In `src/app/slots/[slug]/SlotMachineClient.tsx`:
- Replace the import of `pokemonFromCard` with the resolver:
```ts
import { resolveCardPokemon } from '@/lib/resolve-card-pokemon';
```
(remove `import { pokemonFromCard } from '@/lib/pokemon-from-card';`)
- Replace the winner-build block (currently lines ~175-185, `const mon = pokemonFromCard(...)` through the `winners` array) with:
```ts
    const tier = priceTier(res.marketValue);
    const r = resolveCardPokemon(res.card);
    const custom =
      res.card.sprite_image && res.card.sprite_image.trim() !== ''
        ? res.card.sprite_image
        : null;
    const winners: ColumnWinner[] = Array.from(
      { length: COLUMN_COUNT },
      () => ({
        dex: r.dex,
        // Custom sprite wins; an explicit/derived dex lets the column draw the
        // gif (image undefined); otherwise the neutral Poké Ball (never card art).
        image: custom ?? (r.dex === null ? POKEBALL_PLACEHOLDER : undefined),
        name: r.name ?? res.card.name,
        tier,
      }),
    );
```

- [ ] **Step 8: Type-check + run the storefront unit suites**

```bash
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card"
npm run typecheck
npx vitest run src/lib/__tests__/resolve-card-pokemon.test.ts src/lib/data/__tests__/schemas.test.ts src/lib/__tests__/reel.test.ts
```
Expected: no type errors; tests PASS. (Run whichever of those test files exist.)

- [ ] **Step 9: Commit**

```bash
git -C "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card" add src/lib/resolve-card-pokemon.ts src/lib/__tests__/resolve-card-pokemon.test.ts src/lib/data/schemas.ts src/lib/actions/packs.ts "src/app/slots/[slug]/SlotMachineClient.tsx"
git -C "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card" commit -m "feat(slots): resolve reel Pokémon via pokemon_dex/sprite_image (name fallback)"
```

---

## Task 9: Whole-feature verification

**Files:** none (verification only).

- [ ] **Step 1: Type-check the whole repo (storefront + backend)**

```bash
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card"
npm run typecheck
cd backend && corepack yarn workspace @acme/pokemon check-types
node ../node_modules/typescript/bin/tsc -p packages/api/tsconfig.json --noEmit
cd apps/admin && node ../../node_modules/typescript/bin/tsc -b --noEmit
```
Expected: all green. (This is the same gate the Stop hook enforces.)

- [ ] **Step 2: Run all new/affected unit suites**

```bash
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card/backend"
corepack yarn workspace @acme/pokemon test
corepack yarn workspace @acme/api test:unit --testPathPattern "cards/__tests__/validate.unit|media/__tests__/validate.unit"
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card"
npx vitest run
```
Expected: all PASS.

- [ ] **Step 3: Build the storefront + serve the standalone bundle, then run the slot QA**

```bash
cd "C:/Users/PC/Desktop/Projects/Pokenic_Game/.claude/worktrees/feat+pixel-pokemon-per-card"
npm run build
pwsh scripts/serve-standalone.ps1 -Port 4000   # background
```
Then run the existing Playwright slot QA (e.g. `node scripts/qa-slots-phaseB.mjs`) with `QA_SLOT_EMAIL`/`QA_SLOT_PASSWORD` set and a funded test account so the spin path actually runs. Read the screenshots it writes to `docs/research/*.png`. Verify: a card with an assigned dex shows that Pokémon's gif; a card with a custom sprite shows the upload; an unassigned trainer/energy card still lands on the Poké Ball (no card-art leak, no broken image). Kill the server and any stray node processes when done (`@(Get-Process node).Count`).

- [ ] **Step 4: Manual end-to-end (optional but recommended)**

Backend `:9000` + admin `:7000` + storefront. Assign a dex + upload a sprite to a card in the admin → open that pack on `/slots/<pack>` → confirm the reel shows the assigned Pokémon/sprite.

- [ ] **Step 5: Code review + security review before merge**

Run `/code-review` (or `coderabbit:code-review`) on the branch diff and `/security-review` (the change touches an upload endpoint + admin input validation). Address CRITICAL/HIGH; defer findings that change visuals or are latent (note them).

---

## Self-Review (run after writing — checklist, already applied)

**Spec coverage:**
- §2 locked decisions — 1:1 fields-on-Card (Task 2), per-card draw untouched (Global Constraints + Task 3 determinism note), species reuse (no uniqueness constraint added), resolution explicit-wins (Tasks 7/8 resolver).
- §3 resolution rule — encoded as the canonical pseudocode + implemented in `@acme/pokemon` consumers (Task 7) and `resolve-card-pokemon.ts` (Task 8), with the review's three corrections folded in: out-of-range guard, `?? card.name` terminal name, Poké-Ball (not card-art) terminal sprite for the reel.
- §4.1 package — Task 1 (source-based divergence called out).
- §4.2 model + exposure — Tasks 2 (model+migration), 3 (RolledCard/open), 4 (admin DTO/validators/persistence).
- §4.3 admin UI + reel switch — Tasks 5 (sprite media kind), 6 (facade types), 7 (dex picker + sprite upload, both create + the *inline* edit modal), 8 (reel).
- §6 testing — `@acme/pokemon` unit (Task 1), validator units (Task 4), media-profile unit (Task 5), resolver unit on the storefront live-consumer side (Task 8), Playwright slot QA (Task 9). The "draw unchanged" claim is covered by the determinism argument + optional integration assertion (Task 3).
- §5 out-of-scope — honored: profiles, `/claw`, vault, leaderboard, `toCardView`, recent-pulls are explicitly NOT edited (Global Constraints). This is the 2026-06-19 reel-only decision.

**Placeholder scan:** every code step shows full code; verbatim-copy steps give the exact `cp` + the single import edit; no TBD/TODO.

**Type consistency:** `pokemon_dex: number | null` and `sprite_image: string | null` are used consistently across model, `RolledCard`, `RegisterCardInput`/`UpdateCardInput`, `CardSnapshot`, `toAdminCardDto`, `AdminCard`/`AdminCardRegister`/`AdminCardUpdate`, `WonCard`/`BackendWonCard`/`WonCardSchema`, and `CardPokemonValue`. `resolveCardPokemon` returns `{ dex: number|null; name: string|null; sprite: string|null }` everywhere it is consumed. `kind: 'pack'|'card'|'sprite'` is widened in all four upload sites.

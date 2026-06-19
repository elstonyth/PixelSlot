# Pokémon-grouped Pack Odds Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cluster the admin Pack Odds Editor's per-card rows under collapsible Pokémon group headers with per-group win-rate rollups, as a display-only authoring convenience.

**Architecture:** A new source-based `@acme/pokemon` package ports the storefront's name→dex matcher into the backend monorepo. Two pure admin helpers (`groupRowsByPokemon`, `groupRollup`) derive groups + rollups from the existing `EditRow[]`. The editor page renders rows grouped under header rows; nothing about grouping touches the save path, the server draw, or any backend file.

**Tech Stack:** TypeScript (strict), React 19, `@medusajs/ui` v4.1.1 (primitive `Table`), Yarn-4 workspaces, Jest+`@swc/jest` (package tests), Vitest (admin tests), react-i18next.

**Spec:** `docs/superpowers/specs/2026-06-19-pokemon-grouped-odds-editor-design.md`

## Global Constraints

*(Every task implicitly includes these.)*

- **Backend is untouched.** Do NOT edit `backend/packages/api/**` (routes, workflows, `roll-pack`, `PackOdds` model/migrations) or `backend/packages/odds-math/**`. The server draw + save POST stay byte-identical.
- **Save path byte-stable.** `rowsToOddsInputs(rows)` over the flat `EditRow[]` is unchanged; grouping is a read-only projection never fed into it. The POST route only accepts `{card_id, locked, pct, rarity}`.
- **`@acme/pokemon` is SOURCE-BASED:** `main`/`types`/`exports` → `./src/index.ts`. **No `build` script, no `dist`, no `.gitignore`.** Do **NOT** edit `backend/apps/admin/vite.config.ts` (that CJS interop is only the documented fallback if source resolution fails — see spec §9).
- **`POKEDEX_NAMES` order is significant:** `dex = index + 1`. Copy the array verbatim; never reorder/sort it.
- **`pokemonFromCard` has no "form-base fallback"** — it returns `null` on no match; callers route `null` to the "Other" bucket.
- **Use `<Table.HeaderCell colSpan={7}>`** for the spanning group-header cell — `Table.Cell` omits `colSpan` and fails strict `tsc`.
- **i18n:** one locale file, `backend/apps/admin/src/i18n/en.json`; new keys under `packs.editor.group.*`. No hardcoded UI copy.
- **Display:** rollups formatted with `fmtPct`; never assert a group sums to exactly 100 (2dp rounding can read 99.99/100.01).
- **TDD** for the package + the two pure helpers (test-first). The page change is presentational → verified by `tsc`/lint + manual smoke on the running admin `:7000` (per repo `testing.md`), not unit tests.
- **Commit per task**, conventional commits, trailer `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Run commands from the worktree root** (`...\.claude\worktrees\feat+pokemon-grouped-odds-editor`). The Stop-hook typechecks the **main** repo, not this worktree — do not trust it as this feature's gate; run the explicit commands below.

---

### Task 1: `@acme/pokemon` source-based package

**Files:**
- Create: `backend/packages/pokemon/package.json`
- Create: `backend/packages/pokemon/tsconfig.json`
- Create: `backend/packages/pokemon/jest.config.js`
- Create: `backend/packages/pokemon/src/pokedex-names.ts` (verbatim copy of `src/lib/mock/pokedex-names.ts`)
- Create: `backend/packages/pokemon/src/index.ts`
- Test: `backend/packages/pokemon/src/__tests__/pokemon.unit.spec.ts`

**Interfaces:**
- Produces: `pokemonFromCard(cardName: string): CardPokemon | null`; `type CardPokemon = { dex: number; name: string }`; `POKEDEX_NAMES: string[]` — all from `@acme/pokemon`.

- [ ] **Step 1: Create the package scaffold (config files)**

`backend/packages/pokemon/package.json`:
```json
{
  "name": "@acme/pokemon",
  "version": "2.1.6",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": { "types": "./src/index.ts", "default": "./src/index.ts" } },
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

`backend/packages/pokemon/tsconfig.json` (copied from odds-math; `--noEmit` ignores the emit settings):
```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["dist", "node_modules", "src/__tests__"]
}
```

`backend/packages/pokemon/jest.config.js` (byte-for-byte from odds-math):
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

- [ ] **Step 2: Install so the workspace symlink + devDeps exist**

Run: `corepack yarn install`
Expected: completes; `@acme/pokemon` is now a resolvable workspace.

- [ ] **Step 3: Copy the dex names verbatim**

Copy the entire contents of `src/lib/mock/pokedex-names.ts` (1025 entries, national-dex order) into `backend/packages/pokemon/src/pokedex-names.ts` unchanged. The file begins:
```ts
// AUTO-GENERATED from PokeAPI (national-dex order). Index i => dex #(i+1).
export const POKEDEX_NAMES: string[] = [
  'Bulbasaur',
  'Ivysaur',
  // … all 1025 entries, in order, verbatim …
  'Pecharunt',
];
```
Do not reorder — `dex = index + 1`.

- [ ] **Step 4: Write the failing test**

`backend/packages/pokemon/src/__tests__/pokemon.unit.spec.ts`:
```ts
import { pokemonFromCard, POKEDEX_NAMES } from '../index';

describe('pokemonFromCard', () => {
  it('matches a plain Pokémon name to its dex', () => {
    expect(pokemonFromCard('Charizard')).toEqual({ dex: 6, name: 'Charizard' });
  });

  it('matches inside a fuller card title (longest substring)', () => {
    expect(pokemonFromCard('Pikachu V')).toEqual({ dex: 25, name: 'Pikachu' });
  });

  it('prefers the most specific match (mewtwo before mew)', () => {
    expect(pokemonFromCard('Mewtwo GX')).toEqual({ dex: 150, name: 'Mewtwo' });
    expect(pokemonFromCard('Mew')).toEqual({ dex: 151, name: 'Mew' });
  });

  it('returns null for a non-Pokémon card', () => {
    expect(pokemonFromCard('Double Colorless Energy')).toBeNull();
    expect(pokemonFromCard('')).toBeNull();
  });

  it('exports the full national dex in order', () => {
    expect(POKEDEX_NAMES[0]).toBe('Bulbasaur');
    expect(POKEDEX_NAMES.length).toBeGreaterThanOrEqual(1025);
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `corepack yarn workspace @acme/pokemon test`
Expected: FAIL — cannot find module `../index`.

- [ ] **Step 6: Implement `src/index.ts` (port verbatim, fixing the import path)**

`backend/packages/pokemon/src/index.ts`:
```ts
// Pokémon-from-card matcher — ported verbatim from the storefront
// (src/lib/pokemon-from-card.ts). Kept as an admin-monorepo copy because the
// storefront is a separate workspace and cannot share @acme/*. The dex name
// list (pokedex-names.ts) is duplicated here too; both copies are static
// national-dex data and must stay in sync if the match rules ever change.
import { POKEDEX_NAMES } from './pokedex-names';

export type CardPokemon = { dex: number; name: string };

/** Fold to comparison form: lowercase, drop every non-alphanumeric char. */
const normalize = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Sorted LONGEST-FIRST so the first substring hit is the most specific
// Pokémon ("mewtwo" before "mew").
const INDEX: ReadonlyArray<{ dex: number; norm: string }> = POKEDEX_NAMES.map(
  (name, i) => ({ dex: i + 1, norm: normalize(name) }),
)
  .filter((e) => e.norm.length > 0)
  .sort((a, b) => b.norm.length - a.norm.length);

/** Normalized longest-substring match against the national Pokédex. Returns
 *  null for cards with no resolvable Pokémon (trainer/energy). No fallback
 *  logic lives here — the caller routes null into the "Other" group. */
export function pokemonFromCard(cardName: string): CardPokemon | null {
  const hay = normalize(cardName);
  if (!hay) return null;
  for (const { dex, norm } of INDEX) {
    if (hay.includes(norm)) return { dex, name: POKEDEX_NAMES[dex - 1] };
  }
  return null;
}

export { POKEDEX_NAMES };
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `corepack yarn workspace @acme/pokemon test`
Expected: PASS (5 tests).

- [ ] **Step 8: Type-check the package**

Run: `corepack yarn workspace @acme/pokemon check-types`
Expected: no output (exit 0).

- [ ] **Step 9: Commit**

```bash
git add backend/packages/pokemon backend/yarn.lock
git commit -m "feat(pokemon): add @acme/pokemon source-based name->dex matcher

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `groupRowsByPokemon` admin helper

**Files:**
- Create: `backend/apps/admin/src/lib/group-rows.ts`
- Test: `backend/apps/admin/src/lib/group-rows.test.ts`
- Modify: `backend/apps/admin/package.json` (add the `@acme/pokemon` dependency)

**Interfaces:**
- Consumes: `pokemonFromCard`, `CardPokemon` from `@acme/pokemon` (Task 1); `EditRow` from `./odds-rows`.
- Produces: `type PokemonGroup = { pokemon: CardPokemon | null; key: string; rows: EditRow[] }`; `groupRowsByPokemon(rows: EditRow[]): PokemonGroup[]`.

> This task's passing Vitest run is also the **resolution gate** from spec §7: it proves the admin's node-env Vitest resolves `@acme/pokemon`'s TS source via the workspace symlink with no `vite.config.ts` edit. If it cannot resolve, stop and apply the CJS-mirror fallback (spec §9) before continuing.

- [ ] **Step 1: Add the workspace dependency**

In `backend/apps/admin/package.json`, add to `dependencies` directly after the `@acme/odds-math` line:
```json
    "@acme/odds-math": "workspace:*",
    "@acme/pokemon": "workspace:*",
```

- [ ] **Step 2: Install so the admin sees the package**

Run: `corepack yarn install`
Expected: completes; `@acme/pokemon` symlinked into the admin.

- [ ] **Step 3: Write the failing test**

`backend/apps/admin/src/lib/group-rows.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { EditRow } from './odds-rows';
import { groupRowsByPokemon } from './group-rows';

const row = (over: Partial<EditRow> = {}): EditRow => ({
  card_id: 'c',
  name: 'Charizard',
  image: '',
  rarity: 'Rare',
  market_value: 100,
  stock: 10,
  currentPct: 10,
  locked: false,
  pctInput: '10',
  ...over,
});

describe('groupRowsByPokemon', () => {
  it('groups rows by derived dex, ordered dex-ascending', () => {
    const groups = groupRowsByPokemon([
      row({ card_id: '1', name: 'Charizard GX' }), // dex 6
      row({ card_id: '2', name: 'Pikachu V' }), // dex 25
      row({ card_id: '3', name: 'Charizard (Base)' }), // dex 6
    ]);
    expect(groups.map((g) => g.pokemon?.dex)).toEqual([6, 25]);
    expect(groups[0].key).toBe('6');
    expect(groups[0].rows.map((r) => r.card_id)).toEqual(['1', '3']);
  });

  it('collects unresolvable cards into one "Other" group, always last', () => {
    const groups = groupRowsByPokemon([
      row({ card_id: 'e', name: 'Double Colorless Energy' }),
      row({ card_id: 'p', name: 'Pikachu' }),
    ]);
    expect(groups.at(-1)?.pokemon).toBeNull();
    expect(groups.at(-1)?.key).toBe('other');
    expect(groups.at(-1)?.rows.map((r) => r.card_id)).toEqual(['e']);
  });

  it('preserves incoming order within a group and keeps every row once', () => {
    const groups = groupRowsByPokemon([
      row({ card_id: 'a', name: 'Mew' }),
      row({ card_id: 'b', name: 'Mewtwo' }),
      row({ card_id: 'c', name: 'Mew' }),
    ]);
    expect(groups.reduce((n, g) => n + g.rows.length, 0)).toBe(3);
    const mew = groups.find((g) => g.pokemon?.name === 'Mew');
    expect(mew?.rows.map((r) => r.card_id)).toEqual(['a', 'c']);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `corepack yarn workspace @acme/admin exec vitest run src/lib/group-rows.test.ts`
Expected: FAIL — cannot find module `./group-rows`.

- [ ] **Step 5: Implement the helper**

`backend/apps/admin/src/lib/group-rows.ts`:
```ts
import { pokemonFromCard, type CardPokemon } from '@acme/pokemon';
import type { EditRow } from './odds-rows';

// One Pokémon cluster of editor rows. `pokemon: null` is the shared "Other"
// bucket (cards whose name resolves to no dex entry). `key` is a stable React
// key — the dex number as a string, or 'other'.
export type PokemonGroup = {
  pokemon: CardPokemon | null;
  key: string;
  rows: EditRow[];
};

// Cluster editor rows by the Pokémon derived from each card's (immutable) name.
// Groups are ordered by dex ascending; the "Other" bucket is always last.
// Row order within a group is preserved (the server already sorts by value
// desc). Pure + display-only — never feeds the save path.
export function groupRowsByPokemon(rows: EditRow[]): PokemonGroup[] {
  const byDex = new Map<number, { pokemon: CardPokemon; rows: EditRow[] }>();
  const other: EditRow[] = [];

  for (const row of rows) {
    const pokemon = pokemonFromCard(row.name);
    if (!pokemon) {
      other.push(row);
      continue;
    }
    const existing = byDex.get(pokemon.dex);
    if (existing) existing.rows.push(row);
    else byDex.set(pokemon.dex, { pokemon, rows: [row] });
  }

  const groups: PokemonGroup[] = [...byDex.values()]
    .sort((a, b) => a.pokemon.dex - b.pokemon.dex)
    .map((g) => ({ pokemon: g.pokemon, key: String(g.pokemon.dex), rows: g.rows }));

  if (other.length > 0) groups.push({ pokemon: null, key: 'other', rows: other });
  return groups;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `corepack yarn workspace @acme/admin exec vitest run src/lib/group-rows.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/apps/admin/src/lib/group-rows.ts backend/apps/admin/src/lib/group-rows.test.ts backend/apps/admin/package.json backend/yarn.lock
git commit -m "feat(admin): add groupRowsByPokemon helper for the odds editor

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `groupRollup` (per-group current/preview/stock + highlight)

**Files:**
- Modify: `backend/apps/admin/src/lib/group-rows.ts`
- Modify: `backend/apps/admin/src/lib/group-rows.test.ts`

**Interfaces:**
- Consumes: `EditRow` (`./odds-rows`); the `previewByCard: Map<string, number>` the editor already builds from `computeOdds` (`page.tsx:103-106`).
- Produces: `type GroupRollup = { count: number; currentPct: number; previewPct: number; changed: boolean; stock: number | null }`; `groupRollup(rows: EditRow[], previewByCard: Map<string, number>): GroupRollup`.

- [ ] **Step 1: Add the failing tests**

Append to `backend/apps/admin/src/lib/group-rows.test.ts` (and add `groupRollup` to the existing import from `./group-rows`):
```ts
import { groupRollup } from './group-rows';

describe('groupRollup', () => {
  it('sums current + preview and flags changed when any member crosses 0.005', () => {
    const rows = [row({ card_id: 'a', currentPct: 10 }), row({ card_id: 'b', currentPct: 20 })];
    const preview = new Map([
      ['a', 10],
      ['b', 25],
    ]);
    const r = groupRollup(rows, preview);
    expect(r.count).toBe(2);
    expect(r.currentPct).toBe(30);
    expect(r.previewPct).toBe(35);
    expect(r.changed).toBe(true);
  });

  it('is not changed when every member delta is below 0.005', () => {
    const r = groupRollup([row({ card_id: 'a', currentPct: 10 })], new Map([['a', 10.001]]));
    expect(r.changed).toBe(false);
  });

  it('reports null stock when any member is untracked, else the sum', () => {
    expect(groupRollup([row({ stock: 5 }), row({ stock: 3 })], new Map()).stock).toBe(8);
    expect(groupRollup([row({ stock: null }), row({ stock: 3 })], new Map()).stock).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `corepack yarn workspace @acme/admin exec vitest run src/lib/group-rows.test.ts`
Expected: FAIL — `groupRollup` is not exported.

- [ ] **Step 3: Implement `groupRollup` (append to `group-rows.ts`)**

```ts
// Per-group rollup for the header row. previewByCard is the editor's existing
// computeOdds preview map. `changed` mirrors the per-row highlight test
// (|preview - current| >= 0.005) OR'd across members, so the group highlights
// iff a visible member row does. `stock` is null when ANY member is untracked
// (matches the per-row null=untracked convention), else the sum.
export type GroupRollup = {
  count: number;
  currentPct: number;
  previewPct: number;
  changed: boolean;
  stock: number | null;
};

export function groupRollup(
  rows: EditRow[],
  previewByCard: Map<string, number>,
): GroupRollup {
  let currentPct = 0;
  let previewPct = 0;
  let changed = false;
  let untracked = false;
  let stockSum = 0;
  for (const r of rows) {
    const preview = previewByCard.get(r.card_id) ?? 0;
    currentPct += r.currentPct;
    previewPct += preview;
    if (Math.abs(preview - r.currentPct) >= 0.005) changed = true;
    if (r.stock === null) untracked = true;
    else stockSum += r.stock;
  }
  return { count: rows.length, currentPct, previewPct, changed, stock: untracked ? null : stockSum };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `corepack yarn workspace @acme/admin exec vitest run src/lib/group-rows.test.ts`
Expected: PASS (6 tests total).

- [ ] **Step 5: Commit**

```bash
git add backend/apps/admin/src/lib/group-rows.ts backend/apps/admin/src/lib/group-rows.test.ts
git commit -m "feat(admin): add groupRollup for per-Pokemon win-rate/stock rollups

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Render grouped, collapsible rows in the editor + i18n

**Files:**
- Modify: `backend/apps/admin/src/routes/packs/[slug]/page.tsx`
- Modify: `backend/apps/admin/src/i18n/en.json`

**Interfaces:**
- Consumes: `groupRowsByPokemon`, `groupRollup` (Tasks 2-3); existing `rows`, `previewByCard`, `setRow`, `toggleLock`, `fmtPct`, `clx`, `t`.
- Produces: no new exports (presentational). The per-card row JSX, handlers, and save path are reused verbatim.

> Presentational task — no unit test. Verified by type-check + manual smoke on the running admin (`:7000`, HMR live).

- [ ] **Step 1: Add the i18n keys**

In `backend/apps/admin/src/i18n/en.json`, inside the `packs.editor` object (after the `"buybackOnly"` line at ~line 86), add a trailing comma to `"buybackOnly"` and append:
```json
      "buybackOnly": "0 in stock · buyback-only",
      "group": {
        "other": "Other / Ungrouped",
        "count": "{{count}} cards",
        "current": "Now",
        "preview": "After save",
        "stock": "Stock",
        "untracked": "untracked",
        "expandAll": "Expand all",
        "collapseAll": "Collapse all"
      }
```

- [ ] **Step 2: Update imports in `page.tsx`**

Change line 1 from:
```tsx
import { useMemo, useState } from 'react';
```
to:
```tsx
import { Fragment, useMemo, useState } from 'react';
```
And after the existing `odds-rows` import block (ends ~line 33), add:
```tsx
import { groupRowsByPokemon, groupRollup } from '../../../lib/group-rows';
```

- [ ] **Step 3: Derive groups + add collapse state**

Immediately after the `previewByCard` `useMemo` block (ends ~line 107), add:
```tsx
  const groups = useMemo(() => groupRowsByPokemon(rows ?? []), [rows]);

  // Collapse is view-only UI state keyed by stable group key — never touches
  // `rows` or the save buffer. Empty set ⇒ all expanded; a new group key
  // (absent after a reseed) defaults to expanded automatically.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(groups.map((g) => g.key)));
```

- [ ] **Step 4: Add expand/collapse-all controls to the header actions**

Replace the single `Manage cards` button (the `<Button … onClick={openPool}>` block, ~lines 189-196) with:
```tsx
        <div className="flex items-center gap-2">
          <Button
            size="small"
            variant="transparent"
            onClick={expandAll}
            disabled={rows === null}
          >
            {t('packs.editor.group.expandAll')}
          </Button>
          <Button
            size="small"
            variant="transparent"
            onClick={collapseAll}
            disabled={rows === null}
          >
            {t('packs.editor.group.collapseAll')}
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={openPool}
            disabled={rows === null}
          >
            {t('packs.pool.manage')}
          </Button>
        </div>
```

- [ ] **Step 5: Replace the `<Table.Body>` contents with grouped rendering**

Replace the entire `<Table.Body>…</Table.Body>` block (~lines 225-308) with the following. The per-card `<Table.Row>` (image → rarity → value → current → lock → win rate → result) is **identical to the current code** — only the wrapping changes:
```tsx
            <Table.Body>
              {groups.map((g) => {
                const rollup = groupRollup(g.rows, previewByCard);
                const isCollapsed = collapsed.has(g.key);
                return (
                  <Fragment key={g.key}>
                    <Table.Row className="bg-ui-bg-subtle">
                      <Table.HeaderCell colSpan={7}>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleGroup(g.key)}
                            className="text-ui-fg-subtle hover:text-ui-fg-base"
                            aria-label={g.key}
                          >
                            {isCollapsed ? '▸' : '▾'}
                          </button>
                          <span className="font-medium">
                            {g.pokemon
                              ? g.pokemon.name
                              : t('packs.editor.group.other')}
                          </span>
                          {g.pokemon && (
                            <span className="text-ui-fg-subtle text-xs tabular-nums">
                              #{g.pokemon.dex}
                            </span>
                          )}
                          <span className="text-ui-fg-subtle text-xs">
                            {t('packs.editor.group.count', { count: rollup.count })}
                          </span>
                          <span className="text-ui-fg-subtle ml-auto text-xs tabular-nums">
                            {t('packs.editor.group.current')}: {fmtPct(rollup.currentPct)}
                          </span>
                          <span
                            className={clx(
                              'text-xs tabular-nums',
                              rollup.changed
                                ? 'text-ui-fg-base font-medium'
                                : 'text-ui-fg-subtle',
                            )}
                          >
                            {t('packs.editor.group.preview')}: {fmtPct(rollup.previewPct)}
                          </span>
                          <span className="text-ui-fg-subtle text-xs tabular-nums">
                            {t('packs.editor.group.stock')}:{' '}
                            {rollup.stock === null
                              ? t('packs.editor.group.untracked')
                              : rollup.stock}
                          </span>
                        </div>
                      </Table.HeaderCell>
                    </Table.Row>
                    {!isCollapsed &&
                      g.rows.map((r) => {
                        const preview = previewByCard.get(r.card_id) ?? 0;
                        const changed = Math.abs(preview - r.currentPct) >= 0.005;
                        return (
                          <Table.Row key={r.card_id}>
                            <Table.Cell>
                              <div className="flex items-center gap-3">
                                <img
                                  src={resolveImageUrl(r.image)}
                                  alt=""
                                  className="h-10 w-8 shrink-0 rounded object-contain"
                                />
                                <div className="flex flex-col">
                                  <span className="max-w-[18rem] truncate">
                                    {r.name}
                                  </span>
                                  {r.stock === 0 && (
                                    <span className="text-ui-tag-orange-text text-xs">
                                      {t('packs.editor.buybackOnly')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </Table.Cell>
                            <Table.Cell>
                              <Select
                                size="small"
                                value={r.rarity}
                                onValueChange={(v) => setRow(r.card_id, { rarity: v })}
                              >
                                <Select.Trigger className="w-32">
                                  <Select.Value />
                                </Select.Trigger>
                                <Select.Content>
                                  {RARITIES.map((rarity) => (
                                    <Select.Item key={rarity} value={rarity}>
                                      {rarity}
                                    </Select.Item>
                                  ))}
                                </Select.Content>
                              </Select>
                            </Table.Cell>
                            <Table.Cell className="text-ui-fg-subtle text-right tabular-nums">
                              {usd(r.market_value)}
                            </Table.Cell>
                            <Table.Cell className="text-ui-fg-subtle text-right tabular-nums">
                              {fmtPct(r.currentPct)}
                            </Table.Cell>
                            <Table.Cell className="text-center">
                              <Switch
                                checked={r.locked}
                                onCheckedChange={() => toggleLock(r)}
                              />
                            </Table.Cell>
                            <Table.Cell>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step={0.01}
                                disabled={!r.locked}
                                value={r.locked ? r.pctInput : ''}
                                placeholder={r.locked ? '' : 'auto'}
                                onChange={(e) =>
                                  setRow(r.card_id, { pctInput: e.target.value })
                                }
                                className="w-24 tabular-nums"
                              />
                            </Table.Cell>
                            <Table.Cell
                              className={clx(
                                'text-right tabular-nums',
                                changed
                                  ? 'text-ui-fg-base font-medium'
                                  : 'text-ui-fg-subtle',
                              )}
                            >
                              {fmtPct(preview)}
                            </Table.Cell>
                          </Table.Row>
                        );
                      })}
                  </Fragment>
                );
              })}
            </Table.Body>
```

- [ ] **Step 6: Type-check + lint the admin**

Run: `corepack yarn workspace @acme/admin exec tsc -b`
Expected: exit 0 (no type errors — confirms `colSpan` on `Table.HeaderCell`, `Fragment` key, helper types all resolve).
Run: `corepack yarn workspace @acme/admin lint`
Expected: no new errors (the 5 pre-existing config-export lint errors noted in repo memory are not regressions).

- [ ] **Step 7: Manual smoke on the running admin (`:7000`)**

Open `http://localhost:7000/dashboard/packs/pokemon-mythic`. Confirm:
1. Rows render under Pokémon group headers in dex order; non-Pokémon cards under "Other / Ungrouped" last.
2. The `▸/▾` toggle collapses/expands a group; "Expand all"/"Collapse all" work.
3. Each header shows count, `Now` (Σ current), `After save` (Σ preview), `Stock`.
4. Editing a row's rarity/lock/win-rate updates that group's `After save` rollup live and highlights it.
5. **Save** then reload → values persist exactly as before (grouping changed nothing about the saved odds).

- [ ] **Step 8: Commit**

```bash
git add "backend/apps/admin/src/routes/packs/[slug]/page.tsx" backend/apps/admin/src/i18n/en.json
git commit -m "feat(admin): group pack odds editor rows by Pokemon with rollups

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Verification sweep + save-path parity

**Files:** none (verification only).

- [ ] **Step 1: Run the full helper + package test suites**

Run: `corepack yarn workspace @acme/pokemon test`
Run: `corepack yarn workspace @acme/admin test`
Expected: all PASS (package: 5; admin: existing `odds-rows`/`format` tests + 6 new `group-rows` tests).

- [ ] **Step 2: Confirm the backend is untouched**

Run: `git diff --name-only master...HEAD`
Expected: only files under `backend/packages/pokemon/`, `backend/apps/admin/src/lib/group-rows*`, `backend/apps/admin/src/routes/packs/[slug]/page.tsx`, `backend/apps/admin/src/i18n/en.json`, `backend/apps/admin/package.json`, `backend/yarn.lock`, and the `docs/superpowers/**` spec+plan. **No `backend/packages/api/**` and no `backend/apps/admin/vite.config.ts`.**

- [ ] **Step 3: Save-path parity (manual, on `:7000` + backend `:9000`)**

On a test pack, with no edits, click **Save** and confirm the network POST body to `/admin/packs/<slug>/odds` is `{ entries: [{card_id, locked, pct, rarity}, …] }` — same shape/fields as before this feature, no grouping fields. Reload; odds unchanged.

- [ ] **Step 4: Build gate (heavier — before merge)**

Run: `corepack yarn workspace @acme/admin build`
Expected: `tsc -b && vite build` succeeds (proves source-based `@acme/pokemon` bundles in the production Vite build with no `vite.config.ts` edit — the spec §9 primary path holds).

---

## Self-Review

**1. Spec coverage:**
- §4.1 `@acme/pokemon` source-based package → Task 1 ✓
- §4.2 `groupRowsByPokemon` (dex-asc, Other-last, order-preserving) → Task 2 ✓
- §4.4 rollups (count, current, preview, highlight=any-member, stock null-untracked) → Task 3 + Task 4 ✓
- §4.3 groups via `useMemo([rows])`, view-only collapse state → Task 4 Steps 3-4 ✓
- §4.4 interleaved `<Table.HeaderCell colSpan>` + i18n `packs.editor.group.*` → Task 4 ✓
- §3 backend-untouched + save-path parity → Task 5 Steps 2-3 ✓
- §9 resolution gate (no vite edit) → Task 2 note + Task 5 Step 4 ✓

**2. Placeholder scan:** none. The only "verbatim copy" (POKEDEX_NAMES) names its exact source file + a contract (`dex=index+1`); all code is shown.

**3. Type consistency:** `PokemonGroup`/`CardPokemon`/`GroupRollup`/`EditRow` names match across Tasks 1-4; `groupRowsByPokemon`/`groupRollup` signatures consistent between definition (Tasks 2-3) and use (Task 4); `previewByCard: Map<string, number>` matches the editor's existing map.

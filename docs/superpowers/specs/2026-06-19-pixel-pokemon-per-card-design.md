# Spec — Pixel Pokémon per card (1:1)

**Date:** 2026-06-19 · **Branch:** `worktree-feat+pixel-pokemon-per-card` (off `master` @ `6aa4cca`, which now includes the immersive slot-v2 Phase B reel) · **Status:** design approved, awaiting spec review

## 1. Goal

Each gacha **card** is represented by exactly **one pixel-art Pokémon** (a 1:1 avatar). An admin can assign which Pokémon a card shows and optionally upload a custom pixel sprite for it; the immersive slot reel then displays that Pokémon. Win-rate and the draw are unchanged (per-card).

This **supersedes** the earlier "Pokémon grouping" (PR #16, closed) and "global catalog + per-slot assignment" ideas — neither is built. The model is now strictly 1:1: a Pokémon is the card's avatar, not a grouping of many cards.

## 2. Locked decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Cardinality | **1:1** — one pixel Pokémon per card. No grouping, no rollups. |
| Win-rate / lock | **Per-card, unchanged.** `roll-pack` flat draw untouched. |
| Data model | **Fields on the `Card` model** — `pokemon_dex` + `sprite_image`. No catalog table, no `PackOdds` change, no new entity. |
| Species reuse | **Allowed** — two cards may both be "Darkrai". No uniqueness constraint. |
| Resolution | Explicit fields win; **name-derivation (`pokemonFromCard`) is the graceful fallback** (existing cards keep working, no backfill). |
| Baseline | **master @ 6aa4cca** — includes the immersive Phase B vertical reel (`SlotReelStack`/`SlotReelColumn`). The reel-switch targets these. |
| Scope | **One unified spec + plan** covering backend + admin + storefront reel. |
| Rebrand (Pack→Slot) | **Out of scope** — separate task later. |

## 3. The single resolution rule

Used everywhere a card's Pokémon is shown (admin preview, storefront reel, card/vault views):

```
dex   = card.pokemon_dex ?? pokemonFromCard(card.name)?.dex ?? null
name  = (dex from card.pokemon_dex ? POKEDEX_NAMES[dex-1] : pokemonFromCard(card.name)?.name) ?? null
sprite = card.sprite_image            // custom override (uploaded pixel art)
      ?? (dex != null ? spriteGif(dex) : null)   // dex default (PokeAPI showdown gif)
      ?? null                          // no sprite → existing card-image fallback
```

- **Explicit `pokemon_dex` wins** over name-derivation → fixes the "Other" cases (Shaymin/Mimikyu) by assigning the dex.
- **`sprite_image` (custom upload) wins** over the dex gif.
- **`pokemonFromCard(name)` stays only as a fallback** when `pokemon_dex` is null → existing cards render exactly as today (no backfill required).

## 4. Architecture

### 4.1 `@acme/pokemon` shared package (recreate)
Recreate the small backend-monorepo package (it was on the now-closed #16 branch). `backend/packages/pokemon`, source-based (`main`/`types` → `./src/index.ts`, no dist/build — admin-only consumer). Exports:
- `pokemonFromCard(name): CardPokemon | null` (verbatim from `src/lib/pokemon-from-card.ts`)
- `POKEDEX_NAMES: string[]` (verbatim from `src/lib/mock/pokedex-names.ts`, dex = index+1)
- `type CardPokemon = { dex: number; name: string }`
- `spriteGif(dex): string`, `spritePng(dex): string` (verbatim from `src/lib/mock/pokedex.ts` — the PokeAPI showdown gif / static png URLs)

Used by the admin (dex picker name+sprite, fallback resolution). The storefront keeps its own copies (separate workspace).

### 4.2 Backend — `Card` model + exposure
- **`Card` model** (`backend/packages/api/src/modules/packs/models/card.ts`): add `pokemon_dex` (number, **nullable**) + `sprite_image` (text, **nullable**). Migration (additive). No other model changes; `PackOdds`/`roll-pack`/`@acme/odds-math` untouched.
- **Admin card API** (register + edit) accepts/returns `pokemon_dex` + `sprite_image`.
- **Store exposure** so the reel can resolve the sprite without the card name guess: the won-card payloads carry the fields — `roll-pack`'s `RolledCard`, the open/pull store routes, and the pack-detail/recent-pulls store routes add `pokemon_dex` + `sprite_image`.

### 4.3 Admin UI — per-card assignment
In the Gacha Cards flow (`cards/RegisterCardModal.tsx` + the card edit path):
- A **Pokémon dex picker**: searchable over `POKEDEX_NAMES`, shows the sprite preview (`spriteGif(dex)`), **defaults to the name-derived suggestion** (`pokemonFromCard(card.name)`), editable/clearable.
- A **custom sprite upload** via the existing media pipeline (`POST /admin/media`, validated) → stores the URL on `sprite_image`. Clearing it falls back to the dex gif.
- Follows `medusa-ui-conformance` / `@medusajs/ui`.

### 4.4 Storefront — reel switch
The immersive Phase B reel renders a `ColumnWinner { dex, image, name, tier }` per column (`SlotReelStack`/`SlotReelColumn`). Today the winner's `dex`/`image` are derived from the card name. Switch the source to the **resolution rule (§3)**: prefer `card.pokemon_dex`/`card.sprite_image` (now in the store payload), fall back to `pokemonFromCard(card.name)`. The reel components themselves don't change — only the data that feeds `ColumnWinner`:
- `src/lib/data/packs.ts` (+ schemas) carry `pokemon_dex`/`sprite_image` through from the store routes.
- The slot data path that builds the winner uses the rule (custom sprite → dex gif → name fallback).

## 5. Out of scope
- Pokémon grouping / rollups (retired).
- Catalog table, per-slot assignment, two-level draw.
- Pack → Slot rebrand (separate task).
- Backfilling existing cards' `pokemon_dex` (name fallback covers them; admins set dex as they curate).

## 6. Testing & verification
- **Unit — `@acme/pokemon`:** `pokemonFromCard` match/null/longest-first; `spriteGif`/`spritePng` URL shape.
- **Unit — resolution rule:** a pure `resolveCardPokemon(card)` helper (admin side) — custom sprite wins; `pokemon_dex` wins over name; name fallback; null when nothing resolves. (Storefront mirrors the rule; covered by its own unit + the Playwright slot QA.)
- **Backend:** migration applies additively; admin register/edit round-trips `pokemon_dex`/`sprite_image`; store routes + `RolledCard` include the fields; `roll-pack` unchanged (draw unaffected — integration/manual).
- **Storefront (Playwright):** the immersive reel shows a card's assigned sprite (explicit dex/custom over name), via the existing `scripts/*.mjs` slot QA.
- **Manual:** admin assigns a dex + uploads a sprite to a card → it shows on the reel + card view.

## 7. File-by-file (high level — exact in the plan)
**New:** `backend/packages/pokemon/*` (package + tests); admin dex-picker + sprite-upload UI; a resolution helper + tests.
**Edited:** `Card` model (+migration); admin card API (register/edit) + `RegisterCardModal.tsx` + card edit; store routes (open/pull, pack-detail, recent-pulls) + `roll-pack` RolledCard; `src/lib/data/packs.ts` (+schemas) + the slot winner-building path.
**Untouched:** `PackOdds`, `roll-pack` draw logic, `@acme/odds-math`, the odds editor, the Phase B reel components themselves.

## 8. Risks
- **Store-payload reach:** exposing `pokemon_dex`/`sprite_image` touches several store routes + the storefront data types — additive, but verify each consumer compiles + the reel still renders for unassigned cards (name fallback).
- **Sprite upload:** reuses the proven media pipeline; validate the URL is stored + the reel/admin prefer it.
- **`@acme/pokemon` re-create:** small package off the closed #16 branch; recreate from the known content (verbatim source copies). Source-based, so no build/vite wiring (verified on #16).
- **Dex-data duplication:** dex list/sprite helpers exist in both the storefront and `@acme/pokemon` (static data; note in the package header).

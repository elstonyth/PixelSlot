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

export function resolveCardPokemon(
  card: CardPokemonInput,
): ResolvedCardPokemon {
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

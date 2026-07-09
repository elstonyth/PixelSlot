import { POKEDEX_NAMES } from './pokedex-names';

export type Pokemon = { dex: number; name: string };

export const REGION: Record<string, string> = {
  '1': 'Kanto',
  '2': 'Johto',
  '3': 'Hoenn',
  '4': 'Sinnoh',
  '5': 'Unova',
  '6': 'Kalos',
  '7': 'Alola',
  '8': 'Galar',
  '9': 'Paldea',
};

// National-dex range per generation.
const RANGES: Record<string, [number, number]> = {
  '1': [1, 151],
  '2': [152, 251],
  '3': [252, 386],
  '4': [387, 493],
  '5': [494, 649],
  '6': [650, 721],
  '7': [722, 809],
  '8': [810, 905],
  '9': [906, 1025],
};

export const GENS = Object.keys(RANGES);

export function getGeneration(gen: string): Pokemon[] {
  const r = RANGES[gen];
  if (!r) return [];
  const out: Pokemon[] = [];
  for (let dex = r[0]; dex <= r[1] && dex <= POKEDEX_NAMES.length; dex++) {
    out.push({ dex, name: POKEDEX_NAMES[dex - 1] });
  }
  return out;
}

// Animated "showdown" sprite (matches the live site); static png is the fallback.
// PokeAPI/sprites via jsDelivr's CDN — raw.githubusercontent.com rate-limits
// (429) and intermittently blocks (000) sprite requests; jsDelivr mirrors the
// same repo+ref with no rate limit. Keep in sync with src/lib/mock/pokedex.ts.
const SPRITE_BASE =
  'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon';
export const spriteGif = (dex: number) =>
  `${SPRITE_BASE}/other/showdown/${dex}.gif`;
export const spritePng = (dex: number) => `${SPRITE_BASE}/${dex}.png`;

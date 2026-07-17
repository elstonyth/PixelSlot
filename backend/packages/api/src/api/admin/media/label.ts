// Pure graded-slab label logic (spec 2026-07-16-graded-slab-dynamic-label §6/§8).
// No I/O here — the SVG renderer and layout join this module in a later task.

// PSA's canonical 11-point grade scale. Qualifier half-grades (2.5–9.5) are
// deliberately excluded (operator decision 2026-07-16): the catalog doesn't
// carry them and 9.5 is a PriceCharting price tier, never a PSA grade. 1.5
// stays — it is PSA's base FR grade, not a qualifier.
export const PSA_GRADES = [
  '10',
  '9',
  '8',
  '7',
  '6',
  '5',
  '4',
  '3',
  '2',
  '1.5',
  '1',
] as const;

// Verified against real slabs: PSA 7 → NM, 8 → NM-MT, 9 → MINT, 10 → GEM MT.
const PSA_DESCRIPTORS: Record<string, string> = {
  '10': 'GEM MT',
  '9': 'MINT',
  '8': 'NM-MT',
  '7': 'NM',
  '6': 'EX-MT',
  '5': 'EX',
  '4': 'VG-EX',
  '3': 'VG',
  '2': 'GOOD',
  '1.5': 'FR',
  '1': 'PR',
};

// Null for anything off-scale (legacy rows may hold e.g. 9.5): the grade
// number still prints, but the label must never assert a descriptor PSA
// wouldn't use.
export function psaDescriptor(grade: string): string | null {
  return PSA_DESCRIPTORS[grade.trim()] ?? null;
}

// PriceCharting embeds the card number in product-name ("Pikachu ex #238");
// no separate field exists.
export function parseCardName(product: string): {
  name: string;
  number: string;
} {
  const m = product.trim().match(/^(.*?)\s*#\s*([A-Za-z0-9/-]+)\s*$/);
  if (!m) return { name: product.trim(), number: '' };
  return { name: m[1].trim(), number: `#${m[2]}` };
}

// PSA prints PIKACHU ex, MEGA CHARIZARD X ex, BLASTOISE EX — uppercase every
// token EXCEPT a known suffix token, which is emitted verbatim from the
// source (source casing round-trips both TCG eras with no era table).
const SUFFIX_TOKENS = [
  'ex',
  'GX',
  'V',
  'VMAX',
  'VSTAR',
  'VUNION',
  'BREAK',
  'LV.X',
  'Prime',
  'LEGEND',
  'Star',
  'δ',
];

export function formatCardName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((tok) =>
      SUFFIX_TOKENS.some((s) => s.toLowerCase() === tok.toLowerCase())
        ? tok
        : tok.toUpperCase(),
    )
    .join(' ');
}

// PSA abbreviates sets; PriceCharting does not. Keyed on the normalised PC
// console-name INCLUDING its language marker ("Pokemon Japanese …") — an
// Italian printing must never inherit the English mapping. Values are PSA's
// verbatim printed line (verified against real slabs) and are emitted
// BYTE-IDENTICAL — mixed-case codes like M2a are load-bearing. NEVER derive
// these from ptcgoCode (§7a). A new set needs a new verified entry — the
// accepted maintenance cost of the map over an editable set field. Additional
// verified rows live in docs/research/psa-set-prefill.json (local-only);
// only rows verified against a real slab or PSA's own listing may be added.
const SET_ABBREV: Record<string, string> = {
  'pokemon surging sparks': 'POKEMON SSP EN', // Pikachu ex #238 slab
  'pokemon phantasmal flames': 'POKEMON PFL EN', // Mega Charizard X ex #125 slab
  'pokemon japanese mega dream ex': 'POKEMON M2a JP', // Mega Gengar ex #240 slab
};

// Unknown set → uppercased PC name (accurate, just not PSA's wording).
export function setAbbrev(pcSetName: string): string {
  const key = pcSetName.trim().toLowerCase().replace(/\s+/g, ' ');
  return SET_ABBREV[key] ?? pcSetName.trim().toUpperCase();
}

import {
  PSA_GRADES,
  psaDescriptor,
  parseCardName,
  formatCardName,
  setAbbrev,
} from '../label';

describe('PSA_GRADES', () => {
  it("is exactly PSA's canonical 11-point scale — no qualifier half-grades, 1.5 present", () => {
    expect([...PSA_GRADES]).toEqual([
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
    ]);
  });
});

describe('psaDescriptor', () => {
  it.each([
    ['10', 'GEM MT'],
    ['9', 'MINT'],
    ['8', 'NM-MT'],
    ['7', 'NM'],
    ['6', 'EX-MT'],
    ['5', 'EX'],
    ['4', 'VG-EX'],
    ['3', 'VG'],
    ['2', 'GOOD'],
    ['1.5', 'FR'],
    ['1', 'PR'],
  ])('grade %s → %s', (grade, desc) => {
    expect(psaDescriptor(grade)).toBe(desc);
  });

  it.each([
    ['unknown grade', 'A'],
    ['off-scale legacy 9.5', '9.5'],
    ['off-scale legacy 8.5', '8.5'],
    ['empty', ''],
  ])(
    'renders NO descriptor for %s (never assert a descriptor PSA would not use)',
    (_l, grade) => {
      expect(psaDescriptor(grade)).toBeNull();
    },
  );
});

describe('parseCardName', () => {
  it('splits a trailing #number', () => {
    expect(parseCardName('Pikachu ex #238')).toEqual({
      name: 'Pikachu ex',
      number: '#238',
    });
  });
  it('handles alphanumeric numbers', () => {
    expect(parseCardName('Trainer Card #SV43')).toEqual({
      name: 'Trainer Card',
      number: '#SV43',
    });
  });
  it('handles trailing spaces', () => {
    expect(parseCardName('  Mega Gengar ex #240  ')).toEqual({
      name: 'Mega Gengar ex',
      number: '#240',
    });
  });
  it('returns the whole name and empty number when there is no #', () => {
    expect(parseCardName('Charizard-Holo')).toEqual({
      name: 'Charizard-Holo',
      number: '',
    });
  });
});

describe('formatCardName', () => {
  it('uppercases but keeps a modern lowercase suffix verbatim', () => {
    expect(formatCardName('Pikachu ex')).toBe('PIKACHU ex');
  });
  it('keeps an old-era uppercase suffix verbatim', () => {
    expect(formatCardName('Blastoise EX')).toBe('BLASTOISE EX');
  });
  it('uppercases hyphenated names plainly', () => {
    expect(formatCardName('Charizard-Holo')).toBe('CHARIZARD-HOLO');
  });
  it('does NOT mangle a name merely containing a suffix substring', () => {
    expect(formatCardName('Exeggutor')).toBe('EXEGGUTOR');
  });
  it('handles multi-token names with a suffix', () => {
    expect(formatCardName('Mega Charizard X ex')).toBe('MEGA CHARIZARD X ex');
  });
});

describe('setAbbrev', () => {
  it.each([
    ['Pokemon Surging Sparks', 'POKEMON SSP EN'],
    ['Pokemon Phantasmal Flames', 'POKEMON PFL EN'],
    ['Pokemon Japanese Mega Dream ex', 'POKEMON M2a JP'],
  ])('maps %s → %s (verified against real slabs)', (pc, psa) => {
    expect(setAbbrev(pc)).toBe(psa);
  });

  it('returns a mapped value BYTE-IDENTICAL — mixed-case PSA codes survive', () => {
    // regression guard for PSA's mixed-case set codes: M2a, never M2A (§8)
    expect(setAbbrev('pokemon japanese mega dream ex')).toBe('POKEMON M2a JP');
    expect(setAbbrev('Pokemon Japanese Mega Dream ex')).not.toBe(
      'POKEMON M2A JP',
    );
  });

  it('falls back to the uppercased PC name for an unknown set — never a guessed code', () => {
    expect(setAbbrev('Pokemon Lost Origin')).toBe('POKEMON LOST ORIGIN');
  });
});

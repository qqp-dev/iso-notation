import { JankoRowIndex } from './types';

export interface PhoneticDefinition {
  pitchClass: number; // 0..11
  row: JankoRowIndex; // 0 | 1
  consonant: string;
  vowel: string;
  syllable: string;
  organ: string;
  manner: 'nasal' | 'fricative' | 'liquid' | 'stop' | 'sibilant';
  voiced: boolean;
  notes: string;
}

/**
 * The canonical 12-TET monosyllabic representation for iso-notation.
 * Optimized for Jánko 2-row keyboards, tritone polar opposition,
 * augmented triad voicing coherence, and alternating biomechanical muscle groups.
 *
 * Row 0 (-a): Ma, Va, La, Na, Fa, Sa (Flowing continuants)
 * Row 1 (-i): Di, Pi, Ri, Ti, Bi, Ki (Percussive stops & rolling liquid)
 */
export const CANONICAL_PHONETICS: readonly PhoneticDefinition[] = [
  {
    pitchClass: 0,
    row: 0,
    consonant: 'M',
    vowel: 'a',
    syllable: 'Ma',
    organ: 'Lips (Bilabial)',
    manner: 'nasal',
    voiced: true,
    notes: 'Warm bilabial nasal continuant; grounding root of Whole-Tone Row 0',
  },
  {
    pitchClass: 1,
    row: 1,
    consonant: 'D',
    vowel: 'i',
    syllable: 'Di',
    organ: 'Alveolar Ridge',
    manner: 'stop',
    voiced: true,
    notes: 'Voiced dental/alveolar tap; first element of Voiced Triangle {1, 5, 9}',
  },
  {
    pitchClass: 2,
    row: 0,
    consonant: 'V',
    vowel: 'a',
    syllable: 'Va',
    organ: 'Teeth-Lip (Labiodental)',
    manner: 'fricative',
    voiced: true,
    notes: 'Voiced labiodental fricative; polar tritone twin to Fa (8)',
  },
  {
    pitchClass: 3,
    row: 1,
    consonant: 'P',
    vowel: 'i',
    syllable: 'Pi',
    organ: 'Lips (Bilabial)',
    manner: 'stop',
    voiced: false,
    notes: 'Crisp bilabial voiceless pop; polar tritone twin to Bi (9)',
  },
  {
    pitchClass: 4,
    row: 0,
    consonant: 'L',
    vowel: 'a',
    syllable: 'La',
    organ: 'Alveolar Ridge',
    manner: 'liquid',
    voiced: true,
    notes: 'Lateral alveolar liquid; polar tritone twin to Sa (10)',
  },
  {
    pitchClass: 5,
    row: 1,
    consonant: 'R',
    vowel: 'i',
    syllable: 'Ri',
    organ: 'Mid-Palate',
    manner: 'liquid',
    voiced: true,
    notes: 'Mid-palatal retroflex liquid; polar tritone twin to Ki (11)',
  },
  {
    pitchClass: 6,
    row: 0,
    consonant: 'N',
    vowel: 'a',
    syllable: 'Na',
    organ: 'Alveolar Ridge',
    manner: 'nasal',
    voiced: true,
    notes: 'Alveolar nasal continuant resonance; polar tritone twin to Ma (0)',
  },
  {
    pitchClass: 7,
    row: 1,
    consonant: 'T',
    vowel: 'i',
    syllable: 'Ti',
    organ: 'Alveolar Ridge',
    manner: 'stop',
    voiced: false,
    notes: 'Voiceless dental strike; polar tritone twin to Di (1)',
  },
  {
    pitchClass: 8,
    row: 0,
    consonant: 'F',
    vowel: 'a',
    syllable: 'Fa',
    organ: 'Teeth-Lip (Labiodental)',
    manner: 'fricative',
    voiced: false,
    notes: 'Voiceless labiodental breath; polar tritone twin to Va (2)',
  },
  {
    pitchClass: 9,
    row: 1,
    consonant: 'B',
    vowel: 'i',
    syllable: 'Bi',
    organ: 'Lips (Bilabial)',
    manner: 'stop',
    voiced: true,
    notes: 'Voiced bilabial burst; polar tritone twin to Pi (3)',
  },
  {
    pitchClass: 10,
    row: 0,
    consonant: 'S',
    vowel: 'a',
    syllable: 'Sa',
    organ: 'Teeth/Alveolar Ridge',
    manner: 'sibilant',
    voiced: false,
    notes: 'Voiceless alveolar sibilant hiss; polar tritone twin to La (4)',
  },
  {
    pitchClass: 11,
    row: 1,
    consonant: 'K',
    vowel: 'i',
    syllable: 'Ki',
    organ: 'Soft Palate / Velum',
    manner: 'stop',
    voiced: false,
    notes: 'Voiceless velar click; polar tritone twin to Ri (5)',
  },
] as const;

/**
 * Tritone twin pairs (separated by exactly 6 semitones).
 */
export const TRITONE_TWIN_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 6],   // Ma <-> Na
  [1, 7],   // Di <-> Ti
  [2, 8],   // Va <-> Fa
  [3, 9],   // Pi <-> Bi
  [4, 10],  // La <-> Sa
  [5, 11],  // Ri <-> Ki
];

/**
 * Augmented triad major thirds on Row 1 partitioned cleanly by voicing.
 */
export const ROW1_AUGMENTED_TRIANGLES = {
  voiced: [1, 5, 9] as const,     // Di - Ri - Bi
  voiceless: [3, 7, 11] as const,  // Pi - Ti - Ki
} as const;

/**
 * Returns the canonical phonetic definition for any pitch class.
 */
export function getCanonicalPhonetic(pitchClass: number): PhoneticDefinition {
  const pc = ((pitchClass % 12) + 12) % 12;
  return CANONICAL_PHONETICS[pc];
}

/**
 * Returns the monosyllabic token for a pitch class (e.g. 0 -> "Ma", 7 -> "Ti").
 */
export function getCanonicalSyllable(pitchClass: number): string {
  const pc = ((pitchClass % 12) + 12) % 12;
  return CANONICAL_PHONETICS[pc].syllable;
}

/**
 * Converts an array of pitch classes (or numbers) into a sequence of syllables.
 */
export function solfegeSequence(pitches: readonly number[]): string[] {
  return pitches.map((p) => getCanonicalSyllable(p));
}

/**
 * Formats a melody/passage as a hyphen-delimited solfege string (e.g. "Ti-Na-Ti-Va").
 */
export function solfegeString(pitches: readonly number[], delimiter: string = '-'): string {
  return solfegeSequence(pitches).join(delimiter);
}

/**
 * Reverse lookup: maps a syllable string (case-insensitive) back to its pitch class.
 */
export function pitchClassFromSyllable(syllable: string): number | undefined {
  const normalized = syllable.trim().toLowerCase();
  const entry = CANONICAL_PHONETICS.find((e) => e.syllable.toLowerCase() === normalized);
  return entry ? entry.pitchClass : undefined;
}

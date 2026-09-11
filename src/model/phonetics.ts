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
 * Row 0 (-a): ma, va, la, na, fa, sa (Flowing continuants)
 * Row 1 (-i): di, pi, ri, ti, bi, ki (Percussive stops & rolling liquid)
 */
export const CANONICAL_PHONETICS: readonly PhoneticDefinition[] = [
  {
    pitchClass: 0,
    row: 0,
    consonant: 'm',
    vowel: 'a',
    syllable: 'ma',
    organ: 'Lips (Bilabial)',
    manner: 'nasal',
    voiced: true,
    notes: 'Warm bilabial nasal continuant; grounding root of Whole-Tone Row 0',
  },
  {
    pitchClass: 1,
    row: 1,
    consonant: 'd',
    vowel: 'i',
    syllable: 'di',
    organ: 'Alveolar Ridge',
    manner: 'stop',
    voiced: true,
    notes: 'Voiced dental/alveolar tap; first element of Voiced Triangle {1, 5, 9}',
  },
  {
    pitchClass: 2,
    row: 0,
    consonant: 'v',
    vowel: 'a',
    syllable: 'va',
    organ: 'Teeth-Lip (Labiodental)',
    manner: 'fricative',
    voiced: true,
    notes: 'Voiced labiodental fricative; polar tritone twin to fa (8)',
  },
  {
    pitchClass: 3,
    row: 1,
    consonant: 'p',
    vowel: 'i',
    syllable: 'pi',
    organ: 'Lips (Bilabial)',
    manner: 'stop',
    voiced: false,
    notes: 'Crisp bilabial voiceless pop; polar tritone twin to bi (9)',
  },
  {
    pitchClass: 4,
    row: 0,
    consonant: 'l',
    vowel: 'a',
    syllable: 'la',
    organ: 'Alveolar Ridge',
    manner: 'liquid',
    voiced: true,
    notes: 'Lateral alveolar liquid; polar tritone twin to sa (10)',
  },
  {
    pitchClass: 5,
    row: 1,
    consonant: 'r',
    vowel: 'i',
    syllable: 'ri',
    organ: 'Mid-Palate',
    manner: 'liquid',
    voiced: true,
    notes: 'Mid-palatal retroflex liquid; polar tritone twin to ki (11)',
  },
  {
    pitchClass: 6,
    row: 0,
    consonant: 'n',
    vowel: 'a',
    syllable: 'na',
    organ: 'Alveolar Ridge',
    manner: 'nasal',
    voiced: true,
    notes: 'Alveolar nasal continuant resonance; polar tritone twin to ma (0)',
  },
  {
    pitchClass: 7,
    row: 1,
    consonant: 't',
    vowel: 'i',
    syllable: 'ti',
    organ: 'Alveolar Ridge',
    manner: 'stop',
    voiced: false,
    notes: 'Voiceless dental strike; polar tritone twin to di (1)',
  },
  {
    pitchClass: 8,
    row: 0,
    consonant: 'f',
    vowel: 'a',
    syllable: 'fa',
    organ: 'Teeth-Lip (Labiodental)',
    manner: 'fricative',
    voiced: false,
    notes: 'Voiceless labiodental breath; polar tritone twin to va (2)',
  },
  {
    pitchClass: 9,
    row: 1,
    consonant: 'b',
    vowel: 'i',
    syllable: 'bi',
    organ: 'Lips (Bilabial)',
    manner: 'stop',
    voiced: true,
    notes: 'Voiced bilabial burst; polar tritone twin to pi (3)',
  },
  {
    pitchClass: 10,
    row: 0,
    consonant: 's',
    vowel: 'a',
    syllable: 'sa',
    organ: 'Teeth/Alveolar Ridge',
    manner: 'sibilant',
    voiced: false,
    notes: 'Voiceless alveolar sibilant hiss; polar tritone twin to la (4)',
  },
  {
    pitchClass: 11,
    row: 1,
    consonant: 'k',
    vowel: 'i',
    syllable: 'ki',
    organ: 'Soft Palate / Velum',
    manner: 'stop',
    voiced: false,
    notes: 'Voiceless velar click; polar tritone twin to ri (5)',
  },
] as const;

/**
 * Tritone twin pairs (separated by exactly 6 semitones).
 */
export const TRITONE_TWIN_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 6],   // ma <-> na
  [1, 7],   // di <-> ti
  [2, 8],   // va <-> fa
  [3, 9],   // pi <-> bi
  [4, 10],  // la <-> sa
  [5, 11],  // ri <-> ki
];

/**
 * Augmented triad major thirds on Row 1 partitioned cleanly by voicing.
 */
export const ROW1_AUGMENTED_TRIANGLES = {
  voiced: [1, 5, 9] as const,     // di - ri - bi
  voiceless: [3, 7, 11] as const,  // pi - ti - ki
} as const;

/**
 * Returns the canonical phonetic definition for any pitch class.
 */
export function getCanonicalPhonetic(pitchClass: number): PhoneticDefinition {
  const pc = ((pitchClass % 12) + 12) % 12;
  return CANONICAL_PHONETICS[pc];
}

/**
 * Returns the monosyllabic token for a pitch class (e.g. 0 -> "ma", 7 -> "ti").
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
 * Formats a melody/passage as a hyphen-delimited solfege string (e.g. "ti-na-ti-va").
 */
export function solfegeString(pitches: readonly number[], delimiter: string = '-'): string {
  return solfegeSequence(pitches).join(delimiter);
}

/**
 * Reverse lookup: maps a syllable string or consonant (case-insensitive) back to its pitch class.
 */
export function pitchClassFromSyllable(syllable: string): number | undefined {
  const normalized = syllable.trim().toLowerCase();
  const entry = CANONICAL_PHONETICS.find(
    (e) => e.syllable === normalized || e.consonant === normalized
  );
  return entry ? entry.pitchClass : undefined;
}

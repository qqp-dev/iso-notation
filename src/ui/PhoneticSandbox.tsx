import React, { useState, useEffect, useRef, useMemo } from 'react';
import { synth } from '../audio/synth';

export interface PhoneticEntry {
  pitchClass: number; // 0..11
  row: 0 | 1;
  consonant: string;
  vowel: string;
  syllable: string;
  anatomicalRegion: string;
}

export interface AlternativePreset {
  id: string;
  shortName: string;
  fullName: string;
  tagline: string;
  sequencePreview: string;
  justifications: string[];
  entries: PhoneticEntry[];
}

export const ALTERNATIVES: Record<string, AlternativePreset> = {
  'alt-optimal-symmetry': {
    id: 'alt-optimal-symmetry',
    shortName: 'Prime: 92% Optimal',
    fullName: 'Prime Candidate: Optimal Structural Order (Tritone Twins + Augmented Triads)',
    tagline: '100% Tritone Twins · 100% Row 1 Voiced/Voiceless Triangles · 91.7% Semitone Diversity · 91.7% Fifths Fluency',
    sequencePreview: 'ma → di → va → pi → la → ri → na → ti → fa → bi → sa → ki',
    justifications: [
      '100% Tritone Twin Pairing (±6): Maximally separates acoustic cousins half an octave apart: ma↔na (nasals), di↔ti (dental stops), va↔fa (labiodental fricatives), pi↔bi (lip pops), la↔sa (ridge flows/hisses), ri↔ki (palatal vs velar).',
      '100% Augmented Triad Voicing (±4): Row 1 major-third triangle {1, 5, 9} is 100% voiced (di-ri-bi); triangle {3, 7, 11} is 100% voiceless (pi-ti-ki). Chord shapes maintain consistent vocal fold vibration state.',
      '91.7% Motor Diversity (±1): 11 of 12 chromatic semitones alternate physical muscle groups. The single ridge transition (na 6 → ti 7) pairs a smooth nasal hum with a crisp percussive release, causing zero tongue tangling.',
      '91.7% Harmonic Fifths Fluency (±7): Circle of Fifths alternates vowels (-a ↔ -i) and leaps smoothly across oral muscle groups with only 1 repeat (na → di).',
      'Jánko Hardware Homomorphism: Row 0 keys (0, 2, 4, 6, 8, 10) rhyme on flowing -a (ma, va, la, na, fa, sa); Row 1 keys (1, 3, 5, 7, 9, 11) rhyme on percussive/rolling -i (di, pi, ri, ti, bi, ki).',
    ],
    entries: [
      { pitchClass: 0, row: 0, consonant: 'm', vowel: 'a', syllable: 'ma', anatomicalRegion: 'Lips (Bilabial nasal flow)' },
      { pitchClass: 1, row: 1, consonant: 'd', vowel: 'i', syllable: 'di', anatomicalRegion: 'Ridge (Alveolar voiced tap)' },
      { pitchClass: 2, row: 0, consonant: 'v', vowel: 'a', syllable: 'va', anatomicalRegion: 'Teeth-Lip (Voiced buzz)' },
      { pitchClass: 3, row: 1, consonant: 'p', vowel: 'i', syllable: 'pi', anatomicalRegion: 'Lips (Bilabial voiceless pop)' },
      { pitchClass: 4, row: 0, consonant: 'l', vowel: 'a', syllable: 'la', anatomicalRegion: 'Ridge (Lateral liquid flow)' },
      { pitchClass: 5, row: 1, consonant: 'r', vowel: 'i', syllable: 'ri', anatomicalRegion: 'Mid-Palate (Retroflex liquid)' },
      { pitchClass: 6, row: 0, consonant: 'n', vowel: 'a', syllable: 'na', anatomicalRegion: 'Ridge (Nasal resonance)' },
      { pitchClass: 7, row: 1, consonant: 't', vowel: 'i', syllable: 'ti', anatomicalRegion: 'Ridge (Alveolar voiceless strike)' },
      { pitchClass: 8, row: 0, consonant: 'f', vowel: 'a', syllable: 'fa', anatomicalRegion: 'Teeth-Lip (Voiceless breath)' },
      { pitchClass: 9, row: 1, consonant: 'b', vowel: 'i', syllable: 'bi', anatomicalRegion: 'Lips (Bilabial voiced burst)' },
      { pitchClass: 10, row: 0, consonant: 's', vowel: 'a', syllable: 'sa', anatomicalRegion: 'Teeth/Ridge (Sibilant hiss)' },
      { pitchClass: 11, row: 1, consonant: 'k', vowel: 'i', syllable: 'ki', anatomicalRegion: 'Soft Palate (Crisp velar click)' },
    ],
  },
  'alt-janko-dual': {
    id: 'alt-janko-dual',
    shortName: 'Alt 1: Inward (a/i)',
    fullName: 'Alt 1-Dual: Inward Flow with Row-Rhyme (-a on Row 0, -i on Row 1)',
    tagline: 'Row 0 = Flowing on -a (Ma,Va,Fa,La,Sa,Na) · Row 1 = Percussive on -i (Bi,Pi,Di,Ti,Ri,Ki)',
    sequencePreview: 'Ma → Bi → Va → Pi → Fa → Di → La → Ti → Sa → Ri → Na → Ki',
    justifications: [
      'Dual-Axis Sensory Encoding: Consonants indicate column position; vowels directly signal the Jánko keyboard row (-a = Row 0, -i = Row 1).',
      'Whole-Tone Row Rhyme: Row 0 keys all rhyme on warm open -a (Ma, Va, Fa, La, Sa, Na); Row 1 keys all rhyme on crisp, bright -i (Bi, Pi, Di, Ti, Ri, Ki).',
      'Maximum Acoustic Contrast: Every adjacent semitone differs in vowel and consonant.',
      'Baroque Coloratura Energy: Reciting running sixteenths (e.g. Ti-Ri-Ki-Bi in Bach m. 1) sounds like virtuosic Italian solfège.',
    ],
    entries: [
      { pitchClass: 0, row: 0, consonant: 'M', vowel: 'a', syllable: 'Ma', anatomicalRegion: 'Lips (Bilabial nasal)' },
      { pitchClass: 1, row: 1, consonant: 'B', vowel: 'i', syllable: 'Bi', anatomicalRegion: 'Lips (Voiced plosive)' },
      { pitchClass: 2, row: 0, consonant: 'V', vowel: 'a', syllable: 'Va', anatomicalRegion: 'Teeth-Lip (Voiced buzz)' },
      { pitchClass: 3, row: 1, consonant: 'P', vowel: 'i', syllable: 'Pi', anatomicalRegion: 'Lips (Voiceless pop)' },
      { pitchClass: 4, row: 0, consonant: 'F', vowel: 'a', syllable: 'Fa', anatomicalRegion: 'Teeth-Lip (Voiceless breath)' },
      { pitchClass: 5, row: 1, consonant: 'D', vowel: 'i', syllable: 'Di', anatomicalRegion: 'Alveolar Ridge (Voiced tap)' },
      { pitchClass: 6, row: 0, consonant: 'L', vowel: 'a', syllable: 'La', anatomicalRegion: 'Ridge (Lateral liquid flow)' },
      { pitchClass: 7, row: 1, consonant: 'T', vowel: 'i', syllable: 'Ti', anatomicalRegion: 'Alveolar Ridge (Crisp strike)' },
      { pitchClass: 8, row: 0, consonant: 'S', vowel: 'a', syllable: 'Sa', anatomicalRegion: 'Teeth/Ridge (Sibilant hiss)' },
      { pitchClass: 9, row: 1, consonant: 'R', vowel: 'i', syllable: 'Ri', anatomicalRegion: 'Mid-Palate (Retroflex liquid)' },
      { pitchClass: 10, row: 0, consonant: 'N', vowel: 'a', syllable: 'Na', anatomicalRegion: 'Alveolar Ridge (Nasal seal)' },
      { pitchClass: 11, row: 1, consonant: 'K', vowel: 'i', syllable: 'Ki', anatomicalRegion: 'Soft Palate (Crisp velar click)' },
    ],
  },
  'alt-janko-flow': {
    id: 'alt-janko-flow',
    shortName: 'Alt 1: All -a',
    fullName: 'Alt 1: Jánko Row-Interleaved (Continuants vs Plosives/Liquids on Uniform -a)',
    tagline: 'Row 0 = Flowing Continuants (M,V,F,L,S,N) · Row 1 = Plosives & Liquids (B,P,D,T,R,K)',
    sequencePreview: 'Ma → Ba → Va → Pa → Fa → Da → La → Ta → Sa → Ra → Na → Ka',
    justifications: [
      'Hardware Homomorphism: Row 0 keys (Evens) are 100% flowing sonorants/fricatives; Row 1 keys (Odds) are 100% percussive plosives and rolling liquid (Ra).',
      'Zero Twin Collision: Voiced/voiceless pairs (Ba/Pa, Da/Ta) are separated across whole-tone steps.',
      'High-Speed Cadence: Strictly alternates Flowing ↔ Percussive motor patterns.',
      'Uniform Vowel: Keeps a single open -a throughout for unified vocal resonance.',
    ],
    entries: [
      { pitchClass: 0, row: 0, consonant: 'M', vowel: 'a', syllable: 'Ma', anatomicalRegion: 'Lips (Bilabial nasal)' },
      { pitchClass: 1, row: 1, consonant: 'B', vowel: 'a', syllable: 'Ba', anatomicalRegion: 'Lips (Voiced plosive)' },
      { pitchClass: 2, row: 0, consonant: 'V', vowel: 'a', syllable: 'Va', anatomicalRegion: 'Teeth-Lip (Voiced buzz)' },
      { pitchClass: 3, row: 1, consonant: 'P', vowel: 'a', syllable: 'Pa', anatomicalRegion: 'Lips (Voiceless pop)' },
      { pitchClass: 4, row: 0, consonant: 'F', vowel: 'a', syllable: 'Fa', anatomicalRegion: 'Teeth-Lip (Voiceless breath)' },
      { pitchClass: 5, row: 1, consonant: 'D', vowel: 'a', syllable: 'Da', anatomicalRegion: 'Alveolar Ridge (Voiced tap)' },
      { pitchClass: 6, row: 0, consonant: 'L', vowel: 'a', syllable: 'La', anatomicalRegion: 'Ridge (Lateral liquid flow)' },
      { pitchClass: 7, row: 1, consonant: 'T', vowel: 'a', syllable: 'Ta', anatomicalRegion: 'Alveolar Ridge (Crisp strike)' },
      { pitchClass: 8, row: 0, consonant: 'S', vowel: 'a', syllable: 'Sa', anatomicalRegion: 'Teeth/Ridge (Sibilant hiss)' },
      { pitchClass: 9, row: 1, consonant: 'R', vowel: 'a', syllable: 'Ra', anatomicalRegion: 'Mid-Palate (Retroflex liquid)' },
      { pitchClass: 10, row: 0, consonant: 'N', vowel: 'a', syllable: 'Na', anatomicalRegion: 'Alveolar Ridge (Nasal seal)' },
      { pitchClass: 11, row: 1, consonant: 'K', vowel: 'a', syllable: 'Ka', anatomicalRegion: 'Soft Palate (Crisp velar click)' },
    ],
  },
  'alt-spatial-fwd': {
    id: 'alt-spatial-fwd',
    shortName: 'Alt 2: Front to Back',
    fullName: 'Alt 2: Pure Spatial Front-to-Back (Lips → Throat)',
    tagline: 'Strictly sorted by physical oral contact point from outer lips to deep throat',
    sequencePreview: 'Ma → Ba → Pa → Va → Fa → Da → Ta → La → Sa → Na → Ra → Ka',
    justifications: [
      'Topological Proximity: Oral contact point moves progressively deeper into the vocal tract as pitch rises (0–2 Lips → 3–4 Teeth → 5–9 Ridge → 10–11 Palate/Velum).',
      'Pitch Height as Depth: Instantly identify a note’s general register within the octave simply by feeling where your mouth articulates it.',
      'Zone Internal Logic: Within each anatomical zone, open nasal resonance leads, followed by voiced bursts, followed by voiceless releases.',
    ],
    entries: [
      { pitchClass: 0, row: 0, consonant: 'M', vowel: 'a', syllable: 'Ma', anatomicalRegion: 'Lips (Bilabial nasal hum)' },
      { pitchClass: 1, row: 1, consonant: 'B', vowel: 'a', syllable: 'Ba', anatomicalRegion: 'Lips (Voiced burst)' },
      { pitchClass: 2, row: 0, consonant: 'P', vowel: 'a', syllable: 'Pa', anatomicalRegion: 'Lips (Voiceless pop)' },
      { pitchClass: 3, row: 1, consonant: 'V', vowel: 'a', syllable: 'Va', anatomicalRegion: 'Teeth-Lip (Voiced buzz)' },
      { pitchClass: 4, row: 0, consonant: 'F', vowel: 'a', syllable: 'Fa', anatomicalRegion: 'Teeth-Lip (Voiceless air)' },
      { pitchClass: 5, row: 1, consonant: 'D', vowel: 'a', syllable: 'Da', anatomicalRegion: 'Ridge (Voiced tongue tap)' },
      { pitchClass: 6, row: 0, consonant: 'T', vowel: 'a', syllable: 'Ta', anatomicalRegion: 'Ridge (Crisp tongue strike)' },
      { pitchClass: 7, row: 1, consonant: 'L', vowel: 'a', syllable: 'La', anatomicalRegion: 'Ridge (Lateral liquid flow)' },
      { pitchClass: 8, row: 0, consonant: 'S', vowel: 'a', syllable: 'Sa', anatomicalRegion: 'Teeth/Ridge (Sibilant hiss)' },
      { pitchClass: 9, row: 1, consonant: 'N', vowel: 'a', syllable: 'Na', anatomicalRegion: 'Ridge (Nasal seal)' },
      { pitchClass: 10, row: 0, consonant: 'R', vowel: 'a', syllable: 'Ra', anatomicalRegion: 'Mid-Palate (Retroflex liquid)' },
      { pitchClass: 11, row: 1, consonant: 'K', vowel: 'a', syllable: 'Ka', anatomicalRegion: 'Soft Palate (Crisp velar click)' },
    ],
  },
  'alt-acoustic-vocal': {
    id: 'alt-acoustic-vocal',
    shortName: 'Alt 3: Throat to Mask',
    fullName: 'Alt 3: Acoustic Vocal Placement (Deep Throat → Forward Mask)',
    tagline: 'Classical singing acoustics: Deep throat/palate low notes → forward lip/teeth high notes',
    sequencePreview: 'Ra → Ka → Da → Ta → Na → La → Sa → Va → Fa → Ba → Pa → Ma',
    justifications: [
      'Acoustic Formant Vector: Low pitches resonate in the palate/velum (Ra, Ka); high pitches project forward into the alveolar ridge, teeth, and lips (Ba, Pa, Ma).',
      'Vocal "Dans le Masque": As pitch ascends, sensation travels forward toward the smile and facial bones, feeling physically expansive.',
      'Focused Octave Climax: Finishes at pitch 11 on Ma, returning to the warm, focused bilabial hum right at the octave boundary.',
    ],
    entries: [
      { pitchClass: 0, row: 0, consonant: 'R', vowel: 'a', syllable: 'Ra', anatomicalRegion: 'Mid-Palate (Retroflex liquid)' },
      { pitchClass: 1, row: 1, consonant: 'K', vowel: 'a', syllable: 'Ka', anatomicalRegion: 'Soft Palate (Crisp velar click)' },
      { pitchClass: 2, row: 0, consonant: 'D', vowel: 'a', syllable: 'Da', anatomicalRegion: 'Ridge (Voiced tongue tap)' },
      { pitchClass: 3, row: 1, consonant: 'T', vowel: 'a', syllable: 'Ta', anatomicalRegion: 'Ridge (Crisp tongue strike)' },
      { pitchClass: 4, row: 0, consonant: 'N', vowel: 'a', syllable: 'Na', anatomicalRegion: 'Ridge (Nasal resonance)' },
      { pitchClass: 5, row: 1, consonant: 'L', vowel: 'a', syllable: 'La', anatomicalRegion: 'Ridge (Liquid flow)' },
      { pitchClass: 6, row: 0, consonant: 'S', vowel: 'a', syllable: 'Sa', anatomicalRegion: 'Teeth (Bright sibilant hiss)' },
      { pitchClass: 7, row: 1, consonant: 'V', vowel: 'a', syllable: 'Va', anatomicalRegion: 'Teeth-Lip (Voiced buzz)' },
      { pitchClass: 8, row: 0, consonant: 'F', vowel: 'a', syllable: 'Fa', anatomicalRegion: 'Teeth-Lip (Voiceless breath)' },
      { pitchClass: 9, row: 1, consonant: 'B', vowel: 'a', syllable: 'Ba', anatomicalRegion: 'Lips (Warm voiced burst)' },
      { pitchClass: 10, row: 0, consonant: 'P', vowel: 'a', syllable: 'Pa', anatomicalRegion: 'Lips (Crisp forward pop)' },
      { pitchClass: 11, row: 1, consonant: 'M', vowel: 'a', syllable: 'Ma', anatomicalRegion: 'Lips (Front nasal climax)' },
    ],
  },
};

const USER_12_CONSONANTS = ['b', 'd', 'f', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v'];
const COMMON_VOWELS = ['a', 'o', 'e', 'i', 'u'];

interface DrillPattern {
  id: string;
  name: string;
  pitches: number[];
}

const DRILL_PATTERNS: DrillPattern[] = [
  { id: 'chromatic', name: 'Chromatic Scale (0 → 11)', pitches: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { id: 'bach-theme', name: '🎼 Bach Goldberg Var 1 (Theme mm. 1-2)', pitches: [7, 6, 7, 2, 4, 6, 7, 9, 11, 13, 14, 13, 14] },
  { id: 'fifths', name: 'Circle of Fifths (0 → 7 → 2 → 9...)', pitches: [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5] },
  { id: 'tritone-twins', name: 'Tritone Twins (0↔6, 1↔7, 2↔8, 3↔9...)', pitches: [0, 6, 1, 7, 2, 8, 3, 9, 4, 10, 5, 11] },
  { id: 'row1-triangles', name: 'Row 1 Triangles: Voiced (1-5-9) vs Voiceless (3-7-11)', pitches: [1, 5, 9, 1, 3, 7, 11, 3] },
  { id: 'row0', name: 'Row 0 Even Whole-Tone (0, 2, 4, 6, 8, 10)', pitches: [0, 2, 4, 6, 8, 10] },
  { id: 'row1', name: 'Row 1 Odd Whole-Tone (1, 3, 5, 7, 9, 11)', pitches: [1, 3, 5, 7, 9, 11] },
  { id: 'triad-maj', name: 'Major Triad (0 - 4 - 7)', pitches: [0, 4, 7, 12] },
  { id: 'triad-min', name: 'Minor Triad (0 - 3 - 7)', pitches: [0, 3, 7, 12] },
  { id: 'trill-0-1', name: 'Trill 0 ↔ 1 (Adjacent Speed)', pitches: [0, 1, 0, 1, 0, 1, 0, 1] },
  { id: 'trill-6-7', name: 'Trill 6 ↔ 7 (Mid-Octave Speed)', pitches: [6, 7, 6, 7, 6, 7, 6, 7] },
];

export const PhoneticSandbox: React.FC = () => {
  const [activeAltId, setActiveAltId] = useState<string>('alt-optimal-symmetry');

  const [entries, setEntries] = useState<PhoneticEntry[]>(() => {
    try {
      const saved = localStorage.getItem('iso-phonetic-mapping-v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 12) return parsed;
      }
    } catch (_) {}
    return ALTERNATIVES['alt-optimal-symmetry'].entries;
  });

  const [auditionOctave, setAuditionOctave] = useState<number>(4);
  const [selectedPitch, setSelectedPitch] = useState<number>(0);
  const [copiedToast, setCopiedToast] = useState<string | null>(null);

  // Drill State
  const [selectedDrillId, setSelectedDrillId] = useState<string>('chromatic');
  const [isDrillPlaying, setIsDrillPlaying] = useState<boolean>(false);
  const [activeDrillIndex, setActiveDrillIndex] = useState<number>(-1);
  const [drillBpm, setDrillBpm] = useState<number>(100);

  const drillTimeoutRef = useRef<number | null>(null);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('iso-phonetic-mapping-v5', JSON.stringify(entries));
    } catch (_) {}
  }, [entries]);

  const currentDrill = useMemo(
    () => DRILL_PATTERNS.find((d) => d.id === selectedDrillId) || DRILL_PATTERNS[0],
    [selectedDrillId]
  );

  const activeAlternative = ALTERNATIVES[activeAltId] || ALTERNATIVES['alt-janko-flow'];

  const handleSelectAlternative = (altKey: string) => {
    const alt = ALTERNATIVES[altKey];
    if (alt) {
      setActiveAltId(altKey);
      setEntries([...alt.entries]);
      showToast(`Loaded ${alt.shortName}`);
    }
  };

  const handleUpdateEntry = (pitchClass: number, patch: Partial<PhoneticEntry>) => {
    setActiveAltId('custom');
    setEntries((prev) =>
      prev.map((item) => {
        if (item.pitchClass !== pitchClass) return item;
        const updated = { ...item, ...patch };
        if (patch.consonant !== undefined || patch.vowel !== undefined) {
          const c = patch.consonant !== undefined ? patch.consonant : item.consonant;
          const v = patch.vowel !== undefined ? patch.vowel : item.vowel;
          updated.syllable = `${c}${v}`;
        }
        return updated;
      })
    );
  };

  const handleAuditionPitch = (pitchClass: number, octave: number = auditionOctave) => {
    synth.playPitch({ pitchClass: pitchClass % 12, octave: octave + Math.floor(pitchClass / 12) }, 0.45, 90);
  };

  const showToast = (msg: string) => {
    setCopiedToast(msg);
    setTimeout(() => setCopiedToast(null), 2500);
  };

  const handleApplyVowelToAll = (v: string) => {
    setEntries((prev) =>
      prev.map((e) => ({
        ...e,
        vowel: v,
        syllable: `${e.consonant}${v}`,
      }))
    );
    showToast(`Applied '-${v}' vowel across all 12 pitches`);
  };

  const handleApplyDualVowelAI = () => {
    setActiveAltId('custom');
    setEntries((prev) =>
      prev.map((e) => {
        const v = e.row === 0 ? 'a' : 'i';
        return {
          ...e,
          vowel: v,
          syllable: `${e.consonant}${v}`,
        };
      })
    );
    showToast('Applied dual vowels: -a on Row 0, -i on Row 1');
  };

  // Drill playback loop
  useEffect(() => {
    if (!isDrillPlaying) {
      if (drillTimeoutRef.current) clearTimeout(drillTimeoutRef.current);
      setActiveDrillIndex(-1);
      return;
    }

    const intervalMs = (60 / drillBpm) * 1000;
    let idx = 0;

    const tick = () => {
      if (idx >= currentDrill.pitches.length) {
        idx = 0; // loop
      }
      setActiveDrillIndex(idx);
      const pitchValue = currentDrill.pitches[idx];
      handleAuditionPitch(pitchValue, auditionOctave);
      idx++;
      drillTimeoutRef.current = window.setTimeout(tick, intervalMs);
    };

    tick();

    return () => {
      if (drillTimeoutRef.current) clearTimeout(drillTimeoutRef.current);
    };
  }, [isDrillPlaying, selectedDrillId, drillBpm, auditionOctave, currentDrill]);

  const stopDrill = () => {
    setIsDrillPlaying(false);
    if (drillTimeoutRef.current) clearTimeout(drillTimeoutRef.current);
    setActiveDrillIndex(-1);
  };

  const handleQuickRunChromatic = () => {
    setSelectedDrillId('chromatic');
    setIsDrillPlaying(true);
  };

  const generateMarkdownTable = (): string => {
    let md = `| Pitch | Jánko Row | Consonant | Vowel | Syllable | Anatomical Region / Notes |\n`;
    md += `| :---: | :---: | :---: | :---: | :---: | :--- |\n`;
    entries.forEach((e) => {
      md += `| **${e.pitchClass}** | Row ${e.row} | \`${e.consonant}\` | \`${e.vowel}\` | **${e.syllable}** | ${e.anatomicalRegion} |\n`;
    });
    return md;
  };

  const handleCopyMarkdown = async () => {
    const md = generateMarkdownTable();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(md);
      } else {
        const ta = document.createElement('textarea');
        ta.value = md;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      showToast('Copied Markdown table to clipboard!');
    } catch (_) {
      showToast('Failed to copy. Check clipboard permissions.');
    }
  };

  const handleDownloadFile = () => {
    const text = `# ISO-NOTATION 12-TET PHONETIC MAPPING\n\nPreset: ${activeAlternative?.fullName || 'Custom'}\n\n${generateMarkdownTable()}\n\nExported: ${new Date().toISOString()}`;
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'iso-phonetic-mapping.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded iso-phonetic-mapping.md');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-black text-neutral-100 overflow-y-auto font-sans pb-16 select-none">
      {/* Toast Notification */}
      {copiedToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-black px-4 py-2 rounded-full font-mono text-xs font-bold shadow-lg transition-all animate-bounce">
          {copiedToast}
        </div>
      )}

      {/* Top Header Bar */}
      <div className="bg-neutral-950 border-b border-neutral-900 px-4 py-3 shrink-0">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <span>🗣️</span>
              <span>12-TET Phonetic Lab</span>
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              Testing candidate orderings for: <span className="font-mono text-amber-300 font-bold">ba, da, fa, ka, la, ma, na, pa, ra, sa, ta, va</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 rounded text-xs font-mono transition flex items-center gap-1.5 active:scale-95"
            >
              <span>📋</span>
              <span>Copy Table</span>
            </button>
            <button
              onClick={handleDownloadFile}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 rounded text-xs font-mono transition flex items-center gap-1.5 active:scale-95"
            >
              <span>💾</span>
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full px-3 py-4 flex flex-col gap-5">
        {/* Alternative Presets Switcher Bar */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wide">
              Select Ordering Alternative:
            </span>
            {activeAltId === 'custom' && (
              <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
                Custom Modified
              </span>
            )}
          </div>

          {/* Quick Alternative Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
            {Object.values(ALTERNATIVES).map((alt) => {
              const isSelected = activeAltId === alt.id;
              return (
                <button
                  key={alt.id}
                  onClick={() => handleSelectAlternative(alt.id)}
                  className={`px-2.5 py-2 rounded text-left transition flex flex-col gap-0.5 border active:scale-95 ${
                    isSelected
                      ? 'bg-amber-500 border-amber-400 text-black font-bold shadow-md shadow-amber-500/20'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                  }`}
                >
                  <span className="text-xs truncate">{alt.shortName}</span>
                  <span className={`text-[9px] truncate ${isSelected ? 'text-black/80' : 'text-neutral-500'}`}>
                    {alt.tagline.split('·')[0].trim()}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Selected Strategy Breakdown & Justification Card */}
        {activeAlternative && (
          <section className="bg-neutral-950 border border-neutral-800 rounded-lg p-3.5 flex flex-col gap-3 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-neutral-900">
              <div>
                <h2 className="text-sm font-bold text-amber-400 font-mono">
                  {activeAlternative.fullName}
                </h2>
                <p className="text-[11px] text-neutral-300 mt-0.5">
                  {activeAlternative.tagline}
                </p>
              </div>

              <button
                onClick={handleQuickRunChromatic}
                className="self-start sm:self-auto px-3 py-1 bg-white hover:bg-neutral-200 text-black rounded text-xs font-mono font-bold flex items-center gap-1.5 transition active:scale-95 shrink-0"
              >
                <span>▶ Run Chromatic Test</span>
              </button>
            </div>

            {/* Syllable Sequence Preview Tape */}
            <div className="bg-black border border-neutral-800/80 rounded px-2.5 py-2 flex items-center gap-1 overflow-x-auto">
              <span className="text-[10px] font-mono text-neutral-500 mr-1.5 uppercase shrink-0">
                Sequence:
              </span>
              <div className="flex items-center gap-1 min-w-max">
                {activeAlternative.entries.map((e, idx) => (
                  <React.Fragment key={e.pitchClass}>
                    <button
                      onClick={() => handleAuditionPitch(e.pitchClass)}
                      className="px-2 py-0.5 rounded bg-neutral-900 hover:bg-amber-500 hover:text-black border border-neutral-800 text-xs font-mono font-bold text-neutral-200 transition"
                      title={`Pitch ${e.pitchClass} (${e.anatomicalRegion})`}
                    >
                      {e.syllable}
                    </button>
                    {idx < 11 && <span className="text-neutral-700 text-xs font-mono">→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Justifications Bullet List */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-mono font-bold text-neutral-400 uppercase">
                Why this ordering works:
              </span>
              <ul className="flex flex-col gap-1.5 pl-1">
                {activeAlternative.justifications.map((j, i) => {
                  const [title, desc] = j.includes(':') ? j.split(':') : ['', j];
                  return (
                    <li key={i} className="text-xs text-neutral-300 flex items-start gap-2 leading-relaxed">
                      <span className="text-amber-400 text-sm leading-none shrink-0">•</span>
                      <span>
                        {title && <strong className="text-white font-mono">{title}: </strong>}
                        {desc}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        )}

        {/* Interactive Drill Runner & Sequencer */}
        <section className="bg-neutral-950 border border-neutral-800 rounded-lg p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">🎵</span>
              <span className="text-xs font-bold font-mono tracking-wide text-neutral-300 uppercase">
                Vocal Stress Test Runner
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-neutral-400">Octave:</span>
              {[3, 4, 5].map((oct) => (
                <button
                  key={oct}
                  onClick={() => setAuditionOctave(oct)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
                    auditionOctave === oct
                      ? 'bg-amber-500 border-amber-400 text-black font-bold'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  {oct}
                </button>
              ))}
            </div>
          </div>

          {/* Drill Selector & Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={selectedDrillId}
              onChange={(e) => {
                stopDrill();
                setSelectedDrillId(e.target.value);
              }}
              className="bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-neutral-200 font-mono focus:outline-none focus:border-amber-500"
            >
              {DRILL_PATTERNS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded px-2.5 py-1">
              <span className="text-[10px] font-mono text-neutral-400 whitespace-nowrap">
                Tempo: {drillBpm} BPM
              </span>
              <input
                type="range"
                min="50"
                max="180"
                step="5"
                value={drillBpm}
                onChange={(e) => setDrillBpm(parseInt(e.target.value))}
                className="w-full accent-amber-500 h-1 bg-neutral-800 rounded cursor-pointer"
              />
            </div>

            <button
              onClick={() => setIsDrillPlaying(!isDrillPlaying)}
              className={`py-1.5 px-4 rounded text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition active:scale-95 ${
                isDrillPlaying
                  ? 'bg-amber-500 text-black hover:bg-amber-400'
                  : 'bg-white text-black hover:bg-neutral-200'
              }`}
            >
              <span>{isDrillPlaying ? '⏹ Stop' : '▶ Run Test'}</span>
            </button>
          </div>

          {/* Drill Syllable Tape Display */}
          <div className="bg-black border border-neutral-800 rounded-md p-2 overflow-x-auto">
            <div className="flex items-center gap-1.5 min-w-max">
              {currentDrill.pitches.map((p, idx) => {
                const pitchCls = p % 12;
                const entry = entries[pitchCls];
                const isActive = isDrillPlaying && activeDrillIndex === idx;
                return (
                  <div
                    key={idx}
                    onClick={() => handleAuditionPitch(p, auditionOctave)}
                    className={`flex flex-col items-center justify-center px-3 py-2 rounded border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-amber-400 border-amber-300 text-black scale-105 shadow-md shadow-amber-500/20 font-bold'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                    }`}
                  >
                    <span className="text-sm font-mono tracking-tight">{entry?.syllable || '--'}</span>
                    <span
                      className={`text-[9px] font-mono mt-0.5 ${
                        isActive ? 'text-neutral-900' : 'text-neutral-500'
                      }`}
                    >
                      {pitchCls}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Global Vowel Quick Apply */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-neutral-950 border border-neutral-900 rounded p-2.5">
          <span className="text-xs font-mono text-neutral-400">Vowel Schemes:</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={handleApplyDualVowelAI}
              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-xs font-mono font-bold active:scale-95 flex items-center gap-1"
              title="Apply -a to Row 0, -i to Row 1"
            >
              <span>✨</span>
              <span>Row Dual: -a / -i</span>
            </button>
            <span className="text-neutral-700 font-mono hidden sm:inline">|</span>
            <span className="text-[11px] font-mono text-neutral-500">Uniform:</span>
            {COMMON_VOWELS.map((v) => (
              <button
                key={v}
                onClick={() => handleApplyVowelToAll(v)}
                className="px-2 py-0.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 rounded text-xs font-mono active:scale-95"
              >
                -{v}
              </button>
            ))}
          </div>
        </div>

        {/* 12-Pitch Class Matrix (Interactive Cards) */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wide">
              12 Pitch Class Customizer
            </span>
            <span className="text-[11px] font-mono text-neutral-500">
              Tap 🔊 to audition pitch
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {entries.map((item) => {
              const isSelected = selectedPitch === item.pitchClass;
              const isRow0 = item.row === 0;

              return (
                <div
                  key={item.pitchClass}
                  onClick={() => setSelectedPitch(item.pitchClass)}
                  className={`border rounded-lg p-2.5 flex items-center justify-between gap-3 transition-colors ${
                    isSelected
                      ? 'bg-neutral-900/80 border-amber-500/80'
                      : isRow0
                      ? 'bg-neutral-950 border-neutral-900 hover:border-neutral-800'
                      : 'bg-neutral-950/60 border-neutral-900 hover:border-neutral-800'
                  }`}
                >
                  {/* Left: Pitch Class & Janko Row Badge */}
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded flex items-center justify-center font-mono font-bold text-sm ${
                        isRow0 ? 'bg-neutral-800 text-white' : 'bg-neutral-900 text-neutral-300'
                      }`}
                    >
                      {item.pitchClass}
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] font-mono text-neutral-500">
                        {isRow0 ? 'Row 0 (Even)' : 'Row 1 (Odd)'}
                      </span>
                      <span className="text-[11px] text-neutral-400 truncate max-w-[120px]">
                        {item.anatomicalRegion.split('(')[0].trim()}
                      </span>
                    </div>
                  </div>

                  {/* Center: Consonant & Vowel Editor */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex flex-col items-center">
                      <input
                        type="text"
                        maxLength={3}
                        value={item.consonant}
                        onChange={(e) =>
                          handleUpdateEntry(item.pitchClass, { consonant: e.target.value })
                        }
                        className="w-10 bg-black border border-neutral-700 rounded px-1.5 py-0.5 text-center text-xs font-mono text-white focus:outline-none focus:border-amber-400 font-bold"
                        title="Consonant"
                      />
                      <span className="text-[9px] font-mono text-neutral-600 mt-0.5">C</span>
                    </div>

                    <span className="text-neutral-700 font-mono">+</span>

                    <div className="flex flex-col items-center">
                      <input
                        type="text"
                        maxLength={2}
                        value={item.vowel}
                        onChange={(e) =>
                          handleUpdateEntry(item.pitchClass, { vowel: e.target.value })
                        }
                        className="w-8 bg-black border border-neutral-700 rounded px-1.5 py-0.5 text-center text-xs font-mono text-white focus:outline-none focus:border-amber-400 font-bold"
                        title="Vowel"
                      />
                      <span className="text-[9px] font-mono text-neutral-600 mt-0.5">V</span>
                    </div>
                  </div>

                  {/* Right: Big Syllable Preview & Audition */}
                  <div className="flex items-center gap-2">
                    <div className="min-w-[42px] text-center font-mono font-bold text-base text-amber-400">
                      {item.syllable}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAuditionPitch(item.pitchClass);
                      }}
                      className="w-8 h-8 rounded bg-neutral-900 hover:bg-amber-500 hover:text-black text-neutral-300 border border-neutral-800 flex items-center justify-center text-sm transition active:scale-95"
                      title="Audition Note"
                    >
                      🔊
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Selected Pitch Quick Consonants Tray */}
        <section className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-neutral-300">
              Quick Consonants for Pitch <span className="text-amber-400 font-bold">[{selectedPitch}]</span>:
            </span>
            <span className="text-[10px] font-mono text-neutral-500">Tap to assign</span>
          </div>

          <div className="flex flex-wrap gap-1">
            {USER_12_CONSONANTS.map((c) => (
              <button
                key={c}
                onClick={() => handleUpdateEntry(selectedPitch, { consonant: c })}
                className={`px-2.5 py-1 rounded text-xs font-mono border transition ${
                  entries[selectedPitch]?.consonant === c
                    ? 'bg-amber-500 border-amber-400 text-black font-bold'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

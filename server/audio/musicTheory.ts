const WESTERN_NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
] as const;

export const SWARA_LABELS_12 = [
  'S',
  'r',
  'R',
  'g',
  'G',
  'M',
  'M+',
  'P',
  'd',
  'D',
  'n',
  'N',
] as const;

export const SWARA_FULL_NAMES_12 = [
  'Sa (0)',
  'Komal Re (1)',
  'Shuddha Re (2)',
  'Komal Ga (3)',
  'Shuddha Ga (4)',
  'Shuddha Ma (5)',
  'Tivra Ma (6)',
  'Pa (7)',
  'Komal Dha (8)',
  'Shuddha Dha (9)',
  'Komal Ni (10)',
  'Shuddha Ni (11)',
] as const;

export function frequencyToNearestWesternNote(frequencyHz: number): {
  note: string;
  centsDeviation: number;
  midiFloat: number;
} {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) {
    return { note: 'Unknown', centsDeviation: 0, midiFloat: 0 };
  }
  const midiFloat = 69 + 12 * Math.log2(frequencyHz / 440);
  const nearestMidi = Math.round(midiFloat);
  const centsDeviation = Math.round((midiFloat - nearestMidi) * 100);
  const noteIdx = ((nearestMidi % 12) + 12) % 12;
  const octave = Math.floor(nearestMidi / 12) - 1;
  return {
    note: `${WESTERN_NOTE_NAMES[noteIdx]}${octave}`,
    centsDeviation,
    midiFloat,
  };
}

export function frequencyToRelativeSemitones(
  frequencyHz: number,
  tonicHz: number,
): number {
  return 12 * Math.log2(frequencyHz / tonicHz);
}

export function semitoneToSwaraLabel(relativeSemitones: number): string {
  const rounded = Math.round(relativeSemitones);
  const pitchClass = ((rounded % 12) + 12) % 12;
  const octaveOffset = Math.floor(rounded / 12);
  const base = SWARA_LABELS_12[pitchClass];
  if (octaveOffset < 0) return `${base}.`;
  if (octaveOffset > 0) return `${base}'`;
  return base;
}

export function sanitizeFileName(rawName: string): string {
  const base = rawName.split(/[/\\]/).pop() ?? 'audio';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

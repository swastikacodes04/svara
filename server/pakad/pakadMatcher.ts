import type {
  PakadMatchCandidate,
  PakadMatchingResult,
  PakadReference,
} from '../../src/types/svara.ts';
import { semitoneToSwaraLabel } from '../audio/musicTheory.ts';

/**
 * Standard Dynamic Time Warping distance between two semitone sequences.
 * Uses pitch-class-aware wrapping tolerance? No: exact octave-relative semitones
 * (with octave normalization option of +/- 12 if motif sits an octave shifted).
 */
export function computeDtwDistance(seqA: number[], seqB: number[]): number {
  const n = seqA.length;
  const m = seqB.length;
  if (n === 0 || m === 0) return Infinity;

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(Infinity),
  );
  dp[0][0] = 0;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = Math.abs(seqA[i - 1] - seqB[j - 1]);
      const prev = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      dp[i][j] = cost + prev;
    }
  }

  return dp[n][m] / (n + m);
}

/**
 * Sliding-window subsequence DTW matching: finds the best matching window of
 * observed notes against a curated Pakad reference phrase.
 */
export function findBestSubsequenceDtw(
  observed: number[],
  reference: number[],
): {
  bestDistance: number;
  bestSubsequence: number[];
} {
  if (observed.length === 0 || reference.length === 0) {
    return { bestDistance: Infinity, bestSubsequence: [] };
  }

  if (observed.length <= reference.length) {
    // Try direct and +/-12 octave shift
    let bestDist = computeDtwDistance(observed, reference);
    for (const shift of [-12, 12]) {
      const shifted = observed.map((x) => x + shift);
      const d = computeDtwDistance(shifted, reference);
      if (d < bestDist) bestDist = d;
    }
    return { bestDistance: bestDist, bestSubsequence: observed };
  }

  const minWin = Math.max(3, Math.floor(reference.length * 0.75));
  const maxWin = Math.min(observed.length, Math.ceil(reference.length * 1.4));

  let bestDistance = Infinity;
  let bestSubsequence: number[] = observed.slice(0, reference.length);

  for (let start = 0; start <= observed.length - minWin; start++) {
    for (let winLen = minWin; winLen <= maxWin && start + winLen <= observed.length; winLen++) {
      const windowSeq = observed.slice(start, start + winLen);
      for (const shift of [0, -12, 12]) {
        const shifted = shift === 0 ? windowSeq : windowSeq.map((x) => x + shift);
        const dist = computeDtwDistance(shifted, reference);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestSubsequence = windowSeq;
        }
      }
    }
  }

  return { bestDistance, bestSubsequence };
}

export function matchPakadReferences(
  observedSequence: Array<{ swara: string; semitone: number; durationSec: number }>,
  references: PakadReference[],
  tonicReliable: boolean,
): PakadMatchingResult {
  const warnings: string[] = [];
  const observedSemitones = observedSequence.map((s) => s.semitone);
  const observedSwaraSequenceText = observedSequence
    .map((s) => s.swara)
    .join(' ');

  if (!tonicReliable) {
    warnings.push(
      'Tonic estimation is unreliable; Pakad alignment scores are sensitive to Sa shifts and should be interpreted cautiously.',
    );
  }

  if (observedSemitones.length < 4) {
    return {
      status: 'insufficient_data',
      observedSwaraSequenceText,
      observedSemitoneSequence: observedSemitones,
      topMatches: [],
      bestMatch: null,
      warnings: [
        ...warnings,
        'Fewer than 4 sustained melodic note steps were detected; insufficient sequence length for DTW Pakad matching.',
      ],
    };
  }

  const candidates: PakadMatchCandidate[] = references.map((ref) => {
    const { bestDistance, bestSubsequence } = findBestSubsequenceDtw(
      observedSemitones,
      ref.semitoneSequence,
    );

    // Similarity score maps DTW distance (0 = exact) smoothly to [0, 1]
    const similarityScore = Number(Math.exp(-bestDistance / 1.4).toFixed(3));

    let matchStatus: PakadMatchCandidate['matchStatus'] = 'Weak or no curated match';
    if (similarityScore >= 0.72 && bestDistance <= 0.48) {
      matchStatus = 'Strong subsequence alignment';
    } else if (similarityScore >= 0.45 && bestDistance <= 1.15) {
      matchStatus = 'Partial melodic similarity';
    }

    return {
      matchedPhraseId: ref.id,
      ragaId: ref.ragaId,
      ragaName: ref.ragaName,
      referenceNotation: ref.notation,
      referenceSequence: ref.semitoneSequence,
      observedSubsequence: bestSubsequence,
      observedSwaraText: bestSubsequence.map(semitoneToSwaraLabel).join(' '),
      dtwDistance: Number(bestDistance.toFixed(3)),
      similarityScore,
      matchStatus,
    };
  });

  candidates.sort((a, b) => b.similarityScore - a.similarityScore);
  const topMatches = candidates.slice(0, 4);
  const bestMatch = topMatches[0] ?? null;

  const hasMeaningfulMatch =
    bestMatch !== null && bestMatch.matchStatus !== 'Weak or no curated match';

  return {
    status: hasMeaningfulMatch ? 'matched' : 'weak_or_none',
    observedSwaraSequenceText,
    observedSemitoneSequence: observedSemitones,
    topMatches,
    bestMatch,
    warnings,
  };
}

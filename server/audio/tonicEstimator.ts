import type { ReliabilityLevel, TonicEstimationResult } from '../../src/types/svara.ts';
import { frequencyToNearestWesternNote } from './musicTheory.ts';
import type { RawPitchFrame } from './pitchTracker.ts';

/**
 * Estimates the Tonic (Sa / Shruti) from extracted F0 frames using an energy- and
 * stability-weighted pitch-class histogram (10-cent bins over 1200 cents), refined
 * with harmonic fifth (Sa + 702 cents = Pa) support and octave register selection.
 */
export function estimateTonic(frames: RawPitchFrame[]): TonicEstimationResult {
  const warnings: string[] = [];
  const voiced = frames.filter((f) => f.voiced && f.frequencyHz !== null);

  if (voiced.length < 10) {
    return {
      estimatedFrequencyHz: null,
      nearestWesternNote: 'Indeterminate',
      centsDeviation: 0,
      reliability: 'unreliable',
      confidenceScore: 0,
      candidateFrequenciesHz: [],
      warnings: [
        'Insufficient voiced pitch frames to estimate the Tonic (Sa).',
      ],
      method: 'Energy- & stability-weighted chroma histogram with fifth reinforcement',
    };
  }

  // 120 bins = 10 cents per bin, anchored at C0 = 16.3515978 Hz
  const C0 = 16.351597831287414;
  const NUM_BINS = 120;
  const histogram = new Float64Array(NUM_BINS);

  // Weight each frame by confidence, RMS, and local pitch stability
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (!f.voiced || f.frequencyHz === null) continue;

    let stability = 1.0;
    if (i > 0 && frames[i - 1].voiced && frames[i - 1].frequencyHz !== null) {
      const diffCents = Math.abs(
        1200 * Math.log2(f.frequencyHz / (frames[i - 1].frequencyHz as number)),
      );
      stability = Math.exp(-diffCents / 35); // sustained steady pitches get higher tonic weight
    }

    const centsFromC0 = 1200 * Math.log2(f.frequencyHz / C0);
    const wrappedCents = ((centsFromC0 % 1200) + 1200) % 1200;
    const centerBin = Math.round(wrappedCents / 10) % NUM_BINS;
    const weight = f.confidence * Math.min(1, f.rms * 5) * (0.4 + 0.6 * stability);

    // Gaussian spread across +/- 2 bins (20 cents)
    for (let offset = -2; offset <= 2; offset++) {
      const idx = (centerBin + offset + NUM_BINS) % NUM_BINS;
      const kernel = Math.exp(-(offset * offset) / 1.8);
      histogram[idx] += weight * kernel;
    }
  }

  // Score each pitch-class bin combining direct prominence + fifth (Pa = +70 bins / 700c) support
  const scores = new Float64Array(NUM_BINS);
  let totalHistWeight = 0;
  for (let b = 0; b < NUM_BINS; b++) {
    totalHistWeight += histogram[b];
  }

  for (let b = 0; b < NUM_BINS; b++) {
    const fifthBin = (b + 70) % NUM_BINS; // ~702 cents
    const fourthBin = (b + 50) % NUM_BINS; // ~498 cents
    scores[b] = histogram[b] * 0.72 + histogram[fifthBin] * 0.22 + histogram[fourthBin] * 0.06;
  }

  // Find distinct peaks separated by at least 7 bins (70 cents)
  const peakIndices: number[] = [];
  for (let b = 0; b < NUM_BINS; b++) {
    const prev = scores[(b - 1 + NUM_BINS) % NUM_BINS];
    const next = scores[(b + 1) % NUM_BINS];
    if (scores[b] >= prev && scores[b] >= next && scores[b] > 0) {
      peakIndices.push(b);
    }
  }
  peakIndices.sort((a, b) => scores[b] - scores[a]);

  const distinctPeaks: number[] = [];
  for (const idx of peakIndices) {
    const tooClose = distinctPeaks.some((chosen) => {
      const dist = Math.min(
        Math.abs(idx - chosen),
        NUM_BINS - Math.abs(idx - chosen),
      );
      return dist < 7;
    });
    if (!tooClose) distinctPeaks.push(idx);
    if (distinctPeaks.length >= 3) break;
  }

  if (distinctPeaks.length === 0 || totalHistWeight <= 0) {
    return {
      estimatedFrequencyHz: null,
      nearestWesternNote: 'Indeterminate',
      centsDeviation: 0,
      reliability: 'unreliable',
      confidenceScore: 0,
      candidateFrequenciesHz: [],
      warnings: ['No stable pitch center emerged from the pitch histogram.'],
      method: 'Energy- & stability-weighted chroma histogram with fifth reinforcement',
    };
  }

  // Choose realistic octave register for each candidate based on actual voiced frequencies
  const sortedFreqs = voiced
    .map((f) => f.frequencyHz as number)
    .sort((a, b) => a - b);
  const lowerQuartileHz = sortedFreqs[Math.floor(sortedFreqs.length * 0.28)];

  const resolveOctave = (bin: number): number => {
    const baseCents = bin * 10;
    const baseFreq = C0 * Math.pow(2, baseCents / 1200);
    // Shift by octaves until closest to lowerQuartileHz within standard vocal/melodic tonic bounds (95 Hz - 310 Hz)
    let bestHz = baseFreq;
    let bestDist = Infinity;
    for (let oct = 2; oct <= 5; oct++) {
      const candidate = baseFreq * Math.pow(2, oct);
      if (candidate < 85 || candidate > 340) continue;
      const dist = Math.abs(Math.log2(candidate / lowerQuartileHz));
      if (dist < bestDist) {
        bestDist = dist;
        bestHz = candidate;
      }
    }
    return bestHz;
  };

  const candidates = distinctPeaks.map((bin) => {
    const hz = resolveOctave(bin);
    const western = frequencyToNearestWesternNote(hz);
    return {
      frequencyHz: Number(hz.toFixed(2)),
      note: western.note,
      prominence: Number((scores[bin] / (totalHistWeight / 10)).toFixed(3)),
      rawScore: scores[bin],
    };
  });

  const topScore = candidates[0].rawScore;
  const secondScore = candidates.length > 1 ? candidates[1].rawScore : 0;
  const marginRatio = topScore > 0 ? (topScore - secondScore) / topScore : 0;
  const voicedRatio = voiced.length / frames.length;

  // Compute honest confidence score (0..1)
  const confidenceScore = Math.max(
    0,
    Math.min(
      1,
      0.45 * Math.min(1, voicedRatio / 0.65) +
        0.35 * Math.min(1, marginRatio * 2.2) +
        0.2 * Math.min(1, candidates[0].prominence / 2.5),
    ),
  );

  let reliability: ReliabilityLevel = 'high';
  if (confidenceScore < 0.35 || voiced.length < 25) {
    reliability = 'unreliable';
    warnings.push(
      'Tonic estimate is unreliable due to sparse voiced pitch frames or competing pitch centers.',
    );
  } else if (confidenceScore < 0.55 || marginRatio < 0.15) {
    reliability = 'low';
    warnings.push(
      'Low tonic confidence: an alternative note (such as Pa or Ma) has comparable histogram prominence.',
    );
  } else if (confidenceScore < 0.75) {
    reliability = 'moderate';
    warnings.push(
      'Moderate tonic reliability: verify estimated Sa against the performance drone if available.',
    );
  }

  const bestHz = candidates[0].frequencyHz;
  const bestWestern = frequencyToNearestWesternNote(bestHz);

  return {
    estimatedFrequencyHz: bestHz,
    nearestWesternNote: bestWestern.note,
    centsDeviation: bestWestern.centsDeviation,
    reliability,
    confidenceScore: Number(confidenceScore.toFixed(3)),
    candidateFrequenciesHz: candidates.map(({ frequencyHz, note, prominence }) => ({
      frequencyHz,
      note,
      prominence,
    })),
    warnings,
    method: 'Energy- & stability-weighted chroma histogram with fifth reinforcement',
  };
}

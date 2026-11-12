import type { MelodicFeaturesResult, PitchClassBin } from '../../src/types/svara.ts';
import {
  SWARA_FULL_NAMES_12,
  SWARA_LABELS_12,
  frequencyToRelativeSemitones,
  semitoneToSwaraLabel,
} from '../audio/musicTheory.ts';
import type { RawPitchFrame } from '../audio/pitchTracker.ts';

function computeRadix2FftMagnitudes(realInput: Float32Array): Float32Array {
  const N = realInput.length;
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  re.set(realInput);

  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < N; i++) {
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
    let m = N >> 1;
    while (m >= 1 && j >= m) {
      j -= m;
      m >>= 1;
    }
    j += m;
  }

  // Cooley-Tukey iterative FFT
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1;
    const angleStep = (-2 * Math.PI) / size;
    for (let start = 0; start < N; start += size) {
      for (let k = 0; k < half; k++) {
        const angle = k * angleStep;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);
        const idx1 = start + k;
        const idx2 = idx1 + half;
        const tr = wr * re[idx2] - wi * im[idx2];
        const ti = wr * im[idx2] + wi * re[idx2];
        re[idx2] = re[idx1] - tr;
        im[idx2] = im[idx1] - ti;
        re[idx1] += tr;
        im[idx1] += ti;
      }
    }
  }

  const halfBins = N >> 1;
  const mags = new Float32Array(halfBins);
  for (let k = 0; k < halfBins; k++) {
    mags[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
  }
  return mags;
}

export function extractSpectralFeatures(
  samples: Float32Array,
  sampleRate: number,
): {
  meanSpectralCentroidHz: number;
  meanSpectralFlatness: number;
  meanZeroCrossingRate: number;
} {
  const fftSize = 1024;
  if (samples.length < fftSize) {
    return {
      meanSpectralCentroidHz: 0,
      meanSpectralFlatness: 0,
      meanZeroCrossingRate: 0,
    };
  }

  const maxWindows = 40;
  const step = Math.max(
    fftSize,
    Math.floor((samples.length - fftSize) / maxWindows),
  );
  const hann = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
  }

  let centroidSum = 0;
  let flatnessSum = 0;
  let zcrSum = 0;
  let count = 0;
  const windowed = new Float32Array(fftSize);

  for (let start = 0; start + fftSize <= samples.length && count < maxWindows; start += step) {
    let crossings = 0;
    let energy = 0;
    for (let i = 0; i < fftSize; i++) {
      const s = samples[start + i];
      windowed[i] = s * hann[i];
      energy += s * s;
      if (i > 0 && ((s >= 0 && samples[start + i - 1] < 0) || (s < 0 && samples[start + i - 1] >= 0))) {
        crossings++;
      }
    }
    if (Math.sqrt(energy / fftSize) < 0.01) continue;

    const mags = computeRadix2FftMagnitudes(windowed);
    let weightedFreq = 0;
    let magSum = 0;
    let logPowerSum = 0;
    let powerSum = 0;
    const binHz = sampleRate / fftSize;

    for (let k = 1; k < mags.length; k++) {
      const m = mags[k] + 1e-12;
      weightedFreq += k * binHz * m;
      magSum += m;
      const p = m * m;
      powerSum += p;
      logPowerSum += Math.log(p);
    }

    const centroid = magSum > 0 ? weightedFreq / magSum : 0;
    const nBins = mags.length - 1;
    const geomMean = Math.exp(logPowerSum / nBins);
    const arithMean = powerSum / nBins;
    const flatness = arithMean > 0 ? Math.min(1, geomMean / arithMean) : 0;

    centroidSum += centroid;
    flatnessSum += flatness;
    zcrSum += crossings / fftSize;
    count++;
  }

  if (count === 0) {
    return {
      meanSpectralCentroidHz: 0,
      meanSpectralFlatness: 0,
      meanZeroCrossingRate: 0,
    };
  }

  return {
    meanSpectralCentroidHz: Number((centroidSum / count).toFixed(1)),
    meanSpectralFlatness: Number((flatnessSum / count).toFixed(4)),
    meanZeroCrossingRate: Number((zcrSum / count).toFixed(4)),
  };
}

export function extractMelodicFeatures(
  rawFrames: RawPitchFrame[],
  samples: Float32Array,
  sampleRate: number,
  tonicHz: number | null,
): MelodicFeaturesResult {
  const spectralFeatures = extractSpectralFeatures(samples, sampleRate);

  const binCounts = new Array<number>(12).fill(0);
  const relValues: Array<{ timeSec: number; rel: number }> = [];

  if (tonicHz !== null && tonicHz > 0) {
    for (const f of rawFrames) {
      if (!f.voiced || f.frequencyHz === null) continue;
      const rel = frequencyToRelativeSemitones(f.frequencyHz, tonicHz);
      relValues.push({ timeSec: f.timeSec, rel });
      const bin = ((Math.round(rel) % 12) + 12) % 12;
      binCounts[bin]++;
    }
  }

  const totalVoiced = relValues.length;
  const pitchClassDistribution: PitchClassBin[] = SWARA_LABELS_12.map(
    (swaraLabel, idx) => ({
      semitoneIndex: idx,
      swaraLabel,
      westernOffsetLabel: SWARA_FULL_NAMES_12[idx],
      proportion: totalVoiced > 0 ? Number((binCounts[idx] / totalVoiced).toFixed(4)) : 0,
      frameCount: binCounts[idx],
    }),
  );

  if (totalVoiced === 0) {
    return {
      relativePitchMean: 0,
      relativePitchStd: 0,
      pitchRangeSemitones: 0,
      ascendingTransitions: 0,
      descendingTransitions: 0,
      stationaryTransitions: 0,
      meanIntervalMagnitude: 0,
      pitchClassDistribution,
      observedSequence: [],
      spectralFeatures,
    };
  }

  let sum = 0;
  let minRel = Infinity;
  let maxRel = -Infinity;
  for (const v of relValues) {
    sum += v.rel;
    if (v.rel < minRel) minRel = v.rel;
    if (v.rel > maxRel) maxRel = v.rel;
  }
  const mean = sum / totalVoiced;

  let varSum = 0;
  for (const v of relValues) {
    const d = v.rel - mean;
    varSum += d * d;
  }
  const std = Math.sqrt(varSum / totalVoiced);

  // Build run-length collapsed Swara sequence (minimum hold >= 60ms)
  const hopSec =
    rawFrames.length >= 2 ? rawFrames[1].timeSec - rawFrames[0].timeSec : 0.02;

  const rawNotes: Array<{ semitone: number; durationSec: number }> = [];
  for (const v of relValues) {
    const quantized = Math.round(v.rel);
    const last = rawNotes[rawNotes.length - 1];
    if (last && last.semitone === quantized) {
      last.durationSec += hopSec;
    } else {
      rawNotes.push({ semitone: quantized, durationSec: hopSec });
    }
  }

  // Merge transient 1-frame flickers (< 0.055s) and coalesce repeated adjacent notes
  const cleanedNotes: Array<{ semitone: number; durationSec: number }> = [];
  for (const item of rawNotes) {
    if (item.durationSec < 0.055) continue;
    const prev = cleanedNotes[cleanedNotes.length - 1];
    if (prev && prev.semitone === item.semitone) {
      prev.durationSec += item.durationSec;
    } else {
      cleanedNotes.push({ ...item });
    }
  }

  let ascendingTransitions = 0;
  let descendingTransitions = 0;
  let stationaryTransitions = 0;
  let intervalSum = 0;
  let intervalCount = 0;

  for (let i = 1; i < relValues.length; i++) {
    const delta = relValues[i].rel - relValues[i - 1].rel;
    const dt = relValues[i].timeSec - relValues[i - 1].timeSec;
    if (dt > 0.25) continue; // Skip across unvoiced gaps
    if (delta > 0.25) {
      ascendingTransitions++;
      intervalSum += Math.abs(delta);
      intervalCount++;
    } else if (delta < -0.25) {
      descendingTransitions++;
      intervalSum += Math.abs(delta);
      intervalCount++;
    } else {
      stationaryTransitions++;
    }
  }

  const observedSequence = cleanedNotes.slice(0, 60).map((n) => ({
    swara: semitoneToSwaraLabel(n.semitone),
    semitone: n.semitone,
    durationSec: Number(n.durationSec.toFixed(2)),
  }));

  return {
    relativePitchMean: Number(mean.toFixed(2)),
    relativePitchStd: Number(std.toFixed(2)),
    pitchRangeSemitones: Number((maxRel - minRel).toFixed(2)),
    ascendingTransitions,
    descendingTransitions,
    stationaryTransitions,
    meanIntervalMagnitude:
      intervalCount > 0 ? Number((intervalSum / intervalCount).toFixed(3)) : 0,
    pitchClassDistribution,
    observedSequence,
    spectralFeatures,
  };
}

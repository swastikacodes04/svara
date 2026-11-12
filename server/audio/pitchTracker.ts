import type { PitchContourPoint, PitchExtractionResult } from '../../src/types/svara.ts';
import {
  frequencyToRelativeSemitones,
  semitoneToSwaraLabel,
} from './musicTheory.ts';

export interface RawPitchFrame {
  timeSec: number;
  frequencyHz: number | null;
  confidence: number;
  rms: number;
  voiced: boolean;
}

/**
 * YIN fundamental frequency estimator on a single windowed audio frame.
 * Searches between minFreqHz (65 Hz) and maxFreqHz (900 Hz).
 */
export function estimateFramePitchYin(
  samples: Float32Array,
  startIdx: number,
  frameSize: number,
  sampleRate: number,
  minFreqHz = 65,
  maxFreqHz = 900,
  threshold = 0.28,
): { frequencyHz: number | null; confidence: number; rms: number } {
  let rmsSum = 0;
  for (let i = 0; i < frameSize; i++) {
    const s = samples[startIdx + i];
    rmsSum += s * s;
  }
  const rms = Math.sqrt(rmsSum / frameSize);
  if (rms < 0.006) {
    return { frequencyHz: null, confidence: 0, rms };
  }

  const halfSize = Math.floor(frameSize / 2);
  const tauMin = Math.max(2, Math.floor(sampleRate / maxFreqHz));
  const tauMax = Math.min(halfSize - 2, Math.floor(sampleRate / minFreqHz));
  if (tauMax <= tauMin + 2) {
    return { frequencyHz: null, confidence: 0, rms };
  }

  const diff = new Float32Array(tauMax + 2);
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    let sum = 0;
    for (let j = 0; j < halfSize; j++) {
      const d = samples[startIdx + j] - samples[startIdx + j + tau];
      sum += d * d;
    }
    diff[tau] = sum;
  }

  // Cumulative mean normalized difference function d'(tau)
  const cmndf = new Float32Array(tauMax + 2);
  cmndf[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= tauMax + 1; tau++) {
    runningSum += diff[tau];
    cmndf[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1;
  }

  // Step 1: First local minimum below threshold
  let selectedTau = -1;
  for (let tau = tauMin; tau <= tauMax; tau++) {
    if (cmndf[tau] < threshold) {
      while (tau + 1 <= tauMax && cmndf[tau + 1] < cmndf[tau]) {
        tau++;
      }
      selectedTau = tau;
      break;
    }
  }

  // Fallback to global minimum if nothing strictly crossed threshold
  let minVal = 1;
  if (selectedTau === -1) {
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (cmndf[tau] < minVal) {
        minVal = cmndf[tau];
        selectedTau = tau;
      }
    }
    if (minVal > 0.42 || selectedTau === -1) {
      return {
        frequencyHz: null,
        confidence: Math.max(0, 1 - minVal),
        rms,
      };
    }
  } else {
    minVal = cmndf[selectedTau];
  }

  // Parabolic interpolation around selectedTau for sub-sample accuracy
  let betterTau = selectedTau;
  if (selectedTau > 1 && selectedTau < tauMax) {
    const s0 = cmndf[selectedTau - 1];
    const s1 = cmndf[selectedTau];
    const s2 = cmndf[selectedTau + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (Math.abs(denom) > 1e-9) {
      const delta = (s2 - s0) / denom;
      if (Math.abs(delta) < 1) {
        betterTau = selectedTau + delta;
      }
    }
  }

  const frequencyHz = sampleRate / betterTau;
  const confidence = Math.max(0, Math.min(1, 1 - minVal));

  if (frequencyHz < minFreqHz || frequencyHz > maxFreqHz || !Number.isFinite(frequencyHz)) {
    return { frequencyHz: null, confidence: 0, rms };
  }

  return { frequencyHz, confidence, rms };
}

export function extractRawPitchFrames(
  samples: Float32Array,
  sampleRate: number,
  hopSec = 0.02,
): RawPitchFrame[] {
  // Window ~46ms at 44.1kHz (~2048 samples), minimum enough for 65Hz (need >= 2 * period ~ 31ms)
  const frameSize = Math.max(1024, Math.round(sampleRate * 0.05));
  const hopSize = Math.max(128, Math.round(sampleRate * hopSec));

  // Cap total frames on very long audio by increasing hop slightly above 120s so API remains responsive
  const estimatedFrames = Math.floor((samples.length - frameSize) / hopSize);
  const effectiveHopSize =
    estimatedFrames > 6000
      ? Math.floor((samples.length - frameSize) / 6000)
      : hopSize;

  const rawFrames: RawPitchFrame[] = [];
  for (let start = 0; start + frameSize <= samples.length; start += effectiveHopSize) {
    const timeSec = (start + frameSize / 2) / sampleRate;
    const res = estimateFramePitchYin(samples, start, frameSize, sampleRate);
    rawFrames.push({
      timeSec,
      frequencyHz: res.frequencyHz,
      confidence: res.confidence,
      rms: res.rms,
      voiced: res.frequencyHz !== null && res.confidence >= 0.55,
    });
  }

  // Median filter (radius 2) across voiced neighbors to suppress isolated octave spikes
  const smoothed = rawFrames.map((frame, idx) => {
    if (!frame.voiced || frame.frequencyHz === null) {
      return { ...frame, voiced: false, frequencyHz: null };
    }
    const windowVals: number[] = [];
    for (let k = Math.max(0, idx - 2); k <= Math.min(rawFrames.length - 1, idx + 2); k++) {
      const f = rawFrames[k].frequencyHz;
      if (rawFrames[k].voiced && f !== null) windowVals.push(f);
    }
    if (windowVals.length < 2) {
      // Isolated single-frame spike -> mark unvoiced
      return { ...frame, voiced: false, frequencyHz: null };
    }
    windowVals.sort((a, b) => a - b);
    const median = windowVals[Math.floor(windowVals.length / 2)];
    const ratio = frame.frequencyHz / median;
    // Reject sudden isolated octave jump > 1.7x or < 0.58x
    if (ratio > 1.75 || ratio < 0.57) {
      return { ...frame, frequencyHz: median };
    }
    return frame;
  });

  return smoothed;
}

export function buildPitchExtractionResult(
  rawFrames: RawPitchFrame[],
  tonicHz: number | null,
  hopSec = 0.02,
): PitchExtractionResult {
  const warnings: string[] = [];
  const voicedFreqs = rawFrames
    .filter((f) => f.voiced && f.frequencyHz !== null)
    .map((f) => f.frequencyHz as number);

  const voicedFrames = voicedFreqs.length;
  const totalFrames = rawFrames.length;
  const unvoicedFrames = totalFrames - voicedFrames;
  const voicedRatio = totalFrames > 0 ? voicedFrames / totalFrames : 0;

  if (voicedRatio < 0.3) {
    warnings.push(
      `Only ${(voicedRatio * 100).toFixed(0)}% of frames had reliable pitch tracking; results may be affected by percussion, polyphony, or background noise.`,
    );
  }

  let minFrequencyHz: number | null = null;
  let maxFrequencyHz: number | null = null;
  let medianFrequencyHz: number | null = null;
  if (voicedFreqs.length > 0) {
    const sorted = [...voicedFreqs].sort((a, b) => a - b);
    minFrequencyHz = Number(sorted[0].toFixed(2));
    maxFrequencyHz = Number(sorted[sorted.length - 1].toFixed(2));
    medianFrequencyHz = Number(sorted[Math.floor(sorted.length / 2)].toFixed(2));
  }

  // Downsample contour for clean frontend visualization (max ~450 points) while keeping gaps accurate
  const step = Math.max(1, Math.ceil(rawFrames.length / 450));
  const contour: PitchContourPoint[] = [];

  for (let i = 0; i < rawFrames.length; i += step) {
    const f = rawFrames[i];
    const rel =
      f.voiced && f.frequencyHz !== null && tonicHz !== null
        ? Number(frequencyToRelativeSemitones(f.frequencyHz, tonicHz).toFixed(3))
        : null;
    contour.push({
      timeSec: Number(f.timeSec.toFixed(3)),
      frequencyHz: f.voiced && f.frequencyHz !== null ? Number(f.frequencyHz.toFixed(2)) : null,
      relativeSemitones: rel,
      confidence: Number(f.confidence.toFixed(3)),
      voiced: f.voiced,
      nearestSwara: rel !== null ? semitoneToSwaraLabel(rel) : null,
    });
  }

  const effectiveHop =
    rawFrames.length >= 2
      ? Number((rawFrames[1].timeSec - rawFrames[0].timeSec).toFixed(4))
      : hopSec;

  return {
    frameHopSec: effectiveHop,
    totalFrames,
    voicedFrames,
    unvoicedFrames,
    voicedRatio: Number(voicedRatio.toFixed(3)),
    minFrequencyHz,
    maxFrequencyHz,
    medianFrequencyHz,
    contour,
    warnings,
  };
}

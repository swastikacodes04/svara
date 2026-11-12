export interface PreprocessedAudio {
  samples: Float32Array;
  sampleRate: number;
  durationSeconds: number;
  activeEnergyRatio: number;
  clippedSampleRatio: number;
  warnings: string[];
}

export function preprocessAudio(
  rawSamples: Float32Array,
  sampleRate: number,
): PreprocessedAudio {
  const warnings: string[] = [];
  const n = rawSamples.length;

  // 1. Remove DC offset
  let mean = 0;
  for (let i = 0; i < n; i++) {
    mean += rawSamples[i];
  }
  mean /= n;

  // 2. Measure peak and clipping before normalization
  let peak = 0;
  let clippedCount = 0;
  const centered = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const val = rawSamples[i] - mean;
    centered[i] = val;
    const abs = Math.abs(val);
    if (abs > peak) peak = abs;
    if (Math.abs(rawSamples[i]) >= 0.995) clippedCount++;
  }

  const clippedSampleRatio = clippedCount / n;
  if (clippedSampleRatio > 0.02) {
    warnings.push(
      `Detected amplitude clipping in ${(clippedSampleRatio * 100).toFixed(1)}% of samples; harmonic distortion may affect pitch confidence.`,
    );
  }

  // 3. Robust peak-normalize (using 99.5th percentile so isolated mic clicks don't attenuate singing)
  const stride = Math.max(1, Math.floor(n / 4096));
  const absSampled: number[] = [];
  for (let i = 0; i < n; i += stride) {
    absSampled.push(Math.abs(centered[i]));
  }
  absSampled.sort((a, b) => a - b);
  const p995 = absSampled[Math.min(absSampled.length - 1, Math.floor(absSampled.length * 0.995))] || peak;
  const refAmp = p995 > 1e-4 ? p995 : peak;

  const normalized = new Float32Array(n);
  const scale = refAmp > 1e-6 ? 0.9 / refAmp : 1.0;
  for (let i = 0; i < n; i++) {
    const scaled = centered[i] * scale;
    normalized[i] = Math.max(-1, Math.min(1, scaled));
  }

  // 4. Optional downsample if > 48kHz? Keep up to 48kHz, downsample >48kHz by integer factor for efficiency
  let outputSamples = normalized;
  let outputRate = sampleRate;
  if (sampleRate > 48000) {
    const factor = Math.round(sampleRate / 24000);
    const downLen = Math.floor(n / factor);
    const down = new Float32Array(downLen);
    for (let i = 0; i < downLen; i++) {
      let acc = 0;
      for (let j = 0; j < factor; j++) {
        acc += normalized[i * factor + j];
      }
      down[i] = acc / factor;
    }
    outputSamples = down;
    outputRate = Math.round(sampleRate / factor);
  }

  // 5. Measure active energy frames (25ms frames)
  const frameSize = Math.max(128, Math.floor(outputRate * 0.025));
  const frameCount = Math.floor(outputSamples.length / frameSize);
  let activeFrames = 0;
  for (let f = 0; f < frameCount; f++) {
    let energy = 0;
    const base = f * frameSize;
    for (let i = 0; i < frameSize; i++) {
      const s = outputSamples[base + i];
      energy += s * s;
    }
    const rms = Math.sqrt(energy / frameSize);
    if (rms > 0.015) activeFrames++;
  }
  const activeEnergyRatio = frameCount > 0 ? activeFrames / frameCount : 0;

  if (activeEnergyRatio < 0.25) {
    warnings.push(
      'Recording contains substantial silence or low-energy passages, reducing usable melodic duration.',
    );
  }

  return {
    samples: outputSamples,
    sampleRate: outputRate,
    durationSeconds: outputSamples.length / outputRate,
    activeEnergyRatio,
    clippedSampleRatio,
    warnings,
  };
}

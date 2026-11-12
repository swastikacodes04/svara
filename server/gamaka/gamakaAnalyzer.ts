import type { GamakaAnalysisResult, GamakaGlideEvent } from '../../src/types/svara.ts';
import { frequencyToRelativeSemitones } from '../audio/musicTheory.ts';
import type { RawPitchFrame } from '../audio/pitchTracker.ts';

/**
 * Separate Gamaka analysis module extracting measurable acoustic pitch-contour
 * descriptors (excursion, glides, local oscillation/modulation rate, slope, curvature).
 */
export function analyzeGamakaDescriptors(
  rawFrames: RawPitchFrame[],
  tonicHz: number | null,
): GamakaAnalysisResult {
  const warnings: string[] = [];
  const boundaryNote =
    'Numerical pitch-contour descriptors measure acoustic frequency trajectories (glides, excursions, modulation rate, curvature). They serve as computable proxies and do not exhaustively capture the aesthetic and expressive grammar of classical Gamaka.';

  if (tonicHz === null || tonicHz <= 0) {
    return {
      maxPitchExcursionSemitones: 0,
      meanLocalExcursionSemitones: 0,
      detectedGlideCount: 0,
      ascendingGlides: 0,
      descendingGlides: 0,
      meanGlideDurationMs: 0,
      oscillationRateHz: null,
      oscillationExtentSemitones: null,
      meanPitchSlopeAbs: 0,
      meanContourCurvature: 0,
      contourShapeSummary: 'Unavailable — reliable tonic reference is required for Gamaka contour analysis.',
      sampleGlides: [],
      interpretationBoundaryNote: boundaryNote,
      warnings: ['Skipped Gamaka contour calculations because tonic estimation did not converge.'],
    };
  }

  // Group into continuous voiced segments (gap <= 60ms)
  type ContourPoint = { timeSec: number; p: number };
  const segments: ContourPoint[][] = [];
  let current: ContourPoint[] = [];

  for (const frame of rawFrames) {
    if (!frame.voiced || frame.frequencyHz === null) {
      if (current.length >= 4) segments.push(current);
      current = [];
      continue;
    }
    const p = frequencyToRelativeSemitones(frame.frequencyHz, tonicHz);
    if (
      current.length > 0 &&
      frame.timeSec - current[current.length - 1].timeSec > 0.08
    ) {
      if (current.length >= 4) segments.push(current);
      current = [];
    }
    current.push({ timeSec: frame.timeSec, p });
  }
  if (current.length >= 4) segments.push(current);

  if (segments.length === 0) {
    return {
      maxPitchExcursionSemitones: 0,
      meanLocalExcursionSemitones: 0,
      detectedGlideCount: 0,
      ascendingGlides: 0,
      descendingGlides: 0,
      meanGlideDurationMs: 0,
      oscillationRateHz: null,
      oscillationExtentSemitones: null,
      meanPitchSlopeAbs: 0,
      meanContourCurvature: 0,
      contourShapeSummary: 'Insufficient continuous voiced segments to measure Gamaka trajectories.',
      sampleGlides: [],
      interpretationBoundaryNote: boundaryNote,
      warnings: ['No continuous voiced segments (>= 4 frames) detected.'],
    };
  }

  let maxExcursion = 0;
  let segExcursionSum = 0;
  const slopesAbs: number[] = [];
  const curvaturesAbs: number[] = [];
  const glides: GamakaGlideEvent[] = [];

  // Track slope sign reversals for oscillation (kampita / andolan / vibrato)
  const oscHalfPeriodsSec: number[] = [];
  const localOscExtents: number[] = [];

  for (const seg of segments) {
    let minP = Infinity;
    let maxP = -Infinity;
    for (const pt of seg) {
      if (pt.p < minP) minP = pt.p;
      if (pt.p > maxP) maxP = pt.p;
    }
    const segSpan = maxP - minP;
    if (segSpan > maxExcursion) maxExcursion = segSpan;
    segExcursionSum += segSpan;

    // First derivative dp/dt (semitones / sec)
    const derivs: Array<{ timeSec: number; dpdt: number }> = [];
    for (let i = 1; i < seg.length; i++) {
      const dt = seg[i].timeSec - seg[i - 1].timeSec;
      if (dt <= 0) continue;
      const dpdt = (seg[i].p - seg[i - 1].p) / dt;
      derivs.push({ timeSec: seg[i].timeSec, dpdt });
      slopesAbs.push(Math.abs(dpdt));
    }

    // Second derivative d2p/dt2
    for (let i = 1; i < derivs.length; i++) {
      const dt = derivs[i].timeSec - derivs[i - 1].timeSec;
      if (dt <= 0) continue;
      curvaturesAbs.push(Math.abs((derivs[i].dpdt - derivs[i - 1].dpdt) / dt));
    }

    // Detect monotonic glides (>= 1.2 semitones over >= 80ms)
    let glideStartIdx = 0;
    let glideDir: 'ascending' | 'descending' | null = null;
    for (let i = 1; i < seg.length; i++) {
      const step = seg[i].p - seg[i - 1].p;
      const stepDir: 'ascending' | 'descending' | null =
        step > 0.08 ? 'ascending' : step < -0.08 ? 'descending' : null;

      if (stepDir !== null && (glideDir === null || stepDir === glideDir)) {
        glideDir = stepDir;
      } else {
        // Flush glide if qualified
        if (glideDir !== null) {
          const endIdx = i - 1;
          const durSec = seg[endIdx].timeSec - seg[glideStartIdx].timeSec;
          const excursion = Math.abs(seg[endIdx].p - seg[glideStartIdx].p);
          if (durSec >= 0.08 && excursion >= 1.2) {
            glides.push({
              startTimeSec: Number(seg[glideStartIdx].timeSec.toFixed(2)),
              endTimeSec: Number(seg[endIdx].timeSec.toFixed(2)),
              durationMs: Math.round(durSec * 1000),
              direction: glideDir,
              excursionSemitones: Number(excursion.toFixed(2)),
              meanSlopeSemitonesPerSec: Number((excursion / durSec).toFixed(2)),
            });
          }
        }
        glideStartIdx = i - 1;
        glideDir = stepDir;
      }
    }
    if (glideDir !== null) {
      const endIdx = seg.length - 1;
      const durSec = seg[endIdx].timeSec - seg[glideStartIdx].timeSec;
      const excursion = Math.abs(seg[endIdx].p - seg[glideStartIdx].p);
      if (durSec >= 0.08 && excursion >= 1.2) {
        glides.push({
          startTimeSec: Number(seg[glideStartIdx].timeSec.toFixed(2)),
          endTimeSec: Number(seg[endIdx].timeSec.toFixed(2)),
          durationMs: Math.round(durSec * 1000),
          direction: glideDir,
          excursionSemitones: Number(excursion.toFixed(2)),
          meanSlopeSemitonesPerSec: Number((excursion / durSec).toFixed(2)),
        });
      }
    }

    // Detect local pitch oscillation via slope sign changes
    if (seg.length >= 8) {
      let lastExtremumP = seg[0].p;
      let lastExtremumT = seg[0].timeSec;
      let prevSign = 0;
      for (let i = 1; i < seg.length; i++) {
        const diff = seg[i].p - seg[i - 1].p;
        const sign = diff > 0.03 ? 1 : diff < -0.03 ? -1 : 0;
        if (sign !== 0 && prevSign !== 0 && sign !== prevSign) {
          const swing = Math.abs(seg[i - 1].p - lastExtremumP);
          const halfPeriod = seg[i - 1].timeSec - lastExtremumT;
          if (
            swing >= 0.15 &&
            swing <= 3.5 &&
            halfPeriod >= 0.04 &&
            halfPeriod <= 0.6
          ) {
            oscHalfPeriodsSec.push(halfPeriod);
            localOscExtents.push(swing);
          }
          lastExtremumP = seg[i - 1].p;
          lastExtremumT = seg[i - 1].timeSec;
        }
        if (sign !== 0) prevSign = sign;
      }
    }
  }

  const meanLocalExcursion = segExcursionSum / segments.length;
  const meanSlope =
    slopesAbs.length > 0
      ? slopesAbs.reduce((a, b) => a + b, 0) / slopesAbs.length
      : 0;
  const meanCurvature =
    curvaturesAbs.length > 0
      ? curvaturesAbs.reduce((a, b) => a + b, 0) / curvaturesAbs.length
      : 0;

  const ascendingGlides = glides.filter((g) => g.direction === 'ascending').length;
  const descendingGlides = glides.filter((g) => g.direction === 'descending').length;
  const meanGlideDurationMs =
    glides.length > 0
      ? Math.round(glides.reduce((acc, g) => acc + g.durationMs, 0) / glides.length)
      : 0;

  let oscillationRateHz: number | null = null;
  if (oscHalfPeriodsSec.length >= 3) {
    const sortedHalf = [...oscHalfPeriodsSec].sort((a, b) => a - b);
    const medianHalf = sortedHalf[Math.floor(sortedHalf.length / 2)];
    if (medianHalf > 0) {
      oscillationRateHz = Number((1 / (2 * medianHalf)).toFixed(2));
    }
  }
  const oscillationExtentSemitones =
    localOscExtents.length > 0
      ? Number(
          (
            localOscExtents.reduce((a, b) => a + b, 0) / localOscExtents.length
          ).toFixed(2),
        )
      : null;

  let contourShapeSummary = 'Predominantly steady sustained notes with minimal inflection.';
  if (glides.length >= 3 && oscillationRateHz !== null && oscillationRateHz >= 2.5) {
    contourShapeSummary =
      'Combined meend-like continuous pitch glides and periodic pitch oscillations across voiced phrases.';
  } else if (glides.length >= 2) {
    contourShapeSummary =
      'Continuous pitch glides (meend-like transitions) dominate over purely stepped note changes.';
  } else if (oscillationRateHz !== null && oscillationRateHz >= 2.0) {
    contourShapeSummary =
      'Sustained pitch centers modulated by local periodic oscillations (kampita/andolan-like movement).';
  }

  const totalSegDurationSec = segments.reduce(
    (acc, seg) => acc + (seg[seg.length - 1].timeSec - seg[0].timeSec),
    0,
  );
  if (totalSegDurationSec < 2.0) {
    warnings.push(
      'Short voiced duration (< 2.0s) limits statistical stability of modulation rate and curvature averages.',
    );
  }

  return {
    maxPitchExcursionSemitones: Number(maxExcursion.toFixed(2)),
    meanLocalExcursionSemitones: Number(meanLocalExcursion.toFixed(2)),
    detectedGlideCount: glides.length,
    ascendingGlides,
    descendingGlides,
    meanGlideDurationMs,
    oscillationRateHz,
    oscillationExtentSemitones,
    meanPitchSlopeAbs: Number(meanSlope.toFixed(2)),
    meanContourCurvature: Number(meanCurvature.toFixed(2)),
    contourShapeSummary,
    sampleGlides: glides.slice(0, 6),
    interpretationBoundaryNote: boundaryNote,
    warnings,
  };
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { runRagaClassifier } from '../server/classifier/ragaClassifier.ts';
import { computeDtwDistance, matchPakadReferences } from '../server/pakad/pakadMatcher.ts';
import { loadPakadReferences, loadRagas } from '../server/services/dataLoader.ts';

test('Raga library and Pakad references load cleanly and separate traditions', async () => {
  const [ragas, pakads] = await Promise.all([
    loadRagas(),
    loadPakadReferences(),
  ]);
  assert.ok(ragas.length >= 10);
  const hindustani = ragas.filter((r) => r.tradition === 'Hindustani');
  const carnatic = ragas.filter((r) => r.tradition === 'Carnatic');
  assert.ok(hindustani.length >= 6);
  assert.ok(carnatic.length >= 3);
  assert.ok(carnatic.every((r) => r.classifierScopeSupported === false));
  assert.ok(pakads.length >= 6);
});

test('DTW Pakad matcher ranks Yaman phrase highest for Yaman sequence', async () => {
  const pakads = await loadPakadReferences();
  const observed = [
    { swara: 'S', semitone: 0, durationSec: 0.7 },
    { swara: 'N.', semitone: -1, durationSec: 0.5 },
    { swara: 'R', semitone: 2, durationSec: 0.5 },
    { swara: 'G', semitone: 4, durationSec: 0.8 },
    { swara: 'M+', semitone: 6, durationSec: 0.6 },
    { swara: 'D', semitone: 9, durationSec: 0.5 },
    { swara: 'N', semitone: 11, durationSec: 0.5 },
    { swara: "S'", semitone: 12, durationSec: 0.8 },
  ];

  assert.equal(computeDtwDistance([0, 2, 4], [0, 2, 4]), 0);
  const res = matchPakadReferences(observed, pakads, true);
  assert.equal(res.status, 'matched');
  assert.ok(res.bestMatch !== null);
  assert.equal(res.bestMatch.ragaId, 'yaman');
  assert.ok(res.bestMatch.similarityScore > 0.75);
});

test('DTW Pakad matcher reports insufficient_data for very short sequences', async () => {
  const pakads = await loadPakadReferences();
  const res = matchPakadReferences(
    [
      { swara: 'S', semitone: 0, durationSec: 0.5 },
      { swara: 'R', semitone: 2, durationSec: 0.5 },
    ],
    pakads,
    true,
  );
  assert.equal(res.status, 'insufficient_data');
  assert.equal(res.bestMatch, null);
});

test('Classifier honestly reports unconfigured state when RAGA_MODEL_API_URL is unset', async () => {
  const prevUrl = process.env.RAGA_MODEL_API_URL;
  delete process.env.RAGA_MODEL_API_URL;

  try {
    const result = await runRagaClassifier(
      {
        tonicHz: 146.83,
        tonicReliability: 'high',
        voicedRatio: 0.85,
        features: {
          relativePitchMean: 3.5,
          relativePitchStd: 2.1,
          pitchRangeSemitones: 12,
          ascendingTransitions: 20,
          descendingTransitions: 15,
          stationaryTransitions: 80,
          meanIntervalMagnitude: 1.1,
          pitchClassDistribution: [],
          observedSequence: [],
          spectralFeatures: {
            meanSpectralCentroidHz: 450,
            meanSpectralFlatness: 0.05,
            meanZeroCrossingRate: 0.03,
          },
        },
        gamaka: {
          maxPitchExcursionSemitones: 7,
          meanLocalExcursionSemitones: 3,
          detectedGlideCount: 3,
          ascendingGlides: 2,
          descendingGlides: 1,
          meanGlideDurationMs: 220,
          oscillationRateHz: 4.1,
          oscillationExtentSemitones: 0.25,
          meanPitchSlopeAbs: 3.4,
          meanContourCurvature: 12.1,
          contourShapeSummary: 'Combined glides and oscillation',
          sampleGlides: [],
          interpretationBoundaryNote: 'Boundary',
          warnings: [],
        },
        pakad: {
          status: 'insufficient_data',
          observedSwaraSequenceText: '',
          observedSemitoneSequence: [],
          topMatches: [],
          bestMatch: null,
          warnings: [],
        },
      },
      {
        frameHopSec: 0.02,
        totalFrames: 100,
        voicedFrames: 85,
        unvoicedFrames: 15,
        voicedRatio: 0.85,
        minFrequencyHz: 138,
        maxFrequencyHz: 293,
        medianFrequencyHz: 196,
        contour: [],
        warnings: [],
      },
      {
        estimatedFrequencyHz: 146.83,
        nearestWesternNote: 'D3',
        centsDeviation: 0,
        reliability: 'high',
        confidenceScore: 0.88,
        candidateFrequenciesHz: [],
        warnings: [],
        method: 'test',
      },
    );

    assert.equal(result.status, 'classifier_not_configured');
    assert.equal(result.predictedRaga, null);
    assert.match(result.statusMessage, /not yet trained or connected/i);
  } finally {
    if (prevUrl !== undefined) {
      process.env.RAGA_MODEL_API_URL = prevUrl;
    }
  }
});

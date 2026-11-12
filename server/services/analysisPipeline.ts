import crypto from 'node:crypto';
import type {
  AnalysisResponse,
  PipelineStageResult,
} from '../../src/types/svara.ts';
import { decodeAndValidateAudioFile } from '../audio/decoder.ts';
import {
  buildPitchExtractionResult,
  extractRawPitchFrames,
} from '../audio/pitchTracker.ts';
import { preprocessAudio } from '../audio/preprocessing.ts';
import { estimateTonic } from '../audio/tonicEstimator.ts';
import { runHybridFusion } from '../classifier/fusionEngine.ts';
import { runRagaClassifier } from '../classifier/ragaClassifier.ts';
import { extractMelodicFeatures } from '../features/featureExtractor.ts';
import { analyzeGamakaDescriptors } from '../gamaka/gamakaAnalyzer.ts';
import { matchPakadReferences } from '../pakad/pakadMatcher.ts';
import { loadPakadReferences } from './dataLoader.ts';
import { buildExplainabilityReport } from './explainabilityService.ts';

export async function runFullAudioAnalysis(params: {
  filePath: string;
  originalFileName: string;
  fileSizeBytes: number;
  maxUploadBytes: number;
}): Promise<AnalysisResponse> {
  const stages: PipelineStageResult[] = [];

  // Stage 1: Audio validation & decoding
  const t1 = performance.now();
  const decoded = await decodeAndValidateAudioFile(
    params.filePath,
    params.originalFileName,
    params.maxUploadBytes,
  );
  stages.push({
    id: 'validation',
    label: 'Audio validation',
    status: 'completed',
    durationMs: Math.round(performance.now() - t1),
    summary: `Validated ${decoded.format.toUpperCase()} (${decoded.sampleRate} Hz, ${decoded.channels} ch, ${decoded.durationSeconds.toFixed(1)}s).`,
  });

  // Stage 2: Audio preprocessing
  const t2 = performance.now();
  const prep = preprocessAudio(decoded.samples, decoded.sampleRate);
  stages.push({
    id: 'preprocessing',
    label: 'Audio preprocessing',
    status: prep.warnings.length > 0 ? 'warning' : 'completed',
    durationMs: Math.round(performance.now() - t2),
    summary: `DC removed and normalized; ${(prep.activeEnergyRatio * 100).toFixed(0)}% active acoustic frames.`,
  });

  // Stage 3 & 4: Raw YIN pitch extraction followed by tonic estimation & normalization
  const t3 = performance.now();
  const rawFrames = extractRawPitchFrames(prep.samples, prep.sampleRate);
  const tonic = estimateTonic(rawFrames);
  stages.push({
    id: 'tonic_estimation',
    label: 'Tonic estimation',
    status:
      tonic.reliability === 'unreliable' || tonic.reliability === 'low'
        ? 'warning'
        : 'completed',
    durationMs: Math.round(performance.now() - t3),
    summary:
      tonic.estimatedFrequencyHz !== null
        ? `Estimated Sa at ${tonic.estimatedFrequencyHz} Hz (${tonic.nearestWesternNote}, ${tonic.reliability} reliability).`
        : 'Could not determine a reliable tonic center.',
  });

  const t4 = performance.now();
  const pitch = buildPitchExtractionResult(rawFrames, tonic.estimatedFrequencyHz);
  stages.push({
    id: 'pitch_extraction',
    label: 'Pitch extraction',
    status: pitch.warnings.length > 0 ? 'warning' : 'completed',
    durationMs: Math.round(performance.now() - t4),
    summary: `Tracked ${pitch.voicedFrames}/${pitch.totalFrames} voiced F0 frames (${(pitch.voicedRatio * 100).toFixed(0)}%) normalised to Sa.`,
  });

  // Stage 5: Melodic feature extraction
  const t5 = performance.now();
  const features = extractMelodicFeatures(
    rawFrames,
    prep.samples,
    prep.sampleRate,
    tonic.estimatedFrequencyHz,
  );
  stages.push({
    id: 'feature_extraction',
    label: 'Melodic feature extraction',
    status: features.observedSequence.length === 0 ? 'warning' : 'completed',
    durationMs: Math.round(performance.now() - t5),
    summary: `Extracted 12-bin Swara distribution, ${features.observedSequence.length} note segments, and spectral centroid (${features.spectralFeatures.meanSpectralCentroidHz} Hz).`,
  });

  // Stage 6: Gamaka analysis
  const t6 = performance.now();
  const gamaka = analyzeGamakaDescriptors(rawFrames, tonic.estimatedFrequencyHz);
  stages.push({
    id: 'gamaka_analysis',
    label: 'Gamaka analysis',
    status: gamaka.warnings.length > 0 ? 'warning' : 'completed',
    durationMs: Math.round(performance.now() - t6),
    summary: `Measured ${gamaka.detectedGlideCount} pitch glides and max excursion ${gamaka.maxPitchExcursionSemitones} semitones.`,
  });

  // Stage 7: Pakad matching
  const t7 = performance.now();
  const pakadRefs = await loadPakadReferences();
  const hindustaniRefs = pakadRefs.filter((p) => p.tradition === 'Hindustani');
  const pakad = matchPakadReferences(
    features.observedSequence,
    hindustaniRefs,
    tonic.reliability !== 'unreliable',
  );
  stages.push({
    id: 'pakad_matching',
    label: 'Pakad matching',
    status: pakad.status === 'insufficient_data' ? 'warning' : 'completed',
    durationMs: Math.round(performance.now() - t7),
    summary:
      pakad.bestMatch !== null
        ? `Aligned against ${hindustaniRefs.length} curated references; closest match ${pakad.bestMatch.ragaName} (${pakad.bestMatch.similarityScore.toFixed(2)}).`
        : 'Insufficient melodic sequence length for curated Pakad DTW alignment.',
  });

  // Stage 8: Raga classification
  const t8 = performance.now();
  const classification = await runRagaClassifier(
    {
      tonicHz: tonic.estimatedFrequencyHz,
      tonicReliability: tonic.reliability,
      voicedRatio: pitch.voicedRatio,
      features,
      gamaka,
      pakad,
    },
    pitch,
    tonic,
  );
  stages.push({
    id: 'raga_classification',
    label: 'Raga classification',
    status:
      classification.status === 'prediction_completed'
        ? 'completed'
        : classification.status === 'classifier_not_configured'
          ? 'skipped'
          : 'warning',
    durationMs: Math.round(performance.now() - t8),
    summary: classification.statusMessage,
  });

  // Stage 9: Fusion & Explainable Results generation
  const t9 = performance.now();
  const fusion = runHybridFusion(classification, tonic, features, gamaka, pakad);

  const uncertaintyWarnings = Array.from(
    new Set([
      ...prep.warnings,
      ...tonic.warnings,
      ...pitch.warnings,
      ...gamaka.warnings,
      ...pakad.warnings,
      ...classification.uncertaintyReasons,
    ]),
  );

  const explainability = await buildExplainabilityReport({
    tonic,
    pitch,
    features,
    gamaka,
    pakad,
    classification,
    uncertaintyWarnings,
  });

  stages.push({
    id: 'results_generation',
    label: 'Results generation',
    status: 'completed',
    durationMs: Math.round(performance.now() - t9),
    summary: 'Assembled structured telemetry, fusion breakdown, and explainability report.',
  });

  return {
    analysisId: crypto.randomUUID(),
    timestampIso: new Date().toISOString(),
    audio: {
      fileName: params.originalFileName,
      format: decoded.format,
      fileSizeBytes: params.fileSizeBytes,
      durationSeconds: Number(decoded.durationSeconds.toFixed(2)),
      sampleRate: decoded.sampleRate,
      channels: decoded.channels,
      peakAmplitude: Number(decoded.peakAmplitude.toFixed(4)),
      rmsEnergy: Number(decoded.rmsEnergy.toFixed(4)),
      voicedFrameRatio: pitch.voicedRatio,
    },
    stages,
    tonic,
    pitch,
    features,
    gamaka,
    pakad,
    classification,
    fusion,
    explainability,
    uncertaintyWarnings,
  };
}

import type {
  FusionWeightsConfig,
  GamakaAnalysisResult,
  HybridFusionResult,
  MelodicFeaturesResult,
  PakadMatchingResult,
  RagaClassificationResult,
  TonicEstimationResult,
} from '../../src/types/svara.ts';

export const DEFAULT_FUSION_WEIGHTS: FusionWeightsConfig = {
  classifierWeight: 0.45,
  pitchDistributionWeight: 0.2,
  gamakaWeight: 0.15,
  pakadWeight: 0.2,
  calibrated: false,
};

export function runHybridFusion(
  classification: RagaClassificationResult,
  tonic: TonicEstimationResult,
  features: MelodicFeaturesResult,
  gamaka: GamakaAnalysisResult,
  pakad: PakadMatchingResult,
  weights: FusionWeightsConfig = DEFAULT_FUSION_WEIGHTS,
): HybridFusionResult {
  const topPitchClasses = features.pitchClassDistribution
    .filter((b) => b.proportion >= 0.08)
    .sort((a, b) => b.proportion - a.proportion)
    .slice(0, 4)
    .map((b) => `${b.swaraLabel} (${(b.proportion * 100).toFixed(0)}%)`)
    .join(', ');

  const classifierAvailable =
    classification.status === 'prediction_completed' &&
    classification.predictedRaga !== null;

  const evidenceSummary = [
    {
      modality: 'Learned ML Classifier',
      available: classifierAvailable,
      weight: weights.classifierWeight,
      observation: classifierAvailable
        ? `${classification.predictedRaga?.ragaName} (score ${classification.predictedRaga?.score.toFixed(3)})`
        : classification.statusMessage,
    },
    {
      modality: 'Tonic-Normalised Pitch Distribution',
      available: tonic.estimatedFrequencyHz !== null && tonic.reliability !== 'unreliable',
      weight: weights.pitchDistributionWeight,
      observation:
        tonic.estimatedFrequencyHz !== null
          ? `Sa ≈ ${tonic.estimatedFrequencyHz} Hz (${tonic.nearestWesternNote}); prominent Svaras: ${topPitchClasses || 'sparse'}`
          : 'Tonic could not be reliably estimated.',
    },
    {
      modality: 'Gamaka Contour Descriptors',
      available: gamaka.detectedGlideCount > 0 || gamaka.oscillationRateHz !== null,
      weight: weights.gamakaWeight,
      observation: `${gamaka.detectedGlideCount} glides detected; max excursion ${gamaka.maxPitchExcursionSemitones} st${gamaka.oscillationRateHz !== null ? `; modulation ${gamaka.oscillationRateHz} Hz` : ''}`,
    },
    {
      modality: 'DTW Pakad Sequence Matching',
      available: pakad.status === 'matched' && pakad.bestMatch !== null,
      weight: weights.pakadWeight,
      observation:
        pakad.bestMatch !== null
          ? `Closest curated motif: ${pakad.bestMatch.ragaName} (${pakad.bestMatch.referenceNotation}, similarity ${pakad.bestMatch.similarityScore.toFixed(2)})`
          : 'Insufficient melodic sequence for Pakad alignment.',
    },
  ];

  return {
    weights,
    fusionApplied: classifierAvailable,
    evidenceSummary,
    note: weights.calibrated
      ? 'Fusion weights calibrated on held-out validation recordings.'
      : 'Fusion weights are currently uncalibrated architectural defaults and await validation-set calibration once a trained ML classifier is connected.',
  };
}

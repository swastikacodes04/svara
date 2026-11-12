export type MusicalTradition = 'Hindustani' | 'Carnatic';

export type VerificationStatus = 'Verified' | 'Pending verification';

export interface RagaProfile {
  id: string;
  name: string;
  tradition: MusicalTradition;
  thaat: string;
  aarohana: string;
  avarohana: string;
  vadi: string;
  samvadi: string;
  pakad: string;
  importantSvaras: string[];
  characteristicMovements: string;
  musicalCharacteristics: string;
  relatedRagas: string[];
  performanceTime: string;
  verificationStatus: VerificationStatus;
  sourceNote: string;
  classifierScopeSupported: boolean;
}

export interface PakadReference {
  id: string;
  ragaId: string;
  ragaName: string;
  tradition: MusicalTradition;
  notation: string;
  semitoneSequence: number[];
  description: string;
  verificationStatus: VerificationStatus;
}

export type PipelineStageId =
  | 'validation'
  | 'preprocessing'
  | 'tonic_estimation'
  | 'pitch_extraction'
  | 'feature_extraction'
  | 'gamaka_analysis'
  | 'pakad_matching'
  | 'raga_classification'
  | 'results_generation';

export type StageStatus = 'completed' | 'warning' | 'skipped' | 'failed';

export interface PipelineStageResult {
  id: PipelineStageId;
  label: string;
  status: StageStatus;
  durationMs: number;
  summary: string;
}

export interface AudioMetadataSummary {
  fileName: string;
  format: 'wav' | 'mp3';
  fileSizeBytes: number;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  peakAmplitude: number;
  rmsEnergy: number;
  voicedFrameRatio: number;
}

export type ReliabilityLevel = 'high' | 'moderate' | 'low' | 'unreliable';

export interface TonicEstimationResult {
  estimatedFrequencyHz: number | null;
  nearestWesternNote: string;
  centsDeviation: number;
  reliability: ReliabilityLevel;
  confidenceScore: number;
  candidateFrequenciesHz: Array<{ frequencyHz: number; note: string; prominence: number }>;
  warnings: string[];
  method: string;
}

export interface PitchContourPoint {
  timeSec: number;
  frequencyHz: number | null;
  relativeSemitones: number | null;
  confidence: number;
  voiced: boolean;
  nearestSwara: string | null;
}

export interface PitchExtractionResult {
  frameHopSec: number;
  totalFrames: number;
  voicedFrames: number;
  unvoicedFrames: number;
  voicedRatio: number;
  minFrequencyHz: number | null;
  maxFrequencyHz: number | null;
  medianFrequencyHz: number | null;
  contour: PitchContourPoint[];
  warnings: string[];
}

export interface PitchClassBin {
  semitoneIndex: number;
  swaraLabel: string;
  westernOffsetLabel: string;
  proportion: number;
  frameCount: number;
}

export interface MelodicFeaturesResult {
  relativePitchMean: number;
  relativePitchStd: number;
  pitchRangeSemitones: number;
  ascendingTransitions: number;
  descendingTransitions: number;
  stationaryTransitions: number;
  meanIntervalMagnitude: number;
  pitchClassDistribution: PitchClassBin[];
  observedSequence: Array<{
    swara: string;
    semitone: number;
    durationSec: number;
  }>;
  spectralFeatures: {
    meanSpectralCentroidHz: number;
    meanSpectralFlatness: number;
    meanZeroCrossingRate: number;
  };
}

export interface GamakaGlideEvent {
  startTimeSec: number;
  endTimeSec: number;
  durationMs: number;
  direction: 'ascending' | 'descending';
  excursionSemitones: number;
  meanSlopeSemitonesPerSec: number;
}

export interface GamakaAnalysisResult {
  maxPitchExcursionSemitones: number;
  meanLocalExcursionSemitones: number;
  detectedGlideCount: number;
  ascendingGlides: number;
  descendingGlides: number;
  meanGlideDurationMs: number;
  oscillationRateHz: number | null;
  oscillationExtentSemitones: number | null;
  meanPitchSlopeAbs: number;
  meanContourCurvature: number;
  contourShapeSummary: string;
  sampleGlides: GamakaGlideEvent[];
  interpretationBoundaryNote: string;
  warnings: string[];
}

export interface PakadMatchCandidate {
  matchedPhraseId: string;
  ragaId: string;
  ragaName: string;
  referenceNotation: string;
  referenceSequence: number[];
  observedSubsequence: number[];
  observedSwaraText: string;
  dtwDistance: number;
  similarityScore: number;
  matchStatus:
    | 'Strong subsequence alignment'
    | 'Partial melodic similarity'
    | 'Weak or no curated match'
    | 'Insufficient melodic sequence';
}

export interface PakadMatchingResult {
  status: 'matched' | 'weak_or_none' | 'insufficient_data';
  observedSwaraSequenceText: string;
  observedSemitoneSequence: number[];
  topMatches: PakadMatchCandidate[];
  bestMatch: PakadMatchCandidate | null;
  warnings: string[];
}

export type ClassificationStatus =
  | 'prediction_completed'
  | 'classifier_not_configured'
  | 'prediction_rejected_uncertainty'
  | 'classifier_error';

export interface ClassifierCandidate {
  ragaId: string;
  ragaName: string;
  tradition: MusicalTradition;
  score: number;
}

export interface RagaClassificationResult {
  status: ClassificationStatus;
  traditionScope: MusicalTradition;
  predictedRaga: ClassifierCandidate | null;
  alternativeCandidates: ClassifierCandidate[];
  modelConfigured: boolean;
  modelVersion: string | null;
  supportedClasses: string[];
  calibratedConfidence: number | null;
  uncertaintyReasons: string[];
  statusMessage: string;
}

export interface FusionWeightsConfig {
  classifierWeight: number;
  pitchDistributionWeight: number;
  gamakaWeight: number;
  pakadWeight: number;
  calibrated: boolean;
}

export interface HybridFusionResult {
  weights: FusionWeightsConfig;
  fusionApplied: boolean;
  evidenceSummary: Array<{
    modality: string;
    available: boolean;
    weight: number;
    observation: string;
  }>;
  note: string;
}

export interface ExplainabilityReport {
  headline: string;
  detectedObservations: string[];
  supportingEvidence: string[];
  unavailableOrWeakModules: string[];
  uncertaintyExplanation: string[];
  narrativeSummary: string;
  narrativeSource: 'deterministic_evidence' | 'gemini_grounded_synthesis';
}

export interface AnalysisResponse {
  analysisId: string;
  timestampIso: string;
  audio: AudioMetadataSummary;
  stages: PipelineStageResult[];
  tonic: TonicEstimationResult;
  pitch: PitchExtractionResult;
  features: MelodicFeaturesResult;
  gamaka: GamakaAnalysisResult;
  pakad: PakadMatchingResult;
  classification: RagaClassificationResult;
  fusion: HybridFusionResult;
  explainability: ExplainabilityReport;
  uncertaintyWarnings: string[];
}

export interface HealthResponse {
  status: 'ok';
  service: string;
  audioEngineReady: boolean;
  classifierConfigured: boolean;
  geminiExplainabilityConfigured: boolean;
  supportedClassifierTradition: MusicalTradition;
  ragaLibraryCount: number;
  pakadReferenceCount: number;
}

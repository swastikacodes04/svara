import type {
  ClassifierCandidate,
  GamakaAnalysisResult,
  MelodicFeaturesResult,
  PakadMatchingResult,
  PitchExtractionResult,
  RagaClassificationResult,
  TonicEstimationResult,
} from '../../src/types/svara.ts';

export interface ModelPredictionPayload {
  modelVersion: string;
  supportedClasses: string[];
  predictions: Array<{
    ragaId: string;
    ragaName: string;
    score: number;
  }>;
  uncertainty?: {
    rejected?: boolean;
    reason?: string;
  };
}

export interface ClassifierFeatureInput {
  tonicHz: number | null;
  tonicReliability: string;
  voicedRatio: number;
  features: MelodicFeaturesResult;
  gamaka: GamakaAnalysisResult;
  pakad: PakadMatchingResult;
}

export async function runRagaClassifier(
  input: ClassifierFeatureInput,
  pitch: PitchExtractionResult,
  tonic: TonicEstimationResult,
): Promise<RagaClassificationResult> {
  const modelUrl = process.env.RAGA_MODEL_API_URL?.trim() ?? '';
  const modelKey = process.env.RAGA_MODEL_API_KEY?.trim() ?? '';

  const uncertaintyReasons: string[] = [];

  if (pitch.voicedRatio < 0.25 || pitch.voicedFrames < 20) {
    uncertaintyReasons.push(
      `Weak pitch information (only ${(pitch.voicedRatio * 100).toFixed(0)}% voiced frames).`,
    );
  }
  if (tonic.reliability === 'unreliable' || tonic.estimatedFrequencyHz === null) {
    uncertaintyReasons.push(
      'Estimated tonic (Sa) is unreliable, preventing trustworthy tonic-normalised classification.',
    );
  }

  // Case 1: External trained classifier is not configured
  if (!modelUrl) {
    return {
      status: 'classifier_not_configured',
      traditionScope: 'Hindustani',
      predictedRaga: null,
      alternativeCandidates: [],
      modelConfigured: false,
      modelVersion: null,
      supportedClasses: [],
      calibratedConfidence: null,
      uncertaintyReasons: [
        'Raga classification model not yet trained or connected (RAGA_MODEL_API_URL is unset).',
        ...uncertaintyReasons,
      ],
      statusMessage:
        'Raga classification model not yet trained or connected. Acoustic signal extraction, tonic estimation, Gamaka descriptors, and DTW Pakad matching completed without fabricating a classifier prediction.',
    };
  }

  // Case 2: Pre-flight uncertainty gating before calling external classifier
  if (uncertaintyReasons.length > 0) {
    return {
      status: 'prediction_rejected_uncertainty',
      traditionScope: 'Hindustani',
      predictedRaga: null,
      alternativeCandidates: [],
      modelConfigured: true,
      modelVersion: null,
      supportedClasses: [],
      calibratedConfidence: null,
      uncertaintyReasons,
      statusMessage:
        'Classification withheld due to insufficient acoustic or tonic reliability.',
    };
  }

  // Case 3: Call configured Python / FastAPI ML inference endpoint
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (modelKey) {
      headers.Authorization = `Bearer ${modelKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(modelUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        traditionScope: 'Hindustani',
        ...input,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        status: 'classifier_error',
        traditionScope: 'Hindustani',
        predictedRaga: null,
        alternativeCandidates: [],
        modelConfigured: true,
        modelVersion: null,
        supportedClasses: [],
        calibratedConfidence: null,
        uncertaintyReasons: [
          `External Raga model endpoint returned HTTP ${response.status}.`,
        ],
        statusMessage: `External Raga classifier service responded with HTTP ${response.status}. Acoustic analysis remains available.`,
      };
    }

    const payload = (await response.json()) as ModelPredictionPayload;
    if (!Array.isArray(payload.predictions) || payload.predictions.length === 0) {
      return {
        status: 'prediction_rejected_uncertainty',
        traditionScope: 'Hindustani',
        predictedRaga: null,
        alternativeCandidates: [],
        modelConfigured: true,
        modelVersion: payload.modelVersion ?? null,
        supportedClasses: payload.supportedClasses ?? [],
        calibratedConfidence: null,
        uncertaintyReasons: [
          payload.uncertainty?.reason ??
            'External classifier returned no confident candidate predictions.',
        ],
        statusMessage:
          'External classifier withheld a prediction due to low confidence or out-of-scope features.',
      };
    }

    const ranked: ClassifierCandidate[] = payload.predictions
      .slice()
      .sort((a, b) => b.score - a.score)
      .map((p) => ({
        ragaId: p.ragaId,
        ragaName: p.ragaName,
        tradition: 'Hindustani',
        score: Number(p.score.toFixed(4)),
      }));

    const top = ranked[0];
    const second = ranked[1];
    const margin = second ? top.score - second.score : top.score;

    if (payload.uncertainty?.rejected || top.score < 0.45 || (second && margin < 0.08)) {
      const reasons: string[] = [];
      if (payload.uncertainty?.reason) reasons.push(payload.uncertainty.reason);
      if (top.score < 0.45) {
        reasons.push(`Top model score (${top.score.toFixed(2)}) is below reliability threshold.`);
      }
      if (second && margin < 0.08) {
        reasons.push(
          `Multiple candidate Ragas (${top.ragaName} vs ${second.ragaName}) have closely matched evidence.`,
        );
      }

      return {
        status: 'prediction_rejected_uncertainty',
        traditionScope: 'Hindustani',
        predictedRaga: null,
        alternativeCandidates: ranked.slice(0, 4),
        modelConfigured: true,
        modelVersion: payload.modelVersion ?? 'external',
        supportedClasses: payload.supportedClasses ?? [],
        calibratedConfidence: top.score,
        uncertaintyReasons: reasons,
        statusMessage:
          'Prediction withheld due to high classification ambiguity across candidate Ragas.',
      };
    }

    return {
      status: 'prediction_completed',
      traditionScope: 'Hindustani',
      predictedRaga: top,
      alternativeCandidates: ranked.slice(1, 5),
      modelConfigured: true,
      modelVersion: payload.modelVersion ?? 'external',
      supportedClasses: payload.supportedClasses ?? [],
      calibratedConfidence: top.score,
      uncertaintyReasons: [],
      statusMessage: 'Raga classification completed via configured external inference model.',
    };
  } catch (err) {
    return {
      status: 'classifier_error',
      traditionScope: 'Hindustani',
      predictedRaga: null,
      alternativeCandidates: [],
      modelConfigured: true,
      modelVersion: null,
      supportedClasses: [],
      calibratedConfidence: null,
      uncertaintyReasons: [
        `Could not connect to external Raga classifier endpoint (${err instanceof Error ? err.message : 'network error'}).`,
      ],
      statusMessage:
        'External Raga classifier service is configured but unreachable. Acoustic features and Pakad matching remain available.',
    };
  }
}

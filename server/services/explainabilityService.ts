import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type {
  ExplainabilityReport,
  GamakaAnalysisResult,
  MelodicFeaturesResult,
  PakadMatchingResult,
  PitchExtractionResult,
  RagaClassificationResult,
  TonicEstimationResult,
} from '../../src/types/svara.ts';

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim() ?? '';
  return Boolean(key && key !== 'MY_GEMINI_API_KEY' && key !== 'YOUR_API_KEY');
}

export async function buildExplainabilityReport(params: {
  tonic: TonicEstimationResult;
  pitch: PitchExtractionResult;
  features: MelodicFeaturesResult;
  gamaka: GamakaAnalysisResult;
  pakad: PakadMatchingResult;
  classification: RagaClassificationResult;
  uncertaintyWarnings: string[];
}): Promise<ExplainabilityReport> {
  const {
    tonic,
    pitch,
    features,
    gamaka,
    pakad,
    classification,
    uncertaintyWarnings,
  } = params;

  const detectedObservations: string[] = [];
  const supportingEvidence: string[] = [];
  const unavailableOrWeakModules: string[] = [];
  const uncertaintyExplanation: string[] = [...uncertaintyWarnings];

  if (tonic.estimatedFrequencyHz !== null) {
    detectedObservations.push(
      `Estimated Tonic (Sa) at ${tonic.estimatedFrequencyHz} Hz (${tonic.nearestWesternNote}, ${tonic.centsDeviation >= 0 ? '+' : ''}${tonic.centsDeviation} cents) with ${tonic.reliability} reliability.`,
    );
  } else {
    unavailableOrWeakModules.push('Tonic Estimation: failed to converge on a stable pitch center.');
  }

  detectedObservations.push(
    `Extracted ${pitch.voicedFrames} voiced frames out of ${pitch.totalFrames} (${(pitch.voicedRatio * 100).toFixed(1)}% voiced coverage) spanning ${features.pitchRangeSemitones} semitones.`,
  );

  const activeSwaras = features.pitchClassDistribution
    .filter((b) => b.proportion >= 0.05)
    .sort((a, b) => b.proportion - a.proportion)
    .slice(0, 6)
    .map((b) => `${b.swaraLabel} (${(b.proportion * 100).toFixed(1)}%)`);

  if (activeSwaras.length > 0) {
    detectedObservations.push(
      `Prominent tonic-normalised pitch classes: ${activeSwaras.join(', ')}.`,
    );
  }

  if (gamaka.detectedGlideCount > 0 || gamaka.oscillationRateHz !== null) {
    supportingEvidence.push(
      `Gamaka descriptors measured ${gamaka.detectedGlideCount} continuous pitch glides (${gamaka.ascendingGlides} ascending, ${gamaka.descendingGlides} descending; mean duration ${gamaka.meanGlideDurationMs} ms) and maximum pitch excursion of ${gamaka.maxPitchExcursionSemitones} semitones.`,
    );
  } else {
    unavailableOrWeakModules.push(
      'Gamaka Analysis: minimal continuous glides or periodic pitch oscillations were detected.',
    );
  }

  if (pakad.bestMatch) {
    if (pakad.bestMatch.matchStatus === 'Strong subsequence alignment') {
      supportingEvidence.push(
        `DTW Pakad matcher aligned observed phrase "${pakad.bestMatch.observedSwaraText}" to curated ${pakad.bestMatch.ragaName} reference "${pakad.bestMatch.referenceNotation}" (similarity ${pakad.bestMatch.similarityScore.toFixed(2)}).`,
      );
    } else {
      supportingEvidence.push(
        `Closest curated Pakad phrase was ${pakad.bestMatch.ragaName} ("${pakad.bestMatch.referenceNotation}") with ${pakad.bestMatch.matchStatus.toLowerCase()} (similarity ${pakad.bestMatch.similarityScore.toFixed(2)}).`,
      );
    }
  } else {
    unavailableOrWeakModules.push(
      'Pakad Matching: observed melodic sequence was too short for DTW reference alignment.',
    );
  }

  if (classification.status === 'prediction_completed' && classification.predictedRaga) {
    supportingEvidence.push(
      `External ML classifier (${classification.modelVersion ?? 'configured model'}) scored ${classification.predictedRaga.ragaName} highest at ${classification.predictedRaga.score.toFixed(3)}.`,
    );
  } else if (classification.status === 'classifier_not_configured') {
    unavailableOrWeakModules.push(
      'Raga Classification Model: no trained external ML classifier is connected (RAGA_MODEL_API_URL unset).',
    );
  } else if (classification.status === 'prediction_rejected_uncertainty') {
    unavailableOrWeakModules.push(
      'Raga Classification Model: prediction withheld due to uncertainty gating.',
    );
  } else {
    unavailableOrWeakModules.push(
      'Raga Classification Model: external inference endpoint returned an error.',
    );
  }

  const headline =
    classification.status === 'prediction_completed' && classification.predictedRaga
      ? `Why did SVARA identify ${classification.predictedRaga.ragaName}?`
      : 'Why did SVARA withhold a final Raga prediction?';

  let narrativeSummary = [
    ...detectedObservations,
    ...supportingEvidence,
    ...unavailableOrWeakModules,
  ].join(' ');
  let narrativeSource: ExplainabilityReport['narrativeSource'] = 'deterministic_evidence';

  // Optional Gemini grounded synthesis with strict 3.5s latency cap
  if (isGeminiConfigured()) {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
          timeout: 3500,
        },
      });

      const groundedPayload = {
        classificationStatus: classification.status,
        predictedRaga: classification.predictedRaga,
        tonicHz: tonic.estimatedFrequencyHz,
        tonicNote: tonic.nearestWesternNote,
        tonicReliability: tonic.reliability,
        voicedRatio: pitch.voicedRatio,
        pitchRangeSemitones: features.pitchRangeSemitones,
        prominentSwaras: activeSwaras,
        gamakaGlides: gamaka.detectedGlideCount,
        gamakaOscillationHz: gamaka.oscillationRateHz,
        bestPakadMatch: pakad.bestMatch
          ? {
              ragaName: pakad.bestMatch.ragaName,
              referenceNotation: pakad.bestMatch.referenceNotation,
              similarityScore: pakad.bestMatch.similarityScore,
              matchStatus: pakad.bestMatch.matchStatus,
            }
          : null,
        uncertaintyWarnings,
      };

      const geminiPromise = ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Summarize the following SVARA acoustic analysis evidence in 3 concise, scholarly sentences:\n${JSON.stringify(groundedPayload)}`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'You are an explainability formatter for SVARA, an Indian classical music analysis tool. ' +
            'Strictly describe ONLY the numerical and musicological evidence provided in the JSON. ' +
            'NEVER invent a Raga prediction, confidence score, or missing observation. ' +
            'If classificationStatus is "classifier_not_configured", explicitly state that the trained ML Raga classifier is not yet connected and only acoustic/Pakad descriptors are reported.',
        },
      });

      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 3500);
      });

      const response = await Promise.race([geminiPromise, timeoutPromise]);
      const generated = response?.text?.trim();
      if (generated && generated.length > 20) {
        narrativeSummary = generated;
        narrativeSource = 'gemini_grounded_synthesis';
      }
    } catch {
      // Keep deterministic explanation cleanly if Gemini call fails or times out
    }
  }

  return {
    headline,
    detectedObservations,
    supportingEvidence,
    unavailableOrWeakModules,
    uncertaintyExplanation,
    narrativeSummary,
    narrativeSource,
  };
}

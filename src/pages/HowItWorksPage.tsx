import React from 'react';
import { ArrowDown } from 'lucide-react';

const ARCHITECTURE_STAGES = [
  {
    step: '01',
    name: 'Audio Input',
    summary:
      'Accepts WAV and MP3 recordings with magic-byte verification, file size bounds, duration gating (1s–15m), and safe temporary storage.',
    detail: 'Outputs validated binary audio streams ready for PCM decoding.',
  },
  {
    step: '02',
    name: 'Preprocessing',
    summary:
      'Downmixes multi-channel recordings to mono, removes DC offset, detects clipping, normalizes headroom, and measures active energy frames.',
    detail: 'Flags silent or clipped recordings before downstream pitch errors propagate.',
  },
  {
    step: '03',
    name: 'Tonic Estimation',
    summary:
      'Constructs a 10-cent chroma histogram weighted by frame RMS and pitch stability, reinforced by harmonic fifth (Pa) consonance.',
    detail: 'Returns estimated Sa (Hz), nearest Shruti/note, and reliability grade.',
  },
  {
    step: '04',
    name: 'Pitch Extraction',
    summary:
      'Tracks fundamental frequency F0 over time using the YIN cumulative mean normalized difference estimator with parabolic interpolation and median smoothing.',
    detail:
      'Applies tonic normalisation p(t) = 12 log2(f(t) / f_tonic) while marking unvoiced frames explicitly.',
  },
  {
    step: '05',
    name: 'Feature Extraction',
    summary:
      'Computes 12-bin Swara pitch-class occupancy, ascending/descending transition statistics, run-length collapsed Swara sequences, and FFT spectral features.',
    detail: 'Produces structured feature payloads compatible with Python ML pipelines.',
  },
  {
    step: '06',
    name: 'Gamaka Analysis',
    summary:
      'Measures continuous pitch excursions, monotonic glide durations, local oscillation/modulation rates (Hz), pitch slope, and second-derivative curvature.',
    detail: 'Separates computable acoustic proxies from full musicological interpretation.',
  },
  {
    step: '07',
    name: 'Pakad Matching',
    summary:
      'Aligns observed Swara note segments against curated Hindustani Pakad sequences using sliding-window Dynamic Time Warping (DTW).',
    detail: 'Reports DTW distance, similarity score, and exact matched subsequence.',
  },
  {
    step: '08',
    name: 'Machine Learning Classification',
    summary:
      'Dispatches extracted melodic, spectral, and contour features to an external Python/FastAPI inference service configured via RAGA_MODEL_API_URL.',
    detail:
      'Strictly reports "not yet trained or connected" when unconfigured rather than inventing predictions.',
  },
  {
    step: '09',
    name: 'Prediction Fusion',
    summary:
      'Combines learned classifier probabilities with tonic-normalised pitch distribution, Gamaka descriptors, and DTW Pakad scores via configurable weights.',
    detail: 'Tracks calibration state so uncalibrated weights are never misrepresented.',
  },
  {
    step: '10',
    name: 'Explainable Results',
    summary:
      'Audits every module output, surfaces uncertainty warnings when pitch or tonic reliability drops, and summarises supporting evidence transparently.',
    detail: 'Optional Gemini synthesis strictly narrates real extracted telemetry.',
  },
];

export const HowItWorksPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-[#E5E7EB] pb-6">
        <p className="text-xs font-medium text-[#87998C]">
          System Pipeline &amp; Signal Architecture
        </p>
        <h1 className="font-editorial mt-2 text-3xl font-semibold text-[#222831] sm:text-4xl">
          How SVARA Works
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#4B5563]">
          SVARA decomposes Raga analysis into ten auditable stages—moving from
          raw acoustic waveforms to tonic-normalised contours, phrase alignment,
          and explainable classification.
        </p>
      </div>

      <div className="mt-10 space-y-3">
        {ARCHITECTURE_STAGES.map((stage, idx) => (
          <React.Fragment key={stage.step}>
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xs font-semibold text-[#B89B62] tabular-nums">
                    {stage.step}
                  </span>
                  <h2 className="text-lg font-semibold text-[#222831]">
                    {stage.name}
                  </h2>
                </div>
                <span className="text-xs font-mono text-[#6B7280] shrink-0">
                  Stage {idx + 1} of 10
                </span>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-[#4B5563]">
                {stage.summary}
              </p>
              <p className="mt-2 text-xs text-[#34495E]">{stage.detail}</p>
            </div>

            {idx < ARCHITECTURE_STAGES.length - 1 && (
              <div className="flex justify-center py-0.5 text-[#87998C]">
                <ArrowDown className="h-4 w-4" aria-hidden="true" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

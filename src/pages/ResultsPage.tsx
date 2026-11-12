import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  Info,
  ShieldCheck,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalysisResponse } from '../types/svara';
import { formatBytes, formatDuration } from '../utils/audioSamples';

interface ResultsPageProps {
  result: AnalysisResponse | null;
  onBackToAnalyze: () => void;
  onExploreRagas: () => void;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({
  result,
  onBackToAnalyze,
  onExploreRagas,
}) => {
  const [contourMode, setContourMode] = useState<'semitones' | 'hz'>('semitones');

  const swaraReferenceTicks = useMemo(
    () => [
      { value: -12, label: 'Sa.' },
      { value: 0, label: 'Sa' },
      { value: 4, label: 'Ga' },
      { value: 7, label: 'Pa' },
      { value: 12, label: "Sa'" },
    ],
    [],
  );

  if (!result) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h1 className="font-editorial text-3xl font-semibold text-[#222831]">
          No Analysis Loaded
        </h1>
        <p className="mt-3 text-sm text-[#4B5563]">
          Upload a WAV or MP3 recording on the Analyse Music page to inspect
          pitch contours, tonic estimation, Gamaka descriptors, and Pakad
          matches.
        </p>
        <button
          type="button"
          onClick={onBackToAnalyze}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#34495E] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#222831] cursor-pointer"
        >
          Go to Analyse Music
        </button>
      </div>
    );
  }

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `svara_analysis_${result.analysisId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const {
    audio,
    tonic,
    pitch,
    features,
    gamaka,
    pakad,
    classification,
    fusion,
    explainability,
    uncertaintyWarnings,
  } = result;

  const hasUncertainty =
    uncertaintyWarnings.length > 0 ||
    classification.status !== 'prediction_completed';

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      {/* Top Action & Recording Summary Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5E7EB] pb-6 sm:flex-row sm:items-end">
        <div>
          <button
            type="button"
            onClick={onBackToAnalyze}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#34495E] hover:text-[#222831] cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Analyse Another Recording
          </button>
          <h1 className="font-editorial mt-2 text-3xl font-semibold text-[#222831]">
            Analysis Results
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[#4B5563] font-mono tabular-nums">
            <span>{audio.fileName}</span>
            <span aria-hidden="true">·</span>
            <span>{audio.format.toUpperCase()}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDuration(audio.durationSeconds)}</span>
            <span aria-hidden="true">·</span>
            <span>{audio.sampleRate} Hz</span>
            <span aria-hidden="true">·</span>
            <span>{formatBytes(audio.fileSizeBytes)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportJson}
          className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-xs font-medium text-[#222831] hover:bg-[#F7F6F2] whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Export Features JSON
        </button>
      </div>

      {/* Section 9: Acoustic Completion + ML Scope / Uncertainty Notice */}
      {hasUncertainty && (
        <section
          aria-label="Analysis status and uncertainty notice"
          className="rounded-xl border border-[#B89B62]/50 bg-white p-6"
        >
          <div className="flex items-start gap-3.5">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[#B89B62]"
              aria-hidden="true"
            />
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-[#222831]">
                Acoustic Analysis Complete · Classification Scope Notice
              </h2>
              <p className="text-sm text-[#4B5563]">
                {classification.statusMessage}
              </p>
              {uncertaintyWarnings.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-[#4B5563]">
                  {uncertaintyWarnings.map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Section 1, 2, 3: Identification, Alternatives & Tonic Detection */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Section 1: Raga Identification */}
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-6 lg:col-span-5">
          <div className="text-xs font-medium text-[#6B7280]">
            01. Raga Identification
          </div>
          {classification.status === 'prediction_completed' &&
          classification.predictedRaga ? (
            <div className="mt-3">
              <div className="font-editorial text-3xl font-semibold text-[#222831]">
                {classification.predictedRaga.ragaName}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#4B5563]">
                <span>{classification.traditionScope} Classical</span>
                <span aria-hidden="true">·</span>
                <span>Prediction completed</span>
                {classification.calibratedConfidence !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-[#34495E]">
                      Score {classification.calibratedConfidence.toFixed(3)}
                    </span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-2.5">
              <div className="font-editorial text-2xl font-semibold text-[#222831]">
                ML Prediction Not Connected
              </div>
              <p className="text-sm text-[#4B5563]">
                {classification.status === 'classifier_not_configured'
                  ? 'Raga classification model not yet trained or connected.'
                  : classification.statusMessage}
              </p>
              {pakad.bestMatch &&
                pakad.bestMatch.matchStatus !== 'Weak or no curated match' && (
                  <div className="rounded-lg border border-[#E5E7EB] bg-[#F7F6F2] px-3 py-2 text-xs text-[#222831]">
                    Closest DTW Pakad alignment (heuristic phrase evidence only):{' '}
                    <strong>{pakad.bestMatch.ragaName}</strong> (
                    <span className="font-mono tabular-nums">
                      {(pakad.bestMatch.similarityScore * 100).toFixed(1)}%
                    </span>{' '}
                    similarity)
                  </div>
                )}
              <div className="pt-0.5 text-xs text-[#6B7280]">
                Tradition scope: {classification.traditionScope} · Status:{' '}
                {classification.status.replace(/_/g, ' ')}
              </div>
            </div>
          )}
        </section>

        {/* Section 2: Alternative Ragas */}
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-6 lg:col-span-3">
          <div className="text-xs font-medium text-[#6B7280]">
            02. Alternative Candidates
          </div>
          {classification.alternativeCandidates.length > 0 ? (
            <ul className="mt-3 space-y-2.5">
              {classification.alternativeCandidates.map((cand) => (
                <li
                  key={cand.ragaId}
                  className="flex items-center justify-between border-b border-[#E5E7EB] pb-2 text-sm last:border-0 last:pb-0"
                >
                  <span className="font-medium text-[#222831]">
                    {cand.ragaName}
                  </span>
                  <span className="font-mono text-xs text-[#34495E] tabular-nums">
                    {cand.score.toFixed(3)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 text-sm leading-relaxed text-[#4B5563]">
              No ranked ML classifier candidates are available until an external
              trained model endpoint is configured via{' '}
              <span className="font-mono text-xs text-[#222831]">
                RAGA_MODEL_API_URL
              </span>
              . Inspect DTW Pakad similarity below for phrase-level reference
              matches.
            </div>
          )}
        </section>

        {/* Section 3: Tonic Detection */}
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-6 lg:col-span-4">
          <div className="text-xs font-medium text-[#6B7280]">
            03. Tonic (Sa / Shruti) Detection
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="font-mono text-3xl font-semibold text-[#222831] tabular-nums">
              {tonic.estimatedFrequencyHz !== null
                ? `${tonic.estimatedFrequencyHz} Hz`
                : 'Indeterminate'}
            </span>
            {tonic.estimatedFrequencyHz !== null && (
              <span className="font-mono text-sm text-[#34495E]">
                {tonic.nearestWesternNote} (
                {tonic.centsDeviation >= 0 ? '+' : ''}
                {tonic.centsDeviation}c)
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#4B5563]">
            <span>
              Reliability:{' '}
              <strong className="capitalize text-[#222831]">
                {tonic.reliability}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Confidence {tonic.confidenceScore.toFixed(2)}
            </span>
          </div>
          {tonic.candidateFrequenciesHz.length > 1 && (
            <div className="mt-3 border-t border-[#E5E7EB] pt-2.5 text-xs text-[#6B7280] font-mono tabular-nums">
              Alt peaks:{' '}
              {tonic.candidateFrequenciesHz
                .slice(1, 3)
                .map((c) => `${c.frequencyHz} Hz (${c.note})`)
                .join(' · ')}
            </div>
          )}
        </section>
      </div>

      {/* Section 4: Pitch Contour Visualisation */}
      <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-[#E5E7EB] pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-[#222831]">
              04. Pitch Contour Visualisation
            </h2>
            <p className="mt-0.5 text-xs text-[#6B7280]">
              Extracted F0 trajectory ({pitch.voicedFrames} voiced /{' '}
              {pitch.unvoicedFrames} unvoiced frames; gaps indicate unvoiced or
              unreliable segments).
            </p>
          </div>

          <div
            role="group"
            aria-label="Pitch contour scale mode"
            className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-[#F7F6F2] p-1 self-start"
          >
            <button
              type="button"
              onClick={() => setContourMode('semitones')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
                contourMode === 'semitones'
                  ? 'bg-[#34495E] text-white'
                  : 'text-[#4B5563] hover:text-[#222831]'
              }`}
            >
              Relative Semitones (Sa = 0)
            </button>
            <button
              type="button"
              onClick={() => setContourMode('hz')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
                contourMode === 'hz'
                  ? 'bg-[#34495E] text-white'
                  : 'text-[#4B5563] hover:text-[#222831]'
              }`}
            >
              Frequency (Hz)
            </button>
          </div>
        </div>

        <div className="mt-6 h-80 w-full">
          {pitch.voicedFrames > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={pitch.contour}
                margin={{ top: 12, right: 20, bottom: 12, left: 6 }}
              >
                <CartesianGrid stroke="#E5E7EB" strokeDasharray="3 3" />
                <XAxis
                  dataKey="timeSec"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickFormatter={(v) => `${Number(v).toFixed(1)}s`}
                  minTickGap={32}
                />
                <YAxis
                  width={54}
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  domain={['auto', 'auto']}
                  tickFormatter={(v) =>
                    contourMode === 'semitones' ? `${v} st` : `${v} Hz`
                  }
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const pt = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs shadow-sm font-mono tabular-nums">
                        <div className="font-semibold text-[#222831]">
                          t = {pt.timeSec}s
                        </div>
                        {pt.voiced ? (
                          <>
                            <div className="text-[#34495E]">
                              F0: {pt.frequencyHz} Hz
                            </div>
                            {pt.relativeSemitones !== null && (
                              <div className="text-[#222831]">
                                Rel: {pt.relativeSemitones} st ({pt.nearestSwara})
                              </div>
                            )}
                            <div className="text-[#6B7280]">
                              Conf: {pt.confidence}
                            </div>
                          </>
                        ) : (
                          <div className="text-[#6B7280]">
                            Unvoiced / unreliable frame
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                {contourMode === 'semitones' &&
                  swaraReferenceTicks.map((ref) => (
                    <ReferenceLine
                      key={ref.label}
                      y={ref.value}
                      stroke={ref.value === 0 ? '#B89B62' : '#D1D5DB'}
                      strokeDasharray={ref.value === 0 ? undefined : '4 4'}
                      label={{
                        value: ref.label,
                        position: 'insideTopRight',
                        fill: '#6B7280',
                        fontSize: 10,
                      }}
                    />
                  ))}
                <Line
                  type="monotone"
                  dataKey={
                    contourMode === 'semitones'
                      ? 'relativeSemitones'
                      : 'frequencyHz'
                  }
                  stroke="#34495E"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg bg-[#F7F6F2] text-sm text-[#6B7280]">
              No reliable voiced pitch contour could be extracted from this recording.
            </div>
          )}
        </div>
      </section>

      {/* Section 5 & Section 6: Melodic Characteristics & Gamaka Analysis */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Section 5: Melodic Characteristics */}
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-6 lg:col-span-6">
          <h2 className="text-base font-semibold text-[#222831]">
            05. Melodic Characteristics &amp; Pitch-Class Distribution
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg bg-[#F7F6F2] p-3">
              <div className="text-[11px] text-[#6B7280]">Pitch Range</div>
              <div className="mt-1 font-mono text-base font-semibold text-[#222831] tabular-nums">
                {features.pitchRangeSemitones} st
              </div>
            </div>
            <div className="rounded-lg bg-[#F7F6F2] p-3">
              <div className="text-[11px] text-[#6B7280]">Mean Interval</div>
              <div className="mt-1 font-mono text-base font-semibold text-[#222831] tabular-nums">
                {features.meanIntervalMagnitude} st
              </div>
            </div>
            <div className="rounded-lg bg-[#F7F6F2] p-3">
              <div className="text-[11px] text-[#6B7280]">Asc / Desc</div>
              <div className="mt-1 font-mono text-base font-semibold text-[#222831] tabular-nums">
                {features.ascendingTransitions} / {features.descendingTransitions}
              </div>
            </div>
            <div className="rounded-lg bg-[#F7F6F2] p-3">
              <div className="text-[11px] text-[#6B7280]">Centroid</div>
              <div className="mt-1 font-mono text-base font-semibold text-[#222831] tabular-nums">
                {features.spectralFeatures.meanSpectralCentroidHz} Hz
              </div>
            </div>
          </div>

          <div className="mt-5 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={features.pitchClassDistribution}
                margin={{ top: 8, right: 8, bottom: 4, left: -12 }}
              >
                <CartesianGrid stroke="#E5E7EB" vertical={false} />
                <XAxis
                  dataKey="swaraLabel"
                  tick={{ fontSize: 11, fill: '#222831' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                  tickFormatter={(v) => `${Math.round(v * 100)}%`}
                />
                <Tooltip
                  formatter={(val: unknown) => [
                    `${(Number(val) * 100).toFixed(1)}%`,
                    'Occupancy',
                  ]}
                  labelFormatter={(label, items) =>
                    items?.[0]?.payload?.westernOffsetLabel || String(label)
                  }
                />
                <Bar
                  dataKey="proportion"
                  fill="#87998C"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 border-t border-[#E5E7EB] pt-3">
            <div className="text-xs font-medium text-[#6B7280]">
              Observed Temporal Swara Sequence
            </div>
            <p className="mt-1 font-mono text-xs leading-relaxed text-[#222831]">
              {features.observedSequence.length > 0
                ? features.observedSequence
                    .slice(0, 24)
                    .map((n) => n.swara)
                    .join(' → ')
                : 'No sustained Swara sequence extracted.'}
            </p>
          </div>
        </section>

        {/* Section 6: Gamaka Analysis */}
        <section className="rounded-xl border border-[#E5E7EB] bg-white p-6 lg:col-span-6">
          <h2 className="text-base font-semibold text-[#222831]">
            06. Gamaka Contour Descriptors
          </h2>
          <p className="mt-1 text-xs text-[#4B5563]">
            {gamaka.contourShapeSummary}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-[#F7F6F2] p-3">
              <div className="text-[11px] text-[#6B7280]">Max Excursion</div>
              <div className="mt-1 font-mono text-base font-semibold text-[#222831] tabular-nums">
                {gamaka.maxPitchExcursionSemitones} st
              </div>
            </div>
            <div className="rounded-lg bg-[#F7F6F2] p-3">
              <div className="text-[11px] text-[#6B7280]">Detected Glides</div>
              <div className="mt-1 font-mono text-base font-semibold text-[#222831] tabular-nums">
                {gamaka.detectedGlideCount} ({gamaka.ascendingGlides}↑ /{' '}
                {gamaka.descendingGlides}↓)
              </div>
            </div>
            <div className="rounded-lg bg-[#F7F6F2] p-3">
              <div className="text-[11px] text-[#6B7280]">Mean Glide Dur</div>
              <div className="mt-1 font-mono text-base font-semibold text-[#222831] tabular-nums">
                {gamaka.meanGlideDurationMs} ms
              </div>
            </div>
            <div className="rounded-lg bg-[#F7F6F2] p-3">
              <div className="text-[11px] text-[#6B7280]">Modulation Rate</div>
              <div className="mt-1 font-mono text-base font-semibold text-[#222831] tabular-nums">
                {gamaka.oscillationRateHz !== null
                  ? `${gamaka.oscillationRateHz} Hz`
                  : 'Not detected'}
              </div>
            </div>
            <div className="rounded-lg bg-[#F7F6F2] p-3">
              <div className="text-[11px] text-[#6B7280]">Mean |Slope|</div>
              <div className="mt-1 font-mono text-base font-semibold text-[#222831] tabular-nums">
                {gamaka.meanPitchSlopeAbs} st/s
              </div>
            </div>
            <div className="rounded-lg bg-[#F7F6F2] p-3">
              <div className="text-[11px] text-[#6B7280]">Mean Curvature</div>
              <div className="mt-1 font-mono text-base font-semibold text-[#222831] tabular-nums">
                {gamaka.meanContourCurvature} st/s²
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-[#E5E7EB] bg-[#F7F6F2] p-3.5 text-xs leading-relaxed text-[#4B5563]">
            <div className="flex items-center gap-1.5 font-semibold text-[#222831]">
              <Info className="h-3.5 w-3.5 text-[#34495E]" aria-hidden="true" />
              Numerical Observation vs. Musical Interpretation
            </div>
            <p className="mt-1">{gamaka.interpretationBoundaryNote}</p>
          </div>
        </section>
      </div>

      {/* Section 7: Pakad Matching */}
      <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
        <div className="flex flex-col justify-between gap-3 border-b border-[#E5E7EB] pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-[#222831]">
              07. Pakad Subsequence Matching (DTW)
            </h2>
            <p className="mt-0.5 text-xs text-[#6B7280]">
              Dynamic Time Warping alignment against curated Hindustani Pakad
              phrases (sequence similarity evidence only, not a standalone
              classifier).
            </p>
          </div>
          <button
            type="button"
            onClick={onExploreRagas}
            className="text-xs font-medium text-[#34495E] underline underline-offset-4 hover:text-[#222831] self-start sm:self-auto cursor-pointer"
          >
            Compare in Raga Library
          </button>
        </div>

        {pakad.topMatches.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-xs text-[#6B7280]">
                  <th className="py-2.5 pr-4 font-medium">Phrase ID &amp; Raga</th>
                  <th className="py-2.5 pr-4 font-medium">Reference Phrase</th>
                  <th className="py-2.5 pr-4 font-medium">Observed Window</th>
                  <th className="py-2.5 pr-4 font-medium">DTW Dist.</th>
                  <th className="py-2.5 pr-4 font-medium">Similarity</th>
                  <th className="py-2.5 font-medium">Match Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {pakad.topMatches.map((m) => (
                  <tr key={m.matchedPhraseId}>
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-[#222831]">
                        {m.ragaName}
                      </div>
                      <div className="font-mono text-[11px] text-[#6B7280]">
                        {m.matchedPhraseId}
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-[#222831]">
                      {m.referenceNotation}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-[#4B5563]">
                      {m.observedSwaraText}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-[#4B5563] tabular-nums">
                      {m.dtwDistance.toFixed(3)}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs font-semibold text-[#34495E] tabular-nums">
                      {(m.similarityScore * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 text-xs text-[#222831]">
                      {m.matchStatus}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[#4B5563]">
            Observed melodic sequence was too short for DTW Pakad subsequence
            matching.
          </p>
        )}
      </section>

      {/* Section 8: Explainable AI & Hybrid Fusion Readiness */}
      <section className="rounded-xl border border-[#E5E7EB] bg-white p-6">
        <div className="flex items-center gap-2 text-xs font-medium text-[#87998C]">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          08. Explainable AI &amp; Evidence Audit
        </div>
        <h2 className="font-editorial mt-2 text-2xl font-semibold text-[#222831]">
          {explainability.headline}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[#222831]">
          {explainability.narrativeSummary}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 border-t border-[#E5E7EB] pt-5 md:grid-cols-3">
          <div>
            <h3 className="text-xs font-semibold text-[#222831]">
              Detected Acoustic Evidence
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-[#4B5563]">
              {explainability.detectedObservations.map((obs, idx) => (
                <li key={idx}>• {obs}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-[#222831]">
              Supporting Descriptor &amp; Pakad Evidence
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-[#4B5563]">
              {explainability.supportingEvidence.length > 0 ? (
                explainability.supportingEvidence.map((ev, idx) => (
                  <li key={idx}>• {ev}</li>
                ))
              ) : (
                <li>• No strong supporting phrase or Gamaka evidence detected.</li>
              )}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-[#222831]">
              Unavailable or Weak Modules
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-[#4B5563]">
              {explainability.unavailableOrWeakModules.length > 0 ? (
                explainability.unavailableOrWeakModules.map((mod, idx) => (
                  <li key={idx}>• {mod}</li>
                ))
              ) : (
                <li>• All analysis modules produced reliable signals.</li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-6 border-t border-[#E5E7EB] pt-4 text-xs text-[#6B7280]">
          Fusion architecture note: {fusion.note} (Source:{' '}
          {explainability.narrativeSource === 'gemini_grounded_synthesis'
            ? 'Gemini evidence summariser grounded strictly in extracted telemetry'
            : 'Deterministic evidence report'}
          )
        </div>
      </section>
    </div>
  );
};

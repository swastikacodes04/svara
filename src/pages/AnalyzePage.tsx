import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileAudio,
  HelpCircle,
  Loader2,
  Mic,
  Play,
  RefreshCw,
  Square,
  Trash2,
  Upload,
  Waves,
} from 'lucide-react';
import { analyzeAudioRecording } from '../services/api';
import type { AnalysisResponse, PipelineStageId } from '../types/svara';
import {
  convertAudioBlobToWavFile,
  createSyntheticAcousticPhraseFile,
  downloadSampleWav,
  formatBytes,
  formatDuration,
  type SamplePreset,
} from '../utils/audioSamples';

interface AnalyzePageProps {
  onAnalysisComplete: (result: AnalysisResponse) => void;
}

const ORDERED_STAGES: Array<{ id: PipelineStageId; label: string }> = [
  { id: 'validation', label: '1. Audio validation' },
  { id: 'preprocessing', label: '2. Audio preprocessing' },
  { id: 'tonic_estimation', label: '3. Tonic estimation' },
  { id: 'pitch_extraction', label: '4. Pitch extraction' },
  { id: 'feature_extraction', label: '5. Melodic feature extraction' },
  { id: 'gamaka_analysis', label: '6. Gamaka analysis' },
  { id: 'pakad_matching', label: '7. Pakad matching' },
  { id: 'raga_classification', label: '8. Raga classification' },
  { id: 'results_generation', label: '9. Results generation' },
];

const MAX_CLIENT_BYTES = 25 * 1024 * 1024;
const CONVERTIBLE_AUDIO_EXTS = ['.m4a', '.ogg', '.webm', '.aac', '.flac'];

export const AnalyzePage: React.FC<AnalyzePageProps> = ({
  onAnalysisComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<number | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [conversionNote, setConversionNote] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeStageIdx, setActiveStageIdx] = useState<number>(-1);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [failedStageIdx, setFailedStageIdx] = useState<number | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (recTimerRef.current) window.clearInterval(recTimerRef.current);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [audioUrl]);

  const attachReadyFile = (file: File, note: string | null = null) => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setAudioUrl(objectUrl);
    setAudioDuration(null);
    setConversionNote(note);
  };

  const validateAndAttachFile = async (file: File) => {
    setValidationError(null);
    setAnalysisError(null);
    setFailedStageIdx(null);
    setActiveStageIdx(-1);
    setConversionNote(null);

    if (file.size === 0) {
      setValidationError('Selected file is empty (0 bytes).');
      return;
    }
    if (file.size > MAX_CLIENT_BYTES) {
      setValidationError(
        `File size (${formatBytes(file.size)}) exceeds the 25 MB upload limit.`,
      );
      return;
    }

    const lower = file.name.toLowerCase();
    const isNativeSupported = lower.endsWith('.wav') || lower.endsWith('.mp3');

    if (isNativeSupported) {
      attachReadyFile(file);
      return;
    }

    // If user uploads a phone/browser audio format (.m4a, .ogg, .webm, .aac, .flac),
    // try transcoding it via Web Audio API into a clean 16-bit WAV file.
    const isConvertible = CONVERTIBLE_AUDIO_EXTS.some((ext) =>
      lower.endsWith(ext),
    );
    if (isConvertible) {
      try {
        const wavFile = await convertAudioBlobToWavFile(file, file.name);
        attachReadyFile(
          wavFile,
          `Converted "${file.name}" to 16-bit PCM WAV for acoustic analysis.`,
        );
      } catch {
        setValidationError(
          `Could not decode "${file.name}". Please upload a valid .wav or .mp3 recording.`,
        );
      }
      return;
    }

    setValidationError(
      `Unsupported file "${file.name}". Please upload a .wav or .mp3 audio recording (or record directly with your microphone).`,
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void validateAndAttachFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void validateAndAttachFile(file);
  };

  const handleClear = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setSelectedFile(null);
    setAudioUrl(null);
    setAudioDuration(null);
    setConversionNote(null);
    setValidationError(null);
    setAnalysisError(null);
    setFailedStageIdx(null);
    setActiveStageIdx(-1);
  };

  const handleLoadSample = (preset: SamplePreset) => {
    const sampleFile = createSyntheticAcousticPhraseFile(preset);
    void validateAndAttachFile(sampleFile);
  };

  const startMicRecording = async () => {
    setValidationError(null);
    setAnalysisError(null);

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setValidationError(
        'Microphone recording is not supported in this browser. Please upload a .wav or .mp3 file or load a test sample below.',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      micChunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) micChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        if (recTimerRef.current) {
          window.clearInterval(recTimerRef.current);
          recTimerRef.current = null;
        }
        stream.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
        setIsRecording(false);

        const rawBlob = new Blob(micChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (rawBlob.size === 0) {
          setValidationError('Microphone recording was empty. Please try again.');
          return;
        }

        try {
          const wavFile = await convertAudioBlobToWavFile(
            rawBlob,
            'svara_mic_recording.wav',
          );
          attachReadyFile(
            wavFile,
            'Microphone recording encoded to 16-bit PCM WAV.',
          );
        } catch {
          setValidationError(
            'Could not encode microphone recording to WAV. Please upload a .wav or .mp3 file instead.',
          );
        }
      };

      recorder.start(250);
      setRecordingSeconds(0);
      setIsRecording(true);
      recTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setValidationError(
        'Microphone permission was denied or unavailable. Upload a .wav/.mp3 file or load a test sample below.',
      );
    }
  };

  const stopMicRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleRunAnalysis = async () => {
    if (!selectedFile || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setFailedStageIdx(null);
    setActiveStageIdx(0);

    const stageTimer = window.setInterval(() => {
      setActiveStageIdx((prev) => (prev < 7 ? prev + 1 : prev));
    }, 320);

    try {
      const result = await analyzeAudioRecording(selectedFile);
      window.clearInterval(stageTimer);
      setActiveStageIdx(8);
      setIsAnalyzing(false);
      onAnalysisComplete(result);
    } catch (err) {
      window.clearInterval(stageTimer);
      const message =
        err instanceof Error ? err.message : 'Audio analysis failed unexpectedly.';
      setIsAnalyzing(false);
      setFailedStageIdx(0);
      setAnalysisError(message);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-[#E5E7EB] pb-6">
        <p className="text-xs font-medium text-[#87998C]">
          Acoustic Signal Processing &amp; Melodic Feature Pipeline
        </p>
        <h1 className="font-editorial mt-2 text-3xl font-semibold text-[#222831] sm:text-4xl">
          Analyse Music
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#4B5563]">
          Upload a vocal or instrumental recording, sing a Sa Re Ga Ma phrase
          into your microphone, or load a Raag Yaman / Bhairav test sample.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Upload, Mic, Playback & Samples */}
        <div className="space-y-6 lg:col-span-7">
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,.mp3,.m4a,.ogg,.webm,audio/*"
            onChange={handleFileChange}
            className="sr-only"
            aria-label="Choose WAV or MP3 audio file"
          />

          {!selectedFile ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                isDragging
                  ? 'border-[#34495E] bg-white'
                  : 'border-[#D1D5DB] bg-white hover:border-[#87998C]'
              }`}
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F6F2] text-[#34495E]">
                <Upload className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-[#222831]">
                Drop a recording here, browse a file, or record singing
              </h2>
              <p className="mt-1.5 text-xs text-[#6B7280]">
                Native .wav and .mp3 (plus .m4a / .ogg / .webm conversion) · 1s
                to 15m · Max 25 MB
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isRecording}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#34495E] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#222831] disabled:opacity-50 cursor-pointer"
                >
                  Browse Audio File
                </button>

                {!isRecording ? (
                  <button
                    type="button"
                    onClick={() => void startMicRecording()}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#87998C] bg-white px-5 py-2.5 text-sm font-medium text-[#222831] transition-colors hover:bg-[#F7F6F2] cursor-pointer"
                  >
                    <Mic className="h-4 w-4 text-[#34495E]" aria-hidden="true" />
                    Record Singing (Mic)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopMicRecording}
                    className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-5 py-2.5 text-sm font-medium text-rose-900 hover:bg-rose-100 cursor-pointer font-mono tabular-nums"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    Stop Recording ({recordingSeconds}s)
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F7F6F2] text-[#34495E]">
                    <FileAudio className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-[#222831]">
                      {selectedFile.name}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#6B7280] font-mono tabular-nums">
                      <span>{formatBytes(selectedFile.size)}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {selectedFile.name.toLowerCase().endsWith('.mp3')
                          ? 'MP3'
                          : 'WAV'}
                      </span>
                      {audioDuration !== null && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{formatDuration(audioDuration)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isAnalyzing}
                    aria-label="Replace audio file"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-[#F7F6F2] px-3 py-1.5 text-xs font-medium text-[#222831] hover:bg-[#E5E7EB]/60 disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={isAnalyzing}
                    aria-label="Remove audio file"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#4B5563] hover:text-rose-700 disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Remove
                  </button>
                </div>
              </div>

              {conversionNote && (
                <p className="mt-3 text-xs text-[#34495E]">{conversionNote}</p>
              )}

              {audioUrl && (
                <div className="mt-5 rounded-lg border border-[#E5E7EB] bg-[#F7F6F2] p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[#4B5563]">
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    Recording Playback
                  </div>
                  <audio
                    controls
                    src={audioUrl}
                    onLoadedMetadata={(e) => {
                      const dur = e.currentTarget.duration;
                      if (Number.isFinite(dur)) setAudioDuration(dur);
                    }}
                    className="w-full"
                  />
                </div>
              )}

              <div className="mt-6 flex items-center justify-between gap-4 border-t border-[#E5E7EB] pt-5">
                <p className="text-xs text-[#6B7280]">
                  Audio is processed temporarily and deleted immediately after
                  analysis.
                </p>
                <button
                  type="button"
                  onClick={handleRunAnalysis}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#34495E] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#222831] disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      Analysing...
                    </>
                  ) : (
                    'Analyse Recording'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Validation or Server Error */}
          {(validationError || analysisError) && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
            >
              <AlertCircle
                className="mt-0.5 h-5 w-5 shrink-0 text-rose-700"
                aria-hidden="true"
              />
              <div>
                <div className="font-semibold">
                  {validationError ? 'Invalid audio file' : 'Analysis failed'}
                </div>
                <p className="mt-0.5 text-rose-800">
                  {validationError || analysisError}
                </p>
              </div>
            </div>
          )}

          {/* Ready-to-Use Test Samples (Load or Download WAV) */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-[#34495E]">
              <Waves className="h-4 w-4" aria-hidden="true" />
              Ready-to-Use Test Samples (Synthesized Raag WAV)
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[#6B7280]">
              Load a synthetic Raag phrase straight into the analyser—or download
              the <span className="font-mono">.wav</span> file to your device to
              listen and test uploading.
            </p>

            <div className="mt-4 space-y-2.5">
              {(
                [
                  {
                    preset: 'yaman' as const,
                    title: 'Raag Yaman Motif (Sa = D3, ~9s WAV)',
                    notes: "N. R G M+ D N S' P M+ G R S",
                  },
                  {
                    preset: 'bhairav' as const,
                    title: 'Raag Bhairav Motif (Sa = C3, ~7.4s WAV)',
                    notes: 'S G M d P G M r S',
                  },
                  {
                    preset: 'bhupali' as const,
                    title: 'Raag Bhupali Motif (Sa = G3, ~7.8s WAV)',
                    notes: "S R G P D S' D P G R S",
                  },
                ] as const
              ).map((item) => (
                <div
                  key={item.preset}
                  className="flex flex-col justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-[#F7F6F2]/70 px-3.5 py-2.5 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#222831]">
                      {item.title}
                    </div>
                    <div className="font-mono text-[11px] text-[#6B7280]">
                      {item.notes}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isAnalyzing || isRecording}
                      onClick={() => handleLoadSample(item.preset)}
                      className="rounded-md bg-[#34495E] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#222831] disabled:opacity-50 cursor-pointer"
                    >
                      Load &amp; Test
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadSampleWav(item.preset)}
                      aria-label={`Download ${item.title}`}
                      className="inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs font-medium text-[#222831] hover:bg-[#F7F6F2] cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      .wav
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* What Audio Should I Upload? Guidance */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex items-center gap-2 text-xs font-medium text-[#222831]">
              <HelpCircle className="h-4 w-4 text-[#34495E]" aria-hidden="true" />
              What Audio Works Best?
            </div>
            <ul className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-[#4B5563]">
              <li>
                <strong className="text-[#222831]">Yes, sing Sa Re Ga Ma:</strong>{' '}
                Sing a slow <em>Aarohana / Avarohana</em> or a 5–20 second{' '}
                <em>Alap / Pakad</em> phrase clearly on &ldquo;Aa&rdquo; or
                Sargam notes (Sa, Re, Ga, Ma, Pa, Dha, Ni, Sa&apos;).
              </li>
              <li>
                <strong className="text-[#222831]">Solo melody works best:</strong>{' '}
                Unaccompanied voice, bansuri, sitar, sarod, or harmonium with a
                steady Sa reference gives the cleanest pitch contour. Loud tabla,
                heavy chords, or room noise reduce voiced tracking accuracy.
              </li>
              <li>
                <strong className="text-[#222831]">What SVARA outputs now:</strong>{' '}
                Every valid upload produces real Tonic (Sa) estimation, F0 pitch
                contours, Gamaka descriptors, and DTW Pakad similarity matches.
                Final ML Raga classification activates once an external Python
                classifier is linked to <span className="font-mono">RAGA_MODEL_API_URL</span>.
              </li>
            </ul>
          </div>
        </div>

        {/* Right: 9-Stage Real Processing Status */}
        <div className="lg:col-span-5">
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6">
            <h2 className="text-sm font-semibold text-[#222831]">
              Analysis Pipeline Stages
            </h2>
            <p className="mt-1 text-xs text-[#6B7280]">
              Each stage reports actual execution status from the SVARA engine.
            </p>

            <ol className="mt-5 space-y-3">
              {ORDERED_STAGES.map((stage, idx) => {
                const isFailed = failedStageIdx === idx;
                const isCompleted =
                  !isFailed &&
                  activeStageIdx > idx &&
                  (isAnalyzing || activeStageIdx === 8);
                const isRunning = isAnalyzing && activeStageIdx === idx;

                return (
                  <li
                    key={stage.id}
                    className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                      isFailed
                        ? 'border-rose-200 bg-rose-50 text-rose-900'
                        : isRunning
                          ? 'border-[#34495E] bg-[#F7F6F2] text-[#222831] font-medium'
                          : isCompleted
                            ? 'border-[#E5E7EB] bg-[#F7F6F2]/60 text-[#222831]'
                            : 'border-[#E5E7EB] bg-white text-[#6B7280]'
                    }`}
                  >
                    <span>{stage.label}</span>
                    <span className="text-xs font-mono shrink-0">
                      {isFailed && (
                        <span className="inline-flex items-center gap-1 text-rose-700">
                          <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                          Failed
                        </span>
                      )}
                      {isRunning && (
                        <span className="inline-flex items-center gap-1 text-[#34495E]">
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin"
                            aria-hidden="true"
                          />
                          Running
                        </span>
                      )}
                      {isCompleted && (
                        <span className="inline-flex items-center gap-1 text-[#87998C]">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Done
                        </span>
                      )}
                      {!isFailed && !isRunning && !isCompleted && 'Queued'}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

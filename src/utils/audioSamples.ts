export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  if (mins === 0) return `${secs}.${tenths}s`;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function encodeMonoWav(
  samples: Float32Array,
  sampleRate: number,
): ArrayBuffer {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(
      offset,
      clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
      true,
    );
    offset += 2;
  }

  return buffer;
}

/**
 * Converts a browser-recorded or Web-Audio-decodable Blob (e.g. microphone WebM/Opus or M4A)
 * into a clean 16-bit mono PCM .wav File suitable for server-side YIN pitch analysis.
 */
export async function convertAudioBlobToWavFile(
  blob: Blob,
  targetFileName: string,
): Promise<File> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Web Audio API is not supported in this browser.');
  }
  const ctx = new AudioCtx();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const mono = new Float32Array(length);

    if (numChannels === 1) {
      mono.set(audioBuffer.getChannelData(0));
    } else {
      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          mono[i] += channelData[i] / numChannels;
        }
      }
    }

    const wavBuffer = encodeMonoWav(mono, audioBuffer.sampleRate);
    const cleanName = targetFileName.replace(/\.[^.]+$/, '') + '.wav';
    return new File([wavBuffer], cleanName, { type: 'audio/wav' });
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

interface SynthNote {
  semitone: number;
  durationSec: number;
  vibratoHz?: number;
  vibratoDepthSt?: number;
  glideFromPrev?: boolean;
}

export type SamplePreset = 'yaman' | 'bhairav' | 'bhupali';

/**
 * Generates a real binary WAV file containing a monophonic harmonic bansuri-like
 * melodic phrase with smooth glides and pitch modulation for testing SVARA's
 * acoustic DSP pipeline end-to-end.
 */
export function createSyntheticAcousticPhraseFile(preset: SamplePreset): File {
  const sampleRate = 22050;
  const tonicHz =
    preset === 'yaman' ? 146.83 : preset === 'bhairav' ? 130.81 : 196.0; // D3, C3, G3

  const notes: SynthNote[] =
    preset === 'yaman'
      ? [
          { semitone: 0, durationSec: 0.9, vibratoHz: 4.5, vibratoDepthSt: 0.12 },
          { semitone: -1, durationSec: 0.55, glideFromPrev: true },
          { semitone: 2, durationSec: 0.55, glideFromPrev: true },
          { semitone: 4, durationSec: 0.85, vibratoHz: 4.8, vibratoDepthSt: 0.22 },
          { semitone: 6, durationSec: 0.65, glideFromPrev: true },
          { semitone: 9, durationSec: 0.55, glideFromPrev: true },
          { semitone: 11, durationSec: 0.55 },
          { semitone: 12, durationSec: 0.9, vibratoHz: 4.2, vibratoDepthSt: 0.15 },
          { semitone: 7, durationSec: 0.6, glideFromPrev: true },
          { semitone: 6, durationSec: 0.55 },
          { semitone: 4, durationSec: 0.65, glideFromPrev: true },
          { semitone: 2, durationSec: 0.55 },
          { semitone: 0, durationSec: 1.1 },
        ]
      : preset === 'bhairav'
        ? [
            { semitone: 0, durationSec: 0.95 },
            { semitone: 4, durationSec: 0.6, glideFromPrev: true },
            { semitone: 5, durationSec: 0.7 },
            { semitone: 8, durationSec: 0.9, vibratoHz: 3.4, vibratoDepthSt: 0.35 },
            { semitone: 7, durationSec: 0.75, glideFromPrev: true },
            { semitone: 4, durationSec: 0.55 },
            { semitone: 5, durationSec: 0.6 },
            { semitone: 1, durationSec: 0.85, vibratoHz: 3.2, vibratoDepthSt: 0.32 },
            { semitone: 0, durationSec: 1.15, glideFromPrev: true },
          ]
        : [
            { semitone: 0, durationSec: 0.85 },
            { semitone: 2, durationSec: 0.55, glideFromPrev: true },
            { semitone: 4, durationSec: 0.75, vibratoHz: 4.2, vibratoDepthSt: 0.18 },
            { semitone: 7, durationSec: 0.7, glideFromPrev: true },
            { semitone: 9, durationSec: 0.75, vibratoHz: 4.0, vibratoDepthSt: 0.16 },
            { semitone: 12, durationSec: 0.85 },
            { semitone: 9, durationSec: 0.55, glideFromPrev: true },
            { semitone: 7, durationSec: 0.6 },
            { semitone: 4, durationSec: 0.7, glideFromPrev: true },
            { semitone: 2, durationSec: 0.55 },
            { semitone: 0, durationSec: 1.0 },
          ];

  const totalSec = notes.reduce((acc, n) => acc + n.durationSec, 0) + 0.3;
  const totalSamples = Math.floor(totalSec * sampleRate);
  const samples = new Float32Array(totalSamples);

  let phase = 0;
  let sampleCursor = Math.floor(0.15 * sampleRate);
  let prevSemitone = notes[0].semitone;

  for (const note of notes) {
    const noteSamples = Math.floor(note.durationSec * sampleRate);
    for (let i = 0; i < noteSamples && sampleCursor < totalSamples; i++) {
      const progress = i / noteSamples;
      let semitone = note.semitone;
      if (note.glideFromPrev && progress < 0.28) {
        const t = progress / 0.28;
        const smooth = t * t * (3 - 2 * t);
        semitone = prevSemitone + (note.semitone - prevSemitone) * smooth;
      }
      if (note.vibratoHz && note.vibratoDepthSt) {
        semitone +=
          note.vibratoDepthSt *
          Math.sin(2 * Math.PI * note.vibratoHz * (i / sampleRate));
      }

      const freq = tonicHz * Math.pow(2, semitone / 12);
      phase += (2 * Math.PI * freq) / sampleRate;

      const env =
        Math.min(1, i / (sampleRate * 0.035)) *
        Math.min(1, (noteSamples - i) / (sampleRate * 0.04));

      const signal =
        0.72 * Math.sin(phase) +
        0.2 * Math.sin(2 * phase) +
        0.07 * Math.sin(3 * phase);

      samples[sampleCursor++] = signal * env * 0.65;
    }
    prevSemitone = note.semitone;
  }

  const wavBuffer = encodeMonoWav(samples, sampleRate);
  const fileName =
    preset === 'yaman'
      ? 'svara_raag_yaman_sample_D3.wav'
      : preset === 'bhairav'
        ? 'svara_raag_bhairav_sample_C3.wav'
        : 'svara_raag_bhupali_sample_G3.wav';

  return new File([wavBuffer], fileName, { type: 'audio/wav' });
}

export function downloadSampleWav(preset: SamplePreset): void {
  const file = createSyntheticAcousticPhraseFile(preset);
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

import { MPEGDecoder } from 'mpg123-decoder';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface DecodedAudio {
  samples: Float32Array;
  sampleRate: number;
  channels: number;
  durationSeconds: number;
  format: 'wav' | 'mp3';
  peakAmplitude: number;
  rmsEnergy: number;
}

export class AudioValidationError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'AudioValidationError';
    this.statusCode = statusCode;
  }
}

export function detectAudioFormatFromBuffer(
  buffer: Buffer,
  originalName: string,
): 'wav' | 'mp3' | null {
  const ext = path.extname(originalName).toLowerCase();

  // Check RIFF....WAVE magic bytes
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WAVE'
  ) {
    return 'wav';
  }

  // Check ID3v2 header or MPEG ADTS/frame sync (0xFF 0xE0 mask)
  if (buffer.length >= 3 && buffer.toString('ascii', 0, 3) === 'ID3') {
    return 'mp3';
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
    return 'mp3';
  }

  // Fallback check if extension is valid and there's an ID3/sync header within first 64KB
  if (ext === '.mp3' && buffer.length >= 4) {
    const scanLimit = Math.min(buffer.length - 2, 65536);
    for (let i = 0; i < scanLimit; i++) {
      if (buffer[i] === 0xff && (buffer[i + 1] & 0xe0) === 0xe0) {
        return 'mp3';
      }
    }
  }

  return null;
}

export function decodeWavBuffer(buffer: Buffer): {
  samples: Float32Array;
  sampleRate: number;
  channels: number;
} {
  if (buffer.length < 44) {
    throw new AudioValidationError('Corrupted WAV file: header is truncated.');
  }
  if (
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new AudioValidationError('Invalid WAV header: missing RIFF/WAVE signature.');
  }

  let offset = 12;
  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;

    if (chunkId === 'fmt ') {
      if (chunkSize < 16 || chunkDataStart + 16 > buffer.length) {
        throw new AudioValidationError('Corrupted WAV file: invalid fmt chunk.');
      }
      audioFormat = buffer.readUInt16LE(chunkDataStart);
      channels = buffer.readUInt16LE(chunkDataStart + 2);
      sampleRate = buffer.readUInt32LE(chunkDataStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkDataStart + 14);

      // Handle WAVE_FORMAT_EXTENSIBLE (0xFFFE = 65534)
      if (
        audioFormat === 0xfffe &&
        chunkSize >= 40 &&
        chunkDataStart + 26 <= buffer.length
      ) {
        const subFormatCode = buffer.readUInt16LE(chunkDataStart + 24);
        if (subFormatCode === 1 || subFormatCode === 3) {
          audioFormat = subFormatCode;
        }
      }
    } else if (chunkId === 'data') {
      dataOffset = chunkDataStart;
      dataSize = Math.min(chunkSize, buffer.length - chunkDataStart);
      break;
    }

    const paddedSize = chunkSize + (chunkSize % 2);
    offset = chunkDataStart + paddedSize;
  }

  if (dataOffset < 0 || dataSize <= 0) {
    throw new AudioValidationError('Invalid WAV file: missing audio data chunk.');
  }
  if (channels < 1 || channels > 8) {
    throw new AudioValidationError(`Unsupported WAV channel count: ${channels}.`);
  }
  if (sampleRate < 8000 || sampleRate > 192000) {
    throw new AudioValidationError(`Unsupported WAV sample rate: ${sampleRate} Hz.`);
  }
  if (audioFormat !== 1 && audioFormat !== 3) {
    throw new AudioValidationError(
      `Unsupported WAV encoding format (code ${audioFormat}). Only uncompressed PCM or IEEE float WAV is supported.`,
    );
  }

  const bytesPerSample = bitsPerSample / 8;
  if (![1, 2, 3, 4].includes(bytesPerSample)) {
    throw new AudioValidationError(`Unsupported WAV bit depth: ${bitsPerSample}-bit.`);
  }

  const blockAlign = bytesPerSample * channels;
  const frameCount = Math.floor(dataSize / blockAlign);
  if (frameCount <= 0) {
    throw new AudioValidationError('WAV file contains zero audio frames.');
  }

  const mono = new Float32Array(frameCount);

  for (let i = 0; i < frameCount; i++) {
    let sum = 0;
    const framePos = dataOffset + i * blockAlign;
    for (let ch = 0; ch < channels; ch++) {
      const samplePos = framePos + ch * bytesPerSample;
      let val = 0;
      if (audioFormat === 3 && bytesPerSample === 4) {
        val = buffer.readFloatLE(samplePos);
      } else if (bytesPerSample === 1) {
        val = (buffer.readUInt8(samplePos) - 128) / 128;
      } else if (bytesPerSample === 2) {
        val = buffer.readInt16LE(samplePos) / 32768;
      } else if (bytesPerSample === 3) {
        const b0 = buffer[samplePos];
        const b1 = buffer[samplePos + 1];
        const b2 = buffer[samplePos + 2];
        let intVal = (b2 << 16) | (b1 << 8) | b0;
        if (intVal & 0x800000) intVal |= ~0xffffff;
        val = intVal / 8388608;
      } else if (bytesPerSample === 4) {
        val = buffer.readInt32LE(samplePos) / 2147483648;
      }
      sum += Number.isFinite(val) ? val : 0;
    }
    mono[i] = sum / channels;
  }

  return { samples: mono, sampleRate, channels };
}

export async function decodeMp3Buffer(buffer: Buffer): Promise<{
  samples: Float32Array;
  sampleRate: number;
  channels: number;
}> {
  const decoder = new MPEGDecoder();
  try {
    await decoder.ready;
    const decoded = decoder.decode(new Uint8Array(buffer));
    if (
      !decoded ||
      !decoded.channelData ||
      decoded.channelData.length === 0 ||
      decoded.samplesDecoded === 0
    ) {
      throw new AudioValidationError('MP3 file could not be decoded or contains no audio frames.');
    }

    const channels = decoded.channelData.length;
    const length = decoded.channelData[0].length;
    const mono = new Float32Array(length);

    if (channels === 1) {
      mono.set(decoded.channelData[0]);
    } else {
      for (let i = 0; i < length; i++) {
        let sum = 0;
        for (let ch = 0; ch < channels; ch++) {
          sum += decoded.channelData[ch][i];
        }
        mono[i] = sum / channels;
      }
    }

    return {
      samples: mono,
      sampleRate: decoded.sampleRate,
      channels,
    };
  } catch (err) {
    if (err instanceof AudioValidationError) throw err;
    throw new AudioValidationError(
      `Failed to decode MP3 recording: ${err instanceof Error ? err.message : 'corrupted MPEG stream'}`,
    );
  } finally {
    decoder.free();
  }
}

export async function decodeAndValidateAudioFile(
  filePath: string,
  originalName: string,
  maxBytes: number,
): Promise<DecodedAudio> {
  const stats = await fs.stat(filePath);
  if (stats.size === 0) {
    throw new AudioValidationError('Uploaded audio file is empty (0 bytes).');
  }
  if (stats.size > maxBytes) {
    throw new AudioValidationError(
      `Audio file exceeds maximum upload limit of ${Math.round(maxBytes / (1024 * 1024))} MB.`,
      413,
    );
  }

  const buffer = await fs.readFile(filePath);
  return decodeAndValidateAudioBuffer(buffer, originalName);
}

export async function decodeAndValidateAudioBuffer(
  buffer: Buffer,
  originalName: string,
): Promise<DecodedAudio> {
  const ext = path.extname(originalName).toLowerCase();
  if (ext !== '.wav' && ext !== '.mp3') {
    throw new AudioValidationError(
      'Unsupported file extension. Please upload a valid .wav or .mp3 recording.',
    );
  }

  const detectedFormat = detectAudioFormatFromBuffer(buffer, originalName);
  if (!detectedFormat) {
    throw new AudioValidationError(
      'File signature does not match valid WAV or MP3 audio headers.',
    );
  }

  const raw =
    detectedFormat === 'wav'
      ? decodeWavBuffer(buffer)
      : await decodeMp3Buffer(buffer);

  const durationSeconds = raw.samples.length / raw.sampleRate;
  if (durationSeconds < 1.0) {
    throw new AudioValidationError(
      `Recording is too short (${durationSeconds.toFixed(2)}s). Minimum duration for melodic analysis is 1.0 second.`,
    );
  }
  if (durationSeconds > 900) {
    throw new AudioValidationError(
      `Recording exceeds 15-minute maximum duration (${Math.round(durationSeconds)}s).`,
    );
  }

  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < raw.samples.length; i++) {
    const abs = Math.abs(raw.samples[i]);
    if (abs > peak) peak = abs;
    sumSq += raw.samples[i] * raw.samples[i];
  }
  const rmsEnergy = Math.sqrt(sumSq / raw.samples.length);

  if (rmsEnergy < 1e-5 || peak < 1e-4) {
    throw new AudioValidationError(
      'Recording appears silent or below measurable acoustic energy threshold.',
    );
  }

  return {
    samples: raw.samples,
    sampleRate: raw.sampleRate,
    channels: raw.channels,
    durationSeconds,
    format: detectedFormat,
    peakAmplitude: peak,
    rmsEnergy,
  };
}

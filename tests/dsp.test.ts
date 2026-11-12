import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AudioValidationError,
  decodeAndValidateAudioBuffer,
} from '../server/audio/decoder.ts';
import {
  frequencyToNearestWesternNote,
  frequencyToRelativeSemitones,
  semitoneToSwaraLabel,
} from '../server/audio/musicTheory.ts';
import {
  buildPitchExtractionResult,
  extractRawPitchFrames,
} from '../server/audio/pitchTracker.ts';
import { preprocessAudio } from '../server/audio/preprocessing.ts';
import { estimateTonic } from '../server/audio/tonicEstimator.ts';
import { analyzeGamakaDescriptors } from '../server/gamaka/gamakaAnalyzer.ts';

function buildTestWavBuffer(
  freqGenerator: (tSec: number) => number,
  durationSec = 3.0,
  sampleRate = 22050,
): Buffer {
  const n = Math.floor(durationSec * sampleRate);
  const buffer = Buffer.alloc(44 + n * 2);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + n * 2, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(n * 2, 40);

  let phase = 0;
  for (let i = 0; i < n; i++) {
    const f = freqGenerator(i / sampleRate);
    phase += (2 * Math.PI * f) / sampleRate;
    const sample = Math.max(-1, Math.min(1, 0.7 * Math.sin(phase)));
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return buffer;
}

test('musicTheory computes relative semitones and Swara labels accurately', () => {
  assert.equal(Math.round(frequencyToRelativeSemitones(293.66, 146.83)), 12);
  assert.equal(Math.round(frequencyToRelativeSemitones(220.0, 146.83)), 7);
  assert.equal(semitoneToSwaraLabel(0), 'S');
  assert.equal(semitoneToSwaraLabel(6), 'M+');
  assert.equal(semitoneToSwaraLabel(7), 'P');
  assert.equal(semitoneToSwaraLabel(-1), 'N.');
  assert.equal(frequencyToNearestWesternNote(440).note, 'A4');
});

test('decoder rejects invalid headers and corrupted or short audio', async () => {
  await assert.rejects(
    () =>
      decodeAndValidateAudioBuffer(
        Buffer.from('not-a-wav-file'),
        'corrupt.wav',
      ),
    AudioValidationError,
  );

  const tooShort = buildTestWavBuffer(() => 220, 0.3);
  await assert.rejects(
    () => decodeAndValidateAudioBuffer(tooShort, 'short.wav'),
    /too short/i,
  );
});

test('YIN pitch tracker and tonic estimator recover D3 (146.83 Hz) phrase accurately', async () => {
  // Alternating Sa (146.83 Hz) and Pa (220.0 Hz)
  const wav = buildTestWavBuffer((t) => (t < 1.8 ? 146.83 : 220.0), 3.0);
  const decoded = await decodeAndValidateAudioBuffer(wav, 'sa_pa.wav');
  const prep = preprocessAudio(decoded.samples, decoded.sampleRate);
  const frames = extractRawPitchFrames(prep.samples, prep.sampleRate);
  const tonic = estimateTonic(frames);

  assert.ok(tonic.estimatedFrequencyHz !== null);
  assert.ok(
    Math.abs(tonic.estimatedFrequencyHz - 146.83) < 4.0,
    `Expected tonic near 146.83 Hz, got ${tonic.estimatedFrequencyHz}`,
  );
  assert.notEqual(tonic.reliability, 'unreliable');

  const pitch = buildPitchExtractionResult(frames, tonic.estimatedFrequencyHz);
  assert.ok(pitch.voicedRatio > 0.8);
});

test('Gamaka analyzer detects continuous pitch glides and modulation', async () => {
  // Smooth ascending glide from 146.83 Hz to 220 Hz (7 semitones) + vibrato
  const wav = buildTestWavBuffer((t) => {
    if (t < 1.5) {
      const semi = (t / 1.5) * 7;
      return 146.83 * Math.pow(2, semi / 12);
    }
    const vib = 0.25 * Math.sin(2 * Math.PI * 4.5 * t);
    return 220.0 * Math.pow(2, vib / 12);
  }, 3.2);

  const decoded = await decodeAndValidateAudioBuffer(wav, 'glide.wav');
  const prep = preprocessAudio(decoded.samples, decoded.sampleRate);
  const frames = extractRawPitchFrames(prep.samples, prep.sampleRate);
  const gamaka = analyzeGamakaDescriptors(frames, 146.83);

  assert.ok(gamaka.detectedGlideCount >= 1);
  assert.ok(gamaka.maxPitchExcursionSemitones >= 5.5);
  assert.ok(gamaka.oscillationRateHz !== null && gamaka.oscillationRateHz > 2.0);
});

test('decoder handles WAVE_FORMAT_EXTENSIBLE (0xFFFE) and robust normalization handles mic click spikes', async () => {
  // Build WAVE_FORMAT_EXTENSIBLE 40-byte fmt chunk WAV with quiet 164.81 Hz (E3) + one loud click spike
  const sr = 22050;
  const dur = 2.0;
  const n = Math.floor(sr * dur);
  const fmtSize = 40;
  const buf = Buffer.alloc(12 + 8 + fmtSize + 8 + n * 2);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(buf.length - 8, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(fmtSize, 16);
  buf.writeUInt16LE(0xfffe, 20); // WAVE_FORMAT_EXTENSIBLE
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.writeUInt16LE(22, 36); // cbSize
  buf.writeUInt16LE(16, 38); // validBitsPerSample
  buf.writeUInt32LE(4, 40); // channelMask
  buf.writeUInt16LE(1, 44); // SubFormat PCM = 1

  const dataHeaderOffset = 12 + 8 + fmtSize;
  buf.write('data', dataHeaderOffset, 'ascii');
  buf.writeUInt32LE(n * 2, dataHeaderOffset + 4);

  for (let i = 0; i < n; i++) {
    let val = 0.04 * Math.sin((2 * Math.PI * 164.81 * i) / sr);
    if (i === 5000) val = 0.99; // Isolated mic pop
    buf.writeInt16LE(Math.round(val * 32767), dataHeaderOffset + 8 + i * 2);
  }

  const decoded = await decodeAndValidateAudioBuffer(buf, 'extensible_vocal.wav');
  const prep = preprocessAudio(decoded.samples, decoded.sampleRate);
  const frames = extractRawPitchFrames(prep.samples, prep.sampleRate);
  const tonic = estimateTonic(frames);

  assert.ok(tonic.estimatedFrequencyHz !== null);
  assert.ok(
    Math.abs(tonic.estimatedFrequencyHz - 164.81) < 4.0,
    `Expected ~164.81 Hz, got ${tonic.estimatedFrequencyHz}`,
  );
});

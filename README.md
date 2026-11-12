# SVARA — Discover the Raga Behind Every Melody

**SVARA** is an AI-powered Indian classical music analysis platform built with React, TypeScript, Tailwind CSS, Recharts, and a modular Node.js/Express audio-intelligence backend.

## Implemented Capabilities

- **Audio Validation & Decoding (`server/audio/decoder.ts`)**: Validates `.wav` and `.mp3` magic bytes, sample rate, channels, duration bounds (`1s–900s`), and decodes PCM WAV (8/16/24/32-bit) and MP3 (`mpg123-decoder` WASM) with safe temporary file cleanup.
- **Tonic / Shruti Estimation (`server/audio/tonicEstimator.ts`)**: Energy- and stability-weighted 10-cent chroma histogram with harmonic fifth (`Pa`) reinforcement and explicit reliability grading (`high`, `moderate`, `low`, `unreliable`).
- **YIN Pitch Tracking & Tonic Normalisation (`server/audio/pitchTracker.ts`)**: Estimates F0 (`65–900 Hz`) using YIN with parabolic interpolation, median outlier filtering, unvoiced frame masking, and tonic normalisation via `p(t) = 12 log2(f(t) / f_tonic)`.
- **Melodic & Spectral Features (`server/features/featureExtractor.ts`)**: Computes 12-bin Svara distributions, interval transition counts, run-length collapsed temporal Svara sequences, and radix-2 FFT spectral centroid / flatness / ZCR.
- **Gamaka Descriptors (`server/gamaka/gamakaAnalyzer.ts`)**: Measures continuous glides, pitch excursions, local oscillation rates (Hz), pitch slope, and contour curvature—paired with a clear musicological interpretation boundary.
- **DTW Pakad Matching (`server/pakad/pakadMatcher.ts`)**: Runs sliding-window Dynamic Time Warping against curated Hindustani Pakad reference sequences (`server/data/pakad_references.json`).
- **Modular Classifier Interface (`server/classifier/ragaClassifier.ts`)**: Connects to an external Python/FastAPI classifier via `RAGA_MODEL_API_URL`. When unconfigured, SVARA explicitly reports `"Raga classification model not yet trained or connected."` without inventing predictions.
- **Explainability (`server/services/explainabilityService.ts`)**: Produces evidence-grounded explanations from real analysis outputs (with optional server-side Gemini summarization grounded strictly in extracted telemetry).

## Running Locally

```bash
npm install
npm run dev
```

The server listens on `http://localhost:3000`.

## Running Tests & Verification

```bash
npm test
npm run lint
npm run build
```

## Connecting an External Python ML Model

Configure `RAGA_MODEL_API_URL` (and optionally `RAGA_MODEL_API_KEY`) in your environment. See `research/documentation/dataset_and_ml_integration.md` and `research/dataset/dataset_schema.json` for the expected FastAPI request/response contract and CompMusic/Saraga split hygiene rules.

import React from 'react';
import { ArrowRight, AudioLines, BookOpen, GitBranch, ShieldAlert } from 'lucide-react';
import type { AppRoute } from '../components/Navbar';
import { WaveformVisual } from '../components/WaveformVisual';

interface HomePageProps {
  onNavigate: (route: AppRoute) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="border-b border-[#E5E7EB] bg-[#F7F6F2] pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-6">
            <p className="text-xs font-medium tracking-wide text-[#87998C]">
              Indian Classical Music Analysis · Melodic Intelligence
            </p>
            <h1 className="font-editorial mt-4 text-4xl font-semibold leading-[1.12] tracking-tight text-[#222831] sm:text-5xl lg:text-[3.5rem]">
              Discover the Raga Behind Every Melody.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-[#4B5563] sm:text-lg">
              Explore Indian classical music through artificial intelligence,
              melodic intelligence and traditional musical knowledge.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigate('/analyze')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#34495E] px-6 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#222831] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#34495E]"
              >
                Analyse Your Music
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/ragas')}
                className="inline-flex items-center gap-2 rounded-lg border border-[#87998C] bg-white px-6 py-3 text-sm font-medium text-[#222831] transition-colors duration-150 hover:bg-[#F7F6F2] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#34495E]"
              >
                Explore Raga Library
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <WaveformVisual />
          </div>
        </div>
      </section>

      {/* 1. Introduction to SVARA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 border-b border-[#E5E7EB] pb-16 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="font-editorial text-2xl font-semibold text-[#222831] sm:text-3xl">
              Beyond Note Counting
            </h2>
          </div>
          <div className="space-y-4 text-base leading-relaxed text-[#4B5563] lg:col-span-8">
            <p>
              A Raga is never defined solely by an unordered scale of twelve
              chromatic pitches. Two distinct Ragas such as Bhupali and Deshkar
              share the exact same five pitch classes, yet diverge in their
              tonic emphasis, ornamental inflections, and characteristic phrases.
            </p>
            <p>
              SVARA bridges acoustic signal processing and classical musicology
              by extracting continuous fundamental frequency contours, normalising
              pitches to the performer&apos;s tonic (Sa), quantifying Gamaka
              excursions, and aligning observed melodic motifs against curated
              Pakad references.
            </p>
          </div>
        </div>
      </section>

      {/* 2. How the Application Works */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-editorial text-2xl font-semibold text-[#222831] sm:text-3xl">
              How SVARA Analyses a Recording
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[#4B5563]">
              Every uploaded WAV or MP3 recording moves through an auditable
              signal-processing and melodic-evidence pipeline.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/how-it-works')}
            className="text-sm font-medium text-[#34495E] underline decoration-[#B89B62] underline-offset-4 hover:text-[#222831] cursor-pointer whitespace-nowrap shrink-0"
          >
            View full 10-stage architecture
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              step: '01',
              title: 'Tonic & Pitch Contour',
              body: 'Estimates Sa (Shruti) via stability-weighted pitch histograms and tracks F0 via YIN in tonic-normalised semitones.',
            },
            {
              step: '02',
              title: 'Gamaka Descriptors',
              body: 'Measures continuous meend glides, excursion spans, modulation rate, pitch slope, and contour curvature.',
            },
            {
              step: '03',
              title: 'Pakad Alignment',
              body: 'Runs subsequence Dynamic Time Warping against curated Hindustani reference phrases.',
            },
            {
              step: '04',
              title: 'Explainable & Honest ML',
              body: 'Connects to external Python classifiers when configured and withholds uncertain or unsupported predictions.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-xl border border-[#E5E7EB] bg-white p-6"
            >
              <span className="font-mono text-xs font-medium text-[#B89B62] tabular-nums">
                {item.step}
              </span>
              <h3 className="mt-3 text-base font-semibold text-[#222831]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#4B5563]">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Core AI Capabilities (Asymmetric Bento) */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-editorial text-2xl font-semibold text-[#222831] sm:text-3xl">
          Core Analytical Capabilities
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-7 lg:col-span-7">
            <div className="flex items-center gap-3 text-[#34495E]">
              <AudioLines className="h-5 w-5" aria-hidden="true" />
              <h3 className="text-lg font-semibold text-[#222831]">
                Tonic-Normalised Pitch &amp; Melodic Grammar
              </h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#4B5563]">
              Indian classical performances establish a relative tonic (Sa) that
              varies across vocalists and instruments. SVARA converts raw Hz
              tracks into relative semitone contours via{' '}
              <span className="font-mono text-xs text-[#222831]">
                p(t) = 12 log2(f(t) / f_tonic)
              </span>
              , preserving both sustained Svara centres and microtonal movement
              between them.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-4 border-t border-[#E5E7EB] pt-5 text-sm">
              <div>
                <div className="font-mono text-lg font-semibold text-[#222831] tabular-nums">
                  65–900 Hz
                </div>
                <div className="mt-1 text-xs text-[#6B7280]">
                  YIN F0 search range
                </div>
              </div>
              <div>
                <div className="font-mono text-lg font-semibold text-[#222831] tabular-nums">
                  10 cents
                </div>
                <div className="mt-1 text-xs text-[#6B7280]">
                  Chroma histogram bin
                </div>
              </div>
              <div>
                <div className="font-mono text-lg font-semibold text-[#222831] tabular-nums">
                  DTW
                </div>
                <div className="mt-1 text-xs text-[#6B7280]">
                  Subsequence alignment
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E7EB] bg-white p-7 lg:col-span-5">
            <div className="flex items-center gap-3 text-[#34495E]">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
              <h3 className="text-lg font-semibold text-[#222831]">
                Uncertainty-Aware Restraint
              </h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#4B5563]">
              When voiced pitch coverage is sparse, the tonic estimate is
              ambiguous, or no trained classifier endpoint is connected, SVARA
              explicitly surfaces uncertainty warnings instead of fabricating a
              Raga label.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('/analyze')}
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[#34495E] hover:text-[#222831] cursor-pointer"
            >
              Inspect live acoustic pipeline
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* 4. Why Raga Identification is Challenging + 5. Supported Traditions */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-8">
            <h2 className="font-editorial text-2xl font-semibold text-[#222831]">
              Why Raga Identification is Challenging
            </h2>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-[#4B5563]">
              <li>
                <strong className="text-[#222831]">Variable Tonic (Sa):</strong>{' '}
                Each artist selects a personal Shruti; pitch features must be
                normalised before cross-recording comparison.
              </li>
              <li>
                <strong className="text-[#222831]">Continuous Gamakas:</strong>{' '}
                Glides (Meend) and oscillations (Andolan, Kampita) carry
                structural identity lost in discrete MIDI quantization.
              </li>
              <li>
                <strong className="text-[#222831]">Shared Scale Sets:</strong>{' '}
                Distinct Ragas share identical Svaras and diverge only in Vadi,
                Aarohana-Avarohana asymmetry, and Pakad phrasing.
              </li>
              <li>
                <strong className="text-[#222831]">Polyphonic Accompaniment:</strong>{' '}
                Tanpura drones, percussion (Tabla / Mridangam), and room
                acoustics complicate single-F0 extraction.
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-[#E5E7EB] bg-white p-8">
            <div className="flex items-center gap-2.5 text-[#34495E]">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
              <h2 className="font-editorial text-2xl font-semibold text-[#222831]">
                Supported Musical Traditions
              </h2>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-[#4B5563]">
              Hindustani and Carnatic music share foundational concepts such as
              Sa-Pa consonance and Raga grammar, but diverge sharply in Svara
              nomenclature, Thaat vs. Melakarta taxonomy, and Gamaka typology.
            </p>
            <div className="mt-5 space-y-4 border-t border-[#E5E7EB] pt-5 text-sm">
              <div>
                <div className="font-semibold text-[#222831]">
                  Hindustani Classical · Classifier Scope
                </div>
                <p className="mt-1 text-[#4B5563]">
                  Curated Pakad references and initial ML classifier integration
                  are strictly scoped to canonical Hindustani Ragas (e.g., Yaman,
                  Bhairav, Bhupali, Malkauns, Darbari Kanada).
                </p>
              </div>
              <div>
                <div className="font-semibold text-[#222831]">
                  Carnatic Classical · Separate Reference Catalogue
                </div>
                <p className="mt-1 text-[#4B5563]">
                  Catalogued separately in the Raga Library under Melakarta and
                  Janya classifications without mixing traditions inside one
                  classifier.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Research & Technology */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-8 md:p-10">
          <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-medium text-[#87998C]">
                <GitBranch className="h-4 w-4" aria-hidden="true" />
                Research &amp; Machine-Learning Readiness
              </div>
              <h2 className="font-editorial mt-2 text-2xl font-semibold text-[#222831]">
                Engineered for External Python ML Integration
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#4B5563]">
                SVARA runs genuine WAV/MP3 decoding, YIN F0 tracking, spectral
                FFT analysis, and DTW sequence matching directly on Node.js,
                while exposing a clean HTTP adapter for future Python (FastAPI,
                Librosa, Essentia, XGBoost, PyTorch GRU/LSTM) models trained on
                recording-disjoint CompMusic and Saraga splits.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/about')}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-[#F7F6F2] px-5 py-2.5 text-sm font-medium text-[#222831] transition-colors hover:bg-[#E5E7EB]/60 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Read Research Overview
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

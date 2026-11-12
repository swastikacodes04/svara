import React from 'react';

export const AboutPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-5xl space-y-12 px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-[#E5E7EB] pb-6">
        <p className="text-xs font-medium text-[#87998C]">
          Research Report Reference &amp; Engineering Scope
        </p>
        <h1 className="font-editorial mt-2 text-3xl font-semibold text-[#222831] sm:text-4xl">
          About SVARA
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#4B5563]">
          SVARA is an explainable, uncertainty-aware Indian classical music
          analysis platform built to investigate melodic movement, tonic
          relativity, ornamentation, and characteristic phrases rather than
          treating Ragas as static pitch-class bags.
        </p>
      </div>

      {/* Background & Motivation */}
      <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-7">
          <h2 className="font-editorial text-xl font-semibold text-[#222831]">
            Project Background &amp; Motivation
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#4B5563]">
            Indian classical music relies on continuous pitch trajectories,
            performer-specific Shruti selection, and expressive Gamakas.
            Conventional Western MIR classifiers built on fixed 12-tone equal
            temperament and MFCC averages frequently confuse Ragas that share an
            identical set of Svaras (such as Bhupali and Deshkar). SVARA addresses
            this gap with tonic-normalised F0 contours and phrase-level evidence.
          </p>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-7">
          <h2 className="font-editorial text-xl font-semibold text-[#222831]">
            Problem Statement
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#4B5563]">
            Automatic Raga identification suffers when models ignore tonic
            variance, flatten continuous microtonal glides, mix Hindustani and
            Carnatic taxonomies without separation, or output high-confidence
            guesses on noisy, non-classical, or out-of-scope audio recordings.
          </p>
        </div>
      </section>

      {/* Objectives & Methodology */}
      <section className="rounded-xl border border-[#E5E7EB] bg-white p-8">
        <h2 className="font-editorial text-2xl font-semibold text-[#222831]">
          Objectives &amp; Proposed Methodology
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-[#222831]">
              Core Objectives
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-[#4B5563]">
              <li>• Estimate the tonic (Sa) with explicit reliability grading.</li>
              <li>• Extract clean F0 trajectories and normalise via p(t) = 12 log2(f(t) / f_tonic).</li>
              <li>• Quantify measurable Gamaka contour descriptors (glides, excursions, modulation).</li>
              <li>• Align observed Swara sequences against curated Pakad references via DTW.</li>
              <li>• Surface explainable evidence and honest uncertainty warnings.</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#222831]">
              Research Contribution &amp; Architecture
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-[#4B5563]">
              <li>• Modular Node.js/TypeScript DSP engine paired with React interactive diagnostics.</li>
              <li>• Clean HTTP model adapter (RAGA_MODEL_API_URL) for external Python FastAPI ML models.</li>
              <li>• Strict separation of Hindustani classifier scope from Carnatic reference profiles.</li>
              <li>• Zero fabricated predictions when no trained classifier is connected.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Dataset Readiness & ML Stack */}
      <section className="rounded-xl border border-[#E5E7EB] bg-white p-8">
        <h2 className="font-editorial text-2xl font-semibold text-[#222831]">
          Dataset Readiness &amp; Python ML Integration
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[#4B5563]">
          SVARA&apos;s research schema prepares for training and evaluating models on
          curated corpora such as <strong>CompMusic</strong> and{' '}
          <strong>Saraga</strong> while preserving source recording IDs,
          licensing constraints, and performer-disjoint dataset splits to
          prevent clip-level data leakage.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-[#E5E7EB] pt-5 sm:grid-cols-3 text-sm">
          <div>
            <div className="font-semibold text-[#222831]">Feature Backends</div>
            <p className="mt-1 text-xs text-[#4B5563]">
              Python, FastAPI, Librosa, Essentia, Dynamic Time Warping
            </p>
          </div>
          <div>
            <div className="font-semibold text-[#222831]">Candidate Models</div>
            <p className="mt-1 text-xs text-[#4B5563]">
              Scikit-learn SVM, XGBoost, PyTorch GRU/LSTM, CNN, Transformers
            </p>
          </div>
          <div>
            <div className="font-semibold text-[#222831]">Evaluation Hygiene</div>
            <p className="mt-1 text-xs text-[#4B5563]">
              Recording-level &amp; performer-disjoint splits; calibrated rejection
            </p>
          </div>
        </div>
      </section>

      {/* Current Limitations & Future Enhancements */}
      <section className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-7">
          <h2 className="font-editorial text-xl font-semibold text-[#222831]">
            Current Limitations
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#4B5563]">
            <li>
              • No trained ML Raga classifier weights are bundled in this first
              web release; classification remains gated until an external model
              service is connected.
            </li>
            <li>
              • Monophonic YIN pitch tracking degrades on dense polyphonic mixes
              with loud percussion or multi-instrument overlap.
            </li>
            <li>
              • Numerical Gamaka descriptors capture contour geometry and do not
              exhaustively model classical aesthetic nuances.
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] bg-white p-7">
          <h2 className="font-editorial text-xl font-semibold text-[#222831]">
            Future Enhancements
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#4B5563]">
            <li>
              • Connect a trained FastAPI PyTorch GRU/LSTM + XGBoost ensemble
              over CompMusic/Saraga features via <span className="font-mono text-xs">RAGA_MODEL_API_URL</span>.
            </li>
            <li>
              • Add source-separation preprocessing (harmonic/percussive and
              vocal-accompaniment separation) prior to F0 tracking.
            </li>
            <li>
              • Calibrate hybrid fusion weights using held-out validation curves
              and expand Carnatic Gamaka-specific classifiers separately.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
};

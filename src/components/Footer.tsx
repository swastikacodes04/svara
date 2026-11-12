import React from 'react';
import type { AppRoute } from './Navbar';

interface FooterProps {
  onNavigate: (route: AppRoute) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const linkClick = (e: React.MouseEvent, route: AppRoute) => {
    e.preventDefault();
    onNavigate(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-[#E5E7EB] bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <span className="font-editorial text-xl font-semibold text-[#222831]">
              SVARA
            </span>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#4B5563]">
              Discover the Raga Behind Every Melody. A research-oriented Indian
              classical music analysis platform combining acoustic signal
              processing with explainable machine-learning readiness.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#222831]">Platform</h3>
            <ul className="mt-3 space-y-2 text-sm text-[#4B5563]">
              <li>
                <a
                  href="/"
                  onClick={(e) => linkClick(e, '/')}
                  className="hover:text-[#222831] transition-colors"
                >
                  Home
                </a>
              </li>
              <li>
                <a
                  href="/analyze"
                  onClick={(e) => linkClick(e, '/analyze')}
                  className="hover:text-[#222831] transition-colors"
                >
                  Analyse Music
                </a>
              </li>
              <li>
                <a
                  href="/ragas"
                  onClick={(e) => linkClick(e, '/ragas')}
                  className="hover:text-[#222831] transition-colors"
                >
                  Raga Library
                </a>
              </li>
              <li>
                <a
                  href="/how-it-works"
                  onClick={(e) => linkClick(e, '/how-it-works')}
                  className="hover:text-[#222831] transition-colors"
                >
                  How It Works
                </a>
              </li>
              <li>
                <a
                  href="/about"
                  onClick={(e) => linkClick(e, '/about')}
                  className="hover:text-[#222831] transition-colors"
                >
                  About SVARA
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#222831]">
              Methodology &amp; Scope
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[#4B5563]">
              Hindustani and Carnatic taxonomies are catalogued separately.
              Predictions are withheld whenever acoustic evidence is weak or no
              trained classification model is connected.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-[#E5E7EB] pt-6 text-xs text-[#6B7280] sm:flex-row sm:items-center">
          <p>SVARA · Indian Classical Music Intelligence Research Platform</p>
          <p>Built on Node.js, TypeScript, Web Audio, YIN F0 &amp; DTW Alignment</p>
        </div>
      </div>
    </footer>
  );
};

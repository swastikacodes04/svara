import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { fetchRagas } from '../services/api';
import type { MusicalTradition, RagaProfile } from '../types/svara';

export const RagaLibraryPage: React.FC = () => {
  const [ragas, setRagas] = useState<RagaProfile[]>([]);
  const [scopeNote, setScopeNote] = useState<string>('');
  const [tradition, setTradition] = useState<MusicalTradition | 'All'>('All');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>('yaman');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const timer = window.setTimeout(() => {
      fetchRagas({ tradition, search })
        .then((data) => {
          if (!active) return;
          setRagas(data.ragas);
          setScopeNote(data.traditionScopeNote);
          setLoading(false);
        })
        .catch((err) => {
          if (!active) return;
          setError(
            err instanceof Error ? err.message : 'Unable to load Raga library.',
          );
          setLoading(false);
        });
    }, 150);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [tradition, search]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="border-b border-[#E5E7EB] pb-6">
        <p className="text-xs font-medium text-[#87998C]">
          Structured Musicological Reference Database
        </p>
        <h1 className="font-editorial mt-2 text-3xl font-semibold text-[#222831] sm:text-4xl">
          Raga Library
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#4B5563]">
          {scopeNote ||
            'Browse verified Hindustani and Carnatic Raga profiles. Traditions are kept separate and never mixed into a single uncalibrated classifier.'}
        </p>
      </div>

      {/* Search & Tradition Segmented Controls */}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6B7280]"
            aria-hidden="true"
          />
          <label htmlFor="raga-search" className="sr-only">
            Search Ragas by name, Thaat, Svara, or Pakad
          </label>
          <input
            id="raga-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Raga, Thaat, Svara, or Pakad..."
            className="w-full rounded-lg border border-[#E5E7EB] bg-white py-2.5 pr-4 pl-10 text-sm text-[#222831] placeholder:text-[#9CA3AF] focus:border-[#34495E] focus:outline-none"
          />
        </div>

        <div
          role="group"
          aria-label="Filter by musical tradition"
          className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white p-1 self-start"
        >
          {(['All', 'Hindustani', 'Carnatic'] as const).map((item) => {
            const active = tradition === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setTradition(item)}
                className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#34495E] text-white'
                    : 'text-[#4B5563] hover:text-[#222831]'
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Count */}
      <div className="mt-5 text-xs text-[#6B7280] font-mono tabular-nums">
        {loading
          ? 'Loading Ragas...'
          : `Showing ${ragas.length} Raga profile${ragas.length === 1 ? '' : 's'}`}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
        >
          {error}
        </div>
      )}

      {!loading && !error && ragas.length === 0 && (
        <div className="mt-8 rounded-xl border border-[#E5E7EB] bg-white p-10 text-center">
          <p className="text-sm font-medium text-[#222831]">
            No Ragas matched "{search}".
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setTradition('All');
            }}
            className="mt-3 text-xs font-medium text-[#34495E] underline underline-offset-4 cursor-pointer"
          >
            Reset search and filters
          </button>
        </div>
      )}

      {/* Raga Profiles Accordion / Cards */}
      <div className="mt-6 space-y-4">
        {ragas.map((raga) => {
          const isOpen = expandedId === raga.id;
          return (
            <article
              key={raga.id}
              className="rounded-xl border border-[#E5E7EB] bg-white transition-colors"
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setExpandedId(isOpen ? null : raga.id)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#34495E]"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#6B7280]">
                    <span className="font-medium text-[#34495E]">
                      {raga.tradition}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{raga.thaat}</span>
                    <span aria-hidden="true">·</span>
                    <span>{raga.verificationStatus}</span>
                  </div>
                  <h2 className="font-editorial mt-1 text-xl font-semibold text-[#222831]">
                    {raga.name}
                  </h2>
                  <p className="mt-1 font-mono text-xs text-[#4B5563]">
                    Pakad: {raga.pakad}
                  </p>
                </div>

                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#4B5563]">
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-[#E5E7EB] px-6 py-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <div className="text-xs font-medium text-[#6B7280]">
                        Aarohana
                      </div>
                      <div className="mt-1 font-mono text-sm text-[#222831]">
                        {raga.aarohana}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[#6B7280]">
                        Avarohana
                      </div>
                      <div className="mt-1 font-mono text-sm text-[#222831]">
                        {raga.avarohana}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[#6B7280]">
                        Vadi &amp; Samvadi
                      </div>
                      <div className="mt-1 text-sm text-[#222831]">
                        Vadi: {raga.vadi} · Samvadi: {raga.samvadi}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-medium text-[#6B7280]">
                        Important Svaras
                      </div>
                      <div className="mt-1 text-sm text-[#222831]">
                        {raga.importantSvaras.join(' · ')}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[#6B7280]">
                        Performance Time
                      </div>
                      <div className="mt-1 text-sm text-[#222831]">
                        {raga.performanceTime}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[#6B7280]">
                        Related Ragas
                      </div>
                      <div className="mt-1 text-sm text-[#222831]">
                        {raga.relatedRagas.join(', ')}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-6 border-t border-[#E5E7EB] pt-5 md:grid-cols-2">
                    <div>
                      <h3 className="text-xs font-semibold text-[#222831]">
                        Characteristic Melodic Movements
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-[#4B5563]">
                        {raga.characteristicMovements}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-[#222831]">
                        Relevant Musical Characteristics
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-[#4B5563]">
                        {raga.musicalCharacteristics}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] pt-4 text-xs text-[#6B7280]">
                    <span>Source: {raga.sourceNote}</span>
                    <span>
                      Classifier scope:{' '}
                      {raga.classifierScopeSupported
                        ? 'Included in Hindustani ML scope'
                        : 'Reference only (excluded from Hindustani classifier)'}
                    </span>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};

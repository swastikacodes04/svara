import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

export type AppRoute =
  | '/'
  | '/analyze'
  | '/results'
  | '/ragas'
  | '/how-it-works'
  | '/about';

interface NavbarProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

const NAV_ITEMS: Array<{ route: AppRoute; label: string }> = [
  { route: '/', label: 'Home' },
  { route: '/analyze', label: 'Analyse Music' },
  { route: '/ragas', label: 'Raga Library' },
  { route: '/how-it-works', label: 'How It Works' },
  { route: '/about', label: 'About' },
];

export const Navbar: React.FC<NavbarProps> = ({ currentRoute, onNavigate }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLink = (e: React.MouseEvent, route: AppRoute) => {
    e.preventDefault();
    setMobileOpen(false);
    onNavigate(route);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#E5E7EB] bg-[#F7F6F2]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Zone 1: Brand wordmark */}
        <a
          href="/"
          onClick={(e) => handleLink(e, '/')}
          className="font-editorial text-2xl font-semibold tracking-tight text-[#222831] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#34495E]"
        >
          SVARA
        </a>

        {/* Zone 2: Navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#4B5563]"
        >
          {NAV_ITEMS.map((item) => {
            const isActive =
              currentRoute === item.route ||
              (currentRoute === '/results' && item.route === '/analyze');
            return (
              <a
                key={item.route}
                href={item.route}
                onClick={(e) => handleLink(e, item.route)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#34495E] ${
                  isActive
                    ? 'text-[#222831] font-semibold'
                    : 'hover:text-[#222831]'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[15px] h-[2px] bg-[#B89B62]"
                  />
                )}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onNavigate('/analyze');
            }}
            className="hidden sm:inline-flex items-center justify-center rounded-lg bg-[#34495E] px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#222831] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#34495E]"
          >
            Analyse Audio
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#222831] md:hidden cursor-pointer focus-visible:outline-2 focus-visible:outline-[#34495E]"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileOpen && (
        <nav
          aria-label="Mobile navigation"
          className="border-t border-[#E5E7EB] bg-white px-4 py-4 md:hidden"
        >
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = currentRoute === item.route;
              return (
                <a
                  key={item.route}
                  href={item.route}
                  onClick={(e) => handleLink(e, item.route)}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#F7F6F2] text-[#222831] font-semibold'
                      : 'text-[#4B5563] hover:bg-[#F7F6F2] hover:text-[#222831]'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onNavigate('/analyze');
              }}
              className="mt-2 w-full rounded-lg bg-[#34495E] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#222831] cursor-pointer"
            >
              Analyse Audio
            </button>
          </div>
        </nav>
      )}
    </header>
  );
};

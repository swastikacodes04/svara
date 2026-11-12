import { useEffect, useState } from 'react';
import { Footer } from './components/Footer';
import { Navbar, type AppRoute } from './components/Navbar';
import { AboutPage } from './pages/AboutPage';
import { AnalyzePage } from './pages/AnalyzePage';
import { HomePage } from './pages/HomePage';
import { HowItWorksPage } from './pages/HowItWorksPage';
import { RagaLibraryPage } from './pages/RagaLibraryPage';
import { ResultsPage } from './pages/ResultsPage';
import type { AnalysisResponse } from './types/svara';

function normalizeRoute(pathname: string): AppRoute {
  if (
    pathname === '/analyze' ||
    pathname === '/results' ||
    pathname === '/ragas' ||
    pathname === '/how-it-works' ||
    pathname === '/about'
  ) {
    return pathname;
  }
  return '/';
}

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() =>
    normalizeRoute(window.location.pathname),
  );
  const [latestResult, setLatestResult] = useState<AnalysisResponse | null>(null);

  useEffect(() => {
    const onPopState = () => {
      setRoute(normalizeRoute(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (nextRoute: AppRoute) => {
    if (window.location.pathname !== nextRoute) {
      window.history.pushState({}, '', nextRoute);
    }
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAnalysisComplete = (result: AnalysisResponse) => {
    setLatestResult(result);
    navigate('/results');
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F6F2] text-[#222831]">
      <Navbar currentRoute={route} onNavigate={navigate} />

      <main className="flex-1">
        {route === '/' && <HomePage onNavigate={navigate} />}
        {route === '/analyze' && (
          <AnalyzePage onAnalysisComplete={handleAnalysisComplete} />
        )}
        {route === '/results' && (
          <ResultsPage
            result={latestResult}
            onBackToAnalyze={() => navigate('/analyze')}
            onExploreRagas={() => navigate('/ragas')}
          />
        )}
        {route === '/ragas' && <RagaLibraryPage />}
        {route === '/how-it-works' && <HowItWorksPage />}
        {route === '/about' && <AboutPage />}
      </main>

      <Footer onNavigate={navigate} />
    </div>
  );
}

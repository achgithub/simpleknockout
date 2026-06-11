import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useDbReady } from '@/hooks/useDb';
import { Splash } from '@/components/Splash';
import { Home } from '@/pages/Home';
import { NewTournament } from '@/pages/NewTournament';
import { Dashboard } from '@/pages/Dashboard';
import { Register } from '@/pages/Register';
import { Groups } from '@/pages/Groups';
import { Bracket } from '@/pages/Bracket';
import { Settings } from '@/pages/Settings';
import { AppSettings } from '@/pages/AppSettings';
import { Players } from '@/pages/Players';
import { Diagnostics } from '@/pages/Diagnostics';
import { TabBar } from '@/components/TabBar';
import { AdBanner } from '@/components/AdBanner';

const TAB_PATHS = ['/', '/players', '/settings'];

// Minimum time the splash stays up so it doesn't flash on fast launches.
const SPLASH_MIN_MS = 1200;
// Duration of the splash fade-out — keep in sync with Splash's transition.
const SPLASH_FADE_MS = 500;

export function App() {
  const { ready, error } = useDbReady();
  const [splashElapsed, setSplashElapsed] = useState(false);
  const [splashGone, setSplashGone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSplashElapsed(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  const appReady = ready && splashElapsed;

  // Once the app is ready, fade the splash out, then unmount it.
  useEffect(() => {
    if (!appReady) return;
    const timer = setTimeout(() => setSplashGone(true), SPLASH_FADE_MS);
    return () => clearTimeout(timer);
  }, [appReady]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4">
        <p className="text-red-500 font-semibold text-sm">DB Error</p>
        <p className="text-gray-700 text-xs text-center break-all">{error}</p>
      </div>
    );
  }

  return (
    <>
      {appReady && <Shell />}
      {!splashGone && <Splash exiting={appReady} />}
    </>
  );
}

// Single root shell: scrollable routed content, with the TabBar (on tab
// routes) and the ad banner pinned below it. Both are rendered once at the
// root so the native ad overlay isn't repeatedly shown/hidden on navigation.
function Shell() {
  const { pathname } = useLocation();
  const isTabRoute = TAB_PATHS.includes(pathname);

  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>
      <div className="flex-1 overflow-y-auto min-h-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/players" element={<Players />} />
          <Route path="/settings" element={<AppSettings />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          <Route path="/tournament/new" element={<NewTournament />} />
          <Route path="/tournament/:id" element={<Dashboard />} />
          <Route path="/tournament/:id/register" element={<Register />} />
          <Route path="/tournament/:id/groups" element={<Groups />} />
          <Route path="/tournament/:id/bracket" element={<Bracket />} />
          <Route path="/tournament/:id/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {isTabRoute && <TabBar />}
      <AdBanner />
    </div>
  );
}

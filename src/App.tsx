import { Routes, Route, Navigate } from 'react-router-dom';
import { useDbReady } from '@/hooks/useDb';
import { Home } from '@/pages/Home';
import { NewTournament } from '@/pages/NewTournament';
import { Dashboard } from '@/pages/Dashboard';
import { Register } from '@/pages/Register';
import { Groups } from '@/pages/Groups';
import { Bracket } from '@/pages/Bracket';
import { Settings } from '@/pages/Settings';

export function App() {
  const { ready, error } = useDbReady();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 gap-4">
        <p className="text-red-500 font-semibold text-sm">DB Error</p>
        <p className="text-gray-700 text-xs text-center break-all">{error}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/tournament/new" element={<NewTournament />} />
      <Route path="/tournament/:id" element={<Dashboard />} />
      <Route path="/tournament/:id/register" element={<Register />} />
      <Route path="/tournament/:id/groups" element={<Groups />} />
      <Route path="/tournament/:id/bracket" element={<Bracket />} />
      <Route path="/tournament/:id/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

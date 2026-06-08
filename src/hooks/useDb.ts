import { useState, useEffect } from 'react';
import { getDb } from '@/db/client';

export function useDbReady(): { ready: boolean; error: string | null } {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDb()
      .then(() => setReady(true))
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('DB init failed:', msg);
        setError(msg);
      });
  }, []);

  return { ready, error };
}

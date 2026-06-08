import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/Card';
import { EntryInput } from '@/components/EntryInput';
import { getTournament, type Tournament } from '@/db/tournaments';
import { getEntries, addEntry, deleteEntry, updateEntrySeed, type Entry } from '@/db/entries';

export function Register() {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);

  const load = async () => {
    if (!id) return;
    const [t, e] = await Promise.all([getTournament(id), getEntries(id)]);
    setTournament(t);
    setEntries(e.filter((e) => !e.isBye));
  };

  useEffect(() => { void load(); }, [id]);

  if (!tournament) return null;

  const handleAdd = async (names: string[]) => {
    await addEntry(tournament.id, names);
    void load();
  };

  const handleDelete = async (entryId: string) => {
    await deleteEntry(entryId);
    void load();
  };

  const handleSeed = async (entryId: string, seed: number | null) => {
    await updateEntrySeed(entryId, seed);
    void load();
  };

  const isSeeded = tournament.seeding === 'seeded';

  return (
    <Layout title="Entries" back>
      <div className="flex flex-col gap-4">
        <EntryInput entrySize={tournament.entrySize} onCommit={(names) => void handleAdd(names)} />

        {entries.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{entries.length} entries</p>
            {entries.map((entry, i) => (
              <Card key={entry.id} className="flex items-center px-4 py-3 gap-3">
                <span className="text-gray-400 text-sm w-5 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{entry.displayName}</p>
                </div>
                {isSeeded && (
                  <input
                    type="number"
                    min={1}
                    max={entries.length}
                    placeholder="Seed"
                    value={entry.seed ?? ''}
                    onChange={(e) => void handleSeed(entry.id, e.target.value ? Number(e.target.value) : null)}
                    className="w-14 text-sm border border-gray-300 rounded-lg px-2 py-1 text-center"
                  />
                )}
                <button
                  onClick={() => void handleDelete(entry.id)}
                  className="text-gray-400 text-lg leading-none px-1"
                >
                  ×
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

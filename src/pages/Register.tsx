import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/Card';
import { EntryInput } from '@/components/EntryInput';
import { getTournament, type Tournament } from '@/db/tournaments';
import { getEntries, addEntry, deleteEntry, updateEntrySeed, type Entry } from '@/db/entries';
import { getAllUsers, getAllUserGroups, type User, type UserGroup } from '@/db/users';
import clsx from 'clsx';

export function Register() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [tournament, setTournament]   = useState<Tournament | null>(null);
  const [entries, setEntries]         = useState<Entry[]>([]);
  const [showPicker, setShowPicker]   = useState(false);

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

  // Names already entered (to grey them in the picker)
  const enteredNames = new Set(entries.flatMap((e) => e.players.map((p) => p.name.toLowerCase())));

  return (
    <Layout title={t('register.title')} back>
      <div className="flex flex-col gap-4">
        <EntryInput entrySize={tournament.entrySize} onCommit={(names) => void handleAdd(names)} />

        <button
          onClick={() => setShowPicker(true)}
          className="w-full border border-dashed border-brand-400 rounded-xl px-4 py-3 text-sm text-brand-600 font-medium text-center active:bg-brand-50 transition-colors"
        >
          {t('register.browsePlayers')}
        </button>

        {entries.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{t('register.entriesCount', { count: entries.length })}</p>
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
                    placeholder={t('register.seedPlaceholder')}
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

      {showPicker && (
        <UserPicker
          entrySize={tournament.entrySize}
          enteredNames={enteredNames}
          onAdd={(names) => { void handleAdd(names); }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </Layout>
  );
}

// ── User Picker ──────────────────────────────────────────────────────────────

interface PickerProps {
  entrySize:    number;
  enteredNames: Set<string>;
  onAdd:        (names: string[]) => void;
  onClose:      () => void;
}

function UserPicker({ entrySize, enteredNames, onAdd, onClose }: PickerProps) {
  const { t } = useTranslation();
  const [users, setUsers]   = useState<User[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [filter, setFilter] = useState<string | null>(null); // null = All
  // For multi-player entries, accumulate picked names
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([getAllUsers(), getAllUserGroups()]).then(([u, g]) => {
      setUsers(u);
      setGroups(g);
    });
  }, []);

  const visible =
    filter === null     ? users :
    filter === '__none' ? users.filter((u) => u.groups.length === 0) :
    users.filter((u) => u.groups.some((g) => g.id === filter));

  const handleTap = (user: User) => {
    if (enteredNames.has(user.name.toLowerCase())) return;

    if (entrySize === 1) {
      onAdd([user.name]);
      // Keep picker open so user can keep adding
    } else {
      const next = [...picked, user.name];
      if (next.length === entrySize) {
        onAdd(next);
        setPicked([]);
      } else {
        setPicked(next);
      }
    }
  };

  const slotsLeft = entrySize - picked.length;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl flex flex-col" style={{ maxHeight: '75vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <p className="font-semibold text-gray-900">
            {entrySize === 1 ? t('register.addFromPlayers') : t('register.pickMorePlayers', { count: slotsLeft })}
          </p>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>

        {/* Selected slots for multi-player */}
        {entrySize > 1 && (
          <div className="flex gap-2 px-5 pb-3 shrink-0">
            {Array.from({ length: entrySize }).map((_, i) => (
              <div
                key={i}
                className={clsx(
                  'flex-1 rounded-lg border px-2 py-1 text-center text-xs',
                  picked[i]
                    ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                    : 'border-dashed border-gray-300 text-gray-400',
                )}
              >
                {picked[i] ?? t('register.playerN', { n: i + 1 })}
              </div>
            ))}
          </div>
        )}

        {/* Group filter pills */}
        <div className="flex gap-2 overflow-x-auto px-5 pb-3 shrink-0">
          {[
            { id: null,     label: t('common.all') },
            ...(users.some((u) => u.groups.length === 0) ? [{ id: '__none', label: t('common.ungrouped') }] : []),
            ...groups.map((g) => ({ id: g.id, label: g.name })),
          ].map(({ id, label }) => (
            <button
              key={id ?? '__all'}
              onClick={() => setFilter(id as string | null)}
              className={clsx(
                'shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                filter === id
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-600 border-gray-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Player list */}
        <div
          className="flex-1 overflow-y-auto px-5 pb-safe"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--ad-banner-height))' }}
        >
          {visible.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">{t('common.noPlayersInGroup')}</p>
          ) : (
            <div className="flex flex-col gap-1 pb-4">
              {visible.map((u) => {
                const alreadyEntered = enteredNames.has(u.name.toLowerCase());
                const alreadyPicked  = picked.includes(u.name);
                const disabled = alreadyEntered || alreadyPicked;
                return (
                  <button
                    key={u.id}
                    onClick={() => handleTap(u)}
                    disabled={disabled}
                    className={clsx(
                      'w-full flex items-center px-4 py-3 rounded-xl border text-left transition-colors',
                      disabled
                        ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-default'
                        : 'border-gray-200 bg-white text-gray-900 active:bg-brand-50 active:border-brand-300',
                    )}
                  >
                    <span className="flex-1 text-sm font-medium">{u.name}</span>
                    {u.groups.length > 0 && (
                      <span className="text-xs text-gray-400 ml-2">{u.groups.map((g) => g.name).join(', ')}</span>
                    )}
                    {alreadyEntered && <span className="text-xs text-gray-400 ml-2">{t('register.entered')}</span>}
                    {alreadyPicked  && <span className="text-xs text-brand-500 ml-2">{t('register.selected')}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

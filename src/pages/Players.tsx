import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout } from '@/components/Layout';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import clsx from 'clsx';
import {
  getAllUsers,
  getAllUserGroups,
  createUser,
  deleteUser,
  createUserGroup,
  deleteUserGroup,
  setUserGroups,
  type User,
  type UserGroup,
} from '@/db/users';

type Sheet =
  | { type: 'none' }
  | { type: 'addUser' }
  | { type: 'addGroup' }
  | { type: 'editGroups'; user: User };

export function Players() {
  const { t } = useTranslation();
  const [users, setUsers]   = useState<User[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [filter, setFilter] = useState<string | null>(null); // null = All, '__none' = Ungrouped
  const [sheet, setSheet]   = useState<Sheet>({ type: 'none' });

  // Add user form
  const [newName, setNewName]           = useState('');
  const [newGroupIds, setNewGroupIds]   = useState<string[]>([]);
  const nameRef = useRef<HTMLInputElement>(null);

  // Add group form
  const [newGroupName, setNewGroupName] = useState('');
  const groupRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [u, g] = await Promise.all([getAllUsers(), getAllUserGroups()]);
    setUsers(u);
    setGroups(g);
  };

  useEffect(() => { void load(); }, []);

  const openSheet = (s: Sheet) => {
    setSheet(s);
    if (s.type === 'addUser') { setNewName(''); setNewGroupIds([]); setTimeout(() => nameRef.current?.focus(), 50); }
    if (s.type === 'addGroup') { setNewGroupName(''); setTimeout(() => groupRef.current?.focus(), 50); }
  };

  const handleAddUser = async () => {
    if (!newName.trim()) return;
    const user = await createUser(newName.trim());
    if (newGroupIds.length) await setUserGroups(user.id, newGroupIds);
    await load();
    setNewName('');
    setNewGroupIds([]);
    nameRef.current?.focus();
  };

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return;
    await createUserGroup(newGroupName.trim());
    await load();
    setSheet({ type: 'none' });
  };

  const handleDeleteUser = async (id: string) => {
    await deleteUser(id);
    await load();
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm(t('players.confirmDeleteGroup'))) return;
    await deleteUserGroup(id);
    if (filter === id) setFilter(null);
    await load();
  };

  const handleSaveGroups = async (userId: string, groupIds: string[]) => {
    await setUserGroups(userId, groupIds);
    await load();
    setSheet({ type: 'none' });
  };

  // Filtered list
  const visible =
    filter === null      ? users :
    filter === '__none'  ? users.filter((u) => u.groups.length === 0) :
    users.filter((u) => u.groups.some((g) => g.id === filter));

  const hasUngrouped = users.some((u) => u.groups.length === 0);

  return (
    <Layout
      title={t('players.title')}
      right={
        <div className="flex gap-3">
          <button onClick={() => openSheet({ type: 'addGroup' })} className="text-brand-600 text-sm font-medium">{t('players.addGroup')}</button>
          <button onClick={() => openSheet({ type: 'addUser' })} className="text-brand-600 text-sm font-medium">{t('players.addPlayer')}</button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">

        {/* Group filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {[
            { id: null,      label: t('common.all') },
            ...(hasUngrouped ? [{ id: '__none', label: t('common.ungrouped') }] : []),
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
          {/* Group management */}
          {groups.map((g) => (
            filter === g.id && (
              <button
                key={`del-${g.id}`}
                onClick={() => void handleDeleteGroup(g.id)}
                className="shrink-0 px-2 py-1 rounded-full text-xs text-red-400 border border-red-200"
              >
                {t('players.deleteGroup')}
              </button>
            )
          ))}
        </div>

        {/* Player list */}
        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 pt-12 text-center">
            <p className="text-gray-400 text-sm">
              {filter === null ? t('players.noPlayersYet') : t('common.noPlayersInGroup')}
            </p>
            {filter === null && (
              <Button onClick={() => openSheet({ type: 'addUser' })}>{t('players.addFirstPlayer')}</Button>
            )}
          </div>
        ) : (
          <Card className="p-0 overflow-hidden divide-y divide-gray-100">
            {visible.map((u) => (
              <div key={u.id} className="flex items-center px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{u.name}</p>
                  {u.groups.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {u.groups.map((g) => (
                        <span key={g.id} className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full border border-brand-100">
                          {g.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => openSheet({ type: 'editGroups', user: u })}
                  className="text-xs text-brand-600 font-medium shrink-0 px-1"
                >
                  {t('players.groupsButton')}
                </button>
                <button
                  onClick={() => void handleDeleteUser(u.id)}
                  className="text-gray-400 text-lg leading-none px-1 shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* Add Player sheet */}
      {sheet.type === 'addUser' && (
        <BottomSheet title={t('players.addPlayerTitle')} onClose={() => setSheet({ type: 'none' })}>
          <div className="flex flex-col gap-3">
            <input
              ref={nameRef}
              type="text"
              placeholder={t('common.playerNamePlaceholder')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAddUser(); }}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {groups.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 font-medium mb-2">{t('players.groupsOptional')}</p>
                <GroupPills
                  groups={groups}
                  selected={newGroupIds}
                  onToggle={(id) => setNewGroupIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
                />
              </div>
            )}
            <Button onClick={() => void handleAddUser()} disabled={!newName.trim()} fullWidth>
              {t('common.addPlayer')}
            </Button>
          </div>
        </BottomSheet>
      )}

      {/* Add Group sheet */}
      {sheet.type === 'addGroup' && (
        <BottomSheet title={t('players.addGroupTitle')} onClose={() => setSheet({ type: 'none' })}>
          <div className="flex flex-col gap-3">
            <input
              ref={groupRef}
              type="text"
              placeholder={t('players.groupNamePlaceholder')}
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAddGroup(); }}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <Button onClick={() => void handleAddGroup()} disabled={!newGroupName.trim()} fullWidth>
              {t('players.addGroupButton')}
            </Button>
          </div>
        </BottomSheet>
      )}

      {/* Edit Groups sheet */}
      {sheet.type === 'editGroups' && (
        <EditGroupsSheet
          user={sheet.user}
          groups={groups}
          onSave={(gids) => void handleSaveGroups(sheet.user.id, gids)}
          onClose={() => setSheet({ type: 'none' })}
        />
      )}
    </Layout>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function GroupPills({ groups, selected, onToggle }: { groups: UserGroup[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {groups.map((g) => {
        const active = selected.includes(g.id);
        return (
          <button
            key={g.id}
            onClick={() => onToggle(g.id)}
            className={clsx(
              'px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
              active ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200',
            )}
          >
            {g.name}
          </button>
        );
      })}
    </div>
  );
}

function EditGroupsSheet({ user, groups, onSave, onClose }: {
  user: User;
  groups: UserGroup[];
  onSave: (groupIds: string[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>(user.groups.map((g) => g.id));
  const toggle = (id: string) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  return (
    <BottomSheet title={t('players.groupsForUser', { name: user.name })} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {groups.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-2">{t('players.noGroupsYet')}</p>
        ) : (
          <GroupPills groups={groups} selected={selected} onToggle={toggle} />
        )}
        <Button onClick={() => onSave(selected)} fullWidth>{t('common.save')}</Button>
      </div>
    </BottomSheet>
  );
}

function BottomSheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl p-5 pb-safe shadow-xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + var(--ad-banner-height))' }}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-gray-900">{title}</p>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>
        {children}
      </div>
    </>
  );
}

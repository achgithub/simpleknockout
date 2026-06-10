import { v4 as uuid } from 'uuid';
import { getDb } from './client';

export interface UserGroup {
  id: string;
  name: string;
  createdAt: number;
}

export interface User {
  id: string;
  name: string;
  groups: { id: string; name: string }[];
  createdAt: number;
}

// ── Groups ──────────────────────────────────────────────────────────────────

export async function getAllUserGroups(): Promise<UserGroup[]> {
  const db = await getDb();
  const res = await db.query('SELECT * FROM user_groups ORDER BY name ASC');
  return (res.values ?? []).map((r) => ({
    id:        r['id'] as string,
    name:      r['name'] as string,
    createdAt: r['created_at'] as number,
  }));
}

export async function createUserGroup(name: string): Promise<UserGroup> {
  const db = await getDb();
  const id = uuid();
  const now = Date.now();
  await db.run('INSERT INTO user_groups (id,name,created_at) VALUES (?,?,?)', [id, name.trim(), now]);
  return { id, name: name.trim(), createdAt: now };
}

export async function deleteUserGroup(id: string): Promise<void> {
  const db = await getDb();
  // user_group_members rows are removed by ON DELETE CASCADE
  await db.run('DELETE FROM user_groups WHERE id = ?', [id]);
}

// ── Users ────────────────────────────────────────────────────────────────────

export async function getAllUsers(): Promise<User[]> {
  const db = await getDb();
  const uRes = await db.query('SELECT id, name, created_at FROM users ORDER BY name ASC');
  const mRes = await db.query(
    `SELECT ugm.user_id, g.id AS group_id, g.name AS group_name
     FROM user_group_members ugm
     JOIN user_groups g ON ugm.group_id = g.id
     ORDER BY g.name ASC`,
  );

  // Map group memberships by user_id
  const memberMap = new Map<string, { id: string; name: string }[]>();
  for (const r of mRes.values ?? []) {
    const uid = r['user_id'] as string;
    const list = memberMap.get(uid) ?? [];
    list.push({ id: r['group_id'] as string, name: r['group_name'] as string });
    memberMap.set(uid, list);
  }

  return (uRes.values ?? []).map((r) => ({
    id:        r['id'] as string,
    name:      r['name'] as string,
    groups:    memberMap.get(r['id'] as string) ?? [],
    createdAt: r['created_at'] as number,
  }));
}

export async function createUser(name: string): Promise<User> {
  const db = await getDb();
  const id = uuid();
  const now = Date.now();
  await db.run('INSERT INTO users (id,name,created_at) VALUES (?,?,?)', [id, name.trim(), now]);
  return { id, name: name.trim(), groups: [], createdAt: now };
}

export async function deleteUser(id: string): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM users WHERE id = ?', [id]);
}

/** Replace all group memberships for a user */
export async function setUserGroups(userId: string, groupIds: string[]): Promise<void> {
  const db = await getDb();
  await db.run('DELETE FROM user_group_members WHERE user_id = ?', [userId]);
  for (const gid of groupIds) {
    await db.run(
      'INSERT OR IGNORE INTO user_group_members (user_id, group_id) VALUES (?,?)',
      [userId, gid],
    );
  }
}

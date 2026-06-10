import * as XLSX from 'xlsx';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { getAllUsers, getAllUserGroups, createUser, createUserGroup, setUserGroups } from '@/db/users';

// ── XLSX export ───────────────────────────────────────────────────────────────

export async function exportUsers(): Promise<void> {
  const [users, groups] = await Promise.all([getAllUsers(), getAllUserGroups()]);

  // Groups sheet — just a name list for reference while filling in Players
  const groupRows = [
    ['Group Name'],
    ...groups.map((g) => [g.name]),
  ];

  // Players sheet — Name + comma-separated groups
  const playerRows = [
    ['Name', 'Groups (comma separated)'],
    ...users.map((u) => [u.name, u.groups.map((g) => g.name).join(', ')]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(playerRows), 'Players');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(groupRows),  'Groups');

  const buf = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;

  if (Capacitor.isNativePlatform()) {
    const filename = 'simpleknockout-players.xlsx';
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: buf,
      directory: Directory.Cache,
      // base64 — no Encoding flag needed
    });
    await Share.share({ files: [uri], title: filename });
  } else {
    // Web fallback: decode base64 and download
    const binary = atob(buf);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob   = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href = url; a.download = 'simpleknockout-players.xlsx'; a.click();
    URL.revokeObjectURL(url);
  }
}

// ── XLSX import ───────────────────────────────────────────────────────────────

export async function importUsers(file: File): Promise<{ added: number }> {
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: 'array' });

  // Accept the first sheet, or specifically "Players"
  const sheetName = wb.SheetNames.includes('Players') ? 'Players' : wb.SheetNames[0]!;
  const sheet     = wb.Sheets[sheetName]!;
  const rows      = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

  // Collect group names from the data before creating anything
  const incomingGroupNames = new Set<string>();
  for (const row of rows) {
    const groupsCell = row['Groups (comma separated)'] ?? row['Groups'] ?? '';
    groupsCell.split(',').map((s) => s.trim()).filter(Boolean).forEach((g) => incomingGroupNames.add(g));
  }

  // Merge groups
  const existingGroups = await getAllUserGroups();
  const groupMap       = new Map(existingGroups.map((g) => [g.name.toLowerCase(), g.id]));
  for (const gname of incomingGroupNames) {
    if (!groupMap.has(gname.toLowerCase())) {
      const created = await createUserGroup(gname);
      groupMap.set(created.name.toLowerCase(), created.id);
    }
  }

  // Merge users
  const existingUsers  = await getAllUsers();
  const existingNames  = new Set(existingUsers.map((u) => u.name.toLowerCase()));
  let added = 0;

  for (const row of rows) {
    const name = (row['Name'] ?? '').toString().trim();
    if (!name || existingNames.has(name.toLowerCase())) continue;

    const groupsCell = row['Groups (comma separated)'] ?? row['Groups'] ?? '';
    const gids = groupsCell
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean)
      .map((gn: string) => groupMap.get(gn.toLowerCase()))
      .filter(Boolean) as string[];

    const newUser = await createUser(name);
    if (gids.length) await setUserGroups(newUser.id, gids);
    added++;
  }

  return { added };
}

// ── File picker (XLSX) ────────────────────────────────────────────────────────

export function pickXlsxFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const input  = document.createElement('input');
    input.type   = 'file';
    input.accept = '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    input.onchange = () => {
      const file = input.files?.[0];
      file ? resolve(file) : reject(new Error('No file selected'));
    };
    input.click();
  });
}

// ── JSON helpers (used by knockoutExport) ─────────────────────────────────────

export async function shareJson(content: string, filename: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ files: [uri], title: filename });
  } else {
    const blob = new Blob([content], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
}

export function pickJsonFile(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input  = document.createElement('input');
    input.type   = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { reject(new Error('No file selected')); return; }
      file.text().then(resolve, reject);
    };
    input.click();
  });
}

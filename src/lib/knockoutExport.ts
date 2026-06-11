import { v4 as uuid } from 'uuid';
import { getTournament, createTournament, type Tournament } from '@/db/tournaments';
import { getEntries } from '@/db/entries';
import { getMatches } from '@/db/knockout';
import { getDb } from '@/db/client';
import { shareJson, pickJsonFile } from './userExport';

// ── Export format ─────────────────────────────────────────────────────────────

export interface KnockoutExportFile {
  version: 1;
  tournament: {
    name:              string;
    game:              string;
    format:            string;
    entrySize:         number;
    seeding:           string;
    thirdPlacePlayoff: boolean;
    advancementCount:  number;
  };
  entries: {
    localId:     string;
    displayName: string;
    seed:        number | null;
    isBye:       boolean;
    players:     { name: string; slot: number }[];
  }[];
  matches: {
    round:           number;
    position:        number;
    entry1LocalId:   string | null;
    entry2LocalId:   string | null;
    winnerLocalId:   string | null;
    score1:          number | null;
    score2:          number | null;
    status:          string;
    isBye:           boolean;
    isThirdPlace:    boolean;
  }[];
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportKnockout(tournamentId: string): Promise<void> {
  const [tournament, entries, matches] = await Promise.all([
    getTournament(tournamentId),
    getEntries(tournamentId),
    getMatches(tournamentId),
  ]);
  if (!tournament) throw new Error('Tournament not found');

  const data: KnockoutExportFile = {
    version: 1,
    tournament: {
      name:              tournament.name,
      game:              tournament.game,
      format:            tournament.format,
      entrySize:         tournament.entrySize,
      seeding:           tournament.seeding,
      thirdPlacePlayoff: tournament.thirdPlacePlayoff,
      advancementCount:  tournament.advancementCount,
    },
    entries: entries.map((e) => ({
      localId:     e.id,
      displayName: e.displayName,
      seed:        e.seed,
      isBye:       e.isBye,
      players:     e.players.map((p) => ({ name: p.name, slot: p.slot })),
    })),
    matches: matches.map((m) => ({
      round:         m.round,
      position:      m.position,
      entry1LocalId: m.entry1Id,
      entry2LocalId: m.entry2Id,
      winnerLocalId: m.winnerId,
      score1:        m.score1,
      score2:        m.score2,
      status:        m.status,
      isBye:         m.isBye,
      isThirdPlace:  m.isThirdPlace,
    })),
  };

  const safe = tournament.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  await shareJson(JSON.stringify(data, null, 2), `knockout-${safe}.json`);
}

// ── Import ────────────────────────────────────────────────────────────────────

export async function importKnockout(jsonText: string): Promise<Tournament> {
  const data = JSON.parse(jsonText) as KnockoutExportFile;
  if (data.version !== 1) throw new Error('Unknown file version');

  const db = await getDb();

  // Create tournament — append "(Imported)" if name is reused
  const t = await createTournament({
    name:              `${data.tournament.name} (Imported)`,
    game:              data.tournament.game,
    format:            data.tournament.format as Tournament['format'],
    entrySize:         data.tournament.entrySize,
    seeding:           data.tournament.seeding as Tournament['seeding'],
    thirdPlacePlayoff: data.tournament.thirdPlacePlayoff,
    advancementCount:  data.tournament.advancementCount,
  });

  // Build localId → newId map for entries
  const idMap = new Map<string, string>();
  const now = Date.now();

  // Collect every write into a single set so a malformed/partial import file
  // can never leave half a tournament behind — it all commits or none does.
  const set: { statement: string; values: unknown[] }[] = [];

  for (const e of data.entries) {
    const newEntryId = uuid();
    idMap.set(e.localId, newEntryId);

    set.push({
      statement: 'INSERT INTO entries (id,tournament_id,display_name,seed,is_bye,created_at) VALUES (?,?,?,?,?,?)',
      values: [newEntryId, t.id, e.displayName, e.seed ?? null, e.isBye ? 1 : 0, now],
    });

    for (const p of e.players) {
      set.push({
        statement: 'INSERT INTO entry_players (id,entry_id,name,slot) VALUES (?,?,?,?)',
        values: [uuid(), newEntryId, p.name, p.slot],
      });
    }
  }

  // Insert matches using remapped IDs
  for (const m of data.matches) {
    set.push({
      statement:
        `INSERT INTO knockout_matches
         (id,tournament_id,round,position,entry1_id,entry2_id,winner_id,
          score1,score2,status,is_bye,is_third_place)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      values: [
        uuid(), t.id, m.round, m.position,
        m.entry1LocalId ? (idMap.get(m.entry1LocalId) ?? null) : null,
        m.entry2LocalId ? (idMap.get(m.entry2LocalId) ?? null) : null,
        m.winnerLocalId ? (idMap.get(m.winnerLocalId) ?? null) : null,
        m.score1 ?? null, m.score2 ?? null,
        m.status,
        m.isBye ? 1 : 0,
        m.isThirdPlace ? 1 : 0,
      ],
    });
  }

  // Set status to 'knockout' so it lands on the bracket immediately
  set.push({
    statement: "UPDATE tournaments SET status = 'knockout' WHERE id = ?",
    values: [t.id],
  });

  await db.executeSet(set, true);

  return { ...t, status: 'knockout' };
}

export { pickJsonFile };

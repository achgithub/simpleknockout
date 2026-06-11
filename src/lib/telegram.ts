// PLACEHOLDER — wire up bot token + channel ID in tournament settings.
// All format functions return plain text ready to post.

export interface TelegramConfig {
  botToken: string;
  channelId: string;
}

/**
 * Escape the five characters that are significant in Telegram's HTML parse mode.
 * Every user-supplied value (player / tournament / game names) must pass through
 * this before being interpolated, otherwise a name like `A & B` or `<x>` yields
 * malformed HTML and Telegram rejects the whole message with a 400.
 */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendTelegram(config: TelegramConfig, text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      chat_id:    config.channelId,
      text,
      parse_mode: 'HTML',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram error: ${err}`);
  }
}

export function formatGroupStandings(
  tournamentName: string,
  game: string,
  groupName: string,
  standings: Array<{ displayName: string; played: number; won: number; drawn: number; lost: number; points: number }>,
): string {
  const header = `<b>${esc(tournamentName)} — ${esc(game)}</b>\n<b>${esc(groupName)} Standings</b>\n`;
  const rows = standings
    .map((s, i) => `${i + 1}. ${esc(s.displayName)}  P${s.played} W${s.won} D${s.drawn} L${s.lost}  <b>${s.points}pts</b>`)
    .join('\n');
  return `${header}\n${rows}`;
}

export function formatBracketRound(
  tournamentName: string,
  game: string,
  roundLabel: string,
  matches: Array<{ entry1Name: string; entry2Name: string; score1: number | null; score2: number | null; winnerName: string | null }>,
): string {
  const header = `<b>${esc(tournamentName)} — ${esc(game)}</b>\n<b>${esc(roundLabel)}</b>\n`;
  const rows = matches.map((m) => {
    const e1 = esc(m.entry1Name);
    const e2 = esc(m.entry2Name);
    const score = m.score1 != null && m.score2 != null ? ` (${m.score1}–${m.score2})` : '';
    const result = m.winnerName ? ` ✓ ${esc(m.winnerName)}${score}` : ' vs ';
    return m.winnerName
      ? `${e1} v ${e2}${result}`
      : `${e1} vs ${e2}`;
  });
  return `${header}\n${rows.join('\n')}`;
}

export function formatWinner(tournamentName: string, game: string, winnerName: string): string {
  return `🏆 <b>${esc(tournamentName)} — ${esc(game)}</b>\n\nWinner: <b>${esc(winnerName)}</b>`;
}

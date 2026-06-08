// PLACEHOLDER — wire up bot token + channel ID in tournament settings.
// All format functions return plain text ready to post.

export interface TelegramConfig {
  botToken: string;
  channelId: string;
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
  const header = `<b>${tournamentName} — ${game}</b>\n<b>${groupName} Standings</b>\n`;
  const rows = standings
    .map((s, i) => `${i + 1}. ${s.displayName}  P${s.played} W${s.won} D${s.drawn} L${s.lost}  <b>${s.points}pts</b>`)
    .join('\n');
  return `${header}\n${rows}`;
}

export function formatBracketRound(
  tournamentName: string,
  game: string,
  roundLabel: string,
  matches: Array<{ entry1Name: string; entry2Name: string; score1: number | null; score2: number | null; winnerName: string | null }>,
): string {
  const header = `<b>${tournamentName} — ${game}</b>\n<b>${roundLabel}</b>\n`;
  const rows = matches.map((m) => {
    const score = m.score1 != null && m.score2 != null ? ` (${m.score1}–${m.score2})` : '';
    const result = m.winnerName ? ` ✓ ${m.winnerName}${score}` : ' vs ';
    return m.winnerName
      ? `${m.entry1Name} v ${m.entry2Name}${result}`
      : `${m.entry1Name} vs ${m.entry2Name}`;
  });
  return `${header}\n${rows.join('\n')}`;
}

export function formatWinner(tournamentName: string, game: string, winnerName: string): string {
  return `🏆 <b>${tournamentName} — ${game}</b>\n\nWinner: <b>${winnerName}</b>`;
}

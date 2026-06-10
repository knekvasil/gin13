const API_BASE = "http://localhost:2567";

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  totalScore: number;
  roundWins: number;
}

export interface MatchHistoryEntry {
  matchId: string;
  date: string;
  finalRank: number | null;
  totalScore: number;
  totalRounds: number;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${API_BASE}/leaderboard`);
  if (!res.ok) throw new Error("failed to fetch leaderboard");
  return res.json();
}

export async function fetchMatchHistory(userId: string): Promise<MatchHistoryEntry[]> {
  const res = await fetch(`${API_BASE}/matches/${userId}`);
  if (!res.ok) throw new Error("failed to fetch match history");
  return res.json();
}

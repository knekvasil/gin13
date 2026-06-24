const API_BASE = window.location.origin;

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("jwt");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  elo: number;
  totalScore: number;
  wins: number;
  matches: number;
  roundWins: number;
}

export interface MatchHistoryEntry {
  matchId: string;
  date: string;
  finalRank: number | null;
  totalScore: number;
  totalRounds: number;
}

export interface PlayerStats {
  elo: number;
  totalMatches: number;
  wins: number;
  winRate: number;
  avgRank: number;
  bestScore: number;
  worstScore: number;
  biggestRoundLoss: number | null;
  mostRoundsWonInAGame: number | null;
  maxOpponentPointsInWonRound: number | null;
  biggestGameWin: number | null;
  biggestGameLoss: number | null;
  biggestWinDiff: number | null;
  totalRoundsPlayed: number;
  peakElo: number;
  percentiles: Record<string, number>;
  scoreHistory: { matchId: string; date: string; score: number }[];
  eloHistory: { date: string; elo: number }[];
  rankHistory: { date: string; rank: number }[];
  rankDistribution: { rank: number; count: number }[];
  longestGameWinStreak: number;
  currentGameWinStreak: number;
  currentForm: { result: "W" | "L"; score: number }[];
}

export interface FriendEntry {
  id: string;
  displayName: string;
  since: string;
}

export interface PendingFriends {
  outgoing: { id: string; friendId: string; displayName: string; createdAt: string }[];
  incoming: { id: string; userId: string; displayName: string; createdAt: string }[];
}

export interface HeadToHeadEntry {
  opponentId: string;
  displayName: string;
  matches: number;
  wins: number;
  losses: number;
}

export interface RecentOpponent {
  id: string;
  displayName: string;
  lastPlayed: string;
}

export interface SearchUser {
  id: string;
  displayName: string;
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

export async function fetchPlayerStats(userId: string): Promise<PlayerStats> {
  const res = await fetch(`${API_BASE}/stats/${userId}`);
  if (!res.ok) throw new Error("failed to fetch player stats");
  return res.json();
}

export async function searchUsers(q: string): Promise<SearchUser[]> {
  const res = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("failed to search users");
  return res.json();
}

export async function fetchFriends(): Promise<FriendEntry[]> {
  const res = await fetch(`${API_BASE}/friends`, { headers: authHeaders() });
  if (!res.ok) throw new Error("failed to fetch friends");
  return res.json();
}

export async function fetchPendingFriends(): Promise<PendingFriends> {
  const res = await fetch(`${API_BASE}/friends/pending`, { headers: authHeaders() });
  if (!res.ok) throw new Error("failed to fetch pending friends");
  return res.json();
}

export async function sendFriendRequest(friendId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/friends/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ friendId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "failed to send friend request");
  }
}

export async function acceptFriendRequest(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/friends/request/${id}/accept`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("failed to accept friend request");
}

export async function declineFriendRequest(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/friends/request/${id}/decline`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("failed to decline friend request");
}

export interface FriendStatus {
  userId: string;
  inGame: boolean;
  lastSeen: string | null;
  elo: number | null;
}

export async function postHeartbeat(): Promise<void> {
  await fetch(`${API_BASE}/heartbeat`, {
    method: "POST",
    headers: authHeaders(),
  }).catch(() => {});
}

export async function fetchFriendsStatus(): Promise<FriendStatus[]> {
  const res = await fetch(`${API_BASE}/friends/status`, { headers: authHeaders() });
  if (!res.ok) throw new Error("failed to fetch friends status");
  return res.json();
}

export async function removeFriend(friendId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/friends/${friendId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("failed to remove friend");
}

export async function fetchHeadToHead(userId: string): Promise<HeadToHeadEntry[]> {
  const res = await fetch(`${API_BASE}/headtohead/${userId}`);
  if (!res.ok) throw new Error("failed to fetch head to head");
  return res.json();
}

export interface MatchDetailPlayer {
  userId: string;
  displayName: string;
  totalScore: number;
  rank: number | null;
  eloBefore: number;
  eloDelta: number;
}

export interface RoundScoreEntry {
  roundNumber: number;
  wildRank: number;
  scores: { userId: string; handScore: number }[];
}

export interface MatchDetail {
  matchId: string;
  totalRounds: number;
  players: MatchDetailPlayer[];
  roundScores: RoundScoreEntry[];
}

export async function fetchMatchDetail(matchId: string): Promise<MatchDetail> {
  const res = await fetch(`${API_BASE}/match/${matchId}`);
  if (!res.ok) throw new Error("failed to fetch match detail");
  return res.json();
}

export async function fetchRecentOpponents(userId: string): Promise<RecentOpponent[]> {
  const res = await fetch(`${API_BASE}/recent-opponents/${userId}`);
  if (!res.ok) throw new Error("failed to fetch recent opponents");
  return res.json();
}

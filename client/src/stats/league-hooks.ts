import { useQuery } from "@tanstack/react-query";

const API = window.location.origin;

async function fetchJson(path: string) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return res.json();
}

export interface LeagueCurrent {
  season: {
    id: string;
    name: string;
    roundCount: number;
    currentRound: number;
    standings: { botId: string; name: string; matchPoints: number; matchesPlayed: number; elo: number; roundRanks: (number | null)[] }[];
  } | null;
}

export function useLeagueCurrent() {
  return useQuery<LeagueCurrent>({
    queryKey: ["league", "current"],
    queryFn: () => fetchJson("/league/current"),
  });
}

export interface LeagueSeasons {
  seasons: {
    id: string;
    name: string;
    roundCount: number;
    startedAt: string;
    endedAt: string | null;
    topThree: { botId: string; matchPoints: number }[];
  }[];
}

export function useLeagueSeasons() {
  return useQuery<LeagueSeasons>({
    queryKey: ["league", "seasons"],
    queryFn: () => fetchJson("/league/seasons"),
  });
}

export interface LeagueRounds {
  seasonName: string;
  rounds: {
    roundNumber: number;
    status: string;
    pods: {
      matchId: string;
      results: { botId: string; name: string; rank: number; score: number; roundRanks: (number | null)[] }[];
    }[];
  }[];
}

export interface LeagueRoundsResponse {
  seasonName: string;
  roundCount: number;
  rounds: LeagueRounds["rounds"];
}

export function useLeagueRounds(seasonId: string | undefined) {
  return useQuery<LeagueRoundsResponse>({
    queryKey: ["league", "rounds", seasonId],
    queryFn: () => fetchJson(`/league/rounds/${seasonId}`),
    enabled: !!seasonId,
  });
}

export interface BotDetail {
  botId: string;
  name: string;
  totalMatches: number;
  wins: number;
  elo: number;
  seasons: { seasonId: string; seasonName: string; matchPoints: number; matchesPlayed: number }[];
  eloHistory: { date: string; elo: number }[];
}

export function useBotDetail(botId: string | undefined) {
  return useQuery<BotDetail>({
    queryKey: ["league", "bot", botId],
    queryFn: () => fetchJson(`/league/bot/${botId}`),
    enabled: !!botId,
  });
}
